import * as path from 'path';
import * as fs from 'fs';

export interface FunctionDef {
  name: string;
  line: number;
  exported: boolean;
}

export interface FileImport {
  importedFile: string;
  importedSymbols: string[];
}

export interface ParsedFile {
  imports: FileImport[];
  functions: FunctionDef[];
}

export class CodeParser {
  async parseFile(filePath: string): Promise<ParsedFile | null> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath);

      const imports = this.extractImports(content, ext);
      const functions = this.extractFunctions(content, ext);

      return { imports, functions };
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error);
      return null;
    }
  }

  extractImports(content: string, ext: string): FileImport[] {
    const imports: FileImport[] = [];

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      imports.push(...this.extractJavaScriptImports(content));
    } else if (ext === '.py') {
      imports.push(...this.extractPythonImports(content));
    } else if (ext === '.go') {
      imports.push(...this.extractGoImports(content));
    } else if (ext === '.java') {
      imports.push(...this.extractJavaImports(content));
    }

    return imports;
  }

  private extractJavaScriptImports(content: string): FileImport[] {
    const imports: FileImport[] = [];

    // ES6 imports: import { x, y } from './file'
    const es6Regex = /import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = es6Regex.exec(content)) !== null) {
      const symbols = match[1] ? match[1].split(',').map(s => s.trim()) : [match[2]];
      imports.push({
        importedFile: match[3],
        importedSymbols: symbols
      });
    }

    // require: const x = require('./file')
    const requireRegex = /(?:const|let|var)\s+(?:{([^}]+)}|(\w+))\s*=\s*require\s*\(['"]([^'"]+)['"]\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const symbols = match[1] ? match[1].split(',').map(s => s.trim()) : [match[2]];
      imports.push({
        importedFile: match[3],
        importedSymbols: symbols
      });
    }

    // Dynamic imports: import('./file')
    const dynamicRegex = /import\s*\(['"]([^'"]+)['"]\)/g;
    while ((match = dynamicRegex.exec(content)) !== null) {
      imports.push({
        importedFile: match[1],
        importedSymbols: []
      });
    }

    return imports;
  }

  private extractPythonImports(content: string): FileImport[] {
    const imports: FileImport[] = [];

    // Python: from module import x, y
    const fromRegex = /from\s+([\w.]+)\s+import\s+([^;\n]+)/g;
    let match;
    while ((match = fromRegex.exec(content)) !== null) {
      const symbols = match[2].split(',').map(s => s.trim());
      imports.push({
        importedFile: match[1].replace(/\./g, '/'),
        importedSymbols: symbols
      });
    }

    // Python: import module
    const importRegex = /^import\s+([\w.]+)/gm;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        importedFile: match[1].replace(/\./g, '/'),
        importedSymbols: []
      });
    }

    return imports;
  }

  private extractGoImports(content: string): FileImport[] {
    const imports: FileImport[] = [];

    // Go: import "package"
    const goRegex = /import\s+(?:\(([^)]+)\)|"([^"]+)")/g;
    let match;
    while ((match = goRegex.exec(content)) !== null) {
      if (match[1]) {
        const packages = match[1].split('\n').map(p => p.trim().replace(/"/g, '')).filter(p => p);
        packages.forEach(pkg => imports.push({ importedFile: pkg, importedSymbols: [] }));
      } else {
        imports.push({ importedFile: match[2], importedSymbols: [] });
      }
    }

    return imports;
  }

  private extractJavaImports(content: string): FileImport[] {
    const imports: FileImport[] = [];

    // Java: import package.Class;
    const javaRegex = /import\s+([\w.]+);/g;
    let match;
    while ((match = javaRegex.exec(content)) !== null) {
      imports.push({
        importedFile: match[1].replace(/\./g, '/'),
        importedSymbols: []
      });
    }

    return imports;
  }

  extractFunctions(content: string, ext: string): FunctionDef[] {
    const functions: FunctionDef[] = [];

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      functions.push(...this.extractJavaScriptFunctions(content));
    } else if (ext === '.py') {
      functions.push(...this.extractPythonFunctions(content));
    } else if (ext === '.go') {
      functions.push(...this.extractGoFunctions(content));
    } else if (ext === '.java') {
      functions.push(...this.extractJavaFunctions(content));
    }

    return functions;
  }

  private extractJavaScriptFunctions(content: string): FunctionDef[] {
    const functions: FunctionDef[] = [];

    // Function declarations: function name(
    const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        line,
        exported: /export/.test(content.substring(Math.max(0, match.index - 20), match.index))
      });
    }

    // Arrow functions: const name = (
    const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
    while ((match = arrowRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        line,
        exported: /export/.test(content.substring(Math.max(0, match.index - 20), match.index))
      });
    }

    // Class methods: methodName(
    const methodRegex = /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*{/g;
    while ((match = methodRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        line,
        exported: false
      });
    }

    // Classes: class Name
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        line,
        exported: /export/.test(content.substring(Math.max(0, match.index - 20), match.index))
      });
    }

    return functions;
  }

  private extractPythonFunctions(content: string): FunctionDef[] {
    const functions: FunctionDef[] = [];

    // Python: def name(
    const defRegex = /def\s+(\w+)\s*\(/g;
    let match;
    while ((match = defRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        line,
        exported: true // Python doesn't have explicit exports
      });
    }

    // Python: class Name:
    const classRegex = /class\s+(\w+)\s*:/g;
    while ((match = classRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        line,
        exported: true
      });
    }

    return functions;
  }

  private extractGoFunctions(content: string): FunctionDef[] {
    const functions: FunctionDef[] = [];

    // Go: func name(
    const funcRegex = /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      const isExported = /^[A-Z]/.test(match[1]); // Go exports start with capital
      functions.push({
        name: match[1],
        line,
        exported: isExported
      });
    }

    return functions;
  }

  private extractJavaFunctions(content: string): FunctionDef[] {
    const functions: FunctionDef[] = [];

    // Java: public/private/protected ... name(
    const methodRegex = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+\s+)?(\w+)\s*\(/g;
    let match;
    while ((match = methodRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        line,
        exported: /public/.test(content.substring(Math.max(0, match.index - 50), match.index))
      });
    }

    // Java: class Name
    const classRegex = /(?:public\s+)?class\s+(\w+)/g;
    while ((match = classRegex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split('\n').length;
      functions.push({
        name: match[1],
        line,
        exported: /public/.test(content.substring(Math.max(0, match.index - 20), match.index))
      });
    }

    return functions;
  }
}

// Made with Bob