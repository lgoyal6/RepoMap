import * as vscode from 'vscode';
import * as path from 'path';
import { FileSystemService } from '../services/core';
import { BobService, BobRefactoringService } from '../services/bob';
import { DependencyService, UnifiedGraphService } from '../services/analysis';
import { WebviewMessage, ExtensionMessage, BobMessage } from '../models';

export class RepomapWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private fileSystemService: FileSystemService;
  private bobService: BobService;
  private dependencyService: DependencyService;
  private unifiedGraphService: UnifiedGraphService;
  private bobRefactoringService: BobRefactoringService;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this.fileSystemService = new FileSystemService();
    this.bobService = new BobService();
    this.dependencyService = new DependencyService();
    this.unifiedGraphService = new UnifiedGraphService();
    this.bobRefactoringService = new BobRefactoringService();
  }

  public async show() {
    console.log('🦍 RepomapWebviewProvider.show() called');
    
    // Check if Bob is available
    const bobAvailable = await this.bobService.checkBobAvailable();
    console.log('🦍 Bob available:', bobAvailable);
    
    if (!bobAvailable) {
      const result = await vscode.window.showWarningMessage(
        'IBM Bob CLI is not installed or not in PATH. Repomap requires Bob for AI features.',
        'Continue Anyway',
        'Cancel'
      );
      if (result !== 'Continue Anyway') {
        return;
      }
    }

    if (this.panel) {
      console.log('🦍 Panel already exists, revealing');
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    console.log('🦍 Creating new webview panel');
    this.panel = vscode.window.createWebviewPanel(
      'repomap',
      'Repomap',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist'),
          vscode.Uri.joinPath(this.extensionUri, 'webview-dist')
        ]
      }
    );

    console.log('🦍 Setting webview HTML');
    this.panel.webview.html = this.getWebviewContent(this.panel.webview);
    console.log('🦍 Webview HTML set');

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        await this.handleMessage(message);
      },
      undefined,
      this.context.subscriptions
    );

    // Clean up when panel is closed
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
      },
      null,
      this.context.subscriptions
    );

    // Auto-load workspace on open - but first request folder selection
    await this.requestFolderSelection();
  }

  private async handleMessage(message: WebviewMessage) {
    try {
      switch (message.type) {
        case 'loadWorkspace':
          await this.loadWorkspace();
          break;

        case 'loadDependencyGraph':
          await this.loadDependencyGraph(false);
          break;

        case 'refreshDependencyGraph':
          await this.loadDependencyGraph(true);
          break;

        case 'selectFoldersForAnalysis':
          await this.loadWorkspaceWithFolders(message.folders);
          break;

        case 'readFile':
          await this.readFile(message.path);
          break;

        case 'writeFile':
          await this.writeFile(message.path, message.content);
          break;

        case 'renameFile':
          await this.renameFile(message.oldPath, message.newPath);
          break;

        case 'askBob':
          await this.askBob(message.system, message.messages);
          break;
      }
    } catch (error: any) {
      this.sendMessage({
        type: 'error',
        message: error.message || 'An error occurred'
      });
    }
  }

  private async requestFolderSelection() {
    console.log('🦍 Requesting folder selection...');
    try {
      // Get all folders recursively from workspace
      const folders = await this.fileSystemService.getAllFoldersRecursive();
      console.log('🦍 Found folders (including subfolders):', folders);
      
      this.sendMessage({
        type: 'requestFolderSelection',
        folders
      });
    } catch (error: any) {
      console.error('🦍 Error getting folders:', error);
      // Fallback to loading all
      await this.loadWorkspace();
    }
  }

  private async loadWorkspace() {
    console.log('🦍 Loading unified workspace graph...');
    try {
      const unifiedGraph = await this.unifiedGraphService.buildUnifiedGraph(false);
      const workspaceName = this.fileSystemService.getWorkspaceName();
      console.log('🦍 Unified graph loaded:', workspaceName, 'Files:', unifiedGraph.tree.length, 'Edges:', unifiedGraph.edges.length);
      
      this.sendMessage({
        type: 'workspaceLoaded',
        tree: unifiedGraph.tree,
        workspaceName,
        edges: unifiedGraph.edges
      });
    } catch (error: any) {
      console.error('🦍 Error loading workspace:', error);
      this.sendMessage({
        type: 'error',
        message: `Failed to load workspace: ${error.message}`
      });
    }
  }

  private async loadWorkspaceWithFolders(folders: string[]) {
    console.log('🦍 Loading unified workspace graph with selected folders:', folders);
    try {
      const unifiedGraph = await this.unifiedGraphService.buildUnifiedGraph(false, folders);
      const workspaceName = this.fileSystemService.getWorkspaceName();
      console.log('🦍 Unified graph loaded:', workspaceName, 'Files:', unifiedGraph.tree.length, 'Edges:', unifiedGraph.edges.length);
      
      this.sendMessage({
        type: 'workspaceLoaded',
        tree: unifiedGraph.tree,
        workspaceName,
        edges: unifiedGraph.edges
      });
    } catch (error: any) {
      console.error('🦍 Error loading workspace:', error);
      this.sendMessage({
        type: 'error',
        message: `Failed to load workspace: ${error.message}`
      });
    }
  }

  private async loadDependencyGraph(forceRefresh: boolean = false) {
    console.log(`🦍 ${forceRefresh ? 'Refreshing' : 'Reloading'} unified graph...`);
    try {
      const unifiedGraph = await this.unifiedGraphService.buildUnifiedGraph(forceRefresh);
      const workspaceName = this.fileSystemService.getWorkspaceName();
      console.log('🦍 Unified graph reloaded:', unifiedGraph.tree.length, 'files,', unifiedGraph.edges.length, 'edges');
      
      this.sendMessage({
        type: 'workspaceLoaded',
        tree: unifiedGraph.tree,
        workspaceName,
        edges: unifiedGraph.edges
      });
    } catch (error: any) {
      console.error('🦍 Error loading unified graph:', error);
      this.sendMessage({
        type: 'error',
        message: `Failed to load unified graph: ${error.message}`
      });
    }
  }

  private async readFile(filePath: string) {
    try {
      const content = await this.fileSystemService.readFile(filePath);
      this.sendMessage({
        type: 'fileContent',
        path: filePath,
        content
      });
    } catch (error: any) {
      this.sendMessage({
        type: 'error',
        message: `Failed to read file: ${error.message}`
      });
    }
  }

  private async writeFile(filePath: string, content: string) {
    try {
      await this.fileSystemService.writeFile(filePath, content);
      this.sendMessage({
        type: 'fileWritten',
        path: filePath,
        success: true
      });
    } catch (error: any) {
      this.sendMessage({
        type: 'fileWritten',
        path: filePath,
        success: false
      });
      this.sendMessage({
        type: 'error',
        message: `Failed to write file: ${error.message}`
      });
    }
  }

  private async renameFile(oldPath: string, newPath: string) {
    try {
      // Get absolute paths for Bob refactoring
      const workspaceRoot = this.fileSystemService.getWorkspaceRoot();
      if (!workspaceRoot) {
        throw new Error('No workspace folder open');
      }
      
      const oldAbsPath = vscode.Uri.joinPath(workspaceRoot, oldPath).fsPath;
      const newAbsPath = vscode.Uri.joinPath(workspaceRoot, newPath).fsPath;
      
      // Use Bob to refactor all references before physical rename
      console.log(`🦍 Starting Bob refactoring for rename: ${oldPath} -> ${newPath}`);
      const result = await this.bobRefactoringService.refactorRename(oldAbsPath, newAbsPath);
      
      // Perform the physical rename
      await this.fileSystemService.renameFile(oldPath, newPath);
      
      // Send success message
      this.sendMessage({
        type: 'fileRenamed',
        oldPath,
        newPath,
        success: true
      });
      
      // Show user what was updated
      if (result.filesUpdated.length > 0) {
        vscode.window.showInformationMessage(
          `✅ Renamed and updated ${result.filesUpdated.length} file(s) with references`
        );
        console.log(`🦍 Bob updated ${result.filesUpdated.length} files:`, result.filesUpdated);
      } else {
        vscode.window.showInformationMessage('✅ Renamed successfully (no references found)');
      }
      
      // Show warnings if there were errors
      if (result.errors.length > 0) {
        vscode.window.showWarningMessage(
          `⚠️ Rename completed with ${result.errors.length} error(s). Check output for details.`
        );
        result.errors.forEach(err => console.error('🦍 Bob refactoring error:', err));
      }
      
      // Reload workspace tree after rename
      await this.loadWorkspace();
    } catch (error: any) {
      console.error('🦍 Rename failed:', error);
      this.sendMessage({
        type: 'fileRenamed',
        oldPath,
        newPath,
        success: false
      });
      this.sendMessage({
        type: 'error',
        message: `Failed to rename file: ${error.message}`
      });
    }
  }

  private async askBob(system: string, messages: BobMessage[]) {
    try {
      const response = await this.bobService.askBob({ system, messages });
      this.sendMessage({
        type: 'bobResponse',
        content: response.content
      });
    } catch (error: any) {
      this.sendMessage({
        type: 'error',
        message: `Bob error: ${error.message}`
      });
    }
  }

  private sendMessage(message: ExtensionMessage) {
    this.panel?.webview.postMessage(message);
  }

  private getWebviewContent(webview: vscode.Webview): string {
    // Path to the built webview assets (copied into extension during build)
    const webviewDistPath = vscode.Uri.joinPath(this.extensionUri, 'webview-dist');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewDistPath, 'assets', 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewDistPath, 'assets', 'index.css'));

    console.log('🦍 Extension URI:', this.extensionUri.toString());
    console.log('🦍 Webview dist path:', webviewDistPath.toString());
    console.log('🦍 Script URI:', scriptUri.toString());
    console.log('🦍 Style URI:', styleUri.toString());

    // Use a nonce for security
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Repomap</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Made with Bob
