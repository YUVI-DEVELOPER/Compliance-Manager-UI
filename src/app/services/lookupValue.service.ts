import { api } from "./api";

export interface LookupValue {
  id: number;
  masterId: number;
  code: string;
  display: string;
  sort: number;
  active: boolean;
}

export interface LookupValuePayload {
  master_id: number;
  code: string;
  display: string;
  sort: number;
  active: boolean;
}

export interface LookupOption {
  code: string;
  value: string;
}

interface LookupValueApiModel {
  id: number;
  master_id?: number | null;
  lookup_master_id?: number | null;
  lookup_id?: number | null;
  code: string;
  display?: string | null;
  display_name?: string | null;
  sort?: number | null;
  sort_order?: number | null;
  active?: boolean | null;
  is_active?: boolean | null;
}

type LookupValueListResponse =
  | LookupValueApiModel[]
  | { data: LookupValueApiModel[] }
  | { items: LookupValueApiModel[] }
  | { success?: boolean; message?: string; data?: LookupValueApiModel[] | null };

const mapLookupValue = (item: LookupValueApiModel): LookupValue => ({
  id: item.id,
  masterId: item.lookup_id ?? item.master_id ?? item.lookup_master_id ?? 0,
  code: item.code,
  display: item.display ?? item.display_name ?? "",
  sort: item.sort ?? item.sort_order ?? 0,
  active: item.is_active ?? item.active ?? true,
});

const extractLookupValueList = (payload: LookupValueListResponse): LookupValueApiModel[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if ("data" in payload && Array.isArray(payload.data)) {
    return payload.data;
  }

  if ("items" in payload && Array.isArray(payload.items)) {
    return payload.items;
  }

  return [];
};

export const getAllValues = async (): Promise<LookupValue[]> => {
  const mastersResponse = await api.get<{ data?: Array<{ id: number; lookup_key: string }> | null }>("/lookup/master");
  const masters = mastersResponse.data.data ?? [];

  const valueResponses = await Promise.all(
    masters.map(async (master) => {
      const response = await api.get<LookupValueListResponse>(`/lookup/values/${encodeURIComponent(master.lookup_key)}`);
      return extractLookupValueList(response.data);
    }),
  );

  return valueResponses.flat().map(mapLookupValue);
};

export const getLookupValuesByMasterCode = async (masterCode: string): Promise<LookupValue[]> => {
  const response = await api.get<LookupLegacyResponse>(`/lookup/values/${encodeURIComponent(masterCode)}`);
  if (!response.data.success) {
    throw new Error(response.data.message || "Lookup request failed");
  }
  return (response.data.data ?? []).map(mapLookupValue);
};

export const createValue = async (data: LookupValuePayload): Promise<LookupValue> => {
  const payload = {
    lookup_id: data.master_id,
    code: data.code.trim().toUpperCase(),
    display_name: data.display.trim(),
    sort_order: data.sort,
    is_active: data.active,
  };
  const response = await api.post<{ data?: LookupValueApiModel | null }>("/lookup/value", payload);
  return mapLookupValue(response.data.data ?? { id: 0, ...payload });
};

export const updateValue = async (id: number, data: LookupValuePayload): Promise<LookupValue> => {
  const payload = {
    code: data.code.trim().toUpperCase(),
    display_name: data.display.trim(),
    sort_order: data.sort,
    is_active: data.active,
  };
  const response = await api.put<{ data?: LookupValueApiModel | null }>(`/lookup/value/${id}`, payload);
  return mapLookupValue(response.data.data ?? { id, lookup_id: data.master_id, ...payload });
};

export const deleteValue = async (id: number): Promise<void> => {
  await api.delete(`/lookup/value/${id}`);
};

export const updateLookupValueStatus = async (id: number, active: boolean): Promise<LookupValue> => {
  const payload = {
    is_active: active,
  };
  const response = await api.patch<{ data?: LookupValueApiModel | null }>(`/lookup/value/${id}`, payload);
  const defaultValue: LookupValueApiModel = { id, code: "", active };
  return mapLookupValue(response.data.data ?? defaultValue);
};

/**
 * Cascade update - deactivate all lookup values for a specific master
 * This is called when a master category is deactivated
 */
export const cascadeDeactivateValues = async (masterId: number): Promise<void> => {
  await api.patch(`/lookup/value/cascade-deactivate/${masterId}`, {
    is_active: false,
  });
};

interface LookupOptionApiResponse {
  success: boolean;
  message: string;
  data: Array<{ code: string; value: string }>;
}

interface LookupLegacyResponse {
  success: boolean;
  message: string;
  data: LookupValueApiModel[];
}

let lookupValueByMasterEndpointMode: "unknown" | "available" | "missing" = "unknown";

const normalizeLookupOptionList = (items: Array<{ code: string; value: string }>): LookupOption[] =>
  items
    .filter((item) => item.code && item.value)
    .map((item) => ({ code: item.code, value: item.value }))
    .sort((a, b) => a.value.localeCompare(b.value));

const normalizeLegacyLookupOptionList = (items: LookupValueApiModel[]): LookupOption[] =>
  items
    .filter((item) => (item.is_active ?? item.active ?? true) !== false)
    .map((item) => ({
      code: item.code,
      value: (item.display_name ?? item.display ?? item.code) || item.code,
    }))
    .sort((a, b) => a.value.localeCompare(b.value));

export const getLookupOptionsByMasterCode = async (masterCode: string): Promise<LookupOption[]> => {
  if (lookupValueByMasterEndpointMode !== "missing") {
    const direct = await api.get<LookupOptionApiResponse>("/lookup-value", {
      params: { master_code: masterCode },
      validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
    });

    if (direct.status === 200) {
      lookupValueByMasterEndpointMode = "available";
      if (!direct.data.success) {
        throw new Error(direct.data.message || "Lookup request failed");
      }
      return normalizeLookupOptionList(direct.data.data ?? []);
    }

    if (direct.status === 404) {
      lookupValueByMasterEndpointMode = "missing";
    }
  }

  const legacy = await api.get<LookupLegacyResponse>(`/lookup/values/${encodeURIComponent(masterCode)}`);
  if (!legacy.data.success) {
    throw new Error(legacy.data.message || "Lookup request failed");
  }
  return normalizeLegacyLookupOptionList(legacy.data.data ?? []);
};


