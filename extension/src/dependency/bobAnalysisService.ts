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
    
    // Process all files at once
    const functions = await this.extractFunctionsFromBatch(files);
    console.log(`Processed all ${files.length} files`);

    await this.saveToCache(cacheFile, functions);
    return functions;
  }

  private async extractFunctionsFromBatch(files: string[]): Promise<FunctionDefinition[]> {
    console.log(`[BobAnalysis] Processing batch of ${files.length} files for function extraction`);
    
    const fileContents = await Promise.all(
      files.map(async (filePath) => {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
          const ext = path.extname(filePath);
          return { path: relativePath, content, ext };
        } catch (error) {
          console.error(`[BobAnalysis] Error reading ${filePath}:`, error);
          return null;
        }
      })
    );

    const validFiles = fileContents.filter(f => f !== null);
    console.log(`[BobAnalysis] Successfully read ${validFiles.length} files`);
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
      console.log(`[BobAnalysis] Sending request to Bob...`);
      const response = await this.bobService.askBob({
        system: 'You are a JSON-only code analyzer. Output ONLY valid JSON arrays with no markdown, no explanations, no code blocks.',
        messages: [{ role: 'user', content: prompt }]
      }, 600000); // 10 minute timeout for all files

      const text = response.content[0]?.text || '[]';
      console.log(`[BobAnalysis] Raw Bob response length: ${text.length} characters`);
      console.log(`[BobAnalysis] Raw Bob response (first 500 chars):\n${text.substring(0, 500)}`);
      console.log(`[BobAnalysis] Raw Bob response (last 500 chars):\n${text.substring(Math.max(0, text.length - 500))}`);
      
      // Try to extract JSON from ---output--- tags or clean response
      let jsonText = text.trim();
      console.log(`[BobAnalysis] After trim, length: ${jsonText.length}`);
      
      // Check for ---output--- tags first
      const outputMatch = jsonText.match(/---output---\s*([\s\S]*?)\s*(?:---output---|$)/i);
      if (outputMatch) {
        jsonText = outputMatch[1].trim();
        console.log(`[BobAnalysis] ✓ Extracted content from ---output--- tags, length: ${jsonText.length}`);
      }
      
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      console.log(`[BobAnalysis] After removing markdown blocks, length: ${jsonText.length}`);
      console.log(`[BobAnalysis] Cleaned text (first 300 chars):\n${jsonText.substring(0, 300)}`);
      
      // Find the JSON array - use more robust regex
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error(`[BobAnalysis] ❌ No JSON array found in response`);
        console.error(`[BobAnalysis] Full cleaned text:\n${jsonText}`);
        return [];
      }
      
      console.log(`[BobAnalysis] ✓ Found JSON array, length: ${jsonMatch[0].length}`);
      console.log(`[BobAnalysis] JSON to parse (first 500 chars):\n${jsonMatch[0].substring(0, 500)}`);
      
      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
        console.log(`[BobAnalysis] ✓ Successfully parsed JSON`);
        console.log(`[BobAnalysis] Parsed data type: ${Array.isArray(parsed) ? 'Array' : typeof parsed}`);
        console.log(`[BobAnalysis] Array length: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
      } catch (parseError: any) {
        console.error(`[BobAnalysis] ❌ JSON parse error: ${parseError.message}`);
        console.error(`[BobAnalysis] JSON that failed to parse:\n${jsonMatch[0]}`);
        const errorPosMatch = parseError.message.match(/position (\d+)/);
        const errorPos = errorPosMatch ? parseInt(errorPosMatch[1], 10) : -1;
        console.error(`[BobAnalysis] Error at position: ${errorPos !== -1 ? errorPos : 'unknown'}`);
        
        if (errorPos !== -1) {
          const start = Math.max(0, errorPos - 50);
          const end = Math.min(jsonMatch[0].length, errorPos + 50);
          const context = jsonMatch[0].substring(start, end);
          const pointer = ' '.repeat(Math.min(50, errorPos - start)) + '^';
          console.error(`[BobAnalysis] Context around error:\n${context}\n${pointer}`);
        }
        
        throw parseError;
      }
      
      // Validate structure
      if (!Array.isArray(parsed)) {
        console.warn(`[BobAnalysis] ⚠️ Response is not an array, type: ${typeof parsed}`);
        return [];
      }
      
      console.log(`[BobAnalysis] Validating ${parsed.length} function definitions...`);
      
      // Validate each object has required fields
      const validated = parsed.filter((item, index) => {
        const isValid =
          typeof item === 'object' && item &&
          typeof item.name === 'string' &&
          typeof item.filePath === 'string' &&
          typeof item.line === 'number' &&
          typeof item.language === 'string' &&
          typeof item.exported === 'boolean';
        
        if (!isValid) {
          console.warn(`[BobAnalysis] ⚠️ Invalid item at index ${index}:`, JSON.stringify(item));
        }
        
        return isValid;
      });
      
      console.log(`[BobAnalysis] ✓ Validated ${validated.length}/${parsed.length} function definitions`);
      if (validated.length !== parsed.length) {
        console.warn(`[BobAnalysis] ⚠️ Filtered out ${parsed.length - validated.length} invalid items`);
      }
      
      return validated;
    } catch (error) {
      console.error('[BobAnalysis] ❌ Error extracting functions from batch:', error);
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
    
    // Process all files at once
    const imports = await this.extractImportsFromBatch(files);
    console.log(`Processed all ${files.length} files`);

    await this.saveToCache(cacheFile, imports);
    return imports;
  }

  private async extractImportsFromBatch(files: string[]): Promise<FileImport[]> {
    console.log(`[BobAnalysis-Imports] Processing batch of ${files.length} files for import extraction`);
    
    const fileContents = await Promise.all(
      files.map(async (filePath) => {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
          return { path: relativePath, content };
        } catch (error) {
          console.error(`[BobAnalysis-Imports] Error reading ${filePath}:`, error);
          return null;
        }
      })
    );

    const validFiles = fileContents.filter(f => f !== null);
    console.log(`[BobAnalysis-Imports] Successfully read ${validFiles.length} files`);
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
      console.log(`[BobAnalysis-Imports] Sending request to Bob...`);
      const response = await this.bobService.askBob({
        system: 'You are a JSON-only code analyzer. Output ONLY valid JSON arrays with no markdown, no explanations, no code blocks.',
        messages: [{ role: 'user', content: prompt }]
      }, 120000); // 2 minute timeout for all files

      const text = response.content[0]?.text || '[]';
      console.log(`[BobAnalysis-Imports] Raw Bob response length: ${text.length} characters`);
      console.log(`[BobAnalysis-Imports] Raw Bob response (first 500 chars):\n${text.substring(0, 500)}`);
      console.log(`[BobAnalysis-Imports] Raw Bob response (last 500 chars):\n${text.substring(Math.max(0, text.length - 500))}`);
      
      // Try to extract JSON from ---output--- tags or clean response
      let jsonText = text.trim();
      console.log(`[BobAnalysis-Imports] After trim, length: ${jsonText.length}`);
      
      // Check for ---output--- tags first
      const outputMatch = jsonText.match(/---output---\s*([\s\S]*?)\s*(?:---output---|$)/i);
      if (outputMatch) {
        jsonText = outputMatch[1].trim();
        console.log(`[BobAnalysis-Imports] ✓ Extracted content from ---output--- tags, length: ${jsonText.length}`);
      }
      
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      console.log(`[BobAnalysis-Imports] After removing markdown blocks, length: ${jsonText.length}`);
      console.log(`[BobAnalysis-Imports] Cleaned text (first 300 chars):\n${jsonText.substring(0, 300)}`);
      
      // Find the JSON array
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error(`[BobAnalysis-Imports] ❌ No JSON array found in response`);
        console.error(`[BobAnalysis-Imports] Full cleaned text:\n${jsonText}`);
        return [];
      }
      
      console.log(`[BobAnalysis-Imports] ✓ Found JSON array, length: ${jsonMatch[0].length}`);
      console.log(`[BobAnalysis-Imports] JSON to parse (first 500 chars):\n${jsonMatch[0].substring(0, 500)}`);
      
      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
        console.log(`[BobAnalysis-Imports] ✓ Successfully parsed JSON`);
        console.log(`[BobAnalysis-Imports] Parsed data type: ${Array.isArray(parsed) ? 'Array' : typeof parsed}`);
        console.log(`[BobAnalysis-Imports] Array length: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
      } catch (parseError: any) {
        console.error(`[BobAnalysis-Imports] ❌ JSON parse error: ${parseError.message}`);
        console.error(`[BobAnalysis-Imports] Error at position: ${parseError.message.match(/position (\d+)/)?.[1] || 'unknown'}`);
        console.error(`[BobAnalysis-Imports] JSON that failed to parse:\n${jsonMatch[0]}`);
        throw parseError;
      }
      
      if (!Array.isArray(parsed)) {
        console.warn(`[BobAnalysis-Imports] ⚠️ Response is not an array, type: ${typeof parsed}`);
        return [];
      }
      
      console.log(`[BobAnalysis-Imports] Validating ${parsed.length} file import entries...`);
      
      // Validate structure
      const validated = parsed.filter((item, index) => {
        const isValid =
          typeof item === 'object' && item &&
          typeof item.sourceFile === 'string' &&
          Array.isArray(item.importedFiles) &&
          item.importedFiles.every((f: any) => typeof f === 'string');
        
        if (!isValid) {
          console.warn(`[BobAnalysis-Imports] ⚠️ Invalid item at index ${index}:`, JSON.stringify(item));
        }
        
        return isValid;
      });
      
      console.log(`[BobAnalysis-Imports] ✓ Validated ${validated.length}/${parsed.length} file import entries`);
      if (validated.length !== parsed.length) {
        console.warn(`[BobAnalysis-Imports] ⚠️ Filtered out ${parsed.length - validated.length} invalid items`);
      }
      
      return validated;
    } catch (error) {
      console.error('[BobAnalysis-Imports] ❌ Error extracting imports from batch:', error);
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
    console.log(`[BobAnalysis-Usage] Processing batch of ${functions.length} functions across ${files.length} files`);
    
    // Read all files
    const fileContents = await Promise.all(
      files.map(async (filePath) => {
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
          return { path: relativePath, content };
        } catch (error) {
          console.error(`[BobAnalysis-Usage] Error reading ${filePath}:`, error);
          return null;
        }
      })
    );

    const validFiles = fileContents.filter(f => f !== null);
    console.log(`[BobAnalysis-Usage] Successfully read ${validFiles.length} files`);
    const functionNames = functions.map(f => f.name).join(', ');
    console.log(`[BobAnalysis-Usage] Looking for usage of functions: ${functionNames.substring(0, 200)}${functionNames.length > 200 ? '...' : ''}`);
    
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
      console.log(`[BobAnalysis-Usage] Sending request to Bob...`);
      const response = await this.bobService.askBob({
        system: 'You are a JSON-only code analyzer. Output ONLY valid JSON arrays with no markdown, no explanations, no code blocks.',
        messages: [{ role: 'user', content: prompt }]
      }, 600000); // 10 minute timeout for all files

      const text = response.content[0]?.text || '[]';
      console.log(`[BobAnalysis-Usage] Raw Bob response length: ${text.length} characters`);
      console.log(`[BobAnalysis-Usage] Raw Bob response (first 500 chars):\n${text.substring(0, 500)}`);
      console.log(`[BobAnalysis-Usage] Raw Bob response (last 500 chars):\n${text.substring(Math.max(0, text.length - 500))}`);
      
      // Try to extract JSON from ---output--- tags or clean response
      let jsonText = text.trim();
      console.log(`[BobAnalysis-Usage] After trim, length: ${jsonText.length}`);
      
      // Check for ---output--- tags first
      const outputMatch = jsonText.match(/---output---\s*([\s\S]*?)\s*(?:---output---|$)/i);
      if (outputMatch) {
        jsonText = outputMatch[1].trim();
        console.log(`[BobAnalysis-Usage] ✓ Extracted content from ---output--- tags, length: ${jsonText.length}`);
      }
      
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      console.log(`[BobAnalysis-Usage] After removing markdown blocks, length: ${jsonText.length}`);
      console.log(`[BobAnalysis-Usage] Cleaned text (first 300 chars):\n${jsonText.substring(0, 300)}`);
      
      // Find the JSON array
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error(`[BobAnalysis-Usage] ❌ No JSON array found in response`);
        console.error(`[BobAnalysis-Usage] Full cleaned text:\n${jsonText}`);
        return [];
      }
      
      console.log(`[BobAnalysis-Usage] ✓ Found JSON array, length: ${jsonMatch[0].length}`);
      console.log(`[BobAnalysis-Usage] JSON to parse (first 500 chars):\n${jsonMatch[0].substring(0, 500)}`);
      
      let parsed;
      try {
        parsed = JSON.parse(jsonMatch[0]);
        console.log(`[BobAnalysis-Usage] ✓ Successfully parsed JSON`);
        console.log(`[BobAnalysis-Usage] Parsed data type: ${Array.isArray(parsed) ? 'Array' : typeof parsed}`);
        console.log(`[BobAnalysis-Usage] Array length: ${Array.isArray(parsed) ? parsed.length : 'N/A'}`);
      } catch (parseError: any) {
        console.error(`[BobAnalysis-Usage] ❌ JSON parse error: ${parseError.message}`);
        console.error(`[BobAnalysis-Usage] Error at position: ${parseError.message.match(/position (\d+)/)?.[1] || 'unknown'}`);
        console.error(`[BobAnalysis-Usage] JSON that failed to parse:\n${jsonMatch[0]}`);
        throw parseError;
      }
      
      if (!Array.isArray(parsed)) {
        console.warn(`[BobAnalysis-Usage] ⚠️ Response is not an array, type: ${typeof parsed}`);
        return [];
      }
      
      console.log(`[BobAnalysis-Usage] Validating ${parsed.length} function usage entries...`);
      
      // Validate structure
      const validated = parsed.filter((item, index) => {
        if (typeof item !== 'object' || !item) {
          console.warn(`[BobAnalysis-Usage] ⚠️ Invalid item at index ${index}: not an object`);
          return false;
        }
        if (typeof item.functionName !== 'string') {
          console.warn(`[BobAnalysis-Usage] ⚠️ Invalid item at index ${index}: missing functionName`);
          return false;
        }
        if (typeof item.definedIn !== 'string') {
          console.warn(`[BobAnalysis-Usage] ⚠️ Invalid item at index ${index}: missing definedIn`);
          return false;
        }
        if (!Array.isArray(item.usedInFiles)) {
          console.warn(`[BobAnalysis-Usage] ⚠️ Invalid item at index ${index}: usedInFiles not an array`);
          return false;
        }
        
        // Validate each usedInFiles entry
        const validUsage = item.usedInFiles.every((usage: any, usageIndex: number) => {
          if (typeof usage !== 'object' || !usage) {
            console.warn(`[BobAnalysis-Usage] ⚠️ Invalid usage at index ${index}.${usageIndex}: not an object`);
            return false;
          }
          if (typeof usage.filePath !== 'string') {
            console.warn(`[BobAnalysis-Usage] ⚠️ Invalid usage at index ${index}.${usageIndex}: missing filePath`);
            return false;
          }
          if (!Array.isArray(usage.calledBy)) {
            console.warn(`[BobAnalysis-Usage] ⚠️ Invalid usage at index ${index}.${usageIndex}: calledBy not an array`);
            return false;
          }
          if (!usage.calledBy.every((f: any) => typeof f === 'string')) {
            console.warn(`[BobAnalysis-Usage] ⚠️ Invalid usage at index ${index}.${usageIndex}: calledBy contains non-string`);
            return false;
          }
          return true;
        });
        
        return validUsage;
      });
      
      console.log(`[BobAnalysis-Usage] ✓ Validated ${validated.length}/${parsed.length} function usage entries`);
      if (validated.length !== parsed.length) {
        console.warn(`[BobAnalysis-Usage] ⚠️ Filtered out ${parsed.length - validated.length} invalid items`);
      }
      
      return validated;
    } catch (error) {
      console.error('[BobAnalysis-Usage] ❌ Error extracting function usage:', error);
      return [];
    }
  }
}

// Made with Bob