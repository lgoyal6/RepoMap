# Source Code Structure

This document describes the organization of the extension's source code.

## Directory Structure

```
src/
├── extension.ts              # Extension entry point
├── models/                   # Type definitions and interfaces
│   ├── index.ts             # Re-exports all types
│   └── types.ts             # All TypeScript interfaces and types
├── providers/               # VS Code providers
│   ├── index.ts            # Re-exports all providers
│   └── webviewProvider.ts  # Webview panel provider for the UI
└── services/               # Business logic services
    ├── index.ts           # Re-exports all services
    ├── bob/               # Bob AI integration services
    │   ├── index.ts      # Re-exports Bob services
    │   ├── bobService.ts # Core Bob CLI integration
    │   └── bobRefactoringService.ts # AI-powered refactoring
    ├── analysis/         # Code analysis services
    │   ├── index.ts     # Re-exports analysis services
    │   ├── dependencyService.ts # Dependency graph analysis
    │   └── unifiedGraphService.ts # Unified graph builder
    └── core/            # Core functionality services
        ├── index.ts    # Re-exports core services
        ├── fileSystemService.ts # File system operations
        └── refactoringService.ts # Regex-based refactoring
```

## Module Organization

### Models (`models/`)
Contains all TypeScript interfaces and type definitions used throughout the extension:
- `FileNode` - File tree structure
- `BobMessage`, `BobRequest`, `BobResponse` - Bob AI communication
- `DependencyNode`, `DependencyEdge`, `DependencyGraph` - Dependency analysis
- `WebviewMessage`, `ExtensionMessage` - Webview communication

### Providers (`providers/`)
VS Code-specific providers that integrate with the editor:
- `RepomapWebviewProvider` - Manages the webview panel and handles communication between the extension and UI

### Services

#### Bob Services (`services/bob/`)
AI-powered features using IBM Bob:
- `BobService` - Core integration with Bob CLI, handles command execution and response parsing
- `BobRefactoringService` - Uses Bob to intelligently refactor code when files/folders are renamed

#### Analysis Services (`services/analysis/`)
Code analysis and graph building:
- `DependencyService` - Analyzes code to build dependency graphs (imports, function calls)
- `UnifiedGraphService` - Combines file tree and dependency information into a unified graph

#### Core Services (`services/core/`)
Fundamental operations:
- `FileSystemService` - File and directory operations (read, write, rename, tree building)
- `RefactoringService` - Regex-based refactoring for updating import statements

## Import Patterns

Each directory has an `index.ts` file that re-exports its contents, allowing for cleaner imports:

```typescript
// Instead of:
import { BobService } from './services/bob/bobService';
import { BobRefactoringService } from './services/bob/bobRefactoringService';

// You can use:
import { BobService, BobRefactoringService } from './services/bob';

// Or even:
import { BobService, BobRefactoringService } from './services';
```

## Adding New Features

### Adding a New Service
1. Create the service file in the appropriate directory (`bob/`, `analysis/`, or `core/`)
2. Export the service class
3. Add the export to the directory's `index.ts`
4. Import and use via the index file

### Adding New Types
1. Add the type/interface to `models/types.ts`
2. It will automatically be available via `import { YourType } from './models'`

### Adding a New Provider
1. Create the provider file in `providers/`
2. Export the provider class
3. Add the export to `providers/index.ts`
4. Register it in `extension.ts`

## Design Principles

1. **Separation of Concerns**: Each service has a single, well-defined responsibility
2. **Layered Architecture**: 
   - Models define data structures
   - Services implement business logic
   - Providers integrate with VS Code
3. **Clean Imports**: Index files provide clean, organized import paths
4. **Type Safety**: All shared types are centralized in the models directory
5. **Modularity**: Services can be easily tested and reused independently