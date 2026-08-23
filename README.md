# Repomap - AI Codebase Visualizer

Repomap is an AI-powered codebase visualization and editing tool designed to help developers understand and modify their projects faster. Built as a VS Code extension, it provides an interactive graph view of your codebase, AI-powered file explanations, and a chat interface for discussing or applying changes to your code.

## Features

- **Interactive Visual Graph**: Explore your codebase as an interactive SVG graph with pan, zoom, and click-to-select functionality.
- **AI File Explanations**: Get concise, two-sentence summaries of what each file does.
- **Chat with Bob**: Use the IBM Bob-powered chat interface to ask questions about files or request code changes.
- **Apply Changes**: Apply AI-suggested code changes directly to your files with one click.
- **File Tree Sidebar**: Navigate your codebase with a familiar tree view.
- **Context Menu**: Right-click on graph nodes to explain, chat, view content, or rename files.
- **Dark Theme**: Matches VS Code's dark theme with JetBrains Mono font.

---

## Setup Instructions

### Prerequisites

1. **Node.js 18+**: Ensure Node.js is installed on your system.
2. **IBM Bob CLI**: Install and authenticate the IBM Bob CLI for AI features.
3. **VS Code**: Install the latest version of Visual Studio Code.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/lgoyal6/RepoMap.git
   cd RepoMap
   ```

2. Install dependencies:
   ```bash
   # Install extension dependencies
   cd extension
   npm install
   # Install webview dependencies
   cd ../webview
   npm install
   ```

3. Build the project:
   ```bash
   # Build the webview (React app)
   cd webview
   npm run build
   # Compile the extension (TypeScript)
   cd ../extension
   npm run compile
   ```

4. Package the extension:
   ```bash
   npm run package
   ```

5. Install the extension in VS Code:
   ```bash
   code --install-extension repomap-vscode-1.0.0.vsix
   ```

6. Open a workspace in VS Code and run the command:
   ```bash
   Repomap: Open Panel
   ```

---

## Tech Stack

- **VS Code Extension**: TypeScript, VS Code API, React 18, Vite
- **AI**: IBM Bob Shell CLI (one-shot mode with JSON output)
- **Styling**: Inline styles, JetBrains Mono, dark theme

---

## About

Repomap was built for the IBM Bob Hackathon by Team PRIMATES. The challenge was to make software development faster using AI. 

**Winner: Best Use of IBM Bob** 🏆