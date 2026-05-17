import * as vscode from 'vscode';
import * as path from 'path';
import { FileNode } from '../../models';

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', '.next', 'coverage', '.DS_Store', 'out']);

const ALLOWED_EXT = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.kt', '.cs',
  '.rb', '.php', '.swift', '.cpp', '.c', '.h', '.md', '.json', '.yaml', '.yml',
  '.toml', '.sql', '.graphql', '.sh', '.bash', '.proto', '.env.example', '.txt',
  '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte'
]);

const ALLOWED_NAMES = new Set(['Makefile', 'Dockerfile', 'Jenkinsfile', 'Vagrantfile']);

export class FileSystemService {
  private workspaceRoot: vscode.Uri | undefined;

  constructor() {
    this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  }

  private shouldInclude(name: string): boolean {
    if (ALLOWED_NAMES.has(name)) return true;
    const ext = path.extname(name);
    return ALLOWED_EXT.has(ext);
  }

  async buildTree(dirUri?: vscode.Uri, relativePath: string = ''): Promise<FileNode[]> {
    const uri = dirUri || this.workspaceRoot;
    if (!uri) {
      throw new Error('No workspace folder open');
    }

    try {
      const entries = await vscode.workspace.fs.readDirectory(uri);
      const result: FileNode[] = [];

      for (const [name, type] of entries) {
        if (IGNORED.has(name)) continue;

        const fullUri = vscode.Uri.joinPath(uri, name);
        const relPath = relativePath ? `${relativePath}/${name}` : name;

        if (type === vscode.FileType.Directory) {
          const children = await this.buildTree(fullUri, relPath);
          if (children.length > 0) {
            result.push({
              name,
              path: relPath,
              type: 'directory',
              children
            });
          }
        } else if (type === vscode.FileType.File && this.shouldInclude(name)) {
          result.push({
            name,
            path: relPath,
            type: 'file'
          });
        }
      }

      return result.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
    } catch (error) {
      console.error('Error building tree:', error);
      throw error;
    }
  }

  async readFile(relativePath: string): Promise<string> {
    if (!this.workspaceRoot) {
      throw new Error('No workspace folder open');
    }

    const fileUri = vscode.Uri.joinPath(this.workspaceRoot, relativePath);
    const content = await vscode.workspace.fs.readFile(fileUri);
    const text = Buffer.from(content).toString('utf-8');
    
    // Limit to 8000 characters like the original backend
    return text.slice(0, 8000);
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    if (!this.workspaceRoot) {
      throw new Error('No workspace folder open');
    }

    const fileUri = vscode.Uri.joinPath(this.workspaceRoot, relativePath);
    const buffer = Buffer.from(content, 'utf-8');
    await vscode.workspace.fs.writeFile(fileUri, buffer);
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    if (!this.workspaceRoot) {
      throw new Error('No workspace folder open');
    }

    const oldUri = vscode.Uri.joinPath(this.workspaceRoot, oldPath);
    const newUri = vscode.Uri.joinPath(this.workspaceRoot, newPath);
    await vscode.workspace.fs.rename(oldUri, newUri);
  }

  getWorkspaceName(): string {
    return vscode.workspace.workspaceFolders?.[0]?.name || 'Workspace';
  }

  getWorkspaceRoot(): vscode.Uri | undefined {
    return this.workspaceRoot;
  }

  async getTopLevelFolders(): Promise<string[]> {
    if (!this.workspaceRoot) {
      throw new Error('No workspace folder open');
    }

    try {
      const entries = await vscode.workspace.fs.readDirectory(this.workspaceRoot);
      const folders: string[] = [];

      for (const [name, type] of entries) {
        if (type === vscode.FileType.Directory && !IGNORED.has(name)) {
          folders.push(name);
        }
      }

      return folders.sort();
    } catch (error) {
      console.error('Error getting top-level folders:', error);
      throw error;
    }
  }

  async getAllFoldersRecursive(dirUri?: vscode.Uri, relativePath: string = ''): Promise<string[]> {
    const uri = dirUri || this.workspaceRoot;
    if (!uri) {
      throw new Error('No workspace folder open');
    }

    try {
      const entries = await vscode.workspace.fs.readDirectory(uri);
      const folders: string[] = [];

      for (const [name, type] of entries) {
        if (IGNORED.has(name)) continue;

        if (type === vscode.FileType.Directory) {
          const fullUri = vscode.Uri.joinPath(uri, name);
          const relPath = relativePath ? `${relativePath}/${name}` : name;
          folders.push(relPath);
          
          // Recursively get subfolders
          const subfolders = await this.getAllFoldersRecursive(fullUri, relPath);
          folders.push(...subfolders);
        }
      }

      return folders;
    } catch (error) {
      console.error('Error getting folders recursively:', error);
      throw error;
    }
  }
}

// Made with Bob
