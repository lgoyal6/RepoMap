import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { BobRequest, BobResponse } from './types';
import * as vscode from 'vscode';

const execAsync = promisify(exec);

export class BobService {
  async askBob(request: BobRequest, timeoutMs: number = 300000): Promise<BobResponse> {
    try {
      // Build a single prompt from system + messages
      let prompt = '';
      if (request.system) {
        prompt += request.system + '\n\n';
      }
      
      for (const msg of request.messages) {
        if (msg.role === 'user') {
          prompt += `User: ${msg.content}\n`;
        } else if (msg.role === 'assistant') {
          prompt += `Assistant: ${msg.content}\n`;
        }
      }

      // Use spawn to pipe content directly to Bob (cross-platform solution)
      return new Promise((resolve, reject) => {
        // On Windows, we need to use shell to execute bob (which is a PowerShell script)
        const isWindows = process.platform === 'win32';
        
        // Remove --hide-intermediary-output as it may cause output truncation
        // Use --chat-mode ask for direct response
        const bobProcess = spawn('bob', ['--chat-mode', 'ask'], {
          cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath,
          shell: isWindows, // Enable shell on Windows to execute .ps1 scripts
          stdio: ['pipe', 'pipe', 'pipe'] // Explicitly set stdio
        });

        let stdout = '';
        let stderr = '';
        let timeoutHandle: NodeJS.Timeout | null = null;
        let isTimedOut = false;

        // Manual timeout handling (more reliable than spawn's timeout option)
        timeoutHandle = setTimeout(() => {
          isTimedOut = true;
          bobProcess.kill('SIGTERM');
          reject(new Error(`Bob process timed out after ${timeoutMs}ms. Try reducing the number of files or prompt size.`));
        }, timeoutMs);

        bobProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          stdout += chunk;
          console.log(`Bob stdout chunk (${chunk.length} bytes)`);
        });

        bobProcess.stderr.on('data', (data) => {
          const chunk = data.toString();
          stderr += chunk;
          console.log(`Bob stderr chunk (${chunk.length} bytes)`);
          console.warn(`Bob stderr: ${chunk}`);
        });

        bobProcess.on('error', (error) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          if (!isTimedOut) {
            reject(new Error(`Failed to spawn Bob process: ${error.message}`));
          }
        });

        bobProcess.on('close', (code) => {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          
          if (isTimedOut) {
            return; // Already rejected by timeout
          }

          if (code !== 0 && code !== null) {
            reject(new Error(`Bob CLI error: Process exited with code ${code}. stderr: ${stderr}`));
            return;
          }

          // code === null means process was killed (possibly by timeout or system)
          if (code === null) {
            reject(new Error(`Bob process was terminated unexpectedly. This may indicate a timeout or system resource issue. stderr: ${stderr}`));
            return;
          }

          try {
            console.log(`Bob total stdout length: ${stdout.length} bytes`);
            console.log(`Bob stdout first 500 chars:`, stdout.substring(0, 500));
            console.log(`Bob stdout last 500 chars:`, stdout.substring(Math.max(0, stdout.length - 500)));
            
            // Bob may output JSON stats at the end after the actual response
            // Look for the last occurrence of a JSON stats block (starts with newline + {)
            // But we want to keep the actual response content
            
            let textResponse = stdout.trim();
            
            // Try to find and remove JSON stats block at the end
            // Stats typically look like: \n{"model": "...", "usage": {...}}
            const statsPattern = /\n\{["\s]*(?:model|usage|finish_reason)["\s]*:/;
            const statsMatch = stdout.match(statsPattern);
            
            if (statsMatch && statsMatch.index !== undefined) {
              // Found stats block, extract everything before it
              textResponse = stdout.slice(0, statsMatch.index).trim();
              console.log(`Removed stats block, response length: ${textResponse.length}`);
            }

            resolve({
              content: [{ type: 'text', text: textResponse }]
            });
          } catch (parseError: any) {
            reject(new Error(`Failed to parse Bob response: ${parseError.message}`));
          }
        });

        // Write the prompt to stdin and close it
        bobProcess.stdin.write(prompt);
        bobProcess.stdin.end();
      });
    } catch (error: any) {
      throw new Error(`Failed to execute Bob: ${error.message}`);
    }
  }

  async checkBobAvailable(): Promise<boolean> {
    try {
      // On Windows, use shell to execute bob (PowerShell script)
      const isWindows = process.platform === 'win32';
      const options: any = { timeout: 15000 };
      if (isWindows) {
        options.shell = true;
      }
      await execAsync('bob --v', options);
      return true;
    } catch {
      return false;
    }
  }
}

// Made with Bob
