import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { BobService } from './bobService';

interface RefactoringResult {
  success: boolean;
  filesUpdated: string[];
  errors: string[];
}

interface FileMapping {
  oldPath: string;
  newPath: string;
}

export class BobRefactoringService {
  private workspaceRoot: string;
  private bobService: BobService;

  constructor() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    this.workspaceRoot = workspaceFolders?.[0]?.uri.fsPath || '';
    this.bobService = new BobService();
  }

  /**
   * Check if a path is a directory
   */
  private async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(filePath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Get all files in a directory recursively
   */
  private async getFilesInDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.vue', '.svelte'];
    
    async function scan(currentPath: string) {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip node_modules and other common ignore patterns
          if (!['node_modules', '.git', 'dist', 'build', '__pycache__'].includes(entry.name)) {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    }
    
    await scan(dirPath);
    return files;
  }

  /**
   * Use Bob to refactor file or folder rename - find and update all references
   */
  async refactorRename(oldPath: string, newPath: string): Promise<RefactoringResult> {
    // Check if this is a directory rename
    const isDir = await this.isDirectory(oldPath);
    
    if (isDir) {
      return this.refactorFolderRename(oldPath, newPath);
    } else {
      return this.refactorFileRename(oldPath, newPath);
    }
  }

  /**
   * Refactor folder rename - handle all files in the folder
   */
  private async refactorFolderRename(oldDirPath: string, newDirPath: string): Promise<RefactoringResult> {
    const filesUpdated: string[] = [];
    const errors: string[] = [];

    try {
      // Get all files in the directory being renamed
      const filesInDir = await this.getFilesInDirectory(oldDirPath);
      
      // Create mapping of old paths to new paths for all files in the directory
      const fileMappings: FileMapping[] = filesInDir.map(filePath => ({
        oldPath: filePath,
        newPath: filePath.replace(oldDirPath, newDirPath)
      }));

      console.log(`Refactoring folder: ${oldDirPath} -> ${newDirPath}`);
      console.log(`Found ${fileMappings.length} files in the folder`);

      // Get all files in the workspace that might reference files in this folder
      const allFiles = await this.getAllRelevantFiles();
      
      // Process files in batches
      const batchSize = 10;
      for (let i = 0; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        
        for (const filePath of batch) {
          try {
            const updated = await this.refactorFileForFolderRename(
              filePath,
              oldDirPath,
              newDirPath,
              fileMappings
            );
            
            if (updated) {
              filesUpdated.push(filePath);
              console.log(`Updated: ${path.relative(this.workspaceRoot, filePath)}`);
            }
          } catch (error: any) {
            const errorMsg = `Failed to update ${path.relative(this.workspaceRoot, filePath)}: ${error.message}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
        }
      }

      return {
        success: errors.length === 0,
        filesUpdated,
        errors
      };
    } catch (error: any) {
      errors.push(`Folder refactoring failed: ${error.message}`);
      return {
        success: false,
        filesUpdated,
        errors
      };
    }
  }

  /**
   * Use Bob to refactor file rename - find and update all references
   */
  private async refactorFileRename(oldPath: string, newPath: string): Promise<RefactoringResult> {
    const filesUpdated: string[] = [];
    const errors: string[] = [];

    try {
      // Get all relevant files in the workspace
      const files = await this.getAllRelevantFiles();
      
      const oldRelPath = path.relative(this.workspaceRoot, oldPath);
      const newRelPath = path.relative(this.workspaceRoot, newPath);
      const oldFileName = path.basename(oldPath);
      const newFileName = path.basename(newPath);

      console.log(`Refactoring: ${oldRelPath} -> ${newRelPath}`);

      // Process files in batches to avoid overwhelming Bob
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        for (const filePath of batch) {
          try {
            const updated = await this.refactorFileWithBob(
              filePath,
              oldPath,
              newPath,
              oldRelPath,
              newRelPath,
              oldFileName,
              newFileName
            );
            
            if (updated) {
              filesUpdated.push(filePath);
              console.log(`Updated: ${path.relative(this.workspaceRoot, filePath)}`);
            }
          } catch (error: any) {
            const errorMsg = `Failed to update ${path.relative(this.workspaceRoot, filePath)}: ${error.message}`;
            errors.push(errorMsg);
            console.error(errorMsg);
          }
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

  /**
   * Use Bob to update a file for folder rename - handles multiple file mappings
   */
  private async refactorFileForFolderRename(
    filePath: string,
    oldDirPath: string,
    newDirPath: string,
    fileMappings: FileMapping[]
  ): Promise<boolean> {
    // Read the file content
    const content = await fs.promises.readFile(filePath, 'utf-8');
    
    const oldDirName = path.basename(oldDirPath);
    const oldDirRelPath = path.relative(this.workspaceRoot, oldDirPath);
    
    // Skip if file doesn't seem to reference the old folder
    if (!this.quickCheck(content, oldDirName, oldDirRelPath)) {
      return false;
    }

    const fileRelPath = path.relative(this.workspaceRoot, filePath);
    const fileDir = path.dirname(filePath);
    
    // Build a list of all file mappings for Bob
    const mappingDescriptions = fileMappings.map(mapping => {
      const oldRel = path.relative(this.workspaceRoot, mapping.oldPath);
      const newRel = path.relative(this.workspaceRoot, mapping.newPath);
      return `  - ${oldRel} → ${newRel}`;
    }).join('\n');

    // Ask Bob to update the file
    const systemPrompt = `You are a code refactoring assistant. A folder has been renamed and you need to update import/require statements that reference files in that folder.

IMPORTANT RULES:
1. ONLY update import/require statements that reference files in the renamed folder
2. Update the import paths to point to the new folder location
3. Preserve all other code exactly as-is
4. If the file doesn't import anything from the renamed folder, return "NO_CHANGES_NEEDED"
5. Return ONLY the updated file content, nothing else

Folder being renamed:
- Old folder: ${oldDirRelPath}
- New folder: ${path.relative(this.workspaceRoot, newDirPath)}

Files in the folder (old → new):
${mappingDescriptions}

Current file location: ${fileRelPath}`;

    const userPrompt = `Update any imports/requires in this file that reference files in the folder "${oldDirRelPath}" to use the new folder path.

File content:
\`\`\`
${content}
\`\`\`

Return the updated file content, or "NO_CHANGES_NEEDED" if no changes are required.`;

    try {
      const response = await this.bobService.askBob({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      const bobResponse = response.content?.[0]?.text || '';
      
      // Check if Bob says no changes needed
      if (bobResponse.includes('NO_CHANGES_NEEDED')) {
        return false;
      }

      // Extract code from Bob's response (handle markdown code blocks)
      let updatedContent = bobResponse;
      const codeBlockMatch = bobResponse.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        updatedContent = codeBlockMatch[1];
      }

      // Verify that the content actually changed
      if (updatedContent.trim() === content.trim()) {
        return false;
      }

      // Write the updated content
      await fs.promises.writeFile(filePath, updatedContent, 'utf-8');
      return true;
    } catch (error: any) {
      console.error(`Bob refactoring error for ${fileRelPath}:`, error);
      throw error;
    }
  }

  /**
   * Use Bob to check if a file needs updating and update it
   */
  private async refactorFileWithBob(
    filePath: string,
    oldAbsPath: string,
    newAbsPath: string,
    oldRelPath: string,
    newRelPath: string,
    oldFileName: string,
    newFileName: string
  ): Promise<boolean> {
    // Read the file content
    const content = await fs.promises.readFile(filePath, 'utf-8');
    
    // Skip if file doesn't seem to reference the old file
    if (!this.quickCheck(content, oldFileName, oldRelPath)) {
      return false;
    }

    const fileRelPath = path.relative(this.workspaceRoot, filePath);
    const fileDir = path.dirname(filePath);
    
    // Calculate relative path from this file to the new location
    const relativeToNew = path.relative(fileDir, newAbsPath);
    const relativePathForImport = relativeToNew.startsWith('.') 
      ? relativeToNew 
      : './' + relativeToNew;

    // Ask Bob to update the file
    const systemPrompt = `You are a code refactoring assistant. A file has been renamed and you need to update import/require statements that reference it.

IMPORTANT RULES:
1. ONLY update import/require statements that reference the old file
2. Update the import path to point to the new file location
3. Preserve all other code exactly as-is
4. If the file doesn't import the renamed file, return "NO_CHANGES_NEEDED"
5. Return ONLY the updated file content, nothing else

File being renamed:
- Old path: ${oldRelPath}
- New path: ${newRelPath}
- Old filename: ${oldFileName}
- New filename: ${newFileName}

Current file location: ${fileRelPath}
Relative import path to new file: ${relativePathForImport.replace(/\\/g, '/')}`;

    const userPrompt = `Update any imports/requires in this file that reference "${oldFileName}" or "${oldRelPath}" to use the new path "${newRelPath}".

File content:
\`\`\`
${content}
\`\`\`

Return the updated file content, or "NO_CHANGES_NEEDED" if no changes are required.`;

    try {
      const response = await this.bobService.askBob({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      });

      const bobResponse = response.content?.[0]?.text || '';
      
      // Check if Bob says no changes needed
      if (bobResponse.includes('NO_CHANGES_NEEDED')) {
        return false;
      }

      // Extract code from Bob's response (handle markdown code blocks)
      let updatedContent = bobResponse;
      const codeBlockMatch = bobResponse.match(/```[\w]*\n([\s\S]*?)```/);
      if (codeBlockMatch) {
        updatedContent = codeBlockMatch[1];
      }

      // Verify that the content actually changed
      if (updatedContent.trim() === content.trim()) {
        return false;
      }

      // Write the updated content
      await fs.promises.writeFile(filePath, updatedContent, 'utf-8');
      return true;
    } catch (error: any) {
      console.error(`Bob refactoring error for ${fileRelPath}:`, error);
      throw error;
    }
  }

  /**
   * Quick check to see if file might reference the renamed file
   */
  private quickCheck(content: string, oldFileName: string, oldRelPath: string): boolean {
    const oldBaseName = path.basename(oldFileName, path.extname(oldFileName));
    
    // Check for common import patterns
    return content.includes(oldFileName) || 
           content.includes(oldBaseName) ||
           content.includes(oldRelPath) ||
           content.includes(`'${oldBaseName}'`) ||
           content.includes(`"${oldBaseName}"`) ||
           content.includes(`from '`) ||
           content.includes(`from "`) ||
           content.includes(`require(`) ||
           content.includes(`import(`);
  }

  /**
   * Get all relevant files that might need updating
   */
  private async getAllRelevantFiles(): Promise<string[]> {
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rs', '.vue', '.svelte'];
    const files: string[] = [];

    const pattern = `**/*{${extensions.join(',')}}`;
    const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

    for (const uri of uris) {
      files.push(uri.fsPath);
    }

    return files;
  }
}

// Made with Bob