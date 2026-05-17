import * as path from 'path';
import * as fs from 'fs';
import { CodeParser, ParsedFile } from './codeParser';
import { PathResolver } from './pathResolver';
import { DependencyNode } from '../models';
import { DependencyEdge } from '../services';
// import { DependencyNode, DependencyEdge } from '../types';

export class GraphBuilder {
  private cache: Map<string, ParsedFile> = new Map();
  private codeParser: CodeParser;
  private pathResolver: PathResolver;

  constructor(private workspaceRoot: string) {
    this.codeParser = new CodeParser();
    this.pathResolver = new PathResolver(workspaceRoot);
  }

  async buildGraph(files: string[]): Promise<{ nodes: DependencyNode[]; edges: DependencyEdge[] }> {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const fileMap = new Map<string, DependencyNode>();

    // Parse all files and build nodes
    for (const filePath of files) {
      const fileData = await this.parseFile(filePath);
      if (!fileData) continue;

      const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
      const fileName = path.basename(filePath);
      
      const fileNode: DependencyNode = {
        id: relativePath,
        name: fileName,
        type: 'file',
        filePath: relativePath,
        children: []
      };

      // Add function nodes as children
      for (const func of fileData.functions) {
        const funcNode: DependencyNode = {
          id: `${relativePath}:${func.name}`,
          name: func.name,
          type: 'function',
          filePath: relativePath,
          line: func.line
        };
        fileNode.children!.push(funcNode);
      }

      nodes.push(fileNode);
      fileMap.set(relativePath, fileNode);

      // Build import edges
      for (const imp of fileData.imports) {
        const resolvedPath = this.pathResolver.resolveImportPath(filePath, imp.importedFile);
        if (resolvedPath) {
          const targetRelPath = path.relative(this.workspaceRoot, resolvedPath).replace(/\\/g, '/');
          edges.push({
            from: relativePath,
            to: targetRelPath,
            type: 'imports'
          });
        }
      }
    }

    // Build function call edges
    for (const filePath of files) {
      const fileData = this.cache.get(filePath);
      if (!fileData) continue;

      const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
      const content = await this.readFileContent(filePath);

      // For each imported symbol, find where it's called
      for (const imp of fileData.imports) {
        const resolvedPath = this.pathResolver.resolveImportPath(filePath, imp.importedFile);
        if (!resolvedPath) continue;

        const targetRelPath = path.relative(this.workspaceRoot, resolvedPath).replace(/\\/g, '/');
        const targetData = this.cache.get(resolvedPath);
        if (!targetData) continue;

        // Check which imported symbols are actually called
        for (const symbol of imp.importedSymbols) {
          const targetFunc = targetData.functions.find(f => f.name === symbol && f.exported);
          if (!targetFunc) continue;

          // Simple regex to find function calls
          const callRegex = new RegExp(`\\b${symbol}\\s*\\(`, 'g');
          if (callRegex.test(content)) {
            edges.push({
              from: relativePath,
              to: `${targetRelPath}:${symbol}`,
              type: 'calls'
            });
          }
        }
      }
    }

    // Group files by folder
    const folderMap = new Map<string, DependencyNode>();
    for (const node of nodes) {
      const dir = path.dirname(node.filePath);
      if (dir && dir !== '.') {
        if (!folderMap.has(dir)) {
          folderMap.set(dir, {
            id: dir,
            name: path.basename(dir),
            type: 'folder',
            filePath: dir,
            children: []
          });
        }
        folderMap.get(dir)!.children!.push(node);
      }
    }

    // Add folder nodes
    const allNodes = [
      ...Array.from(folderMap.values()),
      ...nodes.filter(n => !path.dirname(n.filePath) || path.dirname(n.filePath) === '.')
    ];

    return { nodes: allNodes, edges };
  }

  private async parseFile(filePath: string): Promise<ParsedFile | null> {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    const result = await this.codeParser.parseFile(filePath);
    if (result) {
      this.cache.set(filePath, result);
    }
    return result;
  }

  private async readFileContent(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Made with Bob