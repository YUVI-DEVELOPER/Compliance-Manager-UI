import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  ChevronRight,
  CircleDot,
  GitBranch,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "../../auth/PermissionGuard";
import { LookupOption, getLookupOptionsByMasterCode } from "../../services/lookupValue.service";
import {
  OrgNode,
  OrgPayload,
  createOrg,
  deleteOrg,
  getOrgById,
  getOrgHealth,
  getOrgTree,
  updateOrg,
} from "../../../services/org.service";
import { ConfirmStrip, EmptyState, StatusBadge } from "../foundation";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input, SearchInput } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { cn } from "../ui/utils";
import { OrgRoleAssignmentsPanel } from "./OrgRoleAssignmentsPanel";
import { buildLookupLabelMap, getLookupLabel } from "./orgUiLabels";

interface OrgHeaderControls {
  refresh: () => void;
  createRoot: () => void;
  refreshDisabled: boolean;
  createRootDisabled: boolean;
  showCreateRoot: boolean;
}

interface OrgHierarchyWorkspaceProps {
  actorName?: string | null;
  actorId?: string | null;
  defaultUser?: string | null;
  onSummaryChange?: (summary: {
    total: number;
    active: number;
    leaders: number;
    topLevel: number;
  }) => void;
  onHeaderControlsChange?: (controls: OrgHeaderControls) => void;
}

interface FieldErrors {
  [key: string]: string;
}

interface OrgFormState {
  name: string;
  code: string;
  type: string;
  status: string;
  parent_id: string;
  address: string;
  city: string;
  state: string;
  country: string;
  lat: string;
  long: string;
}

interface ParentOption {
  id: string;
  name: string;
  type: string;
  status: string;
  level: number;
}

type ContextMode = "view" | "form" | "roles";
type OrgFormMode = "createRoot" | "addChild" | "editNode";

const LEGACY_ORG_TYPES = ["GROUP", "COMPANY", "DIVISION", "PLANT", "SECTION", "DEPARTMENT"] as const;
const ROOT_TYPE = "GROUP";
const CODE_PATTERN = /^[A-Z0-9-]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_STATUS_OPTIONS = [
  { code: "ACTIVE", value: "Active" },
  { code: "INACTIVE", value: "Inactive" },
  { code: "MERGED", value: "Merged" },
  { code: "CLOSED", value: "Closed" },
  { code: "UNDER_CONSTRUCTION", value: "Under Construction" },
] as const;

const NEXT_TYPE_BY_PARENT = LEGACY_ORG_TYPES.reduce<Record<string, string | null>>((accumulator, type, index) => {
  accumulator[type] = LEGACY_ORG_TYPES[index + 1] ?? null;
  return accumulator;
}, {});

const EMPTY_FORM: OrgFormState = {
  name: "",
  code: "",
  type: "",
  status: "ACTIVE",
  parent_id: "",
  address: "",
  city: "",
  state: "",
  country: "",
  lat: "",
  long: "",
};

const typeBadgeClasses: Record<string, string> = {
  GROUP: "border-blue-200 bg-blue-50 text-blue-700",
  COMPANY: "border-violet-200 bg-violet-50 text-violet-700",
  DIVISION: "border-emerald-200 bg-emerald-50 text-emerald-700",
  PLANT: "border-amber-200 bg-amber-50 text-amber-700",
  SECTION: "border-rose-200 bg-rose-50 text-rose-700",
  DEPARTMENT: "border-slate-200 bg-slate-100 text-slate-700",
};

const statusBadgeClasses: Record<string, string> = {
  MERGED: "border-violet-200 bg-violet-50 text-violet-700",
  CLOSED: "border-slate-300 bg-slate-200 text-slate-700",
  UNDER_CONSTRUCTION: "border-amber-200 bg-amber-50 text-amber-700",
};

const normalizeNode = (node: OrgNode): OrgNode => ({
  ...node,
  parent_id: node.parent_id ?? null,
  type: node.type.toUpperCase(),
  status: node.status.toUpperCase(),
  children: (node.children ?? []).map(normalizeNode),
});

const sortOrgTypeCodes = (codes: string[]): string[] => {
  const seen = new Set(codes);
  const legacyOrdered = LEGACY_ORG_TYPES.filter((code) => seen.has(code));
  const extras = codes.filter((code) => !LEGACY_ORG_TYPES.includes(code as (typeof LEGACY_ORG_TYPES)[number])).sort();
  return [...legacyOrdered, ...extras];
};

const getSuggestedChildType = (parentType: string | null | undefined, availableTypes: string[]): string => {
  if (!parentType) return availableTypes.includes(ROOT_TYPE) ? ROOT_TYPE : availableTypes[0] ?? "";
  const suggested = NEXT_TYPE_BY_PARENT[parentType.toUpperCase()];
  if (suggested && availableTypes.includes(suggested)) return suggested;
  return availableTypes[0] ?? "";
};

const buildNodeMap = (nodes: OrgNode[]): Map<string, OrgNode> => {
  const map = new Map<string, OrgNode>();
  const stack = [...nodes];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    map.set(current.id, current);
    (current.children ?? []).forEach((child) => stack.push(child));
  }

  return map;
};

const buildParentMap = (nodes: OrgNode[]): Map<string, OrgNode | null> => {
  const map = new Map<string, OrgNode | null>();
  const visit = (node: OrgNode, parent: OrgNode | null) => {
    map.set(node.id, parent);
    (node.children ?? []).forEach((child) => visit(child, node));
  };
  nodes.forEach((node) => visit(node, null));
  return map;
};

const flattenTree = (nodes: OrgNode[], level = 0): ParentOption[] => {
  const items: ParentOption[] = [];
  nodes.forEach((node) => {
    items.push({ id: node.id, name: node.name, type: node.type, status: node.status, level });
    items.push(...flattenTree(node.children ?? [], level + 1));
  });
  return items;
};

const collectDescendantIds = (node: OrgNode | null | undefined): Set<string> => {
  const ids = new Set<string>();
  const stack = [...(node?.children ?? [])];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    ids.add(current.id);
    (current.children ?? []).forEach((child) => stack.push(child));
  }

  return ids;
};

const filterTree = (nodes: OrgNode[], query: string): OrgNode[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return nodes;

  return nodes.reduce<OrgNode[]>((filtered, node) => {
    const childMatches = filterTree(node.children ?? [], normalizedQuery);
    const nodeMatches = [node.name, node.code, node.type]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery));

    if (nodeMatches || childMatches.length > 0) {
      filtered.push({ ...node, children: childMatches });
    }

    return filtered;
  }, []);
};

const mapAxiosError = (error: unknown): { message: string; status?: number; fieldErrors?: FieldErrors } => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : "Unexpected error occurred" };
  }

  const status = error.response?.status;
  const data = error.response?.data as { message?: string; detail?: unknown } | undefined;
  const message =
    (typeof data?.detail === "string" && data.detail.trim())
    || (typeof data?.message === "string" && data.message.trim())
    || error.message
    || "Request failed";
  const fieldErrors: FieldErrors = {};

  if (Array.isArray(data?.detail)) {
    data.detail.forEach((item) => {
      if (typeof item !== "object" || item === null) return;
      const loc = (item as { loc?: unknown }).loc;
      const msg = (item as { msg?: string }).msg;
      const field = Array.isArray(loc) && loc.length > 0 ? String(loc[loc.length - 1]) : "form";
      fieldErrors[field] = msg ?? "Invalid value";
    });
  }

  return { message, status, fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined };
};

const toFormState = (node: OrgNode | null): OrgFormState =>
  node
    ? {
        name: node.name ?? "",
        code: node.code ?? "",
        type: node.type ?? "",
        status: node.status ?? "ACTIVE",
        parent_id: node.parent_id ?? "",
        address: node.address ?? "",
        city: node.city ?? "",
        state: node.state ?? "",
        country: node.country ?? "",
        lat: node.lat === null || node.lat === undefined ? "" : String(node.lat),
        long: node.long === null || node.long === undefined ? "" : String(node.long),
      }
    : { ...EMPTY_FORM };

const formatCoord = (value?: number | null): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return String(value);
};

const parseOptionalNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Number(trimmed);
};

const TypeBadge = ({ type, label }: { type: string; label: string }) => (
  <Badge variant="outline" className={cn("uppercase", typeBadgeClasses[type] ?? "border-slate-200 bg-slate-100 text-slate-700")}>
    {label}
  </Badge>
);

const OrgStatusBadge = ({ status, label }: { status: string; label: string }) => {
  if (status === "ACTIVE") return <StatusBadge status="active" />;
  if (status === "INACTIVE") return <StatusBadge status="inactive" />;

  return (
    <Badge variant="outline" className={cn("uppercase", statusBadgeClasses[status] ?? "border-slate-200 bg-slate-100 text-slate-700")}>
      {label}
    </Badge>
  );
};

const TreeNodeItem = ({
  node,
  depth,
  selectedOrgId,
  expandedIds,
  searchActive,
  onToggle,
  onSelect,
  resolveTypeLabel,
  resolveStatusLabel,
}: {
  node: OrgNode;
  depth: number;
  selectedOrgId: string | null;
  expandedIds: Set<string>;
  searchActive: boolean;
  onToggle: (orgId: string) => void;
  onSelect: (orgId: string) => void;
  resolveTypeLabel: (typeCode: string) => string;
  resolveStatusLabel: (statusCode: string) => string;
}) => {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const expanded = searchActive || expandedIds.has(node.id);
  const isSelected = selectedOrgId === node.id;

  return (
    <div className="relative">
      <div
        className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 py-1"
        style={{ paddingLeft: depth * 18 }}
      >
        <div className="flex justify-center pt-2">
          {hasChildren ? (
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              onClick={() => onToggle(node.id)}
              aria-label={expanded ? "Collapse organization" : "Expand organization"}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-90")} />
            </button>
          ) : (
            <span className="flex h-6 w-6 items-center justify-center text-slate-400">
              <CircleDot className="h-3.5 w-3.5" />
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className={cn(
            "min-h-[76px] w-full rounded-md border px-3 py-2.5 text-left transition-colors",
            isSelected
              ? "border-blue-300 bg-blue-50 shadow-sm ring-1 ring-blue-100"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{node.name}</div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                <span className="truncate font-mono text-xs uppercase tracking-wide text-slate-500">{node.code}</span>
                <TypeBadge type={node.type} label={resolveTypeLabel(node.type)} />
              </div>
            </div>
            <OrgStatusBadge status={node.status} label={resolveStatusLabel(node.status)} />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <GitBranch className="h-3.5 w-3.5" />
            <span>{node.children?.length ?? 0} child unit{(node.children?.length ?? 0) === 1 ? "" : "s"}</span>
          </div>
        </button>
      </div>

      {expanded && hasChildren ? (
        <div>
          {node.children?.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedOrgId={selectedOrgId}
              expandedIds={expandedIds}
              searchActive={searchActive}
              onToggle={onToggle}
              onSelect={onSelect}
              resolveTypeLabel={resolveTypeLabel}
              resolveStatusLabel={resolveStatusLabel}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-sm font-medium text-slate-800">{children}</div>
    </div>
  );
}

function FormField({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function OrgHierarchyWorkspace({
  actorName,
  actorId,
  defaultUser,
  onSummaryChange,
  onHeaderControlsChange,
}: OrgHierarchyWorkspaceProps) {
  const auditActor = actorName ?? defaultUser ?? null;
  const deleteActorId = actorId && UUID_PATTERN.test(actorId) ? actorId : null;
  const [isHealthy, setIsHealthy] = useState(true);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [contextMode, setContextMode] = useState<ContextMode>("view");
  const [formMode, setFormMode] = useState<OrgFormMode>("createRoot");
  const [formData, setFormData] = useState<OrgFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orgTypeOptions, setOrgTypeOptions] = useState<LookupOption[]>([]);
  const [statusOptions, setStatusOptions] = useState<LookupOption[]>([]);
  const [countryOptions, setCountryOptions] = useState<LookupOption[]>([]);
  const selectedOrgIdRef = useRef<string | null>(null);

  const nodeMap = useMemo(() => buildNodeMap(tree), [tree]);
  const parentMap = useMemo(() => buildParentMap(tree), [tree]);
  const selectedTreeNode = selectedOrgId ? nodeMap.get(selectedOrgId) ?? null : null;
  const detailNode = selectedNode ?? selectedTreeNode;
  const selectedChildren = selectedTreeNode?.children ?? [];
  const rootExists = tree.length > 0;
  const parentOptions = useMemo(() => flattenTree(tree), [tree]);
  const descendantIds = useMemo(() => collectDescendantIds(selectedTreeNode), [selectedTreeNode]);
  const allOrganizations = useMemo(() => Array.from(nodeMap.values()), [nodeMap]);
  const filteredTree = useMemo(() => filterTree(tree, searchInput), [searchInput, tree]);
  const searchActive = searchInput.trim().length > 0;
  const disabled = !isHealthy;
  const allOrgTypeCodes = useMemo(() => {
    const codes = orgTypeOptions.map((option) => option.code.toUpperCase());
    return sortOrgTypeCodes(codes.length ? codes : [...LEGACY_ORG_TYPES]);
  }, [orgTypeOptions]);
  const allStatusOptions = useMemo<LookupOption[]>(
    () => (statusOptions.length ? statusOptions : LEGACY_STATUS_OPTIONS.map((option) => ({ code: option.code, value: option.value }))),
    [statusOptions],
  );
  const typeLabelMap = useMemo(() => buildLookupLabelMap(orgTypeOptions), [orgTypeOptions]);
  const statusLabelMap = useMemo(() => buildLookupLabelMap(allStatusOptions), [allStatusOptions]);
  const countryLabelMap = useMemo(() => buildLookupLabelMap(countryOptions), [countryOptions]);
  const resolveTypeLabel = useCallback((typeCode: string) => getLookupLabel(typeCode, typeLabelMap), [typeLabelMap]);
  const resolveStatusLabel = useCallback((statusCode: string) => getLookupLabel(statusCode, statusLabelMap), [statusLabelMap]);
  const selectedParent = selectedOrgId ? parentMap.get(selectedOrgId) ?? null : null;
  const selectedLineage = useMemo(() => {
    if (!selectedTreeNode) return [];
    const lineage: OrgNode[] = [selectedTreeNode];
    let cursor = parentMap.get(selectedTreeNode.id) ?? null;

    while (cursor) {
      lineage.unshift(cursor);
      cursor = parentMap.get(cursor.id) ?? null;
    }

    return lineage;
  }, [parentMap, selectedTreeNode]);
  const availableParentOptions = useMemo(
    () => parentOptions.filter((option) => option.id !== selectedOrgId && !descendantIds.has(option.id)),
    [descendantIds, parentOptions, selectedOrgId],
  );
  const locationSummary = useMemo(() => {
    if (!detailNode) return "";
    return [detailNode.address, detailNode.city, detailNode.state, detailNode.country ? getLookupLabel(detailNode.country, countryLabelMap, detailNode.country) : null]
      .filter(Boolean)
      .join(", ");
  }, [countryLabelMap, detailNode]);
  const organizationSummary = useMemo(() => ({
    total: allOrganizations.length,
    active: allOrganizations.filter((organization) => organization.status === "ACTIVE").length,
    leaders: allOrganizations.filter((organization) => (organization.children?.length ?? 0) > 0).length,
    topLevel: tree.length,
  }), [allOrganizations, tree]);

  useEffect(() => {
    selectedOrgIdRef.current = selectedOrgId;
  }, [selectedOrgId]);

  useEffect(() => {
    onSummaryChange?.(organizationSummary);
  }, [onSummaryChange, organizationSummary]);

  useEffect(() => {
    if (tree.length === 0) {
      setExpandedIds(new Set());
      return;
    }

    setExpandedIds((current) => {
      if (current.size > 0) return current;
      return new Set(tree.map((node) => node.id));
    });
  }, [tree]);

  const loadTree = useCallback(async (preferredSelectionId?: string | null) => {
    setTreeLoading(true);
    setTreeError(null);

    try {
      const data = await getOrgTree();
      const normalized = data.map(normalizeNode);
      const nextMap = buildNodeMap(normalized);
      const target = preferredSelectionId === undefined ? selectedOrgIdRef.current : preferredSelectionId;

      setTree(normalized);
      if (target && nextMap.has(target)) setSelectedOrgId(target);
      else if (preferredSelectionId !== undefined || (selectedOrgIdRef.current && !nextMap.has(selectedOrgIdRef.current))) {
        setSelectedOrgId(null);
      }
    } catch (error) {
      setTreeError(mapAxiosError(error).message);
    } finally {
      setTreeLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (orgId: string) => {
    setDetailLoading(true);

    try {
      const detail = normalizeNode(await getOrgById(orgId));
      if (selectedOrgIdRef.current === orgId) setSelectedNode(detail);
    } catch (error) {
      if (selectedOrgIdRef.current !== orgId) return;
      const mapped = mapAxiosError(error);
      if (mapped.status === 404) await loadTree(null);
      else setTreeError(mapped.message);
    } finally {
      if (selectedOrgIdRef.current === orgId) setDetailLoading(false);
    }
  }, [loadTree]);

  useEffect(() => {
    void (async () => {
      try {
        await getOrgHealth();
        setIsHealthy(true);
        setHealthMessage(null);
      } catch (error) {
        const mapped = mapAxiosError(error);
        setIsHealthy(false);
        setHealthMessage(mapped.message);
      }

      try {
        const [orgTypes, statuses, countries] = await Promise.all([
          getLookupOptionsByMasterCode("ORG_TYPE"),
          getLookupOptionsByMasterCode("ORG_STATUS"),
          getLookupOptionsByMasterCode("COUNTRY"),
        ]);
        setOrgTypeOptions(orgTypes);
        setStatusOptions(statuses);
        setCountryOptions(countries);
      } catch (error) {
        toast.error(mapAxiosError(error).message);
      }

      await loadTree(null);
    })();
  }, [loadTree]);

  useEffect(() => {
    if (!selectedOrgId) {
      setSelectedNode(null);
      setConfirmDelete(false);
      setContextMode((current) => (current === "form" ? current : "view"));
      return;
    }

    setConfirmDelete(false);
    setContextMode("view");
    void loadDetail(selectedOrgId);
  }, [loadDetail, selectedOrgId]);

  const openCreateRoot = useCallback(() => {
    setSelectedOrgId(null);
    setSelectedNode(null);
    setFormMode("createRoot");
    setFieldErrors({});
    setFormMessage(null);
    setFormData({
      ...EMPTY_FORM,
      type: getSuggestedChildType(null, allOrgTypeCodes),
      status: allStatusOptions[0]?.code ?? "ACTIVE",
    });
    setContextMode("form");
  }, [allOrgTypeCodes, allStatusOptions]);

  useEffect(() => {
    onHeaderControlsChange?.({
      refresh: () => void loadTree(),
      createRoot: openCreateRoot,
      refreshDisabled: treeLoading,
      createRootDisabled: disabled || rootExists || submitting,
      showCreateRoot: !rootExists,
    });
  }, [disabled, loadTree, onHeaderControlsChange, openCreateRoot, rootExists, submitting, treeLoading]);

  const toggleExpanded = (orgId: string): void => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  const handleSelectOrg = (orgId: string): void => {
    setSelectedOrgId(orgId);
  };

  const openAddChild = (): void => {
    if (!detailNode) return;
    setFormMode("addChild");
    setFieldErrors({});
    setFormMessage(null);
    setFormData({
      ...EMPTY_FORM,
      parent_id: detailNode.id,
      type: getSuggestedChildType(detailNode.type, allOrgTypeCodes),
      status: allStatusOptions[0]?.code ?? "ACTIVE",
    });
    setContextMode("form");
  };

  const openEdit = (): void => {
    if (!detailNode) return;
    setFormMode("editNode");
    setFieldErrors({});
    setFormMessage(null);
    setFormData(toFormState(detailNode));
    setContextMode("form");
  };

  const validateForm = (): boolean => {
    const nextErrors: FieldErrors = {};
    const lat = parseOptionalNumber(formData.lat);
    const long = parseOptionalNumber(formData.long);

    if (!formData.name.trim()) nextErrors.name = "Organization name is required";
    if (!formData.code.trim()) nextErrors.code = "Organization code is required";
    else if (!CODE_PATTERN.test(formData.code.trim().toUpperCase())) nextErrors.code = "Use uppercase letters, numbers, and hyphens only";
    if (!formData.type) nextErrors.type = "Organization type is required";
    if (!formData.status) nextErrors.status = "Status is required";
    if (formMode === "addChild" && !formData.parent_id) nextErrors.parent_id = "Parent organization is required";
    if (formData.lat.trim() && Number.isNaN(lat)) nextErrors.lat = "Latitude must be numeric";
    if (formData.long.trim() && Number.isNaN(long)) nextErrors.long = "Longitude must be numeric";

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const toPayload = (): OrgPayload => ({
    name: formData.name.trim(),
    code: formData.code.trim().toUpperCase(),
    type: formData.type,
    status: formData.status,
    parent_id: formMode === "createRoot" ? null : formData.parent_id || null,
    address: formData.address.trim() || null,
    city: formData.city.trim() || null,
    state: formData.state.trim() || null,
    country: formData.country || null,
    lat: parseOptionalNumber(formData.lat),
    long: parseOptionalNumber(formData.long),
    ...(formMode === "editNode" ? { modified_by: auditActor } : { created_by: auditActor }),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (disabled || submitting) return;
    if (formMode === "editNode" && !detailNode) return;
    if (!validateForm()) return;

    setSubmitting(true);
    setFormMessage(null);

    try {
      const saved = formMode === "editNode"
        ? await updateOrg(detailNode.id, toPayload())
        : await createOrg(toPayload());

      toast.success(formMode === "editNode" ? "Organization unit updated" : "Organization unit created");
      setContextMode("view");
      setSelectedOrgId(saved.id);
      await loadTree(saved.id);
    } catch (error) {
      const mapped = mapAxiosError(error);
      setFieldErrors(mapped.fieldErrors ?? {});
      setFormMessage(mapped.message);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!detailNode || submitting) return;

    setSubmitting(true);

    try {
      await deleteOrg(detailNode.id, deleteActorId);
      toast.success("Organization unit deactivated");
      setConfirmDelete(false);
      setContextMode("view");
      setSelectedOrgId(null);
      setSelectedNode(null);
      await loadTree(null);
    } catch (error) {
      const message = mapAxiosError(error).message;
      toast.error(message);
      setTreeError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelForm = (): void => {
    setFieldErrors({});
    setFormMessage(null);
    setContextMode("view");
  };

  return (
    <div className="space-y-4">
      {healthMessage ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Org services are not available: {healthMessage}
        </div>
      ) : null}
      {treeError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {treeError}
        </div>
      ) : null}

      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Hierarchy Tree</h2>
                <p className="mt-1 text-sm text-slate-500">Business units, reporting paths, and unit status.</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => void loadTree()}
                disabled={treeLoading}
                aria-label="Refresh hierarchy tree"
              >
                <RefreshCw className={cn("h-4 w-4", treeLoading && "animate-spin")} />
              </Button>
            </div>
            <div className="mt-4">
              <SearchInput
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onClear={() => setSearchInput("")}
                placeholder="Search name, code, or type"
                disabled={treeLoading}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
            {treeLoading ? (
              <div className="space-y-3 p-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="rounded-md border border-slate-200 bg-white px-3 py-3">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="mt-3 h-3 w-28" />
                    <Skeleton className="mt-3 h-3 w-full" />
                  </div>
                ))}
              </div>
            ) : tree.length === 0 ? (
              <EmptyState
                title="No org units found"
                description="Create a top-level organization unit to begin building the business hierarchy."
                action={(
                  <PermissionGuard permission="ORGANIZATION_CREATE">
                    <Button type="button" onClick={openCreateRoot} disabled={disabled}>
                      <Plus className="h-4 w-4" />
                      Add Root Unit
                    </Button>
                  </PermissionGuard>
                )}
                className="min-h-[360px]"
              />
            ) : filteredTree.length === 0 ? (
              <EmptyState
                title="No search results"
                description="Try a different organization name, code, or type."
                className="min-h-[360px]"
              />
            ) : (
              <div className="space-y-1">
                {filteredTree.map((node) => (
                  <TreeNodeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    selectedOrgId={selectedOrgId}
                    expandedIds={expandedIds}
                    searchActive={searchActive}
                    onToggle={toggleExpanded}
                    onSelect={handleSelectOrg}
                    resolveTypeLabel={resolveTypeLabel}
                    resolveStatusLabel={resolveStatusLabel}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="min-w-0 rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {contextMode === "roles" ? "Governance Role Assignments" : contextMode === "form" ? "Organization Editor" : "Organization Context"}
                </div>
                <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">
                  {contextMode === "form"
                    ? formMode === "editNode"
                      ? `Edit ${detailNode?.name ?? "Organization Unit"}`
                      : formMode === "addChild"
                        ? `Add Child Unit${detailNode?.name ? ` under ${detailNode.name}` : ""}`
                        : "Add Root Unit"
                    : detailNode?.name ?? "No unit selected"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {contextMode === "roles"
                    ? "Assign business, compliance, and operations responsibilities for the selected unit."
                    : "Manage business hierarchy, ownership, and governance context."}
                </p>
              </div>

              {detailNode && contextMode === "view" ? (
                <div className="flex flex-wrap gap-2">
                  <PermissionGuard permission="ORGANIZATION_CREATE">
                    <Button type="button" size="sm" onClick={openAddChild} disabled={disabled}>
                      <Plus className="h-4 w-4" />
                      Add Child
                    </Button>
                  </PermissionGuard>
                  <PermissionGuard permission="ORGANIZATION_UPDATE">
                    <Button type="button" variant="secondary" size="sm" onClick={openEdit} disabled={disabled}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  </PermissionGuard>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setContextMode("roles")} disabled={disabled}>
                    <ShieldCheck className="h-4 w-4" />
                    Role Assignments
                  </Button>
                  <PermissionGuard permission="ORGANIZATION_DELETE">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setConfirmDelete(true)}
                      disabled={disabled || selectedChildren.length > 0}
                    >
                      <Trash2 className="h-4 w-4" />
                      Deactivate
                    </Button>
                  </PermissionGuard>
                </div>
              ) : null}

              {detailNode && contextMode === "roles" ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => setContextMode("view")}>
                  Back to Details
                </Button>
              ) : null}
            </div>
          </div>

          <div className="px-5 py-5">
            {contextMode === "form" ? (
              <form className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
                {formMessage ? (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {formMessage}
                  </div>
                ) : null}

                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Basic Info</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <FormField label="Name" error={fieldErrors.name}>
                      <Input
                        value={formData.name}
                        onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Global Quality Operations"
                      />
                    </FormField>
                    <FormField label="Code" error={fieldErrors.code}>
                      <Input
                        value={formData.code}
                        maxLength={25}
                        onChange={(event) => setFormData((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                        placeholder="GQO-001"
                      />
                    </FormField>
                    <FormField label="Type" error={fieldErrors.type}>
                      <select
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-50"
                        value={formData.type}
                        onChange={(event) => setFormData((current) => ({ ...current, type: event.target.value }))}
                        disabled={formMode === "editNode" && selectedChildren.length > 0}
                      >
                        <option value="">Select type</option>
                        {allOrgTypeCodes.map((typeCode) => (
                          <option key={typeCode} value={typeCode}>
                            {resolveTypeLabel(typeCode)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Status" error={fieldErrors.status}>
                      <select
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={formData.status}
                        onChange={(event) => setFormData((current) => ({ ...current, status: event.target.value }))}
                      >
                        {allStatusOptions.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.value}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    {formMode !== "createRoot" ? (
                      <FormField label="Parent" error={fieldErrors.parent_id} className="md:col-span-2">
                        {formMode === "addChild" ? (
                          <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm text-slate-700">
                            {detailNode?.name ?? "-"}
                          </div>
                        ) : (
                          <select
                            className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                            value={formData.parent_id}
                            onChange={(event) => setFormData((current) => ({ ...current, parent_id: event.target.value }))}
                          >
                            {(!rootExists || detailNode?.parent_id === null) ? <option value="">Top-level organization</option> : null}
                            {availableParentOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {`${"-- ".repeat(option.level)}${option.name} (${resolveTypeLabel(option.type)})`}
                              </option>
                            ))}
                          </select>
                        )}
                      </FormField>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">Address / Location</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <FormField label="Street Address" error={fieldErrors.address} className="md:col-span-2">
                      <Input
                        value={formData.address}
                        onChange={(event) => setFormData((current) => ({ ...current, address: event.target.value }))}
                        placeholder="Building, street, or campus address"
                      />
                    </FormField>
                    <FormField label="City" error={fieldErrors.city}>
                      <Input
                        value={formData.city}
                        onChange={(event) => setFormData((current) => ({ ...current, city: event.target.value }))}
                      />
                    </FormField>
                    <FormField label="State / Province" error={fieldErrors.state}>
                      <Input
                        value={formData.state}
                        onChange={(event) => setFormData((current) => ({ ...current, state: event.target.value }))}
                      />
                    </FormField>
                    <FormField label="Country" error={fieldErrors.country}>
                      <select
                        className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                        value={formData.country}
                        onChange={(event) => setFormData((current) => ({ ...current, country: event.target.value }))}
                      >
                        <option value="">Select country</option>
                        {countryOptions.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.value}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Latitude" error={fieldErrors.lat}>
                        <Input
                          value={formData.lat}
                          onChange={(event) => setFormData((current) => ({ ...current, lat: event.target.value }))}
                          placeholder="17.3850"
                        />
                      </FormField>
                      <FormField label="Longitude" error={fieldErrors.long}>
                        <Input
                          value={formData.long}
                          onChange={(event) => setFormData((current) => ({ ...current, long: event.target.value }))}
                          placeholder="78.4867"
                        />
                      </FormField>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
                  <Button type="button" variant="ghost" onClick={handleCancelForm} disabled={submitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={disabled || submitting}>
                    {submitting ? "Saving..." : "Save Organization Unit"}
                  </Button>
                </div>
              </form>
            ) : contextMode === "roles" && detailNode ? (
              <OrgRoleAssignmentsPanel
                orgId={detailNode.id}
                orgName={detailNode.name}
                disabled={disabled}
                actorName={auditActor}
                defaultUser={auditActor}
              />
            ) : detailLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 9 }).map((_, index) => (
                    <Skeleton key={index} className="h-20 w-full" />
                  ))}
                </div>
              </div>
            ) : !detailNode ? (
              <EmptyState
                title="Select an organization unit to view details or create a child unit."
                description="The hierarchy tree stays available while you review details, edit units, or assign governance roles."
                className="min-h-[420px]"
              />
            ) : (
              <div className="space-y-5">
                {confirmDelete ? (
                  <ConfirmStrip
                    tone="danger"
                    title="Deactivate this organization unit?"
                    message={`"${detailNode.name}" will be hidden from active hierarchy views. Units with children cannot be deactivated.`}
                    confirmLabel={submitting ? "Deactivating..." : "Deactivate"}
                    onConfirm={() => void handleDelete()}
                    onCancel={() => setConfirmDelete(false)}
                    disabled={submitting}
                  />
                ) : null}

                {selectedChildren.length > 0 ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Deactivation is available after child units are moved or removed.
                  </div>
                ) : null}

                {selectedLineage.length > 0 ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Reporting Path</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {selectedLineage.map((node, index) => (
                        <React.Fragment key={node.id}>
                          {index > 0 ? <ChevronRight className="h-4 w-4 text-slate-300" /> : null}
                          <button
                            type="button"
                            className={cn(
                              "rounded-md border px-2.5 py-1 text-sm",
                              node.id === selectedOrgId
                                ? "border-blue-200 bg-blue-50 text-blue-700"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                            )}
                            onClick={() => handleSelectOrg(node.id)}
                          >
                            {node.name}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-3 md:grid-cols-3">
                  <DetailField label="Direct Children">{selectedChildren.length}</DetailField>
                  <DetailField label="Hierarchy Level">{selectedLineage.length || "-"}</DetailField>
                  <DetailField label="Parent">{selectedParent?.name ?? "Top-level organization"}</DetailField>
                </div>

                <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-slate-600 shadow-sm">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Location Summary</div>
                      <div className="mt-1 text-sm text-slate-700">
                        {locationSummary || "No address or location fields have been captured for this unit."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <DetailField label="Name">{detailNode.name}</DetailField>
                  <DetailField label="Code">
                    <span className="font-mono uppercase">{detailNode.code}</span>
                  </DetailField>
                  <DetailField label="Type">
                    <TypeBadge type={detailNode.type} label={resolveTypeLabel(detailNode.type)} />
                  </DetailField>
                  <DetailField label="Status">
                    <OrgStatusBadge status={detailNode.status} label={resolveStatusLabel(detailNode.status)} />
                  </DetailField>
                  <DetailField label="Parent">{selectedParent?.name ?? "Top-level organization"}</DetailField>
                  <DetailField label="Children Count">{selectedChildren.length}</DetailField>
                  <DetailField label="Street Address">{detailNode.address || "-"}</DetailField>
                  <DetailField label="City">{detailNode.city || "-"}</DetailField>
                  <DetailField label="State / Province">{detailNode.state || "-"}</DetailField>
                  <DetailField label="Country">
                    {detailNode.country ? getLookupLabel(detailNode.country, countryLabelMap, detailNode.country) : "-"}
                  </DetailField>
                  <DetailField label="Latitude">{formatCoord(detailNode.lat)}</DetailField>
                  <DetailField label="Longitude">{formatCoord(detailNode.long)}</DetailField>
                </div>

                {selectedChildren.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Child Units</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {selectedChildren.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => handleSelectOrg(child.id)}
                          className="rounded-md border border-slate-200 bg-white p-3 text-left hover:border-blue-300 hover:bg-blue-50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-slate-900">{child.name}</div>
                              <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className="font-mono">{child.code}</span>
                                <span>{resolveTypeLabel(child.type)}</span>
                              </div>
                            </div>
                            <GitBranch className="h-4 w-4 shrink-0 text-blue-600" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
