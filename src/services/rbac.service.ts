import { api } from "./api";

export interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  is_active: boolean;
  is_locked: boolean;
  roles: string[];
  permissions: string[];
}

export interface RoleRecord {
  id: string;
  role_code: string;
  role_name: string;
  description?: string | null;
  is_system_role: boolean;
  is_active: boolean;
  permissions: string[];
  direct_permissions?: string[];
  permission_groups?: string[];
}

export interface PermissionRecord {
  id: string;
  permission_code: string;
  permission_name: string;
  module_name: string;
  action_name: string;
  description?: string | null;
  is_system_permission: boolean;
  is_active: boolean;
}

export interface GroupedPermissions {
  module_name: string;
  permissions: PermissionRecord[];
}

export interface PermissionGroupRecord {
  id: string;
  group_code: string;
  group_name: string;
  module_name: string;
  description?: string | null;
  display_order: number;
  is_system_group: boolean;
  is_active: boolean;
  permission_codes: string[];
}

export interface GroupedPermissionGroups {
  module_name: string;
  permission_groups: PermissionGroupRecord[];
}

export async function listUsers(includeInactive = true): Promise<UserRecord[]> {
  const response = await api.get<UserRecord[]>("/users", { params: { include_inactive: includeInactive } });
  return response.data;
}

export async function createUser(payload: {
  full_name: string;
  email: string;
  password: string;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  role_codes?: string[];
}): Promise<UserRecord> {
  const response = await api.post<UserRecord>("/users", payload);
  return response.data;
}

export async function updateUser(userId: string, payload: {
  full_name?: string;
  email?: string;
  designation?: string | null;
  department?: string | null;
  phone?: string | null;
  is_locked?: boolean;
}): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${userId}`, payload);
  return response.data;
}

export async function setUserRoles(userId: string, roleCodes: string[]): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${userId}/roles`, { role_codes: roleCodes });
  return response.data;
}

export async function setUserActive(userId: string, active: boolean): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${userId}/${active ? "activate" : "deactivate"}`);
  return response.data;
}

export async function resetUserPassword(userId: string, newPassword: string): Promise<UserRecord> {
  const response = await api.patch<UserRecord>(`/users/${userId}/reset-password`, { new_password: newPassword });
  return response.data;
}

export async function listRoles(includeInactive = true): Promise<RoleRecord[]> {
  const response = await api.get<RoleRecord[]>("/roles", { params: { include_inactive: includeInactive } });
  return response.data;
}

export async function createRole(payload: {
  role_code: string;
  role_name: string;
  description?: string | null;
  permission_codes?: string[];
  permission_group_codes?: string[];
}): Promise<RoleRecord> {
  const response = await api.post<RoleRecord>("/roles", payload);
  return response.data;
}

export async function setRolePermissions(roleId: string, permissionCodes: string[]): Promise<RoleRecord> {
  const response = await api.patch<RoleRecord>(`/roles/${roleId}/permissions`, { permission_codes: permissionCodes });
  return response.data;
}

export async function setRolePermissionGroups(roleId: string, permissionGroupCodes: string[]): Promise<RoleRecord> {
  const response = await api.patch<RoleRecord>(`/roles/${roleId}/permission-groups`, {
    permission_group_codes: permissionGroupCodes,
  });
  return response.data;
}

export async function setRoleActive(roleId: string, active: boolean): Promise<RoleRecord> {
  const response = await api.patch<RoleRecord>(`/roles/${roleId}/${active ? "activate" : "deactivate"}`);
  return response.data;
}

export async function listPermissions(includeInactive = true): Promise<PermissionRecord[]> {
  const response = await api.get<PermissionRecord[]>("/permissions", { params: { include_inactive: includeInactive } });
  return response.data;
}

export async function listPermissionsGrouped(includeInactive = true): Promise<GroupedPermissions[]> {
  const response = await api.get<GroupedPermissions[]>("/permissions/grouped-by-module", {
    params: { include_inactive: includeInactive },
  });
  return response.data;
}

export async function listPermissionGroups(includeInactive = true): Promise<PermissionGroupRecord[]> {
  const response = await api.get<PermissionGroupRecord[]>("/permission-groups", {
    params: { include_inactive: includeInactive },
  });
  return response.data;
}

export async function listPermissionGroupsGrouped(includeInactive = true): Promise<GroupedPermissionGroups[]> {
  const response = await api.get<GroupedPermissionGroups[]>("/permission-groups/grouped-by-module", {
    params: { include_inactive: includeInactive },
  });
  return response.data;
}

export async function setPermissionActive(permissionId: string, active: boolean): Promise<PermissionRecord> {
  const response = await api.patch<PermissionRecord>(`/permissions/${permissionId}/${active ? "activate" : "deactivate"}`);
  return response.data;
}
