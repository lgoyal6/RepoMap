import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BobService } from '../bobService';

// Phase 1: Function definitions
export interface FunctionDefinition {
  name: string;
  filePath: string;
  line: number;
  language: string;
  exported: boolean;
}

// Phase 2: File imports
export interface FileImport {
  sourceFile: string;
  importedFiles: string[];
}

// Phase 3: Function usage
export interface FunctionUsage {
  functionName: string;
  definedIn: string;
  usedInFiles: Array<{
    filePath: string;
    calledBy: string[]; // Function names that call this function
  }>;
}

export class BobAnalysisService {
  private bobService: BobService;
  private workspaceRoot: string;
  private cacheDir: string;

  constructor(workspaceRoot: string) {
    this.bobService = new BobService();
    this.workspaceRoot = workspaceRoot;
    this.cacheDir = path.join(workspaceRoot, '.bob', 'analysis');
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private async saveToCache(filename: string, data: any): Promise<void> {
    const filePath = path.join(this.cacheDir, filename);
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Saved ${filename} to cache`);
  }

  private async loadFromCache(filename: string): Promise<any | null> {
    const filePath = path.join(this.cacheDir, filename);
    if (fs.existsSync(filePath)) {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    }
    return null;
  }

  /**
   * Phase 1: Extract all function definitions from the project
   */
  async extractFunctionDefinitions(files: string[], forceRefresh: boolean = false): Promise<FunctionDefinition[]> {
    const cacheFile = 'functions.json';
    
    if (!forceRefresh) {
      const cached = await this.loadFromCache(cacheFile);
      if (cached) {
        console.log('Loaded function definitions from cache');
        return cached;
      }
    }

    console.log(`Analyzing ${files.length} files for function definitions...`);
    const functions: FunctionDefinition[] = [];

    // Process files in batches to avoid overwhelming Bob
    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchFunctions = await this.extractFunctionsFromBatch(batch);
      functions.push(...batchFunctions);
      
      console.log(`Processed ${Math.min(i + batchSize, files.length)}/${files.length} files`);
    }

    await this.saveToCache(cacheFile, functions);
    return functions;
  }

  private async extractFunctionsFromBatch(files: string[]): Promise<FunctionDefinition[]> {
    const fileContents = await Promise.all(
      files.map(async (filePath) => {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
          const ext = path.extname(filePath);
          return { path: relativePath, content, ext };
        } catch (error) {
          console.error(`Error reading ${filePath}:`, error);
          return null;
        }
      })
    );

    const validFiles = fileContents.filter(f => f !== null);
    if (validFiles.length === 0) return [];

    const fileList = validFiles.map(f => 
      `File: ${f!.path}\n${f!.content.split('\n').slice(0, 100).join('\n')}`
    ).join('\n\n---\n\n');

    const prompt = `Extract ALL function/method/class definitions from these code files.

CRITICAL RULES:
1. Return ONLY a valid JSON array - no markdown, no explanations, no code blocks
2. Every object MUST have exactly these 5 fields with correct types:
   - "name": string (function/method/class name)
   - "filePath": string (exact file path from the File: line)
   - "line": number (line number as integer, estimate if needed)
   - "language": string (one of: "javascript", "typescript", "python", "go", "java", "rust")
   - "exported": boolean (true or false, no quotes)
3. Use double quotes for all strings
4. No trailing commas
5. If no functions found, return empty array: []

EXAMPLE OUTPUT FORMAT:
[
  {"name": "init", "filePath": "src/main.js", "line": 1, "language": "javascript", "exported": false},
  {"name": "App", "filePath": "src/App.tsx", "line": 5, "language": "typescript", "exported": true}
]

Files to analyze:
${fileList}

OUTPUT (JSON array only):`;

    try {
      const response = await this.bobService.askBob({
        system: 'You are a JSON-only code analyzer. Output ONLY valid JSON arrays with no markdown, no explanations, no code blocks.',
        messages: [{ role: 'user', content: prompt }]
      }, 120000); // 2 minute timeout

      const text = response.content[0]?.text || '[]';
      
      // Try to extract JSON array
      let jsonText = text.trim();
      
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Find the JSON array
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('No JSON array found in response');
        return [];
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!Array.isArray(parsed)) {
        console.warn('Response is not an array');
        return [];
      }
      
      // Validate each object has required fields
      const validated = parsed.filter(item => {
        if (typeof item !== 'object' || !item) return false;
        if (typeof item.name !== 'string') return false;
        if (typeof item.filePath !== 'string') return false;
        if (typeof item.line !== 'number') return false;
        if (typeof item.language !== 'string') return false;
        if (typeof item.exported !== 'boolean') return false;
        return true;
      });
      
      if (validated.length !== parsed.length) {
        console.warn(`Filtered out ${parsed.length - validated.length} invalid function definitions`);
      }
      
      return validated;
    } catch (error) {
      console.error('Error extracting functions from batch:', error);
      return [];
    }
  }

  /**
   * Phase 2: Extract file import relationships
   */
  async extractFileImports(files: string[], forceRefresh: boolean = false): Promise<FileImport[]> {
    const cacheFile = 'file-imports.json';
    
    if (!forceRefresh) {
      const cached = await this.loadFromCache(cacheFile);
      if (cached) {
        console.log('Loaded file imports from cache');
        return cached;
      }
    }

    console.log(`Analyzing ${files.length} files for imports...`);
    const imports: FileImport[] = [];

    const batchSize = 10;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const batchImports = await this.extractImportsFromBatch(batch);
      imports.push(...batchImports);
      
      console.log(`Processed ${Math.min(i + batchSize, files.length)}/${files.length} files`);
    }

    await this.saveToCache(cacheFile, imports);
    return imports;
  }

  private async extractImportsFromBatch(files: string[]): Promise<FileImport[]> {
    const fileContents = await Promise.all(
      files.map(async (filePath) => {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
          return { path: relativePath, content };
        } catch (error) {
          return null;
        }
      })
    );

    const validFiles = fileContents.filter(f => f !== null);
    if (validFiles.length === 0) return [];

    const fileList = validFiles.map(f => 
      `File: ${f!.path}\n${f!.content.split('\n').slice(0, 50).join('\n')}`
    ).join('\n\n---\n\n');

    const prompt = `Extract ALL import statements from these files.

CRITICAL RULES:
1. Return ONLY a valid JSON array - no markdown, no explanations, no code blocks
2. Every object MUST have exactly these 2 fields:
   - "sourceFile": string (exact file path from the File: line)
   - "importedFiles": array of strings (all imported file paths)
3. Use double quotes for all strings
4. No trailing commas
5. If a file has no imports, include it with empty array: {"sourceFile": "file.js", "importedFiles": []}
6. If no files found, return empty array: []

IMPORT TYPES TO DETECT:
- JavaScript/TypeScript: import, require()
- HTML: <script src="...">, <link href="...">
- CSS: @import
- Python: import, from...import
- Go/Java: import statements

EXAMPLE OUTPUT FORMAT:
[
  {"sourceFile": "index.html", "importedFiles": ["./styles.css", "./main.js"]},
  {"sourceFile": "main.js", "importedFiles": ["./utils.js"]},
  {"sourceFile": "utils.js", "importedFiles": []}
]

Files to analyze:
${fileList}

OUTPUT (JSON array only):`;

    try {
      const response = await this.bobService.askBob({
        system: 'You are a JSON-only code analyzer. Output ONLY valid JSON arrays with no markdown, no explanations, no code blocks.',
        messages: [{ role: 'user', content: prompt }]
      }, 120000);

      const text = response.content[0]?.text || '[]';
      
      // Clean up response
      let jsonText = text.trim();
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('No JSON array found in response');
        return [];
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed)) {
        console.warn('Response is not an array');
        return [];
      }
      
      // Validate structure
      const validated = parsed.filter(item => {
        if (typeof item !== 'object' || !item) return false;
        if (typeof item.sourceFile !== 'string') return false;
        if (!Array.isArray(item.importedFiles)) return false;
        if (!item.importedFiles.every((f: any) => typeof f === 'string')) return false;
        return true;
      });
      
      if (validated.length !== parsed.length) {
        console.warn(`Filtered out ${parsed.length - validated.length} invalid file imports`);
      }
      
      return validated;
    } catch (error) {
      console.error('Error extracting imports from batch:', error);
      return [];
    }
  }

  /**
   * Phase 3: Find where each function is used
   */
  async extractFunctionUsage(
    functions: FunctionDefinition[],
    files: string[],
    forceRefresh: boolean = false
  ): Promise<FunctionUsage[]> {
    const cacheFile = 'function-usage.json';
    
    if (!forceRefresh) {
      const cached = await this.loadFromCache(cacheFile);
      if (cached) {
        console.log('Loaded function usage from cache');
        return cached;
      }
    }

    console.log(`Analyzing usage of ${functions.length} functions across ${files.length} files...`);
    const usage: FunctionUsage[] = [];

    // Process functions in batches
    const batchSize = 20;
    for (let i = 0; i < functions.length; i += batchSize) {
      const batch = functions.slice(i, i + batchSize);
      const batchUsage = await this.extractUsageForFunctionBatch(batch, files);
      usage.push(...batchUsage);
      
      console.log(`Processed ${Math.min(i + batchSize, functions.length)}/${functions.length} functions`);
    }

    await this.saveToCache(cacheFile, usage);
    return usage;
  }

  private async extractUsageForFunctionBatch(
    functions: FunctionDefinition[],
    files: string[]
  ): Promise<FunctionUsage[]> {
    // Read all files
    const fileContents = await Promise.all(
      files.map(async (filePath) => {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
          return { path: relativePath, content };
        } catch (error) {
          return null;
        }
      })
    );

    const validFiles = fileContents.filter(f => f !== null);
    const functionNames = functions.map(f => f.name).join(', ');
    
    const fileList = validFiles.slice(0, 30).map(f => 
      `File: ${f!.path}\n${f!.content.split('\n').slice(0, 50).join('\n')}`
    ).join('\n\n---\n\n');

    const prompt = `Find where these functions are called: ${functionNames}

CRITICAL RULES:
1. Return ONLY a valid JSON array - no markdown, no explanations, no code blocks
2. Every object MUST have exactly these 3 fields:
   - "functionName": string (name of the function being called)
   - "definedIn": string (file where function is defined)
   - "usedInFiles": array of objects, each with:
     * "filePath": string (file where function is used)
     * "calledBy": array of strings (function names that call it)
3. Use double quotes for all strings
4. No trailing commas
5. If function not used anywhere, include empty usedInFiles: []
6. If no functions found, return empty array: []

EXAMPLE OUTPUT FORMAT:
[
  {"functionName": "init", "definedIn": "main.js", "usedInFiles": [{"filePath": "app.js", "calledBy": ["start", "bootstrap"]}]},
  {"functionName": "helper", "definedIn": "utils.js", "usedInFiles": []}
]

Files to search:
${fileList}

OUTPUT (JSON array only):`;

    try {
      const response = await this.bobService.askBob({
        system: 'You are a JSON-only code analyzer. Output ONLY valid JSON arrays with no markdown, no explanations, no code blocks.',
        messages: [{ role: 'user', content: prompt }]
      }, 120000);

      const text = response.content[0]?.text || '[]';
      
      // Clean up response
      let jsonText = text.trim();
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('No JSON array found in response');
        return [];
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed)) {
        console.warn('Response is not an array');
        return [];
      }
      
      // Validate structure
      const validated = parsed.filter(item => {
        if (typeof item !== 'object' || !item) return false;
        if (typeof item.functionName !== 'string') return false;
        if (typeof item.definedIn !== 'string') return false;
        if (!Array.isArray(item.usedInFiles)) return false;
        
        // Validate each usedInFiles entry
        const validUsage = item.usedInFiles.every((usage: any) => {
          if (typeof usage !== 'object' || !usage) return false;
          if (typeof usage.filePath !== 'string') return false;
          if (!Array.isArray(usage.calledBy)) return false;
          if (!usage.calledBy.every((f: any) => typeof f === 'string')) return false;
          return true;
        });
        
        return validUsage;
      });
      
      if (validated.length !== parsed.length) {
        console.warn(`Filtered out ${parsed.length - validated.length} invalid function usage entries`);
      }
      
      return validated;
    } catch (error) {
      console.error('Error extracting function usage:', error);
      return [];
    }
  }
}

// Made with Bob