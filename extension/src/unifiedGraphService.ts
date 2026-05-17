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
    
    // Recursively extract all files with functions from dependency nodes
    const extractFunctions = (nodes: DependencyNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file' && node.children && node.children.length > 0) {
          functionMap.set(node.filePath, node.children);
        } else if (node.type === 'folder' && node.children) {
          // Recursively process nested folders
          extractFunctions(node.children);
        }
      }
    };
    
    extractFunctions(dependencyNodes);

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
              type: 'function' as const,
              line: funcNode.line
            }))
          };
        }
      }
      return node;
    });
  }
}

// Made with Bob