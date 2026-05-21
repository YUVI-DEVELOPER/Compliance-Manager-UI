import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface OrgNode {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  parent_id: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lat?: number | null;
  long?: number | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  children?: OrgNode[];
}

export interface OrgPayload {
  name: string;
  code: string;
  type: string;
  status: string;
  parent_id?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  lat?: number | null;
  long?: number | null;
  created_by?: string | null;
  modified_by?: string | null;
}

export interface DeleteOrgResponse {
  id: string;
}

const parseResponse = <T>(payload: ApiResponse<T>): T => {
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data;
};

export const getOrgTree = async (): Promise<OrgNode[]> => {
  const response = await api.get<ApiResponse<OrgNode[]>>("/org/tree");
  return parseResponse(response.data);
};

export const getOrgById = async (orgId: string): Promise<OrgNode> => {
  const response = await api.get<ApiResponse<OrgNode>>(`/org/${orgId}`);
  return parseResponse(response.data);
};

export const searchOrg = async (query: string): Promise<OrgNode[]> => {
  const response = await api.get<ApiResponse<OrgNode[]>>("/org/search", {
    params: { q: query },
  });
  return parseResponse(response.data);
};

export const createOrg = async (payload: OrgPayload): Promise<OrgNode> => {
  const response = await api.post<ApiResponse<OrgNode>>("/org", payload);
  return parseResponse(response.data);
};

export const updateOrg = async (orgId: string, payload: OrgPayload): Promise<OrgNode> => {
  const response = await api.put<ApiResponse<OrgNode>>(`/org/${orgId}`, payload);
  return parseResponse(response.data);
};

export const deleteOrg = async (orgId: string, deletedBy?: string | null): Promise<DeleteOrgResponse> => {
  const response = await api.delete<ApiResponse<DeleteOrgResponse>>(`/org/${orgId}`, {
    params: deletedBy ? { deleted_by: deletedBy } : undefined,
  });
  return parseResponse(response.data);
};

export const getOrgHealth = async (): Promise<unknown> => {
  const response = await api.get<ApiResponse<unknown>>("/org/health");
  return parseResponse(response.data);
};
