import * as vscode from 'vscode';
import * as path from 'path';
import { FileNode, DependencyEdge, DependencyNode } from './types';
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
    // Build file system tree (has all folders and files)
    const fileTree = await this.fileSystemService.buildTree();
    
    // Build dependency graph (has function children and edges)
    const dependencyGraph = await this.dependencyService.buildDependencyGraph(forceRefresh);
    
    // Merge: Add function children from dependency graph to file tree
    const enrichedTree = this.enrichTreeWithFunctions(fileTree, dependencyGraph.nodes);
    
    return {
      tree: enrichedTree,
      edges: dependencyGraph.edges
    };
  }

  private enrichTreeWithFunctions(fileTree: FileNode[], dependencyNodes: DependencyNode[]): FileNode[] {
    // Create a map of file paths to their function children
    const functionMap = new Map<string, DependencyNode[]>();
    
    for (const depNode of dependencyNodes) {
      if (depNode.type === 'file' && depNode.children && depNode.children.length > 0) {
        functionMap.set(depNode.filePath, depNode.children);
      } else if (depNode.type === 'folder' && depNode.children) {
        // Handle files within folders
        for (const childNode of depNode.children) {
          if (childNode.type === 'file' && childNode.children && childNode.children.length > 0) {
            functionMap.set(childNode.filePath, childNode.children);
          }
        }
      }
    }

    // Recursively add function children to matching files in the tree
    return this.addFunctionsToTree(fileTree, functionMap);
  }

  private addFunctionsToTree(nodes: FileNode[], functionMap: Map<string, DependencyNode[]>): FileNode[] {
    return nodes.map(node => {
      if (node.type === 'directory' && node.children) {
        // Recursively process directory children
        return {
          ...node,
          children: this.addFunctionsToTree(node.children, functionMap)
        };
      } else if (node.type === 'file') {
        // Check if this file has functions
        const functions = functionMap.get(node.path);
        if (functions && functions.length > 0) {
          return {
            ...node,
            children: functions.map(funcNode => ({
              name: funcNode.name,
              path: funcNode.id, // Use full ID (file:function)
              type: 'file' as const, // Functions represented as file type
              children: []
            }))
          };
        }
      }
      return node;
    });
  }
}

// Made with Bob