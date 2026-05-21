import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AssetSpecRecord {
  asset_spec_id: string;
  asset_sub_category_id: number;
  asset_sub_category_code?: string | null;
  asset_sub_category_name?: string | null;
  parameter_seq: number;
  parameter_grouping: string;
  parameter_name: string;
  parameter_value: string;
  guidelines?: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export interface CreateAssetSpecPayload {
  asset_sub_category_id: number;
  parameter_grouping: string;
  parameter_name: string;
  parameter_value: string;
  guidelines?: string | null;
  is_active?: boolean;
  created_by: string;
}

export interface UpdateAssetSpecPayload {
  asset_sub_category_id?: number | null;
  parameter_grouping?: string | null;
  parameter_name?: string | null;
  parameter_value?: string | null;
  guidelines?: string | null;
  is_active?: boolean | null;
  modified_by: string;
}

interface AssetSpecApiModel extends Partial<AssetSpecRecord> {
  asset_spec_id?: string | null;
  asset_sub_category_code?: string | null;
  asset_sub_category_name?: string | null;
}

type ListResponse<T> = T[] | ApiResponse<T[]>;
type SingleResponse<T> = T | ApiResponse<T>;

const parseListResponse = <T>(payload: ListResponse<T>): T[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data ?? [];
};

const parseSingleResponse = <T>(payload: SingleResponse<T>): T => {
  if (typeof payload === "object" && payload !== null && "success" in payload) {
    const wrapped = payload as ApiResponse<T>;
    if (!wrapped.success) {
      throw new Error(wrapped.message || "Request failed");
    }
    return wrapped.data;
  }
  return payload as T;
};

const mapAssetSpec = (record: AssetSpecApiModel): AssetSpecRecord => ({
  asset_spec_id: record.asset_spec_id ?? "",
  asset_sub_category_id: record.asset_sub_category_id ?? 0,
  asset_sub_category_code: record.asset_sub_category_code ?? null,
  asset_sub_category_name: record.asset_sub_category_name ?? null,
  parameter_seq: record.parameter_seq ?? 0,
  parameter_grouping: record.parameter_grouping ?? "",
  parameter_name: record.parameter_name ?? "",
  parameter_value: record.parameter_value ?? "",
  guidelines: record.guidelines ?? null,
  is_active: record.is_active ?? true,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
});

export interface AssetSpecListParams {
  asset_sub_category_id?: number | null;
  include_inactive?: boolean;
}

export const getAssetSpecs = async (params: AssetSpecListParams = {}): Promise<AssetSpecRecord[]> => {
  const query: Record<string, unknown> = {};
  if (params.asset_sub_category_id) query.asset_sub_category_id = params.asset_sub_category_id;
  if (params.include_inactive) query.include_inactive = true;

  const response = await api.get<ListResponse<AssetSpecApiModel>>("/asset-specs", { params: query });
  return parseListResponse(response.data).map(mapAssetSpec);
};

export const getAssetSpecById = async (assetSpecId: string): Promise<AssetSpecRecord> => {
  const response = await api.get<SingleResponse<AssetSpecApiModel>>(`/asset-specs/${assetSpecId}`);
  return mapAssetSpec(parseSingleResponse(response.data));
};

export const createAssetSpec = async (payload: CreateAssetSpecPayload): Promise<AssetSpecRecord> => {
  const response = await api.post<SingleResponse<AssetSpecApiModel>>("/asset-specs", payload);
  return mapAssetSpec(parseSingleResponse(response.data));
};

export const updateAssetSpec = async (assetSpecId: string, payload: UpdateAssetSpecPayload): Promise<AssetSpecRecord> => {
  const response = await api.put<SingleResponse<AssetSpecApiModel>>(`/asset-specs/${assetSpecId}`, payload);
  return mapAssetSpec(parseSingleResponse(response.data));
};

export const deleteAssetSpec = async (assetSpecId: string, modifiedBy?: string | null): Promise<void> => {
  await api.delete(`/asset-specs/${assetSpecId}`, {
    params: modifiedBy ? { modified_by: modifiedBy } : undefined,
  });
};

