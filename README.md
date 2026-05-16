# repomap

TEAM: PRIMATES

AI-powered codebase visualization and editing tool for developers, powered by IBM Bob.

Drop any GitHub repo or zip file and instantly get an interactive visual map of the entire codebase, with AI-generated explanations for every file and the ability to chat with Bob about any file and apply changes directly.

## Features

- **GitHub Clone / Zip Upload** — Load any codebase instantly
- **Interactive SVG Graph** — Visual node map of the entire repo with pan, zoom, and click-to-select
- **AI File Explanations** — Bob explains every file in 2 sentences when you click it
- **Chat with Bob** — Full conversational interface to ask about or modify any file
- **Apply Changes** — Bob can propose code changes and apply them directly to the file
- **Right-Click Context Menu** — Explain, chat, view, or rename files from the graph
- **Dark Theme** — Full dark theme with JetBrains Mono font

## Setup

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

- **Backend**: Node.js, Express, multer, unzipper
- **Frontend**: React 18, Vite, pure SVG (no graph libraries)
- **AI**: IBM Bob Shell CLI (one-shot mode with JSON output)
- **Styling**: Inline styles, JetBrains Mono, dark theme

## Hackathon

Built for the IBM Bob Hackathon. Challenge: make software development faster using AI.
