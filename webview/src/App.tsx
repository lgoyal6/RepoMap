import React, { useState, useRef, useEffect, useCallback } from 'react';

// VS Code API
const vscode = acquireVsCodeApi();

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface BobMessage {
  role: 'user' | 'assistant';
  content: string;
}

const EXT_COLORS: Record<string, string> = {
  '.ts': '#3b82f6', '.tsx': '#06b6d4', '.js': '#f59e0b', '.jsx': '#f97316',
  '.py': '#10b981', '.go': '#00acd7', '.rs': '#f97316', '.md': '#8b5cf6',
  '.json': '#6b7280', '.yaml': '#6b7280', '.yml': '#6b7280', '.java': '#f44336',
  '.kt': '#7c4dff', '.cs': '#68217a', '.rb': '#cc342d', '.php': '#777bb4',
  '.swift': '#fa7343', '.cpp': '#00599c', '.c': '#a8b9cc', '.h': '#a8b9cc',
};

function getColor(name: string): string {
  const ext = '.' + name.split('.').pop();
  return EXT_COLORS[ext] || '#6b7280';
}

// ===== FILE TREE SIDEBAR =====
function FileTree({ tree, selectedFile, onSelect }: {
  tree: FileNode[];
  selectedFile: string | null;
  onSelect: (node: FileNode) => void;
}) {
  return (
    <div style={{ width: 240, borderRight: '1px solid #1f2937', overflowY: 'auto', padding: '12px 0', flexShrink: 0, height: '100%' }}>
      {tree.map(node => <TreeNode key={node.path} node={node} depth={0} selectedFile={selectedFile} onSelect={onSelect} />)}
    </div>
  );
}

function TreeNode({ node, depth, selectedFile, onSelect }: {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  onSelect: (node: FileNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selectedFile === node.path;

  if (node.type === 'directory') {
    return (
      <div>
        <div onClick={() => setExpanded(!expanded)}
          style={{ padding: '4px 8px', paddingLeft: 12 + depth * 16, cursor: 'pointer', fontSize: 12, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 10 }}>{expanded ? '▼' : '▶'}</span> {node.name}
        </div>
        {expanded && node.children?.map(c => <TreeNode key={c.path} node={c} depth={depth + 1} selectedFile={selectedFile} onSelect={onSelect} />)}
      </div>
    );
  }

  return (
    <div onClick={() => onSelect(node)}
      style={{ padding: '4px 8px', paddingLeft: 20 + depth * 16, cursor: 'pointer', fontSize: 12, color: getColor(node.name), background: isSelected ? 'rgba(99,102,241,0.15)' : 'transparent', borderLeft: isSelected ? '2px solid #6366f1' : '2px solid transparent' }}>
      {node.name}
    </div>
  );
}

// ===== SVG GRAPH =====
function GraphView({ tree, selectedFile, onSelectNode, explanations, modifiedFiles, onContextMenu }: {
  tree: FileNode[];
  selectedFile: string | null;
  onSelectNode: (node: FileNode) => void;
  explanations: Record<string, string>;
  modifiedFiles: Set<string>;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [zoom, setZoom] = useState(0.8);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const nodes: Array<FileNode & { id: number; x: number; y: number }> = [];
  const edges: Array<{ from: number; to: number; fromX: number; fromY: number; toX: number; toY: number }> = [];
  let nodeId = 0;

  function layout(items: FileNode[], parentId: number | null, x: number, y: number, availWidth: number) {
    const spacing = Math.max(160, availWidth / (items.length || 1));
    let startX = x - (items.length - 1) * spacing / 2;

    items.forEach((item, i) => {
      const id = nodeId++;
      const nx = startX + i * spacing;
      const ny = y;
      nodes.push({ id, ...item, x: nx, y: ny });
      if (parentId !== null) edges.push({ from: parentId, to: id, fromX: nodes[parentId].x, fromY: nodes[parentId].y, toX: nx, toY: ny });

      if (item.type === 'directory' && item.children) {
        const children = item.children.slice(0, 12);
        layout(children, id, nx, ny + 120, spacing * 0.9);
      }
    });
  }

  layout(tree.slice(0, 12), null, 600, 60, 1200);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'line') {
      setDragging(true);
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const handleMouseUp = () => setDragging(false);

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <p style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 11, color: '#4b5563', zIndex: 10 }}>scroll to zoom · drag to pan · click to select</p>
      <svg ref={svgRef} width="100%" height="100%"
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {edges.map((e, i) => <line key={i} x1={e.fromX} y1={e.fromY + 20} x2={e.toX} y2={e.toY - 20} stroke="#1f2937" strokeWidth={1} />)}
          {nodes.map(n => {
            const isDir = n.type === 'directory';
            const isSelected = selectedFile === n.path;
            const hasExplanation = explanations[n.path];
            const isModified = modifiedFiles.has(n.path);
            const w = isDir ? 140 : 120;
            const h = isDir ? 40 : 32;
            const color = isDir ? '#312e81' : getColor(n.name);

            return (
              <g key={n.id} onClick={() => onSelectNode(n)} onContextMenu={(e) => onContextMenu(e, n)}
                style={{ cursor: 'pointer' }}>
                <rect x={n.x - w/2} y={n.y - h/2} width={w} height={h} rx={8}
                  fill={isDir ? '#1e1b4b' : '#111827'}
                  stroke={isSelected ? '#6366f1' : isModified ? '#10b981' : hasExplanation ? '#6366f180' : '#1f2937'}
                  strokeWidth={isSelected ? 2 : 1}
                  style={hasExplanation && !isSelected ? { animation: 'pulse 2s infinite' } : {}} />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={10} fill={isDir ? '#818cf8' : color} fontFamily="JetBrains Mono">
                  {n.name.length > 16 ? n.name.slice(0, 14) + '..' : n.name}
                </text>
              </g>
            );
          })}
        </g>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>
      </svg>
    </div>
  );
}

// ===== CHAT PANEL =====
function ChatPanel({ selectedFile, onFileApplied }: {
  selectedFile: string | null;
  onFileApplied: (path: string) => void;
}) {
  const [messages, setMessages] = useState<BobMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevFile = useRef<string | null>(null);

  useEffect(() => {
    if (selectedFile && selectedFile !== prevFile.current) {
      prevFile.current = selectedFile;
      const fileName = selectedFile.split('/').pop();
      setMessages([{ role: 'assistant', content: `I'm looking at **${fileName}**. What would you like to know or change?` }]);
      
      // Request file content
      vscode.postMessage({ type: 'readFile', path: selectedFile });
    }
  }, [selectedFile]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedFile || loading) return;
    const userMsg: BobMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const apiMessages = newMessages.filter(m => m.role === 'user' || m.role === 'assistant');

    vscode.postMessage({
      type: 'askBob',
      system: `You are an expert software engineer analyzing a file in a codebase. Here is the file content:\n\n${fileContent}\n\nHelp the user understand or modify this file. If they ask you to make changes, provide the complete updated file content in a fenced code block.`,
      messages: apiMessages
    });
  };

  const applyCode = async (code: string) => {
    if (!selectedFile) return false;
    vscode.postMessage({
      type: 'writeFile',
      path: selectedFile,
      content: code
    });
    onFileApplied(selectedFile);
    return true;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Listen for messages from extension
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'fileContent' && message.path === selectedFile) {
        setFileContent(message.content);
      } else if (message.type === 'bobResponse') {
        const text = message.content?.[0]?.text || 'Sorry, I could not generate a response.';
        setMessages(prev => [...prev, { role: 'assistant', content: text }]);
        setLoading(false);
      } else if (message.type === 'error') {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${message.message}` }]);
        setLoading(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [selectedFile]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} onApply={applyCode} />
        ))}
        {loading && <div style={{ padding: 12, color: '#818cf8', fontSize: 13 }}>
          <span style={{ animation: 'pulse 1s infinite' }}>●</span>{' '}
          <span style={{ animation: 'pulse 1s infinite 0.2s' }}>●</span>{' '}
          <span style={{ animation: 'pulse 1s infinite 0.4s' }}>●</span>
        </div>}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: 16, borderTop: '1px solid #1f2937' }}>
        {selectedFile ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Ask Bob about this file..."
              rows={2}
              style={{ flex: 1, padding: '10px 14px', background: '#0a0a1a', border: '1px solid #1f2937', borderRadius: 8, color: '#e5e7eb', fontFamily: 'inherit', fontSize: 13, resize: 'none', outline: 'none' }} />
            <button onClick={sendMessage} disabled={loading}
              style={{ padding: '10px 16px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, alignSelf: 'flex-end' }}>
              Send
            </button>
          </div>
        ) : (
          <input disabled placeholder="Select a file first" style={{ width: '100%', padding: '10px 14px', background: '#0a0a1a', border: '1px solid #1f2937', borderRadius: 8, color: '#6b7280', fontFamily: 'inherit', fontSize: 13 }} />
        )}
      </div>
    </div>
  );
}

function MessageBubble({ message, onApply }: {
  message: BobMessage;
  onApply: (code: string) => Promise<boolean>;
}) {
  const [applied, setApplied] = useState(false);
  const isUser = message.role === 'user';

  // Extract code block
  const codeMatch = message.content.match(/```[\w]*\n([\s\S]*?)```/);
  const textContent = message.content.replace(/```[\w]*\n[\s\S]*?```/g, '').trim();

  const handleApply = async () => {
    if (codeMatch) {
      const success = await onApply(codeMatch[1]);
      if (success) setApplied(true);
    }
  };

  return (
    <div style={{ marginBottom: 16, display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: 12, background: isUser ? '#312e81' : '#111827', border: `1px solid ${isUser ? '#4338ca' : '#1f2937'}`, fontSize: 13, lineHeight: 1.5 }}>
        <p style={{ whiteSpace: 'pre-wrap' }}>{textContent}</p>
        {codeMatch && (
          <div style={{ marginTop: 10, padding: 12, background: '#0a0a1a', borderRadius: 8, border: '1px solid #1f2937' }}>
            <p style={{ fontSize: 11, color: '#818cf8', marginBottom: 6 }}>Proposed change</p>
            <pre style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', maxHeight: 100 }}>{codeMatch[1].slice(0, 300)}</pre>
            <button onClick={handleApply} disabled={applied}
              style={{ marginTop: 8, padding: '6px 12px', background: applied ? '#10b981' : '#6366f1', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontFamily: 'inherit', cursor: applied ? 'default' : 'pointer' }}>
              {applied ? '✓ Applied' : 'Apply to file'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== CONTEXT MENU =====
function ContextMenu({ x, y, node, onClose, onExplain, onChat, onViewContent, onRename }: {
  x: number;
  y: number;
  node: FileNode;
  onClose: () => void;
  onExplain: () => void;
  onChat: () => void;
  onViewContent: () => void;
  onRename: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const clickHandler = () => onClose();
    document.addEventListener('keydown', handler);
    document.addEventListener('click', clickHandler);
    return () => { document.removeEventListener('keydown', handler); document.removeEventListener('click', clickHandler); };
  }, [onClose]);

  const items = [
    { label: 'Explain with Bob', action: onExplain },
    { label: 'Talk with Bob', action: onChat },
    { label: 'View file content', action: onViewContent },
    { label: 'Rename', action: onRename },
  ];

  return (
    <div style={{ position: 'fixed', left: x, top: y, background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 4, zIndex: 1000, minWidth: 160 }}>
      {items.map(item => (
        <div key={item.label} onClick={(e) => { e.stopPropagation(); item.action(); onClose(); }}
          style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', borderRadius: 4, color: '#e5e7eb' }}
          onMouseEnter={e => (e.target as HTMLDivElement).style.background = '#312e81'}
          onMouseLeave={e => (e.target as HTMLDivElement).style.background = 'transparent'}>
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ===== FILE MODAL =====
function FileModal({ content, filePath, onClose }: {
  content: string;
  filePath: string;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 24, maxWidth: '80vw', maxHeight: '80vh', overflow: 'auto', width: 700 }}>
        <p style={{ fontSize: 13, color: '#818cf8', marginBottom: 12 }}>{filePath}</p>
        <pre style={{ fontSize: 12, color: '#e5e7eb', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{content}</pre>
      </div>
    </div>
  );
}

// ===== RENAME INPUT =====
function RenameInput({ node, onDone }: {
  node: FileNode;
  onDone: () => void;
}) {
  const [value, setValue] = useState(node.name);

  const handleSubmit = async () => {
    const dir = node.path.includes('/') ? node.path.split('/').slice(0, -1).join('/') + '/' : '';
    const newPath = dir + value;
    if (newPath !== node.path) {
      vscode.postMessage({
        type: 'renameFile',
        oldPath: node.path,
        newPath
      });
    }
    onDone();
  };

  return (
    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 20, zIndex: 1000 }}>
      <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>Rename: {node.path}</p>
      <input value={value} onChange={e => setValue(e.target.value)} autoFocus
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onDone(); }}
        style={{ padding: '8px 12px', background: '#0a0a1a', border: '1px solid #1f2937', borderRadius: 6, color: '#e5e7eb', fontFamily: 'inherit', fontSize: 13, width: 300, outline: 'none' }} />
    </div>
  );
}

// ===== MAIN APP =====
export default function App() {
  console.log('🦍 Repomap App component rendering');
  
  const [tree, setTree] = useState<FileNode[] | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'graph' | 'chat'>('graph');
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [modifiedFiles, setModifiedFiles] = useState(new Set<string>());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null);
  const [fileModal, setFileModal] = useState<{ content: string; filePath: string } | null>(null);
  const [renameNode, setRenameNode] = useState<FileNode | null>(null);

  // Listen for messages from extension
  useEffect(() => {
    console.log('🦍 Setting up message listener');
    const handler = (event: MessageEvent) => {
      console.log('🦍 Received message from extension:', event.data);
      const message = event.data;
      
      switch (message.type) {
        case 'workspaceLoaded':
          setTree(message.tree);
          setWorkspaceName(message.workspaceName);
          break;
        case 'fileContent':
          if (message.path === selectedFile && !explanations[message.path]) {
            // This is for explanation
            explainFileWithContent(message.path, message.content);
          }
          break;
        case 'bobResponse':
          if (explanationLoading) {
            const text = message.content?.[0]?.text || 'Could not analyze file.';
            if (selectedFile) {
              setExplanations(prev => ({ ...prev, [selectedFile]: text }));
            }
            setExplanationLoading(false);
          }
          break;
        case 'fileWritten':
          if (message.success && message.path) {
            setModifiedFiles(prev => new Set([...prev, message.path]));
          }
          break;
        case 'fileRenamed':
          if (message.success) {
            // Reload workspace
            vscode.postMessage({ type: 'loadWorkspace' });
          }
          break;
        case 'error':
          console.error('Extension error:', message.message);
          setExplanationLoading(false);
          break;
      }
    };
    
    window.addEventListener('message', handler);
    console.log('🦍 Message listener attached');
    return () => {
      console.log('🦍 Message listener removed');
      window.removeEventListener('message', handler);
    };
  }, [selectedFile, explanations, explanationLoading]);

  // Request workspace on mount
  useEffect(() => {
    console.log('🦍 App mounted, requesting workspace load');
    vscode.postMessage({ type: 'loadWorkspace' });
  }, []);

  const explainFileWithContent = (path: string, content: string) => {
    vscode.postMessage({
      type: 'askBob',
      system: 'You are an expert software engineer. Give concise, clear explanations.',
      messages: [{ role: 'user', content: `In 2 sentences max, what does this file do? File: ${path}\n\n${content}` }]
    });
  };

  const explainFile = async (node: FileNode) => {
    if (node.type === 'directory') return;
    setSelectedFile(node.path);
    if (explanations[node.path]) return;

    setExplanationLoading(true);
    vscode.postMessage({ type: 'readFile', path: node.path });
  };

  const handleNodeClick = (node: FileNode) => {
    if (node.type === 'file') explainFile(node);
    else setSelectedFile(node.path);
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleViewContent = async (node: FileNode) => {
    vscode.postMessage({ type: 'readFile', path: node.path });
    
    // Listen for the response
    const handler = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'fileContent' && message.path === node.path) {
        setFileModal({ content: message.content, filePath: node.path });
        window.removeEventListener('message', handler);
      }
    };
    window.addEventListener('message', handler);
  };

  const handleRenameComplete = () => {
    setRenameNode(null);
  };

  const handleFileApplied = (path: string) => {
    setModifiedFiles(prev => new Set([...prev, path]));
  };

  const handleSidebarSelect = (node: FileNode) => {
    if (node.type === 'file') explainFile(node);
  };

  if (!tree) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column' }}>
        <h2 style={{ color: '#818cf8', marginBottom: 16 }}>Loading workspace...</h2>
        <p style={{ color: '#6b7280', fontSize: 13 }}>Analyzing your codebase</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Navbar */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 48, borderBottom: '1px solid #1f2937', background: '#0a0a1a', gap: 16, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>repomap</span>
        <span style={{ color: '#6b7280', fontSize: 12 }}>{workspaceName}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setActiveTab('graph')}
          style={{ padding: '6px 14px', background: activeTab === 'graph' ? '#312e81' : 'transparent', border: '1px solid #1f2937', borderRadius: 6, color: activeTab === 'graph' ? '#818cf8' : '#9ca3af', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
          Graph
        </button>
        <button onClick={() => setActiveTab('chat')}
          style={{ padding: '6px 14px', background: activeTab === 'chat' ? '#312e81' : 'transparent', border: '1px solid #1f2937', borderRadius: 6, color: activeTab === 'chat' ? '#818cf8' : '#9ca3af', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
          Chat with Bob
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <FileTree tree={tree} selectedFile={selectedFile} onSelect={handleSidebarSelect} />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {activeTab === 'graph' ? (
            <>
              <GraphView tree={tree} selectedFile={selectedFile} onSelectNode={handleNodeClick}
                explanations={explanations} modifiedFiles={modifiedFiles} onContextMenu={handleContextMenu} />

              {/* Explanation card */}
              {selectedFile && explanations[selectedFile] && (
                <div style={{ position: 'absolute', bottom: 20, left: 20, background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16, maxWidth: 360, zIndex: 10 }}>
                  <p style={{ fontSize: 12, color: getColor(selectedFile.split('/').pop() || ''), marginBottom: 4, fontWeight: 600 }}>
                    {selectedFile.split('/').pop()}
                  </p>
                  <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{selectedFile}</p>
                  <p style={{ fontSize: 12, color: '#e5e7eb', lineHeight: 1.5 }}>{explanations[selectedFile]}</p>
                  <button onClick={() => { setActiveTab('chat'); }}
                    style={{ marginTop: 10, padding: '6px 12px', background: '#312e81', border: 'none', borderRadius: 6, color: '#818cf8', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer' }}>
                    Talk with Bob about this file
                  </button>
                </div>
              )}

              {explanationLoading && (
                <div style={{ position: 'absolute', bottom: 20, left: 20, background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16, zIndex: 10 }}>
                  <p style={{ fontSize: 12, color: '#818cf8' }}>Bob is analyzing...</p>
                </div>
              )}
            </>
          ) : (
            <ChatPanel selectedFile={selectedFile} onFileApplied={handleFileApplied} />
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onExplain={() => explainFile(contextMenu.node)}
          onChat={() => { setSelectedFile(contextMenu.node.path); setActiveTab('chat'); }}
          onViewContent={() => handleViewContent(contextMenu.node)}
          onRename={() => setRenameNode(contextMenu.node)} />
      )}

      {/* File Modal */}
      {fileModal && <FileModal content={fileModal.content} filePath={fileModal.filePath} onClose={() => setFileModal(null)} />}

      {/* Rename Input */}
      {renameNode && <RenameInput node={renameNode} onDone={handleRenameComplete} />}
    </div>
  );
}

// Made with Bob
