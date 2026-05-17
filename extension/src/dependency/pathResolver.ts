import * as path from 'path';
import * as fs from 'fs';

export class PathResolver {
  constructor(private workspaceRoot: string) {}

  resolveImportPath(fromFile: string, importPath: string): string | null {
    // Handle URLs (external resources)
    if (importPath.startsWith('http://') || importPath.startsWith('https://') || importPath.startsWith('//')) {
      return null; // Skip external resources
    }

    // Handle relative imports
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      const dir = path.dirname(fromFile);
      let resolved = path.resolve(dir, importPath);

      // Try with common extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.css', '.html', '.htm'];
      for (const ext of extensions) {
        if (fs.existsSync(resolved + ext)) {
          return resolved + ext;
        }
      }

      // Try as directory with index file
      for (const ext of extensions) {
        const indexPath = path.join(resolved, `index${ext}`);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }

      // Try as-is (file might already have extension)
      if (fs.existsSync(resolved)) {
        return resolved;
      }
    }

    // For absolute imports, try to resolve from workspace root
    const absolutePath = path.join(this.workspaceRoot, importPath);
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.css', '.html', '.htm'];
    
    // Try as-is first (might already have extension)
    if (fs.existsSync(absolutePath)) {
      return absolutePath;
    }
    
    for (const ext of extensions) {
      if (fs.existsSync(absolutePath + ext)) {
        return absolutePath + ext;
      }
    }

    return null;
  }
}

// Made with Bob