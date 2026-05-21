  import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

export type NodeType = 'ORG' | 'ASSET' | 'SUPPLIER' | 'ASSETS_COLLAPSED' | 'SUPPLIERS_COLLAPSED';

export interface GraphNodeData {
  id: string;
  type: NodeType;
  name: string;
  metadata: Record<string, unknown>;
  // For collapsed nodes
  isCollapsed?: boolean;
  childrenCount?: number;
}

const nodeWidth = 220;
const nodeHeight = 90;

export const getLayoutedElements = (
  nodes: Node<GraphNodeData>[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB'
): { nodes: Node<GraphNodeData>[]; edges: Edge[] } => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const isTB = direction === 'TB';
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: 100, // Increased from 80
    ranksep: 140, // Increased from 100 for better vertical spacing
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // If the node doesn't have position data (not connected), give it a default position
    if (!nodeWithPosition || !nodeWithPosition.x || !nodeWithPosition.y) {
      return {
        ...node,
        position: node.position || { x: 0, y: 0 },
      };
    }

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const nodeColors: Record<string, { bg: string; border: string; icon: string }> = {
  ORG: {
    bg: 'rgba(59, 130, 246, 0.15)',
    border: '#3b82f6',
    icon: '#3b82f6',
  },
  ASSET: {
    bg: 'rgba(34, 197, 94, 0.15)',
    border: '#22c55e',
    icon: '#22c55e',
  },
  SUPPLIER: {
    bg: 'rgba(168, 85, 247, 0.15)',
    border: '#a855f7',
    icon: '#a855f7',
  },
  ASSETS_COLLAPSED: {
    bg: 'rgba(34, 197, 94, 0.15)',
    border: '#22c55e',
    icon: '#22c55e',
  },
  SUPPLIERS_COLLAPSED: {
    bg: 'rgba(168, 85, 247, 0.15)',
    border: '#a855f7',
    icon: '#a855f7',
  },
};

// Helper to get colors for any node type
export const getNodeColors = (type: string) => {
  return nodeColors[type] || nodeColors.ORG;
};
