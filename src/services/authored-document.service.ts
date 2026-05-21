import { api, apiBaseUrl } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface DocumentTemplateRecord {
  template_id: string;
  template_code: string;
  template_name: string;
  document_type: string;
  template_content: string;
  is_active: boolean;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export interface AuthoredDocumentRecord {
  authored_document_id: string;
  document_type: string;
  title: string;
  status: string;
  asset_id: string | null;
  release_id: string | null;
  template_id: string;
  template_code?: string | null;
  template_name?: string | null;
  content: string;
  source_context_json?: Record<string, unknown> | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  reviewer_name?: string | null;
  approver_name?: string | null;
  publish_status: string;
  last_publish_attempt_at?: string | null;
  last_publish_attempt_by?: string | null;
  published_at?: string | null;
  published_by?: string | null;
  external_system?: string | null;
  external_document_id?: string | null;
  external_document_name?: string | null;
  external_document_version?: string | null;
  external_document_url?: string | null;
  external_source_reference?: string | null;
  publish_error_message?: string | null;
  asset_name?: string | null;
  asset_code?: string | null;
  release_version?: string | null;
  generation_mode?: string | null;
  generation_requested_mode?: string | null;
  generation_status?: string | null;
  generation_operation?: string | null;
  generation_provider?: string | null;
  generation_model?: string | null;
  generation_fallback_reason?: string | null;
  last_generated_at?: string | null;
}

export interface AuthoredDocumentPublishStatusRecord {
  authored_document_id: string;
  document_type: string;
  document_status: string;
  publish_status: string;
  last_publish_attempt_at?: string | null;
  last_publish_attempt_by?: string | null;
  published_at?: string | null;
  published_by?: string | null;
  external_system?: string | null;
  external_document_id?: string | null;
  external_document_name?: string | null;
  external_document_version?: string | null;
  external_document_url?: string | null;
  external_source_reference?: string | null;
  publish_error_message?: string | null;
}

export interface AuthoredDocumentReviewActionRecord {
  id: string;
  authored_document_id: string;
  action_type: string;
  action_by?: string | null;
  action_dt?: string | null;
  comment_text?: string | null;
  from_status: string;
  to_status: string;
}

export interface DocumentTemplateListParams {
  document_type?: string | null;
  active_only?: boolean;
}

export type CreateAuthoredDocumentFromTemplatePayload = {
  document_type: string;
  template_id?: string;
  template_code?: string;
  asset_id?: string;
  release_id?: string;
  title?: string | null;
  purpose_notes?: string | null;
  special_instructions?: string | null;
  source_document_url?: string | null;
  source_document_name?: string | null;
  source_document_relative_path?: string | null;
  source_urs_text?: string | null;
  created_by: string;
};

export type CreateAuthoredDocumentAiDraftPayload = CreateAuthoredDocumentFromTemplatePayload & {
  fallback_to_template_prefill?: boolean;
};

export type UpdateAuthoredDocumentPayload = {
  modified_by: string;
  title?: string;
  content?: string;
  status?: string;
};

export type RegenerateAuthoredDocumentAiPayload = {
  modified_by: string;
  title?: string | null;
  existing_content?: string | null;
  purpose_notes?: string | null;
  special_instructions?: string | null;
  operation?: "REGENERATE" | "IMPROVE";
};

export type AuthoredDocumentWorkflowActionPayload = {
  action_by: string;
  comment_text?: string | null;
  reviewer_name?: string | null;
  approver_name?: string | null;
};

export type AuthoredDocumentCommentPayload = {
  action_by: string;
  comment_text: string;
};

export type AuthoredDocumentPublishPayload = {
  action_by: string;
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

const mapTemplateRecord = (record: Partial<DocumentTemplateRecord>): DocumentTemplateRecord => ({
  template_id: record.template_id ?? "",
  template_code: record.template_code ?? "",
  template_name: record.template_name ?? "",
  document_type: record.document_type ?? "",
  template_content: record.template_content ?? "",
  is_active: record.is_active ?? true,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
});

const mapAuthoredDocumentRecord = (record: Partial<AuthoredDocumentRecord>): AuthoredDocumentRecord => ({
  authored_document_id: record.authored_document_id ?? "",
  document_type: record.document_type ?? "",
  title: record.title ?? "",
  status: record.status ?? "",
  asset_id: record.asset_id ?? null,
  release_id: record.release_id ?? null,
  template_id: record.template_id ?? "",
  template_code: record.template_code ?? null,
  template_name: record.template_name ?? null,
  content: record.content ?? "",
  source_context_json: record.source_context_json ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
  reviewer_name: record.reviewer_name ?? null,
  approver_name: record.approver_name ?? null,
  publish_status: record.publish_status ?? "NOT_PUBLISHED",
  last_publish_attempt_at: record.last_publish_attempt_at ?? null,
  last_publish_attempt_by: record.last_publish_attempt_by ?? null,
  published_at: record.published_at ?? null,
  published_by: record.published_by ?? null,
  external_system: record.external_system ?? null,
  external_document_id: record.external_document_id ?? null,
  external_document_name: record.external_document_name ?? null,
  external_document_version: record.external_document_version ?? null,
  external_document_url: record.external_document_url ?? null,
  external_source_reference: record.external_source_reference ?? null,
  publish_error_message: record.publish_error_message ?? null,
  asset_name: record.asset_name ?? null,
  asset_code: record.asset_code ?? null,
  release_version: record.release_version ?? null,
  generation_mode: record.generation_mode ?? null,
  generation_requested_mode: record.generation_requested_mode ?? null,
  generation_status: record.generation_status ?? null,
  generation_operation: record.generation_operation ?? null,
  generation_provider: record.generation_provider ?? null,
  generation_model: record.generation_model ?? null,
  generation_fallback_reason: record.generation_fallback_reason ?? null,
  last_generated_at: record.last_generated_at ?? null,
});

const mapAuthoredDocumentPublishStatusRecord = (
  record: Partial<AuthoredDocumentPublishStatusRecord>,
): AuthoredDocumentPublishStatusRecord => ({
  authored_document_id: record.authored_document_id ?? "",
  document_type: record.document_type ?? "",
  document_status: record.document_status ?? "",
  publish_status: record.publish_status ?? "NOT_PUBLISHED",
  last_publish_attempt_at: record.last_publish_attempt_at ?? null,
  last_publish_attempt_by: record.last_publish_attempt_by ?? null,
  published_at: record.published_at ?? null,
  published_by: record.published_by ?? null,
  external_system: record.external_system ?? null,
  external_document_id: record.external_document_id ?? null,
  external_document_name: record.external_document_name ?? null,
  external_document_version: record.external_document_version ?? null,
  external_document_url: record.external_document_url ?? null,
  external_source_reference: record.external_source_reference ?? null,
  publish_error_message: record.publish_error_message ?? null,
});

const mapAuthoredDocumentReviewActionRecord = (
  record: Partial<AuthoredDocumentReviewActionRecord>,
): AuthoredDocumentReviewActionRecord => ({
  id: record.id ?? "",
  authored_document_id: record.authored_document_id ?? "",
  action_type: record.action_type ?? "",
  action_by: record.action_by ?? null,
  action_dt: record.action_dt ?? null,
  comment_text: record.comment_text ?? null,
  from_status: record.from_status ?? "",
  to_status: record.to_status ?? "",
});

export const getDocumentTemplates = async (
  params: DocumentTemplateListParams = {},
): Promise<DocumentTemplateRecord[]> => {
  const response = await api.get<ListResponse<DocumentTemplateRecord>>("/document-templates", {
    params,
  });
  return parseListResponse(response.data).map(mapTemplateRecord);
};

export const getDocumentTemplateById = async (templateId: string): Promise<DocumentTemplateRecord> => {
  const response = await api.get<SingleResponse<DocumentTemplateRecord>>(`/document-templates/${templateId}`);
  return mapTemplateRecord(parseSingleResponse(response.data));
};

export const getAssetAuthoredDocuments = async (assetId: string): Promise<AuthoredDocumentRecord[]> => {
  const response = await api.get<ListResponse<AuthoredDocumentRecord>>(`/asset/${assetId}/authored-documents`);
  return parseListResponse(response.data).map(mapAuthoredDocumentRecord);
};

export const getReleaseAuthoredDocuments = async (releaseId: string): Promise<AuthoredDocumentRecord[]> => {
  const response = await api.get<ListResponse<AuthoredDocumentRecord>>(`/release/${releaseId}/authored-documents`);
  return parseListResponse(response.data).map(mapAuthoredDocumentRecord);
};

export const getAuthoredDocument = async (authoredDocumentId: string): Promise<AuthoredDocumentRecord> => {
  const response = await api.get<SingleResponse<AuthoredDocumentRecord>>(
    `/authored-documents/${authoredDocumentId}`,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const getAuthoredDocumentPdfPreviewUrl = (authoredDocumentId: string): string =>
  `${apiBaseUrl}/authored-documents/${encodeURIComponent(authoredDocumentId)}/preview-pdf`;

export const createAuthoredDocumentFromTemplate = async (
  payload: CreateAuthoredDocumentFromTemplatePayload,
): Promise<AuthoredDocumentRecord> => {
  const response = await api.post<SingleResponse<AuthoredDocumentRecord>>(
    "/authored-documents/create-from-template",
    payload,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const createAuthoredDocumentAiDraft = async (
  payload: CreateAuthoredDocumentAiDraftPayload,
): Promise<AuthoredDocumentRecord> => {
  const response = await api.post<SingleResponse<AuthoredDocumentRecord>>(
    "/authored-documents/create-ai-draft",
    payload,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const updateAuthoredDocument = async (
  authoredDocumentId: string,
  payload: UpdateAuthoredDocumentPayload,
): Promise<AuthoredDocumentRecord> => {
  const response = await api.put<SingleResponse<AuthoredDocumentRecord>>(
    `/authored-documents/${authoredDocumentId}`,
    payload,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const regenerateAuthoredDocumentAiContent = async (
  authoredDocumentId: string,
  payload: RegenerateAuthoredDocumentAiPayload,
): Promise<AuthoredDocumentRecord> => {
  const response = await api.post<SingleResponse<AuthoredDocumentRecord>>(
    `/authored-documents/${authoredDocumentId}/regenerate-ai-content`,
    payload,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const submitAuthoredDocumentForReview = async (
  authoredDocumentId: string,
  payload: AuthoredDocumentWorkflowActionPayload,
): Promise<AuthoredDocumentRecord> => {
  const response = await api.post<SingleResponse<AuthoredDocumentRecord>>(
    `/authored-documents/${authoredDocumentId}/submit-for-review`,
    payload,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const requestAuthoredDocumentChanges = async (
  authoredDocumentId: string,
  payload: AuthoredDocumentWorkflowActionPayload,
): Promise<AuthoredDocumentRecord> => {
  const response = await api.post<SingleResponse<AuthoredDocumentRecord>>(
    `/authored-documents/${authoredDocumentId}/request-changes`,
    payload,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const approveAuthoredDocument = async (
  authoredDocumentId: string,
  payload: AuthoredDocumentWorkflowActionPayload,
): Promise<AuthoredDocumentRecord> => {
  const response = await api.post<SingleResponse<AuthoredDocumentRecord>>(
    `/authored-documents/${authoredDocumentId}/approve`,
    payload,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const rejectAuthoredDocument = async (
  authoredDocumentId: string,
  payload: AuthoredDocumentWorkflowActionPayload,
): Promise<AuthoredDocumentRecord> => {
  const response = await api.post<SingleResponse<AuthoredDocumentRecord>>(
    `/authored-documents/${authoredDocumentId}/reject`,
    payload,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const commentOnAuthoredDocument = async (
  authoredDocumentId: string,
  payload: AuthoredDocumentCommentPayload,
): Promise<AuthoredDocumentReviewActionRecord> => {
  const response = await api.post<SingleResponse<AuthoredDocumentReviewActionRecord>>(
    `/authored-documents/${authoredDocumentId}/comment`,
    payload,
  );
  return mapAuthoredDocumentReviewActionRecord(parseSingleResponse(response.data));
};

export const getAuthoredDocumentHistory = async (
  authoredDocumentId: string,
): Promise<AuthoredDocumentReviewActionRecord[]> => {
  const response = await api.get<ListResponse<AuthoredDocumentReviewActionRecord>>(
    `/authored-documents/${authoredDocumentId}/history`,
  );
  return parseListResponse(response.data).map(mapAuthoredDocumentReviewActionRecord);
};

export const getAuthoredDocumentPublishStatus = async (
  authoredDocumentId: string,
): Promise<AuthoredDocumentPublishStatusRecord> => {
  const response = await api.get<SingleResponse<AuthoredDocumentPublishStatusRecord>>(
    `/authored-documents/${authoredDocumentId}/publish-status`,
  );
  return mapAuthoredDocumentPublishStatusRecord(parseSingleResponse(response.data));
};

export const publishAuthoredDocumentToVeeva = async (
  authoredDocumentId: string,
  payload: AuthoredDocumentPublishPayload,
): Promise<AuthoredDocumentRecord> => {
  const response = await api.post<SingleResponse<AuthoredDocumentRecord>>(
    `/authored-documents/${authoredDocumentId}/publish-to-veeva`,
    payload,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const retryAuthoredDocumentPublish = async (
  authoredDocumentId: string,
  payload: AuthoredDocumentPublishPayload,
): Promise<AuthoredDocumentRecord> => {
  const response = await api.post<SingleResponse<AuthoredDocumentRecord>>(
    `/authored-documents/${authoredDocumentId}/retry-publish`,
    payload,
  );
  return mapAuthoredDocumentRecord(parseSingleResponse(response.data));
};

export const deleteAuthoredDocument = async (authoredDocumentId: string): Promise<void> => {
  const response = await api.delete<SingleResponse<null>>(`/authored-documents/${authoredDocumentId}`);
  parseSingleResponse(response.data);
};
