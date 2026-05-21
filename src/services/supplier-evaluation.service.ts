import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface SupplierEvaluationRecord {
  evaluation_id: string;
  evaluation_name: string;
  asset_uuid: string;
  asset_name?: string | null;
  asset_code?: string | null;
  urs_document_id: string;
  urs_title?: string | null;
  urs_status?: string | null;
  urs_release_id?: string | null;
  urs_release_version?: string | null;
  status: string;
  opened_at?: string | null;
  locked_at?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  response_count: number;
  submitted_response_count: number;
  locked_response_count: number;
}

export interface SupplierEvaluationResponseRecord {
  response_id: string;
  evaluation_id: string;
  supplier_id: string;
  supplier_name?: string | null;
  supplier_type?: string | null;
  submission_status: string;
  quotation_reference?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  document_count: number;
}

export interface SupplierResponseDocumentRecord {
  document_id: string;
  response_id: string;
  document_type: string;
  source_system?: string | null;
  external_document_id?: string | null;
  document_name: string;
  document_version?: string | null;
  upload_dt: string;
  access_url: string;
  source_reference?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export interface SupplierEvaluationResponseDetailRecord extends SupplierEvaluationResponseRecord {
  evaluation_status: string;
  documents: SupplierResponseDocumentRecord[];
}

export interface EvaluationRequirementItemRecord {
  requirement_item_id: string;
  evaluation_id: string;
  urs_document_id: string;
  requirement_key?: string | null;
  requirement_section?: string | null;
  requirement_text: string;
  requirement_order?: number | null;
  source_reference?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export interface EvaluationRequirementSeedResultRecord {
  created_count: number;
  skipped_count: number;
  strategy: string;
  requirements: EvaluationRequirementItemRecord[];
}

export interface SupplierRequirementResponseMatrixRowRecord {
  requirement_item_id: string;
  requirement_response_id?: string | null;
  response_id: string;
  requirement_key?: string | null;
  requirement_section?: string | null;
  requirement_text: string;
  requirement_order?: number | null;
  source_reference?: string | null;
  fit_status?: string | null;
  supplier_response_text?: string | null;
  evidence_reference?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export interface SupplierRequirementAnalysisRecord {
  id: string;
  analysis_id: string;
  supplier_response_id: string;
  supplier_id: string;
  supplier_name?: string | null;
  requirement_id: string;
  requirement_key?: string | null;
  requirement_section?: string | null;
  requirement_text: string;
  evaluated_fit: string;
  structured_fit?: string | null;
  confidence_score: number;
  reasoning_text: string;
  evidence_reference?: string | null;
  created_at?: string | null;
}

export interface SupplierComparisonSummaryRecord {
  id: string;
  analysis_id: string;
  supplier_id: string;
  supplier_name?: string | null;
  supplier_type?: string | null;
  supplier_response_id?: string | null;
  overall_score: number;
  meets_count: number;
  partially_meets_count: number;
  not_meets_count: number;
  total_requirements: number;
  meets_percent: number;
  partially_meets_percent: number;
  not_meets_percent: number;
  strengths: string[];
  weaknesses: string[];
  risk_flags: string[];
  recommendation_rank: number;
  created_at?: string | null;
}

export interface SupplierEvaluationAnalysisRecord {
  analysis_id: string;
  evaluation_id: string;
  status: string;
  started_at?: string | null;
  completed_at?: string | null;
  triggered_by?: string | null;
  provider?: string | null;
  model?: string | null;
  prompt_version?: string | null;
  input_snapshot_json?: Record<string, unknown> | null;
  summary_json?: Record<string, unknown> | null;
  error_message?: string | null;
  created_at?: string | null;
  requirement_analyses: SupplierRequirementAnalysisRecord[];
  comparison_summaries: SupplierComparisonSummaryRecord[];
}

export interface SupplierEvaluationAnalysisListRecord {
  latest?: SupplierEvaluationAnalysisRecord | null;
  history: SupplierEvaluationAnalysisRecord[];
}

export interface SupplierEvaluationComparisonRecord {
  analysis_id?: string | null;
  evaluation_id: string;
  status: string;
  summary_json?: Record<string, unknown> | null;
  comparison_summaries: SupplierComparisonSummaryRecord[];
  requirement_analyses: SupplierRequirementAnalysisRecord[];
}

export interface SupplierEvaluationResponseCreateResult {
  created_count: number;
  responses: SupplierEvaluationResponseRecord[];
}

export interface SupplierEvaluationListParams {
  asset_uuid?: string | null;
  status?: string | null;
}

export type CreateSupplierEvaluationPayload = {
  evaluation_name: string;
  asset_uuid: string;
  urs_document_id: string;
  supplier_ids?: string[];
  created_by: string;
};

export type UpdateSupplierEvaluationPayload = {
  modified_by: string;
  evaluation_name?: string;
  urs_document_id?: string;
  status?: string;
};

export type SupplierEvaluationWorkflowActionPayload = {
  action_by: string;
};

export type CreateSupplierEvaluationResponsesPayload = {
  supplier_ids: string[];
  created_by: string;
};

export type UpdateSupplierEvaluationResponsePayload = {
  modified_by: string;
  quotation_reference?: string | null;
  notes?: string | null;
};

export type SubmitSupplierEvaluationResponsePayload = {
  action_by: string;
};

export type SeedEvaluationRequirementsPayload = {
  created_by: string;
};

export type CreateEvaluationRequirementPayload = {
  requirement_key?: string | null;
  requirement_section?: string | null;
  requirement_text: string;
  requirement_order?: number | null;
  source_reference?: string | null;
  created_by: string;
};

export type UpdateEvaluationRequirementPayload = {
  modified_by: string;
  requirement_key?: string | null;
  requirement_section?: string | null;
  requirement_text?: string | null;
  requirement_order?: number | null;
  source_reference?: string | null;
};

export type CreateSupplierRequirementResponsePayload = {
  requirement_item_id: string;
  fit_status: string;
  supplier_response_text?: string | null;
  evidence_reference?: string | null;
  notes?: string | null;
  created_by: string;
};

export type UpdateSupplierRequirementResponsePayload = {
  modified_by: string;
  fit_status?: string | null;
  supplier_response_text?: string | null;
  evidence_reference?: string | null;
  notes?: string | null;
};

export type BulkSaveSupplierRequirementResponseItemPayload = {
  requirement_item_id: string;
  fit_status?: string | null;
  supplier_response_text?: string | null;
  evidence_reference?: string | null;
  notes?: string | null;
};

export type BulkSaveSupplierRequirementResponsesPayload = {
  modified_by: string;
  items: BulkSaveSupplierRequirementResponseItemPayload[];
};

export type RunSupplierEvaluationAnalysisPayload = {
  triggered_by?: string | null;
};

export type CreateSupplierResponseDocumentPayload = {
  document_type: string;
  source_system?: string | null;
  external_document_id?: string | null;
  document_name: string;
  document_version?: string | null;
  upload_dt: string;
  access_url: string;
  source_reference?: string | null;
  notes?: string | null;
  created_by: string;
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

const mapSupplierResponseDocumentRecord = (
  record: Partial<SupplierResponseDocumentRecord>,
): SupplierResponseDocumentRecord => ({
  document_id: record.document_id ?? "",
  response_id: record.response_id ?? "",
  document_type: record.document_type ?? "",
  source_system: record.source_system ?? null,
  external_document_id: record.external_document_id ?? null,
  document_name: record.document_name ?? "",
  document_version: record.document_version ?? null,
  upload_dt: record.upload_dt ?? "",
  access_url: record.access_url ?? "",
  source_reference: record.source_reference ?? null,
  notes: record.notes ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
});

const mapSupplierEvaluationResponseRecord = (
  record: Partial<SupplierEvaluationResponseRecord>,
): SupplierEvaluationResponseRecord => ({
  response_id: record.response_id ?? "",
  evaluation_id: record.evaluation_id ?? "",
  supplier_id: record.supplier_id ?? "",
  supplier_name: record.supplier_name ?? null,
  supplier_type: record.supplier_type ?? null,
  submission_status: record.submission_status ?? "NOT_STARTED",
  quotation_reference: record.quotation_reference ?? null,
  submitted_at: record.submitted_at ?? null,
  submitted_by: record.submitted_by ?? null,
  notes: record.notes ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
  document_count: record.document_count ?? 0,
});

const mapSupplierEvaluationRecord = (
  record: Partial<SupplierEvaluationRecord>,
): SupplierEvaluationRecord => ({
  evaluation_id: record.evaluation_id ?? "",
  evaluation_name: record.evaluation_name ?? "",
  asset_uuid: record.asset_uuid ?? "",
  asset_name: record.asset_name ?? null,
  asset_code: record.asset_code ?? null,
  urs_document_id: record.urs_document_id ?? "",
  urs_title: record.urs_title ?? null,
  urs_status: record.urs_status ?? null,
  urs_release_id: record.urs_release_id ?? null,
  urs_release_version: record.urs_release_version ?? null,
  status: record.status ?? "DRAFT",
  opened_at: record.opened_at ?? null,
  locked_at: record.locked_at ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
  response_count: record.response_count ?? 0,
  submitted_response_count: record.submitted_response_count ?? 0,
  locked_response_count: record.locked_response_count ?? 0,
});

const mapSupplierEvaluationResponseDetailRecord = (
  record: Partial<SupplierEvaluationResponseDetailRecord>,
): SupplierEvaluationResponseDetailRecord => ({
  ...mapSupplierEvaluationResponseRecord(record),
  evaluation_status: record.evaluation_status ?? "DRAFT",
  documents: (record.documents ?? []).map(mapSupplierResponseDocumentRecord),
});

const mapEvaluationRequirementItemRecord = (
  record: Partial<EvaluationRequirementItemRecord>,
): EvaluationRequirementItemRecord => ({
  requirement_item_id: record.requirement_item_id ?? "",
  evaluation_id: record.evaluation_id ?? "",
  urs_document_id: record.urs_document_id ?? "",
  requirement_key: record.requirement_key ?? null,
  requirement_section: record.requirement_section ?? null,
  requirement_text: record.requirement_text ?? "",
  requirement_order: record.requirement_order ?? null,
  source_reference: record.source_reference ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
});

const mapEvaluationRequirementSeedResultRecord = (
  record: Partial<EvaluationRequirementSeedResultRecord>,
): EvaluationRequirementSeedResultRecord => ({
  created_count: record.created_count ?? 0,
  skipped_count: record.skipped_count ?? 0,
  strategy: record.strategy ?? "",
  requirements: (record.requirements ?? []).map(mapEvaluationRequirementItemRecord),
});

const mapSupplierRequirementResponseMatrixRowRecord = (
  record: Partial<SupplierRequirementResponseMatrixRowRecord>,
): SupplierRequirementResponseMatrixRowRecord => ({
  requirement_item_id: record.requirement_item_id ?? "",
  requirement_response_id: record.requirement_response_id ?? null,
  response_id: record.response_id ?? "",
  requirement_key: record.requirement_key ?? null,
  requirement_section: record.requirement_section ?? null,
  requirement_text: record.requirement_text ?? "",
  requirement_order: record.requirement_order ?? null,
  source_reference: record.source_reference ?? null,
  fit_status: record.fit_status ?? null,
  supplier_response_text: record.supplier_response_text ?? null,
  evidence_reference: record.evidence_reference ?? null,
  notes: record.notes ?? null,
  created_by: record.created_by ?? null,
  created_dt: record.created_dt ?? null,
  modified_by: record.modified_by ?? null,
  modified_dt: record.modified_dt ?? null,
});

const normalizeStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
};

const mapSupplierRequirementAnalysisRecord = (
  record: Partial<SupplierRequirementAnalysisRecord>,
): SupplierRequirementAnalysisRecord => ({
  id: record.id ?? "",
  analysis_id: record.analysis_id ?? "",
  supplier_response_id: record.supplier_response_id ?? "",
  supplier_id: record.supplier_id ?? "",
  supplier_name: record.supplier_name ?? null,
  requirement_id: record.requirement_id ?? "",
  requirement_key: record.requirement_key ?? null,
  requirement_section: record.requirement_section ?? null,
  requirement_text: record.requirement_text ?? "",
  evaluated_fit: record.evaluated_fit ?? "PARTIALLY_MEETS",
  structured_fit: record.structured_fit ?? null,
  confidence_score: Number(record.confidence_score ?? 0),
  reasoning_text: record.reasoning_text ?? "",
  evidence_reference: record.evidence_reference ?? null,
  created_at: record.created_at ?? null,
});

const mapSupplierComparisonSummaryRecord = (
  record: Partial<SupplierComparisonSummaryRecord>,
): SupplierComparisonSummaryRecord => ({
  id: record.id ?? "",
  analysis_id: record.analysis_id ?? "",
  supplier_id: record.supplier_id ?? "",
  supplier_name: record.supplier_name ?? null,
  supplier_type: record.supplier_type ?? null,
  supplier_response_id: record.supplier_response_id ?? null,
  overall_score: Number(record.overall_score ?? 0),
  meets_count: record.meets_count ?? 0,
  partially_meets_count: record.partially_meets_count ?? 0,
  not_meets_count: record.not_meets_count ?? 0,
  total_requirements: record.total_requirements ?? 0,
  meets_percent: Number(record.meets_percent ?? 0),
  partially_meets_percent: Number(record.partially_meets_percent ?? 0),
  not_meets_percent: Number(record.not_meets_percent ?? 0),
  strengths: normalizeStringList(record.strengths),
  weaknesses: normalizeStringList(record.weaknesses),
  risk_flags: normalizeStringList(record.risk_flags),
  recommendation_rank: record.recommendation_rank ?? 0,
  created_at: record.created_at ?? null,
});

const mapSupplierEvaluationAnalysisRecord = (
  record: Partial<SupplierEvaluationAnalysisRecord>,
): SupplierEvaluationAnalysisRecord => ({
  analysis_id: record.analysis_id ?? "",
  evaluation_id: record.evaluation_id ?? "",
  status: record.status ?? "NOT_STARTED",
  started_at: record.started_at ?? null,
  completed_at: record.completed_at ?? null,
  triggered_by: record.triggered_by ?? null,
  provider: record.provider ?? null,
  model: record.model ?? null,
  prompt_version: record.prompt_version ?? null,
  input_snapshot_json: record.input_snapshot_json ?? null,
  summary_json: record.summary_json ?? null,
  error_message: record.error_message ?? null,
  created_at: record.created_at ?? null,
  requirement_analyses: (record.requirement_analyses ?? []).map(mapSupplierRequirementAnalysisRecord),
  comparison_summaries: (record.comparison_summaries ?? []).map(mapSupplierComparisonSummaryRecord),
});

const mapSupplierEvaluationAnalysisListRecord = (
  record: Partial<SupplierEvaluationAnalysisListRecord>,
): SupplierEvaluationAnalysisListRecord => ({
  latest: record.latest ? mapSupplierEvaluationAnalysisRecord(record.latest) : null,
  history: (record.history ?? []).map(mapSupplierEvaluationAnalysisRecord),
});

const mapSupplierEvaluationComparisonRecord = (
  record: Partial<SupplierEvaluationComparisonRecord>,
): SupplierEvaluationComparisonRecord => ({
  analysis_id: record.analysis_id ?? null,
  evaluation_id: record.evaluation_id ?? "",
  status: record.status ?? "NOT_STARTED",
  summary_json: record.summary_json ?? null,
  comparison_summaries: (record.comparison_summaries ?? []).map(mapSupplierComparisonSummaryRecord),
  requirement_analyses: (record.requirement_analyses ?? []).map(mapSupplierRequirementAnalysisRecord),
});

const mapSupplierEvaluationResponseCreateResult = (
  record: Partial<SupplierEvaluationResponseCreateResult>,
): SupplierEvaluationResponseCreateResult => ({
  created_count: record.created_count ?? 0,
  responses: (record.responses ?? []).map(mapSupplierEvaluationResponseRecord),
});

export const getSupplierEvaluations = async (
  params: SupplierEvaluationListParams = {},
): Promise<SupplierEvaluationRecord[]> => {
  const response = await api.get<ListResponse<SupplierEvaluationRecord>>("/supplier-evaluations", { params });
  return parseListResponse(response.data).map(mapSupplierEvaluationRecord);
};

export const getSupplierEvaluation = async (evaluationId: string): Promise<SupplierEvaluationRecord> => {
  const response = await api.get<SingleResponse<SupplierEvaluationRecord>>(`/supplier-evaluations/${evaluationId}`);
  return mapSupplierEvaluationRecord(parseSingleResponse(response.data));
};

export const createSupplierEvaluation = async (
  payload: CreateSupplierEvaluationPayload,
): Promise<SupplierEvaluationRecord> => {
  const response = await api.post<SingleResponse<SupplierEvaluationRecord>>("/supplier-evaluations", payload);
  return mapSupplierEvaluationRecord(parseSingleResponse(response.data));
};

export const updateSupplierEvaluation = async (
  evaluationId: string,
  payload: UpdateSupplierEvaluationPayload,
): Promise<SupplierEvaluationRecord> => {
  const response = await api.put<SingleResponse<SupplierEvaluationRecord>>(
    `/supplier-evaluations/${evaluationId}`,
    payload,
  );
  return mapSupplierEvaluationRecord(parseSingleResponse(response.data));
};

export const openSupplierEvaluation = async (
  evaluationId: string,
  payload: SupplierEvaluationWorkflowActionPayload,
): Promise<SupplierEvaluationRecord> => {
  const response = await api.post<SingleResponse<SupplierEvaluationRecord>>(
    `/supplier-evaluations/${evaluationId}/open`,
    payload,
  );
  return mapSupplierEvaluationRecord(parseSingleResponse(response.data));
};

export const lockSupplierEvaluation = async (
  evaluationId: string,
  payload: SupplierEvaluationWorkflowActionPayload,
): Promise<SupplierEvaluationRecord> => {
  const response = await api.post<SingleResponse<SupplierEvaluationRecord>>(
    `/supplier-evaluations/${evaluationId}/lock`,
    payload,
  );
  return mapSupplierEvaluationRecord(parseSingleResponse(response.data));
};

export const runSupplierEvaluationAnalysis = async (
  evaluationId: string,
  payload: RunSupplierEvaluationAnalysisPayload,
): Promise<SupplierEvaluationAnalysisRecord> => {
  const response = await api.post<SingleResponse<SupplierEvaluationAnalysisRecord>>(
    `/supplier-evaluations/${evaluationId}/run-analysis`,
    payload,
  );
  return mapSupplierEvaluationAnalysisRecord(parseSingleResponse(response.data));
};

export const getSupplierEvaluationAnalysis = async (
  evaluationId: string,
): Promise<SupplierEvaluationAnalysisListRecord> => {
  const response = await api.get<SingleResponse<SupplierEvaluationAnalysisListRecord>>(
    `/supplier-evaluations/${evaluationId}/analysis`,
  );
  return mapSupplierEvaluationAnalysisListRecord(parseSingleResponse(response.data));
};

export const getSupplierEvaluationComparison = async (
  evaluationId: string,
): Promise<SupplierEvaluationComparisonRecord> => {
  const response = await api.get<SingleResponse<SupplierEvaluationComparisonRecord>>(
    `/supplier-evaluations/${evaluationId}/comparison`,
  );
  return mapSupplierEvaluationComparisonRecord(parseSingleResponse(response.data));
};

export const getSupplierEvaluationResponses = async (
  evaluationId: string,
): Promise<SupplierEvaluationResponseRecord[]> => {
  const response = await api.get<ListResponse<SupplierEvaluationResponseRecord>>(
    `/supplier-evaluations/${evaluationId}/responses`,
  );
  return parseListResponse(response.data).map(mapSupplierEvaluationResponseRecord);
};

export const addSupplierEvaluationResponses = async (
  evaluationId: string,
  payload: CreateSupplierEvaluationResponsesPayload,
): Promise<SupplierEvaluationResponseCreateResult> => {
  const response = await api.post<SingleResponse<SupplierEvaluationResponseCreateResult>>(
    `/supplier-evaluations/${evaluationId}/responses`,
    payload,
  );
  return mapSupplierEvaluationResponseCreateResult(parseSingleResponse(response.data));
};

export const getSupplierEvaluationRequirements = async (
  evaluationId: string,
): Promise<EvaluationRequirementItemRecord[]> => {
  const response = await api.get<ListResponse<EvaluationRequirementItemRecord>>(
    `/supplier-evaluations/${evaluationId}/requirements`,
  );
  return parseListResponse(response.data).map(mapEvaluationRequirementItemRecord);
};

export const seedSupplierEvaluationRequirements = async (
  evaluationId: string,
  payload: SeedEvaluationRequirementsPayload,
): Promise<EvaluationRequirementSeedResultRecord> => {
  const response = await api.post<SingleResponse<EvaluationRequirementSeedResultRecord>>(
    `/supplier-evaluations/${evaluationId}/requirements/seed`,
    payload,
  );
  return mapEvaluationRequirementSeedResultRecord(parseSingleResponse(response.data));
};

export const createEvaluationRequirement = async (
  evaluationId: string,
  payload: CreateEvaluationRequirementPayload,
): Promise<EvaluationRequirementItemRecord> => {
  const response = await api.post<SingleResponse<EvaluationRequirementItemRecord>>(
    `/supplier-evaluations/${evaluationId}/requirements`,
    payload,
  );
  return mapEvaluationRequirementItemRecord(parseSingleResponse(response.data));
};

export const updateEvaluationRequirement = async (
  requirementItemId: string,
  payload: UpdateEvaluationRequirementPayload,
): Promise<EvaluationRequirementItemRecord> => {
  const response = await api.put<SingleResponse<EvaluationRequirementItemRecord>>(
    `/evaluation-requirements/${requirementItemId}`,
    payload,
  );
  return mapEvaluationRequirementItemRecord(parseSingleResponse(response.data));
};

export const deleteEvaluationRequirement = async (requirementItemId: string): Promise<void> => {
  const response = await api.delete<SingleResponse<null>>(`/evaluation-requirements/${requirementItemId}`);
  parseSingleResponse(response.data);
};

export const getSupplierEvaluationResponse = async (
  responseId: string,
): Promise<SupplierEvaluationResponseDetailRecord> => {
  const response = await api.get<SingleResponse<SupplierEvaluationResponseDetailRecord>>(
    `/supplier-responses/${responseId}`,
  );
  return mapSupplierEvaluationResponseDetailRecord(parseSingleResponse(response.data));
};

export const getSupplierResponseRequirements = async (
  responseId: string,
): Promise<SupplierRequirementResponseMatrixRowRecord[]> => {
  const response = await api.get<ListResponse<SupplierRequirementResponseMatrixRowRecord>>(
    `/supplier-responses/${responseId}/requirements`,
  );
  return parseListResponse(response.data).map(mapSupplierRequirementResponseMatrixRowRecord);
};

export const createSupplierRequirementResponse = async (
  responseId: string,
  payload: CreateSupplierRequirementResponsePayload,
): Promise<SupplierRequirementResponseMatrixRowRecord> => {
  const response = await api.post<SingleResponse<SupplierRequirementResponseMatrixRowRecord>>(
    `/supplier-responses/${responseId}/requirements`,
    payload,
  );
  return mapSupplierRequirementResponseMatrixRowRecord(parseSingleResponse(response.data));
};

export const updateSupplierRequirementResponse = async (
  requirementResponseId: string,
  payload: UpdateSupplierRequirementResponsePayload,
): Promise<SupplierRequirementResponseMatrixRowRecord> => {
  const response = await api.put<SingleResponse<SupplierRequirementResponseMatrixRowRecord>>(
    `/supplier-requirement-responses/${requirementResponseId}`,
    payload,
  );
  return mapSupplierRequirementResponseMatrixRowRecord(parseSingleResponse(response.data));
};

export const deleteSupplierRequirementResponse = async (requirementResponseId: string): Promise<void> => {
  const response = await api.delete<SingleResponse<null>>(
    `/supplier-requirement-responses/${requirementResponseId}`,
  );
  parseSingleResponse(response.data);
};

export const bulkSaveSupplierRequirementResponses = async (
  responseId: string,
  payload: BulkSaveSupplierRequirementResponsesPayload,
): Promise<SupplierRequirementResponseMatrixRowRecord[]> => {
  const response = await api.put<SingleResponse<SupplierRequirementResponseMatrixRowRecord[]>>(
    `/supplier-responses/${responseId}/requirements/bulk-save`,
    payload,
  );
  return parseSingleResponse(response.data).map(mapSupplierRequirementResponseMatrixRowRecord);
};

export const updateSupplierEvaluationResponse = async (
  responseId: string,
  payload: UpdateSupplierEvaluationResponsePayload,
): Promise<SupplierEvaluationResponseDetailRecord> => {
  const response = await api.put<SingleResponse<SupplierEvaluationResponseDetailRecord>>(
    `/supplier-responses/${responseId}`,
    payload,
  );
  return mapSupplierEvaluationResponseDetailRecord(parseSingleResponse(response.data));
};

export const submitSupplierEvaluationResponse = async (
  responseId: string,
  payload: SubmitSupplierEvaluationResponsePayload,
): Promise<SupplierEvaluationResponseDetailRecord> => {
  const response = await api.post<SingleResponse<SupplierEvaluationResponseDetailRecord>>(
    `/supplier-responses/${responseId}/submit`,
    payload,
  );
  return mapSupplierEvaluationResponseDetailRecord(parseSingleResponse(response.data));
};

export const getSupplierResponseDocuments = async (
  responseId: string,
): Promise<SupplierResponseDocumentRecord[]> => {
  const response = await api.get<ListResponse<SupplierResponseDocumentRecord>>(
    `/supplier-responses/${responseId}/documents`,
  );
  return parseListResponse(response.data).map(mapSupplierResponseDocumentRecord);
};

export const createSupplierResponseDocument = async (
  responseId: string,
  payload: CreateSupplierResponseDocumentPayload,
): Promise<SupplierResponseDocumentRecord> => {
  const response = await api.post<SingleResponse<SupplierResponseDocumentRecord>>(
    `/supplier-responses/${responseId}/documents`,
    payload,
  );
  return mapSupplierResponseDocumentRecord(parseSingleResponse(response.data));
};

export const deleteSupplierResponseDocument = async (documentId: string): Promise<void> => {
  const response = await api.delete<SingleResponse<null>>(`/supplier-response-documents/${documentId}`);
  parseSingleResponse(response.data);
};
