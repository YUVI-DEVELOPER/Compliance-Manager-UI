import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

type ListResponse<T> = T[] | ApiResponse<T[]>;
type SingleResponse<T> = T | ApiResponse<T>;

export type AuditReviewJobStatus =
  | "CREATED"
  | "EXTRACTING"
  | "EXTRACTED"
  | "PARTIAL_EXTRACTION"
  | "ANALYZING"
  | "ANALYZED"
  | "REPORT_GENERATING"
  | "REPORT_DRAFTED"
  | "FAILED"
  | "CANCELLED";

export type AuditReviewReportStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "CHANGES_REQUESTED"
  | "SUPERSEDED"
  | string;
export type AuditReviewRating = "COMPLIANT" | "MINOR_FINDINGS" | "MAJOR_FINDINGS" | "CRITICAL_RISK" | string;
export type AuditReviewSeverity = "HIGH" | "MEDIUM" | "LOW" | string;
export type AuditReviewScheduleFrequency =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "HALF_YEARLY"
  | "ANNUAL";
export type AuditReviewScheduleRunStatus = "STARTED" | "COMPLETED" | "FAILED" | "SKIPPED";
export type AuditReviewNotificationStatus = "PENDING" | "READY" | "SENT" | "FAILED" | "DISMISSED";
export type AuditReviewNotificationChannel = "IN_APP" | "EMAIL" | "BOTH";
export type AuditReviewNotificationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AuditReviewAiSummaryStatus = "NOT_REQUESTED" | "GENERATING" | "GENERATED" | "FAILED";
export type AuditReviewScope =
  | "LOGIN_ONLY"
  | "DOCUMENT_ONLY"
  | "OBJECT_ONLY"
  | "SYSTEM_ONLY"
  | "DOMAIN_ONLY"
  | "FULL_GXP"
  | "CUSTOM"
  | string;

export interface AuditReviewAuditTypeMetadata {
  code: string;
  label: string;
  description?: string;
  expected_fields?: string[];
}

export interface AuditReviewScopeMetadata {
  code: AuditReviewScope;
  label: string;
  score_label: string;
  audit_trail_types: string[];
}

export interface AuditReviewCheckpointMetadata {
  check_code: string;
  checkpoint_code: string;
  parameter_code: string;
  label: string;
  description?: string;
  sort_order: number;
}

export interface AuditReviewParameterCardMetadata {
  parameter_code: string;
  label: string;
  description?: string;
  check_codes: string[];
  sort_order: number;
}

export interface AuditReviewMetadata {
  supported_audit_trail_types: AuditReviewAuditTypeMetadata[];
  review_scopes: AuditReviewScopeMetadata[];
  full_gxp_audit_trail_types: string[];
  checkpoint_metadata: AuditReviewCheckpointMetadata[];
  checkpoint_applicability_matrix: Record<string, string[]>;
  parameter_card_metadata: AuditReviewParameterCardMetadata[];
  veeva_audit_lookback_days?: number;
  veeva_audit_calendar_boundary_grace_days?: number;
  veeva_audit_extraction_chunk_days?: number;
}

export interface AuditReviewJobListItem {
  job_id: string;
  asset_id: string;
  review_start_dt: string;
  review_end_dt: string;
  audit_trail_type: string;
  review_scope?: AuditReviewScope;
  selected_audit_trail_types?: string[];
  status: AuditReviewJobStatus;
  record_count: number;
  created_dt: string;
  completed_at?: string | null;
}

export interface AuditReviewJobDetail extends AuditReviewJobListItem {
  review_candidate_key?: string | null;
  vault_dns?: string | null;
  veeva_instance_name?: string | null;
  veeva_app_name?: string | null;
  period_basis?: string | null;
  trigger_mode?: string | null;
  input_snapshot_json?: Record<string, unknown>;
  extraction_summary_json?: Record<string, unknown>;
  analysis_summary_json?: Record<string, unknown> | null;
  report_summary_json?: Record<string, unknown> | null;
  error_message?: string | null;
  requested_by?: string | null;
  started_at?: string | null;
  created_by?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  finding_count: number;
  overall_score?: number | null;
  rating?: AuditReviewRating | null;
  latest_report_id?: string | null;
  latest_report_status?: AuditReviewReportStatus | null;
  latest_report_approval_status?: AuditReviewReportStatus | null;
  latest_report_submitted_by?: string | null;
  latest_report_submitted_dt?: string | null;
  latest_report_reviewed_by?: string | null;
  latest_report_reviewed_dt?: string | null;
  score_label?: string | null;
  coverage_by_audit_type?: Record<string, unknown>;
  audit_type_scores?: Array<Record<string, unknown>>;
  checkpoint_scores?: Array<Record<string, unknown>>;
  checklist_applicability?: Array<Record<string, unknown>>;
}

export interface AuditReviewJobCreatePayload {
  review_start_dt: string;
  review_end_dt: string;
  audit_trail_type?: string;
  review_scope?: AuditReviewScope;
  selected_audit_trail_types?: string[];
  veeva_instance_name?: string | null;
  veeva_app_name?: string | null;
  vault_dns?: string | null;
  requested_by?: string | null;
}

export interface AuditReviewSchedule {
  schedule_id: string;
  asset_id: string;
  enabled: boolean;
  vault_dns?: string | null;
  veeva_instance_name?: string | null;
  veeva_app_name?: string | null;
  audit_trail_type: string;
  review_scope?: AuditReviewScope;
  selected_audit_trail_types?: string[];
  frequency: AuditReviewScheduleFrequency;
  review_window_days?: number | null;
  next_run_dt: string;
  schedule_start_dt?: string | null;
  schedule_end_dt?: string | null;
  end_condition?: string | null;
  end_after_runs?: number | null;
  run_time?: string | null;
  day_of_week?: number | null;
  day_of_month?: number | null;
  use_last_day_of_month?: boolean | null;
  cycle_type?: string | null;
  run_timing?: string | null;
  run_month?: number | null;
  custom_cycle_start_month?: number | null;
  fiscal_year_start_month?: number | null;
  audit_retrieval_mode?: string | null;
  custom_audit_start_dt?: string | null;
  custom_audit_end_dt?: string | null;
  last_run_dt?: string | null;
  last_job_id?: string | null;
  timezone: string;
  business_start_hour?: number | null;
  business_end_hour?: number | null;
  created_by?: string | null;
  created_dt: string;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export interface AuditReviewSchedulePayload {
  enabled?: boolean;
  audit_trail_type?: string;
  review_scope?: AuditReviewScope;
  selected_audit_trail_types?: string[];
  veeva_instance_name?: string | null;
  veeva_app_name?: string | null;
  vault_dns?: string | null;
  frequency?: AuditReviewScheduleFrequency;
  review_window_days?: number | null;
  next_run_dt?: string | null;
  schedule_start_dt?: string | null;
  schedule_end_dt?: string | null;
  end_condition?: string | null;
  end_after_runs?: number | null;
  run_time?: string | null;
  day_of_week?: number | null;
  day_of_month?: number | null;
  use_last_day_of_month?: boolean | null;
  cycle_type?: string | null;
  run_timing?: string | null;
  run_month?: number | null;
  custom_cycle_start_month?: number | null;
  fiscal_year_start_month?: number | null;
  audit_retrieval_mode?: string | null;
  custom_audit_start_dt?: string | null;
  custom_audit_end_dt?: string | null;
  timezone?: string;
  created_by?: string | null;
  modified_by?: string | null;
}

export interface AuditReviewScheduleRun {
  run_id: string;
  schedule_id: string;
  asset_id: string;
  job_id?: string | null;
  status: AuditReviewScheduleRunStatus;
  started_at: string;
  completed_at?: string | null;
  message?: string | null;
  error_message?: string | null;
  run_summary_json: Record<string, unknown>;
}

export interface AuditReviewScheduleRunNowResponse {
  schedule: AuditReviewSchedule;
  run: AuditReviewScheduleRun;
  job?: AuditReviewJobDetail | null;
  report?: AuditReviewReportGenerateResponse | null;
}

export interface AuditReviewSchedulerRunDueResponse {
  processed_count: number;
  completed_count: number;
  failed_count: number;
  skipped_count: number;
  runs: AuditReviewScheduleRun[];
}

export interface AuditReviewJobCreateResponse {
  job_id: string;
  asset_id: string;
  status: AuditReviewJobStatus;
  review_scope?: AuditReviewScope;
  selected_audit_trail_types?: string[];
}

export interface AuditReviewExtractResponse {
  job_id: string;
  asset_id: string;
  status: AuditReviewJobStatus;
  record_count: number;
  extraction_summary_json: Record<string, unknown>;
  coverage_by_audit_type?: Record<string, unknown>;
}

export interface AuditReviewAnalyzePayload {
  business_timezone?: string;
  business_start_hour?: number;
  business_end_hour?: number;
}

export interface AuditReviewAnalyzeResponse {
  job_id: string;
  asset_id: string;
  status: AuditReviewJobStatus;
  overall_score: number;
  rating: AuditReviewRating;
  score_label?: string | null;
  total_records_analyzed: number;
  total_findings: number;
  finding_counts_by_severity: Record<string, number>;
  score_breakdown: Array<Record<string, unknown>>;
  audit_type_scores?: Array<Record<string, unknown>>;
  checkpoint_scores?: Array<Record<string, unknown>>;
  checklist_applicability?: Array<Record<string, unknown>>;
}

export interface AuditReviewFinding {
  finding_id: string;
  job_id: string;
  asset_id: string;
  primary_record_id?: string | null;
  check_code: string;
  check_name: string;
  audit_trail_type?: string | null;
  parameter_code?: string | null;
  checkpoint_code?: string | null;
  finding_type?: string | null;
  severity?: AuditReviewSeverity | null;
  status: string;
  score_impact: number;
  finding_title?: string | null;
  finding_summary?: string | null;
  title?: string | null;
  description?: string | null;
  evidence_json?: Record<string, unknown>;
  source_record_count: number;
  created_dt: string;
}

export interface AuditReviewScore {
  score_id: string;
  job_id: string;
  asset_id: string;
  check_code: string;
  check_name: string;
  score_scope: string;
  audit_trail_type: string;
  score_label?: string | null;
  applicability?: string | null;
  evaluated_record_count: number;
  skipped_record_count: number;
  no_data_count: number;
  overall_score?: number | null;
  rating?: AuditReviewRating | null;
  score_status: string;
  source_record_count: number;
  finding_count: number;
  penalty_per_finding: number;
  penalty_cap: number;
  raw_penalty: number;
  applied_penalty: number;
  sort_order: number;
  scoring_summary_json: Record<string, unknown>;
  created_dt: string;
}

export interface AuditTrailRecord {
  record_id: string;
  job_id: string;
  asset_id: string;
  source_record_key?: string | null;
  audit_trail_type: string;
  event_timestamp?: string | null;
  event_timezone?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  raw_action?: string | null;
  action_type?: string | null;
  detected_action_category?: string | null;
  display_action?: string | null;
  object_type?: string | null;
  object_name?: string | null;
  object_id?: string | null;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  event_status?: string | null;
  reason?: string | null;
  change_control_id?: string | null;
  ip_address?: string | null;
  session_id?: string | null;
  auth_method?: string | null;
  failure_reason?: string | null;
  is_delete_action: boolean;
  is_permission_change: boolean;
  is_export_action: boolean;
  is_configuration_change: boolean;
  record_quality_status: string;
  created_dt: string;
  raw_payload_json?: Record<string, unknown> | null;
  normalized_extra_json?: Record<string, unknown> | null;
}

export interface AuditReviewReportGenerateResponse {
  report_id: string;
  job_id: string;
  asset_id: string;
  status: AuditReviewReportStatus;
  overall_score: number;
  rating: AuditReviewRating;
  report_summary: Record<string, unknown>;
  review_type?: string | null;
  trigger_source?: string | null;
  schedule_id?: string | null;
  schedule_run_id?: string | null;
  workflow_metadata_json?: Record<string, unknown> | null;
  workflow_metadata?: Record<string, unknown>;
  submitted_by?: string | null;
  submitted_dt?: string | null;
  reviewed_by?: string | null;
  reviewed_dt?: string | null;
  reviewer_comments?: string | null;
  approval_decision_json?: Record<string, unknown> | null;
  is_e_signed?: boolean | null;
  e_signed_at?: string | null;
  e_signed_by_user_id?: string | null;
  is_locked?: boolean | null;
  locked_at?: string | null;
  locked_by_user_id?: string | null;
  final_pdf_path?: string | null;
  final_pdf_hash?: string | null;
  report_version?: string | null;
}

export interface AuditReviewReportListItem {
  report_id: string;
  job_id: string;
  asset_id: string;
  status: AuditReviewReportStatus;
  overall_score?: number | null;
  rating?: AuditReviewRating | null;
  report_summary: Record<string, unknown>;
  review_type?: string | null;
  trigger_source?: string | null;
  schedule_id?: string | null;
  schedule_run_id?: string | null;
  workflow_metadata_json?: Record<string, unknown> | null;
  workflow_metadata?: Record<string, unknown>;
  submitted_by?: string | null;
  submitted_dt?: string | null;
  reviewed_by?: string | null;
  reviewed_dt?: string | null;
  reviewer_comments?: string | null;
  approval_decision_json?: Record<string, unknown> | null;
  is_e_signed?: boolean | null;
  e_signed_at?: string | null;
  e_signed_by_user_id?: string | null;
  is_locked?: boolean | null;
  locked_at?: string | null;
  locked_by_user_id?: string | null;
  final_pdf_path?: string | null;
  final_pdf_hash?: string | null;
  report_version?: string | null;
  created_dt: string;
  modified_dt?: string | null;
}

export interface AuditReviewReportDetail extends AuditReviewReportListItem {
  report_json: Record<string, unknown>;
  report_markdown: string;
}

export interface AuditReviewAiCapaRecommendation {
  title: string;
  description: string;
  suggested_owner: string;
  suggested_due_days: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
}

export interface AuditReviewAiSummaryJson {
  executive_summary?: string;
  risk_statement?: string;
  key_observations?: string[];
  capa_recommendations?: AuditReviewAiCapaRecommendation[];
  stakeholder_summary?: string;
  reviewer_notes_suggestion?: string;
  limitations?: string[];
}

export interface AuditReviewAiSummaryGeneratePayload {
  requested_by?: string | null;
  summary_style?: "executive" | "reviewer" | "stakeholder" | "technical" | "brief" | string;
  include_capa_recommendations?: boolean;
}

export interface AuditReviewAiSummaryResponse {
  report_id: string;
  job_id: string;
  asset_id: string;
  report_status: AuditReviewReportStatus;
  status: AuditReviewAiSummaryStatus | string;
  ai_configured: boolean;
  requested_by?: string | null;
  generated_by?: string | null;
  generated_dt?: string | null;
  model_name?: string | null;
  summary_style?: string | null;
  include_capa_recommendations?: boolean | null;
  overall_score?: number | null;
  rating?: AuditReviewRating | null;
  ai_summary_json?: AuditReviewAiSummaryJson | null;
  ai_summary_markdown?: string | null;
  error_message?: string | null;
}

export interface AuditReviewReportSubmitReviewPayload {
  submission_notes?: string | null;
}

export interface AuditReviewReportESignaturePayload {
  user_email: string;
  current_password: string;
  signature_meaning: string;
  confirmed: boolean;
}

export interface AuditReviewReportReviewDecisionPayload {
  reviewer_comments: string;
  e_signature?: AuditReviewReportESignaturePayload;
}

export interface AuditReviewReportPdfDownload {
  blob: Blob;
  fileName: string;
}

export interface AuditReviewNotification {
  notification_id: string;
  report_id: string;
  job_id: string;
  asset_id: string;
  notification_type: string;
  priority: AuditReviewNotificationPriority | string;
  rating: AuditReviewRating;
  recipient_role: string;
  recipient_email?: string | null;
  subject: string;
  message: string;
  status: AuditReviewNotificationStatus | string;
  delivery_channel: AuditReviewNotificationChannel | string;
  created_by?: string | null;
  created_dt: string;
  sent_dt?: string | null;
  error_message?: string | null;
  metadata_json: Record<string, unknown>;
}

export interface PrepareNotificationsPayload {
  requested_by?: string | null;
  regenerate?: boolean;
  delivery_channel?: AuditReviewNotificationChannel | string;
}

export interface SendNotificationPayload {
  sent_by?: string | null;
}

export interface DismissNotificationPayload {
  dismissed_by?: string | null;
  reason: string;
}

export interface SendAuditReviewNotificationResponse {
  notification: AuditReviewNotification;
  sent: boolean;
  failed: boolean;
  skipped: boolean;
  message: string;
}

export interface SendAuditReviewReportNotificationsResponse {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  notifications: AuditReviewNotification[];
  message?: string | null;
}

const parseContentDispositionFileName = (value?: string): string | null => {
  if (!value) return null;
  const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/"/g, ""));

  const fileNameMatch = value.match(/filename="?([^"]+)"?/i);
  return fileNameMatch?.[1] ?? null;
};

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

export const listAuditReviewJobs = async (assetId: string): Promise<AuditReviewJobListItem[]> => {
  const response = await api.get<ListResponse<AuditReviewJobListItem>>(`/asset/${assetId}/audit-review-jobs`);
  return parseListResponse(response.data);
};

export const getAuditReviewMetadata = async (): Promise<AuditReviewMetadata> => {
  const response = await api.get<SingleResponse<AuditReviewMetadata>>("/api/audit-reviews/metadata");
  return parseSingleResponse(response.data);
};

export const getAssetAuditReviewSchedules = async (assetId: string): Promise<AuditReviewSchedule[]> => {
  const response = await api.get<ListResponse<AuditReviewSchedule>>(
    `/asset/${assetId}/audit-review-schedules`,
  );
  return parseListResponse(response.data);
};

export const createAssetAuditReviewSchedule = async (
  assetId: string,
  payload: AuditReviewSchedulePayload,
): Promise<AuditReviewSchedule> => {
  const response = await api.post<SingleResponse<AuditReviewSchedule>>(
    `/asset/${assetId}/audit-review-schedules`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const updateAuditReviewSchedule = async (
  scheduleId: string,
  payload: AuditReviewSchedulePayload,
): Promise<AuditReviewSchedule> => {
  const response = await api.patch<SingleResponse<AuditReviewSchedule>>(
    `/audit-review-schedules/${scheduleId}`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const runAuditReviewScheduleNow = async (
  scheduleId: string,
): Promise<AuditReviewScheduleRunNowResponse> => {
  const response = await api.post<SingleResponse<AuditReviewScheduleRunNowResponse>>(
    `/audit-review-schedules/${scheduleId}/run-now`,
  );
  return parseSingleResponse(response.data);
};

export const runDueAuditReviewSchedules = async (): Promise<AuditReviewSchedulerRunDueResponse> => {
  const response = await api.post<SingleResponse<AuditReviewSchedulerRunDueResponse>>(
    "/audit-review-scheduler/run-due",
  );
  return parseSingleResponse(response.data);
};

export const getAuditReviewScheduleRuns = async (
  scheduleId: string,
): Promise<AuditReviewScheduleRun[]> => {
  const response = await api.get<ListResponse<AuditReviewScheduleRun>>(
    `/audit-review-schedules/${scheduleId}/runs`,
  );
  return parseListResponse(response.data);
};

export const createAuditReviewJob = async (
  assetId: string,
  payload: AuditReviewJobCreatePayload,
): Promise<AuditReviewJobCreateResponse> => {
  const response = await api.post<SingleResponse<AuditReviewJobCreateResponse>>(
    `/asset/${assetId}/audit-review-jobs`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const getAuditReviewJob = async (jobId: string): Promise<AuditReviewJobDetail> => {
  const response = await api.get<SingleResponse<AuditReviewJobDetail>>(`/audit-review-jobs/${jobId}`);
  return parseSingleResponse(response.data);
};

export const extractAuditReviewJob = async (jobId: string): Promise<AuditReviewExtractResponse> => {
  const response = await api.post<SingleResponse<AuditReviewExtractResponse>>(
    `/audit-review-jobs/${jobId}/extract`,
  );
  return parseSingleResponse(response.data);
};

export const analyzeAuditReviewJob = async (
  jobId: string,
  payload: AuditReviewAnalyzePayload = {},
): Promise<AuditReviewAnalyzeResponse> => {
  const response = await api.post<SingleResponse<AuditReviewAnalyzeResponse>>(
    `/audit-review-jobs/${jobId}/analyze`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const generateAuditReviewReport = async (
  jobId: string,
): Promise<AuditReviewReportGenerateResponse> => {
  const response = await api.post<SingleResponse<AuditReviewReportGenerateResponse>>(
    `/audit-review-jobs/${jobId}/generate-report`,
  );
  return parseSingleResponse(response.data);
};

export const getAuditReviewFindings = async (
  jobId: string,
  filters: { audit_trail_type?: string; check_code?: string; severity?: string; limit?: number } = {},
): Promise<AuditReviewFinding[]> => {
  const response = await api.get<ListResponse<AuditReviewFinding>>(
    `/audit-review-jobs/${jobId}/findings`,
    { params: { limit: filters.limit ?? 500, ...filters } },
  );
  return parseListResponse(response.data);
};

export const getAuditReviewScores = async (jobId: string): Promise<AuditReviewScore[]> => {
  const response = await api.get<ListResponse<AuditReviewScore>>(`/audit-review-jobs/${jobId}/scores`);
  return parseListResponse(response.data);
};

export const getAuditReviewRecords = async (
  jobId: string,
  includeRaw = false,
  auditTrailType?: string,
): Promise<AuditTrailRecord[]> => {
  const response = await api.get<ListResponse<AuditTrailRecord>>(
    `/audit-review-jobs/${jobId}/records`,
    { params: { include_raw: includeRaw, audit_trail_type: auditTrailType } },
  );
  return parseListResponse(response.data);
};

export const getAuditReviewReport = async (reportId: string): Promise<AuditReviewReportDetail> => {
  const response = await api.get<SingleResponse<AuditReviewReportDetail>>(
    `/audit-review-reports/${reportId}`,
  );
  return parseSingleResponse(response.data);
};

export const generateAuditReviewAiSummary = async (
  reportId: string,
  payload: AuditReviewAiSummaryGeneratePayload,
): Promise<AuditReviewAiSummaryResponse> => {
  const response = await api.post<SingleResponse<AuditReviewAiSummaryResponse>>(
    `/audit-review-reports/${reportId}/generate-ai-summary`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const getAuditReviewAiSummary = async (
  reportId: string,
): Promise<AuditReviewAiSummaryResponse> => {
  const response = await api.get<SingleResponse<AuditReviewAiSummaryResponse>>(
    `/audit-review-reports/${reportId}/ai-summary`,
  );
  return parseSingleResponse(response.data);
};

export const clearAuditReviewAiSummary = async (
  reportId: string,
): Promise<AuditReviewAiSummaryResponse> => {
  const response = await api.delete<SingleResponse<AuditReviewAiSummaryResponse>>(
    `/audit-review-reports/${reportId}/ai-summary`,
  );
  return parseSingleResponse(response.data);
};

export const submitAuditReviewReport = async (
  reportId: string,
  payload: AuditReviewReportSubmitReviewPayload,
): Promise<AuditReviewReportListItem> => {
  const response = await api.post<SingleResponse<AuditReviewReportListItem>>(
    `/audit-review-reports/${reportId}/submit-review`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const approveAuditReviewReport = async (
  reportId: string,
  payload: AuditReviewReportReviewDecisionPayload,
): Promise<AuditReviewReportListItem> => {
  const response = await api.post<SingleResponse<AuditReviewReportListItem>>(
    `/audit-review-reports/${reportId}/approve`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const rejectAuditReviewReport = async (
  reportId: string,
  payload: AuditReviewReportReviewDecisionPayload,
): Promise<AuditReviewReportListItem> => {
  const response = await api.post<SingleResponse<AuditReviewReportListItem>>(
    `/audit-review-reports/${reportId}/reject`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const requestChangesAuditReviewReport = async (
  reportId: string,
  payload: AuditReviewReportReviewDecisionPayload,
): Promise<AuditReviewReportListItem> => {
  const response = await api.post<SingleResponse<AuditReviewReportListItem>>(
    `/audit-review-reports/${reportId}/request-changes`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const downloadAuditReviewReportPdf = async (
  reportId: string,
): Promise<AuditReviewReportPdfDownload> => {
  const response = await api.get<Blob>(
    `/audit-review-reports/${reportId}/download-pdf`,
    { responseType: "blob" },
  );
  const contentDisposition = response.headers["content-disposition"] as string | undefined;
  return {
    blob: response.data,
    fileName: parseContentDispositionFileName(contentDisposition) ?? `audit-trail-review-${reportId}.pdf`,
  };
};

export const getAuditReviewReportHtmlPreview = async (
  reportId: string,
): Promise<string> => {
  const response = await api.get<string>(
    `/audit-review-reports/${reportId}/preview-html`,
    {
      headers: { Accept: "text/html" },
      responseType: "text",
    },
  );
  return response.data;
};

export const listAssetAuditReviewReports = async (
  assetId: string,
): Promise<AuditReviewReportListItem[]> => {
  const response = await api.get<ListResponse<AuditReviewReportListItem>>(
    `/asset/${assetId}/audit-review-reports`,
  );
  return parseListResponse(response.data);
};

export const prepareAuditReviewNotifications = async (
  reportId: string,
  payload: PrepareNotificationsPayload,
): Promise<AuditReviewNotification[]> => {
  const response = await api.post<ListResponse<AuditReviewNotification>>(
    `/audit-review-reports/${reportId}/prepare-notifications`,
    payload,
  );
  return parseListResponse(response.data);
};

export const sendAuditReviewNotification = async (
  notificationId: string,
  payload: SendNotificationPayload,
): Promise<SendAuditReviewNotificationResponse> => {
  const response = await api.post<SingleResponse<SendAuditReviewNotificationResponse>>(
    `/audit-review-notifications/${notificationId}/send`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const sendAuditReviewReportNotifications = async (
  reportId: string,
  payload: SendNotificationPayload,
): Promise<SendAuditReviewReportNotificationsResponse> => {
  const response = await api.post<SingleResponse<SendAuditReviewReportNotificationsResponse>>(
    `/audit-review-reports/${reportId}/send-notifications`,
    payload,
  );
  return parseSingleResponse(response.data);
};

export const listAuditReviewReportNotifications = async (
  reportId: string,
): Promise<AuditReviewNotification[]> => {
  const response = await api.get<ListResponse<AuditReviewNotification>>(
    `/audit-review-reports/${reportId}/notifications`,
  );
  return parseListResponse(response.data);
};

export const listAssetAuditReviewNotifications = async (
  assetId: string,
  filters: { status?: string; priority?: string; limit?: number } = {},
): Promise<AuditReviewNotification[]> => {
  const response = await api.get<ListResponse<AuditReviewNotification>>(
    `/asset/${assetId}/audit-review-notifications`,
    { params: filters },
  );
  return parseListResponse(response.data);
};

export const dismissAuditReviewNotification = async (
  notificationId: string,
  payload: DismissNotificationPayload,
): Promise<AuditReviewNotification> => {
  const response = await api.post<SingleResponse<AuditReviewNotification>>(
    `/audit-review-notifications/${notificationId}/dismiss`,
    payload,
  );
  return parseSingleResponse(response.data);
};
