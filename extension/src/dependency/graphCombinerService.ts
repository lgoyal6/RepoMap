import * as path from 'path';
import * as fs from 'fs';
import { FunctionDefinition, FileImport, FunctionUsage } from './bobAnalysisService';
import { DependencyNode, DependencyEdge } from '../types';
import { FileSystemService } from '../fileSystemService';

export interface FinalGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export class GraphCombinerService {
  private workspaceRoot: string;
  private fileSystemService: FileSystemService;
  private cacheDir: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.fileSystemService = new FileSystemService();
    this.cacheDir = path.join(workspaceRoot, '.bob', 'analysis');
  }

  /**
   * Phase 4: Combine all analysis results into final graph
   */
  async buildFinalGraph(
    functions: FunctionDefinition[],
    fileImports: FileImport[],
    functionUsage: FunctionUsage[]
  ): Promise<FinalGraph> {
    console.log('Building final dependency graph...');

    // Get file system structure
    const fileTree = await this.fileSystemService.buildTree();
    
    // Build nodes from file tree + functions
    const nodes = this.buildNodes(fileTree, functions);
    
    // Build edges from imports + function calls
    const edges = this.buildEdges(fileImports, functionUsage);

    const finalGraph = { nodes, edges };
    
    // Save to cache
    const cachePath = path.join(this.cacheDir, 'final-graph.json');
    await fs.promises.writeFile(cachePath, JSON.stringify(finalGraph, null, 2), 'utf-8');
    console.log('Saved final graph to cache');

    return finalGraph;
  }

  private buildNodes(fileTree: any[], functions: FunctionDefinition[]): DependencyNode[] {
    const nodes: DependencyNode[] = [];
    const functionsByFile = new Map<string, FunctionDefinition[]>();

    // Group functions by file
    for (const func of functions) {
      const normalized = func.filePath.replace(/\\/g, '/');
      if (!functionsByFile.has(normalized)) {
        functionsByFile.set(normalized, []);
      }
      functionsByFile.get(normalized)!.push(func);
    }

    // Recursively process file tree
    const processNode = (node: any, depth: number = 0): DependencyNode | null => {
      const normalizedPath = node.path.replace(/\\/g, '/');

      if (node.type === 'directory') {
        const children: DependencyNode[] = [];
        
        if (node.children) {
          for (const child of node.children) {
            const childNode = processNode(child, depth + 1);
            if (childNode) {
              children.push(childNode);
            }
          }
        }

        // Only include directory if it has children
        if (children.length > 0) {
          return {
            id: normalizedPath,
            name: node.name,
            type: 'folder',
            filePath: normalizedPath,
            children
          };
        }
        return null;
      } else {
        // File node
        const fileFunctions = functionsByFile.get(normalizedPath) || [];
        const functionNodes: DependencyNode[] = fileFunctions.map(func => ({
          id: `${normalizedPath}:${func.name}`,
          name: func.name,
          type: 'function',
          filePath: normalizedPath,
          line: func.line
        }));

        return {
          id: normalizedPath,
          name: node.name,
          type: 'file',
          filePath: normalizedPath,
          children: functionNodes.length > 0 ? functionNodes : undefined
        };
      }
    };

    for (const rootNode of fileTree) {
      const node = processNode(rootNode);
      if (node) {
        nodes.push(node);
      }
    }

    return nodes;
  }

  private buildEdges(fileImports: FileImport[], functionUsage: FunctionUsage[]): DependencyEdge[] {
    const edges: DependencyEdge[] = [];
    const pathResolver = new PathResolver(this.workspaceRoot);

    // Add file import edges
    for (const fileImport of fileImports) {
      const sourceNormalized = fileImport.sourceFile.replace(/\\/g, '/');
      
      for (const importedFile of fileImport.importedFiles) {
        // Try to resolve the import path
        const sourcePath = path.join(this.workspaceRoot, sourceNormalized);
        const resolved = pathResolver.resolveImportPath(sourcePath, importedFile);
        
        if (resolved) {
          const targetNormalized = path.relative(this.workspaceRoot, resolved).replace(/\\/g, '/');
          
          edges.push({
            from: sourceNormalized,
            to: targetNormalized,
            type: 'imports'
          });
        }
      }
    }

    // Add function call edges
    for (const usage of functionUsage) {
      const definedInNormalized = usage.definedIn.replace(/\\/g, '/');
      
      for (const usageLocation of usage.usedInFiles) {
        const usedInNormalized = usageLocation.filePath.replace(/\\/g, '/');
        
        for (const callerFunction of usageLocation.calledBy) {
          // Edge from caller function to called function
          edges.push({
            from: `${usedInNormalized}:${callerFunction}`,
            to: `${definedInNormalized}:${usage.functionName}`,
            type: 'calls'
          });
        }
      }
    }

    return edges;
  }

  async loadCachedGraph(): Promise<FinalGraph | null> {
    const cachePath = path.join(this.cacheDir, 'final-graph.json');
    if (fs.existsSync(cachePath)) {
      const content = await fs.promises.readFile(cachePath, 'utf-8');
      return JSON.parse(content);
    }
    return null;
  }
}

// Simple path resolver for the combiner
class PathResolver {
  constructor(private workspaceRoot: string) {}

  resolveImportPath(fromFile: string, importPath: string): string | null {
    // Handle URLs
    if (importPath.startsWith('http://') || importPath.startsWith('https://') || importPath.startsWith('//')) {
      return null;
    }

    // Handle relative imports
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      const dir = path.dirname(fromFile);
      let resolved = path.resolve(dir, importPath);

      // Try with common extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.css', '.html', '.htm'];
      
      // Try as-is first
      if (fs.existsSync(resolved)) {
        return resolved;
      }
      
      for (const ext of extensions) {
        if (fs.existsSync(resolved + ext)) {
          return resolved + ext;
        }
      }

      // Try as directory with index file
      for (const ext of extensions) {
        const indexPath = path.join(resolved, `index${ext}`);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
    }

    // For absolute imports, try from workspace root
    const absolutePath = path.join(this.workspaceRoot, importPath);
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }

    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.css', '.html', '.htm'];
    for (const ext of extensions) {
      if (fs.existsSync(absolutePath + ext)) {
        return absolutePath + ext;
      }
    }

    return null;
  }
}

// Made with Bob