import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  NodeTypes,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { GlassNode, Tooltip } from '../../components/graph/CustomNodes';
import { GraphControls } from '../../components/graph/GraphControls';
import { getLayoutedElements, GraphNodeData } from '../../components/graph/GraphUtils';
import { getOrgTree, OrgNode } from '../../../services/org.service';
import { getAssets, AssetRecord } from '../../../services/asset.service';
import { getSuppliers, SupplierRecord } from '../../../services/supplier.service';
import { getOrgById } from '../../../services/org.service';
import { getAssetById } from '../../../services/asset.service';
import { getSupplierById } from '../../../services/supplier.service';
import { Drawer } from '../../components/ui/Modal';
import { toast } from 'sonner';
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from '../../components/layout/CommonPageHeader';
import { buildPageHeaderStats, getPageHeaderConfig } from '../../components/layout/pageHeaderConfig';

// Custom node types
const nodeTypes: NodeTypes = {
  ORG: GlassNode,
  ASSET: GlassNode,
  SUPPLIER: GlassNode,
  ASSETS_COLLAPSED: GlassNode,
  SUPPLIERS_COLLAPSED: GlassNode,
};

interface GraphFilters {
  ORG: boolean;
  ASSET: boolean;
  SUPPLIER: boolean;
  [key: string]: boolean;
}

interface NodeCounts {
  ORG: number;
  ASSET: number;
  SUPPLIER: number;
}

const initialFilters: GraphFilters = {
  ORG: true,
  ASSET: true,
  SUPPLIER: true,
};

export function GraphHierarchyPage() {
  const header = getPageHeaderConfig("infrastructure-graph");
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GraphFilters>(initialFilters);
  const [searchQuery, setSearchQuery] = useState('');
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  // Tooltip state
  const [hoveredNode, setHoveredNode] = useState<{ data: GraphNodeData; position: { x: number; y: number } } | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<{
    type: 'ORG' | 'ASSET' | 'SUPPLIER';
    id: string;
    data: Record<string, unknown>;
  } | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Data refs
  const orgTreeRef = useRef<OrgNode[]>([]);
  const assetsRef = useRef<AssetRecord[]>([]);
  const suppliersRef = useRef<SupplierRecord[]>([]);

  // Memoized graph data for performance
  const memoizedGraphData = useRef<{
    nodes: Node<GraphNodeData>[];
    edges: Edge[];
  } | null>(null);

  // Node counts
  const nodeCounts = useMemo<NodeCounts>(() => {
    const counts = { ORG: 0, ASSET: 0, SUPPLIER: 0 };
    nodes.forEach((node) => {
      const type = node.data.type;
      if (type === 'ORG' || type === 'ASSETS_COLLAPSED') counts.ORG++;
      if (type === 'ASSET') counts.ASSET++;
      if (type === 'SUPPLIER' || type === 'SUPPLIERS_COLLAPSED') counts.SUPPLIER++;
    });
    return counts;
  }, [nodes]);

  const headerStats = buildPageHeaderStats(header.stats, {
    orgs: nodeCounts.ORG,
    assets: nodeCounts.ASSET,
    suppliers: nodeCounts.SUPPLIER,
  });

  // Build graph data
  const buildGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [orgs, assets, suppliers] = await Promise.all([
        getOrgTree(),
        getAssets(),
        getSuppliers(),
      ]);

      orgTreeRef.current = orgs;
      assetsRef.current = assets;
      suppliersRef.current = suppliers;

      // Flatten org tree for nodes
      const flattenOrgs = (nodes: OrgNode[]): OrgNode[] => {
        return nodes.reduce<OrgNode[]>((acc, node) => {
          acc.push(node);
          if (node.children && node.children.length > 0) {
            acc.push(...flattenOrgs(node.children));
          }
          return acc;
        }, []);
      };

      const flatOrgs = flattenOrgs(orgs);
      const supplierMap = new Map(suppliers.map((s) => [s.supplier_id, s]));
      
      // Create org map for parent-child relationship lookup
      const orgMap = new Map(flatOrgs.map(org => [org.id, org]));

      // Create nodes
      const graphNodes: Node<GraphNodeData>[] = [];

      // Add ORG nodes
      flatOrgs.forEach((org) => {
        graphNodes.push({
          id: `org_${org.id}`,
          type: 'ORG',
          data: {
            id: org.id,
            type: 'ORG',
            name: org.name,
            metadata: {
              code: org.code,
              type: org.type,
              status: org.status,
              city: org.city,
              country: org.country,
              parent_id: org.parent_id,
              'Assets Count': assets.filter((a) => a.org_node_id === org.id).length,
            },
          },
          position: { x: 0, y: 0 },
        });
      });

      // Add ASSET nodes
      assets.forEach((asset) => {
        const supplier = asset.supplier_id ? supplierMap.get(asset.supplier_id) : null;
        graphNodes.push({
          id: `asset_${asset.asset_id}`,
          type: 'ASSET',
          data: {
            id: asset.asset_id,
            type: 'ASSET',
            name: asset.asset_name || asset.asset_code || 'Unnamed Asset',
            metadata: {
              'Asset Code': asset.asset_code,
              Type: asset.asset_type,
              Status: asset.asset_status,
              Criticality: asset.asset_criticality,
              Supplier: supplier?.supplier_name || '-',
              Value: asset.asset_value ? `${asset.asset_value} ${asset.asset_currency || ''}` : '-',
              Manufacturer: asset.manufacturer,
              Model: asset.model,
              Version: asset.asset_version,
            },
          },
          position: { x: 0, y: 0 },
        });
      });

      // Add SUPPLIER nodes
      suppliers.forEach((supplier) => {
        const supplierAssets = assets.filter((a) => a.supplier_id === supplier.supplier_id);
        graphNodes.push({
          id: `supplier_${supplier.supplier_id}`,
          type: 'SUPPLIER',
          data: {
            id: supplier.supplier_id,
            type: 'SUPPLIER',
            name: supplier.supplier_name,
            metadata: {
              'Supplier Type': supplier.supplier_type,
              City: supplier.supplier_city,
              State: supplier.supplier_state,
              Country: supplier.supplier_country,
              'Assets Provided': supplierAssets.length,
              'Contact Name': supplier.contact_name,
              'Contact Email': supplier.contact_email,
            },
          },
          position: { x: 0, y: 0 },
        });
      });

      // Create edges
      const graphEdges: Edge[] = [];

      // ORG -> ORG edges (parent-child hierarchy) - using parent_id
      flatOrgs.forEach((org) => {
        if (org.parent_id && orgMap.has(org.parent_id)) {
          graphEdges.push({
            id: `edge_org_${org.parent_id}_org_${org.id}`,
            source: `org_${org.parent_id}`,
            target: `org_${org.id}`,
            type: 'smoothstep',
            style: { stroke: '#4f8cff', strokeWidth: 2 },
            animated: false,
          });
        }
      });

      // ORG -> ASSET edges
      assets.forEach((asset) => {
        if (asset.org_node_id) {
          graphEdges.push({
            id: `edge_org_${asset.org_node_id}_asset_${asset.asset_id}`,
            source: `org_${asset.org_node_id}`,
            target: `asset_${asset.asset_id}`,
            type: 'smoothstep',
            style: { stroke: '#3b82f6', strokeWidth: 2 },
            animated: false,
          });
        }
      });

      // ASSET -> SUPPLIER edges
      assets.forEach((asset) => {
        if (asset.supplier_id) {
          graphEdges.push({
            id: `edge_asset_${asset.asset_id}_supplier_${asset.supplier_id}`,
            source: `asset_${asset.asset_id}`,
            target: `supplier_${asset.supplier_id}`,
            type: 'smoothstep',
            style: { stroke: '#a855f7', strokeWidth: 2 },
            animated: false,
          });
        }
      });

      // Store memoized data
      memoizedGraphData.current = { nodes: graphNodes, edges: graphEdges };

      // Apply layout
      const layouted = getLayoutedElements(graphNodes, graphEdges);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
    } catch (err) {
      console.error('Failed to load graph data:', err);
      setError('Unable to load infrastructure graph');
      toast.error('Failed to load infrastructure graph data');
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  // Initial load
  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  // Filter nodes with memoization
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const typeFilter = filters[node.data.type as keyof GraphFilters];
      if (!typeFilter) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const name = node.data.name.toLowerCase();
        const metadata = Object.values(node.data.metadata).some((v) =>
          String(v).toLowerCase().includes(query)
        );
        return name.includes(query) || metadata;
      }

      return true;
    });
  }, [nodes, filters, searchQuery]);

  // Filter edges with memoization
  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter(
      (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );
  }, [edges, filteredNodes]);

  // Filter handlers
  const handleFilterChange = useCallback((type: 'ORG' | 'ASSET' | 'SUPPLIER', checked: boolean) => {
    setFilters((prev) => ({ ...prev, [type]: checked }));
  }, []);

  const handleFitView = useCallback(() => {
    reactFlowInstance?.fitView({ padding: 0.2, duration: 300 });
  }, [reactFlowInstance]);

  const handleRefresh = useCallback(() => {
    buildGraph();
  }, [buildGraph]);

  useEffect(() => {
    if (!reactFlowInstance || filteredNodes.length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 250 });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [reactFlowInstance, filteredNodes.length, filteredEdges.length]);

  // Search highlight and center
  useEffect(() => {
    if (searchQuery && filteredNodes.length > 0 && reactFlowInstance) {
      const firstMatch = filteredNodes[0];
      reactFlowInstance.fitView({
        padding: 0.5,
        duration: 300,
      });
      // Optionally pan to the node
      const node = nodes.find((n) => n.id === firstMatch.id);
      if (node) {
        reactFlowInstance.setCenter(node.position.x + 110, node.position.y + 40, {
          zoom: 1.2,
          duration: 300,
        });
      }
    }
  }, [searchQuery, filteredNodes, reactFlowInstance, nodes]);

  // Mouse move for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY });
  }, []);

  // Node handlers
  const handleNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node<GraphNodeData>) => {
      setHoveredNode({
        data: node.data,
        position: { x: mousePosition.x, y: mousePosition.y },
      });
    },
    [mousePosition]
  );

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNode(null);
  }, []);

  const handleNodeClick = useCallback(
    async (event: React.MouseEvent, node: Node<GraphNodeData>) => {
      event.stopPropagation();
      
      setDrawerOpen(true);
      setDrawerData({
        type: node.data.type as 'ORG' | 'ASSET' | 'SUPPLIER',
        id: node.data.id,
        data: node.data.metadata,
      });

      // Load additional details
      setDrawerLoading(true);
      try {
        let detailData: Record<string, unknown> = {};
        
        if (node.data.type === 'ORG') {
          const org = await getOrgById(node.data.id);
          detailData = {
            name: org.name,
            code: org.code,
            type: org.type,
            status: org.status,
            address: org.address,
            city: org.city,
            state: org.state,
            country: org.country,
            'Parent ID': org.parent_id,
            lat: org.lat,
            long: org.long,
          };
        } else if (node.data.type === 'ASSET') {
          const asset = await getAssetById(node.data.id);
          detailData = {
            'Asset Name': asset.asset_name,
            'Asset Code': asset.asset_code,
            'Asset Type': asset.asset_type,
            'Asset Status': asset.asset_status,
            'Asset Criticality': asset.asset_criticality,
            'Organization': asset.org_node_name,
            'Supplier': asset.supplier_name,
            'Serial Number': asset.asset_serial_no,
            Manufacturer: asset.manufacturer,
            Model: asset.model,
            Version: asset.asset_version,
            'Purchase Date': asset.asset_purchase_dt,
            'Commission Date': asset.asset_commission_dt,
            'Purchase Ref': asset.asset_purchase_ref,
            'Warranty (months)': asset.warranty_period,
            Value: asset.asset_value ? `${asset.asset_value} ${asset.asset_currency || ''}` : '-',
            Owner: asset.asset_owner,
            Description: asset.asset_description,
          };
        } else if (node.data.type === 'SUPPLIER') {
          const supplier = await getSupplierById(node.data.id);
          detailData = {
            'Supplier Name': supplier.supplier_name,
            'Supplier Type': supplier.supplier_type,
            Address: supplier.supplier_add1,
            'Address 2': supplier.supplier_add2,
            City: supplier.supplier_city,
            State: supplier.supplier_state,
            'Pincode': supplier.supplier_pincode,
            Country: supplier.supplier_country,
            'Contact Name': supplier.contact_name,
            'Contact Email': supplier.contact_email,
            'Contact Phone': supplier.contact_phone,
          };
        }

        setDrawerData({
          type: node.data.type as 'ORG' | 'ASSET' | 'SUPPLIER',
          id: node.data.id,
          data: detailData,
        });
      } catch (err) {
        console.error('Failed to load details:', err);
        toast.error('Failed to load details');
      } finally {
        setDrawerLoading(false);
      }
    },
    []
  );

  // Loading state
  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS} onMouseMove={handleMouseMove}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={header.subtitle}
        search={header.searchPlaceholder ? {
          value: searchQuery,
          placeholder: header.searchPlaceholder,
          onChange: setSearchQuery,
          onClear: () => setSearchQuery(''),
          disabled: loading && nodes.length === 0,
        } : undefined}
        stats={headerStats}
        primaryAction={header.primaryAction ? { ...header.primaryAction, onClick: handleFitView, disabled: !reactFlowInstance } : undefined}
        secondaryActions={[
          {
            ...(header.secondaryActions?.[0] ?? { key: "refresh", label: "Refresh", variant: "secondary" }),
            onClick: handleRefresh,
            disabled: loading && nodes.length === 0,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <GraphControls
          filters={filters}
          onFilterChange={handleFilterChange}
          nodeCounts={nodeCounts}
        />

        {loading && nodes.length === 0 ? (
          <div className="flex min-h-[620px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500/20 border-t-blue-500" />
              <p className="text-sm text-slate-500">Loading infrastructure graph...</p>
            </div>
          </div>
        ) : error && nodes.length === 0 ? (
          <div className="flex min-h-[620px] items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
                <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="mb-2 font-medium text-slate-900">{error}</p>
              <button
                onClick={handleRefresh}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="h-[calc(100vh-15rem)] min-h-[760px] overflow-hidden rounded-2xl border border-slate-200 bg-[#0e1117] shadow-sm">
            <ReactFlow
              nodes={filteredNodes}
              edges={filteredEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              onNodeMouseEnter={handleNodeMouseEnter}
              onNodeMouseLeave={handleNodeMouseLeave}
              onInit={(instance) => {
                setReactFlowInstance(instance);
                window.requestAnimationFrame(() => {
                  instance.fitView({ padding: 0.2 });
                });
              }}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.1}
              maxZoom={2}
              defaultEdgeOptions={{
                type: 'smoothstep',
                style: { strokeWidth: 2 },
              }}
              className="h-full w-full bg-[#0e1117]"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={24}
                size={1}
                color="#334155"
                style={{ background: '#0e1117' }}
              />

              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)
                  `,
                  backgroundSize: '40px 40px',
                }}
              />

              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)',
                }}
              />

              <Controls
                className="!rounded-lg !border-slate-700/50 !bg-slate-800/90 !shadow-xl"
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.9)',
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  borderRadius: '8px',
                }}
              />

              <MiniMap
                nodeColor={(node) => {
                  switch (node.data?.type) {
                    case 'ORG':
                      return '#3b82f6';
                    case 'ASSET':
                      return '#22c55e';
                    case 'SUPPLIER':
                      return '#a855f7';
                    default:
                      return '#64748b';
                  }
                }}
                maskColor="rgba(15, 23, 42, 0.8)"
                className="!rounded-lg !border-slate-700/50 !bg-slate-900/90"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(51, 65, 85, 0.5)',
                  borderRadius: '8px',
                }}
              />
            </ReactFlow>

            {hoveredNode && (
              <Tooltip
                data={hoveredNode.data}
                position={{ x: mousePosition.x, y: mousePosition.y }}
              />
            )}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerData ? `${drawerData.type} Detail` : 'Detail'}
        description="Read-only information"
        width="w-[28rem]"
      >
        <div className="p-5">
          {drawerLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : drawerData ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div
                  className={`
                    w-10 h-10 rounded-lg flex items-center justify-center
                    ${drawerData.type === 'ORG' ? 'bg-blue-100 text-blue-600' : ''}
                    ${drawerData.type === 'ASSET' ? 'bg-green-100 text-green-600' : ''}
                    ${drawerData.type === 'SUPPLIER' ? 'bg-purple-100 text-purple-600' : ''}
                  `}
                >
                  {drawerData.type === 'ORG' && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  )}
                  {drawerData.type === 'ASSET' && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                  )}
                  {drawerData.type === 'SUPPLIER' && (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                    </svg>
                  )}
                </div>
                <div>
                  <span
                    className={`
                      inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md
                      ${drawerData.type === 'ORG' ? 'bg-blue-100 text-blue-700' : ''}
                      ${drawerData.type === 'ASSET' ? 'bg-green-100 text-green-700' : ''}
                      ${drawerData.type === 'SUPPLIER' ? 'bg-purple-100 text-purple-700' : ''}
                    `}
                  >
                    {drawerData.type}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                {Object.entries(drawerData.data).map(([key, value]) => (
                  <div key={key} className="flex justify-between items-start">
                    <span className="text-xs text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="text-sm text-slate-800 font-medium text-right max-w-[160px] truncate" title={String(value)}>
                      {value === null || value === undefined || value === '' ? '-' : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No data available</p>
          )}
        </div>
      </Drawer>
    </div>
  );
}

