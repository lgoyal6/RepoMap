import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { createReadStream } from 'fs';
import unzipper from 'unzipper';
import crypto from 'crypto';

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: path.resolve('../uploads') });

const TMP_DIR = path.resolve('../tmp_repos');

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', '.next', 'coverage', '.DS_Store']);

const ALLOWED_EXT = new Set([
  '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.kt', '.cs',
  '.rb', '.php', '.swift', '.cpp', '.c', '.h', '.md', '.json', '.yaml', '.yml',
  '.toml', '.sql', '.graphql', '.sh', '.bash', '.proto', '.env.example'
]);
const ALLOWED_NAMES = new Set(['Makefile', 'Dockerfile']);

function sanitizePath(base, filePath) {
  const resolved = path.resolve(base, filePath);
  if (!resolved.startsWith(base)) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

function shouldInclude(name) {
  if (ALLOWED_NAMES.has(name)) return true;
  const ext = path.extname(name);
  return ALLOWED_EXT.has(ext);
}

async function buildTree(dirPath, relativePath = '') {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (IGNORED.has(entry.name)) continue;

    const fullPath = path.join(dirPath, entry.name);
    const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, relPath);
      if (children.length > 0) {
        result.push({ name: entry.name, path: relPath, type: 'directory', children });
      }
    } else if (shouldInclude(entry.name)) {
      result.push({ name: entry.name, path: relPath, type: 'file' });
    }
  }

  return result.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'directory' ? -1 : 1;
  });
}

// POST /api/repo/github
app.post('/api/repo/github', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.match(/^https?:\/\//)) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const repoId = crypto.randomUUID();
    const dest = path.join(TMP_DIR, repoId);
    await fs.mkdir(dest, { recursive: true });

    await execAsync(`git clone --depth=1 "${url}" "${dest}"`, { timeout: 60000 });

    const tree = await buildTree(dest);
    res.json({ tree, repoId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repo/upload
app.post('/api/repo/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const repoId = crypto.randomUUID();
    const dest = path.join(TMP_DIR, repoId);
    await fs.mkdir(dest, { recursive: true });

    await new Promise((resolve, reject) => {
      createReadStream(req.file.path)
        .pipe(unzipper.Extract({ path: dest }))
        .on('close', resolve)
        .on('error', reject);
    });

    // Handle single root folder case
    const entries = await fs.readdir(dest);
    if (entries.length === 1) {
      const single = path.join(dest, entries[0]);
      const stat = await fs.stat(single);
      if (stat.isDirectory()) {
        const innerEntries = await fs.readdir(single);
        for (const e of innerEntries) {
          await fs.rename(path.join(single, e), path.join(dest, e));
        }
        await fs.rmdir(single);
      }
    }

    // Cleanup uploaded file
    await fs.unlink(req.file.path).catch(() => {});

    const tree = await buildTree(dest);
    res.json({ tree, repoId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/repo/:repoId/file
app.get('/api/repo/:repoId/file', async (req, res) => {
  try {
    const { repoId } = req.params;
    const { filePath } = req.query;
    if (!filePath) return res.status(400).json({ error: 'filePath required' });

    const base = path.join(TMP_DIR, repoId);
    const fullPath = sanitizePath(base, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    res.json({ content: content.slice(0, 8000) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repo/:repoId/file
app.post('/api/repo/:repoId/file', async (req, res) => {
  try {
    const { repoId } = req.params;
    const { filePath, content } = req.body;
    if (!filePath || content === undefined) return res.status(400).json({ error: 'filePath and content required' });

    const base = path.join(TMP_DIR, repoId);
    const fullPath = sanitizePath(base, filePath);
    await fs.writeFile(fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/repo/:repoId/rename
app.post('/api/repo/:repoId/rename', async (req, res) => {
  try {
    const { repoId } = req.params;
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) return res.status(400).json({ error: 'oldPath and newPath required' });

    const base = path.join(TMP_DIR, repoId);
    const fullOld = sanitizePath(base, oldPath);
    const fullNew = sanitizePath(base, newPath);
    await fs.rename(fullOld, fullNew);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/repo/:repoId/summary
app.get('/api/repo/:repoId/summary', async (req, res) => {
  try {
    const { repoId } = req.params;
    const base = path.join(TMP_DIR, repoId);
    const tree = await buildTree(base);

    const files = [];
    function collectFiles(nodes) {
      for (const node of nodes) {
        if (files.length >= 30) return;
        if (node.type === 'file') files.push(node.path);
        else if (node.children) collectFiles(node.children);
      }
    }
    collectFiles(tree);

    const summaries = [];
    for (const fp of files) {
      try {
        const content = await fs.readFile(path.join(base, fp), 'utf-8');
        summaries.push({ path: fp, preview: content.slice(0, 500) });
      } catch { /* skip unreadable */ }
    }

    res.json({ tree, files: summaries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bob integration — runs Bob CLI in one-shot mode
app.post('/api/bob', async (req, res) => {
  try {
    const { system, messages } = req.body;

    // Build a single prompt from system + messages
    let prompt = '';
    if (system) prompt += system + '\n\n';
    for (const msg of messages) {
      if (msg.role === 'user') prompt += `User: ${msg.content}\n`;
      else if (msg.role === 'assistant') prompt += `Assistant: ${msg.content}\n`;
    }

    // Escape for shell safety — write to a temp file instead
    const tmpFile = path.join(TMP_DIR, `prompt-${crypto.randomUUID()}.txt`);
    await fs.mkdir(TMP_DIR, { recursive: true });
    await fs.writeFile(tmpFile, prompt, 'utf-8');

    const { stdout, stderr } = await execAsync(
      `cat "${tmpFile}" | bob -o json --chat-mode ask --hide-intermediary-output`,
      { timeout: 120000, maxBuffer: 1024 * 1024 * 5 }
    );

    // Clean up temp file
    await fs.unlink(tmpFile).catch(() => {});

    // Bob outputs the response text first, then JSON stats
    // Extract the text before the JSON block
    const jsonStart = stdout.indexOf('\n{');
    const textResponse = jsonStart !== -1 ? stdout.slice(0, jsonStart).trim() : stdout.trim();

    // Return in the same shape the frontend expects
    res.json({
      content: [{ type: 'text', text: textResponse }]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`repomap backend running on port ${PORT}`);
});
