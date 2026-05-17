import * as vscode from 'vscode';
import { MessageHandlers } from './webview/messageHandlers';
import { HtmlGenerator } from './webview/htmlGenerator';
import { ExtensionMessage, WebviewMessage } from './models';
import { BobService, DependencyService, FileSystemService, UnifiedGraphService } from './services';

export class RepomapWebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private fileSystemService: FileSystemService;
  private bobService: BobService;
  private dependencyService: DependencyService;
  private unifiedGraphService: UnifiedGraphService;
  private messageHandlers: MessageHandlers | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly context: vscode.ExtensionContext
  ) {
    this.fileSystemService = new FileSystemService();
    this.bobService = new BobService();
    this.dependencyService = new DependencyService();
    this.unifiedGraphService = new UnifiedGraphService();
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
    const htmlGenerator = new HtmlGenerator(this.extensionUri, this.panel.webview);
    this.panel.webview.html = htmlGenerator.generateHtml();
    console.log('🦍 Webview HTML set');

    // Initialize message handlers
    this.messageHandlers = new MessageHandlers(
      this.fileSystemService,
      this.bobService,
      this.unifiedGraphService,
      (message: ExtensionMessage) => this.panel?.webview.postMessage(message)
    );

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message: WebviewMessage) => {
        await this.messageHandlers?.handleMessage(message);
      },
      undefined,
      this.context.subscriptions
    );

    // Clean up when panel is closed
    this.panel.onDidDispose(
      () => {
        this.panel = undefined;
        this.messageHandlers = undefined;
      },
      null,
      this.context.subscriptions
    );

    // Auto-load workspace on open
    await this.messageHandlers.handleMessage({ type: 'loadWorkspace' });
  }
}

// Made with Bob
