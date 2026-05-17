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
  private selectedFoldersCache: string;

  constructor() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    this.workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
    this.bobService = new BobService();
    this.graphBuilder = new GraphBuilder(this.workspaceRoot);
    this.bobAnalysisService = new BobAnalysisService(this.workspaceRoot);
    this.graphCombinerService = new GraphCombinerService(this.workspaceRoot);
    this.cacheFilePath = path.join(this.workspaceRoot, '.bob', 'dependency-graph.json');
    this.selectedFoldersCache = path.join(this.workspaceRoot, '.bob', 'selected-folders.json');
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

  async loadSelectedFolders(): Promise<string[] | null> {
    try {
      if (fs.existsSync(this.selectedFoldersCache)) {
        const data = await fs.promises.readFile(this.selectedFoldersCache, 'utf-8');
        const parsed = JSON.parse(data);
        return parsed.selectedFolders || null;
      }
    } catch (error) {
      console.error('Failed to load selected folders cache:', error);
    }
    return null;
  }

  async saveSelectedFolders(folders: string[]): Promise<void> {
    try {
      const dir = path.dirname(this.selectedFoldersCache);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      const data = {
        selectedFolders: folders,
        timestamp: new Date().toISOString()
      };
      await fs.promises.writeFile(this.selectedFoldersCache, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`Saved selected folders to cache: ${folders.join(', ')}`);
    } catch (error) {
      console.error('Failed to save selected folders cache:', error);
    }
  }

  async promptForFolderSelection(): Promise<string[] | null> {
    try {
      // Get all directories in workspace
      const allDirs = await this.getAllDirectories();
      
      if (allDirs.length === 0) {
        vscode.window.showInformationMessage('No folders found in workspace. Analyzing all files.');
        return null;
      }

      // Create quick pick items
      const items: vscode.QuickPickItem[] = allDirs.map(dir => ({
        label: dir,
        picked: false
      }));

      // Add "Select All" option at the top
      items.unshift({
        label: '$(folder) Select All Folders',
        picked: false
      });

      const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select folders to analyze (or Select All)',
        title: 'Dependency Analysis - Folder Selection'
      });

      if (!selected || selected.length === 0) {
        // User cancelled or selected nothing - analyze all
        vscode.window.showInformationMessage('No folders selected. Analyzing all files.');
        return null;
      }

      // Check if "Select All" was chosen
      const selectAllChosen = selected.some(item => item.label.includes('Select All'));
      if (selectAllChosen) {
        console.log('User selected all folders');
        return null; // null means analyze all
      }

      const selectedFolders = selected.map(item => item.label);
      console.log(`User selected folders: ${selectedFolders.join(', ')}`);
      return selectedFolders;
    } catch (error) {
      console.error('Error in folder selection:', error);
      return null;
    }
  }

  private async getAllDirectories(): Promise<string[]> {
    const dirs = new Set<string>();
    const pattern = '**/*';
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

    for (const uri of uris) {
      const relativePath = path.relative(this.workspaceRoot, uri.fsPath);
      const dirPath = path.dirname(relativePath);
      
      if (dirPath && dirPath !== '.') {
        // Add all parent directories
        const parts = dirPath.split(path.sep);
        for (let i = 1; i <= parts.length; i++) {
          const dir = parts.slice(0, i).join('/');
          dirs.add(dir);
        }
      }
    }

    return Array.from(dirs).sort();
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

    // Check if we have selected folders cached
    let selectedFolders = await this.loadSelectedFolders();
    
    // If no cached selection or force refresh, prompt user
    if (!selectedFolders || forceRefresh) {
      selectedFolders = await this.promptForFolderSelection();
      if (selectedFolders && selectedFolders.length > 0) {
        await this.saveSelectedFolders(selectedFolders);
      }
    }

    console.log(`Building dependency graph for folders: ${selectedFolders?.join(', ') || 'ALL'}`);
    const graph = await this.buildDependencyGraphPhased(forceRefresh, selectedFolders);
    await this.saveCachedGraph(graph);
    return graph;
  }

  /**
   * New phased approach: Extract functions, imports, and usage separately
   */
  private async buildDependencyGraphPhased(forceRefresh: boolean = false, selectedFolders?: string[] | null): Promise<DependencyGraph> {
    console.log('[DependencyService] ========================================');
    console.log('[DependencyService] Starting phased dependency graph build...');
    console.log(`[DependencyService] Force refresh: ${forceRefresh}`);
    console.log(`[DependencyService] Selected folders: ${selectedFolders?.join(', ') || 'ALL'}`);
    
    try {
      // Get all supported files
      console.log('[DependencyService] Step 0: Gathering files...');
      const files = await this.getAllSupportedFiles(selectedFolders);
      console.log(`[DependencyService] ✓ Found ${files.length} supported files`);
      
      const limitedFiles = files.slice(0, 100); // Limit for performance
      console.log(`[DependencyService] ✓ Limited to ${limitedFiles.length} files for analysis`);

      console.log('[DependencyService] ========================================');
      console.log(`[DependencyService] Phase 1: Extracting function definitions from ${limitedFiles.length} files...`);
      const functions = await this.bobAnalysisService.extractFunctionDefinitions(limitedFiles, forceRefresh);
      console.log(`[DependencyService] ✓ Phase 1 complete: Found ${functions.length} functions`);

      console.log('[DependencyService] ========================================');
      console.log(`[DependencyService] Phase 2: Extracting file imports...`);
      const fileImports = await this.bobAnalysisService.extractFileImports(limitedFiles, forceRefresh);
      console.log(`[DependencyService] ✓ Phase 2 complete: Found ${fileImports.length} file import relationships`);

      console.log('[DependencyService] ========================================');
      console.log(`[DependencyService] Phase 3: Extracting function usage...`);
      const functionUsage = await this.bobAnalysisService.extractFunctionUsage(functions, limitedFiles, forceRefresh);
      console.log(`[DependencyService] ✓ Phase 3 complete: Found ${functionUsage.length} function usage patterns`);

      console.log('[DependencyService] ========================================');
      console.log(`[DependencyService] Phase 4: Combining into final graph...`);
      const finalGraph = await this.graphCombinerService.buildFinalGraph(functions, fileImports, functionUsage);
      console.log(`[DependencyService] ✓ Phase 4 complete: ${finalGraph.nodes.length} nodes, ${finalGraph.edges.length} edges`);
      console.log('[DependencyService] ========================================');

      return finalGraph;
    } catch (error) {
      console.error('[DependencyService] ❌ Phased analysis failed:', error);
      console.error('[DependencyService] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.log('[DependencyService] Falling back to regex-based analysis...');
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

  private async getAllSupportedFiles(selectedFolders?: string[] | null): Promise<string[]> {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.html', '.htm', '.css'];
    const files: string[] = [];

    if (selectedFolders && selectedFolders.length > 0) {
      // Build patterns for selected folders
      for (const folder of selectedFolders) {
        const pattern = `${folder}/**/*{${extensions.join(',')}}`;
        const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
        for (const uri of uris) {
          files.push(uri.fsPath);
        }
      }
    } else {
      // Original behavior - scan all files
      const pattern = `**/*{${extensions.join(',')}}`;
      const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
      for (const uri of uris) {
        files.push(uri.fsPath);
      }
    }

    return files;
  }

}

// Made with Bob
