import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PermissionGuard } from "../auth/PermissionGuard";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import {
  createRole,
  listPermissionGroupsGrouped,
  listPermissionsGrouped,
  listRoles,
  RoleRecord,
  setRoleActive,
  setRolePermissionGroups,
  setRolePermissions,
} from "../../services/rbac.service";

export function RoleManagementPage() {
  const { hasPermission } = useAuth();
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [modules, setModules] = useState<Awaited<ReturnType<typeof listPermissionsGrouped>>>([]);
  const [groupModules, setGroupModules] = useState<Awaited<ReturnType<typeof listPermissionGroupsGrouped>>>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [form, setForm] = useState({ role_code: "", role_name: "", description: "" });
  const header = getPageHeaderConfig("role-management");
  const canAssignPermission = hasPermission("ROLE_ASSIGN_PERMISSION");

  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId) ?? roles[0] ?? null, [roles, selectedRoleId]);

  const load = async () => {
    const [nextRoles, nextModules, nextGroupModules] = await Promise.all([
      listRoles(true),
      listPermissionsGrouped(true),
      listPermissionGroupsGrouped(true),
    ]);
    setRoles(nextRoles);
    setModules(nextModules);
    setGroupModules(nextGroupModules);
    setSelectedRoleId((current) => current ?? nextRoles[0]?.id ?? null);
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createRole({ ...form, permission_codes: [] });
      setForm({ role_code: "", role_name: "", description: "" });
      toast.success("Role created");
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to create role");
    }
  };

  const togglePermission = async (permissionCode: string) => {
    if (!selectedRole || !canAssignPermission) return;
    const directPermissions = selectedRole.direct_permissions ?? selectedRole.permissions;
    const nextPermissions = directPermissions.includes(permissionCode)
      ? directPermissions.filter((code) => code !== permissionCode)
      : [...directPermissions, permissionCode];
    await setRolePermissions(selectedRole.id, nextPermissions);
    await load();
  };

  const togglePermissionGroup = async (groupCode: string) => {
    if (!selectedRole || !canAssignPermission) return;
    const permissionGroups = selectedRole.permission_groups ?? [];
    const nextGroups = permissionGroups.includes(groupCode)
      ? permissionGroups.filter((code) => code !== groupCode)
      : [...permissionGroups, groupCode];
    await setRolePermissionGroups(selectedRole.id, nextGroups);
    await load();
  };

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader breadcrumbs={header.breadcrumbs} sectionLabel={header.sectionLabel} title={header.title} subtitle={header.subtitle} />
      <div className={PAGE_CONTENT_CLASS}>
        <PermissionGuard permission="ROLE_CREATE">
          <form onSubmit={submit} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[12rem_1fr_1fr_auto]">
            <Input value={form.role_code} onChange={(event) => setForm({ ...form, role_code: event.target.value })} placeholder="ROLE_CODE" required />
            <Input value={form.role_name} onChange={(event) => setForm({ ...form, role_name: event.target.value })} placeholder="Role name" required />
            <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Description" />
            <Button type="submit">Create Role</Button>
          </form>
        </PermissionGuard>

        <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRoleId(role.id)}
                className={`w-full border-b border-slate-200 px-4 py-3 text-left hover:bg-slate-50 ${selectedRole?.id === role.id ? "bg-blue-50" : ""}`}
              >
                <div className="font-medium text-slate-900">{role.role_name}</div>
                <div className="text-xs text-slate-500">{role.role_code}</div>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {selectedRole ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{selectedRole.role_name}</h2>
                    <p className="text-xs text-slate-500">
                      {selectedRole.permissions.length} effective permissions from {(selectedRole.permission_groups ?? []).length} groups
                    </p>
                  </div>
                  <PermissionGuard permission="ROLE_DELETE">
                    <Button variant="outline" size="sm" onClick={() => void setRoleActive(selectedRole.id, !selectedRole.is_active).then(load)}>
                      {selectedRole.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </PermissionGuard>
                </div>
                <div className="space-y-4">
                  {groupModules.map((module) => (
                    <section key={module.module_name}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{module.module_name} groups</h3>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {module.permission_groups.map((group) => {
                          const checked = (selectedRole.permission_groups ?? []).includes(group.group_code);
                          return (
                            <label key={group.id} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                              {canAssignPermission ? (
                                <input
                                  type="checkbox"
                                  disabled={!selectedRole.is_active}
                                  checked={checked}
                                  onChange={() => void togglePermissionGroup(group.group_code)}
                                  className="mt-1"
                                />
                              ) : null}
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-slate-800">{group.group_name}</span>
                                <span className="block truncate text-xs text-slate-500">{group.group_code}</span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                  {modules.map((module) => (
                    <section key={module.module_name}>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{module.module_name} direct permissions</h3>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {module.permissions.map((permission) => {
                          const directPermissions = selectedRole.direct_permissions ?? selectedRole.permissions;
                          const directChecked = directPermissions.includes(permission.permission_code);
                          const effectiveChecked = selectedRole.permissions.includes(permission.permission_code);
                          return (
                            <label key={permission.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                              {canAssignPermission ? (
                                <input
                                  type="checkbox"
                                  disabled={!selectedRole.is_active}
                                  checked={directChecked}
                                  onChange={() => void togglePermission(permission.permission_code)}
                                />
                              ) : null}
                              <span className="min-w-0 truncate">
                                {permission.permission_code}
                                {effectiveChecked && !directChecked ? " (group)" : ""}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-slate-500">No role selected</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
