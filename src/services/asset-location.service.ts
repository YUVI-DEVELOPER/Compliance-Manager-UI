import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AssetLocationRecord {
  location_id: string;
  asset_uuid: string;
  asset_id?: string | null;
  asset_name?: string | null;
  org_node_id?: string | null;
  org_node_name?: string | null;
  building_reference: string;
  floor_reference: string;
  local_reference: string;
  remarks?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export type CreateAssetLocationPayload = {
  building_reference: string;
  floor_reference: string;
  local_reference: string;
  created_by: string;
  remarks?: string | null;
};

export type UpdateAssetLocationPayload = Partial<Omit<CreateAssetLocationPayload, "created_by">> & {
  modified_by: string;
};

interface AssetLocationApiRecord extends Partial<AssetLocationRecord> {}

const parseResponse = <T>(payload: ApiResponse<T>): T => {
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data;
};

const mapAssetLocationRecord = (record: AssetLocationApiRecord): AssetLocationRecord => ({
  location_id: record.location_id ?? "",
  asset_uuid: record.asset_uuid ?? "",
  asset_id: record.asset_id ?? null,
  asset_name: record.asset_name ?? null,
  org_node_id: record.org_node_id ?? null,
  org_node_name: record.org_node_name ?? null,
  building_reference: record.building_reference ?? "",
  floor_reference: record.floor_reference ?? "",
  local_reference: record.local_reference ?? "",
  remarks: record.remarks ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
});

export const getAssetLocation = async (assetId: string): Promise<AssetLocationRecord | null> => {
  const response = await api.get<ApiResponse<AssetLocationApiRecord | null>>(`/asset/${assetId}/location`);
  const data = parseResponse(response.data);
  return data ? mapAssetLocationRecord(data) : null;
};

export const createAssetLocation = async (
  assetId: string,
  payload: CreateAssetLocationPayload,
): Promise<AssetLocationRecord> => {
  const response = await api.post<ApiResponse<AssetLocationApiRecord>>(`/asset/${assetId}/location`, payload);
  return mapAssetLocationRecord(parseResponse(response.data));
};

export const updateAssetLocation = async (
  assetId: string,
  payload: UpdateAssetLocationPayload,
): Promise<AssetLocationRecord> => {
  const response = await api.put<ApiResponse<AssetLocationApiRecord>>(`/asset/${assetId}/location`, payload);
  return mapAssetLocationRecord(parseResponse(response.data));
};

export const deleteAssetLocation = async (assetId: string): Promise<void> => {
  await api.delete(`/asset/${assetId}/location`);
};
