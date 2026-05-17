# Phased Bob Analysis System

## Overview

The new phased analysis system breaks down dependency graph generation into 4 distinct phases, each producing a cached JSON file. This approach is more reliable, maintainable, and allows Bob to focus on one task at a time.

## Architecture

### Phase 1: Function Definitions
**File**: `.bob/analysis/functions.json`

Extracts all function/method/class definitions from the codebase.

**Output Structure**:
```json
[
  {
    "name": "init",
    "filePath": "src/main.js",
    "line": 10,
    "language": "javascript",
    "exported": true
  }
]
```

**Supported Languages**: JavaScript, TypeScript, Python, Go, Java, Rust, and more

### Phase 2: File Imports
**File**: `.bob/analysis/file-imports.json`

Extracts all file import relationships.

**Output Structure**:
```json
[
  {
    "sourceFile": "src/app.js",
    "importedFiles": ["./utils.js", "./config.js"]
  },
  {
    "sourceFile": "index.html",
    "importedFiles": ["./styles.css", "./main.js"]
  }
]
```

**Supported Import Types**:
- JavaScript/TypeScript: `import`, `require()`
- HTML: `<script src>`, `<link href>`
- CSS: `@import`
- Python: `import`, `from ... import`
- Go: `import`
- Java: `import`

### Phase 3: Function Usage
**File**: `.bob/analysis/function-usage.json`

Finds where each function is called and by which other functions.

**Output Structure**:
```json
[
  {
    "functionName": "init",
    "definedIn": "main.js",
    "usedInFiles": [
      {
        "filePath": "app.js",
        "calledBy": ["start", "bootstrap"]
      }
    ]
  }
]
```

### Phase 4: Final Graph
**File**: `.bob/analysis/final-graph.json`

Combines all previous phases with the repository structure.

**Output Structure**:
```json
{
  "nodes": [
    {
      "id": "src",
      "name": "src",
      "type": "folder",
      "filePath": "src",
      "children": [
        {
          "id": "src/main.js",
          "name": "main.js",
          "type": "file",
          "filePath": "src/main.js",
          "children": [
            {
              "id": "src/main.js:init",
              "name": "init",
              "type": "function",
              "filePath": "src/main.js",
              "line": 10
            }
          ]
        }
      ]
    }
  ],
  "edges": [
    {
      "from": "index.html",
      "to": "src/main.js",
      "type": "imports"
    },
    {
      "from": "src/app.js:start",
      "to": "src/main.js:init",
      "type": "calls"
    }
  ]
}
```

## Implementation

### Services

#### 1. BobAnalysisService
**Location**: `extension/src/dependency/bobAnalysisService.ts`

**Methods**:
- `extractFunctionDefinitions(files, forceRefresh)`: Phase 1
- `extractFileImports(files, forceRefresh)`: Phase 2
- `extractFunctionUsage(functions, files, forceRefresh)`: Phase 3

**Features**:
- Batch processing (10 files at a time for imports/functions, 20 functions at a time for usage)
- Caching to `.bob/analysis/` directory
- Progress logging
- Error handling with fallback

#### 2. GraphCombinerService
**Location**: `extension/src/dependency/graphCombinerService.ts`

**Methods**:
- `buildFinalGraph(functions, fileImports, functionUsage)`: Phase 4
- `loadCachedGraph()`: Load from cache

**Features**:
- Merges file system structure with analysis data
- Resolves import paths
- Creates hierarchical node structure (folders → files → functions)
- Generates edges for both file imports and function calls

#### 3. DependencyService (Updated)
**Location**: `extension/src/dependency/dependencyService.ts`

**New Method**:
- `buildDependencyGraphPhased(forceRefresh)`: Orchestrates all 4 phases

**Flow**:
1. Get all supported files (up to 100 for performance)
2. Run Phase 1: Extract functions
3. Run Phase 2: Extract imports
4. Run Phase 3: Extract usage
5. Run Phase 4: Combine into final graph
6. Cache and return result

## Benefits

### 1. Reliability
- Each phase has a focused task
- Bob can concentrate on one type of analysis at a time
- Easier to debug which phase is failing

### 2. Performance
- Cached results for each phase
- Can skip phases if cache is valid
- Batch processing prevents overwhelming Bob

### 3. Maintainability
- Clear separation of concerns
- Easy to improve individual phases
- Simple to add new analysis types

### 4. Flexibility
- Can run phases independently
- Can force refresh specific phases
- Easy to extend with new phases

## Usage

### Normal Usage
The phased analysis runs automatically when building the dependency graph:

```typescript
const dependencyService = new DependencyService();
const graph = await dependencyService.buildDependencyGraph();
```

### Force Refresh
To rebuild all phases from scratch:

```typescript
const graph = await dependencyService.buildDependencyGraph(true);
```

### Manual Phase Execution
For testing or debugging individual phases:

```typescript
const bobAnalysis = new BobAnalysisService(workspaceRoot);

// Phase 1 only
const functions = await bobAnalysis.extractFunctionDefinitions(files, true);

// Phase 2 only
const imports = await bobAnalysis.extractFileImports(files, true);

// Phase 3 only
const usage = await bobAnalysis.extractFunctionUsage(functions, files, true);
```

## Cache Management

### Cache Location
All analysis results are stored in `.bob/analysis/`:
- `functions.json`
- `file-imports.json`
- `function-usage.json`
- `final-graph.json`

### Cache Invalidation
Cache is automatically used unless:
1. `forceRefresh` is set to `true`
2. Cache files don't exist
3. Analysis fails and falls back to regex

### Manual Cache Clearing
Delete the `.bob/analysis/` directory to force a complete rebuild.

## Fallback Strategy

If the phased Bob analysis fails at any point, the system automatically falls back to the regex-based parser:

```typescript
try {
  return await this.buildDependencyGraphPhased(forceRefresh);
} catch (error) {
  console.error('Phased analysis failed, falling back to regex:', error);
  return this.buildDependencyGraphWithRegex();
}
```

The regex fallback uses the existing `GraphBuilder` service which provides basic but reliable dependency detection.

## Future Enhancements

### Potential Improvements
1. **Incremental Updates**: Only re-analyze changed files
2. **Parallel Processing**: Run phases concurrently where possible
3. **More Languages**: Add support for C++, C#, Ruby, PHP, etc.
4. **Type Analysis**: Track type dependencies and interfaces
5. **Documentation**: Extract JSDoc/docstrings for functions
6. **Metrics**: Calculate complexity, coupling, cohesion
7. **Visualization**: Generate dependency diagrams
8. **Export**: Export graphs to various formats (GraphML, DOT, etc.)

### Phase 5 Ideas
- **Variable Tracking**: Track global variables and their usage
- **API Endpoints**: Extract REST/GraphQL endpoints
- **Database Queries**: Find SQL queries and database interactions
- **Configuration**: Track config file dependencies

## Troubleshooting

### Issue: No functions found
- Check if files are in supported languages
- Verify Bob API is responding
- Check `.bob/analysis/functions.json` for errors

### Issue: Missing imports
- Ensure file extensions are included in `getAllSupportedFiles()`
- Check path resolution in `GraphCombinerService`
- Verify import syntax is supported

### Issue: Function calls not detected
- Ensure functions were found in Phase 1
- Check if function names match exactly
- Verify Phase 3 is analyzing the right files

### Issue: Slow performance
- Reduce file limit in `buildDependencyGraphPhased()`
- Adjust batch sizes in `BobAnalysisService`
- Use cached results when possible

## Testing

### Test Individual Phases
Create test files in `test-files/` and run:

```bash
node test-files/test-phased-analysis.js
```

### Verify Cache Files
Check `.bob/analysis/` directory for JSON files and inspect their contents.

### Monitor Progress
Watch console output for phase progress and statistics.