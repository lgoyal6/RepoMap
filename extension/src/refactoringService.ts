import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface FileReference {
  filePath: string;
  line: number;
  column: number;
  importPath: string;
}

export class RefactoringService {
  private workspaceRoot: string;

  constructor() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    this.workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
  }

  /**
   * Find all files that import or reference the given file
   */
  async findFileReferences(targetFilePath: string): Promise<FileReference[]> {
    const references: FileReference[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs'];
    
    // Get all supported files
    const pattern = `**/*{${extensions.join(',')}}`;
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

    const targetRelPath = path.relative(this.workspaceRoot, targetFilePath);
    const targetBaseName = path.basename(targetFilePath, path.extname(targetFilePath));

    for (const uri of uris) {
      const filePath = uri.fsPath;
      if (filePath === targetFilePath) continue; // Skip the file itself

      try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const ext = path.extname(filePath);

        // Find import statements that reference the target file
        lines.forEach((line, lineIndex) => {
          const refs = this.findImportsInLine(line, filePath, targetFilePath, targetBaseName, ext);
          refs.forEach(ref => {
            references.push({
              filePath,
              line: lineIndex + 1,
              column: ref.column,
              importPath: ref.importPath
            });
          });
        });
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
      }
    }

    return references;
  }

  /**
   * Find import statements in a line that reference the target file
   */
  private findImportsInLine(
    line: string,
    fromFile: string,
    targetFile: string,
    targetBaseName: string,
    ext: string
  ): Array<{ column: number; importPath: string }> {
    const results: Array<{ column: number; importPath: string }> = [];

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      // ES6 imports: import ... from './path'
      const es6Regex = /import\s+(?:{[^}]+}|[\w]+|\*\s+as\s+\w+)\s+from\s+['"]([^'"]+)['"]/g;
      let match;
      while ((match = es6Regex.exec(line)) !== null) {
        const importPath = match[1];
        if (this.isImportingFile(fromFile, importPath, targetFile, targetBaseName)) {
          results.push({ column: match.index, importPath });
        }
      }

      // require: const x = require('./path')
      const requireRegex = /require\s*\(['"]([^'"]+)['"]\)/g;
      while ((match = requireRegex.exec(line)) !== null) {
        const importPath = match[1];
        if (this.isImportingFile(fromFile, importPath, targetFile, targetBaseName)) {
          results.push({ column: match.index, importPath });
        }
      }

      // Dynamic imports: import('./path')
      const dynamicRegex = /import\s*\(['"]([^'"]+)['"]\)/g;
      while ((match = dynamicRegex.exec(line)) !== null) {
        const importPath = match[1];
        if (this.isImportingFile(fromFile, importPath, targetFile, targetBaseName)) {
          results.push({ column: match.index, importPath });
        }
      }
    } else if (ext === '.py') {
      // Python: from module import x
      const fromRegex = /from\s+([\w.]+)\s+import/g;
      let match;
      while ((match = fromRegex.exec(line)) !== null) {
        const importPath = match[1].replace(/\./g, '/');
        if (this.isImportingFile(fromFile, importPath, targetFile, targetBaseName)) {
          results.push({ column: match.index, importPath: match[1] });
        }
      }

      // Python: import module
      const importRegex = /^import\s+([\w.]+)/gm;
      while ((match = importRegex.exec(line)) !== null) {
        const importPath = match[1].replace(/\./g, '/');
        if (this.isImportingFile(fromFile, importPath, targetFile, targetBaseName)) {
          results.push({ column: match.index, importPath: match[1] });
        }
      }
    }

    return results;
  }

  /**
   * Check if an import path is importing the target file
   */
  private isImportingFile(
    fromFile: string,
    importPath: string,
    targetFile: string,
    targetBaseName: string
  ): boolean {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      let resolved = path.resolve(fromDir, importPath);

      // Try with common extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', ''];
      for (const ext of extensions) {
        const testPath = resolved + ext;
        if (testPath === targetFile) return true;

        // Try as directory with index file
        const indexPath = path.join(resolved, `index${ext}`);
        if (indexPath === targetFile) return true;
      }

      // Check if resolved path matches target (without extension)
      if (resolved === targetFile || resolved + path.extname(targetFile) === targetFile) {
        return true;
      }
    }

    // Check if the import path basename matches the target file basename
    const importBaseName = path.basename(importPath, path.extname(importPath));
    if (importBaseName === targetBaseName) {
      return true;
    }

    return false;
  }

  /**
   * Update import statements in a file to reflect the new path
   */
  async updateImportsInFile(
    filePath: string,
    oldTargetPath: string,
    newTargetPath: string
  ): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const ext = path.extname(filePath);
      let modified = false;

      const oldBaseName = path.basename(oldTargetPath, path.extname(oldTargetPath));
      const newBaseName = path.basename(newTargetPath, path.extname(newTargetPath));

      // Update each line
      const updatedLines = lines.map(line => {
        return this.updateImportsInLine(
          line,
          filePath,
          oldTargetPath,
          newTargetPath,
          oldBaseName,
          newBaseName,
          ext
        );
      });

      // Check if any changes were made
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] !== updatedLines[i]) {
          modified = true;
          break;
        }
      }

      if (modified) {
        const updatedContent = updatedLines.join('\n');
        await fs.promises.writeFile(filePath, updatedContent, 'utf-8');
      }
    } catch (error) {
      console.error(`Error updating imports in ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Update import statements in a single line
   */
  private updateImportsInLine(
    line: string,
    fromFile: string,
    oldTargetPath: string,
    newTargetPath: string,
    oldBaseName: string,
    newBaseName: string,
    ext: string
  ): string {
    let updatedLine = line;

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      // ES6 imports
      updatedLine = updatedLine.replace(
        /(['"])([^'"]+)(['"])/g,
        (match, quote1, importPath, quote2) => {
          const newPath = this.calculateNewImportPath(
            fromFile,
            importPath,
            oldTargetPath,
            newTargetPath,
            oldBaseName,
            newBaseName
          );
          return newPath ? `${quote1}${newPath}${quote2}` : match;
        }
      );
    } else if (ext === '.py') {
      // Python imports
      updatedLine = updatedLine.replace(
        /(from\s+)([\w.]+)(\s+import)/g,
        (match, from, importPath, imp) => {
          const pathWithSlashes = importPath.replace(/\./g, '/');
          const newPath = this.calculateNewImportPath(
            fromFile,
            pathWithSlashes,
            oldTargetPath,
            newTargetPath,
            oldBaseName,
            newBaseName
          );
          if (newPath) {
            const newPathWithDots = newPath.replace(/\//g, '.');
            return `${from}${newPathWithDots}${imp}`;
          }
          return match;
        }
      );

      updatedLine = updatedLine.replace(
        /(import\s+)([\w.]+)/g,
        (match, imp, importPath) => {
          const pathWithSlashes = importPath.replace(/\./g, '/');
          const newPath = this.calculateNewImportPath(
            fromFile,
            pathWithSlashes,
            oldTargetPath,
            newTargetPath,
            oldBaseName,
            newBaseName
          );
          if (newPath) {
            const newPathWithDots = newPath.replace(/\//g, '.');
            return `${imp}${newPathWithDots}`;
          }
          return match;
        }
      );
    }

    return updatedLine;
  }

  /**
   * Calculate the new import path after renaming
   */
  private calculateNewImportPath(
    fromFile: string,
    importPath: string,
    oldTargetPath: string,
    newTargetPath: string,
    oldBaseName: string,
    newBaseName: string
  ): string | null {
    // Check if this import is referencing the old file
    if (!this.isImportingFile(fromFile, importPath, oldTargetPath, oldBaseName)) {
      return null;
    }

    // Handle relative imports
    if (importPath.startsWith('.')) {
      const fromDir = path.dirname(fromFile);
      const newTargetDir = path.dirname(newTargetPath);
      
      // Calculate relative path from fromFile to newTargetPath
      let relativePath = path.relative(fromDir, newTargetPath);
      
      // Ensure it starts with ./ or ../
      if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
      }
      
      // Remove extension if the original import didn't have one
      if (!path.extname(importPath)) {
        relativePath = relativePath.replace(/\.(ts|tsx|js|jsx|py)$/, '');
      }
      
      // Normalize path separators for the platform
      relativePath = relativePath.replace(/\\/g, '/');
      
      return relativePath;
    }

    // For non-relative imports, just replace the basename
    return importPath.replace(oldBaseName, newBaseName);
  }

  /**
   * Refactor: rename a file and update all references
   */
  async refactorRename(oldPath: string, newPath: string): Promise<{
    success: boolean;
    filesUpdated: string[];
    errors: string[];
  }> {
    const filesUpdated: string[] = [];
    const errors: string[] = [];

    try {
      // Find all references to the old file
      const references = await this.findFileReferences(oldPath);
      
      console.log(`Found ${references.length} references to ${oldPath}`);

      // Update all files that reference the old file
      const uniqueFiles = new Set(references.map(ref => ref.filePath));
      
      for (const filePath of uniqueFiles) {
        try {
          await this.updateImportsInFile(filePath, oldPath, newPath);
          filesUpdated.push(filePath);
          console.log(`Updated imports in ${filePath}`);
        } catch (error: any) {
          const errorMsg = `Failed to update ${filePath}: ${error.message}`;
          errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        filesUpdated,
        errors
      };
    } catch (error: any) {
      errors.push(`Refactoring failed: ${error.message}`);
      return {
        success: false,
        filesUpdated,
        errors
      };
    }
  }
}

// Made with Bob