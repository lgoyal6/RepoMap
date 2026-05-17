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

interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls';
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
function FileTree({ tree, selectedFile, disabledPaths, onSelect, onToggleDisabled }: {
  tree: FileNode[];
  selectedFile: string | null;
  disabledPaths: Set<string>;
  onSelect: (node: FileNode) => void;
  onToggleDisabled: (node: FileNode) => void;
}) {
  return (
    <div style={{ width: 280, borderRight: '1px solid #1f2937', overflowY: 'auto', padding: '12px 0', flexShrink: 0, height: '100%', background: '#090914' }}>
      <div style={{ padding: '0 12px 10px', borderBottom: '1px solid #111827', marginBottom: 8 }}>
        <p style={{ fontSize: 11, color: '#e5e7eb', fontWeight: 700, marginBottom: 4 }}>Graph visibility</p>
        <p style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.4 }}>Uncheck files or folders to hide them from the graph.</p>
      </div>
      {tree.map(node => (
        <TreeNode
          key={node.path}
          node={node}
          depth={0}
          selectedFile={selectedFile}
          disabledPaths={disabledPaths}
          onSelect={onSelect}
          onToggleDisabled={onToggleDisabled}
        />
      ))}
    </div>
  );
}

function TreeNode({ node, depth, selectedFile, disabledPaths, onSelect, onToggleDisabled }: {
  node: FileNode;
  depth: number;
  selectedFile: string | null;
  disabledPaths: Set<string>;
  onSelect: (node: FileNode) => void;
  onToggleDisabled: (node: FileNode) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selectedFile === node.path;
  const isDisabled = isPathHidden(node.path, disabledPaths);
  const isDirectlyDisabled = disabledPaths.has(node.path);
  const isDisabledByAncestor = isDisabled && !isDirectlyDisabled;
  const rowColor = isDisabled ? '#4b5563' : node.type === 'directory' ? '#cbd5e1' : '#d1d5db';
  const accentColor = node.type === 'directory' ? '#818cf8' : getColor(node.name);

  if (node.type === 'directory') {
    return (
      <div>
        <div
          style={{ padding: '5px 8px', paddingLeft: 10 + depth * 16, cursor: 'default', fontSize: 0, color: rowColor, display: 'flex', alignItems: 'center', gap: 7, opacity: isDisabled ? 0.55 : 1, background: isSelected ? 'rgba(99,102,241,0.13)' : 'transparent' }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ width: 18, height: 18, border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 10, padding: 0 }}>
            {expanded ? 'v' : '>'}
          </button>
          <input
            type="checkbox"
            checked={!isDisabled}
            disabled={isDisabledByAncestor}
            onChange={() => onToggleDisabled(node)}
            title={isDisabledByAncestor ? 'Hidden by a parent folder' : isDirectlyDisabled ? 'Show in graph' : 'Hide from graph'}
            style={{ cursor: isDisabledByAncestor ? 'not-allowed' : 'pointer' }}
          />
          <span onClick={() => onSelect(node)} style={{ flex: 1, minWidth: 0, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 12 }}>
            <span style={{ color: accentColor }}>[]</span> {node.name}
          </span>
          <span style={{ display: 'none' }}>{expanded ? 'v' : '>'}</span>
        </div>
        {expanded && node.children?.map(c => (
          <TreeNode
            key={c.path}
            node={c}
            depth={depth + 1}
            selectedFile={selectedFile}
            disabledPaths={disabledPaths}
            onSelect={onSelect}
            onToggleDisabled={onToggleDisabled}
          />
        ))}
      </div>
    );
  }

  // File node - check if it has function children
  const hasChildren = node.children && node.children.length > 0;
  const [fileExpanded, setFileExpanded] = useState(false);

  return (
    <div>
      <div
        style={{ padding: '5px 8px', paddingLeft: 28 + depth * 16, cursor: 'default', fontSize: 12, color: rowColor, background: isSelected ? 'rgba(99,102,241,0.15)' : 'transparent', borderLeft: isSelected ? '2px solid #6366f1' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: 7, opacity: isDisabled ? 0.5 : 1 }}>
        {hasChildren && (
          <button
            onClick={() => setFileExpanded(!fileExpanded)}
            style={{ width: 14, height: 14, border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: 9, padding: 0, marginLeft: -18 }}>
            {fileExpanded ? 'v' : '>'}
          </button>
        )}
        <input
          type="checkbox"
          checked={!isDisabled}
          disabled={isDisabledByAncestor}
          onChange={() => onToggleDisabled(node)}
          title={isDisabledByAncestor ? 'Hidden by a parent folder' : isDirectlyDisabled ? 'Show in graph' : 'Hide from graph'}
          style={{ cursor: isDisabledByAncestor ? 'not-allowed' : 'pointer' }}
        />
        <span onClick={() => onSelect(node)} style={{ flex: 1, minWidth: 0, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: accentColor }}>--</span> {node.name}
        </span>
      </div>
      {/* Render function children */}
      {hasChildren && fileExpanded && node.children?.map(funcNode => (
        <div
          key={funcNode.path}
          style={{ padding: '5px 8px', paddingLeft: 56 + depth * 16, cursor: 'default', fontSize: 11, color: '#a78bfa', background: isSelected && selectedFile === funcNode.path ? 'rgba(167,139,250,0.15)' : 'transparent', display: 'flex', alignItems: 'center', gap: 7, opacity: isDisabled ? 0.5 : 1 }}>
          <span onClick={() => onSelect(funcNode)} style={{ flex: 1, minWidth: 0, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <span style={{ color: '#8b5cf6' }}>⚙</span> {funcNode.name}
          </span>
        </div>
      ))}
    </div>
  );
}

// ===== COMBINED GRAPH VIEW =====
type GraphNode = FileNode & {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type GraphEdge = {
  from: GraphNode;
  to: GraphNode;
};

function normalizeGraphPath(path: string) {
  const filePath = path.includes(':') ? path.split(':')[0] : path;
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function isPathHidden(path: string, disabledPaths: Set<string>) {
  return Array.from(disabledPaths).some(disabledPath => path === disabledPath || path.startsWith(`${disabledPath}/`));
}

function filterTreeByDisabledPaths(tree: FileNode[], disabledPaths: Set<string>): FileNode[] {
  return tree.flatMap(node => {
    if (isPathHidden(node.path, disabledPaths)) return [];
    if (node.type === 'directory') {
      return [{ ...node, children: filterTreeByDisabledPaths(node.children || [], disabledPaths) }];
    }
    return [node];
  });
}

function getNodeWidth(name: string, type: FileNode['type']) {
  const contentWidth = name.length * 8 + 42;
  return type === 'directory'
    ? Math.min(300, Math.max(172, contentWidth))
    : Math.min(270, Math.max(140, contentWidth));
}

function getSubtreeHeight(node: FileNode): number {
  if (node.type === 'file' || !node.children?.length) return 44;

  const folders = node.children.filter(child => child.type === 'directory');
  const files = node.children.filter(child => child.type === 'file');
  const folderHeight = folders.length
    ? folders.map(getSubtreeHeight).reduce((sum, height) => sum + height, 0) + Math.max(0, folders.length - 1) * 104
    : 0;
  const fileHeight = files.length ? files.length * 42 + Math.max(0, files.length - 1) * 8 : 0;
  const childGroupGap = folders.length && files.length ? 96 : 0;

  return Math.max(78, folderHeight + childGroupGap + fileHeight);
}

function buildGraphLayout(tree: FileNode[]) {
  const nodes: GraphNode[] = [];
  const structureEdges: GraphEdge[] = [];
  const pathToNode = new Map<string, GraphNode>();
  const descendantsByPath = new Map<string, Set<string>>();
  const levelGap = 300;
  const fileRowGap = 58;
  const folderGap = 104;

  const collectDescendants = (node: FileNode): Set<string> => {
    const descendants = new Set<string>();
    node.children?.forEach(child => {
      descendants.add(normalizeGraphPath(child.path));
      collectDescendants(child).forEach(path => descendants.add(path));
    });
    descendantsByPath.set(normalizeGraphPath(node.path), descendants);
    return descendants;
  };

  tree.forEach(collectDescendants);

  const addNode = (node: FileNode, x: number, y: number): GraphNode => {
    const graphNode: GraphNode = {
      ...node,
      id: node.path,
      x,
      y,
      width: getNodeWidth(node.name, node.type),
      height: node.type === 'directory' ? 50 : 42
    };

    nodes.push(graphNode);
    pathToNode.set(normalizeGraphPath(node.path), graphNode);
    return graphNode;
  };

  const placeChildren = (parent: GraphNode, children: FileNode[]) => {
    const folders = children.filter(child => child.type === 'directory');
    const files = children.filter(child => child.type === 'file');
    const childX = parent.x + levelGap;

    const folderBlockHeight = folders.length
      ? folders.map(getSubtreeHeight).reduce((sum, height) => sum + height, 0) + Math.max(0, folders.length - 1) * folderGap
      : 0;
    const fileBlockHeight = files.length ? (files.length - 1) * fileRowGap + 34 : 0;
    const groupGap = folders.length && files.length ? 96 : 0;
    const totalHeight = folderBlockHeight + groupGap + fileBlockHeight;
    let y = parent.y - totalHeight / 2;

    if (folders.length) {
      const heights = folders.map(getSubtreeHeight);

      folders.forEach((folder, index) => {
        const child = addNode(folder, childX, y + heights[index] / 2);
        structureEdges.push({ from: parent, to: child });
        if (folder.children?.length) placeChildren(child, folder.children);
        y += heights[index] + folderGap;
      });

      y -= folderGap;
      y += groupGap;
    }

    if (files.length) {
      const fileX = folders.length ? parent.x + levelGap * 0.72 : childX;
      const startY = y + 17;

      files.forEach((file, index) => {
        const child = addNode(file, fileX, startY + index * fileRowGap);
        structureEdges.push({ from: parent, to: child });
      });
    }
  };

  const rootHeights = tree.map(getSubtreeHeight);
  const totalRootHeight = rootHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, tree.length - 1) * folderGap;
  let y = 120 - totalRootHeight / 2;

  tree.forEach((root, index) => {
    const child = addNode(root, 120, y + rootHeights[index] / 2);
    if (root.children?.length) placeChildren(child, root.children);
    y += rootHeights[index] + folderGap;
  });

  const bounds = nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.x - node.width / 2),
      maxX: Math.max(acc.maxX, node.x + node.width / 2),
      minY: Math.min(acc.minY, node.y - node.height / 2),
      maxY: Math.max(acc.maxY, node.y + node.height / 2)
    }),
    { minX: 0, maxX: 1000, minY: 0, maxY: 700 }
  );

  return { nodes, structureEdges, pathToNode, descendantsByPath, bounds };
}

function CombinedGraphView({ tree, dependencyEdges, selectedFile, onSelectNode, explanations, modifiedFiles, onContextMenu }: {
  tree: FileNode[];
  dependencyEdges: DependencyEdge[];
  selectedFile: string | null;
  onSelectNode: (node: FileNode) => void;
  explanations: Record<string, string>;
  modifiedFiles: Set<string>;
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const { nodes, structureEdges, pathToNode, descendantsByPath, bounds } = buildGraphLayout(tree);
  const viewBox = {
    x: bounds.minX - 160,
    y: bounds.minY - 160,
    width: Math.max(900, bounds.maxX - bounds.minX + 320),
    height: Math.max(620, bounds.maxY - bounds.minY + 320)
  };

  const getSvgPoint = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: viewBox.x + viewBox.width / 2, y: viewBox.y + viewBox.height / 2 };

    return {
      x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
      y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height
    };
  }, [viewBox.height, viewBox.width, viewBox.x, viewBox.y]);

  const centerNode = useCallback((node: GraphNode) => {
    setPan({
      x: viewBox.x + viewBox.width / 2 - node.x * zoom,
      y: viewBox.y + viewBox.height / 2 - node.y * zoom
    });
  }, [viewBox.height, viewBox.width, viewBox.x, viewBox.y, zoom]);

  // Get connected nodes for hover effect
  // Show WHO USES the hovered node (reverse dependencies)
  const getConnectedNodes = (nodePath: string): Set<string> => {
    const normalizedNodePath = normalizeGraphPath(nodePath);
    const connected = new Set<string>([normalizedNodePath]);
    descendantsByPath.get(normalizedNodePath)?.forEach(path => connected.add(path));
    dependencyEdges.forEach(edge => {
      const fromPath = normalizeGraphPath(edge.from);
      const toPath = normalizeGraphPath(edge.to);
      // Show arrows FROM this node TO nodes that use/call it
      if (toPath === normalizedNodePath) connected.add(fromPath);
    });
    return connected;
  };

  const connectedNodes = hoveredNode ? getConnectedNodes(hoveredNode) : new Set<string>();

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const svgPoint = getSvgPoint(e.clientX, e.clientY);

    setZoom(currentZoom => {
      const nextZoom = Math.min(4, Math.max(0.08, currentZoom * Math.exp(-e.deltaY * 0.0015)));
      const graphPoint = {
        x: (svgPoint.x - pan.x) / currentZoom,
        y: (svgPoint.y - pan.y) / currentZoom
      };

      setPan({
        x: svgPoint.x - graphPoint.x * nextZoom,
        y: svgPoint.y - graphPoint.y * nextZoom
      });

      return nextZoom;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'line' || (e.target as SVGElement).tagName === 'path') {
      e.preventDefault();
      setDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const xUnitsPerPixel = viewBox.width / rect.width;
    const yUnitsPerPixel = viewBox.height / rect.height;
    const dx = (e.clientX - dragStart.current.x) * xUnitsPerPixel / zoom;
    const dy = (e.clientY - dragStart.current.y) * yUnitsPerPixel / zoom;

    e.preventDefault();
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    dragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => setDragging(false);

  const getNodeAnchor = (node: GraphNode, toward: GraphNode) => {
    const dx = toward.x - node.x;
    const dy = toward.y - node.y;
    if (dx === 0 && dy === 0) return { x: node.x, y: node.y };

    const scaleX = Math.abs(dx) > 0 ? (node.width / 2) / Math.abs(dx) : Number.POSITIVE_INFINITY;
    const scaleY = Math.abs(dy) > 0 ? (node.height / 2) / Math.abs(dy) : Number.POSITIVE_INFINITY;
    const scale = Math.min(scaleX, scaleY);

    return {
      x: node.x + dx * scale,
      y: node.y + dy * scale
    };
  };

  const getArrowPoints = (tip: { x: number; y: number }, from: { x: number; y: number }) => {
    const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
    const length = 13;
    const spread = 0.52;

    return [
      tip,
      { x: tip.x - Math.cos(angle - spread) * length, y: tip.y - Math.sin(angle - spread) * length },
      { x: tip.x - Math.cos(angle + spread) * length, y: tip.y - Math.sin(angle + spread) * length }
    ];
  };

  // Render dependency edges
  const renderDependencyEdge = (edge: DependencyEdge, i: number, allEdges: DependencyEdge[]) => {
    const fromPath = normalizeGraphPath(edge.from);
    const toPath = normalizeGraphPath(edge.to);
    const fromNode = pathToNode.get(fromPath);
    const toNode = pathToNode.get(toPath);
    
    if (!fromNode || !toNode || fromNode.path === toNode.path) return null;

    const hoveredPath = hoveredNode ? normalizeGraphPath(hoveredNode) : null;
    const isConnectedToHover = Boolean(hoveredPath && (fromPath === hoveredPath || toPath === hoveredPath));
    if (!isConnectedToHover) return null;

    const isImport = edge.type === 'imports';
    const color = isImport ? '#fbbf24' : '#38bdf8';
    const start = getNodeAnchor(fromNode, toNode);
    const end = getNodeAnchor(toNode, fromNode);

    // Calculate offset for overlapping edges (when nodes are vertically aligned)
    const isVerticallyAligned = Math.abs(fromNode.x - toNode.x) < 50;
    let horizontalOffset = 0;
    
    if (isVerticallyAligned) {
      // Count how many edges share similar vertical alignment
      const similarEdges = allEdges.filter((e, idx) => {
        if (idx >= i) return false; // Only count previous edges
        const ePath = normalizeGraphPath(e.from);
        const eToPath = normalizeGraphPath(e.to);
        const eFromNode = pathToNode.get(ePath);
        const eToNode = pathToNode.get(eToPath);
        if (!eFromNode || !eToNode) return false;
        return Math.abs(eFromNode.x - eToNode.x) < 50 &&
               Math.abs(eFromNode.y - fromNode.y) < 100;
      });
      horizontalOffset = similarEdges.length * 25; // Offset each edge by 25 units
    }

    // Curved path for dependencies
    const dx = end.x - start.x;
    const lift = Math.max(70, Math.min(180, Math.abs(end.y - start.y) * 0.35));
    const controlOne = { x: start.x + dx * 0.45 + horizontalOffset, y: start.y - lift };
    const controlTwo = { x: start.x + dx * 0.55 + horizontalOffset, y: end.y - lift };
    const arrowBase = controlTwo;
    const arrowPoints = getArrowPoints(end, arrowBase);
    const path = `M ${start.x} ${start.y} C ${controlOne.x} ${controlOne.y}, ${controlTwo.x} ${controlTwo.y}, ${end.x} ${end.y}`;

    return (
      <g key={`dep-${i}`}>
        <path d={path} stroke={color} strokeWidth={3.25} fill="none"
          strokeDasharray={isImport ? '5,5' : 'none'} opacity={0.95} />
        <polygon
          points={arrowPoints.map(point => `${point.x},${point.y}`).join(' ')}
          fill={color}
          opacity={0.95}
        />
      </g>
    );
  };

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden', userSelect: 'none' }}>
      <p style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 11, color: '#4b5563', zIndex: 10 }}>
        wheel zooms toward pointer | drag empty space to pan | click folder to center
      </p>
      
      {/* Legend and controls */}
      <div style={{ position: 'absolute', top: 12, left: 12, background: '#111827', border: '1px solid #1f2937', borderRadius: 8, padding: 12, fontSize: 11, color: '#9ca3af', zIndex: 10 }}>
        <div style={{ marginBottom: 8, fontWeight: 600, color: '#e5e7eb' }}>Unified Graph</div>
        <div style={{ marginBottom: 6, color: '#6b7280' }}>
          <span style={{ color: '#1f2937' }}>--</span> file structure
        </div>
        <div style={{ marginBottom: 6 }}>
          <span style={{ color: '#fbbf24' }}>--</span> imports on hover
        </div>
        <div>
          <span style={{ color: '#38bdf8' }}>--</span> calls on hover
        </div>
        <div style={{ marginTop: 8, color: '#6b7280' }}>{dependencyEdges.length} dependencies indexed</div>
      </div>

      <svg ref={svgRef} width="100%" height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? 'grabbing' : 'grab', userSelect: 'none', touchAction: 'none' }}>
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* File structure edges */}
          {structureEdges.map((e, i) => {
            const isHighlighted = hoveredNode
              && connectedNodes.has(normalizeGraphPath(e.from.path))
              && connectedNodes.has(normalizeGraphPath(e.to.path));

            return (
              <path key={`struct-${i}`}
                d={`M ${e.from.x + e.from.width / 2} ${e.from.y} C ${e.from.x + 92} ${e.from.y}, ${e.to.x - 92} ${e.to.y}, ${e.to.x - e.to.width / 2} ${e.to.y}`}
                stroke={isHighlighted ? '#fbbf24' : '#263244'}
                strokeWidth={isHighlighted ? 2.2 : 1.4}
                opacity={hoveredNode && !isHighlighted ? 0.35 : 1}
                fill="none" />
            );
          })}

          {/* Dependency edges */}
          {hoveredNode && dependencyEdges.map((edge, i) => renderDependencyEdge(edge, i, dependencyEdges))}
          
          {/* File/folder nodes - render last so they appear on top */}
          {nodes.map(n => {
            const isDir = n.type === 'directory';
            const isSelected = selectedFile === n.path;
            const hasExplanation = explanations[n.path];
            const isModified = modifiedFiles.has(n.path);
            const isHovered = hoveredNode === n.path;
            const isConnected = connectedNodes.has(normalizeGraphPath(n.path));
            const isDimmed = hoveredNode && !isConnected && hoveredNode !== n.path;
            const w = n.width;
            const h = n.height;
            const labelColor = isDir ? '#eef2ff' : '#f9fafb';
            const fillColor = isDir ? '#312e81' : '#172033';
            const opacity = isDimmed ? 0.3 : 1;
            const strokeColor = isSelected
              ? '#6366f1'
              : isHovered
                ? '#fbbf24'
                : hoveredNode && isConnected
                  ? '#fbbf24'
                  : isModified
                    ? '#10b981'
                    : hasExplanation
                      ? '#6366f180'
                      : '#1f2937';

            return (
              <g key={n.path}
                onClick={() => {
                  if (n.type === 'directory') centerNode(n);
                  onSelectNode(n);
                }}
                onContextMenu={(e) => onContextMenu(e, n)}
                onMouseEnter={() => setHoveredNode(n.path)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: 'pointer' }}>
                <rect x={n.x - w/2} y={n.y - h/2} width={w} height={h} rx={8}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 2.5 : isHovered || (hoveredNode && isConnected) ? 2.5 : 1}
                  opacity={opacity}
                  style={hasExplanation && !isSelected ? { animation: 'pulse 2s infinite' } : {}} />
                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={12}
                  fill={labelColor}
                  fontFamily="JetBrains Mono"
                  fontWeight={isDir ? 700 : 600}
                  opacity={opacity}>
                  {n.name.length > 28 ? n.name.slice(0, 26) + '..' : n.name}
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
  const [activeTab, setActiveTab] = useState<'graph' | 'chat'>('graph');
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [modifiedFiles, setModifiedFiles] = useState(new Set<string>());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: FileNode } | null>(null);
  const [fileModal, setFileModal] = useState<{ content: string; filePath: string } | null>(null);
  const [renameNode, setRenameNode] = useState<FileNode | null>(null);
  const [dependencyEdges, setDependencyEdges] = useState<DependencyEdge[]>([]);
  const [disabledGraphPaths, setDisabledGraphPaths] = useState<Set<string>>(new Set());

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
          setDependencyEdges(message.edges || []);
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
    else setSelectedFile(node.path);
  };

  const handleToggleGraphDisabled = (node: FileNode) => {
    setDisabledGraphPaths(prev => {
      const next = new Set(prev);
      if (next.has(node.path)) next.delete(node.path);
      else next.add(node.path);
      return next;
    });
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
          Combined Graph
        </button>
        <button onClick={() => setActiveTab('chat')}
          style={{ padding: '6px 14px', background: activeTab === 'chat' ? '#312e81' : 'transparent', border: '1px solid #1f2937', borderRadius: 6, color: activeTab === 'chat' ? '#818cf8' : '#9ca3af', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer' }}>
          Chat with Bob
        </button>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <FileTree
          tree={tree}
          selectedFile={selectedFile}
          disabledPaths={disabledGraphPaths}
          onSelect={handleSidebarSelect}
          onToggleDisabled={handleToggleGraphDisabled}
        />

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {activeTab === 'graph' ? (
            <>
              <CombinedGraphView
                tree={filterTreeByDisabledPaths(tree, disabledGraphPaths)}
                dependencyEdges={dependencyEdges}
                selectedFile={selectedFile}
                onSelectNode={handleNodeClick}
                explanations={explanations}
                modifiedFiles={modifiedFiles}
                onContextMenu={handleContextMenu}
              />

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
