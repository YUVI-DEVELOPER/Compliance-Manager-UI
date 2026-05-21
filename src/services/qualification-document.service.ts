import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface QualificationDocumentRecord {
  qualification_document_id: string;
  qualification_type: string;
  status: string;
  context_scope: string;
  asset_id: string | null;
  release_id: string | null;
  supplier_id: string;
  document_name: string;
  document_version?: string | null;
  source_system?: string | null;
  external_document_id?: string | null;
  document_url: string;
  source_reference?: string | null;
  submission_date?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  asset_name?: string | null;
  asset_code?: string | null;
  release_version?: string | null;
  supplier_name?: string | null;
}

export interface QualificationDocumentActionRecord {
  id: string;
  qualification_document_id: string;
  action_type: string;
  action_by?: string | null;
  action_dt?: string | null;
  comment_text?: string | null;
  from_status: string;
  to_status: string;
}

export type CreateQualificationDocumentPayload = {
  qualification_type: string;
  supplier_id: string;
  asset_id?: string | null;
  release_id?: string | null;
  document_name: string;
  document_version?: string | null;
  source_system?: string | null;
  external_document_id?: string | null;
  document_url: string;
  source_reference?: string | null;
  submission_date: string;
  notes?: string | null;
  created_by: string;
};

export type UpdateQualificationDocumentPayload = {
  modified_by: string;
  qualification_type?: string;
  supplier_id?: string;
  asset_id?: string | null;
  release_id?: string | null;
  document_name?: string;
  document_version?: string | null;
  source_system?: string | null;
  external_document_id?: string | null;
  document_url?: string;
  source_reference?: string | null;
  submission_date?: string;
  notes?: string | null;
};

export type QualificationDocumentWorkflowActionPayload = {
  action_by: string;
  comment_text?: string | null;
};

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

const mapQualificationDocumentRecord = (
  record: Partial<QualificationDocumentRecord>,
): QualificationDocumentRecord => ({
  qualification_document_id: record.qualification_document_id ?? "",
  qualification_type: record.qualification_type ?? "",
  status: record.status ?? "SUBMITTED",
  context_scope: record.context_scope ?? "ASSET",
  asset_id: record.asset_id ?? null,
  release_id: record.release_id ?? null,
  supplier_id: record.supplier_id ?? "",
  document_name: record.document_name ?? "",
  document_version: record.document_version ?? null,
  source_system: record.source_system ?? null,
  external_document_id: record.external_document_id ?? null,
  document_url: record.document_url ?? "",
  source_reference: record.source_reference ?? null,
  submission_date: record.submission_date ?? null,
  notes: record.notes ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
  asset_name: record.asset_name ?? null,
  asset_code: record.asset_code ?? null,
  release_version: record.release_version ?? null,
  supplier_name: record.supplier_name ?? null,
});

const mapQualificationDocumentActionRecord = (
  record: Partial<QualificationDocumentActionRecord>,
): QualificationDocumentActionRecord => ({
  id: record.id ?? "",
  qualification_document_id: record.qualification_document_id ?? "",
  action_type: record.action_type ?? "",
  action_by: record.action_by ?? null,
  action_dt: record.action_dt ?? null,
  comment_text: record.comment_text ?? null,
  from_status: record.from_status ?? "",
  to_status: record.to_status ?? "",
});

export const getAssetQualificationDocuments = async (
  assetId: string,
): Promise<QualificationDocumentRecord[]> => {
  const response = await api.get<ListResponse<QualificationDocumentRecord>>(
    `/asset/${assetId}/qualification-documents`,
  );
  return parseListResponse(response.data).map(mapQualificationDocumentRecord);
};

export const getReleaseQualificationDocuments = async (
  releaseId: string,
): Promise<QualificationDocumentRecord[]> => {
  const response = await api.get<ListResponse<QualificationDocumentRecord>>(
    `/release/${releaseId}/qualification-documents`,
  );
  return parseListResponse(response.data).map(mapQualificationDocumentRecord);
};

export const getSupplierQualificationDocuments = async (
  supplierId: string,
): Promise<QualificationDocumentRecord[]> => {
  const response = await api.get<ListResponse<QualificationDocumentRecord>>(
    `/supplier/${supplierId}/qualification-documents`,
  );
  return parseListResponse(response.data).map(mapQualificationDocumentRecord);
};

export const getQualificationDocument = async (
  qualificationDocumentId: string,
): Promise<QualificationDocumentRecord> => {
  const response = await api.get<SingleResponse<QualificationDocumentRecord>>(
    `/qualification-documents/${qualificationDocumentId}`,
  );
  return mapQualificationDocumentRecord(parseSingleResponse(response.data));
};

export const createQualificationDocument = async (
  payload: CreateQualificationDocumentPayload,
): Promise<QualificationDocumentRecord> => {
  const response = await api.post<SingleResponse<QualificationDocumentRecord>>(
    "/qualification-documents",
    payload,
  );
  return mapQualificationDocumentRecord(parseSingleResponse(response.data));
};

export const updateQualificationDocument = async (
  qualificationDocumentId: string,
  payload: UpdateQualificationDocumentPayload,
): Promise<QualificationDocumentRecord> => {
  const response = await api.put<SingleResponse<QualificationDocumentRecord>>(
    `/qualification-documents/${qualificationDocumentId}`,
    payload,
  );
  return mapQualificationDocumentRecord(parseSingleResponse(response.data));
};

export const submitQualificationDocumentForReview = async (
  qualificationDocumentId: string,
  payload: QualificationDocumentWorkflowActionPayload,
): Promise<QualificationDocumentRecord> => {
  const response = await api.post<SingleResponse<QualificationDocumentRecord>>(
    `/qualification-documents/${qualificationDocumentId}/submit-for-review`,
    payload,
  );
  return mapQualificationDocumentRecord(parseSingleResponse(response.data));
};

export const acceptQualificationDocument = async (
  qualificationDocumentId: string,
  payload: QualificationDocumentWorkflowActionPayload,
): Promise<QualificationDocumentRecord> => {
  const response = await api.post<SingleResponse<QualificationDocumentRecord>>(
    `/qualification-documents/${qualificationDocumentId}/accept`,
    payload,
  );
  return mapQualificationDocumentRecord(parseSingleResponse(response.data));
};

export const rejectQualificationDocument = async (
  qualificationDocumentId: string,
  payload: QualificationDocumentWorkflowActionPayload,
): Promise<QualificationDocumentRecord> => {
  const response = await api.post<SingleResponse<QualificationDocumentRecord>>(
    `/qualification-documents/${qualificationDocumentId}/reject`,
    payload,
  );
  return mapQualificationDocumentRecord(parseSingleResponse(response.data));
};

export const requestQualificationDocumentClarification = async (
  qualificationDocumentId: string,
  payload: QualificationDocumentWorkflowActionPayload,
): Promise<QualificationDocumentRecord> => {
  const response = await api.post<SingleResponse<QualificationDocumentRecord>>(
    `/qualification-documents/${qualificationDocumentId}/request-clarification`,
    payload,
  );
  return mapQualificationDocumentRecord(parseSingleResponse(response.data));
};

export const getQualificationDocumentHistory = async (
  qualificationDocumentId: string,
): Promise<QualificationDocumentActionRecord[]> => {
  const response = await api.get<ListResponse<QualificationDocumentActionRecord>>(
    `/qualification-documents/${qualificationDocumentId}/history`,
  );
  return parseListResponse(response.data).map(mapQualificationDocumentActionRecord);
};

export const deleteQualificationDocument = async (qualificationDocumentId: string): Promise<void> => {
  const response = await api.delete<SingleResponse<null>>(
    `/qualification-documents/${qualificationDocumentId}`,
  );
  parseSingleResponse(response.data);
};
