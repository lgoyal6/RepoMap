# Function Extraction Issue and Fix

## Problem

The `.bob/analysis/functions.json` and `.bob/analysis/function-usage.json` files are empty because the `bobAnalysisService.ts` relies entirely on Bob AI to extract functions. If Bob AI is not configured or returns empty results, no functions will be extracted.

## Root Cause

The `BobAnalysisService` class in `extension/src/dependency/bobAnalysisService.ts` uses Bob AI to analyze code and extract:
1. Function definitions (Phase 1)
2. File imports (Phase 2) 
3. Function usage/calls (Phase 3)

However, there's already a working regex-based parser in `extension/src/dependency/codeParser.ts` that can extract this information without Bob AI.

## Solution

### Option 1: Use the Regex-Based Parser (Recommended for Testing)

The `graphBuilder.ts` already uses the `CodeParser` class which has regex-based extraction. To use it:

1. In `extension/src/dependencyService.ts`, the `buildDependencyGraphPhased` method has a fallback:
   ```typescript
   } catch (error) {
     console.error('[DependencyService] ❌ Phased analysis failed:', error);
     console.log('[DependencyService] Falling back to regex-based analysis...');
     return this.buildDependencyGraphWithRegex();
   }
   ```

2. The `buildDependencyGraphWithRegex()` method uses `GraphBuilder` which uses `CodeParser` for regex-based extraction.

### Option 2: Add Fallback to BobAnalysisService

Modify `bobAnalysisService.ts` to add the `CodeParser` import and use it as a fallback:

```typescript
import { CodeParser } from './codeParser';

export class BobAnalysisService {
  private bobService: BobService;
  private codeParser: CodeParser;  // Add this
  private workspaceRoot: string;
  private cacheDir: string;

  constructor(workspaceRoot: string) {
    this.bobService = new BobService();
    this.codeParser = new CodeParser();  // Add this
    this.workspaceRoot = workspaceRoot;
    this.cacheDir = path.join(workspaceRoot, '.bob', 'analysis');
    this.ensureCacheDir();
  }

  async extractFunctionDefinitions(files: string[], forceRefresh: boolean = false): Promise<FunctionDefinition[]> {
    const cacheFile = 'functions.json';
    
    if (!forceRefresh) {
      const cached = await this.loadFromCache(cacheFile);
      if (cached && cached.length > 0) {
        console.log(`Loaded ${cached.length} function definitions from cache`);
        return cached;
      }
    }

    console.log(`Analyzing ${files.length} files for function definitions...`);
    
    // Try Bob AI first
    let functions = await this.extractFunctionsFromBatch(files);
    
    // If Bob returns empty or fails, fall back to regex parser
    if (functions.length === 0) {
      console.log('[BobAnalysis] Bob returned no functions, falling back to regex parser...');
      functions = await this.extractFunctionsWithRegex(files);
    }
    
    console.log(`Processed all ${files.length} files, found ${functions.length} functions`);

    await this.saveToCache(cacheFile, functions);
    return functions;
  }

  private async extractFunctionsWithRegex(files: string[]): Promise<FunctionDefinition[]> {
    console.log(`[BobAnalysis-Regex] Extracting functions from ${files.length} files using regex parser...`);
    const allFunctions: FunctionDefinition[] = [];
    
    for (const filePath of files) {
      try {
        const parsed = await this.codeParser.parseFile(filePath);
        if (parsed && parsed.functions.length > 0) {
          const relativePath = path.relative(this.workspaceRoot, filePath).replace(/\\/g, '/');
          const ext = path.extname(filePath);
          const language = this.getLanguageFromExtension(ext);
          
          for (const func of parsed.functions) {
            allFunctions.push({
              name: func.name,
              filePath: relativePath,
              line: func.line,
              language,
              exported: func.exported
            });
          }
        }
      } catch (error) {
        console.error(`[BobAnalysis-Regex] Error parsing ${filePath}:`, error);
      }
    }
    
    console.log(`[BobAnalysis-Regex] ✓ Extracted ${allFunctions.length} functions using regex`);
    return allFunctions;
  }

  private getLanguageFromExtension(ext: string): string {
    const langMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.java': 'java',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp'
    };
    return langMap[ext] || 'unknown';
  }
}
```

## Testing the Fix

1. Delete the `.bob/analysis` folder to clear the cache
2. Rebuild the extension: `cd extension && npm run compile`
3. Run the extension (F5 in VS Code)
4. Trigger a dependency graph refresh
5. Check `.bob/analysis/functions.json` - it should now contain function definitions

## Current Status

The frontend changes for rendering function nodes are complete and working. The only issue is that the backend isn't populating the functions data. Once the fallback is added to `bobAnalysisService.ts`, function nodes will appear in the graph visualization.

## Files That Need the Fix

- `extension/src/dependency/bobAnalysisService.ts` - Add CodeParser fallback as shown above