import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, KeyRound, Layers3, Pencil, Plus, RefreshCw, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "../auth/PermissionGuard";
import { useAuth } from "../auth/useAuth";
import { ConfirmStrip, EmptyState, FilterBar, RightPanel, StatusBadge, type ActiveFilter } from "../components/foundation";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input, SearchInput } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { cn } from "../components/ui/utils";
import {
  createRole,
  GroupedPermissionGroups,
  GroupedPermissions,
  listPermissionGroupsGrouped,
  listPermissionsGrouped,
  listRoles,
  PermissionGroupRecord,
  PermissionRecord,
  RoleRecord,
  setRoleActive,
  setRolePermissionGroups,
  setRolePermissions,
  updateRole,
} from "../../services/rbac.service";

type PanelMode = "create" | "view" | "edit" | "permissions";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type RoleTypeFilter = "ALL" | "SYSTEM" | "CUSTOM";

interface RoleFormState {
  role_code: string;
  role_name: string;
  description: string;
  is_active: boolean;
}

interface ConfirmAction {
  role: RoleRecord;
  nextActive: boolean;
}

const emptyCreateForm: RoleFormState = {
  role_code: "",
  role_name: "",
  description: "",
  is_active: true,
};

const moduleOrder = [
  "ASSET",
  "DOCUMENT",
  "SUPPLIER",
  "ORG",
  "ORGANIZATION",
  "USER",
  "ROLE",
  "REPORT",
  "AUDIT",
  "LOOKUP",
  "SYSTEM",
  "NOTIFICATION",
];

const normalizeCode = (value: string): string => value.trim().toUpperCase();

const formatModuleName = (moduleName: string): string => moduleName.replace(/_/g, " ");

const formatValue = (value?: string | null): string => {
  const text = (value ?? "").trim();
  return text || "-";
};

const sameSet = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
};

const sortCodes = (items: string[]): string[] => [...new Set(items.map(normalizeCode).filter(Boolean))].sort();

const roleSearchText = (role: RoleRecord): string =>
  [role.role_code, role.role_name, role.description, role.is_active ? "active" : "inactive", role.is_system_role ? "system" : "custom"]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const moduleSort = (left: string, right: string): number => {
  const leftIndex = moduleOrder.indexOf(left.toUpperCase());
  const rightIndex = moduleOrder.indexOf(right.toUpperCase());
  if (leftIndex !== -1 || rightIndex !== -1) {
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  }
  return left.localeCompare(right);
};

function countUsersLabel(): null {
  return null;
}

function RoleStatusBadge({ active }: { active: boolean }) {
  return <StatusBadge status={active ? "active" : "inactive"}>{active ? "Active" : "Inactive"}</StatusBadge>;
}

function MetricBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function FieldBlock({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className={cn("mt-1 break-words text-sm font-medium text-slate-900", mono ? "font-mono text-xs" : null)}>{value}</div>
    </div>
  );
}

function moduleGroups<T extends { module_name: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => moduleSort(left.module_name, right.module_name));
}

export function RoleManagementPage() {
  const { hasPermission } = useAuth();
  const header = getPageHeaderConfig("role-management");
  const canAssignPermission = hasPermission("ROLE_ASSIGN_PERMISSION");

  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [modules, setModules] = useState<GroupedPermissions[]>([]);
  const [groupModules, setGroupModules] = useState<GroupedPermissionGroups[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<PanelMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [roleTypeFilter, setRoleTypeFilter] = useState<RoleTypeFilter>("ALL");

  const [createForm, setCreateForm] = useState<RoleFormState>(emptyCreateForm);
  const [editForm, setEditForm] = useState({ role_name: "", description: "" });
  const [pendingDirectPermissions, setPendingDirectPermissions] = useState<string[]>([]);
  const [pendingPermissionGroups, setPendingPermissionGroups] = useState<string[]>([]);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const selectedRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) ?? null,
    [roles, selectedRoleId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRoles, nextModules, nextGroupModules] = await Promise.all([
        listRoles(true),
        listPermissionsGrouped(true),
        listPermissionGroupsGrouped(true),
      ]);
      setRoles(nextRoles);
      setModules(moduleGroups(nextModules));
      setGroupModules(moduleGroups(nextGroupModules));
      setSelectedRoleId((current) => {
        if (current && nextRoles.some((role) => role.id === current)) return current;
        return nextRoles[0]?.id ?? null;
      });
    } catch (loadError: any) {
      const message = loadError?.response?.data?.detail || "Failed to load roles and permissions";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const filters: ActiveFilter[] = [];
    if (search.trim()) {
      filters.push({ key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") });
    }
    if (statusFilter !== "ALL") {
      filters.push({ key: "status", label: `Status: ${statusFilter === "ACTIVE" ? "Active" : "Inactive"}`, onRemove: () => setStatusFilter("ALL") });
    }
    if (roleTypeFilter !== "ALL") {
      filters.push({ key: "roleType", label: `Type: ${roleTypeFilter === "SYSTEM" ? "System" : "Custom"}`, onRemove: () => setRoleTypeFilter("ALL") });
    }
    return filters;
  }, [roleTypeFilter, search, statusFilter]);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return roles.filter((role) => {
      if (query && !roleSearchText(role).includes(query)) return false;
      if (statusFilter === "ACTIVE" && !role.is_active) return false;
      if (statusFilter === "INACTIVE" && role.is_active) return false;
      if (roleTypeFilter === "SYSTEM" && !role.is_system_role) return false;
      if (roleTypeFilter === "CUSTOM" && role.is_system_role) return false;
      return true;
    });
  }, [roleTypeFilter, roles, search, statusFilter]);

  const directPermissions = selectedRole ? sortCodes(selectedRole.direct_permissions ?? selectedRole.permissions) : [];
  const assignedGroups = selectedRole ? sortCodes(selectedRole.permission_groups ?? []) : [];
  const selectedGroupPermissionCodes = useMemo(() => {
    const codes = new Set<string>();
    groupModules.forEach((module) => {
      module.permission_groups.forEach((group) => {
        if (pendingPermissionGroups.includes(group.group_code)) {
          group.permission_codes.forEach((code) => codes.add(code));
        }
      });
    });
    return codes;
  }, [groupModules, pendingPermissionGroups]);

  const permissionDirty = Boolean(
    selectedRole &&
      (!sameSet(sortCodes(pendingDirectPermissions), directPermissions) || !sameSet(sortCodes(pendingPermissionGroups), assignedGroups)),
  );

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setRoleTypeFilter("ALL");
  };

  const seedRoleState = (role: RoleRecord) => {
    setSelectedRoleId(role.id);
    setEditForm({ role_name: role.role_name, description: role.description ?? "" });
    setPendingDirectPermissions(sortCodes(role.direct_permissions ?? role.permissions));
    setPendingPermissionGroups(sortCodes(role.permission_groups ?? []));
    setConfirmAction(null);
  };

  const openRolePanel = (role: RoleRecord, mode: Exclude<PanelMode, "create">) => {
    seedRoleState(role);
    setPanelMode(mode);
  };

  const openCreatePanel = () => {
    setCreateForm(emptyCreateForm);
    setConfirmAction(null);
    setPanelMode("create");
  };

  const closePanel = () => {
    setPanelMode(null);
    setConfirmAction(null);
  };

  const createNewRole = async () => {
    const roleCode = normalizeCode(createForm.role_code);
    const roleName = createForm.role_name.trim();
    if (!roleCode || !roleName) {
      toast.error("Role code and role name are required");
      return;
    }
    setSaving(true);
    try {
      const role = await createRole({
        role_code: roleCode,
        role_name: roleName,
        description: createForm.description.trim() || null,
        permission_codes: [],
        permission_group_codes: [],
        is_active: createForm.is_active,
      });
      toast.success("Role created");
      setCreateForm(emptyCreateForm);
      await load();
      seedRoleState(role);
      setPanelMode("view");
    } catch (createError: any) {
      toast.error(createError?.response?.data?.detail || "Failed to create role");
    } finally {
      setSaving(false);
    }
  };

  const saveRoleMetadata = async () => {
    if (!selectedRole) return;
    const roleName = editForm.role_name.trim();
    if (!roleName) {
      toast.error("Role name is required");
      return;
    }
    setSaving(true);
    try {
      const updated = await updateRole(selectedRole.id, {
        role_name: roleName,
        description: editForm.description.trim() || null,
      });
      toast.success("Role updated");
      await load();
      seedRoleState(updated);
      setPanelMode("view");
    } catch (updateError: any) {
      toast.error(updateError?.response?.data?.detail || "Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const applyStatusChange = async () => {
    if (!confirmAction) return;
    setSaving(true);
    try {
      const updated = await setRoleActive(confirmAction.role.id, confirmAction.nextActive);
      toast.success(confirmAction.nextActive ? "Role activated" : "Role deactivated");
      await load();
      if (selectedRoleId === updated.id || panelMode) {
        seedRoleState(updated);
      }
      setConfirmAction(null);
    } catch (statusError: any) {
      toast.error(statusError?.response?.data?.detail || "Failed to update role status");
    } finally {
      setSaving(false);
    }
  };

  const togglePendingPermission = (permissionCode: string, checked: boolean) => {
    setPendingDirectPermissions((current) => {
      const currentSet = new Set(current);
      if (checked) currentSet.add(permissionCode);
      else currentSet.delete(permissionCode);
      return [...currentSet].sort();
    });
  };

  const togglePendingGroup = (groupCode: string, checked: boolean) => {
    setPendingPermissionGroups((current) => {
      const currentSet = new Set(current);
      if (checked) currentSet.add(groupCode);
      else currentSet.delete(groupCode);
      return [...currentSet].sort();
    });
  };

  const setModulePermissions = (permissions: PermissionRecord[], checked: boolean) => {
    setPendingDirectPermissions((current) => {
      const currentSet = new Set(current);
      permissions.forEach((permission) => {
        if (checked) currentSet.add(permission.permission_code);
        else currentSet.delete(permission.permission_code);
      });
      return [...currentSet].sort();
    });
  };

  const setModuleGroups = (groups: PermissionGroupRecord[], checked: boolean) => {
    setPendingPermissionGroups((current) => {
      const currentSet = new Set(current);
      groups.forEach((group) => {
        if (checked) currentSet.add(group.group_code);
        else currentSet.delete(group.group_code);
      });
      return [...currentSet].sort();
    });
  };

  const resetPermissionChanges = () => {
    if (!selectedRole) return;
    setPendingDirectPermissions(sortCodes(selectedRole.direct_permissions ?? selectedRole.permissions));
    setPendingPermissionGroups(sortCodes(selectedRole.permission_groups ?? []));
  };

  const savePermissionChanges = async () => {
    if (!selectedRole || !canAssignPermission || !permissionDirty) return;
    setSaving(true);
    try {
      const directChanged = !sameSet(sortCodes(pendingDirectPermissions), directPermissions);
      const groupsChanged = !sameSet(sortCodes(pendingPermissionGroups), assignedGroups);
      let updated = selectedRole;
      if (directChanged) updated = await setRolePermissions(selectedRole.id, sortCodes(pendingDirectPermissions));
      if (groupsChanged) updated = await setRolePermissionGroups(selectedRole.id, sortCodes(pendingPermissionGroups));
      toast.success("Role permissions updated");
      await load();
      seedRoleState(updated);
      setPanelMode("permissions");
    } catch (saveError: any) {
      toast.error(saveError?.response?.data?.detail || "Failed to save permission changes");
    } finally {
      setSaving(false);
    }
  };

  const panelTitle =
    panelMode === "create"
      ? "Create Role"
      : selectedRole
        ? selectedRole.role_name
        : "Role Detail";

  const panelDescription =
    panelMode === "permissions"
      ? "Permission matrix and permission group assignments"
      : panelMode === "edit"
        ? "Edit role metadata"
        : panelMode === "create"
          ? "Create a new RBAC role"
          : selectedRole
            ? `${selectedRole.role_code} | ${selectedRole.permissions.length} effective permissions`
            : undefined;

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Role Management"
        subtitle="Manage roles and assigned permissions"
      />

      <div className={PAGE_CONTENT_CLASS}>
        <FilterBar activeFilters={activeFilters} onClearAll={activeFilters.length ? clearFilters : undefined} className="shadow-sm">
          <div className="w-full min-w-64 flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
            <SearchInput
              value={search}
              placeholder="Search role name, code, or description"
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              className="h-9 bg-white"
            />
          </div>
          <label className="flex w-full flex-col gap-1.5 sm:w-40">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
          <label className="flex w-full flex-col gap-1.5 sm:w-40">
            <span className="text-sm font-medium text-slate-700">Role Type</span>
            <select
              value={roleTypeFilter}
              onChange={(event) => setRoleTypeFilter(event.target.value as RoleTypeFilter)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            >
              <option value="ALL">All types</option>
              <option value="SYSTEM">System</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : null)} />
              Refresh
            </Button>
            <PermissionGuard permission="ROLE_CREATE">
              <Button type="button" onClick={openCreatePanel}>
                <Plus className="h-4 w-4" />
                Create Role
              </Button>
            </PermissionGuard>
          </div>
        </FilterBar>

        {confirmAction && !panelMode ? (
          <ConfirmStrip
            title={confirmAction.nextActive ? "Activate role?" : "Deactivate role?"}
            message={`This will ${confirmAction.nextActive ? "activate" : "deactivate"} ${confirmAction.role.role_name}.`}
            confirmLabel={confirmAction.nextActive ? "Activate" : "Deactivate"}
            onConfirm={() => void applyStatusChange()}
            onCancel={() => setConfirmAction(null)}
            disabled={saving}
            tone={confirmAction.nextActive ? "warning" : "danger"}
          />
        ) : null}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">RBAC Roles</h2>
              <p className="mt-1 text-xs text-slate-500">
                {filteredRoles.length} of {roles.length} roles shown. User counts are not exposed by the current RBAC API.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Local filters
            </div>
          </div>

          {loading && roles.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">Loading roles...</div>
          ) : error && roles.length === 0 ? (
            <EmptyState
              title="Unable to load roles"
              description={error}
              icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
              action={
                <Button type="button" variant="secondary" onClick={() => void load()}>
                  Try Again
                </Button>
              }
              className="m-4 min-h-72 bg-white"
            />
          ) : filteredRoles.length === 0 ? (
            <EmptyState
              title={roles.length === 0 ? "No roles found" : "No roles match the filters"}
              description={roles.length === 0 ? "Create the first RBAC role to begin assigning permissions." : "Adjust search, status, or role type filters."}
              className="m-4 min-h-72 bg-white"
            />
          ) : (
            <Table containerClassName="max-h-[62vh]">
              <TableHeader className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <TableRow>
                  <TableHead className="min-w-60 px-4">Role</TableHead>
                  <TableHead className="min-w-72 px-4">Description</TableHead>
                  <TableHead className="min-w-28 px-4">Status</TableHead>
                  <TableHead className="min-w-32 px-4">Type</TableHead>
                  <TableHead className="min-w-40 px-4">Permissions</TableHead>
                  <TableHead className="min-w-40 px-4">Groups</TableHead>
                  <TableHead className="min-w-72 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => {
                  const userCount = countUsersLabel();
                  return (
                    <TableRow key={role.id} className="cursor-pointer hover:bg-blue-50/40" onClick={() => openRolePanel(role, "view")}>
                      <TableCell className="px-4">
                        <div className="font-semibold text-slate-900">{role.role_name}</div>
                        <div className="mt-0.5 font-mono text-xs text-slate-500">{role.role_code}</div>
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="max-w-80 truncate text-slate-700" title={role.description ?? undefined}>
                          {formatValue(role.description)}
                        </div>
                        {userCount ? <div className="mt-1 text-xs text-slate-500">{userCount}</div> : null}
                      </TableCell>
                      <TableCell className="px-4">
                        <RoleStatusBadge active={role.is_active} />
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge variant="outline" className={role.is_system_role ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
                          {role.is_system_role ? "System" : "Custom"}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-slate-700">
                        <div className="font-semibold text-slate-900">{role.permissions.length}</div>
                        <div className="text-xs text-slate-500">{(role.direct_permissions ?? []).length} direct</div>
                      </TableCell>
                      <TableCell className="px-4 text-slate-700">
                        <div className="font-semibold text-slate-900">{(role.permission_groups ?? []).length}</div>
                        <div className="text-xs text-slate-500">assigned groups</div>
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                          <Button type="button" variant="ghost" size="sm" onClick={() => openRolePanel(role, "view")}>
                            View/Edit
                          </Button>
                          <PermissionGuard permission="ROLE_ASSIGN_PERMISSION">
                            <Button type="button" variant="secondary" size="sm" onClick={() => openRolePanel(role, "permissions")}>
                              Manage Permissions
                            </Button>
                          </PermissionGuard>
                          {role.is_active ? (
                            <PermissionGuard permission="ROLE_DELETE">
                              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmAction({ role, nextActive: false })}>
                                Deactivate
                              </Button>
                            </PermissionGuard>
                          ) : (
                            <PermissionGuard permission="ROLE_UPDATE">
                              <Button type="button" variant="outline" size="sm" onClick={() => setConfirmAction({ role, nextActive: true })}>
                                Activate
                              </Button>
                            </PermissionGuard>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <RightPanel
        open={Boolean(panelMode)}
        onClose={closePanel}
        title={panelTitle}
        description={panelDescription}
        widthClassName={panelMode === "permissions" ? "max-w-5xl" : "max-w-2xl"}
        footer={
          panelMode === "create" ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closePanel} disabled={saving}>
                Cancel
              </Button>
              <PermissionGuard permission="ROLE_CREATE">
                <Button type="button" onClick={() => void createNewRole()} disabled={saving}>
                  <Save className="h-4 w-4" />
                  Create Role
                </Button>
              </PermissionGuard>
            </div>
          ) : panelMode === "edit" ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => selectedRole && openRolePanel(selectedRole, "view")} disabled={saving}>
                Cancel
              </Button>
              <PermissionGuard permission="ROLE_UPDATE">
                <Button type="button" onClick={() => void saveRoleMetadata()} disabled={saving}>
                  <Save className="h-4 w-4" />
                  Save Metadata
                </Button>
              </PermissionGuard>
            </div>
          ) : panelMode === "permissions" ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="secondary" onClick={resetPermissionChanges} disabled={!permissionDirty || saving}>
                Reset Changes
              </Button>
              <PermissionGuard permission="ROLE_ASSIGN_PERMISSION">
                <Button type="button" onClick={() => void savePermissionChanges()} disabled={!permissionDirty || saving || !selectedRole?.is_active}>
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </PermissionGuard>
            </div>
          ) : null
        }
      >
        <div className="space-y-4">
          {confirmAction && panelMode ? (
            <ConfirmStrip
              title={confirmAction.nextActive ? "Activate role?" : "Deactivate role?"}
              message={`This will ${confirmAction.nextActive ? "activate" : "deactivate"} ${confirmAction.role.role_name}.`}
              confirmLabel={confirmAction.nextActive ? "Activate" : "Deactivate"}
              onConfirm={() => void applyStatusChange()}
              onCancel={() => setConfirmAction(null)}
              disabled={saving}
              tone={confirmAction.nextActive ? "warning" : "danger"}
            />
          ) : null}

          {panelMode === "create" ? (
            <RoleCreatePanel form={createForm} onChange={setCreateForm} />
          ) : selectedRole && panelMode === "view" ? (
            <RoleDetailView
              role={selectedRole}
              onEdit={() => openRolePanel(selectedRole, "edit")}
              onPermissions={() => openRolePanel(selectedRole, "permissions")}
              onStatusChange={(nextActive) => setConfirmAction({ role: selectedRole, nextActive })}
            />
          ) : selectedRole && panelMode === "edit" ? (
            <RoleEditPanel role={selectedRole} form={editForm} onChange={setEditForm} />
          ) : selectedRole && panelMode === "permissions" ? (
            <PermissionMatrix
              role={selectedRole}
              modules={modules}
              groupModules={groupModules}
              pendingDirectPermissions={pendingDirectPermissions}
              pendingPermissionGroups={pendingPermissionGroups}
              selectedGroupPermissionCodes={selectedGroupPermissionCodes}
              canAssignPermission={canAssignPermission}
              dirty={permissionDirty}
              saving={saving}
              onTogglePermission={togglePendingPermission}
              onToggleGroup={togglePendingGroup}
              onSetModulePermissions={setModulePermissions}
              onSetModuleGroups={setModuleGroups}
              onSave={() => void savePermissionChanges()}
              onReset={resetPermissionChanges}
            />
          ) : (
            <EmptyState title="No role selected" description="Select a role to review its details and permissions." />
          )}
        </div>
      </RightPanel>
    </div>
  );
}

function RoleCreatePanel({ form, onChange }: { form: RoleFormState; onChange: (form: RoleFormState) => void }) {
  return (
    <div className="space-y-4">
      <Input
        label="Role Code"
        value={form.role_code}
        onChange={(event) => onChange({ ...form, role_code: event.target.value.toUpperCase().replace(/\s+/g, "_") })}
        placeholder="QA_REVIEWER"
        required
      />
      <Input
        label="Role Name"
        value={form.role_name}
        onChange={(event) => onChange({ ...form, role_name: event.target.value })}
        placeholder="QA Reviewer"
        required
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">Description</span>
        <Textarea
          rows={4}
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          placeholder="Describe the responsibilities covered by this role"
        />
      </label>
      <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(event) => onChange({ ...form, is_active: event.target.checked })}
        />
        Create as active role
      </label>
    </div>
  );
}

function RoleEditPanel({
  role,
  form,
  onChange,
}: {
  role: RoleRecord;
  form: { role_name: string; description: string };
  onChange: (form: { role_name: string; description: string }) => void;
}) {
  return (
    <div className="space-y-4">
      <FieldBlock label="Role Code" value={role.role_code} mono />
      <Input
        label="Role Name"
        value={form.role_name}
        onChange={(event) => onChange({ ...form, role_name: event.target.value })}
        required
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-slate-700">Description</span>
        <Textarea rows={5} value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} />
      </label>
      <FieldBlock label="Status" value={<RoleStatusBadge active={role.is_active} />} />
    </div>
  );
}

function RoleDetailView({
  role,
  onEdit,
  onPermissions,
  onStatusChange,
}: {
  role: RoleRecord;
  onEdit: () => void;
  onPermissions: () => void;
  onStatusChange: (nextActive: boolean) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <RoleStatusBadge active={role.is_active} />
            <Badge variant="outline" className={role.is_system_role ? "border-blue-200 bg-blue-50 text-blue-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
              {role.is_system_role ? "System role" : "Custom role"}
            </Badge>
          </div>
          <h2 className="mt-2 text-base font-semibold text-slate-900">{role.role_name}</h2>
          <p className="mt-1 font-mono text-xs text-slate-500">{role.role_code}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <MetricBox label="Effective Permissions" value={role.permissions.length} />
        <MetricBox label="Direct Permissions" value={(role.direct_permissions ?? []).length} />
        <MetricBox label="Permission Groups" value={(role.permission_groups ?? []).length} />
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Role Metadata</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <FieldBlock label="Role Name" value={role.role_name} />
          <FieldBlock label="Role Code" value={role.role_code} mono />
          <FieldBlock label="Description" value={formatValue(role.description)} />
          <FieldBlock label="User Count" value="Not available from current API" />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <PermissionGuard permission="ROLE_UPDATE">
          <Button type="button" variant="secondary" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit Metadata
          </Button>
        </PermissionGuard>
        <PermissionGuard permission="ROLE_ASSIGN_PERMISSION">
          <Button type="button" onClick={onPermissions}>
            <KeyRound className="h-4 w-4" />
            Manage Permissions
          </Button>
        </PermissionGuard>
        {role.is_active ? (
          <PermissionGuard permission="ROLE_DELETE">
            <Button type="button" variant="outline" onClick={() => onStatusChange(false)}>
              Deactivate
            </Button>
          </PermissionGuard>
        ) : (
          <PermissionGuard permission="ROLE_UPDATE">
            <Button type="button" variant="outline" onClick={() => onStatusChange(true)}>
              Activate
            </Button>
          </PermissionGuard>
        )}
      </div>
    </div>
  );
}

function PermissionMatrix({
  role,
  modules,
  groupModules,
  pendingDirectPermissions,
  pendingPermissionGroups,
  selectedGroupPermissionCodes,
  canAssignPermission,
  dirty,
  saving,
  onTogglePermission,
  onToggleGroup,
  onSetModulePermissions,
  onSetModuleGroups,
  onSave,
  onReset,
}: {
  role: RoleRecord;
  modules: GroupedPermissions[];
  groupModules: GroupedPermissionGroups[];
  pendingDirectPermissions: string[];
  pendingPermissionGroups: string[];
  selectedGroupPermissionCodes: Set<string>;
  canAssignPermission: boolean;
  dirty: boolean;
  saving: boolean;
  onTogglePermission: (permissionCode: string, checked: boolean) => void;
  onToggleGroup: (groupCode: string, checked: boolean) => void;
  onSetModulePermissions: (permissions: PermissionRecord[], checked: boolean) => void;
  onSetModuleGroups: (groups: PermissionGroupRecord[], checked: boolean) => void;
  onSave: () => void;
  onReset: () => void;
}) {
  const disabled = !canAssignPermission || !role.is_active || saving;

  return (
    <div className="space-y-5">
      {!role.is_active ? (
        <ConfirmStrip
          title="Role is inactive"
          message="Activate the role before changing permission assignments."
          confirmLabel="Read Only"
          onConfirm={() => undefined}
          disabled
          tone="neutral"
        />
      ) : null}

      {dirty ? (
        <ConfirmStrip
          title="Unsaved permission changes"
          message="Permission and group toggles are pending until you save."
          confirmLabel="Save Changes"
          cancelLabel="Reset Changes"
          onConfirm={onSave}
          onCancel={onReset}
          disabled={disabled}
          tone="warning"
        />
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Permission Groups</h3>
            <p className="mt-1 text-xs text-slate-500">Assigned groups grant their active permissions in addition to direct permissions.</p>
          </div>
          <Layers3 className="h-4 w-4 text-slate-400" />
        </div>

        {groupModules.length === 0 ? (
          <EmptyState title="No permission groups" description="No permission groups are available from the RBAC API." className="min-h-40" />
        ) : (
          <div className="space-y-3">
            {groupModules.map((module) => (
              <details key={module.module_name} open className="rounded-lg border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">{formatModuleName(module.module_name)} Groups</span>
                  <span className="text-xs text-slate-500">{module.permission_groups.length} groups</span>
                </summary>
                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onSetModuleGroups(module.permission_groups, true)}>
                      Assign module groups
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onSetModuleGroups(module.permission_groups, false)}>
                      Clear module groups
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                    {module.permission_groups.map((group) => {
                      const checked = pendingPermissionGroups.includes(group.group_code);
                      return (
                        <label key={group.id} className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={checked}
                            onChange={(event) => onToggleGroup(group.group_code, event.target.checked)}
                            className="mt-1"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-slate-900">{group.group_name}</span>
                              <StatusBadge status={group.is_active ? "active" : "inactive"}>{group.is_active ? "Active" : "Inactive"}</StatusBadge>
                            </span>
                            <span className="mt-1 block font-mono text-xs text-slate-500">{group.group_code}</span>
                            {group.description ? <span className="mt-1 block text-xs text-slate-600">{group.description}</span> : null}
                            <span className="mt-1 block text-xs text-slate-500">{group.permission_codes.length} permissions</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Individual Permissions</h3>
          <p className="mt-1 text-xs text-slate-500">Direct permissions can be assigned separately. Group-granted permissions are marked for context.</p>
        </div>

        {modules.length === 0 ? (
          <EmptyState title="No permissions" description="No individual permissions are available from the RBAC API." className="min-h-40" />
        ) : (
          <div className="space-y-3">
            {modules.map((module) => (
              <details key={module.module_name} open className="rounded-lg border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-slate-100 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">{formatModuleName(module.module_name)}</span>
                  <span className="text-xs text-slate-500">{module.permissions.length} permissions</span>
                </summary>
                <div className="space-y-2 p-3">
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onSetModulePermissions(module.permissions, true)}>
                      Select all direct
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onSetModulePermissions(module.permissions, false)}>
                      Clear direct
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {module.permissions.map((permission) => {
                      const directChecked = pendingDirectPermissions.includes(permission.permission_code);
                      const groupChecked = selectedGroupPermissionCodes.has(permission.permission_code);
                      return (
                        <label key={permission.id} className="flex items-start gap-3 rounded-md border border-slate-200 px-3 py-2">
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={directChecked}
                            onChange={(event) => onTogglePermission(permission.permission_code, event.target.checked)}
                            className="mt-1"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-slate-900">{permission.permission_code}</span>
                              {directChecked ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Direct</Badge> : null}
                              {groupChecked ? <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">Group</Badge> : null}
                              <StatusBadge status={permission.is_active ? "active" : "inactive"}>{permission.is_active ? "Active" : "Inactive"}</StatusBadge>
                            </span>
                            <span className="mt-1 block text-sm font-medium text-slate-800">{permission.permission_name || permission.action_name}</span>
                            {permission.description ? <span className="mt-1 block text-xs text-slate-500">{permission.description}</span> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
