import { api } from "./api";
import { DocumentVectorizationJobRecord } from "./document-link.service";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

type WrappedResponse<T> = T | ApiResponse<T>;

export interface AssetVectorizationSummary {
  asset_id: string;
  total_linked_documents: number;
  tracked_document_count: number;
  total_vectorized_documents: number;
  pending_or_queued_count: number;
  processing_count: number;
  completed_count: number;
  failed_count: number;
  unsupported_count: number;
  total_chunk_count: number;
  last_requested_at: string | null;
  last_completed_at: string | null;
}

export interface AssetVectorizationDocument {
  document_link_id: string;
  asset_id: string | null;
  release_id: string | null;
  release_version: string | null;
  source_context: string;
  source_system: string | null;
  document_type: string | null;
  external_document_id: string | null;
  document_name: string | null;
  document_version: string | null;
  upload_dt: string | null;
  access_url: string | null;
  source_reference: string | null;
  notes: string | null;
  created_dt: string | null;
  modified_dt: string | null;
  original_file_name: string | null;
  stored_file_name: string | null;
  stored_relative_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  extension: string | null;
  vectorization_status: string | null;
  chunk_count: number | null;
  requested_at: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  current_stage: string | null;
  collection_name: string | null;
  last_error: string | null;
  can_reprocess: boolean;
  vectorization_job: DocumentVectorizationJobRecord | null;
}

export interface DocumentVectorizationChunk {
  chunk_id: string;
  page: number | null;
  section_name: string | null;
  section_path: string | null;
  chunk_length: number;
  word_count: number;
  preview_text: string;
  text: string;
  category: string | null;
  duplicate: boolean | null;
  match_percentage: number | null;
}

export interface DocumentVectorizationChunkList {
  document_link_id: string;
  status: string | null;
  chunks: DocumentVectorizationChunk[];
  total: number;
  limit: number;
  offset: number;
  search: string | null;
  collection_name: string | null;
  retrieval_error: string | null;
}

export interface DocumentVectorizationReport {
  document_link_id: string;
  report: Record<string, unknown>;
}

export interface DocumentRagProcessStage {
  key: string;
  label: string;
  status: string;
  timestamp: string | null;
  started_at: string | null;
  completed_at: string | null;
  message: string | null;
  details: Record<string, unknown>;
}

export interface DocumentRagProcess {
  document_link_id: string;
  status: string | null;
  current_stage: string | null;
  stages: DocumentRagProcessStage[];
  process_log: Array<Record<string, unknown>>;
  error_message: string | null;
}

export interface ChunkListQuery {
  limit?: number;
  offset?: number;
  search?: string;
}

const emptySummary = (assetId: string): AssetVectorizationSummary => ({
  asset_id: assetId,
  total_linked_documents: 0,
  tracked_document_count: 0,
  total_vectorized_documents: 0,
  pending_or_queued_count: 0,
  processing_count: 0,
  completed_count: 0,
  failed_count: 0,
  unsupported_count: 0,
  total_chunk_count: 0,
  last_requested_at: null,
  last_completed_at: null,
});

const unwrap = <T>(payload: WrappedResponse<T>): T => {
  if (typeof payload === "object" && payload !== null && "success" in payload) {
    const wrapped = payload as ApiResponse<T>;
    if (!wrapped.success) {
      throw new Error(wrapped.message || "Request failed");
    }
    return wrapped.data;
  }

  return payload as T;
};

const mapJob = (record?: Partial<DocumentVectorizationJobRecord> | null): DocumentVectorizationJobRecord | null => {
  if (!record) return null;

  return {
    id: record.id ?? "",
    rag_document_id: record.rag_document_id ?? null,
    status: record.status ?? "",
    metadata_json: record.metadata_json ?? {},
    error_message: record.error_message ?? null,
    requested_at: record.requested_at ?? null,
    queued_at: record.queued_at ?? null,
    started_at: record.started_at ?? null,
    completed_at: record.completed_at ?? null,
    queue_started_at: record.queue_started_at ?? null,
    chunking_started_at: record.chunking_started_at ?? null,
    chunking_completed_at: record.chunking_completed_at ?? null,
    embedding_started_at: record.embedding_started_at ?? null,
    embedding_completed_at: record.embedding_completed_at ?? null,
    weaviate_write_started_at: record.weaviate_write_started_at ?? null,
    weaviate_write_completed_at: record.weaviate_write_completed_at ?? null,
    current_stage: record.current_stage ?? null,
    process_log_json: record.process_log_json ?? [],
    chunk_count: record.chunk_count ?? null,
    weaviate_collection: record.weaviate_collection ?? null,
    is_active: record.is_active ?? true,
    can_reprocess: record.can_reprocess ?? false,
  };
};

const mapSummary = (assetId: string, record?: Partial<AssetVectorizationSummary> | null): AssetVectorizationSummary => ({
  ...emptySummary(assetId),
  ...record,
  asset_id: record?.asset_id ?? assetId,
});

const mapDocument = (record: Partial<AssetVectorizationDocument>): AssetVectorizationDocument => ({
  document_link_id: record.document_link_id ?? "",
  asset_id: record.asset_id ?? null,
  release_id: record.release_id ?? null,
  release_version: record.release_version ?? null,
  source_context: record.source_context ?? "Asset document",
  source_system: record.source_system ?? null,
  document_type: record.document_type ?? null,
  external_document_id: record.external_document_id ?? null,
  document_name: record.document_name ?? null,
  document_version: record.document_version ?? null,
  upload_dt: record.upload_dt ?? null,
  access_url: record.access_url ?? null,
  source_reference: record.source_reference ?? null,
  notes: record.notes ?? null,
  created_dt: record.created_dt ?? null,
  modified_dt: record.modified_dt ?? null,
  original_file_name: record.original_file_name ?? null,
  stored_file_name: record.stored_file_name ?? null,
  stored_relative_path: record.stored_relative_path ?? null,
  mime_type: record.mime_type ?? null,
  file_size: record.file_size ?? null,
  extension: record.extension ?? null,
  vectorization_status: record.vectorization_status ?? record.vectorization_job?.status ?? null,
  chunk_count: record.chunk_count ?? record.vectorization_job?.chunk_count ?? null,
  requested_at: record.requested_at ?? record.vectorization_job?.requested_at ?? null,
  queued_at: record.queued_at ?? record.vectorization_job?.queued_at ?? null,
  started_at: record.started_at ?? record.vectorization_job?.started_at ?? null,
  completed_at: record.completed_at ?? record.vectorization_job?.completed_at ?? null,
  current_stage: record.current_stage ?? record.vectorization_job?.current_stage ?? null,
  collection_name: record.collection_name ?? record.vectorization_job?.weaviate_collection ?? null,
  last_error: record.last_error ?? record.vectorization_job?.error_message ?? null,
  can_reprocess: record.can_reprocess ?? record.vectorization_job?.can_reprocess ?? false,
  vectorization_job: mapJob(record.vectorization_job),
});

export const getAssetVectorizationSummary = async (assetId: string): Promise<AssetVectorizationSummary> => {
  const response = await api.get<WrappedResponse<AssetVectorizationSummary>>(`/asset/${assetId}/vectorization/summary`);
  return mapSummary(assetId, unwrap(response.data));
};

export const getAssetVectorizationDocuments = async (assetId: string): Promise<AssetVectorizationDocument[]> => {
  const response = await api.get<WrappedResponse<AssetVectorizationDocument[]>>(`/asset/${assetId}/vectorization/documents`);
  return (unwrap(response.data) ?? []).map(mapDocument);
};

export const getDocumentVectorization = async (documentLinkId: string): Promise<AssetVectorizationDocument> => {
  const response = await api.get<WrappedResponse<AssetVectorizationDocument>>(`/document-link/${documentLinkId}/vectorization`);
  return mapDocument(unwrap(response.data));
};

export const refreshDocumentVectorization = async (documentLinkId: string): Promise<AssetVectorizationDocument> => {
  const response = await api.post<WrappedResponse<AssetVectorizationDocument>>(`/document-link/${documentLinkId}/vectorization/refresh`);
  return mapDocument(unwrap(response.data));
};

export const getDocumentVectorizationChunks = async (
  documentLinkId: string,
  query: ChunkListQuery = {},
): Promise<DocumentVectorizationChunkList> => {
  const response = await api.get<WrappedResponse<DocumentVectorizationChunkList>>(
    `/document-link/${documentLinkId}/vectorization/chunks`,
    { params: query },
  );
  return unwrap(response.data);
};

export const getDocumentVectorizationReport = async (
  documentLinkId: string,
): Promise<DocumentVectorizationReport> => {
  const response = await api.get<WrappedResponse<DocumentVectorizationReport>>(
    `/document-link/${documentLinkId}/vectorization/report`,
  );
  return unwrap(response.data);
};

export const getDocumentRagProcess = async (documentLinkId: string): Promise<DocumentRagProcess> => {
  const response = await api.get<WrappedResponse<DocumentRagProcess>>(
    `/document-link/${documentLinkId}/vectorization/process`,
  );
  return unwrap(response.data);
};
