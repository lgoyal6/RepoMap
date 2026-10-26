# Debugging the Repomap VS Code Extension

## Method 1: Extension Development Host (Recommended)

This is the best way to debug because you can set breakpoints and see console logs.

### Steps:

1. **Open the extension folder in VS Code**:
   ```bash
   cd extension
   code .
   ```

2. **Press F5** (or Run → Start Debugging)
   - This launches a new VS Code window called "Extension Development Host"
   - Your extension runs in this window with full debugging support

3. **In the Extension Development Host window**:
   - Open a workspace/folder
   - Run Command: "Repomap: Open Panel"

4. **View Debug Output**:
   - **Extension logs**: Check the DEBUG CONSOLE in the original VS Code window
   - **Webview logs**: In Extension Development Host, go to Help → Toggle Developer Tools
   - Look at the Console tab for JavaScript errors

### Setting Breakpoints:

- Open `extension/src/webviewProvider.ts` or other files
- Click in the gutter to set breakpoints
- When code hits the breakpoint, execution pauses

## Method 2: Check Developer Tools

If the extension is already installed:

1. **Open Repomap panel**
2. **Open Developer Tools**:
   - Help → Toggle Developer Tools
   - Or: Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows/Linux)

3. **Check Console tab** for errors:
   - Look for red error messages
   - Check if assets are loading (Network tab)

4. **Check Sources tab**:
   - See if webview JavaScript is loaded
   - Look for `index.js` in the file tree

## Method 3: Extension Host Logs

Check VS Code's extension host logs:

1. **Command Palette** → "Developer: Show Logs..."
2. Select "Extension Host"
3. Look for errors from the Repomap extension

## Common Issues to Check

### 1. Webview Assets Not Loading

**Check in Developer Tools Console**:
```
Failed to load resource: net::ERR_FILE_NOT_FOUND
```

**Solution**: Verify assets are in the right place:
```bash
ls -la extension/webview-dist/assets/
# Should show: index.js and index.css
```

### 2. Content Security Policy Errors

**Check in Developer Tools Console**:
```
Refused to load the script because it violates the CSP directive
```

**Solution**: Check the CSP in `webviewProvider.ts` line 221

### 3. Extension Not Activating

**Check Extension Host logs** for:
```
Extension 'primates.repomap-vscode' failed to activate
```

**Solution**: Check `extension.ts` activation code

### 4. Webview Shows White/Blank Screen

**Possible causes**:
- Assets not loaded (check Network tab)
- JavaScript error (check Console tab)
- React not mounting (check if `<div id="root">` exists in Elements tab)

## Debug Checklist

Run through this checklist:

```bash
# 1. Check extension is compiled
ls -la extension/dist/
# Should show: extension.js, webviewProvider.js, etc.

# 2. Check webview assets exist
ls -la extension/webview-dist/assets/
# Should show: index.js, index.css

# 3. Check webview HTML
cat extension/webview-dist/index.html
# Should reference /src/main.tsx

# 4. Rebuild everything
cd extension
npm run build:all

# 5. Check for TypeScript errors
npm run compile
```

## Debugging the Webview Specifically

### Add Console Logs to Webview

Edit `webview/src/App.tsx`:

```typescript
export default function App() {
  console.log('🦍 Repomap App mounting...');
  
  useEffect(() => {
    console.log('🦍 App mounted, listening for messages');
    const handler = (event: MessageEvent) => {
      console.log('🦍 Received message:', event.data);
      // ... rest of handler
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);
  
  // ... rest of component
}
```

Then rebuild:
```bash
cd webview
npm run build
cd ../extension
npm run copy:webview
```

### Add Console Logs to Extension

Edit `extension/src/webviewProvider.ts`:

```typescript
public async show() {
  console.log('🦍 RepomapWebviewProvider.show() called');
  
  // ... existing code ...
  
  this.panel.webview.html = this.getWebviewContent(this.panel.webview);
  console.log('🦍 Webview HTML set');
  
  // ... rest of method
}
```

Then recompile:
```bash
cd extension
npm run compile
```

## Quick Debug Commands

```bash
# Rebuild everything
cd extension && npm run build:all

# Watch for changes (auto-recompile)
cd extension && npm run watch

# Check extension is packaged correctly
cd extension && npx vsce ls

# View what's in the VSIX
unzip -l extension/repomap-vscode-1.0.0.vsix
```

## Getting Help

If you're still stuck, provide:

1. **Console errors** from Developer Tools
2. **Extension Host logs** from VS Code
3. **Output** from running:
   ```bash
   ls -la extension/webview-dist/assets/
   ls -la extension/dist/
   ```

## Next Steps

1. Open `extension/` folder in VS Code
2. Press F5 to launch Extension Development Host
3. Open Developer Tools in the Extension Development Host
4. Check Console for errors
5. Report what you see!