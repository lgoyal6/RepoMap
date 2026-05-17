import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BobService } from './bobService';
import { GraphBuilder } from './dependency/graphBuilder';
import { DependencyNode, DependencyEdge } from './types';

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export class DependencyService {
  private workspaceRoot: string;
  private bobService: BobService;
  private graphBuilder: GraphBuilder;
  private cacheFilePath: string;

  constructor() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    this.workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
    this.bobService = new BobService();
    this.graphBuilder = new GraphBuilder(this.workspaceRoot);
    this.cacheFilePath = path.join(this.workspaceRoot, '.bob', 'dependency-graph.json');
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

  async buildDependencyGraph(forceRefresh: boolean = false): Promise<DependencyGraph> {
    // Try to load from cache first
    if (!forceRefresh) {
      const cached = await this.loadCachedGraph();
      if (cached) {
        console.log('Loaded dependency graph from cache');
        return cached;
      }
    }

    console.log('Building dependency graph with Bob...');
    const graph = await this.buildDependencyGraphWithBob();
    await this.saveCachedGraph(graph);
    return graph;
  }

  private async buildDependencyGraphWithBob(): Promise<DependencyGraph> {
    // Get all supported files
    const files = await this.getAllSupportedFiles();
    const limitedFiles = files.slice(0, 30); // Reduced from 50 to 30 for better performance

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

    // Build prompt for Bob - reduced content size for faster processing
    const fileList = fileContents.map(f => `File: ${f.path}\n\`\`\`\n${f.content.slice(0, 1000)}\n\`\`\``).join('\n\n');
    
    const prompt = `Analyze these code files and create a dependency graph. Return ONLY valid JSON in this exact format:
{
  "nodes": [
    {"id": "path/to/file.ts", "name": "file.ts", "type": "file", "filePath": "path/to/file.ts", "children": [
      {"id": "path/to/file.ts:functionName", "name": "functionName", "type": "function", "filePath": "path/to/file.ts", "line": 10}
    ]}
  ],
  "edges": [
    {"from": "path/to/file1.ts", "to": "path/to/file2.ts", "type": "imports"},
    {"from": "path/to/file1.ts", "to": "path/to/file2.ts:functionName", "type": "calls"}
  ]
}

Rules:
- Each file is a node with type "file"
- Functions/classes are child nodes with type "function"
- "imports" edges show file imports
- "calls" edges show function calls
- Use relative paths as IDs
- Return ONLY the JSON, no explanation

Files to analyze:
${fileList}`;

    try {
      // Use extended timeout for dependency analysis (5 minutes)
      const response = await this.bobService.askBob({
        system: 'You are a code analysis expert. Return only valid JSON.',
        messages: [{ role: 'user', content: prompt }]
      }, 300000); // 5 minutes timeout

      const text = response.content[0]?.text || '{}';
      
      console.log('Bob response length:', text.length);
      console.log('Bob response preview:', text.substring(0, 500));
      
      // Try multiple JSON extraction strategies
      let jsonText = '';
      
      // Strategy 1: Look for JSON code blocks
      const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
        console.log('Found JSON in code block');
      } else {
        // Strategy 2: Look for raw JSON (greedy match to get the largest JSON object)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
          console.log('Found raw JSON');
        } else {
          console.error('Full Bob response:', text);
          throw new Error('No JSON found in Bob response. Bob may have returned plain text instead of JSON.');
        }
      }

      let graph: DependencyGraph;
      try {
        graph = JSON.parse(jsonText);
      } catch (parseError: any) {
        console.error('JSON parse error:', parseError.message);
        console.error('Attempted to parse:', jsonText.substring(0, 500));
        throw new Error(`Failed to parse JSON from Bob: ${parseError.message}`);
      }
      
      // Validate structure
      if (!graph.nodes || !graph.edges) {
        console.error('Invalid graph structure:', graph);
        throw new Error('Invalid graph structure from Bob - missing nodes or edges');
      }

      console.log(`Successfully parsed graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
      return graph;
    } catch (error) {
      console.error('Bob analysis failed, falling back to regex:', error);
      return this.buildDependencyGraphWithRegex();
    }
  }

  private async buildDependencyGraphWithRegex(): Promise<DependencyGraph> {
    const files = await this.getAllSupportedFiles();
    const limitedFiles = files.slice(0, 200);
    
    return this.graphBuilder.buildGraph(limitedFiles);
  }

  private async getAllSupportedFiles(): Promise<string[]> {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs'];
    const files: string[] = [];

    const pattern = `**/*{${extensions.join(',')}}`;
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

    for (const uri of uris) {
      files.push(uri.fsPath);
    }

    return files;
  }

}

// Made with Bob
