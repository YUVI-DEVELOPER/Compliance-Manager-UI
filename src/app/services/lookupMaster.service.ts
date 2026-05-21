import { api } from "./api";

export interface LookupMaster {
  id: number;
  key: string;
  description: string;
  active: boolean;
  valueCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface LookupMasterPayload {
  key: string;
  description: string;
  active: boolean;
}

interface LookupMasterApiModel {
  id: number;
  key?: string;
  lookup_key?: string;
  description?: string | null;
  active?: boolean | null;
  is_active?: boolean | null;
  value_count?: number | null;
  valueCount?: number | null;
  value_count_total?: number | null;
  created_at?: string | null;
  created?: string | null;
  created_dt?: string | null;
  updated_at?: string | null;
  modified?: string | null;
  modified_dt?: string | null;
}

type LookupMasterListResponse =
  | LookupMasterApiModel[]
  | { data: LookupMasterApiModel[] }
  | { items: LookupMasterApiModel[] }
  | { success?: boolean; message?: string; data?: LookupMasterApiModel[] | null };

const mapLookupMaster = (item: LookupMasterApiModel): LookupMaster => ({
  id: item.id,
  key: item.lookup_key ?? item.key ?? "",
  description: item.description ?? "",
  active: item.is_active ?? item.active ?? true,
  valueCount: item.value_count ?? item.valueCount ?? item.value_count_total ?? 0,
  createdAt: item.created_dt ?? item.created_at ?? item.created ?? null,
  updatedAt: item.modified_dt ?? item.updated_at ?? item.modified ?? null,
});

const extractLookupMasterList = (payload: LookupMasterListResponse): LookupMasterApiModel[] => {
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

export const getAllMasters = async (): Promise<LookupMaster[]> => {
  const response = await api.get<LookupMasterListResponse>("/lookup/master");
  return extractLookupMasterList(response.data).map(mapLookupMaster);
};

export const createMaster = async (data: LookupMasterPayload): Promise<LookupMaster> => {
  const payload = {
    lookup_key: data.key.trim().toUpperCase(),
    description: data.description.trim(),
    is_active: data.active,
  };
  const response = await api.post<{ data?: LookupMasterApiModel | null }>("/lookup/master", payload);
  return mapLookupMaster(response.data.data ?? { id: 0, lookup_key: payload.lookup_key });
};

export const updateMaster = async (id: number, data: LookupMasterPayload): Promise<LookupMaster> => {
  const payload = {
    description: data.description.trim(),
    is_active: data.active,
  };
  const response = await api.put<{ data?: LookupMasterApiModel | null }>(`/lookup/master/${id}`, payload);
  return mapLookupMaster(response.data.data ?? { id, description: payload.description, is_active: payload.is_active });
};

export const deleteMaster = async (id: number): Promise<void> => {
  await api.delete(`/lookup/master/${id}`);
};

/**
 * Update master status with cascade - when deactivating a master,
 * all associated lookup values will also be deactivated
 */
export const updateMasterWithCascade = async (
  id: number,
  data: LookupMasterPayload
): Promise<LookupMaster> => {
  const payload = {
    description: data.description.trim(),
    is_active: data.active,
  };
  
  // First update the master status
  const response = await api.put<{ data?: LookupMasterApiModel | null }>(
    `/lookup/master/${id}`,
    payload
  );
  
  // If deactivating master, cascade update all lookup values
  if (data.active === false) {
    try {
      await api.patch(`/lookup/value/cascade-deactivate/${id}`, {
        is_active: false,
      });
    } catch (error) {
      console.warn("Cascade update failed, master was updated:", error);
    }
  }
  
  return mapLookupMaster(response.data.data ?? { id, description: payload.description, is_active: payload.is_active });
};

