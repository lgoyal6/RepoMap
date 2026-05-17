import * as vscode from 'vscode';
import { BobService, FileSystemService, UnifiedGraphService } from '../services';
import { BobMessage, ExtensionMessage, WebviewMessage } from '../models';

export class MessageHandlers {
  constructor(
    private fileSystemService: FileSystemService,
    private bobService: BobService,
    private unifiedGraphService: UnifiedGraphService,
    private sendMessage: (message: ExtensionMessage) => void
  ) {}

  async handleMessage(message: WebviewMessage): Promise<void> {
    try {
      switch (message.type) {
        case 'loadWorkspace':
          await this.handleLoadWorkspace();
          break;

        case 'loadDependencyGraph':
          await this.handleLoadDependencyGraph(false);
          break;

        case 'refreshDependencyGraph':
          await this.handleLoadDependencyGraph(true);
          break;

        case 'readFile':
          await this.handleReadFile(message.path);
          break;

        case 'writeFile':
          await this.handleWriteFile(message.path, message.content);
          break;

        case 'renameFile':
          await this.handleRenameFile(message.oldPath, message.newPath);
          break;

        case 'askBob':
          await this.handleAskBob(message.system, message.messages);
          break;
      }
    } catch (error: any) {
      this.sendMessage({
        type: 'error',
        message: error.message || 'An error occurred'
      });
    }
  }

  private async handleLoadWorkspace(): Promise<void> {
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

  private async handleLoadDependencyGraph(forceRefresh: boolean): Promise<void> {
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

  private async handleReadFile(filePath: string): Promise<void> {
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

  private async handleWriteFile(filePath: string, content: string): Promise<void> {
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

  private async handleRenameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      await this.fileSystemService.renameFile(oldPath, newPath);
      this.sendMessage({
        type: 'fileRenamed',
        oldPath,
        newPath,
        success: true
      });
      // Reload workspace tree after rename
      await this.handleLoadWorkspace();
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

  private async handleAskBob(system: string, messages: BobMessage[]): Promise<void> {
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
}

// Made with Bob