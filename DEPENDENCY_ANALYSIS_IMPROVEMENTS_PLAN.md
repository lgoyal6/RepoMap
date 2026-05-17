# Dependency Analysis Improvements Plan

## Overview
This document outlines the implementation plan for two key improvements to the dependency analysis system:
1. **User folder selection** during initial dependency tree building
2. **Extensive console logging** during JSON processing to debug errors

## Current Architecture

### Dependency Graph Building Flow
```
webviewProvider.show()
  └─> messageHandlers.handleLoadWorkspace()
      └─> unifiedGraphService.buildUnifiedGraph()
          └─> dependencyService.buildDependencyGraph()
              └─> buildDependencyGraphPhased()
                  ├─> getAllSupportedFiles()
                  ├─> bobAnalysisService.extractFunctionDefinitions()
                  ├─> bobAnalysisService.extractFileImports()
                  ├─> bobAnalysisService.extractFunctionUsage()
                  └─> graphCombinerService.buildFinalGraph()
```

### Key Files to Modify
1. [`extension/src/dependencyService.ts`](extension/src/dependencyService.ts) - Main orchestrator
2. [`extension/src/dependency/bobAnalysisService.ts`](extension/src/dependency/bobAnalysisService.ts) - JSON parsing
3. [`extension/src/dependency/graphCombinerService.ts`](extension/src/dependency/graphCombinerService.ts) - Graph combining

## Feature 1: User Folder Selection

### Requirements
- Prompt user to select folders **only on first build** (when no cache exists)
- Allow **multiple folder and subfolder selection**
- Cache the selection for subsequent builds
- Use cached selection unless user forces refresh

### Implementation Strategy

#### 1.1 Add Folder Selection Cache
**File**: [`extension/src/dependencyService.ts`](extension/src/dependencyService.ts:30)

Add cache file path for selected folders in constructor.

#### 1.2 Create Folder Selection Method
**File**: [`extension/src/dependencyService.ts`](extension/src/dependencyService.ts:236)

Add new method to prompt user for folder selection:
- Get all directories in workspace (excluding ignored ones like node_modules)
- Build hierarchical quick pick items with checkboxes
- Show multi-select quick pick using VS Code API
- Return selected folder paths

#### 1.3 Load/Save Selected Folders
**File**: [`extension/src/dependencyService.ts`](extension/src/dependencyService.ts:33)

Add methods to manage folder selection cache:
- `loadSelectedFolders()`: Load from `.bob/selected-folders.json`
- `saveSelectedFolders()`: Save to `.bob/selected-folders.json`

#### 1.4 Modify getAllSupportedFiles()
**File**: [`extension/src/dependencyService.ts`](extension/src/dependencyService.ts:236)

Update to accept optional folder filter parameter. When folders are provided, only scan those folders. Otherwise, scan entire workspace.

#### 1.5 Integrate Folder Selection into Build Flow
**File**: [`extension/src/dependencyService.ts`](extension/src/dependencyService.ts:57)

Modify `buildDependencyGraph()` to:
1. Check if we have selected folders cached
2. If no cached selection or force refresh, prompt user
3. Save the selection to cache
4. Pass selected folders to build process

#### 1.6 Update buildDependencyGraphPhased()
**File**: [`extension/src/dependencyService.ts`](extension/src/dependencyService.ts:76)

Add `selectedFolders` parameter and pass it to `getAllSupportedFiles()`.

## Feature 2: Extensive Console Logging

### Requirements
- Add detailed logging at each stage of JSON processing
- Log raw responses from Bob before parsing
- Log intermediate data structures during transformation
- Log validation results and filtered items
- Help identify where JSON parsing errors occur

### Implementation Strategy

#### 2.1 Enhanced Logging in bobAnalysisService.ts

**File**: [`extension/src/dependency/bobAnalysisService.ts`](extension/src/dependency/bobAnalysisService.ts)

##### In extractFunctionsFromBatch() (line 95)
Add logging for:
- Batch processing start with file count
- Number of files successfully read
- Bob request sent notification
- Raw Bob response length and preview (first 500 chars, last 500 chars)
- Text after trimming
- Text after removing markdown blocks
- JSON extraction success/failure
- JSON parsing success/failure with error details
- Validation results with invalid item details
- Final validated count

##### In extractImportsFromBatch() (line 224)
Add equivalent logging with `[BobAnalysis-Imports]` prefix for:
- Batch processing details
- Raw response logging
- JSON extraction and parsing
- Validation results

##### In extractUsageForFunctionBatch() (line 355)
Add equivalent logging with `[BobAnalysis-Usage]` prefix for:
- Function batch processing
- Raw response logging
- JSON extraction and parsing
- Validation results

#### 2.2 Enhanced Logging in graphCombinerService.ts

**File**: [`extension/src/dependency/graphCombinerService.ts`](extension/src/dependency/graphCombinerService.ts:26)

Add logging in `buildFinalGraph()`:
- Start banner with input data summary
- File tree building step
- Node building step with count
- Edge building step with type breakdown
- Cache saving step
- End banner

Add logging in `buildNodes()`:
- File tree node count
- Function grouping details
- Files with functions count
- Total nodes created

Add logging in `buildEdges()`:
- File imports processing count
- Function usage processing count
- Resolved vs unresolved imports
- Unresolved import warnings
- Function call edges count
- Total edges summary

#### 2.3 Enhanced Logging in dependencyService.ts

**File**: [`extension/src/dependencyService.ts`](extension/src/dependencyService.ts:76)

Add logging in `buildDependencyGraphPhased()`:
- Start banner with configuration
- File gathering step with counts
- Phase 1 start/complete with results
- Phase 2 start/complete with results
- Phase 3 start/complete with results
- Phase 4 start/complete with results
- Error logging with stack trace
- End banner

## Testing Strategy

### Test Cases

1. **Folder Selection - First Build**
   - Open extension with no cache
   - Verify folder selection prompt appears
   - Select multiple folders
   - Verify only selected folders are analyzed
   - Check cache file created

2. **Folder Selection - Cached Build**
   - Open extension with existing cache
   - Verify no prompt appears
   - Verify cached folders are used

3. **Folder Selection - Force Refresh**
   - Trigger refresh with cache present
   - Verify folder selection prompt appears again
   - Select different folders
   - Verify new selection is cached

4. **Logging - JSON Parsing Success**
   - Trigger analysis
   - Verify all log stages appear in console
   - Verify raw Bob responses are logged
   - Verify validation results are logged

5. **Logging - JSON Parsing Failure**
   - Simulate Bob returning invalid JSON
   - Verify error logs show exact failure point
   - Verify raw response is logged for debugging

## Implementation Order

1. ✅ Analyze codebase (COMPLETE)
2. Add folder selection cache methods
3. Implement folder selection prompt UI
4. Update getAllSupportedFiles() with folder filtering
5. Integrate folder selection into build flow
6. Add extensive logging to bobAnalysisService.ts
7. Add extensive logging to graphCombinerService.ts
8. Add extensive logging to dependencyService.ts
9. Test all scenarios
10. Document changes

## Files to Modify Summary

| File | Changes | Lines Affected |
|------|---------|----------------|
| [`extension/src/dependencyService.ts`](extension/src/dependencyService.ts) | Add folder selection, update file gathering | Approximately 150 new lines |
| [`extension/src/dependency/bobAnalysisService.ts`](extension/src/dependency/bobAnalysisService.ts) | Add extensive logging | Approximately 100 new lines |
| [`extension/src/dependency/graphCombinerService.ts`](extension/src/dependency/graphCombinerService.ts) | Add extensive logging | Approximately 50 new lines |

## Expected Benefits

1. **User Control**: Users can focus analysis on relevant folders, improving performance
2. **Better Debugging**: Detailed logs help identify JSON parsing issues quickly
3. **Improved UX**: Cached folder selection reduces repetitive prompts
4. **Maintainability**: Clear logging makes future debugging easier

## Potential Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Excessive logging impacts performance | Use console.log (not expensive), add log level control later if needed |
| Folder selection UI is confusing | Use VS Code's native QuickPick with clear labels and hierarchy |
| Cache corruption | Add validation when loading cache, fall back to prompt if invalid |
| Selected folders deleted | Validate folders exist before using cached selection |

## Key Implementation Details

### Folder Selection UI Design
```typescript
// QuickPick items will look like:
// ☐ src/
// ☐ src/components/
// ☐ src/utils/
// ☐ test-files/
// ☐ webview/
```

### Cache File Format
```json
{
  "selectedFolders": [
    "src",
    "src/components",
    "webview"
  ],
  "timestamp": "2026-05-17T11:45:00.000Z"
}
```

### Logging Format
All logs will use prefixed format for easy filtering:
- `[DependencyService]` - Main orchestration logs
- `[BobAnalysis]` - Function extraction logs
- `[BobAnalysis-Imports]` - Import extraction logs
- `[BobAnalysis-Usage]` - Usage extraction logs
- `[GraphCombiner]` - Graph combination logs

### Error Handling
- All JSON parsing errors will log the exact position and surrounding context
- Failed folder validation will prompt user again
- Cache read errors will fall back to prompting user