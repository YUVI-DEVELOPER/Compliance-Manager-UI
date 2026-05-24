import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Edge,
  MiniMap,
  Node,
  NodeTypes,
  ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  AlertTriangle,
  Building2,
  Database,
  ExternalLink,
  Loader2,
  Maximize2,
  Network,
  RefreshCcw,
  RotateCcw,
  Truck,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "../../auth/PermissionGuard";
import { EmptyState, RightPanel, StatusBadge } from "../../components/foundation";
import { GlassNode } from "../../components/graph/CustomNodes";
import { GraphControls } from "../../components/graph/GraphControls";
import { getLayoutedElements, GraphNodeData, NodeType } from "../../components/graph/GraphUtils";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { Button } from "../../components/ui/button";
import { cn } from "../../components/ui/utils";
import { navigateToAsset, navigateToOrg, navigateToSupplier } from "../../utils/moduleNavigation";
import { AssetRecord, getAssetById, getAssets } from "../../../services/asset.service";
import { getOrgById, getOrgTree, OrgNode } from "../../../services/org.service";
import { getSupplierById, getSuppliers, SupplierRecord } from "../../../services/supplier.service";

const nodeTypes: NodeTypes = {
  ORG: GlassNode,
  ASSET: GlassNode,
  SUPPLIER: GlassNode,
  ASSETS_COLLAPSED: GlassNode,
  SUPPLIERS_COLLAPSED: GlassNode,
};

type GraphFilters = Record<string, boolean>;
type NavigableNodeType = "ORG" | "ASSET" | "SUPPLIER";

interface NodeCounts {
  ORG: number;
  ASSET: number;
  SUPPLIER: number;
  [key: string]: number;
}

interface RelationshipGroup {
  label: string;
  items: string[];
  emptyLabel?: string;
}

interface DetailField {
  label: string;
  value: React.ReactNode;
}

interface NodeDetail {
  node: GraphNodeData;
  type: NodeType;
  title: string;
  codeOrId: string;
  status?: string | null;
  fields: DetailField[];
  relationships: RelationshipGroup[];
  metadata: DetailField[];
  navigationId?: string | null;
  viewPermission?: string;
}

const initialFilters: GraphFilters = {
  ORG: true,
  ASSET: true,
  SUPPLIER: true,
};

const typeStyles: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  ORG: {
    label: "Org",
    icon: <Building2 className="h-4 w-4" />,
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  ASSET: {
    label: "Asset",
    icon: <Database className="h-4 w-4" />,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  SUPPLIER: {
    label: "Supplier",
    icon: <Truck className="h-4 w-4" />,
    className: "border-violet-200 bg-violet-50 text-violet-700",
  },
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  const text = String(value).trim();
  return text || "-";
};

const textOrNull = (value: unknown): string | null => {
  const text = formatValue(value);
  return text === "-" ? null : text;
};

const compactList = (items: Array<string | null | undefined>, limit = 5): string[] => {
  const cleaned = items.map((item) => item?.trim()).filter((item): item is string => Boolean(item));
  if (cleaned.length <= limit) return cleaned;
  return [...cleaned.slice(0, limit), `+${cleaned.length - limit} more`];
};

const flattenOrgs = (nodes: OrgNode[]): OrgNode[] =>
  nodes.reduce<OrgNode[]>((accumulator, node) => {
    accumulator.push(node);
    if (node.children?.length) {
      accumulator.push(...flattenOrgs(node.children));
    }
    return accumulator;
  }, []);

const buildOrgMap = (nodes: OrgNode[]): Map<string, OrgNode> => new Map(flattenOrgs(nodes).map((org) => [org.id, org]));

const statusKind = (status?: string | null): "active" | "inactive" | "pending" | "error" => {
  const normalized = (status ?? "").trim().toUpperCase();
  if (!normalized) return "inactive";
  if (normalized.includes("FAILED") || normalized.includes("ERROR") || normalized.includes("REJECT")) return "error";
  if (normalized.includes("PENDING") || normalized.includes("DRAFT") || normalized.includes("UNDER")) return "pending";
  if (normalized.includes("INACTIVE") || normalized.includes("CLOSED") || normalized.includes("DISABLED") || normalized.includes("RETIRED")) {
    return "inactive";
  }
  return "active";
};

const statusLabel = (status?: string | null): string => {
  const text = (status ?? "").trim();
  return text ? text.replace(/_/g, " ") : "Unknown";
};

const field = (label: string, value: React.ReactNode): DetailField => ({ label, value });

const textField = (label: string, value: unknown): DetailField => field(label, formatValue(value));

const metadataValue = (data: GraphNodeData, key: string): string | null => textOrNull(data.metadata[key]);

const searchableText = (node: Node<GraphNodeData>): string =>
  [
    node.id,
    node.data.id,
    node.data.name,
    node.data.type,
    ...Object.entries(node.data.metadata).flatMap(([key, value]) => [key, value]),
  ]
    .filter((value) => value !== null && value !== undefined)
    .join(" ")
    .toLowerCase();

const isNavigableNodeType = (type: NodeType): type is NavigableNodeType => type === "ORG" || type === "ASSET" || type === "SUPPLIER";

const getViewPermission = (type: NodeType): string | undefined => {
  if (type === "ORG") return "ORGANIZATION_VIEW";
  if (type === "ASSET") return "ASSET_VIEW";
  if (type === "SUPPLIER") return "SUPPLIER_VIEW";
  return undefined;
};

const resolveAssetNavigationId = (data: GraphNodeData): string | null => {
  const assetUuid = metadataValue(data, "asset_uuid");
  if (assetUuid) return assetUuid;
  // TODO: Backfill asset_uuid for graph asset nodes that only expose display codes.
  return metadataValue(data, "asset_id") ?? metadataValue(data, "Asset Code") ?? data.id;
};

const resolveNavigationId = (data: GraphNodeData): string | null => {
  if (data.type === "ASSET") return resolveAssetNavigationId(data);
  if (data.type === "SUPPLIER") return metadataValue(data, "supplier_id") ?? data.id;
  if (data.type === "ORG") return metadataValue(data, "org_node_id") ?? data.id;
  return null;
};

const renderStatus = (status?: string | null): React.ReactNode => {
  if (!status) return "-";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <StatusBadge status={statusKind(status)} title={statusLabel(status)} />
      <span className="text-xs font-medium text-slate-600">{statusLabel(status)}</span>
    </span>
  );
};

function buildRelationshipSummary(
  node: GraphNodeData,
  orgTree: OrgNode[],
  assets: AssetRecord[],
  suppliers: SupplierRecord[],
): RelationshipGroup[] {
  const orgMap = buildOrgMap(orgTree);
  const supplierMap = new Map(suppliers.map((supplier) => [supplier.supplier_id, supplier]));

  if (node.type === "ORG") {
    const org = orgMap.get(node.id);
    const childNames = compactList(org?.children?.map((child) => child.name) ?? []);
    const orgAssets = assets.filter((asset) => asset.org_node_id === node.id);
    const relatedSupplierNames = compactList(
      [...new Set(orgAssets.map((asset) => asset.supplier_id).filter(Boolean) as string[])]
        .map((supplierId) => supplierMap.get(supplierId)?.supplier_name ?? supplierId),
    );
    return [
      {
        label: "Parent",
        items: compactList([org?.parent_id ? orgMap.get(org.parent_id)?.name ?? org.parent_id : "Top level"]),
      },
      { label: "Child orgs", items: childNames, emptyLabel: "No child orgs" },
      {
        label: "Connected assets",
        items: compactList(orgAssets.map((asset) => asset.asset_name || asset.asset_id || asset.asset_uuid)),
        emptyLabel: "No connected assets",
      },
      { label: "Connected suppliers", items: relatedSupplierNames, emptyLabel: "No connected suppliers" },
    ];
  }

  if (node.type === "ASSET") {
    const assetUuid = metadataValue(node, "asset_uuid");
    const asset = assets.find((item) => item.asset_uuid === assetUuid || item.asset_id === node.id || item.asset_code === node.id);
    const org = asset?.org_node_id ? orgMap.get(asset.org_node_id) : null;
    const supplier = asset?.supplier_id ? supplierMap.get(asset.supplier_id) : null;
    return [
      { label: "Owning org", items: compactList([org?.name ?? asset?.org_node_name ?? metadataValue(node, "Organization")]), emptyLabel: "No org linked" },
      { label: "Supplier", items: compactList([supplier?.supplier_name ?? asset?.supplier_name ?? metadataValue(node, "Supplier")]), emptyLabel: "No supplier linked" },
    ];
  }

  if (node.type === "SUPPLIER") {
    const supplierAssets = assets.filter((asset) => asset.supplier_id === node.id);
    const relatedOrgs = compactList(
      [...new Set(supplierAssets.map((asset) => asset.org_node_id).filter(Boolean) as string[])]
        .map((orgId) => orgMap.get(orgId)?.name ?? orgId),
    );
    return [
      {
        label: "Provided assets",
        items: compactList(supplierAssets.map((asset) => asset.asset_name || asset.asset_id || asset.asset_uuid)),
        emptyLabel: "No connected assets",
      },
      { label: "Connected orgs", items: relatedOrgs, emptyLabel: "No connected orgs" },
    ];
  }

  return [{ label: "Connections", items: [], emptyLabel: "No relationship summary available" }];
}

function buildDetailFromNode(
  node: GraphNodeData,
  orgTree: OrgNode[],
  assets: AssetRecord[],
  suppliers: SupplierRecord[],
  record?: OrgNode | AssetRecord | SupplierRecord | null,
): NodeDetail {
  const type = node.type;
  const recordData = record as Record<string, unknown> | null | undefined;
  const codeOrId =
    type === "ORG"
      ? formatValue(recordData?.code ?? node.metadata.code ?? node.id)
      : type === "ASSET"
        ? formatValue(recordData?.asset_id ?? node.metadata.asset_id ?? node.metadata["Asset Code"] ?? node.id)
        : type === "SUPPLIER"
          ? formatValue(recordData?.supplier_id ?? node.metadata.supplier_id ?? node.id)
          : formatValue(node.id);
  const status =
    type === "ORG"
      ? textOrNull(recordData?.status ?? node.metadata.status)
      : type === "ASSET"
        ? textOrNull(recordData?.asset_status ?? node.metadata.Status)
        : textOrNull(node.metadata.status ?? node.metadata.Status);

  const title =
    type === "ORG"
      ? formatValue(recordData?.name ?? node.name)
      : type === "ASSET"
        ? formatValue(recordData?.asset_name ?? node.name)
        : type === "SUPPLIER"
          ? formatValue(recordData?.supplier_name ?? node.name)
          : node.name;

  const baseFields: DetailField[] = [
    textField("Name", title),
    textField(type === "ASSET" ? "Asset ID" : type === "SUPPLIER" ? "Supplier ID" : "Code / ID", codeOrId),
    field("Status", renderStatus(status)),
  ];

  let detailFields: DetailField[] = [];
  if (type === "ORG") {
    detailFields = [
      textField("Org Type", recordData?.type ?? node.metadata.type ?? node.metadata["Org Type"]),
      textField("City", recordData?.city ?? node.metadata.city),
      textField("Country", recordData?.country ?? node.metadata.country),
      textField("Parent ID", recordData?.parent_id ?? node.metadata.parent_id),
    ];
  } else if (type === "ASSET") {
    detailFields = [
      textField("UUID", recordData?.asset_uuid ?? node.metadata.asset_uuid),
      textField("Asset Code", recordData?.asset_code ?? node.metadata["Asset Code"]),
      textField("Type", recordData?.asset_type ?? node.metadata.Type),
      textField("Criticality", recordData?.asset_criticality ?? recordData?.criticality_class ?? node.metadata.Criticality),
      textField("Owner", recordData?.asset_owner ?? node.metadata.Owner),
      textField("Manufacturer", recordData?.manufacturer ?? node.metadata.Manufacturer),
      textField("Model", recordData?.model ?? node.metadata.Model),
      textField("Version", recordData?.asset_version ?? node.metadata.Version),
    ];
  } else if (type === "SUPPLIER") {
    detailFields = [
      textField("Supplier Type", recordData?.supplier_type ?? node.metadata["Supplier Type"]),
      textField("City", recordData?.supplier_city ?? node.metadata.City),
      textField("Country", recordData?.supplier_country ?? node.metadata.Country),
      textField("Contact Name", recordData?.contact_name ?? node.metadata["Contact Name"]),
      textField("Contact Email", recordData?.contact_email ?? node.metadata["Contact Email"]),
      textField("Contact Phone", recordData?.contact_phone),
    ];
  } else {
    detailFields = Object.entries(node.metadata)
      .slice(0, 8)
      .map(([key, value]) => textField(key.replace(/_/g, " "), value));
  }

  return {
    node,
    type,
    title,
    codeOrId,
    status,
    fields: [...baseFields, ...detailFields],
    relationships: buildRelationshipSummary(node, orgTree, assets, suppliers),
    metadata: Object.entries(node.metadata)
      .filter(([, value]) => textOrNull(value))
      .slice(0, 8)
      .map(([key, value]) => textField(key.replace(/_/g, " "), value)),
    navigationId: resolveNavigationId(node),
    viewPermission: getViewPermission(type),
  };
}

function GraphLoadingState() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-center shadow-sm">
        <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium text-slate-700">Loading infrastructure graph...</p>
      </div>
    </div>
  );
}

interface ZoomToolbarProps {
  disabled: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onReset: () => void;
}

function ZoomToolbar({ disabled, onZoomIn, onZoomOut, onFitView, onReset }: ZoomToolbarProps) {
  const controls = [
    { key: "zoom-in", label: "Zoom in", icon: <ZoomIn className="h-4 w-4" />, onClick: onZoomIn },
    { key: "zoom-out", label: "Zoom out", icon: <ZoomOut className="h-4 w-4" />, onClick: onZoomOut },
    { key: "fit", label: "Fit view", icon: <Maximize2 className="h-4 w-4" />, onClick: onFitView },
    { key: "reset", label: "Reset", icon: <RotateCcw className="h-4 w-4" />, onClick: onReset },
  ];

  return (
    <div className="nodrag nowheel pointer-events-auto absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-lg border border-white/80 bg-white/95 p-1.5 shadow-xl backdrop-blur">
      {controls.map((control) => (
        <Button
          key={control.key}
          type="button"
          variant="ghost"
          size="icon"
          onClick={control.onClick}
          disabled={disabled}
          title={control.label}
          aria-label={control.label}
          className="h-8 w-8 rounded-md text-slate-700 hover:bg-slate-100"
        >
          {control.icon}
        </Button>
      ))}
    </div>
  );
}

export function GraphHierarchyPage() {
  const header = getPageHeaderConfig("infrastructure-graph");
  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GraphFilters>(initialFilters);
  const [searchQuery, setSearchQuery] = useState("");
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<NodeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const orgTreeRef = useRef<OrgNode[]>([]);
  const assetsRef = useRef<AssetRecord[]>([]);
  const suppliersRef = useRef<SupplierRecord[]>([]);

  const nodeCounts = useMemo<NodeCounts>(() => {
    const counts: NodeCounts = { ORG: 0, ASSET: 0, SUPPLIER: 0 };
    nodes.forEach((node) => {
      counts[node.data.type] = (counts[node.data.type] ?? 0) + 1;
    });
    return counts;
  }, [nodes]);

  const headerStats = buildPageHeaderStats(header.stats, {
    orgs: nodeCounts.ORG,
    assets: nodeCounts.ASSET,
    suppliers: nodeCounts.SUPPLIER,
  });

  const buildGraph = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [orgs, assets, suppliers] = await Promise.all([getOrgTree(), getAssets(), getSuppliers()]);

      orgTreeRef.current = orgs;
      assetsRef.current = assets;
      suppliersRef.current = suppliers;

      const flatOrgs = flattenOrgs(orgs);
      const orgMap = new Map(flatOrgs.map((org) => [org.id, org]));
      const supplierMap = new Map(suppliers.map((supplier) => [supplier.supplier_id, supplier]));
      const graphNodes: Node<GraphNodeData>[] = [];
      const graphEdges: Edge[] = [];

      flatOrgs.forEach((org) => {
        const orgAssets = assets.filter((asset) => asset.org_node_id === org.id);
        graphNodes.push({
          id: `org_${org.id}`,
          type: "ORG",
          data: {
            id: org.id,
            type: "ORG",
            name: org.name,
            metadata: {
              org_node_id: org.id,
              code: org.code,
              type: org.type,
              status: org.status,
              city: org.city,
              country: org.country,
              parent_id: org.parent_id,
              "Assets Count": orgAssets.length,
              "Child Orgs": org.children?.length ?? 0,
            },
          },
          position: { x: 0, y: 0 },
        });
      });

      assets.forEach((asset) => {
        const supplier = asset.supplier_id ? supplierMap.get(asset.supplier_id) : null;
        const assetNodeId = `asset_${asset.asset_uuid || asset.asset_id}`;
        graphNodes.push({
          id: assetNodeId,
          type: "ASSET",
          data: {
            id: asset.asset_id || asset.asset_uuid,
            type: "ASSET",
            name: asset.asset_name || asset.asset_code || asset.asset_id || "Unnamed Asset",
            metadata: {
              asset_uuid: asset.asset_uuid,
              asset_id: asset.asset_id,
              "Asset Code": asset.asset_code,
              Type: asset.asset_type,
              Status: asset.asset_status,
              Criticality: asset.asset_criticality ?? asset.criticality_class,
              Organization: asset.org_node_name,
              org_node_id: asset.org_node_id,
              Supplier: supplier?.supplier_name || asset.supplier_name || "-",
              supplier_id: asset.supplier_id,
              Value: asset.asset_value ? `${asset.asset_value} ${asset.asset_currency || ""}` : "-",
              Manufacturer: asset.manufacturer,
              Model: asset.model,
              Version: asset.asset_version,
            },
          },
          position: { x: 0, y: 0 },
        });
      });

      suppliers.forEach((supplier) => {
        const supplierAssets = assets.filter((asset) => asset.supplier_id === supplier.supplier_id);
        graphNodes.push({
          id: `supplier_${supplier.supplier_id}`,
          type: "SUPPLIER",
          data: {
            id: supplier.supplier_id,
            type: "SUPPLIER",
            name: supplier.supplier_name,
            metadata: {
              supplier_id: supplier.supplier_id,
              "Supplier Type": supplier.supplier_type,
              City: supplier.supplier_city,
              State: supplier.supplier_state,
              Country: supplier.supplier_country,
              "Assets Provided": supplierAssets.length,
              "Contact Name": supplier.contact_name,
              "Contact Email": supplier.contact_email,
            },
          },
          position: { x: 0, y: 0 },
        });
      });

      flatOrgs.forEach((org) => {
        if (org.parent_id && orgMap.has(org.parent_id)) {
          graphEdges.push({
            id: `edge_org_${org.parent_id}_org_${org.id}`,
            source: `org_${org.parent_id}`,
            target: `org_${org.id}`,
            type: "smoothstep",
            style: { stroke: "#2563eb", strokeWidth: 2 },
          });
        }
      });

      assets.forEach((asset) => {
        const assetNodeId = `asset_${asset.asset_uuid || asset.asset_id}`;
        if (asset.org_node_id && orgMap.has(asset.org_node_id)) {
          graphEdges.push({
            id: `edge_org_${asset.org_node_id}_${assetNodeId}`,
            source: `org_${asset.org_node_id}`,
            target: assetNodeId,
            type: "smoothstep",
            style: { stroke: "#0284c7", strokeWidth: 2 },
          });
        }
        if (asset.supplier_id && supplierMap.has(asset.supplier_id)) {
          graphEdges.push({
            id: `edge_${assetNodeId}_supplier_${asset.supplier_id}`,
            source: assetNodeId,
            target: `supplier_${asset.supplier_id}`,
            type: "smoothstep",
            style: { stroke: "#7c3aed", strokeWidth: 2 },
          });
        }
      });

      const layouted = getLayoutedElements(graphNodes, graphEdges, "LR");
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
      setFilters((previous) => {
        const next = { ...initialFilters, ...previous };
        graphNodes.forEach((node) => {
          if (next[node.data.type] === undefined) next[node.data.type] = true;
        });
        return next;
      });
    } catch (err) {
      console.error("Failed to load graph data:", err);
      setError("Unable to load infrastructure graph");
      toast.error("Failed to load infrastructure graph data");
    } finally {
      setLoading(false);
    }
  }, [setEdges, setNodes]);

  useEffect(() => {
    void buildGraph();
  }, [buildGraph]);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const typeFilteredNodes = useMemo(
    () => nodes.filter((node) => filters[node.data.type] !== false),
    [filters, nodes],
  );

  const matchingNodeIds = useMemo(() => {
    if (!normalizedSearch) return new Set<string>();
    return new Set(typeFilteredNodes.filter((node) => searchableText(node).includes(normalizedSearch)).map((node) => node.id));
  }, [normalizedSearch, typeFilteredNodes]);

  const hasNoSearchMatches = Boolean(normalizedSearch && typeFilteredNodes.length > 0 && matchingNodeIds.size === 0);

  const displayNodes = useMemo(() => {
    if (hasNoSearchMatches) return [];
    return typeFilteredNodes.map((node) => {
      const isMatch = Boolean(normalizedSearch && matchingNodeIds.has(node.id));
      return {
        ...node,
        data: {
          ...node.data,
          searchMatched: isMatch,
          dimmed: Boolean(normalizedSearch && !isMatch),
        },
      };
    });
  }, [hasNoSearchMatches, matchingNodeIds, normalizedSearch, typeFilteredNodes]);

  const displayEdges = useMemo(() => {
    const visibleNodeIds = new Set(displayNodes.map((node) => node.id));
    const activeSearch = Boolean(normalizedSearch && matchingNodeIds.size > 0);
    return edges
      .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
      .map((edge) => {
        if (!activeSearch) return edge;
        const connectedToMatch = matchingNodeIds.has(edge.source) || matchingNodeIds.has(edge.target);
        return {
          ...edge,
          animated: connectedToMatch,
          style: {
            ...edge.style,
            opacity: connectedToMatch ? 0.95 : 0.18,
            strokeWidth: connectedToMatch ? 3 : 1.5,
          },
        };
      });
  }, [displayNodes, edges, matchingNodeIds, normalizedSearch]);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setFilters((previous) => Object.fromEntries(Object.keys(previous).map((key) => [key, true])));
  }, []);

  const handleFilterChange = useCallback((type: string, checked: boolean) => {
    setFilters((previous) => ({ ...previous, [type]: checked }));
  }, []);

  const handleFitView = useCallback(() => {
    reactFlowInstance?.fitView({ padding: 0.18, duration: 300 });
  }, [reactFlowInstance]);

  const handleZoomIn = useCallback(() => {
    reactFlowInstance?.zoomIn({ duration: 200 });
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance?.zoomOut({ duration: 200 });
  }, [reactFlowInstance]);

  const handleResetView = useCallback(() => {
    reactFlowInstance?.setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 300 });
  }, [reactFlowInstance]);

  const handleRefresh = useCallback(() => {
    void buildGraph();
  }, [buildGraph]);

  useEffect(() => {
    if (!reactFlowInstance || displayNodes.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      reactFlowInstance.fitView({ padding: 0.18, duration: 250 });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [displayEdges.length, displayNodes.length, reactFlowInstance]);

  const handleNodeClick = useCallback(
    async (event: React.MouseEvent, node: Node<GraphNodeData>) => {
      event.stopPropagation();

      const baseDetail = buildDetailFromNode(node.data, orgTreeRef.current, assetsRef.current, suppliersRef.current);
      setSelectedDetail(baseDetail);

      if (!isNavigableNodeType(node.data.type)) return;

      setDetailLoading(true);
      try {
        let detailRecord: OrgNode | AssetRecord | SupplierRecord | null = null;
        if (node.data.type === "ORG") {
          detailRecord = await getOrgById(node.data.id);
        } else if (node.data.type === "ASSET") {
          const assetUuid = metadataValue(node.data, "asset_uuid");
          if (assetUuid) {
            detailRecord = await getAssetById(assetUuid);
          }
        } else if (node.data.type === "SUPPLIER") {
          detailRecord = await getSupplierById(node.data.id);
        }
        setSelectedDetail(buildDetailFromNode(node.data, orgTreeRef.current, assetsRef.current, suppliersRef.current, detailRecord));
      } catch (err) {
        console.error("Failed to load graph node detail:", err);
        toast.error("Failed to load node detail");
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  const handleViewRecord = useCallback(() => {
    if (!selectedDetail?.navigationId || !isNavigableNodeType(selectedDetail.type)) return;
    if (selectedDetail.type === "ASSET") navigateToAsset(selectedDetail.navigationId);
    if (selectedDetail.type === "SUPPLIER") navigateToSupplier(selectedDetail.navigationId);
    if (selectedDetail.type === "ORG") navigateToOrg(selectedDetail.navigationId);
  }, [selectedDetail]);

  const graphIsEmpty = !loading && !error && nodes.length === 0;
  const noVisibleNodes = !loading && !error && nodes.length > 0 && displayNodes.length === 0;
  const noVisibleReason = hasNoSearchMatches ? "No nodes match the current search." : "No nodes match the selected filters.";
  const graphReady = !loading || nodes.length > 0;

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Infrastructure Graph"
        subtitle="Explore organization, asset, and supplier relationships"
        stats={headerStats}
        primaryAction={header.primaryAction ? { ...header.primaryAction, onClick: handleFitView, disabled: !reactFlowInstance } : undefined}
        secondaryActions={[
          {
            ...(header.secondaryActions?.[0] ?? { key: "refresh", label: "Refresh", variant: "secondary", icon: "refresh" }),
            onClick: handleRefresh,
            disabled: loading && nodes.length === 0,
          },
        ]}
      />

      <div className={cn(PAGE_CONTENT_CLASS, "min-h-0")}>
        <div className="relative h-[calc(100vh-13.5rem)] min-h-[640px] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
          {graphReady && !error && nodes.length > 0 ? (
            <ReactFlow
              nodes={displayNodes}
              edges={displayEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              onNodeClick={handleNodeClick}
              onInit={(instance) => {
                setReactFlowInstance(instance);
                window.requestAnimationFrame(() => instance.fitView({ padding: 0.18 }));
              }}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              minZoom={0.12}
              maxZoom={2.4}
              defaultEdgeOptions={{
                type: "smoothstep",
                style: { strokeWidth: 2 },
              }}
              className="h-full min-h-[640px] w-full bg-slate-50"
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1.3} color="#cbd5e1" />

              <div className="absolute left-4 top-4 z-20">
                <GraphControls
                  filters={filters}
                  onFilterChange={handleFilterChange}
                  nodeCounts={nodeCounts}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onClear={clearFilters}
                  disabled={loading && nodes.length === 0}
                />
              </div>

              <MiniMap
                nodeColor={(node) => {
                  switch (node.data?.type) {
                    case "ORG":
                      return "#2563eb";
                    case "ASSET":
                      return "#059669";
                    case "SUPPLIER":
                      return "#7c3aed";
                    default:
                      return "#64748b";
                  }
                }}
                maskColor="rgba(226, 232, 240, 0.72)"
                pannable
                zoomable
                className="!bottom-4 !left-4 !rounded-lg !border !border-white/80 !bg-white/95 !shadow-xl"
              />
            </ReactFlow>
          ) : null}

          {loading && nodes.length === 0 ? <GraphLoadingState /> : null}

          {error && nodes.length === 0 ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 p-6">
              <EmptyState
                title="Graph failed to load"
                description={error}
                icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
                action={
                  <Button type="button" variant="secondary" onClick={handleRefresh}>
                    <RefreshCcw className="h-4 w-4" />
                    Try Again
                  </Button>
                }
                className="min-h-56 max-w-lg border-slate-300 bg-white"
              />
            </div>
          ) : null}

          {graphIsEmpty ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50 p-6">
              <EmptyState
                title="No graph data"
                description="No organization, asset, or supplier relationships are available."
                icon={<Network className="h-5 w-5 text-slate-500" />}
                action={
                  <Button type="button" variant="secondary" onClick={handleRefresh}>
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </Button>
                }
                className="min-h-56 max-w-lg border-slate-300 bg-white"
              />
            </div>
          ) : null}

          {noVisibleNodes ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/85 p-6 backdrop-blur-sm">
              <EmptyState
                title="No matching nodes"
                description={noVisibleReason}
                action={
                  <Button type="button" variant="secondary" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                }
                className="min-h-52 max-w-lg border-slate-300 bg-white"
              />
            </div>
          ) : null}

          {loading && nodes.length > 0 ? (
            <div className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-lg border border-white/80 bg-white/95 px-3 py-2 text-xs font-medium text-slate-600 shadow-lg">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              Refreshing
            </div>
          ) : null}

          <ZoomToolbar
            disabled={!reactFlowInstance || displayNodes.length === 0}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitView={handleFitView}
            onReset={handleResetView}
          />
        </div>
      </div>

      <RightPanel
        open={Boolean(selectedDetail)}
        onClose={() => setSelectedDetail(null)}
        title={selectedDetail?.title ?? "Node Detail"}
        description={selectedDetail ? `${typeStyles[selectedDetail.type]?.label ?? selectedDetail.type} node` : undefined}
        widthClassName="max-w-lg"
        footer={
          selectedDetail?.navigationId && selectedDetail.viewPermission ? (
            <PermissionGuard
              permission={selectedDetail.viewPermission}
              fallback={
                <Button type="button" fullWidth disabled>
                  View Record
                </Button>
              }
            >
              <Button type="button" fullWidth onClick={handleViewRecord}>
                <ExternalLink className="h-4 w-4" />
                View Record
              </Button>
            </PermissionGuard>
          ) : (
            <Button type="button" fullWidth disabled>
              View Record
            </Button>
          )
        }
      >
        {selectedDetail ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border", typeStyles[selectedDetail.type]?.className ?? "border-slate-200 bg-slate-100 text-slate-700")}>
                {typeStyles[selectedDetail.type]?.icon ?? <Network className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold", typeStyles[selectedDetail.type]?.className ?? "border-slate-200 bg-slate-100 text-slate-700")}>
                    {typeStyles[selectedDetail.type]?.label ?? selectedDetail.type}
                  </span>
                  {selectedDetail.status ? renderStatus(selectedDetail.status) : null}
                </div>
                <p className="mt-2 truncate text-base font-semibold text-slate-900">{selectedDetail.title}</p>
                <p className="mt-1 break-all font-mono text-xs text-slate-500">{selectedDetail.codeOrId}</p>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading latest detail
              </div>
            ) : null}

            <DetailSection title="Business Detail" fields={selectedDetail.fields} />

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Relationships</h3>
              <div className="space-y-2">
                {selectedDetail.relationships.map((group) => (
                  <div key={group.label} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <p className="text-xs font-medium text-slate-500">{group.label}</p>
                    {group.items.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {group.items.map((item) => (
                          <span key={item} className="max-w-full truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700" title={item}>
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">{group.emptyLabel ?? "No related records"}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <DetailSection title="Linked Metadata" fields={selectedDetail.metadata} compact />
          </div>
        ) : (
          <EmptyState title="No node selected" description="Select a graph node to view detail." />
        )}
      </RightPanel>
    </div>
  );
}

function DetailSection({ title, fields, compact = false }: { title: string; fields: DetailField[]; compact?: boolean }) {
  const visibleFields = fields.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
  if (!visibleFields.length) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      <div className={compact ? "space-y-2" : "grid grid-cols-1 gap-2"}>
        {visibleFields.map((item) => (
          <div key={item.label} className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <div className="mt-1 break-words text-sm font-medium text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
