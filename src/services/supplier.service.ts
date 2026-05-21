import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface SupplierRecord {
  supplier_id: string;
  supplier_name: string;
  supplier_type?: string | null;
  supplier_add1?: string | null;
  supplier_add2?: string | null;
  supplier_city?: string | null;
  supplier_pincode?: string | null;
  supplier_state?: string | null;
  supplier_country?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  enrolled_dt?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export type CreateSupplierPayload = {
  supplier_name: string;
  created_by: string;
  supplier_type?: string | null;
  supplier_add1?: string | null;
  supplier_add2?: string | null;
  supplier_city?: string | null;
  supplier_pincode?: string | null;
  supplier_state?: string | null;
  supplier_country?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
};

export type UpdateSupplierPayload = Partial<Omit<CreateSupplierPayload, "created_by">> & {
  modified_by?: string | null;
};

const parseResponse = <T>(payload: ApiResponse<T>): T => {
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data;
};

export const getSuppliers = async (): Promise<SupplierRecord[]> => {
  const response = await api.get<ApiResponse<SupplierRecord[]>>("/supplier");
  return parseResponse(response.data);
};

export const exportAllSuppliers = async (): Promise<SupplierRecord[]> => {
  const response = await api.get<ApiResponse<SupplierRecord[]>>("/supplier", {
    params: { export: true },
  });
  return parseResponse(response.data);
};

export const searchSuppliers = async (query: string): Promise<SupplierRecord[]> => {
  const response = await api.get<ApiResponse<SupplierRecord[]>>("/supplier/search", {
    params: { q: query },
  });
  return parseResponse(response.data);
};

export const getSupplierById = async (id: string): Promise<SupplierRecord> => {
  const response = await api.get<ApiResponse<SupplierRecord>>(`/supplier/${id}`);
  return parseResponse(response.data);
};

export const createSupplier = async (payload: CreateSupplierPayload): Promise<SupplierRecord> => {
  const response = await api.post<ApiResponse<SupplierRecord>>("/supplier", payload);
  return parseResponse(response.data);
};

export const updateSupplier = async (id: string, payload: UpdateSupplierPayload): Promise<SupplierRecord> => {
  const response = await api.put<ApiResponse<SupplierRecord>>(`/supplier/${id}`, payload);
  return parseResponse(response.data);
};

export const deleteSupplier = async (id: string): Promise<null> => {
  const response = await api.delete<ApiResponse<null>>(`/supplier/${id}`);
  return parseResponse(response.data);
};
