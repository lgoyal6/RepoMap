# Dependency Graph Improvements

## Overview
Enhanced Bob's dependency creation system to support HTML/CSS file imports and function-level dependencies with hierarchical structure.

## New Features

### 1. HTML File Import Detection
- **What**: Extracts CSS and JavaScript file references from HTML files
- **How**: Parses `<link rel="stylesheet">` and `<script src="">` tags
- **Example**: `index.html` → `styles.css`, `main.js`

### 2. CSS File Import Detection
- **What**: Extracts CSS imports from stylesheets
- **How**: Parses `@import` statements (both `url()` and direct string syntax)
- **Example**: `styles.css` → `base.css`, `colors.css`

### 3. Function-Level Dependencies
- **What**: Functions appear as child nodes of their parent files
- **How**: Extracts function/class definitions and creates hierarchical structure
- **Example**: 
  ```
  main.js (file)
    ├─ init (function)
    ├─ setupEventListeners (function)
    └─ loadData (function)
  ```

### 4. Function Call Tracking
- **What**: Tracks which functions call which other functions
- **How**: Analyzes function bodies to detect function invocations
- **Example**: `main.js:init` → `main.js:setupEventListeners`

## Files Modified

### 1. `extension/src/dependency/codeParser.ts`
**Changes**:
- Added `FunctionCall` interface to track function-to-function calls
- Added `extractHtmlImports()` - parses HTML link and script tags
- Added `extractCssImports()` - parses CSS @import statements
- Added `extractFunctionCalls()` - analyzes function call relationships
- Implemented deduplication logic to prevent duplicate function entries
- Fixed class method regex to avoid false positives

**New Methods**:
```typescript
extractHtmlImports(content: string): FileImport[]
extractCssImports(content: string): FileImport[]
extractFunctionCalls(content: string, ext: string, functions: FunctionDef[]): FunctionCall[]
extractJavaScriptFunctionCalls(content: string, functions: FunctionDef[]): FunctionCall[]
extractPythonFunctionCalls(content: string, functions: FunctionDef[]): FunctionCall[]
extractGoFunctionCalls(content: string, functions: FunctionDef[]): FunctionCall[]
extractJavaFunctionCalls(content: string, functions: FunctionDef[]): FunctionCall[]
```

### 2. `extension/src/dependency/pathResolver.ts`
**Changes**:
- Added `.html`, `.htm`, `.css` to supported extensions
- Added external URL filtering (skips http://, https://, //)
- Improved path resolution for files with existing extensions

### 3. `extension/src/dependency/graphBuilder.ts`
**Changes**:
- Added intra-file function call edge creation
- Maintains function nodes as children of file nodes
- Creates edges with format `file:function` for function-level dependencies

### 4. `extension/src/dependencyService.ts`
**Changes**:
- Added `.html`, `.htm`, `.css` to `getAllSupportedFiles()`
- Updated Bob prompt to include:
  - Instructions for HTML/CSS file parsing
  - Function extraction requirements
  - Function call edge creation
  - Hierarchical structure with children

### 5. `extension/src/unifiedGraphService.ts`
**Changes**:
- Hybrid approach: Uses file system tree for folder structure + dependency graph for functions
- Added `enrichTreeWithFunctions()` method to merge function data into file tree
- Added `addFunctionsToTree()` recursive method to add functions to matching files
- Preserves complete folder structure while adding function children to files
- Ensures all folders remain visible in the tree

## Supported Languages

### Full Support (imports + functions + calls)
- JavaScript (.js)
- TypeScript (.ts, .tsx)
- JSX (.jsx)
- Python (.py)
- Go (.go)
- Java (.java)
- Rust (.rs)

### File Import Support
- HTML (.html, .htm)
- CSS (.css)

## Graph Structure

### Node Types
1. **Folder**: Directory containing files
2. **File**: Source code or web files
3. **Function**: Functions/classes within files (as children)

### Edge Types
1. **imports**: File-to-file dependencies (e.g., HTML → CSS, JS → JS)
2. **calls**: Function-to-function dependencies (e.g., init → setupEventListeners)

### Node ID Format
- Files: `path/to/file.ext`
- Functions: `path/to/file.ext:functionName`

## Example Output

```json
{
  "nodes": [
    {
      "id": "index.html",
      "name": "index.html",
      "type": "file",
      "filePath": "index.html",
      "children": []
    },
    {
      "id": "main.js",
      "name": "main.js",
      "type": "file",
      "filePath": "main.js",
      "children": [
        {
          "id": "main.js:init",
          "name": "init",
          "type": "function",
          "filePath": "main.js",
          "line": 1
        },
        {
          "id": "main.js:setupEventListeners",
          "name": "setupEventListeners",
          "type": "function",
          "filePath": "main.js",
          "line": 7
        }
      ]
    }
  ],
  "edges": [
    {
      "from": "index.html",
      "to": "main.js",
      "type": "imports"
    },
    {
      "from": "main.js:init",
      "to": "main.js:setupEventListeners",
      "type": "calls"
    }
  ]
}
```

## Test Results

Using test files in `test-files/`:
- ✅ HTML imports: 2 detected (styles.css, main.js)
- ✅ CSS imports: 2 detected (base.css, colors.css)
- ✅ Function nodes: 5 as children of main.js
- ✅ Function calls: 5 intra-file call edges
- ✅ No duplicates: Deduplication working correctly

## Usage

The improvements work automatically when:
1. Loading the dependency graph in the extension
2. Refreshing the dependency graph
3. Using Bob to analyze dependencies (with updated prompt)
4. Using regex fallback (graphBuilder)

Both Bob-based and regex-based graph generation now support all these features.

## Future Enhancements

Potential improvements:
- Add support for more languages (C++, C#, PHP, Ruby, etc.)
- Track variable usage across files
- Detect circular dependencies
- Add import/export validation
- Support for dynamic imports and lazy loading