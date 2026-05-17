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

interface DependencyNode {
  id: string;
  name: string;
  type: 'folder' | 'file' | 'function';
  filePath: string;
  line?: number;
  children?: DependencyNode[];
}

interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls';
}

interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

const EXT_COLORS: Record<string, string> = {
  '.ts': '#3b82f6', '.tsx': '#06b6d4', '.js': '#f59e0b', '.jsx': '#f97316',
  '.py': '#10b981', '.go': '#00acd7', '.rs': '#f97316', '.md': '#8b5cf6',
  '.json': '#6b7280', '.yaml': '#6b7280', '.yml': '#6b7280', '.java': '#f44336',
  '.kt': '#7c4dff', '.cs': '#68217a', '.rb': '#cc342d', '.php': '#777bb4',
  '.swift': '#fa7343', '.cpp': '#00599c', '.c': '#a8b9cc', '.h': '#a8b9cc',
  '.css': '#264de4', '.scss': '#cd6799', '.html': '#e34c26', '.vue': '#42b883',
  '.sql': '#e38c00', '.sh': '#89e051', '.bash': '#89e051',
};

const EXT_LABELS: Record<string, string> = {
  '.ts': 'TS', '.tsx': 'TSX', '.js': 'JS', '.jsx': 'JSX',
  '.py': 'PY', '.go': 'GO', '.rs': 'RS', '.md': 'MD',
  '.json': 'JSON', '.yaml': 'YAML', '.yml': 'YML', '.java': 'JAVA',
  '.kt': 'KT', '.cs': 'C#', '.rb': 'RB', '.php': 'PHP',
  '.swift': 'SW', '.cpp': 'C++', '.c': 'C', '.h': 'H',
  '.css': 'CSS', '.scss': 'SCSS', '.html': 'HTML', '.vue': 'VUE',
  '.sql': 'SQL', '.sh': 'SH', '.bash': 'BASH',
};

function getColor(name: string): string {
  const ext = '.' + name.split('.').pop();
  return EXT_COLORS[ext] || '#6b7280';
}

function getExtLabel(name: string): string | null {
  const ext = '.' + name.split('.').pop();
  return EXT_LABELS[ext] || null;
}

// Darken a hex color to use as a subtle background tint
function tintBg(hex: string, opacity: number = 0.12): string {
  return hex + Math.round(opacity * 255).toString(16).padStart(2, '0');
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

// ===== GRAPH NODE COMPONENT =====
function GraphNode({ x, y, width, height, name, nodeType, color, fillColor, isSelected, isHovered, isDimmed, opacity: opacityProp, strokeColor, onClick, onContextMenu, onMouseEnter, onMouseLeave, showExpandArrow, isExpanded, badge, subtitle, animate }: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  nodeType: 'directory' | 'file' | 'function' | 'folder';
  color: string;
  fillColor: string;
  isSelected?: boolean;
  isHovered?: boolean;
  isDimmed?: boolean;
  opacity?: number;
  strokeColor?: string;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  showExpandArrow?: boolean;
  isExpanded?: boolean;
  badge?: string | null;
  subtitle?: string | null;
  animate?: boolean;
}) {
  const finalOpacity = isDimmed ? 0.2 : (opacityProp ?? 1);
  const finalStroke = isSelected ? '#818cf8' : isHovered ? '#6366f1' : (strokeColor || '#1f2937');
  const finalStrokeWidth = isSelected || isHovered ? 2 : 1;
  const maxChars = nodeType === 'folder' ? 20 : nodeType === 'file' ? 14 : 12;
  const truncated = name.length > maxChars ? name.slice(0, maxChars - 2) + '..' : name;
  const fontSize = nodeType === 'function' ? 9 : nodeType === 'folder' ? 11 : 10;
  const isFile = nodeType === 'file';
  const rx = nodeType === 'function' ? 4 : 8;

  // Color accent bar on left for files
  const accentWidth = 3;

  return (
    <g onClick={onClick} onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
      style={{ cursor: 'pointer' }}
      opacity={finalOpacity}>
      {/* Main rect */}
      <rect x={x - width/2} y={y - height/2} width={width} height={height} rx={rx}
        fill={fillColor}
        stroke={finalStroke}
        strokeWidth={finalStrokeWidth}
        style={animate ? { animation: 'pulse 2s infinite' } : {}} />
      {/* Color accent bar for files */}
      {isFile && (
        <rect x={x - width/2} y={y - height/2 + rx} width={accentWidth} height={height - rx * 2}
          fill={color} rx={1} />
      )}
      {/* Language badge for files */}
      {isFile && badge && (
        <>
          <rect x={x + width/2 - 24} y={y - height/2 + 4} width={20} height={12} rx={3}
            fill={tintBg(color, 0.25)} />
          <text x={x + width/2 - 14} y={y - height/2 + 13} textAnchor="middle"
            fontSize={7} fill={color} fontFamily="JetBrains Mono" fontWeight={600}>
            {badge}
          </text>
        </>
      )}
      {/* Label */}
      <text x={x} y={y + (subtitle ? -1 : 4)} textAnchor="middle"
        fontSize={fontSize} fill={color} fontFamily="JetBrains Mono" fontWeight={isFile ? 500 : 400}>
        {truncated}
      </text>
      {/* Subtitle (line number for functions) */}
      {subtitle && (
        <text x={x} y={y + 12} textAnchor="middle" fontSize={7} fill="#6b7280">
          {subtitle}
        </text>
      )}
      {/* Expand arrow */}
      {showExpandArrow && (
        <text x={x + width/2 - 10} y={y + 4} fontSize={8} fill="#818cf8">
          {isExpanded ? '▼' : '▶'}
        </text>
      )}
    </g>
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
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'line' || (e.target as SVGElement).tagName === 'path') {
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
        <defs>
          <marker id="arrow-tree" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <path d="M0,0 L8,3 L0,6" fill="none" stroke="#2d3748" strokeWidth={1} />
          </marker>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {edges.map((e, i) => {
            const fromH = 20;
            const toH = 16;
            const x1 = e.fromX;
            const y1 = e.fromY + fromH;
            const x2 = e.toX;
            const y2 = e.toY - toH;
            const midY = (y1 + y2) / 2;
            return (
              <path key={i}
                d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                stroke="#2d3748" strokeWidth={1.5} fill="none"
                markerEnd="url(#arrow-tree)" />
            );
          })}
          {nodes.map(n => {
            const isDir = n.type === 'directory';
            const isSelected = selectedFile === n.path;
            const hasExplanation = !!explanations[n.path];
            const isModified = modifiedFiles.has(n.path);
            const w = isDir ? 140 : 120;
            const h = isDir ? 40 : 32;
            const color = isDir ? '#818cf8' : getColor(n.name);

            return (
              <GraphNode key={n.id}
                x={n.x} y={n.y} width={w} height={h}
                name={n.name} nodeType={isDir ? 'directory' : 'file'}
                color={color}
                fillColor={isDir ? '#1e1b4b' : tintBg(color, 0.08)}
                isSelected={isSelected}
                strokeColor={isModified ? '#10b981' : hasExplanation ? '#6366f180' : '#1f2937'}
                onClick={() => onSelectNode(n)}
                onContextMenu={(e) => onContextMenu(e, n)}
                badge={!isDir ? getExtLabel(n.name) : null}
                animate={hasExplanation && !isSelected}
              />
            );
          })}
        </g>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }`}</style>
      </svg>
    </div>
  );
}

// ===== DEPENDENCY GRAPH VIEW =====
function DependencyGraphView({ graph, onNodeClick }: {
  graph: DependencyGraph | null;
  onNodeClick: (node: DependencyNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 400, y: 100 });
  const [zoom, setZoom] = useState(0.7);
  const [dragging, setDragging] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });

  if (!graph) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <h3 style={{ color: '#818cf8', marginBottom: 12 }}>Loading dependency graph...</h3>
        <p style={{ color: '#6b7280', fontSize: 13 }}>Analyzing imports and function calls</p>
      </div>
    );
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'line' || (e.target as SVGElement).tagName === 'path') {
      setDragging(true);
      dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) setPan({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const handleMouseUp = () => setDragging(false);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Layout algorithm: force-directed with folder grouping
  const layoutNodes = () => {
    const positions = new Map<string, { x: number; y: number }>();
    let x = 100;
    let y = 100;

    // Group by folder
    const folderNodes = graph.nodes.filter(n => n.type === 'folder');
    const rootFiles = graph.nodes.filter(n => n.type === 'file' && !folderNodes.some(f => f.children?.some(c => c.id === n.id)));

    folderNodes.forEach((folder, i) => {
      const folderX = 150 + (i % 4) * 300;
      const folderY = 150 + Math.floor(i / 4) * 250;
      positions.set(folder.id, { x: folderX, y: folderY });

      // Layout children
      if (folder.children) {
        folder.children.forEach((child, j) => {
          const childX = folderX + (j % 3) * 100 - 100;
          const childY = folderY + 60 + Math.floor(j / 3) * 50;
          positions.set(child.id, { x: childX, y: childY });

          // Layout functions if expanded
          if (expandedNodes.has(child.id) && child.children) {
            child.children.forEach((func, k) => {
              positions.set(func.id, { x: childX + 120, y: childY + k * 25 - 20 });
            });
          }
        });
      }
    });

    // Layout root files
    rootFiles.forEach((file, i) => {
      const fileX = 150 + (i % 5) * 200;
      const fileY = 50;
      positions.set(file.id, { x: fileX, y: fileY });

      // Layout functions if expanded
      if (expandedNodes.has(file.id) && file.children) {
        file.children.forEach((func, k) => {
          positions.set(func.id, { x: fileX + 120, y: fileY + k * 25 - 20 });
        });
      }
    });

    return positions;
  };

  const positions = layoutNodes();

  // Get connected nodes for hover effect
  const getConnectedNodes = (nodeId: string): Set<string> => {
    const connected = new Set<string>([nodeId]);
    graph.edges.forEach(edge => {
      if (edge.from === nodeId) connected.add(edge.to);
      if (edge.to === nodeId) connected.add(edge.from);
    });
    return connected;
  };

  const connectedNodes = hoveredNode ? getConnectedNodes(hoveredNode) : new Set<string>();

  // Get node dimensions for arrow endpoint calculation
  const getNodeSize = (nodeId: string): { w: number; h: number } => {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return { w: 100, h: 30 };
    if (node.type === 'folder') return { w: 180, h: 50 };
    if (node.type === 'file') return { w: 130, h: 38 };
    return { w: 100, h: 24 };
  };

  // Render edges with curves — arrows always visible
  const renderEdge = (edge: DependencyEdge, i: number) => {
    const fromPos = positions.get(edge.from);
    const toPos = positions.get(edge.to);
    if (!fromPos || !toPos) return null;

    const isDimmed = hoveredNode && !connectedNodes.has(edge.from) && !connectedNodes.has(edge.to);
    const isHighlighted = hoveredNode && (connectedNodes.has(edge.from) && connectedNodes.has(edge.to));
    const isImport = edge.type === 'imports';
    const color = isImport ? '#4b5563' : '#818cf8';
    const opacity = isDimmed ? 0.05 : isHighlighted ? 0.9 : (isImport ? 0.4 : 0.6);

    // Calculate edge endpoints at node borders instead of centers
    const fromSize = getNodeSize(edge.from);
    const toSize = getNodeSize(edge.to);
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    const angle = Math.atan2(dy, dx);

    // Offset from center to border
    const fromX = fromPos.x + Math.cos(angle) * (fromSize.w / 2);
    const fromY = fromPos.y + Math.sin(angle) * (fromSize.h / 2);
    const toX = toPos.x - Math.cos(angle) * (toSize.w / 2 + 6);
    const toY = toPos.y - Math.sin(angle) * (toSize.h / 2 + 6);

    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const curve = Math.min(Math.abs(dx) * 0.25, 40);
    const path = `M ${fromX} ${fromY} Q ${midX} ${midY - curve}, ${toX} ${toY}`;

    return (
      <g key={i}>
        <path d={path} stroke={color} strokeWidth={isImport ? 1.5 : 2} fill="none"
          strokeDasharray={isImport ? '6,4' : 'none'} opacity={opacity}
          markerEnd={`url(#arrow-${isImport ? 'import' : 'call'})`} />
      </g>
    );
  };

  // Render node using GraphNode component
  const renderNode = (node: DependencyNode) => {
    const pos = positions.get(node.id);
    if (!pos) return null;

    const isFolder = node.type === 'folder';
    const isFile = node.type === 'file';
    const isFunction = node.type === 'function';
    const isExpanded = expandedNodes.has(node.id);
    const isHovered = hoveredNode === node.id;
    const isDimmed = !!(hoveredNode && !connectedNodes.has(node.id));

    let width = 100;
    let height = 24;
    let color = '#818cf8';
    let fillColor = '#0a0a1a';

    if (isFolder) {
      width = 180; height = 50; color = '#818cf8'; fillColor = '#1e1b4b';
    } else if (isFile) {
      width = 130; height = 38; color = getColor(node.name); fillColor = tintBg(color, 0.08);
    }

    return (
      <GraphNode key={node.id}
        x={pos.x} y={pos.y} width={width} height={height}
        name={node.name}
        nodeType={isFolder ? 'folder' : isFile ? 'file' : 'function'}
        color={color} fillColor={fillColor}
        isHovered={isHovered} isDimmed={isDimmed}
        onClick={(e) => {
          e.stopPropagation();
          if (isFile && node.children && node.children.length > 0) {
            toggleExpand(node.id);
          } else {
            onNodeClick(node);
          }
        }}
        onMouseEnter={() => setHoveredNode(node.id)}
        onMouseLeave={() => setHoveredNode(null)}
        showExpandArrow={isFile && !!(node.children && node.children.length > 0)}
        isExpanded={isExpanded}
        badge={isFile ? getExtLabel(node.name) : null}
        subtitle={isFunction && node.line ? `L${node.line}` : null}
      />
    );
  };

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      <p style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 11, color: '#4b5563', zIndex: 10 }}>
        scroll to zoom · drag to pan · click file to expand functions · hover to highlight connections
      </p>
      <div style={{ position: 'absolute', top: 12, left: 12, background: '#111827ee', border: '1px solid #1f2937', borderRadius: 8, padding: 12, fontSize: 11, color: '#9ca3af', zIndex: 10 }}>
        <div style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: 8, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Legend</div>
        <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#4b5563" strokeWidth={1.5} strokeDasharray="4,3" /></svg>
          <span>imports</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#818cf8" strokeWidth={2} /><polygon points="18,1 24,4 18,7" fill="#818cf8" /></svg>
          <span>calls</span>
        </div>
      </div>
      <svg ref={svgRef} width="100%" height="100%"
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}>
        <defs>
          <marker id="arrow-import" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M1,1 L9,4 L1,7" fill="none" stroke="#4b5563" strokeWidth={1.5} />
          </marker>
          <marker id="arrow-call" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto" markerUnits="userSpaceOnUse">
            <path d="M1,1 L9,4 L1,7 Z" fill="#818cf8" />
          </marker>
        </defs>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {graph.edges.map((edge, i) => renderEdge(edge, i))}
          {graph.nodes.map(node => {
            if (node.type === 'folder') return renderNode(node);
            return null;
          })}
          {graph.nodes.map(node => {
            if (node.type === 'file') {
              const folder = graph.nodes.find(n => n.type === 'folder' && n.children?.some(c => c.id === node.id));
              if (!folder) return renderNode(node);
            }
            return null;
          })}
          {graph.nodes.flatMap(node => {
            if (node.type === 'folder' && node.children) {
              return node.children.map(child => renderNode(child));
            }
            return [];
          })}
          {Array.from(expandedNodes).flatMap(nodeId => {
            const node = graph.nodes.find(n => n.id === nodeId);
            if (node?.children) {
              return node.children.map(func => renderNode(func));
            }
            return [];
          })}
        </g>
      </svg>
    </div>
  );
}

// ===== CHAT PANEL =====
function ChatPanel({ selectedFile, onFileApplied, onClose }: {
  selectedFile: string | null;
  onFileApplied: (path: string) => void;
  onClose?: () => void;
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
      {/* Chat header with file name and close button */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #1f2937', background: '#0d0d1a', flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          {selectedFile ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: getColor(selectedFile.split('/').pop() || ''), flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: '#e5e7eb', fontWeight: 500 }}>{selectedFile.split('/').pop()}</span>
              <span style={{ fontSize: 10, color: '#6b7280' }}>{selectedFile}</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#6b7280' }}>No file selected</span>
          )}
        </div>
        {onClose && (
          <button onClick={onClose}
            style={{ background: 'none', border: '1px solid #1f2937', borderRadius: 6, color: '#9ca3af', cursor: 'pointer', padding: '4px 8px', fontSize: 14, lineHeight: 1, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#e5e7eb'; (e.target as HTMLButtonElement).style.borderColor = '#4b5563'; }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#9ca3af'; (e.target as HTMLButtonElement).style.borderColor = '#1f2937'; }}>
            ✕
          </button>
        )}
      </div>

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
              style={{ marginTop: 8, padding: '6px 12px', background: applied ? '#10b981' : '#6366f1', border
: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontFamily: 'inherit', cursor: applied ? 'default' : 'pointer' }}>
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
  const [activeTab, setActiveTab] = useState<'graph' | 'dependencies' | 'chat'>('graph');
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [modifiedFiles, setModifiedFiles] = useState(new Set<string>());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null);
  const [fileModal, setFileModal] = useState<{ content: string; filePath: string } | null>(null);
  const [renameNode, setRenameNode] = useState<FileNode | null>(null);
  const [dependencyGraph, setDependencyGraph] = useState<DependencyGraph | null>(null);
  const [dependencyLoading, setDependencyLoading] = useState(false);

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
        case 'dependencyGraphLoaded':
          setDependencyGraph(message.graph);
          setDependencyLoading(false);
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
          setDependencyLoading(false);
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

  // Load dependency graph when switching to dependencies tab
  useEffect(() => {
    if (activeTab === 'dependencies' && !dependencyGraph && !dependencyLoading) {
      setDependencyLoading(true);
      vscode.postMessage({ type: 'loadDependencyGraph' });
    }
  }, [activeTab, dependencyGraph, dependencyLoading]);

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

  const handleDependencyNodeClick = (node: DependencyNode) => {
    if (node.type === 'file') {
      setSelectedFile(node.filePath);
      setActiveTab('chat');
    }
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
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', height: 44, borderBottom: '1px solid #1f2937', background: '#0d0d1a', gap: 12, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, color: '#818cf8', fontSize: 13, letterSpacing: 0.5 }}>BOB</span>
        <span style={{ color: '#374151', fontSize: 13 }}>|</span>
        <span style={{ color: '#6b7280', fontSize: 11 }}>{workspaceName}</span>
        <div style={{ flex: 1 }} />
        {(['graph', 'dependencies', 'chat'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '5px 14px', border: 'none', borderRadius: 6, fontFamily: 'inherit', fontSize: 11, cursor: 'pointer', fontWeight: 500, letterSpacing: 0.3, transition: 'all 0.15s',
              background: activeTab === tab ? '#312e81' : 'transparent',
              color: activeTab === tab ? '#a5b4fc' : '#6b7280',
              borderBottom: activeTab === tab ? '2px solid #818cf8' : '2px solid transparent',
            }}>
            {tab === 'graph' ? 'Graph' : tab === 'dependencies' ? 'Dependencies' : 'Chat with Bob'}
          </button>
        ))}
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
                <div style={{ position: 'absolute', bottom: 20, left: 20, background: '#111827ee', border: '1px solid #1f2937', borderRadius: 10, padding: 16, maxWidth: 360, zIndex: 10, backdropFilter: 'blur(8px)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: getColor(selectedFile.split('/').pop() || ''), flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: '#e5e7eb', fontWeight: 600, margin: 0 }}>
                      {selectedFile.split('/').pop()}
                    </p>
                    {getExtLabel(selectedFile.split('/').pop() || '') && (
                      <span style={{ fontSize: 9, color: getColor(selectedFile.split('/').pop() || ''), background: tintBg(getColor(selectedFile.split('/').pop() || ''), 0.2), padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>
                        {getExtLabel(selectedFile.split('/').pop() || '')}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: '#4b5563', marginBottom: 8 }}>{selectedFile}</p>
                  <p style={{ fontSize: 12, color: '#d1d5db', lineHeight: 1.6 }}>{explanations[selectedFile]}</p>
                  <button onClick={() => { setActiveTab('chat'); }}
                    style={{ marginTop: 10, padding: '6px 14px', background: '#312e81', border: 'none', borderRadius: 6, color: '#a5b4fc', fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 500 }}>
                    Talk with Bob →
                  </button>
                </div>
              )}

              {explanationLoading && (
                <div style={{ position: 'absolute', bottom: 20, left: 20, background: '#111827', border: '1px solid #1f2937', borderRadius: 12, padding: 16, zIndex: 10 }}>
                  <p style={{ fontSize: 12, color: '#818cf8' }}>Bob is analyzing...</p>
                </div>
              )}
            </>
          ) : activeTab === 'dependencies' ? (
            <DependencyGraphView graph={dependencyGraph} onNodeClick={handleDependencyNodeClick} />
          ) : (
            <ChatPanel selectedFile={selectedFile} onFileApplied={handleFileApplied} onClose={() => setActiveTab('graph')} />
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
