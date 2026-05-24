import { api } from "./api";

export interface AuditActor {
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface AuditLogRecord {
  audit_id: number;
  event_time: string;
  module_name: string;
  entity_name: string;
  table_name?: string | null;
  record_id?: string | null;
  action: string;
  event_description?: string | null;
  old_data?: unknown;
  new_data?: unknown;
  changed_fields: string[];
  performed_by: AuditActor;
  reason?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  status: string;
  request_id?: string | null;
  created_at?: string | null;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  from_date?: string;
  to_date?: string;
  module_name?: string;
  entity_name?: string;
  action?: string;
  performed_by_user_id?: string;
  performed_by_email?: string;
  performed_by_role?: string;
  record_id?: string;
  status?: string;
  search?: string;
}

export interface AuditLogListResult {
  data: AuditLogRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface AuditLogSummary {
  total_logs: number;
  today_logs: number;
  failed_actions: number;
  critical_changes: number;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: AuditLogListResult["pagination"];
}

const cleanParams = (filters: AuditLogFilters) =>
  Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== ""));

export const listAuditLogs = async (filters: AuditLogFilters): Promise<AuditLogListResult> => {
  const response = await api.get<ApiResponse<AuditLogRecord[]>>("/audit-logs", {
    params: cleanParams(filters),
  });
  return {
    data: response.data.data ?? [],
    pagination: response.data.pagination ?? { page: filters.page ?? 1, limit: filters.limit ?? 20, total: 0 },
  };
};

export const getAuditLogSummary = async (): Promise<AuditLogSummary> => {
  const response = await api.get<ApiResponse<AuditLogSummary>>("/audit-logs/summary");
  return response.data.data;
};

export const exportAuditLogs = async (filters: AuditLogFilters): Promise<Blob> => {
  const response = await api.get<Blob>("/audit-logs/export", {
    params: cleanParams(filters),
    responseType: "blob",
  });
  return response.data;
};
