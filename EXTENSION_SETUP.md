# Repomap VS Code Extension - Setup Guide

This guide will help you build and install the Repomap VS Code extension from your existing Node.js application.

## Prerequisites

1. **Node.js 18+** installed
2. **IBM Bob CLI** installed and authenticated
3. **VS Code** installed

## Quick Start

### 1. Install Dependencies

```bash
# Install extension dependencies
cd extension
npm install

# Install webview dependencies
cd ../webview
npm install
```

### 2. Build the Extension

```bash
# Build the webview (React app)
cd webview
npm run build

# Compile the extension (TypeScript)
cd ../extension
npm run compile
```

### 3. Package the Extension

```bash
cd extension
npm run package
```

This creates a `.vsix` file in the `extension/` directory.

### 4. Install in VS Code

**Option A: Via Command Line**
```bash
code --install-extension extension/repomap-vscode-1.0.0.vsix
```

**Option B: Via VS Code UI**
1. Open VS Code
2. Go to Extensions view (Cmd+Shift+X / Ctrl+Shift+X)
3. Click "..." menu → "Install from VSIX..."
4. Select the `.vsix` file from the `extension/` directory

### 5. Use the Extension

1. Open a workspace/folder in VS Code
2. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
3. Run: **"Repomap: Open Panel"**
4. The Repomap panel opens with your codebase visualization!

## Development Mode

For active development with hot reload:

### Terminal 1: Watch Extension
```bash
cd extension
npm run watch
```

### Terminal 2: Watch Webview (Optional)
```bash
cd webview
npm run dev
```

### Terminal 3: Run Extension
1. Open the `extension/` folder in VS Code
2. Press **F5** to launch Extension Development Host
3. In the new window, open a workspace
4. Run "Repomap: Open Panel" command

## Project Structure

```
IBM_BOB/
├── extension/              # VS Code Extension
│   ├── src/
│   │   ├── extension.ts           # Entry point
│   │   ├── webviewProvider.ts     # Webview management
│   │   ├── fileSystemService.ts   # File operations
│   │   ├── bobService.ts          # Bob CLI integration
│   │   └── types.ts               # TypeScript types
│   ├── dist/                      # Compiled JS (generated)
│   ├── package.json
│   └── tsconfig.json
│
├── webview/               # React UI
│   ├── src/
│   │   ├── App.tsx       # Main React component
│   │   ├── main.tsx      # Entry point
│   │   └── index.css     # Styles
│   ├── dist/             # Built assets (generated)
│   ├── package.json
│   └── vite.config.ts
│
├── backend/              # Original backend (not used in extension)
├── frontend/             # Original frontend (not used in extension)
└── EXTENSION_SETUP.md    # This file
```

## Key Differences from Original App

| Original App | VS Code Extension |
|--------------|-------------------|
| Express backend on port 3001 | Extension host (Node.js in VS Code) |
| React frontend on port 5173 | Webview with bundled React |
| HTTP requests | postMessage API |
| GitHub clone / zip upload | Reads from open workspace |
| Stores in `tmp_repos/` | Works directly with workspace files |

## Troubleshooting

### "Cannot find module 'vscode'"
This is expected during development. The `vscode` module is provided by VS Code at runtime.

### "Bob CLI not found"
```bash
# Check if Bob is installed
which bob  # Mac/Linux
where bob  # Windows

# If not found, install Bob and add to PATH
# Then restart VS Code
```

### Webview not loading
```bash
# Rebuild webview
cd webview
rm -rf dist node_modules
npm install
npm run build

# Recompile extension
cd ../extension
npm run compile
```

### Extension not appearing in VS Code
```bash
# Reinstall the extension
cd extension
npm run package
code --install-extension repomap-vscode-1.0.0.vsix --force
```

## Build Commands Reference

### Extension Commands
```bash
cd extension

npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
npm run package      # Create .vsix file
```

### Webview Commands
```bash
cd webview

npm install          # Install dependencies
npm run dev          # Development server (for testing)
npm run build        # Build for production
npm run preview      # Preview production build
```

## Publishing (Optional)

To publish to VS Code Marketplace:

1. Create a publisher account at https://marketplace.visualstudio.com/
2. Get a Personal Access Token
3. Update `publisher` field in `extension/package.json`
4. Run:
```bash
cd extension
npx vsce publish
```

## IBM Bob Configuration

The extension requires Bob CLI to be:
- Installed on the system
- Available in PATH
- Authenticated

Test Bob:
```bash
bob --version
bob auth status
```

## Next Steps

1. ✅ Build and install the extension
2. ✅ Open a workspace in VS Code
3. ✅ Run "Repomap: Open Panel"
4. ✅ Click on files to get AI explanations
5. ✅ Chat with Bob about your code
6. ✅ Apply AI-suggested changes

## Support

For issues or questions:
- Check the troubleshooting section above
- Review VS Code extension logs (Help → Toggle Developer Tools)
- Ensure Bob CLI is working: `bob --version`

---

**Built for IBM Bob Hackathon by Team PRIMATES** 🦍