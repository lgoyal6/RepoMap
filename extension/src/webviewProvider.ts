import * as vscode from 'vscode';
import * as path from 'path';
import { FileSystemService } from './fileSystemService';
import { BobService } from './bobService';
import { DependencyService } from './dependencyService';
import { WebviewMessage, ExtensionMessage, BobMessage } from './types';

export class RepomapWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private fileSystemService: FileSystemService;
  private bobService: BobService;
  private dependencyService: DependencyService;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this.fileSystemService = new FileSystemService();
    this.bobService = new BobService();
    this.dependencyService = new DependencyService();
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

    // Auto-load workspace on open
    await this.loadWorkspace();
  }

  private async handleMessage(message: WebviewMessage) {
    try {
      switch (message.type) {
        case 'loadWorkspace':
          await this.loadWorkspace();
          break;

        case 'loadDependencyGraph':
          await this.loadDependencyGraph();
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

  private async loadWorkspace() {
    console.log('🦍 Loading workspace...');
    try {
      const tree = await this.fileSystemService.buildTree();
      const workspaceName = this.fileSystemService.getWorkspaceName();
      console.log('🦍 Workspace loaded:', workspaceName, 'Files:', tree.length);
      
      this.sendMessage({
        type: 'workspaceLoaded',
        tree,
        workspaceName
      });
    } catch (error: any) {
      console.error('🦍 Error loading workspace:', error);
      this.sendMessage({
        type: 'error',
        message: `Failed to load workspace: ${error.message}`
      });
    }
  }

  private async loadDependencyGraph() {
    console.log('🦍 Loading dependency graph...');
    try {
      const graph = await this.dependencyService.buildDependencyGraph();
      console.log('🦍 Dependency graph loaded:', graph.nodes.length, 'nodes,', graph.edges.length, 'edges');
      
      this.sendMessage({
        type: 'dependencyGraphLoaded',
        graph
      });
    } catch (error: any) {
      console.error('🦍 Error loading dependency graph:', error);
      this.sendMessage({
        type: 'error',
        message: `Failed to load dependency graph: ${error.message}`
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
      await this.fileSystemService.renameFile(oldPath, newPath);
      this.sendMessage({
        type: 'fileRenamed',
        oldPath,
        newPath,
        success: true
      });
      // Reload workspace tree after rename
      await this.loadWorkspace();
    } catch (error: any) {
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
