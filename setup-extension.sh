#!/bin/bash

# Repomap VS Code Extension - Quick Setup Script
# This script builds and packages the extension

set -e

echo "🦍 Repomap VS Code Extension Setup"
echo "===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Check if Bob is installed
if ! command -v bob &> /dev/null; then
    echo "⚠️  Warning: IBM Bob CLI is not found in PATH"
    echo "   The extension requires Bob to be installed and authenticated."
    echo "   You can continue, but AI features won't work without Bob."
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✅ IBM Bob CLI found: $(bob --version 2>&1 | head -n 1)"
fi

echo ""
echo "📦 Installing dependencies..."
echo ""

# Install extension dependencies
echo "→ Installing extension dependencies..."
cd extension
npm install
cd ..

# Install webview dependencies
echo "→ Installing webview dependencies..."
cd webview
npm install
cd ..

echo ""
echo "🔨 Building the extension..."
echo ""

# Build everything and package
echo "→ Building webview and extension..."
cd extension
npm run build:all

echo "→ Packaging extension..."
npm run package

echo ""
echo "✅ Extension built successfully!"
echo ""
echo "📦 VSIX file created: extension/repomap-vscode-1.0.0.vsix"
echo ""
echo "🚀 To install:"
echo "   1. Open VS Code"
echo "   2. Go to Extensions (Cmd+Shift+X / Ctrl+Shift+X)"
echo "   3. Click '...' menu → 'Install from VSIX...'"
echo "   4. Select: extension/repomap-vscode-1.0.0.vsix"
echo ""
echo "   Or run: code --install-extension extension/repomap-vscode-1.0.0.vsix"
echo ""
echo "📖 Usage:"
echo "   1. Open a workspace in VS Code"
echo "   2. Command Palette (Cmd+Shift+P / Ctrl+Shift+P)"
echo "   3. Run: 'Repomap: Open Panel'"
echo ""
echo "🎉 Happy coding with Repomap!"

# Made with Bob
