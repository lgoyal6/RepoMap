import * as vscode from 'vscode';
import * as path from 'path';
import { FileNode, DependencyEdge } from '../../models';
import { FileSystemService } from '../core';
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

  async buildUnifiedGraph(forceRefresh: boolean = false, selectedFolders?: string[]): Promise<UnifiedGraph> {
    // Build file tree
    const tree = await this.fileSystemService.buildTree();
    
    // Build dependency graph with optional folder filter
    const dependencyGraph = await this.dependencyService.buildDependencyGraph(forceRefresh, selectedFolders);
    
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