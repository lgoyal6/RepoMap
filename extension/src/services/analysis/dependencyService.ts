import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BobService } from '../bob';
import ignore from 'ignore';

export interface DependencyNode {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'function';
  filePath: string;
  line?: number;
  children?: DependencyNode[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls';
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

interface FunctionDef {
  name: string;
  line: number;
  exported: boolean;
}

interface FileImport {
  importedFile: string;
  importedSymbols: string[];
}

export class DependencyService {
  private workspaceRoot: string;
  private cache: Map<string, { imports: FileImport[]; functions: FunctionDef[] }> = new Map();
  private bobService: BobService;
  private cacheFilePath: string;

  constructor() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    this.workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
    this.bobService = new BobService();
    this.cacheFilePath = path.join(this.workspaceRoot, '.bob', 'dependency-graph.json');
  }

  private isPathWithinWorkspace(filePath: string): boolean {
    const absolutePath = path.resolve(this.workspaceRoot, filePath);
    return absolutePath.startsWith(this.workspaceRoot);
  }

  async loadCachedGraph(): Promise<DependencyGraph | null> {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const data = await fs.promises.readFile(this.cacheFilePath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load cached dependency graph:', error);
    }
    return null;
  }

  async saveCachedGraph(graph: DependencyGraph): Promise<void> {
    try {
      const dir = path.dirname(this.cacheFilePath);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      await fs.promises.writeFile(this.cacheFilePath, JSON.stringify(graph, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save cached dependency graph:', error);
    }
  }

  async buildDependencyGraph(forceRefresh: boolean = false, selectedFolders?: string[]): Promise<DependencyGraph> {
    // Try to load from cache first
    if (!forceRefresh) {
      const cached = await this.loadCachedGraph();
      if (cached) {
        console.log('Loaded dependency graph from cache');
        return cached;
      }
    }

    console.log('Building dependency graph with Bob...');
    const graph = await this.buildDependencyGraphWithBob(selectedFolders);
    await this.saveCachedGraph(graph);
    return graph;
  }

  private async buildDependencyGraphWithBob(selectedFolders?: string[]): Promise<DependencyGraph> {
    // Get all supported files
    const files = await this.getAllSupportedFiles(selectedFolders);
    const limitedFiles = files.slice(0, 50); // Limit for Bob analysis

    // Read file contents
    const fileContents: { path: string; content: string }[] = [];
    for (const filePath of limitedFiles) {
      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
        fileContents.push({ path: relativePath, content });
      } catch (error) {
        console.error(`Failed to read ${filePath}:`, error);
      }
    }

    // Build prompt for Bob
    const fileList = fileContents.map(f => `File: ${f.path}\n\`\`\`\n${f.content.slice(0, 2000)}\n\`\`\``).join('\n\n');
    
    const prompt = `Analyze these code files and return ONLY valid JSON matching this exact structure. No markdown, no explanation.

TEMPLATE (reproduce this exact shape — depth is unlimited, nest folders inside folders as needed):
{
  "nodes": [
    {
      "id": "src",
      "name": "src",
      "type": "folder",
      "children": [
        {
          "id": "src/utils.ts",
          "name": "utils.ts",
          "type": "file",
          "filePath": "src/utils.ts",
          "children": [
            {
              "id": "src/utils.ts:formatDate",
              "name": "formatDate",
              "type": "function",
              "filePath": "src/utils.ts",
              "line": 4
            },
            {
              "id": "src/utils.ts:parseISO",
              "name": "parseISO",
              "type": "function",
              "filePath": "src/utils.ts",
              "line": 12
            }
          ]
        },
        {
          "id": "src/api",
          "name": "api",
          "type": "folder",
          "children": [
            {
              "id": "src/api/client.ts",
              "name": "client.ts",
              "type": "file",
              "filePath": "src/api/client.ts",
              "children": [
                {
                  "id": "src/api/client.ts:fetchUser",
                  "name": "fetchUser",
                  "type": "function",
                  "filePath": "src/api/client.ts",
                  "line": 8
                },
                {
                  "id": "src/api/client.ts:postData",
                  "name": "postData",
                  "type": "function",
                  "filePath": "src/api/client.ts",
                  "line": 24
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "edges": [
    { "from": "src/api/client.ts",           "to": "src/utils.ts",              "type": "imports"      },
    { "from": "src/api/client.ts:fetchUser",  "to": "src/utils.ts:formatDate",   "type": "calls"        },
    { "from": "src/api/client.ts:postData",   "to": "src/api/client.ts:fetchUser","type": "calls_local" }
  ]
}

RULES:
Node structure:
- type "folder"   → has "id", "name", "children" (folders or files). Nest as deep as the real directory tree requires.
- type "file"     → has "id", "name", "type", "filePath", "children" (functions only)
- type "function" → has "id", "name", "type", "filePath", "line". NO children.
  - Capture ALL named functions, arrow functions assigned to variables, class methods, and exported constants that are functions.
  - If two functions share a name in the same file, append the line number: "src/file.ts:myFn:42"

Edge types:
- "imports"     → file to file. Add one edge per import statement found.
- "calls"       → function to function, ACROSS different files.
- "calls_local" → function to function, WITHIN the same file.
- Only emit edges between nodes that exist in the graph. Skip calls into external libraries.

IDs:
- folder:   its relative path, e.g. "src/api"
- file:     its relative path, e.g. "src/api/client.ts"
- function: "filePath:functionName", e.g. "src/api/client.ts:fetchUser"

Return ONLY the JSON.

Files to analyze:
${fileList}`;
console.log('Bob prompt:', prompt);
    try {
      const response = await this.bobService.askBob({
        system: 'You are a code analysis expert. Return only valid JSON.',
        messages: [{ role: 'user', content: prompt }]
      });
      console.log('Bob response:', response);
      const text = response.content[0]?.text || '{}';
      
      // Extract JSON from response (Bob might add extra text)
      const jsonMatch = text.match(/```json([\s\S]*?)```/);

      if (!jsonMatch) {
        throw new Error('No JSON found in Bob response');
      }
console.log('Extracted JSON from Bob response:', jsonMatch[1]);
      const graph: DependencyGraph = JSON.parse(jsonMatch[1]);
      
      // Validate structure
      if (!graph.nodes || !graph.edges) {
        throw new Error('Invalid graph structure from Bob');
      }

      return graph;
    } catch (error) {
      console.error('Bob analysis failed, falling back to regex:', error);
      return this.buildDependencyGraphWithRegex(selectedFolders);
    }
  }

  private async buildDependencyGraphWithRegex(selectedFolders?: string[]): Promise<DependencyGraph> {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const fileMap = new Map<string, DependencyNode>();

    const files = await this.getAllSupportedFiles(selectedFolders);
    const limitedFiles = files.slice(0, 200);

    for (const filePath of limitedFiles) {
      // console.log(`Considering file: ${filePath}`);
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

      for (const imp of fileData.imports) {
        const resolvedPath = this.resolveImportPath(filePath, imp.importedFile);
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
    for (const filePath of limitedFiles) {
      const fileData = this.cache.get(filePath);
      if (!fileData) continue;

      const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
      const content = await this.readFileContent(filePath);

      // For each imported symbol, find where it's called
      for (const imp of fileData.imports) {
        const resolvedPath = this.resolveImportPath(filePath, imp.importedFile);
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
    const allNodes = [...Array.from(folderMap.values()), ...nodes.filter(n => !path.dirname(n.filePath) || path.dirname(n.filePath) === '.')];

    return { nodes: allNodes, edges };
  }

  private async getAllSupportedFiles(selectedFolders?: string[]): Promise<string[]> {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs'];
    const files: string[] = [];

    // Load .gitignore rules
    const gitignorePath = path.join(this.workspaceRoot, '.gitignore');
    let gitignoreFilter: ignore.Ignore | null = null;
    if (fs.existsSync(gitignorePath)) {
        const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
        gitignoreFilter = ignore().add(gitignoreContent);
    }

    const pattern = `**/*{${extensions.join(',')}}`;
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

    for (const uri of uris) {
        const filePath = uri.fsPath;

        // Ensure the file is within the workspace root
        const absolutePath = path.resolve(this.workspaceRoot, filePath);
        if (!absolutePath.startsWith(this.workspaceRoot)) {
            continue;
        }

        // Check if the file is ignored by .gitignore
        if (gitignoreFilter && gitignoreFilter.ignores(path.relative(this.workspaceRoot, absolutePath))) {
            continue;
        }

        // Exclude specific root directories like 'Library/'
        const relativePath = path.relative(this.workspaceRoot, absolutePath);
        if (relativePath.startsWith('Library/')) {
            continue;
        }

        // Filter by selected folders if provided
        if (selectedFolders && selectedFolders.length > 0) {
            const topLevelFolder = relativePath.split(path.sep)[0];
            if (!selectedFolders.includes(topLevelFolder)) {
                continue;
            }
        }

        files.push(filePath);
    }

    return files;
}

  private async parseFile(filePath: string): Promise<{ imports: FileImport[]; functions: FunctionDef[] } | null> {
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    try {
      const content = await this.readFileContent(filePath);
      const ext = path.extname(filePath);

      const imports = this.extractImports(content, ext);
      const functions = this.extractFunctions(content, ext);

      const result = { imports, functions };
      this.cache.set(filePath, result);
      return result;
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error);
      return null;
    }
  }

  private async readFileContent(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  private extractImports(content: string, ext: string): FileImport[] {
    const imports: FileImport[] = [];

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      // ES6 imports: import { x, y } from './file'
      const es6Regex = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = es6Regex.exec(content)) !== null) {
        const symbols = match[1] ? match[1].split(',').map(s => s.trim()) : [match[2]];
        imports.push({
          importedFile: match[3],
          importedSymbols: symbols
        });
      }

      // require: const x = require('./file')
      const requireRegex = /(?:const|let|var)\s+(?:{([^}]+)}|(\w+))\s*=\s*require\s*\(['"]([^'"]+)['"]\)/g;
      while ((match = requireRegex.exec(content)) !== null) {
        const symbols = match[1] ? match[1].split(',').map(s => s.trim()) : [match[2]];
        imports.push({
          importedFile: match[3],
          importedSymbols: symbols
        });
      }

      // Dynamic imports: import('./file')
      const dynamicRegex = /import\s*\(['"]([^'"]+)['"]\)/g;
      while ((match = dynamicRegex.exec(content)) !== null) {
        imports.push({
          importedFile: match[1],
          importedSymbols: []
        });
      }
    } else if (ext === '.py') {
      // Python: from module import x, y
      const fromRegex = /from\s+([\w.]+)\s+import\s+([^;\n]+)/g;
      let match;
      while ((match = fromRegex.exec(content)) !== null) {
        const symbols = match[2].split(',').map(s => s.trim());
        imports.push({
          importedFile: match[1].replace(/\./g, '/'),
          importedSymbols: symbols
        });
      }

      // Python: import module
      const importRegex = /^import\s+([\w.]+)/gm;
      while ((match = importRegex.exec(content)) !== null) {
        imports.push({
          importedFile: match[1].replace(/\./g, '/'),
          importedSymbols: []
        });
      }
    } else if (ext === '.go') {
      // Go: import "package"
      const goRegex = /import\s+(?:\(([^)]+)\)|"([^"]+)")/g;
      let match;
      while ((match = goRegex.exec(content)) !== null) {
        if (match[1]) {
          const packages = match[1].split('\n').map(p => p.trim().replace(/"/g, '')).filter(p => p);
          packages.forEach(pkg => imports.push({ importedFile: pkg, importedSymbols: [] }));
        } else {
          imports.push({ importedFile: match[2], importedSymbols: [] });
        }
      }
    } else if (ext === '.java') {
      // Java: import package.Class;
      const javaRegex = /import\s+([\w.]+);/g;
      let match;
      while ((match = javaRegex.exec(content)) !== null) {
        imports.push({
          importedFile: match[1].replace(/\./g, '/'),
          importedSymbols: []
        });
      }
    }

    return imports;
  }

  private extractFunctions(content: string, ext: string): FunctionDef[] {
    const functions: FunctionDef[] = [];
    const lines = content.split('\n');

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      // Function declarations: function name(
      const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        functions.push({
          name: match[1],
          line,
          exported: /export/.test(content.substring(Math.max(0, match.index - 20), match.index))
        });
      }

      // Arrow functions: const name = (
      const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
      while ((match = arrowRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        functions.push({
          name: match[1],
          line,
          exported: /export/.test(content.substring(Math.max(0, match.index - 20), match.index))
        });
      }

      // Class methods: methodName(
      const methodRegex = /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/g;
      while ((match = methodRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        functions.push({
          name: match[1],
          line,
          exported: false
        });
      }

      // Classes: class Name
      const classRegex = /(?:export\s+)?class\s+(\w+)/g;
      while ((match = classRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        functions.push({
          name: match[1],
          line,
          exported: /export/.test(content.substring(Math.max(0, match.index - 20), match.index))
        });
      }
    } else if (ext === '.py') {
      // Python: def name(
      const defRegex = /def\s+(\w+)\s*\(/g;
      let match;
      while ((match = defRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        functions.push({
          name: match[1],
          line,
          exported: true // Python doesn't have explicit exports
        });
      }

      // Python: class Name:
      const classRegex = /class\s+(\w+)\s*:/g;
      while ((match = classRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        functions.push({
          name: match[1],
          line,
          exported: true
        });
      }
    } else if (ext === '.go') {
      // Go: func name(
      const funcRegex = /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/g;
      let match;
      while ((match = funcRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        const isExported = /^[A-Z]/.test(match[1]); // Go exports start with capital
        functions.push({
          name: match[1],
          line,
          exported: isExported
        });
      }
    } else if (ext === '.java') {
      // Java: public/private/protected ... name(
      const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+\s+)?(\w+)\s*\(/g;
      let match;
      while ((match = methodRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        functions.push({
          name: match[1],
          line,
          exported: /public/.test(content.substring(Math.max(0, match.index - 50), match.index))
        });
      }

      // Java: class Name
      const classRegex = /(?:public\s+)?class\s+(\w+)/g;
      while ((match = classRegex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        functions.push({
          name: match[1],
          line,
          exported: /public/.test(content.substring(Math.max(0, match.index - 20), match.index))
        });
      }
    }

    return functions;
  }

  private resolveImportPath(fromFile: string, importPath: string): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const dir = path.dirname(fromFile);
      let resolved = path.resolve(dir, importPath);

      // Try with common extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs'];
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

      // Try as-is
      if (fs.existsSync(resolved)) {
        return resolved;
      }
    }

    // For absolute imports, try to resolve from workspace root
    const absolutePath = path.join(this.workspaceRoot, importPath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs'];
    for (const ext of extensions) {
      if (fs.existsSync(absolutePath + ext)) {
        return absolutePath + ext;
      }
    }

    return null;
  }
}

// Made with Bob
