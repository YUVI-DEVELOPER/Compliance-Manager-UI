import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AssetRecord {
  asset_uuid: string;
  asset_id: string;
  org_node_id?: string | null;
  org_node_name?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  legacy_id?: string | null;
  qr_barcode?: string | null;
  rfid_tag?: string | null;
  serial_number?: string | null;
  asset_class?: string | null;
  asset_category?: string | null;
  asset_sub_category?: string | null;
  asset_type?: string | null;
  criticality_class?: string | null;
  asset_nature?: string | null;
  tags?: string[] | null;
  asset_name?: string | null;
  asset_description?: string | null;
  short_description?: string | null;
  tag_number?: string | null;
  asset_owner?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  asset_version?: string | null;
  asset_purchase_dt?: string | null;
  asset_commission_dt?: string | null;
  asset_purchase_ref?: string | null;
  warranty_period?: number | null;
  asset_value?: number | null;
  asset_currency?: string | null;
  asset_status?: string | null;
  asset_release_url?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  can_create_release?: boolean;
  asset_class_upgrade_supported?: boolean;
  asset_code?: string | null;
  asset_serial_no?: string | null;
  asset_criticality?: string | null;
}

export type AssetReportScope = "enterprise" | "unit";

export interface AssetInventoryReportQuery {
  scope: AssetReportScope;
  org_id?: string | null;
  q?: string | null;
  lifecycle_state?: string | null;
  asset_class?: string | null;
  asset_category?: string | null;
}

export interface AssetInventoryReportRow {
  asset_uuid: string;
  asset_id: string;
  asset_name?: string | null;
  asset_class?: string | null;
  asset_category?: string | null;
  asset_sub_category?: string | null;
  asset_type?: string | null;
  org_node_id?: string | null;
  org_node_name?: string | null;
  org_node_code?: string | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  asset_owner?: string | null;
  criticality_class?: string | null;
  lifecycle_state?: string | null;
  asset_status?: string | null;
  serial_number?: string | null;
  tag_number?: string | null;
  legacy_id?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  asset_commission_dt?: string | null;
  asset_purchase_dt?: string | null;
}

export interface AssetInventoryReportResult {
  scope: AssetReportScope;
  org_id?: string | null;
  org_name?: string | null;
  includes_descendants: boolean;
  total: number;
  items: AssetInventoryReportRow[];
}

export type CreateAssetPayload = {
  org_node_id: string;
  asset_id: string;
  asset_name: string;
  asset_description: string;
  short_description: string;
  asset_owner: string;
  asset_class: string;
  asset_category: string;
  asset_sub_category: string;
  criticality_class: string;
  asset_nature: string;
  created_by: string;
  asset_type?: string | null;
  asset_status?: string | null;
  supplier_id?: string | null;
  legacy_id?: string | null;
  qr_barcode?: string | null;
  rfid_tag?: string | null;
  serial_number?: string | null;
  tags?: string[] | null;
  tag_number?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  asset_version?: string | null;
  asset_purchase_dt?: string | null;
  asset_commission_dt?: string | null;
  asset_purchase_ref?: string | null;
  warranty_period?: number | null;
  asset_value?: number | null;
  asset_currency?: string | null;
  asset_release_url?: string | null;
};

export type UpdateAssetPayload = Partial<Omit<CreateAssetPayload, "created_by">> & {
  modified_by: string;
};

interface AssetApiRecord extends Partial<AssetRecord> {
  asset_uuid?: string | null;
  asset_version?: string | null;
  version?: string | null;
  tags?: string[] | string | null;
}

interface AssetInventoryReportApiRow extends Partial<AssetInventoryReportRow> {
  asset_uuid?: string | null;
}

interface AssetInventoryReportApiResult {
  scope?: AssetReportScope | null;
  org_id?: string | null;
  org_name?: string | null;
  includes_descendants?: boolean | null;
  total?: number | null;
  items?: AssetInventoryReportApiRow[] | null;
}

type ListResponse<T> = T[] | ApiResponse<T[]>;
type SingleResponse<T> = T | ApiResponse<T>;

const normalizeTags = (value: AssetApiRecord["tags"]): string[] | null => {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item).trim()).filter(Boolean);
    return items.length > 0 ? items : null;
  }
  if (typeof value === "string") {
    const items = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : null;
  }
  return null;
};

const mapAssetRecord = (record: AssetApiRecord): AssetRecord => ({
  asset_uuid: record.asset_uuid ?? "",
  asset_id: record.asset_id ?? record.asset_code ?? "",
  org_node_id: record.org_node_id ?? null,
  org_node_name: record.org_node_name ?? null,
  supplier_id: record.supplier_id ?? null,
  supplier_name: record.supplier_name ?? null,
  legacy_id: record.legacy_id ?? null,
  qr_barcode: record.qr_barcode ?? null,
  rfid_tag: record.rfid_tag ?? null,
  serial_number: record.serial_number ?? record.asset_serial_no ?? null,
  asset_class: record.asset_class ?? null,
  asset_category: record.asset_category ?? null,
  asset_sub_category: record.asset_sub_category ?? null,
  asset_type: record.asset_type ?? null,
  criticality_class: record.criticality_class ?? record.asset_criticality ?? null,
  asset_nature: record.asset_nature ?? null,
  tags: normalizeTags(record.tags),
  asset_name: record.asset_name ?? null,
  asset_description: record.asset_description ?? null,
  short_description: record.short_description ?? null,
  tag_number: record.tag_number ?? null,
  asset_owner: record.asset_owner ?? null,
  manufacturer: record.manufacturer ?? null,
  model: record.model ?? null,
  asset_version: record.asset_version ?? record.version ?? null,
  asset_purchase_dt: record.asset_purchase_dt ?? null,
  asset_commission_dt: record.asset_commission_dt ?? null,
  asset_purchase_ref: record.asset_purchase_ref ?? null,
  warranty_period: record.warranty_period ?? null,
  asset_value: record.asset_value ?? null,
  asset_currency: record.asset_currency ?? null,
  asset_status: record.asset_status ?? null,
  asset_release_url: record.asset_release_url ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
  can_create_release: record.can_create_release ?? false,
  asset_class_upgrade_supported: record.asset_class_upgrade_supported ?? false,
  asset_code: record.asset_code ?? record.asset_id ?? null,
  asset_serial_no: record.asset_serial_no ?? record.serial_number ?? null,
  asset_criticality: record.asset_criticality ?? record.criticality_class ?? null,
});

const mapAssetInventoryReportRow = (record: AssetInventoryReportApiRow): AssetInventoryReportRow => ({
  asset_uuid: record.asset_uuid ?? "",
  asset_id: record.asset_id ?? "",
  asset_name: record.asset_name ?? null,
  asset_class: record.asset_class ?? null,
  asset_category: record.asset_category ?? null,
  asset_sub_category: record.asset_sub_category ?? null,
  asset_type: record.asset_type ?? null,
  org_node_id: record.org_node_id ?? null,
  org_node_name: record.org_node_name ?? null,
  org_node_code: record.org_node_code ?? null,
  supplier_id: record.supplier_id ?? null,
  supplier_name: record.supplier_name ?? null,
  asset_owner: record.asset_owner ?? null,
  criticality_class: record.criticality_class ?? null,
  lifecycle_state: record.lifecycle_state ?? record.asset_status ?? null,
  asset_status: record.asset_status ?? record.lifecycle_state ?? null,
  serial_number: record.serial_number ?? null,
  tag_number: record.tag_number ?? null,
  legacy_id: record.legacy_id ?? null,
  manufacturer: record.manufacturer ?? null,
  model: record.model ?? null,
  asset_commission_dt: record.asset_commission_dt ?? null,
  asset_purchase_dt: record.asset_purchase_dt ?? null,
});

const mapAssetInventoryReportResult = (record: AssetInventoryReportApiResult): AssetInventoryReportResult => ({
  scope: record.scope ?? "enterprise",
  org_id: record.org_id ?? null,
  org_name: record.org_name ?? null,
  includes_descendants: record.includes_descendants ?? false,
  total: record.total ?? 0,
  items: (record.items ?? []).map(mapAssetInventoryReportRow),
});

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

export const getAssets = async (): Promise<AssetRecord[]> => {
  const response = await api.get<ListResponse<AssetApiRecord>>("/asset");
  return parseListResponse(response.data).map(mapAssetRecord);
};

export const getAuditReviewAssets = async (): Promise<AssetRecord[]> => {
  const response = await api.get<ListResponse<AssetApiRecord>>("/api/audit-reviews/assets");
  return parseListResponse(response.data).map(mapAssetRecord);
};

export const getAssetsByOrg = async (orgNodeId: string): Promise<AssetRecord[]> => {
  const response = await api.get<ListResponse<AssetApiRecord>>("/asset", {
    params: { org_node_id: orgNodeId },
  });
  return parseListResponse(response.data).map(mapAssetRecord);
};

export const searchAssets = async (query: string): Promise<AssetRecord[]> => {
  const response = await api.get<ListResponse<AssetApiRecord>>("/asset/search", {
    params: { q: query },
  });
  return parseListResponse(response.data).map(mapAssetRecord);
};

export const getAssetInventoryReport = async (
  query: AssetInventoryReportQuery,
): Promise<AssetInventoryReportResult> => {
  const response = await api.get<SingleResponse<AssetInventoryReportApiResult>>("/asset/report/inventory", {
    params: query,
  });
  return mapAssetInventoryReportResult(parseSingleResponse(response.data));
};

export const getAssetById = async (assetUuid: string): Promise<AssetRecord> => {
  const response = await api.get<SingleResponse<AssetApiRecord>>(`/asset/${assetUuid}`);
  return mapAssetRecord(parseSingleResponse(response.data));
};

export const createAsset = async (payload: CreateAssetPayload): Promise<AssetRecord> => {
  const response = await api.post<SingleResponse<AssetApiRecord>>("/asset", payload);
  return mapAssetRecord(parseSingleResponse(response.data));
};

export const updateAsset = async (assetUuid: string, payload: UpdateAssetPayload): Promise<AssetRecord> => {
  const response = await api.put<SingleResponse<AssetApiRecord>>(`/asset/${assetUuid}`, payload);
  return mapAssetRecord(parseSingleResponse(response.data));
};

export const deleteAsset = async (assetUuid: string): Promise<void> => {
  await api.delete(`/asset/${assetUuid}`);
};
