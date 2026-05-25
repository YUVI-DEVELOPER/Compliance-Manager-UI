import { api } from "./api";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface ReleaseRecord {
  release_id: string;
  asset_id: string;
  version: string;
  release_name?: string | null;
  previous_version?: string | null;
  release_type?: string | null;
  vendor_name?: string | null;
  planned_implementation_date?: string | null;
  environment?: string | null;
  release_description?: string | null;
  business_reason?: string | null;
  change_control_no?: string | null;
  expected_validated_functionality_impact?: string | null;
  release_status?: string | null;
  system_config_report?: string | null;
  documentation_mode?: string | null;
  documentation_text?: string | null;
  documentation_source_url?: string | null;
  documentation_fetched_at?: string | null;
  created_dt?: string | null;
  end_dt?: string | null;
  created_by?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
  asset_name?: string | null;
  asset_type?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  supplier_name?: string | null;
  validation_package?: ValidationPackageSummary | null;
  nextStep?: string | null;
}

export interface ValidationPackageSummary {
  package_id?: string | null;
  release_id?: string | null;
  package_no?: string | null;
  package_status?: string | null;
  validation_scope?: string | null;
  risk_level?: string | null;
  impact_assessment_status?: string | null;
  document_checklist_status?: string | null;
  testing_status?: string | null;
  approval_status?: string | null;
  final_decision?: string | null;
  created_by?: string | null;
  created_dt?: string | null;
  modified_by?: string | null;
  modified_dt?: string | null;
}

export type CreateReleasePayload = {
  release_name: string;
  previous_version: string;
  version: string;
  release_type: string;
  planned_implementation_date: string;
  environment: string;
  release_description: string;
  business_reason: string;
  expected_validated_functionality_impact: string;
  created_by: string;
  documentation_mode: string;
  vendor_name?: string | null;
  system_config_report?: string | null;
  documentation_text?: string | null;
  documentation_source_url?: string | null;
  change_control_no?: string | null;
  end_dt?: string | null;
};

export type UpdateReleasePayload = {
  modified_by: string;
  release_name?: string;
  previous_version?: string;
  version?: string;
  release_type?: string;
  vendor_name?: string | null;
  planned_implementation_date?: string;
  environment?: string;
  release_description?: string;
  business_reason?: string;
  change_control_no?: string | null;
  expected_validated_functionality_impact?: string;
  release_status?: string;
  documentation_mode?: string;
  system_config_report?: string | null;
  documentation_text?: string | null;
  documentation_source_url?: string | null;
  end_dt?: string | null;
};

export interface ReleaseImpactAssessmentRecord {
  assessment_id: string;
  release_id: string;
  previous_release_id?: string | null;
  report_title: string;
  report_content: string;
  report_format: string;
  diff_summary?: Record<string, unknown> | null;
  impact_level?: string | null;
  generated_dt?: string | null;
  created_by?: string | null;
}

export type ImpactAnswer = "YES" | "NO" | "NOT_APPLICABLE" | "UNKNOWN";

export interface ImpactQuestion {
  questionCode: string;
  category: string;
  questionText: string;
  weight: number;
  critical: boolean;
  mandatory: boolean;
}

export interface ImpactResponse {
  responseId?: string | null;
  assessmentId?: string | null;
  questionCode: string;
  category?: string | null;
  questionText?: string | null;
  answer?: ImpactAnswer | null;
  weight?: number | null;
  critical?: boolean | null;
  mandatory?: boolean | null;
  score?: number | null;
  rationale?: string | null;
  evidenceReference?: string | null;
  answeredBy?: string | null;
  answeredAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ImpactValidationError {
  questionCode: string;
  field: string;
  message: string;
}

export interface ImpactAssessment {
  assessmentId: string;
  releaseId: string;
  validationPackageId: string;
  assessmentNo: string;
  packageNo: string;
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "REOPENED" | "SUPERSEDED";
  totalScore: number;
  riskLevel: string;
  validationScope: string;
  summary?: string | null;
  packageStatus?: string | null;
  releaseStatus?: string | null;
  impactAssessmentStatus?: string | null;
  nextStep?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
  completedBy?: string | null;
  completedAt?: string | null;
  reopenedBy?: string | null;
  reopenedAt?: string | null;
  reopenReason?: string | null;
  questions?: ImpactQuestion[];
  responses: ImpactResponse[];
  missingAnswers?: string[];
  validationErrors?: ImpactValidationError[];
  aiAssistantEnabled?: boolean;
  canReopen?: boolean;
}

export interface ImpactAssessmentSaveResult {
  assessmentId: string;
  releaseId: string;
  validationPackageId: string;
  assessmentNo: string;
  status: string;
  totalScore: number;
  riskLevel: string;
  validationScope: string;
  summary?: string | null;
  packageStatus?: string | null;
  releaseStatus?: string | null;
  impactAssessmentStatus?: string | null;
  nextStep?: string | null;
  responses: ImpactResponse[];
  missingAnswers?: string[];
  validationErrors?: ImpactValidationError[];
}

export interface ImpactAssessmentCompleteResult {
  assessmentId: string;
  releaseId: string;
  validationPackageId: string;
  status: "COMPLETED";
  totalScore: number;
  riskLevel: string;
  validationScope: string;
  releaseStatus: string;
  packageStatus: string;
  nextStep: "DOCUMENT_CHECKLIST";
  summary: string;
}

export interface ImpactAssessmentAISuggestion {
  questionCode: string;
  suggestedAnswer: ImpactAnswer;
  suggestedRationale?: string | null;
  confidence: "LOW" | "MEDIUM" | "HIGH";
  evidenceReference?: string | null;
  caveat?: string | null;
  sourceFieldsUsed: string[];
}

export interface ImpactAssessmentAISuggestResponse {
  aiEnabled: boolean;
  assessmentId?: string | null;
  releaseId: string;
  validationPackageId: string;
  modelName?: string | null;
  provider?: string | null;
  promptVersion: string;
  suggestions: ImpactAssessmentAISuggestion[];
  message?: string | null;
}

export interface DocumentRequirementRow {
  requirement_id: string;
  release_id: string;
  package_id: string;
  document_code: string;
  document_name: string;
  document_category: string;
  document_description?: string | null;
  requirement_level: string;
  required_flag: boolean;
  waivable_flag: boolean;
  waiver_requires_qa_flag: boolean;
  status: string;
  owner_role?: string | null;
  owner_user_id?: string | null;
  source_type?: string | null;
  linked_document_link_id?: string | null;
  linked_authored_document_id?: string | null;
  linked_qualification_document_id?: string | null;
  file_name?: string | null;
  file_path?: string | null;
  external_url?: string | null;
  waiver_reason?: string | null;
  waiver_requested_by?: string | null;
  waiver_requested_at?: string | null;
  waiver_approved_by?: string | null;
  waiver_approved_at?: string | null;
  trigger_scope?: string | null;
  trigger_risk_level?: string | null;
  trigger_question_codes_json?: string[] | null;
  trigger_reason?: string | null;
  generated_version: number;
  is_active: boolean;
  display_order: number;
  available_actions: string[];
}

export interface DocumentRequirementSummary {
  total: number;
  required: number;
  conditional: number;
  optional: number;
  approved: number;
  missing: number;
  in_review: number;
  rejected: number;
  waived: number;
  not_required: number;
  obsolete: number;
  blocking_count: number;
  can_complete: boolean;
}

export interface DocumentRequirementGenerateResponse {
  release_id: string;
  validation_package_id: string;
  package_no: string;
  release_status?: string | null;
  package_status: string;
  validation_scope: string;
  risk_level: string;
  document_checklist_status: string;
  summary: DocumentRequirementSummary;
  requirements: DocumentRequirementRow[];
  nextStep: "DOCUMENT_CHECKLIST" | "TEST_EXECUTION" | "VALIDATION_SUMMARY" | string;
  blocking_requirements?: DocumentRequirementRow[];
}

export type DocumentRequirementLinkPayload = {
  source_type?: string | null;
  linked_document_link_id?: string | null;
  linked_authored_document_id?: string | null;
  linked_qualification_document_id?: string | null;
  file_name?: string | null;
  file_path?: string | null;
  external_url?: string | null;
  status?: string | null;
};

export type DocumentRequirementStatusPayload = {
  status: string;
};

export type DocumentRequirementWaiverPayload = {
  waiver_reason: string;
  approve?: boolean;
};

export interface CreateReleaseResult {
  release: ReleaseRecord;
  validation_package: ValidationPackageSummary | null;
  nextStep?: string | null;
}

const parseContentDispositionFilename = (header?: string): string | null => {
  if (!header) return null;

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }

  const quotedMatch = header.match(/filename="([^"]+)"/i);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const plainMatch = header.match(/filename=([^;]+)/i);
  if (plainMatch?.[1]) {
    return plainMatch[1].trim();
  }

  return null;
};

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

interface ReleaseApiRecord extends Omit<ReleaseRecord, "version"> {
  version?: string | null;
}

interface CreateReleaseApiResult {
  release?: ReleaseApiRecord | null;
  validation_package?: ValidationPackageSummary | null;
  nextStep?: string | null;
}

const parseResponse = <T>(payload: ApiResponse<T>): T => {
  if (!payload.success) {
    throw new Error(payload.message || "Request failed");
  }
  return payload.data;
};

const mapReleaseRecord = (record: ReleaseApiRecord): ReleaseRecord => ({
  ...record,
  version: record.version ?? "",
  documentation_mode: record.documentation_mode ?? "MANUAL",
  validation_package: record.validation_package ?? null,
});

const normalizeCreateReleaseResult = (data: ReleaseApiRecord | CreateReleaseApiResult): CreateReleaseResult => {
  if ("release" in data && data.release) {
    const validationPackage = data.validation_package ?? data.release.validation_package ?? null;
    const release = mapReleaseRecord({
      ...data.release,
      validation_package: validationPackage,
      nextStep: data.nextStep ?? data.release.nextStep ?? null,
    });
    return {
      release,
      validation_package: validationPackage,
      nextStep: data.nextStep ?? release.nextStep ?? null,
    };
  }

  const release = mapReleaseRecord(data as ReleaseApiRecord);
  return {
    release,
    validation_package: release.validation_package ?? null,
    nextStep: release.nextStep ?? null,
  };
};

export const getReleasesByAssetId = async (assetId: string): Promise<ReleaseRecord[]> => {
  const response = await api.get<ApiResponse<ReleaseApiRecord[]>>(`/asset/${assetId}/releases`);
  return (parseResponse(response.data) ?? []).map(mapReleaseRecord);
};

export const createRelease = async (
  assetId: string,
  payload: CreateReleasePayload,
): Promise<CreateReleaseResult> => {
  const response = await api.post<ApiResponse<ReleaseApiRecord | CreateReleaseApiResult>>(
    `/asset/${assetId}/releases`,
    payload,
  );
  return normalizeCreateReleaseResult(parseResponse(response.data));
};

export const getReleaseById = async (releaseId: string): Promise<ReleaseRecord> => {
  const response = await api.get<ApiResponse<ReleaseApiRecord>>(`/release/${releaseId}`);
  return mapReleaseRecord(parseResponse(response.data));
};

export const updateRelease = async (
  releaseId: string,
  payload: UpdateReleasePayload,
): Promise<ReleaseRecord> => {
  const response = await api.put<ApiResponse<ReleaseApiRecord>>(`/release/${releaseId}`, payload);
  return mapReleaseRecord(parseResponse(response.data));
};

export const deleteRelease = async (releaseId: string): Promise<null> => {
  const response = await api.delete<ApiResponse<null>>(`/release/${releaseId}`);
  return parseResponse(response.data);
};

export const getValidationPackage = async (releaseId: string): Promise<ValidationPackageSummary> => {
  const response = await api.get<ApiResponse<ValidationPackageSummary>>(
    `/release/${releaseId}/validation-package`,
  );
  return parseResponse(response.data);
};

export const getReleaseImpactReport = async (releaseId: string): Promise<ReleaseImpactAssessmentRecord> => {
  const response = await api.get<ApiResponse<ReleaseImpactAssessmentRecord>>(
    `/release/${releaseId}/impact-assessment/report`,
  );
  return parseResponse(response.data);
};

export const regenerateImpactAssessment = async (
  releaseId: string,
): Promise<ReleaseImpactAssessmentRecord> => {
  const response = await api.post<ApiResponse<ReleaseImpactAssessmentRecord>>(
    `/release/${releaseId}/impact-assessment/regenerate`,
  );
  return parseResponse(response.data);
};

export const downloadImpactAssessment = async (releaseId: string): Promise<string> => {
  try {
    const response = await api.get<Blob>(`/release/${releaseId}/impact-assessment/download`, {
      responseType: "blob",
    });
    const contentType = response.headers["content-type"] || "text/markdown";
    const fileName =
      parseContentDispositionFilename(response.headers["content-disposition"]) ||
      `release-${releaseId}-impact-assessment.md`;
    const blob = response.data instanceof Blob ? response.data : new Blob([response.data], { type: contentType });

    triggerBlobDownload(blob, fileName);
    return fileName;
  } catch (error) {
    if (typeof error === "object" && error !== null && "isAxiosError" in error) {
      const axiosError = error as {
        response?: {
          data?: Blob;
          headers?: Record<string, string>;
        };
      };
      const blob = axiosError.response?.data;
      const contentType = axiosError.response?.headers?.["content-type"] || "";

      if (blob instanceof Blob && contentType.includes("json")) {
        try {
          const text = await blob.text();
          const parsed = JSON.parse(text) as object;
          (axiosError.response as { data?: unknown }).data = parsed;
        } catch {
          // Fall through and rethrow the original Axios error.
        }
      }
    }

    throw error;
  }
};

export const getImpactAssessmentQuestions = async (releaseId: string): Promise<ImpactQuestion[]> => {
  const response = await api.get<ApiResponse<ImpactQuestion[]>>(
    `/release/${releaseId}/impact-assessment/questions`,
  );
  return parseResponse(response.data) ?? [];
};

export const getImpactAssessment = async (releaseId: string): Promise<ImpactAssessment | null> => {
  const response = await api.get<ApiResponse<ImpactAssessment | null>>(
    `/release/${releaseId}/impact-assessment`,
  );
  return parseResponse(response.data);
};

export const initializeImpactAssessment = async (releaseId: string): Promise<ImpactAssessment> => {
  const response = await api.post<ApiResponse<ImpactAssessment>>(
    `/release/${releaseId}/impact-assessment`,
  );
  return parseResponse(response.data);
};

export const saveImpactAssessmentResponses = async (
  assessmentId: string,
  responses: Array<{
    questionCode: string;
    answer: ImpactAnswer;
    rationale?: string | null;
    evidenceReference?: string | null;
  }>,
): Promise<ImpactAssessmentSaveResult> => {
  const response = await api.put<ApiResponse<ImpactAssessmentSaveResult>>(
    `/impact-assessments/${assessmentId}/responses`,
    { responses },
  );
  return parseResponse(response.data);
};

export const completeImpactAssessment = async (
  assessmentId: string,
): Promise<ImpactAssessmentCompleteResult> => {
  const response = await api.post<ApiResponse<ImpactAssessmentCompleteResult>>(
    `/impact-assessments/${assessmentId}/complete`,
  );
  return parseResponse(response.data);
};

export const reopenImpactAssessment = async (
  assessmentId: string,
  reason: string,
): Promise<ImpactAssessment> => {
  const response = await api.post<ApiResponse<ImpactAssessment>>(
    `/impact-assessments/${assessmentId}/reopen`,
    { reason },
  );
  return parseResponse(response.data);
};

export const suggestImpactAssessmentAnswers = async (
  releaseId: string,
): Promise<ImpactAssessmentAISuggestResponse> => {
  const response = await api.post<ApiResponse<ImpactAssessmentAISuggestResponse>>(
    `/release/${releaseId}/impact-assessment/ai-suggest`,
    {},
  );
  return parseResponse(response.data);
};

export const generateDocumentRequirements = async (
  releaseId: string,
): Promise<DocumentRequirementGenerateResponse> => {
  const response = await api.post<ApiResponse<DocumentRequirementGenerateResponse>>(
    `/release/${releaseId}/document-requirements/generate`,
  );
  return parseResponse(response.data);
};

export const getDocumentRequirements = async (
  releaseId: string,
): Promise<DocumentRequirementGenerateResponse> => {
  const response = await api.get<ApiResponse<DocumentRequirementGenerateResponse>>(
    `/release/${releaseId}/document-requirements`,
  );
  return parseResponse(response.data);
};

export const getDocumentRequirementSummary = async (
  releaseId: string,
): Promise<DocumentRequirementSummary> => {
  const response = await api.get<ApiResponse<DocumentRequirementSummary>>(
    `/release/${releaseId}/document-requirements/summary`,
  );
  return parseResponse(response.data);
};

export const linkDocumentRequirement = async (
  releaseId: string,
  requirementId: string,
  payload: DocumentRequirementLinkPayload,
): Promise<DocumentRequirementRow> => {
  const response = await api.patch<ApiResponse<DocumentRequirementRow>>(
    `/release/${releaseId}/document-requirements/${requirementId}/link`,
    payload,
  );
  return parseResponse(response.data);
};

export const updateDocumentRequirementStatus = async (
  releaseId: string,
  requirementId: string,
  payload: DocumentRequirementStatusPayload,
): Promise<DocumentRequirementRow> => {
  const response = await api.patch<ApiResponse<DocumentRequirementRow>>(
    `/release/${releaseId}/document-requirements/${requirementId}/status`,
    payload,
  );
  return parseResponse(response.data);
};

export const waiveDocumentRequirement = async (
  releaseId: string,
  requirementId: string,
  payload: DocumentRequirementWaiverPayload,
): Promise<DocumentRequirementRow> => {
  const response = await api.post<ApiResponse<DocumentRequirementRow>>(
    `/release/${releaseId}/document-requirements/${requirementId}/waiver`,
    payload,
  );
  return parseResponse(response.data);
};

export const completeDocumentChecklist = async (
  releaseId: string,
): Promise<DocumentRequirementGenerateResponse> => {
  const response = await api.post<ApiResponse<DocumentRequirementGenerateResponse>>(
    `/release/${releaseId}/document-requirements/complete`,
  );
  return parseResponse(response.data);
};
