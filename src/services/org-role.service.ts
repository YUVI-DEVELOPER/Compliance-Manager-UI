import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

const parseResponse = <T>(payload: ApiResponse<T>): T => {
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data;
};

export interface OrgRoleAction {
  id: string;
  role_id: string;
  seq: number;
  action_type: string;
  action: string;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export interface OrgRoleSummary {
  id: string;
  role_name: string;
  role_raci: string;
  ownership: string;
  role_type: string;
  is_active: boolean;
}

export interface OrgRole extends OrgRoleSummary {
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  action_count: number;
  active_assignment_count: number;
}

export interface OrgRoleDetail extends OrgRole {
  actions: OrgRoleAction[];
}

export interface OrgRolePayload {
  role_name: string;
  role_raci: string;
  ownership: string;
  role_type: string;
  is_active?: boolean;
  created_by?: string | null;
  modified_by?: string | null;
}

export interface OrgRoleActionPayload {
  seq: number;
  action_type: string;
  action: string;
  created_by?: string | null;
  modified_by?: string | null;
}

export interface OrgEntityRoleAssignment {
  id: string;
  org_id: string;
  role_id: string;
  person_name: string;
  person_email?: string | null;
  employee_code?: string | null;
  remarks?: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  is_deleted: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  role?: OrgRoleSummary | null;
}

export interface OrgEntityRoleAssignmentPayload {
  org_id?: string | null;
  role_id: string;
  person_name: string;
  person_email?: string | null;
  employee_code?: string | null;
  remarks?: string | null;
  is_active?: boolean;
  created_by?: string | null;
  modified_by?: string | null;
}

export const getOrgRoles = async (activeOnly = false): Promise<OrgRole[]> => {
  const response = await api.get<ApiResponse<OrgRole[]>>("/org-roles", {
    params: { active_only: activeOnly },
  });
  return parseResponse(response.data);
};

export const getOrgRoleById = async (roleId: string): Promise<OrgRoleDetail> => {
  const response = await api.get<ApiResponse<OrgRoleDetail>>(`/org-roles/${roleId}`);
  return parseResponse(response.data);
};

export const createOrgRole = async (payload: OrgRolePayload): Promise<OrgRole> => {
  const response = await api.post<ApiResponse<OrgRole>>("/org-roles", payload);
  return parseResponse(response.data);
};

export const updateOrgRole = async (roleId: string, payload: Partial<OrgRolePayload>): Promise<OrgRole> => {
  const response = await api.put<ApiResponse<OrgRole>>(`/org-roles/${roleId}`, payload);
  return parseResponse(response.data);
};

export const deleteOrgRole = async (roleId: string, modifiedBy?: string | null): Promise<{ id: string }> => {
  const response = await api.delete<ApiResponse<{ id: string }>>(`/org-roles/${roleId}`, {
    params: modifiedBy ? { modified_by: modifiedBy } : undefined,
  });
  return parseResponse(response.data);
};

export const getOrgRoleActions = async (roleId: string): Promise<OrgRoleAction[]> => {
  const response = await api.get<ApiResponse<OrgRoleAction[]>>(`/org-roles/${roleId}/actions`);
  return parseResponse(response.data);
};

export const createOrgRoleAction = async (roleId: string, payload: OrgRoleActionPayload): Promise<OrgRoleAction> => {
  const response = await api.post<ApiResponse<OrgRoleAction>>(`/org-roles/${roleId}/actions`, payload);
  return parseResponse(response.data);
};

export const updateOrgRoleAction = async (
  actionId: string,
  payload: Partial<OrgRoleActionPayload>,
): Promise<OrgRoleAction> => {
  const response = await api.put<ApiResponse<OrgRoleAction>>(`/org-role-actions/${actionId}`, payload);
  return parseResponse(response.data);
};

export const deleteOrgRoleAction = async (actionId: string): Promise<{ id: string }> => {
  const response = await api.delete<ApiResponse<{ id: string }>>(`/org-role-actions/${actionId}`);
  return parseResponse(response.data);
};

export const getOrgRoleAssignments = async (
  orgId: string,
  activeOnly = false,
): Promise<OrgEntityRoleAssignment[]> => {
  const response = await api.get<ApiResponse<OrgEntityRoleAssignment[]>>(`/org/${orgId}/roles`, {
    params: { active_only: activeOnly },
  });
  return parseResponse(response.data);
};

export const createOrgRoleAssignment = async (
  orgId: string,
  payload: OrgEntityRoleAssignmentPayload,
): Promise<OrgEntityRoleAssignment> => {
  const response = await api.post<ApiResponse<OrgEntityRoleAssignment>>(`/org/${orgId}/roles`, payload);
  return parseResponse(response.data);
};

export const updateOrgRoleAssignment = async (
  assignmentId: string,
  payload: Partial<OrgEntityRoleAssignmentPayload>,
): Promise<OrgEntityRoleAssignment> => {
  const response = await api.put<ApiResponse<OrgEntityRoleAssignment>>(`/org-entity-roles/${assignmentId}`, payload);
  return parseResponse(response.data);
};

export const deleteOrgRoleAssignment = async (
  assignmentId: string,
  modifiedBy?: string | null,
): Promise<{ id: string }> => {
  const response = await api.delete<ApiResponse<{ id: string }>>(`/org-entity-roles/${assignmentId}`, {
    params: modifiedBy ? { modified_by: modifiedBy } : undefined,
  });
  return parseResponse(response.data);
};
