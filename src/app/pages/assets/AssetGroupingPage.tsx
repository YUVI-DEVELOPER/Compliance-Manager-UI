import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast, Toaster } from "sonner";

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
import { AssetGroupFormDialog, type AssetGroupFormValues } from "../../components/assets/AssetGroupFormDialog";
import { AssetGroupMembershipDialog } from "../../components/assets/AssetGroupMembershipDialog";
import { AssetGroupTree } from "../../components/assets/AssetGroupTree";
import { flattenOrgTreeOptions } from "../../components/assets/assetForm.shared";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

type GroupTypeFilter = AssetGroupType | "ALL";

const DEFAULT_ACTOR = "admin";
const typeSelectClassName =
  "h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    const message = error.response?.data?.message;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }
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
      || [group.group_name, group.group_code, group.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    const matchesType = typeFilter === "ALL" || group.group_type === typeFilter;
    if ((matchesSearch && matchesType) || children.length > 0) {
      return [{ ...group, children }];
    }
    return [];
  });
}

export function AssetGroupingPage() {
  const header = getPageHeaderConfig("asset-grouping");
  const [groupTree, setGroupTree] = useState<AssetGroupRecord[]>([]);
  const [orgOptions, setOrgOptions] = useState<ReturnType<typeof flattenOrgTreeOptions>>([]);
  const [groupTreeLoading, setGroupTreeLoading] = useState(true);
  const [membershipLoading, setMembershipLoading] = useState(false);
  const [memberships, setMemberships] = useState<AssetGroupMembershipRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<GroupTypeFilter>("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formDefaultType, setFormDefaultType] = useState<AssetGroupType>("SYSTEM");
  const [formDefaultParentGroupId, setFormDefaultParentGroupId] = useState<string | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [membershipDialogOpen, setMembershipDialogOpen] = useState(false);
  const [savingMemberships, setSavingMemberships] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
  const systemGroups = useMemo(
    () => flatGroups.filter((group) => group.group_type === "SYSTEM"),
    [flatGroups],
  );
  const childGroups = useMemo(
    () => flatGroups.filter((group) => group.parent_group_id === selectedGroupId),
    [flatGroups, selectedGroupId],
  );
  const existingMembershipAssetIds = useMemo(
    () => new Set(memberships.map((membership) => membership.asset_uuid)),
    [memberships],
  );

  const loadGroupTree = useCallback(async (preferredGroupId?: string | null) => {
    setGroupTreeLoading(true);
    try {
      const [groups, orgTree] = await Promise.all([getAssetGroupTree(), getOrgTree()]);
      setGroupTree(groups);
      setOrgOptions(flattenOrgTreeOptions(orgTree));

      const nextFlatGroups = flattenGroups(groups);
      setSelectedGroupId((currentSelectedGroupId) => (
        preferredGroupId && nextFlatGroups.some((group) => group.id === preferredGroupId)
          ? preferredGroupId
          : currentSelectedGroupId && nextFlatGroups.some((group) => group.id === currentSelectedGroupId)
            ? currentSelectedGroupId
            : nextFlatGroups[0]?.id ?? null
      ));
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

  useEffect(() => {
    void loadGroupTree(null);
  }, [loadGroupTree]);

  useEffect(() => {
    void loadMemberships(selectedGroupId);
  }, [loadMemberships, selectedGroupId]);

  const headerStats = buildPageHeaderStats(header.stats, {
    total: flatGroups.length,
    systems: flatGroups.filter((group) => group.group_type === "SYSTEM").length,
    "sub-systems": flatGroups.filter((group) => group.group_type === "SUB_SYSTEM").length,
  });

  const openCreateDialog = (groupType: AssetGroupType) => {
    setFormMode("create");
    setFormDefaultType(groupType);
    setFormDefaultParentGroupId(
      groupType === "SUB_SYSTEM"
        ? selectedGroup?.group_type === "SYSTEM"
          ? selectedGroup.id
          : selectedGroup?.parent_group_id ?? null
        : null,
    );
    setFormOpen(true);
  };

  const handleSubmitGroup = async (values: AssetGroupFormValues) => {
    setSavingGroup(true);
    try {
      if (formMode === "edit" && selectedGroup) {
        await updateAssetGroup(selectedGroup.id, {
          group_name: values.group_name,
          group_code: values.group_code || null,
          group_type: values.group_type,
          description: values.description || null,
          parent_group_id: values.parent_group_id || null,
          org_node_id: values.org_node_id || null,
          is_active: values.is_active,
          modified_by: DEFAULT_ACTOR,
        });
        toast.success("Asset group updated successfully");
        await loadGroupTree(selectedGroup.id);
      } else {
        const createdGroup = await createAssetGroup({
          group_name: values.group_name,
          group_code: values.group_code || null,
          group_type: values.group_type,
          description: values.description || null,
          parent_group_id: values.parent_group_id || null,
          org_node_id: values.org_node_id || null,
          is_active: values.is_active,
          created_by: DEFAULT_ACTOR,
        });
        toast.success("Asset group created successfully");
        await loadGroupTree(createdGroup.id);
      }
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup) return;
    setSavingGroup(true);
    try {
      await deleteAssetGroup(selectedGroup.id);
      toast.success("Asset group deleted successfully");
      setDeleteDialogOpen(false);
      await loadGroupTree(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingGroup(false);
    }
  };

  const handleAddAssets = async (assetUuids: string[]) => {
    if (!selectedGroup) return;
    setSavingMemberships(true);
    try {
      await addAssetsToGroup(selectedGroup.id, {
        asset_uuids: assetUuids,
        created_by: DEFAULT_ACTOR,
      });
      toast.success("Assets assigned successfully");
      setMembershipDialogOpen(false);
      await Promise.all([loadGroupTree(selectedGroup.id), loadMemberships(selectedGroup.id)]);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSavingMemberships(false);
    }
  };

  const handleRemoveAsset = async () => {
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

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={header.subtitle}
        search={header.searchPlaceholder ? {
          value: searchQuery,
          placeholder: header.searchPlaceholder,
          onChange: setSearchQuery,
          onClear: () => setSearchQuery(""),
          disabled: groupTreeLoading,
        } : undefined}
        stats={headerStats}
        rightSlot={(
          <select
            className={typeSelectClassName}
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as GroupTypeFilter)}
            disabled={groupTreeLoading}
          >
            <option value="ALL">All groups</option>
            <option value="SYSTEM">Systems</option>
            <option value="SUB_SYSTEM">Sub-systems</option>
          </select>
        )}
        primaryAction={header.primaryAction ? {
          ...header.primaryAction,
          onClick: () => openCreateDialog("SYSTEM"),
          disabled: groupTreeLoading,
        } : undefined}
        secondaryActions={[
          {
            ...(header.secondaryActions?.[0] ?? { key: "new-sub-system", label: "New Sub-System", variant: "secondary" }),
            onClick: () => openCreateDialog("SUB_SYSTEM"),
            disabled: groupTreeLoading,
          },
          {
            ...(header.secondaryActions?.[1] ?? { key: "refresh", label: "Refresh", variant: "secondary" }),
            onClick: () => void loadGroupTree(selectedGroupId),
            disabled: groupTreeLoading,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <div className="grid gap-4 xl:grid-cols-[360px,minmax(0,1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="space-y-1 border-b border-slate-200 pb-4">
              <h2 className="text-lg font-semibold text-slate-900">Grouping Hierarchy</h2>
            </div>

            <div className="mt-4">
              <AssetGroupTree
                groups={filteredTree}
                selectedGroupId={selectedGroupId}
                loading={groupTreeLoading}
                onSelectGroup={setSelectedGroupId}
              />
            </div>
          </section>

          <div className="space-y-4">
            {!selectedGroup ? (
              <section className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900">Select a Group</h2>
              </section>
            ) : (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-900">{selectedGroup.group_name}</h2>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                        selectedGroup.group_type === "SYSTEM"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}>
                        {selectedGroup.group_type === "SYSTEM" ? "System" : "Sub-system"}
                      </span>
                      {!selectedGroup.is_active && (
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500">
                      {selectedGroup.group_code ? `${selectedGroup.group_code} - ` : ""}
                      {selectedGroup.parent_group_name
                        ? `Parent system: ${selectedGroup.parent_group_name}`
                        : "Top-level grouping"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setFormMode("edit");
                        setFormDefaultType(selectedGroup.group_type);
                        setFormDefaultParentGroupId(selectedGroup.parent_group_id ?? null);
                        setFormOpen(true);
                      }}
                    >
                      Edit Group
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={selectedGroup.child_group_count > 0 || selectedGroup.direct_asset_count > 0}
                    >
                      Delete Group
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Parent System</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{selectedGroup.parent_group_name || "None"}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Child Groups</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{selectedGroup.child_group_count}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Direct Assets</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{selectedGroup.direct_asset_count}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Org Scope</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{selectedGroup.org_node_name || "Enterprise"}</div>
                  </div>
                </div>

                <div className="grid gap-4 border-t border-slate-200 px-5 py-5 xl:grid-cols-[minmax(0,1fr),320px]">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Description</div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selectedGroup.description || "No description has been captured for this group yet."}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Connected Child Groups</div>
                    <div className="mt-3 space-y-2">
                      {childGroups.length === 0 ? (
                        <div className="text-sm text-slate-500">No child groups linked directly to this node.</div>
                      ) : (
                        childGroups.map((group) => (
                          <button
                            key={group.id}
                            type="button"
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                            onClick={() => setSelectedGroupId(group.id)}
                          >
                            <div className="text-sm font-medium text-slate-900">{group.group_name}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {group.group_code ? `${group.group_code} - ` : ""}
                              {group.direct_asset_count} direct asset{group.direct_asset_count === 1 ? "" : "s"}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Direct Asset Membership</h2>
                  </div>
                  <Button
                    type="button"
                    onClick={() => setMembershipDialogOpen(true)}
                    disabled={!selectedGroup.is_active}
                  >
                    Add Assets
                  </Button>
                </div>

                <div className="overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="px-4">Asset</TableHead>
                        <TableHead className="px-4">Class / Type</TableHead>
                        <TableHead className="px-4">Organization</TableHead>
                        <TableHead className="px-4">Status</TableHead>
                        <TableHead className="px-4 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membershipLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="px-4 py-10 text-center text-slate-500">
                            Loading asset memberships...
                          </TableCell>
                        </TableRow>
                      ) : memberships.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="px-4 py-10 text-center text-slate-500">
                            No assets are directly assigned to this group yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        memberships.map((membership) => (
                          <TableRow key={membership.id} className="hover:bg-slate-50">
                            <TableCell className="px-4">
                              <div className="space-y-1">
                                <div className="font-medium text-slate-900">{membership.asset_name || "-"}</div>
                                <div className="text-xs text-slate-500">{membership.asset_id || "-"}</div>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 text-sm text-slate-600">
                              {[membership.asset_class, membership.asset_type].filter(Boolean).join(" / ") || "-"}
                            </TableCell>
                            <TableCell className="px-4 text-sm text-slate-600">{membership.org_node_name || "-"}</TableCell>
                            <TableCell className="px-4 text-sm text-slate-600">{membership.asset_status || "-"}</TableCell>
                            <TableCell className="px-4 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setMembershipToRemove(membership)}
                              >
                                Remove
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      <AssetGroupFormDialog
        open={formOpen}
        mode={formMode}
        initialGroup={formMode === "edit" ? selectedGroup : null}
        defaultType={formDefaultType}
        defaultParentGroupId={formDefaultParentGroupId}
        availableSystems={systemGroups}
        orgOptions={orgOptions}
        saving={savingGroup}
        onOpenChange={setFormOpen}
        onSubmit={handleSubmitGroup}
      />

      <AssetGroupMembershipDialog
        open={membershipDialogOpen}
        group={selectedGroup}
        existingAssetIds={existingMembershipAssetIds}
        saving={savingMemberships}
        onOpenChange={setMembershipDialogOpen}
        onSubmit={handleAddAssets}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset Group</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedGroup
                ? `Delete "${selectedGroup.group_name}"? This is only allowed when the group has no child groups and no direct asset memberships.`
                : "Delete the selected asset group?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingGroup}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteGroup();
              }}
              disabled={savingGroup}
              className="bg-red-600 hover:bg-red-700"
            >
              {savingGroup ? "Deleting..." : "Delete Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(membershipToRemove)} onOpenChange={(open) => !open && setMembershipToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Asset Membership</AlertDialogTitle>
            <AlertDialogDescription>
              {membershipToRemove
                ? `Remove "${membershipToRemove.asset_name ?? membershipToRemove.asset_id ?? "this asset"}" from the selected group?`
                : "Remove this asset from the selected group?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingAsset}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleRemoveAsset();
              }}
              disabled={removingAsset}
              className="bg-red-600 hover:bg-red-700"
            >
              {removingAsset ? "Removing..." : "Remove Asset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster position="top-right" richColors />
    </div>
  );
}

