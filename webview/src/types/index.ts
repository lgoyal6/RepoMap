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

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls';
}

export interface ContextMenuItem {
  label: string;
  action: () => void;
}

export interface VSCodeAPI {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
}

// Made with Bob