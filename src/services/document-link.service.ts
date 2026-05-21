import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DocumentLinkRecord {
  document_link_id: string;
  asset_id: string | null;
  release_id: string | null;
  source_system: string | null;
  document_type: string | null;
  external_document_id: string | null;
  document_name: string | null;
  document_version: string | null;
  upload_dt: string | null;
  access_url: string | null;
  source_reference: string | null;
  notes: string | null;
  created_by: string | null;
  created_dt: string | null;
  modified_by: string | null;
  modified_dt: string | null;
  vectorization_status: string | null;
  vectorization_job: DocumentVectorizationJobRecord | null;
}

export interface DocumentVectorizationJobRecord {
  id: string;
  rag_document_id: string | null;
  status: string;
  metadata_json: Record<string, unknown>;
  error_message: string | null;
  requested_at: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  queue_started_at: string | null;
  chunking_started_at: string | null;
  chunking_completed_at: string | null;
  embedding_started_at: string | null;
  embedding_completed_at: string | null;
  weaviate_write_started_at: string | null;
  weaviate_write_completed_at: string | null;
  current_stage: string | null;
  process_log_json: Array<Record<string, unknown>>;
  chunk_count: number | null;
  weaviate_collection: string | null;
  is_active: boolean;
  can_reprocess: boolean;
}

export type CreateDocumentLinkPayload = {
  source_system: string;
  document_type: string;
  external_document_id: string;
  document_name: string;
  document_version: string;
  upload_dt: string;
  access_url: string;
  created_by: string;
  source_reference?: string | null;
  notes?: string | null;
};

export type UpdateDocumentLinkPayload = {
  modified_by: string;
  source_system?: string;
  document_type?: string;
  external_document_id?: string;
  document_name?: string;
  document_version?: string;
  upload_dt?: string;
  access_url?: string;
  source_reference?: string | null;
  notes?: string | null;
};

export interface DocumentAiAutofillAnalyzePayload {
  access_url?: string | null;
  relative_path?: string | null;
  file_name?: string | null;
  original_file_name?: string | null;
}

export interface DocumentAiAutofillAnalyzeResult {
  document_type: string | null;
  external_document_id: string | null;
  document_version: string | null;
  confidence: {
    document_type?: number;
    external_document_id?: number;
    document_version?: number;
    [key: string]: number | undefined;
  };
  extraction_source: {
    document_type?: string;
    external_document_id?: string;
    document_version?: string;
    [key: string]: string | undefined;
  };
  warnings: string[];
  metadata: Record<string, unknown>;
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

const mapDocumentLinkRecord = (record: Partial<DocumentLinkRecord>): DocumentLinkRecord => ({
  document_link_id: record.document_link_id ?? "",
  asset_id: record.asset_id ?? null,
  release_id: record.release_id ?? null,
  source_system: record.source_system ?? null,
  document_type: record.document_type ?? null,
  external_document_id: record.external_document_id ?? null,
  document_name: record.document_name ?? null,
  document_version: record.document_version ?? null,
  upload_dt: record.upload_dt ?? null,
  access_url: record.access_url ?? null,
  source_reference: record.source_reference ?? null,
  notes: record.notes ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
  vectorization_status: record.vectorization_status ?? record.vectorization_job?.status ?? null,
  vectorization_job: record.vectorization_job
    ? {
        id: record.vectorization_job.id ?? "",
        rag_document_id: record.vectorization_job.rag_document_id ?? null,
        status: record.vectorization_job.status ?? "",
        metadata_json: record.vectorization_job.metadata_json ?? {},
        error_message: record.vectorization_job.error_message ?? null,
        requested_at: record.vectorization_job.requested_at ?? null,
        queued_at: record.vectorization_job.queued_at ?? null,
        started_at: record.vectorization_job.started_at ?? null,
        completed_at: record.vectorization_job.completed_at ?? null,
        queue_started_at: record.vectorization_job.queue_started_at ?? null,
        chunking_started_at: record.vectorization_job.chunking_started_at ?? null,
        chunking_completed_at: record.vectorization_job.chunking_completed_at ?? null,
        embedding_started_at: record.vectorization_job.embedding_started_at ?? null,
        embedding_completed_at: record.vectorization_job.embedding_completed_at ?? null,
        weaviate_write_started_at: record.vectorization_job.weaviate_write_started_at ?? null,
        weaviate_write_completed_at: record.vectorization_job.weaviate_write_completed_at ?? null,
        current_stage: record.vectorization_job.current_stage ?? null,
        process_log_json: record.vectorization_job.process_log_json ?? [],
        chunk_count: record.vectorization_job.chunk_count ?? null,
        weaviate_collection: record.vectorization_job.weaviate_collection ?? null,
        is_active: record.vectorization_job.is_active ?? true,
        can_reprocess: record.vectorization_job.can_reprocess ?? false,
      }
    : null,
});

export const getAssetDocuments = async (assetId: string): Promise<DocumentLinkRecord[]> => {
  const response = await api.get<ListResponse<DocumentLinkRecord>>(`/asset/${assetId}/documents`);
  return parseListResponse(response.data).map(mapDocumentLinkRecord);
};

export const createAssetDocument = async (
  assetId: string,
  payload: CreateDocumentLinkPayload,
): Promise<DocumentLinkRecord> => {
  const response = await api.post<SingleResponse<DocumentLinkRecord>>(`/asset/${assetId}/documents`, payload);
  return mapDocumentLinkRecord(parseSingleResponse(response.data));
};

export const getReleaseDocuments = async (releaseId: string): Promise<DocumentLinkRecord[]> => {
  const response = await api.get<ListResponse<DocumentLinkRecord>>(`/release/${releaseId}/documents`);
  return parseListResponse(response.data).map(mapDocumentLinkRecord);
};

export const createReleaseDocument = async (
  releaseId: string,
  payload: CreateDocumentLinkPayload,
): Promise<DocumentLinkRecord> => {
  const response = await api.post<SingleResponse<DocumentLinkRecord>>(`/release/${releaseId}/documents`, payload);
  return mapDocumentLinkRecord(parseSingleResponse(response.data));
};

export const getDocumentLink = async (documentLinkId: string): Promise<DocumentLinkRecord> => {
  const response = await api.get<SingleResponse<DocumentLinkRecord>>(`/document-link/${documentLinkId}`);
  return mapDocumentLinkRecord(parseSingleResponse(response.data));
};

export const updateDocumentLink = async (
  documentLinkId: string,
  payload: UpdateDocumentLinkPayload,
): Promise<DocumentLinkRecord> => {
  const response = await api.put<SingleResponse<DocumentLinkRecord>>(`/document-link/${documentLinkId}`, payload);
  return mapDocumentLinkRecord(parseSingleResponse(response.data));
};

export const analyzeDocumentLinkAutofill = async (
  payload: DocumentAiAutofillAnalyzePayload,
): Promise<DocumentAiAutofillAnalyzeResult> => {
  const response = await api.post<SingleResponse<DocumentAiAutofillAnalyzeResult>>(
    "/document-link/ai-autofill",
    payload,
  );
  const result = parseSingleResponse(response.data);
  return {
    document_type: result.document_type ?? null,
    external_document_id: result.external_document_id ?? null,
    document_version: result.document_version ?? null,
    confidence: result.confidence ?? {},
    extraction_source: result.extraction_source ?? {},
    warnings: result.warnings ?? [],
    metadata: result.metadata ?? {},
  };
};

export const deleteDocumentLink = async (documentLinkId: string): Promise<void> => {
  const response = await api.delete<SingleResponse<null>>(`/document-link/${documentLinkId}`);
  parseSingleResponse(response.data);
};

export const reprocessDocumentVectorization = async (
  documentLinkId: string,
): Promise<DocumentLinkRecord> => {
  const response = await api.post<SingleResponse<DocumentLinkRecord>>(
    `/document-link/${documentLinkId}/vectorization/reprocess`,
  );
  return mapDocumentLinkRecord(parseSingleResponse(response.data));
};
