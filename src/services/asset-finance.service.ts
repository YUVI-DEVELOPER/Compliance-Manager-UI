import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AssetFinanceRecord {
  finance_id: string;
  asset_uuid: string;
  asset_id?: string | null;
  asset_name?: string | null;
  supplier_id: string;
  supplier_name?: string | null;
  acquisition_dt: string;
  purchase_order_no?: string | null;
  invoice_ref?: string | null;
  make?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  oem_release_url?: string | null;
  capitalization_date: string;
  acquisition_cost: number;
  currency_code: string;
  book_value: number;
  replacement_value?: number | null;
  insured_value?: number | null;
  salvage_value?: number | null;
  depreciation_method: string;
  useful_life_years: number;
  depreciation_rate_pct?: number | null;
  accumulated_depreciation: number;
  cost_center?: string | null;
  gl_account_capex?: string | null;
  asset_class_gl?: string | null;
  wbs_element?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export type CreateAssetFinancePayload = {
  acquisition_dt: string;
  supplier_id: string;
  capitalization_date: string;
  acquisition_cost: number;
  currency_code: string;
  depreciation_method: string;
  useful_life_years: number;
  accumulated_depreciation: number;
  created_by: string;
  purchase_order_no?: string | null;
  invoice_ref?: string | null;
  make?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  oem_release_url?: string | null;
  replacement_value?: number | null;
  insured_value?: number | null;
  salvage_value?: number | null;
  depreciation_rate_pct?: number | null;
  cost_center?: string | null;
  gl_account_capex?: string | null;
  asset_class_gl?: string | null;
  wbs_element?: string | null;
};

export type UpdateAssetFinancePayload = Partial<Omit<CreateAssetFinancePayload, "created_by">> & {
  modified_by: string;
};

interface AssetFinanceApiRecord extends Omit<Partial<AssetFinanceRecord>, "acquisition_cost" | "book_value" | "replacement_value" | "insured_value" | "salvage_value" | "depreciation_rate_pct" | "accumulated_depreciation" | "useful_life_years"> {
  acquisition_cost?: number | string | null;
  book_value?: number | string | null;
  replacement_value?: number | string | null;
  insured_value?: number | string | null;
  salvage_value?: number | string | null;
  depreciation_rate_pct?: number | string | null;
  accumulated_depreciation?: number | string | null;
  useful_life_years?: number | string | null;
}

const parseResponse = <T>(payload: ApiResponse<T>): T => {
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data;
};

const normalizeNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapAssetFinanceRecord = (record: AssetFinanceApiRecord): AssetFinanceRecord => ({
  finance_id: record.finance_id ?? "",
  asset_uuid: record.asset_uuid ?? "",
  asset_id: record.asset_id ?? null,
  asset_name: record.asset_name ?? null,
  supplier_id: record.supplier_id ?? "",
  supplier_name: record.supplier_name ?? null,
  acquisition_dt: record.acquisition_dt ?? "",
  purchase_order_no: record.purchase_order_no ?? null,
  invoice_ref: record.invoice_ref ?? null,
  make: record.make ?? null,
  model: record.model ?? null,
  manufacturer: record.manufacturer ?? null,
  oem_release_url: record.oem_release_url ?? null,
  capitalization_date: record.capitalization_date ?? "",
  acquisition_cost: normalizeNumber(record.acquisition_cost) ?? 0,
  currency_code: record.currency_code ?? "",
  book_value: normalizeNumber(record.book_value) ?? 0,
  replacement_value: normalizeNumber(record.replacement_value),
  insured_value: normalizeNumber(record.insured_value),
  salvage_value: normalizeNumber(record.salvage_value),
  depreciation_method: record.depreciation_method ?? "",
  useful_life_years: normalizeNumber(record.useful_life_years) ?? 0,
  depreciation_rate_pct: normalizeNumber(record.depreciation_rate_pct),
  accumulated_depreciation: normalizeNumber(record.accumulated_depreciation) ?? 0,
  cost_center: record.cost_center ?? null,
  gl_account_capex: record.gl_account_capex ?? null,
  asset_class_gl: record.asset_class_gl ?? null,
  wbs_element: record.wbs_element ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
});

export const getAssetFinance = async (assetId: string): Promise<AssetFinanceRecord | null> => {
  const response = await api.get<ApiResponse<AssetFinanceApiRecord | null>>(`/asset/${assetId}/finance`);
  const data = parseResponse(response.data);
  return data ? mapAssetFinanceRecord(data) : null;
};

export const createAssetFinance = async (
  assetId: string,
  payload: CreateAssetFinancePayload,
): Promise<AssetFinanceRecord> => {
  const response = await api.post<ApiResponse<AssetFinanceApiRecord>>(`/asset/${assetId}/finance`, payload);
  return mapAssetFinanceRecord(parseResponse(response.data));
};

export const updateAssetFinance = async (
  assetId: string,
  payload: UpdateAssetFinancePayload,
): Promise<AssetFinanceRecord> => {
  const response = await api.put<ApiResponse<AssetFinanceApiRecord>>(`/asset/${assetId}/finance`, payload);
  return mapAssetFinanceRecord(parseResponse(response.data));
};

export const deleteAssetFinance = async (assetId: string): Promise<void> => {
  await api.delete(`/asset/${assetId}/finance`);
};
