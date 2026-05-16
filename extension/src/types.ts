export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface BobMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface BobRequest {
  system: string;
  messages: BobMessage[];
}

export interface BobResponse {
  content: Array<{ type: string; text: string }>;
}

// Messages from webview to extension
export type WebviewMessage =
  | { type: 'loadWorkspace' }
  | { type: 'readFile'; path: string }
  | { type: 'writeFile'; path: string; content: string }
  | { type: 'renameFile'; oldPath: string; newPath: string }
  | { type: 'askBob'; system: string; messages: BobMessage[] };

// Messages from extension to webview
export type ExtensionMessage =
  | { type: 'workspaceLoaded'; tree: FileNode[]; workspaceName: string }
  | { type: 'fileContent'; path: string; content: string }
  | { type: 'bobResponse'; content: Array<{ type: string; text: string }> }
  | { type: 'fileWritten'; path: string; success: boolean }
  | { type: 'fileRenamed'; oldPath: string; newPath: string; success: boolean }
  | { type: 'error'; message: string };

// Made with Bob
