import * as vscode from 'vscode';

export class HtmlGenerator {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly webview: vscode.Webview
  ) {}

  generateHtml(): string {
    // Path to the built webview assets (copied into extension during build)
    const webviewDistPath = vscode.Uri.joinPath(this.extensionUri, 'webview-dist');
    const scriptUri = this.webview.asWebviewUri(vscode.Uri.joinPath(webviewDistPath, 'assets', 'index.js'));
    const styleUri = this.webview.asWebviewUri(vscode.Uri.joinPath(webviewDistPath, 'assets', 'index.css'));

    console.log('🦍 Extension URI:', this.extensionUri.toString());
    console.log('🦍 Webview dist path:', webviewDistPath.toString());
    console.log('🦍 Script URI:', scriptUri.toString());
    console.log('🦍 Style URI:', styleUri.toString());

    // Use a nonce for security
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${this.webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Repomap</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}

// Made with Bob