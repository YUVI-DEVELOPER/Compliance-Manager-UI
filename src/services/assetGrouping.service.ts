import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type AssetGroupType = "SYSTEM" | "SUB_SYSTEM";

export interface AssetGroupRecord {
  id: string;
  parent_group_id?: string | null;
  parent_group_name?: string | null;
  group_name: string;
  group_code?: string | null;
  group_type: AssetGroupType;
  description?: string | null;
  org_node_id?: string | null;
  org_node_name?: string | null;
  is_active: boolean;
  child_group_count: number;
  direct_asset_count: number;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  children?: AssetGroupRecord[];
}

export interface AssetGroupMembershipRecord {
  id: string;
  group_id: string;
  asset_uuid: string;
  asset_id?: string | null;
  asset_name?: string | null;
  asset_class?: string | null;
  asset_type?: string | null;
  asset_status?: string | null;
  org_node_id?: string | null;
  org_node_name?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export interface CreateAssetGroupPayload {
  group_name: string;
  group_type: AssetGroupType;
  created_by: string;
  group_code?: string | null;
  description?: string | null;
  parent_group_id?: string | null;
  org_node_id?: string | null;
  is_active?: boolean;
}

export type UpdateAssetGroupPayload = Partial<Omit<CreateAssetGroupPayload, "created_by">> & {
  modified_by?: string | null;
};

export interface AddAssetsToGroupPayload {
  asset_uuids: string[];
  created_by: string;
}

const parseResponse = <T>(payload: ApiResponse<T>): T => {
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data;
};

const mapAssetGroup = (record: Partial<AssetGroupRecord>): AssetGroupRecord => ({
  id: record.id ?? "",
  parent_group_id: record.parent_group_id ?? null,
  parent_group_name: record.parent_group_name ?? null,
  group_name: record.group_name ?? "",
  group_code: record.group_code ?? null,
  group_type: (record.group_type ?? "SYSTEM") as AssetGroupType,
  description: record.description ?? null,
  org_node_id: record.org_node_id ?? null,
  org_node_name: record.org_node_name ?? null,
  is_active: record.is_active ?? true,
  child_group_count: record.child_group_count ?? 0,
  direct_asset_count: record.direct_asset_count ?? 0,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
  children: (record.children ?? []).map(mapAssetGroup),
});

const mapAssetGroupMembership = (
  record: Partial<AssetGroupMembershipRecord>,
): AssetGroupMembershipRecord => ({
  id: record.id ?? "",
  group_id: record.group_id ?? "",
  asset_uuid: record.asset_uuid ?? "",
  asset_id: record.asset_id ?? null,
  asset_name: record.asset_name ?? null,
  asset_class: record.asset_class ?? null,
  asset_type: record.asset_type ?? null,
  asset_status: record.asset_status ?? null,
  org_node_id: record.org_node_id ?? null,
  org_node_name: record.org_node_name ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
});

export const getAssetGroupTree = async (): Promise<AssetGroupRecord[]> => {
  const response = await api.get<ApiResponse<AssetGroupRecord[]>>("/asset-groups/tree", {
    params: { include_inactive: true },
  });
  return parseResponse(response.data).map(mapAssetGroup);
};

export const getAssetGroupById = async (groupId: string): Promise<AssetGroupRecord> => {
  const response = await api.get<ApiResponse<AssetGroupRecord>>(`/asset-groups/${groupId}`);
  return mapAssetGroup(parseResponse(response.data));
};

export const createAssetGroup = async (payload: CreateAssetGroupPayload): Promise<AssetGroupRecord> => {
  const response = await api.post<ApiResponse<AssetGroupRecord>>("/asset-groups", payload);
  return mapAssetGroup(parseResponse(response.data));
};

export const updateAssetGroup = async (
  groupId: string,
  payload: UpdateAssetGroupPayload,
): Promise<AssetGroupRecord> => {
  const response = await api.put<ApiResponse<AssetGroupRecord>>(`/asset-groups/${groupId}`, payload);
  return mapAssetGroup(parseResponse(response.data));
};

export const deleteAssetGroup = async (groupId: string): Promise<void> => {
  await api.delete(`/asset-groups/${groupId}`);
};

export const getAssetGroupAssets = async (
  groupId: string,
): Promise<AssetGroupMembershipRecord[]> => {
  const response = await api.get<ApiResponse<AssetGroupMembershipRecord[]>>(`/asset-groups/${groupId}/assets`);
  return parseResponse(response.data).map(mapAssetGroupMembership);
};

export const addAssetsToGroup = async (
  groupId: string,
  payload: AddAssetsToGroupPayload,
): Promise<AssetGroupMembershipRecord[]> => {
  const response = await api.post<ApiResponse<AssetGroupMembershipRecord[]>>(
    `/asset-groups/${groupId}/assets`,
    payload,
  );
  return parseResponse(response.data).map(mapAssetGroupMembership);
};

export const removeAssetFromGroup = async (groupId: string, assetUuid: string): Promise<void> => {
  await api.delete(`/asset-groups/${groupId}/assets/${assetUuid}`);
};
