import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BobService } from './bobService';
import { GraphBuilder } from './dependency/graphBuilder';
import { BobAnalysisService } from './dependency/bobAnalysisService';
import { GraphCombinerService } from './dependency/graphCombinerService';
import { DependencyNode, DependencyEdge } from './types';

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export class DependencyService {
  private workspaceRoot: string;
  private bobService: BobService;
  private graphBuilder: GraphBuilder;
  private bobAnalysisService: BobAnalysisService;
  private graphCombinerService: GraphCombinerService;
  private cacheFilePath: string;

  constructor() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    this.workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
    this.bobService = new BobService();
    this.graphBuilder = new GraphBuilder(this.workspaceRoot);
    this.bobAnalysisService = new BobAnalysisService(this.workspaceRoot);
    this.graphCombinerService = new GraphCombinerService(this.workspaceRoot);
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

    console.log('Building dependency graph with phased Bob analysis...');
    const graph = await this.buildDependencyGraphPhased(forceRefresh);
    await this.saveCachedGraph(graph);
    return graph;
  }

  /**
   * New phased approach: Extract functions, imports, and usage separately
   */
  private async buildDependencyGraphPhased(forceRefresh: boolean = false): Promise<DependencyGraph> {
    try {
      // Get all supported files
      const files = await this.getAllSupportedFiles();
      const limitedFiles = files.slice(0, 100); // Limit for performance

      console.log(`Phase 1: Extracting function definitions from ${limitedFiles.length} files...`);
      const functions = await this.bobAnalysisService.extractFunctionDefinitions(limitedFiles, forceRefresh);
      console.log(`Found ${functions.length} functions`);

      console.log(`Phase 2: Extracting file imports...`);
      const fileImports = await this.bobAnalysisService.extractFileImports(limitedFiles, forceRefresh);
      console.log(`Found ${fileImports.length} file import relationships`);

      console.log(`Phase 3: Extracting function usage...`);
      const functionUsage = await this.bobAnalysisService.extractFunctionUsage(functions, limitedFiles, forceRefresh);
      console.log(`Found ${functionUsage.length} function usage patterns`);

      console.log(`Phase 4: Combining into final graph...`);
      const finalGraph = await this.graphCombinerService.buildFinalGraph(functions, fileImports, functionUsage);
      console.log(`Final graph: ${finalGraph.nodes.length} nodes, ${finalGraph.edges.length} edges`);

      return finalGraph;
    } catch (error) {
      console.error('Phased analysis failed, falling back to regex:', error);
      return this.buildDependencyGraphWithRegex();
    }
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

    // Build a simpler, more focused prompt for Bob
    const fileList = fileContents.map(f => {
      const lines = f.content.split('\n').slice(0, 30); // First 30 lines only
      return `${f.path}:\n${lines.join('\n')}`;
    }).join('\n\n---\n\n');
    
    const prompt = `Create a dependency graph JSON for these ${fileContents.length} files (including HTML, CSS, and code files).

Required JSON format:
{
  "nodes": [
    {
      "id": "file.ts",
      "name": "file.ts",
      "type": "file",
      "filePath": "file.ts",
      "children": [
        {"id": "file.ts:functionName", "name": "functionName", "type": "function", "filePath": "file.ts", "line": 10}
      ]
    }
  ],
  "edges": [
    {"from": "file1.ts", "to": "file2.ts", "type": "imports"},
    {"from": "file.ts:funcA", "to": "file.ts:funcB", "type": "calls"}
  ]
}

Rules:
1. Create one node per file with type "file"
2. For code files (JS/TS/Python/etc), extract functions/classes and add them as children with type "function"
3. For HTML files, extract CSS (<link>) and JS (<script src>) imports
4. For CSS files, extract @import statements
5. Add "imports" edges between files that import each other
6. Add "calls" edges between functions that call each other (format: "file:function")
7. Function IDs should be "filePath:functionName"
8. Return ONLY the JSON object, nothing else

Files:
${fileList}`;

    try {
      // Use extended timeout for dependency analysis (5 minutes)
      const response = await this.bobService.askBob({
        system: 'You are a code analysis expert. Return only valid JSON.',
        messages: [{ role: 'user', content: prompt }]
      }, 300000); // 5 minutes timeout

      const text = response.content[0]?.text || '{}';
      
      console.log('Bob response length:', text.length);
      console.log('Bob response preview:', text.substring(0, 200));
      
      // Handle empty or very short responses
      if (text.length < 10) {
        console.error('Bob returned empty or very short response:', text);
        throw new Error('Bob returned empty response. The prompt may be too complex or Bob may be unavailable.');
      }
      
      // Try multiple JSON extraction strategies
      let jsonText = '';
      
      // Strategy 1: Look for JSON code blocks (with proper closing)
      const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonText = codeBlockMatch[1];
        console.log('Found JSON in code block');
      } else {
        // Strategy 2: Look for raw JSON (greedy match to get the largest JSON object)
        const jsonMatch = text.match(/(\{[\s\S]*\})/);
        if (jsonMatch && jsonMatch[1]) {
          jsonText = jsonMatch[1];
          console.log('Found raw JSON');
        } else {
          console.error('Full Bob response:', text);
          throw new Error('No JSON found in Bob response. Bob may have returned incomplete or plain text.');
        }
      }
      
      // Validate we actually got JSON content
      if (!jsonText || jsonText.length < 10) {
        console.error('Extracted JSON is too short:', jsonText);
        throw new Error('Extracted JSON is empty or incomplete');
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
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.html', '.htm', '.css'];
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
