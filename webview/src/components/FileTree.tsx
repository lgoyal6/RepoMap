import React from 'react';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

interface FileTreeProps {
  tree: FileNode[];
  onFileClick: (path: string) => void;
  onFileRightClick: (path: string, event: React.MouseEvent) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ tree, onFileClick, onFileRightClick }) => {
  return (
    <div style={{
      width: '250px',
      borderRight: '1px solid var(--vscode-panel-border)',
      overflowY: 'auto',
      padding: '10px',
      background: 'var(--vscode-sideBar-background)',
      flexShrink: 0
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' }}>Files</div>
      {tree.map(node => (
        <TreeNode
          key={node.path}
          node={node}
          onFileClick={onFileClick}
          onFileRightClick={onFileRightClick}
        />
      ))}
    </div>
  );
};

interface TreeNodeProps {
  node: FileNode;
  depth?: number;
  onFileClick: (path: string) => void;
  onFileRightClick: (path: string, event: React.MouseEvent) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, depth = 0, onFileClick, onFileRightClick }) => {
  const [expanded, setExpanded] = React.useState(depth < 2);

  const handleClick = () => {
    if (node.type === 'directory') {
      setExpanded(!expanded);
    } else {
      onFileClick(node.path);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (node.type === 'file') {
      onFileRightClick(node.path, e);
    }
  };

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={handleRightClick}
        style={{
          paddingLeft: `${depth * 15}px`,
          padding: '4px 8px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '13px',
          color: node.type === 'directory' ? 'var(--vscode-foreground)' : 'var(--vscode-textLink-foreground)',
          background: 'transparent'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--vscode-list-hoverBackground)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        {node.type === 'directory' && (
          <span style={{ fontSize: '10px' }}>{expanded ? '▼' : '▶'}</span>
        )}
        <span style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {node.name}
        </span>
      </div>
      {node.type === 'directory' && expanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              onFileRightClick={onFileRightClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Made with Bob