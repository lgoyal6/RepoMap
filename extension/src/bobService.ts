import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { BobRequest, BobResponse } from './types';

const execAsync = promisify(exec);

export class BobService {
  async askBob(request: BobRequest): Promise<BobResponse> {
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

      // Write prompt to a temp file for safety
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, `repomap-prompt-${Date.now()}.txt`);
      await fs.writeFile(tmpFile, prompt, 'utf-8');

      try {
        // Execute Bob CLI
        const { stdout } = await execAsync(
          `cat "${tmpFile}" | bob -o json --chat-mode ask --hide-intermediary-output`,
          { 
            timeout: 120000, 
            maxBuffer: 1024 * 1024 * 5 
          }
        );

        // Clean up temp file
        await fs.unlink(tmpFile).catch(() => {});

        // Bob outputs the response text first, then JSON stats
        // Extract the text before the JSON block
        const jsonStart = stdout.indexOf('\n{');
        const textResponse = jsonStart !== -1 ? stdout.slice(0, jsonStart).trim() : stdout.trim();

        return {
          content: [{ type: 'text', text: textResponse }]
        };
      } catch (execError: any) {
        // Clean up temp file on error
        await fs.unlink(tmpFile).catch(() => {});
        throw new Error(`Bob CLI error: ${execError.message}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to execute Bob: ${error.message}`);
    }
  }

  async checkBobAvailable(): Promise<boolean> {
    try {
      await execAsync('bob --v', { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  }
}

// Made with Bob
