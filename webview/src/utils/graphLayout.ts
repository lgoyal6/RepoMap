interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface DependencyEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls';
}

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  type: 'file' | 'directory';
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'structure' | 'imports' | 'calls';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  structureEdges: GraphEdge[];
  dependencyEdges: GraphEdge[];
  bounds: { width: number; height: number };
}

export function normalizeGraphPath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function isPathHidden(path: string, disabledPaths: Set<string>): boolean {
  return Array.from(disabledPaths).some(disabled => path.startsWith(disabled));
}

export function filterTreeByDisabledPaths(tree: FileNode[], disabledPaths: Set<string>): FileNode[] {
  return tree.flatMap(node => {
    if (isPathHidden(node.path, disabledPaths)) return [];
    if (node.children) {
      const children = filterTreeByDisabledPaths(node.children, disabledPaths);
      return [{ ...node, children }];
    }
    return [node];
  });
}

export function getNodeWidth(label: string): number {
  const baseWidth = 120;
  const charWidth = 7;
  return Math.max(baseWidth, Math.min(label.length * charWidth, 250));
}

export function getSubtreeHeight(node: FileNode, disabledPaths: Set<string>): number {
  if (isPathHidden(node.path, disabledPaths)) return 0;
  
  if (node.type === 'file') return 40;
  
  if (!node.children || node.children.length === 0) return 40;
  
  const childrenHeight = node.children.reduce((sum, child) => 
    sum + getSubtreeHeight(child, disabledPaths), 0
  );
  
  return Math.max(40, childrenHeight + 20);
}

export function buildGraphLayout(
  tree: FileNode[],
  dependencyEdges: DependencyEdge[],
  disabledPaths: Set<string>
): GraphLayout {
  const nodes: GraphNode[] = [];
  const structureEdges: GraphEdge[] = [];
  const pathToNode = new Map<string, GraphNode>();
  const descendantsByPath = new Map<string, Set<string>>();

  let currentY = 20;
  const HORIZONTAL_SPACING = 200;
  const VERTICAL_SPACING = 10;

  function processNode(node: FileNode, depth: number, parentY: number): number {
    if (isPathHidden(node.path, disabledPaths)) return parentY;

    const normalizedPath = normalizeGraphPath(node.path);
    const x = 50 + depth * HORIZONTAL_SPACING;
    const width = getNodeWidth(node.name);
    const height = node.type === 'file' ? 30 : 35;

    const graphNode: GraphNode = {
      id: normalizedPath,
      x,
      y: currentY,
      width,
      height,
      label: node.name,
      type: node.type
    };

    nodes.push(graphNode);
    pathToNode.set(normalizedPath, graphNode);

    // Track descendants
    const descendants = new Set<string>();
    descendants.add(normalizedPath);
    descendantsByPath.set(normalizedPath, descendants);

    const nodeStartY = currentY;
    currentY += height + VERTICAL_SPACING;

    if (node.children && node.children.length > 0) {
      const childStartY = currentY;
      
      for (const child of node.children) {
        if (!isPathHidden(child.path, disabledPaths)) {
          const childNormalizedPath = normalizeGraphPath(child.path);
          
          // Add structure edge
          structureEdges.push({
            from: normalizedPath,
            to: childNormalizedPath,
            type: 'structure',
            x1: x + width,
            y1: nodeStartY + height / 2,
            x2: x + HORIZONTAL_SPACING,
            y2: currentY + 15
          });

          currentY = processNode(child, depth + 1, currentY);
          
          // Add child's descendants to parent's descendants
          const childDescendants = descendantsByPath.get(childNormalizedPath);
          if (childDescendants) {
            childDescendants.forEach(desc => descendants.add(desc));
          }
        }
      }
    }

    return currentY;
  }

  // Process all root nodes
  tree.forEach(node => {
    if (!isPathHidden(node.path, disabledPaths)) {
      currentY = processNode(node, 0, currentY);
      currentY += 20; // Extra spacing between root nodes
    }
  });

  // Build dependency edges
  const depEdges: GraphEdge[] = [];
  for (const edge of dependencyEdges) {
    const fromNorm = normalizeGraphPath(edge.from);
    const toNorm = normalizeGraphPath(edge.to);
    
    if (isPathHidden(fromNorm, disabledPaths) || isPathHidden(toNorm, disabledPaths)) {
      continue;
    }

    const fromNode = pathToNode.get(fromNorm);
    const toNode = pathToNode.get(toNorm);

    if (fromNode && toNode) {
      depEdges.push({
        from: fromNorm,
        to: toNorm,
        type: edge.type,
        x1: fromNode.x + fromNode.width,
        y1: fromNode.y + fromNode.height / 2,
        x2: toNode.x,
        y2: toNode.y + toNode.height / 2
      });
    }
  }

  const maxX = Math.max(...nodes.map(n => n.x + n.width), 800);
  const maxY = Math.max(...nodes.map(n => n.y + n.height), 600);

  return {
    nodes,
    structureEdges,
    dependencyEdges: depEdges,
    bounds: { width: maxX + 100, height: maxY + 100 }
  };
}

// Made with Bob