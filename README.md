# repomap

TEAM: PRIMATES

AI-powered codebase visualization and editing tool for developers, powered by IBM Bob.

**Now available as a VS Code Extension!** 🎉

## 🚀 Quick Start - VS Code Extension (Recommended)

The easiest way to use Repomap is as a VS Code extension. It works directly with your open workspace - no need to clone or upload repos!

### Install & Run

```bash
# Quick setup (builds and packages the extension)
./setup-extension.sh

# Install in VS Code
code --install-extension extension/repomap-vscode-1.0.0.vsix

# Or install via VS Code UI:
# Extensions → "..." menu → "Install from VSIX..." → Select the .vsix file
```

### Usage

1. Open a workspace/folder in VS Code
2. Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
3. Run: **"Repomap: Open Panel"**
4. Explore your codebase with AI-powered insights!

📖 **[Full Extension Setup Guide](EXTENSION_SETUP.md)**

---

## 🌐 Web App (Original)

You can also run Repomap as a standalone web application with GitHub clone and zip upload support.

## Features

- **Interactive SVG Graph** — Visual node map of the entire repo with pan, zoom, and click-to-select
- **AI File Explanations** — Bob explains every file in 2 sentences when you click it
- **Chat with Bob** — Full conversational interface to ask about or modify any file
- **Apply Changes** — Bob can propose code changes and apply them directly to the file
- **Right-Click Context Menu** — Explain, chat, view, or rename files from the graph
- **Dark Theme** — Full dark theme with JetBrains Mono font

### VS Code Extension Features
- Works directly with your open workspace
- No GitHub clone or zip upload needed
- Seamless integration with VS Code
- Changes immediately reflected in editor

### Web App Features
- **GitHub Clone / Zip Upload** — Load any codebase instantly
- Standalone application
- Works with any repository

## Setup - Web App

### Prerequisites

- Node.js 18+
- Git (for cloning repos)
- IBM Bob Shell CLI (`bob`) installed and authenticated

### Backend

```bash
cd backend
npm install
npm run dev
```

Runs on http://localhost:3001

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:5173

## IBM Bob Integration

The backend runs IBM Bob Shell CLI (`bob`) in one-shot mode with JSON output. Bob must be installed and authenticated on the machine running the backend (`bob` available in PATH).

Bob is invoked via:
```
cat prompt.txt | bob -o json --chat-mode ask --hide-intermediary-output
```

Bob powers:
1. **File explanations** — 2-sentence summaries of what each file does
2. **Chat** — Full conversational Q&A about file content with the ability to propose and apply changes

## Architecture

### VS Code Extension
```
repomap-vscode/
├── extension/              # VS Code Extension (TypeScript)
│   ├── src/
│   │   ├── extension.ts           # Entry point
│   │   ├── webviewProvider.ts     # Webview management
│   │   ├── fileSystemService.ts   # File operations
│   │   ├── bobService.ts          # Bob CLI integration
│   │   └── types.ts               # Shared types
│   └── package.json
└── webview/               # React UI (TypeScript + React)
    ├── src/
    │   ├── App.tsx       # Main React component
    │   └── main.tsx      # Entry point
    └── package.json
```

### Web App
```
repomap/
├── backend/          # Express API server (port 3001)
│   └── server.js     # All routes: clone, upload, file read/write, rename, summary
├── frontend/         # React + Vite (port 5173)
│   └── src/App.jsx   # Single-file app: Home, Graph, Chat, Context Menu
├── bob_sessions/     # Drop IBM Bob session exports here
├── tmp_repos/        # Cloned/uploaded repos stored here (gitignored)
└── uploads/          # Temporary upload storage (gitignored)
```

## Tech Stack

- **VS Code Extension**: TypeScript, VS Code API, React 18, Vite
- **Web Backend**: Node.js, Express, multer, unzipper
- **Web Frontend**: React 18, Vite, pure SVG (no graph libraries)
- **AI**: IBM Bob Shell CLI (one-shot mode with JSON output)
- **Styling**: Inline styles, JetBrains Mono, dark theme

## Hackathon

Built for the IBM Bob Hackathon by Team PRIMATES. Challenge: make software development faster using AI.

**Winner: Best Use of IBM Bob** 🏆
