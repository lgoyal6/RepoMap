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
    console.log('[GraphCombiner] ========================================');
    console.log('[GraphCombiner] Building final dependency graph...');
    console.log(`[GraphCombiner] Input data:`);
    console.log(`[GraphCombiner]   - Functions: ${functions.length}`);
    console.log(`[GraphCombiner]   - File imports: ${fileImports.length}`);
    console.log(`[GraphCombiner]   - Function usage: ${functionUsage.length}`);

    // Get file system structure
    console.log('[GraphCombiner] Step 1: Building file tree...');
    const fileTree = await this.fileSystemService.buildTree();
    console.log(`[GraphCombiner] ✓ File tree built: ${fileTree.length} root nodes`);
    
    // Build nodes from file tree + functions
    console.log('[GraphCombiner] Step 2: Building nodes from file tree + functions...');
    const nodes = this.buildNodes(fileTree, functions);
    console.log(`[GraphCombiner] ✓ Built ${nodes.length} nodes`);
    
    // Build edges from imports + function calls
    console.log('[GraphCombiner] Step 3: Building edges from imports + function calls...');
    const edges = this.buildEdges(fileImports, functionUsage);
    console.log(`[GraphCombiner] ✓ Built ${edges.length} edges`);
    console.log(`[GraphCombiner]   - Import edges: ${edges.filter(e => e.type === 'imports').length}`);
    console.log(`[GraphCombiner]   - Call edges: ${edges.filter(e => e.type === 'calls').length}`);

    const finalGraph = { nodes, edges };
    
    // Save to cache
    console.log('[GraphCombiner] Step 4: Saving to cache...');
    const cachePath = path.join(this.cacheDir, 'final-graph.json');
    await fs.promises.writeFile(cachePath, JSON.stringify(finalGraph, null, 2), 'utf-8');
    console.log(`[GraphCombiner] ✓ Saved final graph to ${cachePath}`);
    console.log('[GraphCombiner] ========================================');

    return finalGraph;
  }

  private buildNodes(fileTree: any[], functions: FunctionDefinition[]): DependencyNode[] {
    console.log(`[GraphCombiner] buildNodes: Processing ${fileTree.length} file tree nodes`);
    console.log(`[GraphCombiner] buildNodes: Grouping ${functions.length} functions by file...`);
    
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
    
    console.log(`[GraphCombiner] buildNodes: Grouped into ${functionsByFile.size} files with functions`);

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

    console.log(`[GraphCombiner] buildNodes: Created ${nodes.length} total nodes`);
    return nodes;
  }

  private buildEdges(fileImports: FileImport[], functionUsage: FunctionUsage[]): DependencyEdge[] {
    console.log(`[GraphCombiner] buildEdges: Processing ${fileImports.length} file imports`);
    console.log(`[GraphCombiner] buildEdges: Processing ${functionUsage.length} function usage entries`);
    
    const edges: DependencyEdge[] = [];
    const pathResolver = new PathResolver(this.workspaceRoot);

    // Add file import edges
    let resolvedImports = 0;
    let unresolvedImports = 0;
    
    for (const fileImport of fileImports) {
      const sourceNormalized = fileImport.sourceFile.replace(/\\/g, '/');
      
      for (const importedFile of fileImport.importedFiles) {
        // Try to resolve the import path
        const sourcePath = path.join(this.workspaceRoot, sourceNormalized);
        const resolved = pathResolver.resolveImportPath(sourcePath, importedFile);
        
        if (resolved) {
          resolvedImports++;
          const targetNormalized = path.relative(this.workspaceRoot, resolved).replace(/\\/g, '/');
          
          edges.push({
            from: sourceNormalized,
            to: targetNormalized,
            type: 'imports'
          });
        } else {
          unresolvedImports++;
          console.warn(`[GraphCombiner] ⚠️ Could not resolve import: ${importedFile} from ${sourceNormalized}`);
        }
      }
    }
    
    console.log(`[GraphCombiner] buildEdges: Resolved ${resolvedImports} imports, ${unresolvedImports} unresolved`);

    // Add function call edges
    let callEdges = 0;
    for (const usage of functionUsage) {
      const definedInNormalized = usage.definedIn.replace(/\\/g, '/');
      
      for (const usageLocation of usage.usedInFiles) {
        const usedInNormalized = usageLocation.filePath.replace(/\\/g, '/');
        
        for (const callerFunction of usageLocation.calledBy) {
          callEdges++;
          // Edge from caller function to called function
          edges.push({
            from: `${usedInNormalized}:${callerFunction}`,
            to: `${definedInNormalized}:${usage.functionName}`,
            type: 'calls'
          });
        }
      }
    }
    
    console.log(`[GraphCombiner] buildEdges: Created ${callEdges} function call edges`);
    console.log(`[GraphCombiner] buildEdges: Total edges: ${edges.length}`);

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