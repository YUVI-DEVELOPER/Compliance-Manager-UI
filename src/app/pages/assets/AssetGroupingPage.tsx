import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ChevronRight, CircleDot, GitBranch, Layers3, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { toast, Toaster } from "sonner";

import { PermissionGuard } from "../../auth/PermissionGuard";
import { useCurrentActor } from "../../auth/useCurrentActor";
import type { AssetRecord } from "../../../services/asset.service";
import { getAssets } from "../../../services/asset.service";
import type { AssetGroupMembershipRecord, AssetGroupRecord, AssetGroupType } from "../../../services/assetGrouping.service";
import {
  addAssetsToGroup,
  createAssetGroup,
  deleteAssetGroup,
  getAssetGroupAssets,
  getAssetGroupTree,
  removeAssetFromGroup,
  updateAssetGroup,
} from "../../../services/assetGrouping.service";
import { getOrgTree } from "../../../services/org.service";
import { flattenOrgTreeOptions, type OrgOption } from "../../components/assets/assetForm.shared";
import { ConfirmStrip, EmptyState, StatusBadge } from "../../components/foundation";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input, SearchInput } from "../../components/ui/input";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../components/ui/utils";

type GroupTypeFilter = AssetGroupType | "ALL";
type ContextMode = "detail" | "form" | "members";
type FormMode = "create" | "edit";

interface AssetGroupFormValues {
  group_name: string;
  group_code: string;
  group_type: AssetGroupType;
  description: string;
  parent_group_id: string;
  org_node_id: string;
  is_active: boolean;
}

type FieldErrors = Partial<Record<keyof AssetGroupFormValues, string>>;

const EMPTY_FORM: AssetGroupFormValues = {
  group_name: "",
  group_code: "",
  group_type: "SYSTEM",
  description: "",
  parent_group_id: "",
  org_node_id: "",
  is_active: true,
};

const selectClassName =
  "h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const typeBadgeClasses: Record<AssetGroupType, string> = {
  SYSTEM: "border-blue-200 bg-blue-50 text-blue-700",
  SUB_SYSTEM: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    const message = error.response?.data?.message;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (typeof message === "string" && message.trim()) return message;
    return error.message;
  }

  return error instanceof Error ? error.message : "Unexpected error occurred";
}

function flattenGroups(groups: AssetGroupRecord[]): AssetGroupRecord[] {
  const items: AssetGroupRecord[] = [];
  const stack = [...groups].reverse();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    items.push(current);
    [...(current.children ?? [])].reverse().forEach((child) => stack.push(child));
  }

  return items;
}

function filterGroupTree(
  groups: AssetGroupRecord[],
  searchQuery: string,
  typeFilter: GroupTypeFilter,
): AssetGroupRecord[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return groups.flatMap((group) => {
    const children = filterGroupTree(group.children ?? [], searchQuery, typeFilter);
    const matchesSearch = !normalizedQuery
      || [group.group_name, group.group_code, group.description, group.org_node_name, group.group_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    const matchesType = typeFilter === "ALL" || group.group_type === typeFilter;

    if ((matchesSearch && matchesType) || children.length > 0) {
      return [{ ...group, children }];
    }

    return [];
  });
}

function buildInitialFormState(
  initialGroup: AssetGroupRecord | null,
  defaultType: AssetGroupType,
  defaultParentGroupId: string | null,
): AssetGroupFormValues {
  if (!initialGroup) {
    return {
      ...EMPTY_FORM,
      group_type: defaultType,
      parent_group_id: defaultType === "SUB_SYSTEM" ? defaultParentGroupId ?? "" : "",
    };
  }

  return {
    group_name: initialGroup.group_name ?? "",
    group_code: initialGroup.group_code ?? "",
    group_type: initialGroup.group_type,
    description: initialGroup.description ?? "",
    parent_group_id: initialGroup.parent_group_id ?? "",
    org_node_id: initialGroup.org_node_id ?? "",
    is_active: initialGroup.is_active,
  };
}

function TypeBadge({ groupType }: { groupType: AssetGroupType }) {
  return (
    <Badge variant="outline" className={cn("uppercase", typeBadgeClasses[groupType])}>
      {groupType === "SYSTEM" ? "System" : "Sub-system"}
    </Badge>
  );
}

function GroupStatusBadge({ active }: { active: boolean }) {
  return <StatusBadge status={active ? "active" : "inactive"} />;
}

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

function GroupTreeNode({
  group,
  depth,
  selectedGroupId,
  expandedIds,
  searchActive,
  onToggle,
  onSelect,
}: {
  group: AssetGroupRecord;
  depth: number;
  selectedGroupId: string | null;
  expandedIds: Set<string>;
  searchActive: boolean;
  onToggle: (groupId: string) => void;
  onSelect: (groupId: string) => void;
}) {
  const hasChildren = (group.children?.length ?? 0) > 0;
  const expanded = searchActive || expandedIds.has(group.id);
  const isSelected = selectedGroupId === group.id;

  return (
    <div className="relative">
      <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-2 py-1" style={{ paddingLeft: depth * 18 }}>
        <div className="flex justify-center pt-2">
          {hasChildren ? (
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              onClick={() => onToggle(group.id)}
              aria-label={expanded ? "Collapse asset group" : "Expand asset group"}
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
          onClick={() => onSelect(group.id)}
          className={cn(
            "min-h-[82px] w-full rounded-md border px-3 py-2.5 text-left transition-colors",
            isSelected
              ? "border-blue-300 bg-blue-50 shadow-sm ring-1 ring-blue-100"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
            !group.is_active && "opacity-75",
          )}
        >
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{group.group_name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {group.group_code ? <span className="font-mono text-xs uppercase tracking-wide text-slate-500">{group.group_code}</span> : null}
                <TypeBadge groupType={group.group_type} />
              </div>
            </div>
            <GroupStatusBadge active={group.is_active} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{group.direct_asset_count} member asset{group.direct_asset_count === 1 ? "" : "s"}</span>
            <span>{group.child_group_count} sub-system{group.child_group_count === 1 ? "" : "s"}</span>
          </div>
        </button>
      </div>

      {expanded && hasChildren ? (
        <div>
          {group.children?.map((child) => (
            <GroupTreeNode
              key={child.id}
              group={child}
              depth={depth + 1}
              selectedGroupId={selectedGroupId}
              expandedIds={expandedIds}
              searchActive={searchActive}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MemberAssetTable({
  memberships,
  loading,
  showActions = false,
  onRemove,
}: {
  memberships: AssetGroupMembershipRecord[];
  loading: boolean;
  showActions?: boolean;
  onRemove?: (membership: AssetGroupMembershipRecord) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (memberships.length === 0) {
    return (
      <EmptyState
        title="No member assets"
        description="No assets are directly assigned to this system or sub-system yet."
      />
    );
  }

  return (
    <Table containerClassName="max-h-[440px] rounded-md border border-slate-200">
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead>Class / Type</TableHead>
          <TableHead>Organization</TableHead>
          <TableHead>Status</TableHead>
          {showActions ? <TableHead className="text-right">Action</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {memberships.map((membership) => (
          <TableRow key={membership.id || membership.asset_uuid}>
            <TableCell className="min-w-56">
              <div className="font-medium text-slate-900">{membership.asset_name || "-"}</div>
              <div className="mt-1 text-xs text-slate-500">{membership.asset_id || "-"}</div>
            </TableCell>
            <TableCell className="min-w-44 text-sm text-slate-600">
              {[membership.asset_class, membership.asset_type].filter(Boolean).join(" / ") || "-"}
            </TableCell>
            <TableCell className="min-w-44 text-sm text-slate-600">{membership.org_node_name || "-"}</TableCell>
            <TableCell className="text-sm text-slate-600">{membership.asset_status || "-"}</TableCell>
            {showActions ? (
              <TableCell>
                <div className="flex justify-end">
                  <PermissionGuard permission="ASSET_UPDATE">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onRemove?.(membership)}>
                      Remove
                    </Button>
                  </PermissionGuard>
                </div>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function AssetGroupingPage() {
  const header = getPageHeaderConfig("asset-grouping");
  const currentActor = useCurrentActor();
  const actorName = currentActor.auditName ?? currentActor.displayName;
  const [groupTree, setGroupTree] = useState<AssetGroupRecord[]>([]);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [groupTreeLoading, setGroupTreeLoading] = useState(true);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [memberships, setMemberships] = useState<AssetGroupMembershipRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<GroupTypeFilter>("ALL");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [contextMode, setContextMode] = useState<ContextMode>("detail");
  const [formMode, setFormMode] = useState<FormMode>("create");
  const [formDefaultType, setFormDefaultType] = useState<AssetGroupType>("SYSTEM");
  const [formDefaultParentGroupId, setFormDefaultParentGroupId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<AssetGroupFormValues>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [savingGroup, setSavingGroup] = useState(false);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<AssetRecord[]>([]);
  const [availableAssetsLoading, setAvailableAssetsLoading] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [savingMemberships, setSavingMemberships] = useState(false);
  const [membershipToRemove, setMembershipToRemove] = useState<AssetGroupMembershipRecord | null>(null);
  const [removingAsset, setRemovingAsset] = useState(false);

  const flatGroups = useMemo(() => flattenGroups(groupTree), [groupTree]);
  const selectedGroup = useMemo(
    () => flatGroups.find((group) => group.id === selectedGroupId) ?? null,
    [flatGroups, selectedGroupId],
  );
  const filteredTree = useMemo(
    () => filterGroupTree(groupTree, searchQuery, typeFilter),
    [groupTree, searchQuery, typeFilter],
  );
  const searchActive = searchQuery.trim().length > 0 || typeFilter !== "ALL";
  const systemGroups = useMemo(
    () => flatGroups.filter((group) => group.group_type === "SYSTEM"),
    [flatGroups],
  );
  const childGroups = useMemo(
    () => selectedGroup ? flatGroups.filter((group) => group.parent_group_id === selectedGroup.id) : [],
    [flatGroups, selectedGroup],
  );
  const existingMembershipAssetIds = useMemo(
    () => new Set(memberships.map((membership) => membership.asset_uuid)),
    [memberships],
  );
  const parentSystem = useMemo(
    () => selectedGroup?.parent_group_id
      ? flatGroups.find((group) => group.id === selectedGroup.parent_group_id) ?? null
      : null,
    [flatGroups, selectedGroup],
  );
  const availableParentSystems = useMemo(
    () => systemGroups.filter((group) => group.id !== selectedGroup?.id),
    [selectedGroup?.id, systemGroups],
  );
  const filteredAvailableAssets = useMemo(() => {
    const query = assetSearchQuery.trim().toLowerCase();
    return availableAssets
      .filter((asset) => asset.asset_uuid && !existingMembershipAssetIds.has(asset.asset_uuid))
      .filter((asset) => {
        if (!query) return true;
        return [
          asset.asset_id,
          asset.asset_name,
          asset.asset_class,
          asset.asset_type,
          asset.asset_status,
          asset.org_node_name,
          asset.asset_owner,
          asset.tag_number,
          asset.serial_number,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
  }, [assetSearchQuery, availableAssets, existingMembershipAssetIds]);
  const selectedAvailableAssets = useMemo(
    () => availableAssets.filter((asset) => selectedAssetIds.has(asset.asset_uuid)),
    [availableAssets, selectedAssetIds],
  );
  const headerStats = buildPageHeaderStats(header.stats, {
    total: flatGroups.length,
    systems: flatGroups.filter((group) => group.group_type === "SYSTEM").length,
    "sub-systems": flatGroups.filter((group) => group.group_type === "SUB_SYSTEM").length,
  });

  const loadGroupTree = useCallback(async (preferredGroupId?: string | null) => {
    setGroupTreeLoading(true);
    try {
      const [groups, orgTree] = await Promise.all([getAssetGroupTree(), getOrgTree()]);
      setGroupTree(groups);
      setOrgOptions(flattenOrgTreeOptions(orgTree));

      const nextFlatGroups = flattenGroups(groups);
      const preferredExists = preferredGroupId && nextFlatGroups.some((group) => group.id === preferredGroupId);
      setSelectedGroupId((currentSelectedGroupId) => {
        if (preferredExists) return preferredGroupId;
        if (currentSelectedGroupId && nextFlatGroups.some((group) => group.id === currentSelectedGroupId)) {
          return currentSelectedGroupId;
        }
        return null;
      });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setGroupTreeLoading(false);
    }
  }, []);

  const loadMemberships = useCallback(async (groupId: string | null) => {
    if (!groupId) {
      setMemberships([]);
      return;
    }

    setMembershipLoading(true);
    try {
      const data = await getAssetGroupAssets(groupId);
      setMemberships(data);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setMembershipLoading(false);
    }
  }, []);

  const loadAvailableAssets = useCallback(async () => {
    setAvailableAssetsLoading(true);
    try {
      const data = await getAssets();
      setAvailableAssets(data);
      setAssetsLoaded(true);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setAvailableAssetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroupTree(null);
  }, [loadGroupTree]);

  useEffect(() => {
    if (groupTree.length === 0) {
      setExpandedIds(new Set());
      return;
    }

    setExpandedIds((current) => {
      if (current.size > 0) return current;
      return new Set(groupTree.map((group) => group.id));
    });
  }, [groupTree]);

  useEffect(() => {
    void loadMemberships(selectedGroupId);
  }, [loadMemberships, selectedGroupId]);

  const toggleExpanded = (groupId: string): void => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleSelectGroup = (groupId: string): void => {
    setSelectedGroupId(groupId);
    setContextMode("detail");
    setConfirmDeleteGroup(false);
    setMembershipToRemove(null);
    setSelectedAssetIds(new Set());
  };

  const openCreateSystem = (): void => {
    setFormMode("create");
    setFormDefaultType("SYSTEM");
    setFormDefaultParentGroupId(null);
    setFormValues(buildInitialFormState(null, "SYSTEM", null));
    setFormErrors({});
    setConfirmDeleteGroup(false);
    setContextMode("form");
  };

  const openAddSubSystem = (): void => {
    if (!selectedGroup || selectedGroup.group_type !== "SYSTEM") return;
    setFormMode("create");
    setFormDefaultType("SUB_SYSTEM");
    setFormDefaultParentGroupId(selectedGroup.id);
    setFormValues(buildInitialFormState(null, "SUB_SYSTEM", selectedGroup.id));
    setFormErrors({});
    setConfirmDeleteGroup(false);
    setContextMode("form");
  };

  const openEditGroup = (): void => {
    if (!selectedGroup) return;
    setFormMode("edit");
    setFormDefaultType(selectedGroup.group_type);
    setFormDefaultParentGroupId(selectedGroup.parent_group_id ?? null);
    setFormValues(buildInitialFormState(selectedGroup, selectedGroup.group_type, selectedGroup.parent_group_id ?? null));
    setFormErrors({});
    setConfirmDeleteGroup(false);
    setContextMode("form");
  };

  const openManageMembers = (): void => {
    if (!selectedGroup) return;
    setContextMode("members");
    setMembershipToRemove(null);
    setSelectedAssetIds(new Set());
    if (!assetsLoaded) void loadAvailableAssets();
  };

  const validateForm = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!formValues.group_name.trim()) nextErrors.group_name = "Group name is required";
    if (formValues.group_type === "SYSTEM" && formValues.parent_group_id) {
      nextErrors.parent_group_id = "System groups cannot have a parent";
    }
    if (formValues.group_type === "SUB_SYSTEM" && !formValues.parent_group_id) {
      nextErrors.parent_group_id = "Parent system is required for sub-systems";
    }
    setFormErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmitGroup = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (savingGroup || !validateForm()) return;

    setSavingGroup(true);
    try {
      if (formMode === "edit" && selectedGroup) {
        await updateAssetGroup(selectedGroup.id, {
          group_name: formValues.group_name.trim(),
          group_code: formValues.group_code.trim() || null,
          group_type: formValues.group_type,
          description: formValues.description.trim() || null,
          parent_group_id: formValues.group_type === "SYSTEM" ? null : formValues.parent_group_id || null,
          org_node_id: formValues.org_node_id || null,
          is_active: formValues.is_active,
          modified_by: actorName,
        });
        toast.success("Asset group updated successfully");
        await loadGroupTree(selectedGroup.id);
      } else {
        const createdGroup = await createAssetGroup({
          group_name: formValues.group_name.trim(),
          group_code: formValues.group_code.trim() || null,
          group_type: formValues.group_type,
          description: formValues.description.trim() || null,
          parent_group_id: formValues.group_type === "SYSTEM" ? null : formValues.parent_group_id || null,
          org_node_id: formValues.org_node_id || null,
          is_active: formValues.is_active,
          created_by: actorName,
        });
        toast.success("Asset group created successfully");
        await loadGroupTree(createdGroup.id);
      }
      setContextMode("detail");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (): Promise<void> => {
    if (!selectedGroup || savingGroup) return;
    setSavingGroup(true);
    try {
      await deleteAssetGroup(selectedGroup.id);
      toast.success("Asset group deleted successfully");
      setConfirmDeleteGroup(false);
      setSelectedGroupId(null);
      setContextMode("detail");
      await loadGroupTree(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingGroup(false);
    }
  };

  const toggleAssetSelection = (assetUuid: string): void => {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      if (next.has(assetUuid)) next.delete(assetUuid);
      else next.add(assetUuid);
      return next;
    });
  };

  const handleAddAssets = async (): Promise<void> => {
    if (!selectedGroup || selectedAssetIds.size === 0) return;
    const assetUuids = Array.from(selectedAssetIds);

    setSavingMemberships(true);
    try {
      await addAssetsToGroup(selectedGroup.id, {
        asset_uuids: assetUuids,
        created_by: actorName,
      });
      toast.success("Assets assigned successfully");
      setSelectedAssetIds(new Set());
      await Promise.all([loadGroupTree(selectedGroup.id), loadMemberships(selectedGroup.id)]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingMemberships(false);
    }
  };

  const handleRemoveAsset = async (): Promise<void> => {
    if (!selectedGroup || !membershipToRemove) return;
    setRemovingAsset(true);
    try {
      await removeAssetFromGroup(selectedGroup.id, membershipToRemove.asset_uuid);
      toast.success("Asset removed from group");
      setMembershipToRemove(null);
      await Promise.all([loadGroupTree(selectedGroup.id), loadMemberships(selectedGroup.id)]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setRemovingAsset(false);
    }
  };

  const renderForm = () => {
    const typeLocked = formMode === "create" || (formMode === "edit" && (selectedGroup?.child_group_count ?? 0) > 0);
    const parentLocked = formMode === "create" && formDefaultType === "SUB_SYSTEM";

    return (
      <form className="space-y-5" onSubmit={(event) => void handleSubmitGroup(event)}>
        <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
          <h3 className="text-sm font-semibold text-slate-900">Group Details</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FormField label="Group Name" error={formErrors.group_name} className="md:col-span-2">
              <Input
                value={formValues.group_name}
                onChange={(event) => setFormValues((current) => ({ ...current, group_name: event.target.value }))}
                placeholder="Packaging Line A"
                disabled={savingGroup}
              />
            </FormField>

            <FormField label="Group Code" error={formErrors.group_code}>
              <Input
                value={formValues.group_code}
                onChange={(event) => setFormValues((current) => ({ ...current, group_code: event.target.value.toUpperCase() }))}
                placeholder="SYS-PACK-A"
                disabled={savingGroup}
              />
            </FormField>

            <FormField label="Group Type" error={formErrors.group_type}>
              <select
                className={selectClassName}
                value={formValues.group_type}
                onChange={(event) => {
                  const nextType = event.target.value as AssetGroupType;
                  setFormValues((current) => ({
                    ...current,
                    group_type: nextType,
                    parent_group_id: nextType === "SYSTEM" ? "" : current.parent_group_id,
                  }));
                }}
                disabled={savingGroup || typeLocked}
              >
                <option value="SYSTEM">System</option>
                <option value="SUB_SYSTEM">Sub-system</option>
              </select>
            </FormField>

            <FormField label="Parent System" error={formErrors.parent_group_id}>
              <select
                className={selectClassName}
                value={formValues.parent_group_id}
                onChange={(event) => setFormValues((current) => ({ ...current, parent_group_id: event.target.value }))}
                disabled={savingGroup || formValues.group_type === "SYSTEM" || parentLocked}
              >
                <option value="">Select parent system</option>
                {availableParentSystems.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.group_name}
                    {group.group_code ? ` (${group.group_code})` : ""}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Org Scope">
              <select
                className={selectClassName}
                value={formValues.org_node_id}
                onChange={(event) => setFormValues((current) => ({ ...current, org_node_id: event.target.value }))}
                disabled={savingGroup}
              >
                <option value="">Enterprise</option>
                {orgOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Status">
              <select
                className={selectClassName}
                value={formValues.is_active ? "ACTIVE" : "INACTIVE"}
                onChange={(event) => setFormValues((current) => ({ ...current, is_active: event.target.value === "ACTIVE" }))}
                disabled={savingGroup}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </FormField>

            <FormField label="Description" className="md:col-span-2">
              <Textarea
                value={formValues.description}
                onChange={(event) => setFormValues((current) => ({ ...current, description: event.target.value }))}
                rows={4}
                placeholder="Describe the connected assets or operational boundary for this group."
                disabled={savingGroup}
              />
            </FormField>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          <Button type="button" variant="ghost" onClick={() => setContextMode("detail")} disabled={savingGroup}>
            Cancel
          </Button>
          <Button type="submit" disabled={savingGroup}>
            {savingGroup ? "Saving..." : formMode === "edit" ? "Save Changes" : "Create Group"}
          </Button>
        </div>
      </form>
    );
  };

  const renderAvailableAssetPicker = () => (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Add Assets</label>
            <div className="mt-2">
              <SearchInput
                value={assetSearchQuery}
                onChange={(event) => setAssetSearchQuery(event.target.value)}
                onClear={() => setAssetSearchQuery("")}
                placeholder="Search loaded assets by ID, name, class, organization, or owner"
                disabled={availableAssetsLoading || savingMemberships}
              />
            </div>
          </div>
          <PermissionGuard permission="ASSET_UPDATE">
            <Button
              type="button"
              onClick={() => void handleAddAssets()}
              disabled={savingMemberships || selectedAssetIds.size === 0}
            >
              {savingMemberships ? "Adding..." : `Add Selected (${selectedAssetIds.size})`}
            </Button>
          </PermissionGuard>
        </div>
        {selectedAvailableAssets.length > 0 ? (
          <div className="mt-3 text-xs text-slate-500">
            Selected: {selectedAvailableAssets.map((asset) => asset.asset_name || asset.asset_id).join(", ")}
          </div>
        ) : null}
      </div>

      {availableAssetsLoading ? (
        <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : filteredAvailableAssets.length === 0 ? (
        <EmptyState
          title="No available assets to add"
          description="Every loaded asset is already assigned here, or no assets match the current search."
        />
      ) : (
        <Table containerClassName="max-h-[360px] rounded-md border border-slate-200">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Select</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Class / Type</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAvailableAssets.map((asset) => (
              <TableRow key={asset.asset_uuid}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedAssetIds.has(asset.asset_uuid)}
                    onChange={() => toggleAssetSelection(asset.asset_uuid)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    aria-label={`Select ${asset.asset_name || asset.asset_id}`}
                  />
                </TableCell>
                <TableCell className="min-w-56">
                  <div className="font-medium text-slate-900">{asset.asset_name || "-"}</div>
                  <div className="mt-1 text-xs text-slate-500">{asset.asset_id || "-"}</div>
                </TableCell>
                <TableCell className="min-w-44 text-sm text-slate-600">
                  {[asset.asset_class, asset.asset_type].filter(Boolean).join(" / ") || "-"}
                </TableCell>
                <TableCell className="min-w-44 text-sm text-slate-600">{asset.org_node_name || "-"}</TableCell>
                <TableCell className="text-sm text-slate-600">{asset.asset_status || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Asset Grouping"
        subtitle="Organize assets into systems and sub-systems for impact analysis"
        stats={headerStats}
        rightSlot={(
          <PermissionGuard permission="ASSET_CREATE">
            <Button type="button" size="sm" onClick={openCreateSystem} disabled={groupTreeLoading} className="h-9 shadow-sm">
              <Plus className="h-4 w-4" />
              New System
            </Button>
          </PermissionGuard>
        )}
        secondaryActions={[
          {
            key: "refresh",
            label: "Refresh",
            variant: "secondary",
            icon: "refresh",
            onClick: () => void loadGroupTree(selectedGroupId),
            disabled: groupTreeLoading,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <div className="grid min-h-[620px] gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">System Tree</h2>
                  <p className="mt-1 text-sm text-slate-500">Systems and sub-systems used for impact planning.</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void loadGroupTree(selectedGroupId)}
                  disabled={groupTreeLoading}
                  aria-label="Refresh asset grouping tree"
                >
                  <RefreshCw className={cn("h-4 w-4", groupTreeLoading && "animate-spin")} />
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                <SearchInput
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onClear={() => setSearchQuery("")}
                  placeholder="Search systems, sub-systems, codes, or descriptions"
                  disabled={groupTreeLoading}
                />
                <select
                  className={selectClassName}
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as GroupTypeFilter)}
                  disabled={groupTreeLoading}
                >
                  <option value="ALL">All groups</option>
                  <option value="SYSTEM">Systems</option>
                  <option value="SUB_SYSTEM">Sub-systems</option>
                </select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {groupTreeLoading ? (
                <div className="space-y-3 p-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="rounded-md border border-slate-200 bg-white px-3 py-3">
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="mt-3 h-3 w-32" />
                      <Skeleton className="mt-3 h-3 w-full" />
                    </div>
                  ))}
                </div>
              ) : groupTree.length === 0 ? (
                <EmptyState
                  title="No groups"
                  description="Create a system to begin organizing assets for impact analysis."
                  action={(
                    <PermissionGuard permission="ASSET_CREATE">
                      <Button type="button" onClick={openCreateSystem}>
                        <Plus className="h-4 w-4" />
                        New System
                      </Button>
                    </PermissionGuard>
                  )}
                  className="min-h-[360px]"
                />
              ) : filteredTree.length === 0 ? (
                <EmptyState
                  title="No search results"
                  description="Try another system name, sub-system name, code, or description."
                  className="min-h-[360px]"
                />
              ) : (
                <div className="space-y-1">
                  {filteredTree.map((group) => (
                    <GroupTreeNode
                      key={group.id}
                      group={group}
                      depth={0}
                      selectedGroupId={selectedGroupId}
                      expandedIds={expandedIds}
                      searchActive={searchActive}
                      onToggle={toggleExpanded}
                      onSelect={handleSelectGroup}
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
                    {contextMode === "members" ? "Member Management" : contextMode === "form" ? "Grouping Editor" : "Grouping Context"}
                  </div>
                  <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">
                    {contextMode === "form"
                      ? formMode === "edit"
                        ? `Edit ${selectedGroup?.group_name ?? "Group"}`
                        : formDefaultType === "SYSTEM"
                          ? "Create System"
                          : "Create Sub-system"
                      : selectedGroup?.group_name ?? "No group selected"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {contextMode === "members"
                      ? "Add and remove direct asset memberships for the selected group."
                      : "Review system/sub-system details, scope, direct members, and relationships."}
                  </p>
                </div>

                {selectedGroup && contextMode === "detail" ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedGroup.group_type === "SYSTEM" ? (
                      <PermissionGuard permission="ASSET_CREATE">
                        <Button type="button" size="sm" onClick={openAddSubSystem} disabled={!selectedGroup.is_active}>
                          <Plus className="h-4 w-4" />
                          Add Sub-system
                        </Button>
                      </PermissionGuard>
                    ) : null}
                    <PermissionGuard permission="ASSET_UPDATE">
                      <Button type="button" variant="secondary" size="sm" onClick={openEditGroup}>
                        <Pencil className="h-4 w-4" />
                        Edit {selectedGroup.group_type === "SYSTEM" ? "System" : "Sub-system"}
                      </Button>
                    </PermissionGuard>
                    <PermissionGuard permission="ASSET_UPDATE">
                      <Button type="button" variant="secondary" size="sm" onClick={openManageMembers} disabled={!selectedGroup.is_active}>
                        <Users className="h-4 w-4" />
                        Manage Members
                      </Button>
                    </PermissionGuard>
                    <PermissionGuard permission="ASSET_DELETE">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmDeleteGroup(true)}
                        disabled={selectedGroup.child_group_count > 0 || selectedGroup.direct_asset_count > 0}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </PermissionGuard>
                  </div>
                ) : null}

                {selectedGroup && contextMode === "members" ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setContextMode("detail")}>
                    Done
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="space-y-5 px-5 py-5">
              {contextMode === "form" ? renderForm() : null}

              {contextMode === "detail" && !selectedGroup ? (
                <EmptyState
                  title="Select a system or sub-system to view details, or create a new system."
                  description="The grouping tree stays available while you view, edit, create, or manage members."
                  action={(
                    <PermissionGuard permission="ASSET_CREATE">
                      <Button type="button" onClick={openCreateSystem}>
                        <Plus className="h-4 w-4" />
                        New System
                      </Button>
                    </PermissionGuard>
                  )}
                  className="min-h-[420px]"
                />
              ) : null}

              {contextMode === "detail" && selectedGroup ? (
                <div className="space-y-5">
                  {confirmDeleteGroup ? (
                    <ConfirmStrip
                      tone="danger"
                      title="Delete this asset group?"
                      message={`"${selectedGroup.group_name}" can only be deleted when it has no sub-systems and no direct asset memberships.`}
                      confirmLabel={savingGroup ? "Deleting..." : "Delete Group"}
                      onConfirm={() => void handleDeleteGroup()}
                      onCancel={() => setConfirmDeleteGroup(false)}
                      disabled={savingGroup}
                    />
                  ) : null}

                  {selectedGroup.child_group_count > 0 || selectedGroup.direct_asset_count > 0 ? (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Delete is available after sub-systems and direct asset memberships are removed.
                    </div>
                  ) : null}

                  <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {selectedGroup.group_type === "SYSTEM" ? (
                            <Layers3 className="h-5 w-5 text-blue-600" />
                          ) : (
                            <GitBranch className="h-5 w-5 text-emerald-600" />
                          )}
                          <h3 className="truncate text-base font-semibold text-slate-900">{selectedGroup.group_name}</h3>
                          <TypeBadge groupType={selectedGroup.group_type} />
                          <GroupStatusBadge active={selectedGroup.is_active} />
                        </div>
                        <div className="mt-2 text-sm text-slate-500">
                          {selectedGroup.group_code ? <span className="font-mono uppercase">{selectedGroup.group_code}</span> : "No group code"}
                          {selectedGroup.parent_group_name ? ` - Parent system: ${selectedGroup.parent_group_name}` : " - Top-level system"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <DetailField label={selectedGroup.group_type === "SYSTEM" ? "System" : "Sub-system"}>
                      <TypeBadge groupType={selectedGroup.group_type} />
                    </DetailField>
                    <DetailField label="Org Scope">{selectedGroup.org_node_name || "Enterprise"}</DetailField>
                    <DetailField label="Sub-system Count">{selectedGroup.child_group_count}</DetailField>
                    <DetailField label="Member Asset Count">{selectedGroup.direct_asset_count}</DetailField>
                  </div>

                  {selectedGroup.group_type === "SUB_SYSTEM" ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailField label="Parent System">{parentSystem?.group_name ?? selectedGroup.parent_group_name ?? "-"}</DetailField>
                      <DetailField label="Parent Code">{parentSystem?.group_code ?? "-"}</DetailField>
                    </div>
                  ) : null}

                  <div className="rounded-md border border-slate-200 bg-white px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Description</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selectedGroup.description || "No description has been captured for this group yet."}
                    </p>
                  </div>

                  {selectedGroup.group_type === "SYSTEM" ? (
                    <div className="rounded-md border border-slate-200 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">Sub-systems</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {childGroups.length} sub-system{childGroups.length === 1 ? "" : "s"} linked to this system.
                          </p>
                        </div>
                        <PermissionGuard permission="ASSET_CREATE">
                          <Button type="button" variant="secondary" size="sm" onClick={openAddSubSystem} disabled={!selectedGroup.is_active}>
                            <Plus className="h-4 w-4" />
                            Add
                          </Button>
                        </PermissionGuard>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {childGroups.length === 0 ? (
                          <EmptyState
                            title="No sub-systems"
                            description="Add sub-systems to represent finer operational or technical boundaries."
                            className="md:col-span-2"
                          />
                        ) : (
                          childGroups.map((group) => (
                            <button
                              key={group.id}
                              type="button"
                              className="rounded-md border border-slate-200 bg-white p-3 text-left hover:border-blue-300 hover:bg-blue-50"
                              onClick={() => handleSelectGroup(group.id)}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold text-slate-900">{group.group_name}</div>
                                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                                    {group.group_code ? <span className="font-mono">{group.group_code}</span> : null}
                                    <span>{group.direct_asset_count} direct asset{group.direct_asset_count === 1 ? "" : "s"}</span>
                                  </div>
                                </div>
                                <GitBranch className="h-4 w-4 shrink-0 text-emerald-600" />
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Direct Member Assets</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Assets assigned directly to this {selectedGroup.group_type === "SYSTEM" ? "system" : "sub-system"}.
                        </p>
                      </div>
                      <PermissionGuard permission="ASSET_UPDATE">
                        <Button type="button" variant="secondary" size="sm" onClick={openManageMembers} disabled={!selectedGroup.is_active}>
                          <Users className="h-4 w-4" />
                          Manage Members
                        </Button>
                      </PermissionGuard>
                    </div>
                    <MemberAssetTable memberships={memberships} loading={membershipLoading} />
                  </div>
                </div>
              ) : null}

              {contextMode === "members" && selectedGroup ? (
                <div className="space-y-5">
                  {membershipToRemove ? (
                    <ConfirmStrip
                      tone="danger"
                      title="Remove asset from group?"
                      message={`Remove "${membershipToRemove.asset_name ?? membershipToRemove.asset_id ?? "this asset"}" from ${selectedGroup.group_name}?`}
                      confirmLabel={removingAsset ? "Removing..." : "Remove Asset"}
                      onConfirm={() => void handleRemoveAsset()}
                      onCancel={() => setMembershipToRemove(null)}
                      disabled={removingAsset}
                    />
                  ) : null}

                  <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{selectedGroup.group_name}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Manage direct asset memberships for this {selectedGroup.group_type === "SYSTEM" ? "system" : "sub-system"}.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <TypeBadge groupType={selectedGroup.group_type} />
                        <GroupStatusBadge active={selectedGroup.is_active} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-900">Current Member Assets</h3>
                    <MemberAssetTable
                      memberships={memberships}
                      loading={membershipLoading}
                      showActions
                      onRemove={setMembershipToRemove}
                    />
                  </div>

                  {renderAvailableAssetPicker()}

                  <div className="flex justify-end border-t border-slate-200 pt-4">
                    <Button type="button" variant="secondary" onClick={() => setContextMode("detail")}>
                      Done
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
