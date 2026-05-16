# Repomap VS Code Extension

AI-powered codebase visualization and editing tool powered by IBM Bob.

## Features

- **Interactive Visual Graph** — See your entire codebase as an interactive SVG graph with pan, zoom, and click-to-select
- **AI File Explanations** — Bob explains every file in 2 sentences when you click it
- **Chat with Bob** — Full conversational interface to ask about or modify any file
- **Apply Changes** — Bob can propose code changes and apply them directly to files
- **File Tree Sidebar** — Navigate your codebase with a familiar tree view
- **Right-Click Context Menu** — Explain, chat, view, or rename files from the graph
- **Dark Theme** — Matches VS Code's dark theme with JetBrains Mono font

## Requirements

- **IBM Bob CLI** must be installed and authenticated on your machine
- Bob must be available in your PATH
- Node.js 18+ (for development)

## Installation

### From VSIX

1. Download the `.vsix` file
2. Open VS Code
3. Go to Extensions view (Cmd+Shift+X / Ctrl+Shift+X)
4. Click the "..." menu → "Install from VSIX..."
5. Select the downloaded `.vsix` file

### From Source

```bash
# Install extension dependencies
cd extension
npm install
npm run compile

# Install webview dependencies and build
cd ../webview
npm install
npm run build

# Package the extension
cd ../extension
npm run package
```

This creates a `.vsix` file you can install in VS Code.

## Usage

1. Open a workspace/folder in VS Code
2. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
3. Run command: **"Repomap: Open Panel"**
4. The Repomap panel will open showing your codebase graph
5. Click on files to get AI explanations
6. Switch to "Chat with Bob" tab to have conversations about files
7. Right-click nodes for more options

## IBM Bob Setup

Repomap requires IBM Bob CLI to be installed:

```bash
# Install Bob (follow IBM Bob documentation)
# Authenticate Bob
bob auth login

# Verify Bob is working
bob --version
```

## Architecture

```
repomap-vscode/
├── extension/          # VS Code extension (TypeScript)
│   ├── src/
│   │   ├── extension.ts          # Main entry point
│   │   ├── webviewProvider.ts    # Manages webview
│   │   ├── fileSystemService.ts  # Reads workspace files
│   │   ├── bobService.ts         # Bob CLI integration
│   │   └── types.ts              # Shared types
│   └── package.json
└── webview/           # React UI (TypeScript + React)
    ├── src/
    │   ├── App.tsx    # Main React app
    │   └── main.tsx   # Entry point
    └── package.json
```

## Development

### Watch Mode

Terminal 1 - Extension:
```bash
cd extension
npm run watch
```

Terminal 2 - Webview:
```bash
cd webview
npm run dev
```

Terminal 3 - VS Code:
- Press F5 to launch Extension Development Host
- Run "Repomap: Open Panel" command

### Building

```bash
# Build webview
cd webview
npm run build

# Compile extension
cd ../extension
npm run compile

# Package extension
npm run package
```

## Features in Detail

### Graph View
- Visual representation of your codebase structure
- Color-coded by file type
- Pan and zoom with mouse
- Click files to get AI explanations
- Modified files highlighted in green

### Chat with Bob
- Ask questions about any file
- Request code changes
- Bob provides complete updated file content
- One-click apply changes to files

### Context Menu
- Right-click any node in the graph
- Options: Explain, Chat, View Content, Rename

### File Operations
- Read files from workspace
- Write changes back to workspace
- Rename files and folders
- Changes immediately reflected in VS Code

## Troubleshooting

### "Bob CLI not found"
- Ensure Bob is installed and in your PATH
- Run `which bob` (Mac/Linux) or `where bob` (Windows)
- Restart VS Code after installing Bob

### "No workspace folder open"
- Repomap requires an open workspace
- Use File → Open Folder to open a project

### Webview not loading
- Check VS Code Developer Tools (Help → Toggle Developer Tools)
- Look for errors in the console
- Ensure webview assets were built (`cd webview && npm run build`)

## License

MIT

## Credits

Built for the IBM Bob Hackathon by Team PRIMATES.