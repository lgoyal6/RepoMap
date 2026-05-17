import * as vscode from 'vscode';
import { RepomapWebviewProvider } from './providers';

export function activate(context: vscode.ExtensionContext) {
  console.log('Repomap extension is now active');

  // Register the command to open Repomap panel
  const openPanelCommand = vscode.commands.registerCommand('repomap.openPanel', async () => {
    // Check if a workspace is open
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('Please open a workspace folder to use Repomap');
      return;
    }

    const provider = new RepomapWebviewProvider(context.extensionUri, context);
    await provider.show();
  });

  context.subscriptions.push(openPanelCommand);
}

export function deactivate() {
  console.log('Repomap extension is now deactivated');
}

// Made with Bob
