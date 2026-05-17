# Bob-Powered File Refactoring Guide

## Overview

The `setRename` function now uses **Bob (IBM's AI assistant)** to perform intelligent code refactoring. When you rename a file, Bob:

1. **Analyzes your codebase** - Scans all relevant files to understand the context
2. **Identifies references** - Uses AI to find all imports and references to the renamed file
3. **Updates code intelligently** - Bob rewrites import statements with full understanding of the code structure
4. **Renames the file** - Performs the actual file rename operation
5. **Provides feedback** - Shows detailed progress and results

## Why Bob?

Using Bob for refactoring provides several advantages over traditional pattern-matching:

- **Context-aware**: Bob understands the code structure and semantics
- **Language-agnostic**: Works with any programming language Bob knows
- **Intelligent updates**: Handles complex import patterns and edge cases
- **Future-proof**: Adapts to new language features and patterns automatically
- **Error-resistant**: Less likely to make incorrect changes due to pattern mismatches

## How It Works

### Architecture

The Bob-powered refactoring system consists of three main components:

1. **BobRefactoringService** (`extension/src/bobRefactoringService.ts`)
   - Coordinates the refactoring process
   - Sends files to Bob for analysis and updates
   - Manages batch processing to avoid overwhelming Bob
   - Handles errors and provides detailed feedback

2. **FileSystemService** (`extension/src/fileSystemService.ts`)
   - Provides `refactorRenameFile()` method
   - Calls BobRefactoringService for AI-powered updates
   - Performs the actual file rename

3. **WebviewProvider** (`extension/src/webviewProvider.ts`)
   - Handles rename requests from the UI
   - Shows progress notifications ("Bob is analyzing your codebase...")
   - Reports success/failure with details

### The Bob Workflow

When you rename a file:

1. **Quick Check**: The system first does a quick scan to identify files that might reference the renamed file
2. **Bob Analysis**: For each potential file, Bob receives:
   - The file content
   - Information about the old and new file paths
   - The relative import path from that file to the new location
3. **Intelligent Update**: Bob analyzes the code and:
   - Identifies import/require statements that reference the old file
   - Calculates the correct new import path
   - Updates the import statements while preserving all other code
   - Returns "NO_CHANGES_NEEDED" if the file doesn't reference the renamed file
4. **File Update**: If Bob made changes, the file is updated on disk
5. **Rename**: Finally, the actual file is renamed

## Supported Languages

Bob can handle refactoring for any language it understands, including:

- **TypeScript/JavaScript**: ES6 imports, CommonJS require, dynamic imports
- **Python**: from/import statements
- **Go**: package imports
- **Java**: class imports
- **Rust**: use statements
- **Vue/Svelte**: component imports
- And many more!

## Usage

### From the UI

1. Right-click on a file in the graph view or file tree
2. Select "Rename" from the context menu
3. Enter the new filename
4. Press Enter

Bob will:
- Show a progress notification: "Bob is analyzing your codebase..."
- Process files in batches
- Update all references
- Rename the file
- Display: "✨ File renamed! Bob updated X reference(s) across your codebase"

### Example

**Before renaming `utils.ts` to `helpers.ts`:**

```typescript
// src/app.ts
import { formatDate } from './utils';
import { parseDate } from './utils';

// src/components/Header.tsx
import { formatDate } from '../utils';
```

**Bob's Analysis:**

Bob receives each file and understands:
- The import statements reference `utils.ts`
- The new file will be `helpers.ts`
- The relative paths need to be updated

**After Bob's refactoring:**

```typescript
// src/app.ts
import { formatDate } from './helpers';
import { parseDate } from './helpers';

// src/components/Header.tsx
import { formatDate } from '../helpers';
```

**Result:** "✨ File renamed! Bob updated 2 reference(s) across your codebase"

## Features

### Intelligent Path Resolution

Bob understands:
- **Relative imports**: Correctly calculates new relative paths
- **Absolute imports**: Updates module names appropriately
- **Extension handling**: Preserves or removes extensions as needed
- **Index files**: Handles directory imports with index files
- **Aliases**: Can work with path aliases and custom module resolution

### Context-Aware Updates

Unlike regex-based tools, Bob:
- Understands code structure and semantics
- Avoids false positives (e.g., string literals that happen to contain the filename)
- Handles complex import patterns
- Preserves code formatting and style
- Only updates actual import statements

### Batch Processing

To optimize performance:
- Files are processed in batches of 10
- Quick pre-filtering reduces unnecessary Bob calls
- Progress is reported in real-time
- Errors in one file don't stop the entire process

### Error Handling

If issues occur:
- Detailed error messages for each failed file
- Partial success is reported (e.g., "Updated 5 of 7 files")
- The file rename still proceeds if possible
- All errors are logged for debugging

## Performance

The Bob-based approach is optimized for:
- **Speed**: Quick pre-filtering reduces Bob API calls
- **Accuracy**: AI understanding prevents false positives
- **Reliability**: Robust error handling and recovery
- **Scalability**: Batch processing handles large codebases

Typical performance:
- Small projects (<50 files): 5-10 seconds
- Medium projects (50-200 files): 15-30 seconds
- Large projects (200+ files): 30-60 seconds

## Limitations

1. **Bob availability**: Requires IBM Bob CLI to be installed and accessible
2. **API rate limits**: Very large codebases may hit rate limits
3. **Network dependency**: Requires internet connection for Bob API
4. **Processing time**: Slower than regex-based tools but more accurate

## Advantages Over Traditional Refactoring

### Traditional (Regex-based):
- ❌ Misses complex import patterns
- ❌ False positives on string literals
- ❌ Language-specific implementations needed
- ❌ Breaks on non-standard patterns
- ❌ Requires constant updates for new syntax

### Bob-Powered:
- ✅ Understands code semantics
- ✅ Context-aware updates
- ✅ Works with any language Bob knows
- ✅ Handles edge cases intelligently
- ✅ Adapts to new patterns automatically

## Future Enhancements

Potential improvements:
- **Caching**: Cache Bob's analysis for faster subsequent operations
- **Preview mode**: Show changes before applying
- **Undo support**: Rollback refactoring operations
- **Symbol renaming**: Extend to rename functions, classes, variables
- **Multi-file operations**: Rename multiple files at once
- **Conflict resolution**: Handle naming conflicts intelligently

## Technical Details

### Bob Prompt Engineering

The system uses carefully crafted prompts to ensure Bob:
- Only updates import statements
- Preserves all other code exactly
- Returns "NO_CHANGES_NEEDED" when appropriate
- Provides clean, parseable output

### File Processing

1. **Quick Check**: Regex-based pre-filter to identify candidates
2. **Bob Analysis**: AI-powered code understanding
3. **Validation**: Verify changes before writing
4. **Atomic Updates**: All-or-nothing file updates

### Error Recovery

- Individual file failures don't stop the process
- Detailed error logging for debugging
- Graceful degradation when Bob is unavailable
- User feedback at every step

## Made with Bob

This refactoring system is itself a testament to Bob's capabilities - it was designed and implemented with Bob's assistance!