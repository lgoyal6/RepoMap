import * as vscode from 'vscode';
import * as path from 'path';
import { FileNode, DependencyEdge } from './types';
import { FileSystemService } from './fileSystemService';
import { DependencyService, DependencyGraph } from './dependencyService';

export interface UnifiedGraph {
  tree: FileNode[];
  edges: DependencyEdge[];
}

export class UnifiedGraphService {
  private fileSystemService: FileSystemService;
  private dependencyService: DependencyService;
  private workspaceRoot: string;

  constructor() {
    this.fileSystemService = new FileSystemService();
    this.dependencyService = new DependencyService();
    const workspaceFolders = vscode.workspace.workspaceFolders;
    this.workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
  }

  async buildUnifiedGraph(forceRefresh: boolean = false): Promise<UnifiedGraph> {
    // Build file tree
    const tree = await this.fileSystemService.buildTree();
    
    // Build dependency graph
    const dependencyGraph = await this.dependencyService.buildDependencyGraph(forceRefresh);
    
    // The tree already has all the files we need
    // We just need to add the dependency edges
    // The edges reference file paths that should match the tree paths
    
    return {
      tree,
      edges: dependencyGraph.edges
    };
  }
}

// Made with Bob