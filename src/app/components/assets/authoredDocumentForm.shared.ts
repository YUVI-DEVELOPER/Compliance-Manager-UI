import React from "react";
import axios from "axios";

import { apiBaseUrl } from "../../../services/api";
import {
  AuthoredDocumentRecord,
  AuthoredDocumentReviewActionRecord,
  CreateAuthoredDocumentAiDraftPayload,
  CreateAuthoredDocumentFromTemplatePayload,
  RegenerateAuthoredDocumentAiPayload,
  UpdateAuthoredDocumentPayload,
} from "../../../services/authored-document.service";

export const AUTHORED_DOCUMENT_TYPE_URS = "URS";
export const AUTHORED_DOCUMENT_STATUS_DRAFT = "DRAFT";
export const AUTHORED_DOCUMENT_STATUS_IN_REVIEW = "IN_REVIEW";
export const AUTHORED_DOCUMENT_STATUS_CHANGES_REQUESTED = "CHANGES_REQUESTED";
export const AUTHORED_DOCUMENT_STATUS_APPROVED = "APPROVED";
export const AUTHORED_DOCUMENT_STATUS_REJECTED = "REJECTED";
export const AUTHORED_DOCUMENT_PUBLISH_STATUS_NOT_PUBLISHED = "NOT_PUBLISHED";
export const AUTHORED_DOCUMENT_PUBLISH_STATUS_PENDING = "PUBLISH_PENDING";
export const AUTHORED_DOCUMENT_PUBLISH_STATUS_PUBLISHED = "PUBLISHED";
export const AUTHORED_DOCUMENT_PUBLISH_STATUS_FAILED = "PUBLISH_FAILED";
export const AUTHORED_DOCUMENT_EXTERNAL_SYSTEM_VEEVA = "VEEVA_VAULT";
const LEGACY_AUTHORED_DOCUMENT_STATUS_READY_FOR_REVIEW = "READY_FOR_REVIEW";
export const AUTHORED_DOCUMENT_ACTION_SUBMIT_FOR_REVIEW = "SUBMIT_FOR_REVIEW";
export const AUTHORED_DOCUMENT_ACTION_REQUEST_CHANGES = "REQUEST_CHANGES";
export const AUTHORED_DOCUMENT_ACTION_APPROVE = "APPROVE";
export const AUTHORED_DOCUMENT_ACTION_REJECT = "REJECT";
export const AUTHORED_DOCUMENT_ACTION_COMMENT = "COMMENT";
export const AUTHORED_DOCUMENT_GENERATION_MODE_TEMPLATE_PREFILL = "TEMPLATE_PREFILL";
export const AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED = "AI_ASSISTED";
export const AUTHORED_DOCUMENT_GENERATION_STATUS_COMPLETED = "COMPLETED";
export const AUTHORED_DOCUMENT_GENERATION_STATUS_FALLBACK = "FALLBACK";
export const AUTHORED_DOCUMENT_AI_OPERATION_REGENERATE = "REGENERATE";
export const AUTHORED_DOCUMENT_AI_OPERATION_IMPROVE = "IMPROVE";

type JsonMap = Record<string, unknown>;

export type AuthoredDocumentContext =
  | {
      type: "asset";
      assetId: string | null;
      assetName?: string | null;
      assetCode?: string | null;
      assetVersion?: string | null;
    }
  | {
      type: "release";
      releaseId: string | null;
      assetName?: string | null;
      assetCode?: string | null;
      releaseVersion?: string | null;
    };

export interface CreateAuthoredDocumentFormState {
  document_type: string;
  generation_mode: string;
  template_id: string;
  title: string;
  purpose_notes: string;
  special_instructions: string;
  source_document_url: string;
  source_document_name: string;
  source_document_relative_path: string;
  source_urs_text: string;
}

export interface EditAuthoredDocumentFormState {
  title: string;
  content: string;
}

export interface AiAssistFormState {
  purpose_notes: string;
  special_instructions: string;
}

export interface AuthoredDocumentFieldErrors {
  [key: string]: string;
}

export const EMPTY_CREATE_AUTHORED_DOCUMENT_FORM: CreateAuthoredDocumentFormState = {
  document_type: AUTHORED_DOCUMENT_TYPE_URS,
  generation_mode: AUTHORED_DOCUMENT_GENERATION_MODE_TEMPLATE_PREFILL,
  template_id: "",
  title: "",
  purpose_notes: "",
  special_instructions: "",
  source_document_url: "",
  source_document_name: "",
  source_document_relative_path: "",
  source_urs_text: "",
};

export const EMPTY_EDIT_AUTHORED_DOCUMENT_FORM: EditAuthoredDocumentFormState = {
  title: "",
  content: "",
};

export const EMPTY_AI_ASSIST_FORM: AiAssistFormState = {
  purpose_notes: "",
  special_instructions: "",
};

const optionalString = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const asMap = (value: unknown): JsonMap | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonMap) : null;

const stringFromUnknown = (value: unknown): string => (typeof value === "string" ? value : "");

const getSourceContextMap = (document?: Pick<AuthoredDocumentRecord, "source_context_json"> | null): JsonMap | null =>
  asMap(document?.source_context_json);

const getGenerationInputsFromDocument = (document?: AuthoredDocumentRecord | null): JsonMap | null => {
  const sourceContext = getSourceContextMap(document);
  const generation = asMap(sourceContext?.generation);
  const generationInputs = asMap(generation?.inputs);
  if (generationInputs) {
    return generationInputs;
  }
  return asMap(sourceContext?.merge_inputs);
};

const fieldErrorFromMessage = (message?: string | null): AuthoredDocumentFieldErrors => {
  const nextMessage = message?.trim();
  if (!nextMessage) return {};

  const normalized = nextMessage.toLowerCase();
  if (normalized.includes("template")) return { template_id: nextMessage };
  if (normalized.includes("title")) return { title: nextMessage };
  if (normalized.includes("content")) return { content: nextMessage };
  if (normalized.includes("status")) return { status: nextMessage };
  if (normalized.includes("reviewer")) return { reviewer_name: nextMessage };
  if (normalized.includes("comment")) return { comment_text: nextMessage };
  if (normalized.includes("purpose")) return { purpose_notes: nextMessage };
  if (normalized.includes("instruction")) return { special_instructions: nextMessage };
  if (normalized.includes("source_document") || normalized.includes("source document")) {
    return { source_document_url: nextMessage };
  }
  if (normalized.includes("source_urs") || normalized.includes("source urs")) {
    return { source_urs_text: nextMessage };
  }
  if (normalized.includes("generation")) return { form: nextMessage };
  if (normalized.includes("publish")) return { form: nextMessage };
  if (normalized.includes("veeva")) return { form: nextMessage };
  if (normalized.includes("asset")) return { form: nextMessage };
  if (normalized.includes("release")) return { form: nextMessage };
  if (normalized.includes("document_type") || normalized.includes("document type")) {
    return { document_type: nextMessage };
  }

  return {};
};

export const formatAuthoredDocumentDate = (value?: string | null): string => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatAuthoredDocumentStatus = (value?: string | null): string => {
  if (!value) return "-";
  if (value === AUTHORED_DOCUMENT_STATUS_DRAFT) return "Draft";
  if (value === AUTHORED_DOCUMENT_STATUS_IN_REVIEW || value === LEGACY_AUTHORED_DOCUMENT_STATUS_READY_FOR_REVIEW) {
    return "In Review";
  }
  if (value === AUTHORED_DOCUMENT_STATUS_CHANGES_REQUESTED) return "Changes Requested";
  if (value === AUTHORED_DOCUMENT_STATUS_APPROVED) return "Approved";
  if (value === AUTHORED_DOCUMENT_STATUS_REJECTED) return "Rejected";
  return value;
};

export const getAuthoredDocumentStatusBadgeClass = (value?: string | null): string => {
  if (value === AUTHORED_DOCUMENT_STATUS_IN_REVIEW || value === LEGACY_AUTHORED_DOCUMENT_STATUS_READY_FOR_REVIEW) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (value === AUTHORED_DOCUMENT_STATUS_CHANGES_REQUESTED) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  if (value === AUTHORED_DOCUMENT_STATUS_APPROVED) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (value === AUTHORED_DOCUMENT_STATUS_REJECTED) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
};

export const formatAuthoredDocumentPublishStatus = (value?: string | null): string => {
  if (!value || value === AUTHORED_DOCUMENT_PUBLISH_STATUS_NOT_PUBLISHED) return "Not Published";
  if (value === AUTHORED_DOCUMENT_PUBLISH_STATUS_PENDING) return "Publishing";
  if (value === AUTHORED_DOCUMENT_PUBLISH_STATUS_PUBLISHED) return "Published";
  if (value === AUTHORED_DOCUMENT_PUBLISH_STATUS_FAILED) return "Publish Failed";
  return value;
};

export const getAuthoredDocumentPublishBadgeClass = (value?: string | null): string => {
  if (value === AUTHORED_DOCUMENT_PUBLISH_STATUS_PUBLISHED) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (value === AUTHORED_DOCUMENT_PUBLISH_STATUS_FAILED) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (value === AUTHORED_DOCUMENT_PUBLISH_STATUS_PENDING) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
};

export const formatAuthoredDocumentGenerationMode = (
  mode?: string | null,
  requestedMode?: string | null,
): string => {
  if (mode === AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED) return "AI-Assisted";
  if (
    mode === AUTHORED_DOCUMENT_GENERATION_MODE_TEMPLATE_PREFILL ||
    requestedMode === AUTHORED_DOCUMENT_GENERATION_MODE_TEMPLATE_PREFILL
  ) {
    return "Template Prefill";
  }
  return "Template Prefill";
};

export const getAuthoredDocumentGenerationBadgeClass = (mode?: string | null): string => {
  if (mode === AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED) {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
};

export const didAuthoredDocumentAIFallback = (document?: AuthoredDocumentRecord | null): boolean =>
  document?.generation_requested_mode === AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED &&
  document?.generation_mode !== AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED &&
  document?.generation_status === AUTHORED_DOCUMENT_GENERATION_STATUS_FALLBACK;

export const formatAuthoredDocumentAIFallbackReason = (reason?: string | null): string | null => {
  const normalized = reason?.trim();
  if (!normalized) return null;

  const lowered = normalized.toLowerCase();
  if (
    lowered.includes("request too large") ||
    lowered.includes("tokens per minute") ||
    lowered.includes("tpm") ||
    lowered.includes("status 413")
  ) {
    return "The AI provider rejected the request because the draft context was too large for the configured model.";
  }
  if (lowered.includes("rate limit") || lowered.includes("status 429")) {
    return "The AI provider rate limit was reached.";
  }
  if (lowered.includes("authentication") || lowered.includes("api_key") || lowered.includes("api key")) {
    return "The AI provider is not configured correctly.";
  }
  if (lowered.includes("timed out") || lowered.includes("timeout")) {
    return "The AI provider timed out.";
  }
  if (lowered.includes("communication failed")) {
    return "The AI provider could not be reached.";
  }
  if (lowered.includes("llm_enabled is false")) {
    return "AI-assisted generation is disabled.";
  }
  if (lowered.includes("llm_model is not configured")) {
    return "The AI model is not configured.";
  }
  if (lowered.includes("llm_api_key is not configured")) {
    return "The AI API key is not configured.";
  }

  return "AI-assisted generation could not be completed.";
};

export const isAuthoredDocumentAIAssisted = (document?: AuthoredDocumentRecord | null): boolean =>
  document?.generation_mode === AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED;

export const hasRequestedAuthoredDocumentAIAssist = (document?: AuthoredDocumentRecord | null): boolean =>
  document?.generation_requested_mode === AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED ||
  document?.generation_mode === AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED;

export const formatAuthoredDocumentActionType = (
  value?: AuthoredDocumentReviewActionRecord["action_type"] | string | null,
): string => {
  if (!value) return "-";
  if (value === AUTHORED_DOCUMENT_ACTION_SUBMIT_FOR_REVIEW) return "Submitted for Review";
  if (value === AUTHORED_DOCUMENT_ACTION_REQUEST_CHANGES) return "Requested Changes";
  if (value === AUTHORED_DOCUMENT_ACTION_APPROVE) return "Approved";
  if (value === AUTHORED_DOCUMENT_ACTION_REJECT) return "Rejected";
  if (value === AUTHORED_DOCUMENT_ACTION_COMMENT) return "Comment Added";
  return value;
};

export const canEditAuthoredDocument = (status?: string | null): boolean =>
  status === AUTHORED_DOCUMENT_STATUS_DRAFT || status === AUTHORED_DOCUMENT_STATUS_CHANGES_REQUESTED;

export const canSubmitAuthoredDocument = (status?: string | null): boolean => canEditAuthoredDocument(status);

export const canDeleteAuthoredDocument = (status?: string | null): boolean => canEditAuthoredDocument(status);

export const canReviewAuthoredDocument = (status?: string | null): boolean =>
  status === AUTHORED_DOCUMENT_STATUS_IN_REVIEW || status === LEGACY_AUTHORED_DOCUMENT_STATUS_READY_FOR_REVIEW;

export const isApprovedAuthoredDocument = (status?: string | null): boolean =>
  status === AUTHORED_DOCUMENT_STATUS_APPROVED;

export const isPublishedAuthoredDocument = (document?: AuthoredDocumentRecord | null): boolean =>
  document?.publish_status === AUTHORED_DOCUMENT_PUBLISH_STATUS_PUBLISHED;

export const canPublishAuthoredDocumentToVeeva = (document?: AuthoredDocumentRecord | null): boolean =>
  document?.status === AUTHORED_DOCUMENT_STATUS_APPROVED &&
  (document?.publish_status === AUTHORED_DOCUMENT_PUBLISH_STATUS_NOT_PUBLISHED || !document?.publish_status);

export const canRetryAuthoredDocumentPublish = (document?: AuthoredDocumentRecord | null): boolean =>
  document?.status === AUTHORED_DOCUMENT_STATUS_APPROVED &&
  document?.publish_status === AUTHORED_DOCUMENT_PUBLISH_STATUS_FAILED;

export const getAuthoredDocumentExternalLink = (document?: AuthoredDocumentRecord | null): string | null => {
  const candidate = document?.external_document_url?.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
};

export const authoredDocumentToEditForm = (
  document: AuthoredDocumentRecord,
): EditAuthoredDocumentFormState => ({
  title: document.title ?? "",
  content: document.content ?? "",
});

export const authoredDocumentToAiAssistForm = (
  document?: AuthoredDocumentRecord | null,
): AiAssistFormState => {
  const inputs = getGenerationInputsFromDocument(document);
  return {
    purpose_notes: stringFromUnknown(inputs?.purpose_notes),
    special_instructions: stringFromUnknown(inputs?.special_instructions),
  };
};

export const getAuthoredDocumentAssetVersion = (document?: AuthoredDocumentRecord | null): string | null => {
  const sourceContext = getSourceContextMap(document);
  const asset = asMap(sourceContext?.asset);
  const value = stringFromUnknown(asset?.asset_version);
  return value || null;
};

export const buildCreateAuthoredDocumentPayload = (
  form: CreateAuthoredDocumentFormState,
  context: AuthoredDocumentContext,
  createdBy: string,
): CreateAuthoredDocumentFromTemplatePayload => {
  const payload: CreateAuthoredDocumentFromTemplatePayload = {
    document_type: form.document_type.trim(),
    template_id: form.template_id,
    created_by: createdBy,
  };

  const title = optionalString(form.title);
  const purposeNotes = optionalString(form.purpose_notes);
  const specialInstructions = optionalString(form.special_instructions);
  const sourceDocumentUrl = optionalString(form.source_document_url);
  const sourceDocumentName = optionalString(form.source_document_name);
  const sourceDocumentRelativePath = optionalString(form.source_document_relative_path);
  const sourceUrsText = optionalString(form.source_urs_text);

  if (context.type === "asset" && context.assetId) {
    payload.asset_id = context.assetId;
  }
  if (context.type === "release" && context.releaseId) {
    payload.release_id = context.releaseId;
  }
  if (title !== null) payload.title = title;
  if (purposeNotes !== null) payload.purpose_notes = purposeNotes;
  if (specialInstructions !== null) payload.special_instructions = specialInstructions;
  if (sourceDocumentUrl !== null) payload.source_document_url = sourceDocumentUrl;
  if (sourceDocumentName !== null) payload.source_document_name = sourceDocumentName;
  if (sourceDocumentRelativePath !== null) payload.source_document_relative_path = sourceDocumentRelativePath;
  if (sourceUrsText !== null) payload.source_urs_text = sourceUrsText;

  return payload;
};

export const buildCreateAuthoredDocumentAiPayload = (
  form: CreateAuthoredDocumentFormState,
  context: AuthoredDocumentContext,
  createdBy: string,
): CreateAuthoredDocumentAiDraftPayload => ({
  ...buildCreateAuthoredDocumentPayload(form, context, createdBy),
  fallback_to_template_prefill: true,
});

export const buildRegenerateAuthoredDocumentAiPayload = (
  documentForm: EditAuthoredDocumentFormState,
  aiForm: AiAssistFormState,
  modifiedBy: string,
  operation: "REGENERATE" | "IMPROVE",
): RegenerateAuthoredDocumentAiPayload => {
  const payload: RegenerateAuthoredDocumentAiPayload = {
    modified_by: modifiedBy,
    operation,
  };

  const title = optionalString(documentForm.title);
  const content = optionalString(documentForm.content);
  const purposeNotes = optionalString(aiForm.purpose_notes);
  const specialInstructions = optionalString(aiForm.special_instructions);

  if (title !== null) payload.title = title;
  if (content !== null) payload.existing_content = content;
  if (purposeNotes !== null) payload.purpose_notes = purposeNotes;
  if (specialInstructions !== null) payload.special_instructions = specialInstructions;

  return payload;
};

export const buildUpdateAuthoredDocumentPayload = (
  initialForm: EditAuthoredDocumentFormState,
  form: EditAuthoredDocumentFormState,
  modifiedBy: string,
): UpdateAuthoredDocumentPayload => {
  const payload: UpdateAuthoredDocumentPayload = {
    modified_by: modifiedBy,
  };

  const nextTitle = form.title.trim();
  const nextContent = form.content.trim();

  if (nextTitle !== initialForm.title.trim()) payload.title = nextTitle;
  if (nextContent !== initialForm.content.trim()) payload.content = nextContent;

  return payload;
};

export const validateCreateAuthoredDocumentForm = (
  form: CreateAuthoredDocumentFormState,
): AuthoredDocumentFieldErrors => {
  const errors: AuthoredDocumentFieldErrors = {};

  if (!form.document_type.trim()) {
    errors.document_type = "Document type is required";
  }
  if (!form.template_id.trim()) {
    errors.template_id = "Template is required";
  }
  if (!form.generation_mode.trim()) {
    errors.generation_mode = "Generation mode is required";
  }

  return errors;
};

export const validateEditAuthoredDocumentForm = (
  form: EditAuthoredDocumentFormState,
): AuthoredDocumentFieldErrors => {
  const errors: AuthoredDocumentFieldErrors = {};

  if (!form.title.trim()) {
    errors.title = "Title is required";
  }
  if (!form.content.trim()) {
    errors.content = "Content is required";
  }

  return errors;
};

export const mapAuthoredDocumentAxiosError = (
  error: unknown,
): { message: string; fieldErrors?: AuthoredDocumentFieldErrors } => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : "Unexpected error occurred" };
  }

  if (!error.response) {
    return {
      message:
        `Could not reach the authored-document API at ${apiBaseUrl}. Verify the backend is running and CORS allows this frontend.`,
    };
  }

  const status = error.response.status;
  const data = error.response.data as { message?: string; detail?: unknown } | undefined;

  if (status === 400 || status === 422) {
    const fieldErrors: AuthoredDocumentFieldErrors = {};

    if (Array.isArray(data?.detail)) {
      data.detail.forEach((item) => {
        if (typeof item !== "object" || item === null) return;
        const loc = (item as { loc?: unknown }).loc;
        const msg = (item as { msg?: string }).msg;
        const field = Array.isArray(loc) && loc.length > 0 ? String(loc[loc.length - 1]) : "form";
        fieldErrors[field] = msg ?? "Invalid value";
      });
    }

    const derivedFieldErrors = fieldErrorFromMessage(
      typeof data?.detail === "string" ? data.detail : data?.message,
    );
    const combinedFieldErrors = { ...derivedFieldErrors, ...fieldErrors };

    return {
      message:
        (typeof data?.detail === "string" ? data.detail : undefined) ||
        data?.message ||
        (status === 422 ? "Field validation failed" : "Validation failed"),
      fieldErrors: Object.keys(combinedFieldErrors).length > 0 ? combinedFieldErrors : undefined,
    };
  }

  if (status === 404) {
    return {
      message:
        (typeof data?.detail === "string" ? data.detail : undefined) ||
        data?.message ||
        "Authored document not found",
    };
  }

  if (status === 409 || status === 503) {
    const message =
      (typeof data?.detail === "string" ? data.detail : undefined) ||
      data?.message ||
      (status === 503
        ? "AI-assisted generation is currently unavailable"
        : "Authored document request conflicts with an existing record");
    return {
      message,
      fieldErrors: { form: message },
    };
  }

  return {
    message:
      (typeof data?.detail === "string" ? data.detail : undefined) ||
      data?.message ||
      error.message ||
      "Request failed",
  };
};

export const renderAuthoredDocumentFieldError = (
  fieldErrors: AuthoredDocumentFieldErrors,
  key: string,
) =>
  fieldErrors[key]
    ? React.createElement("p", { className: "text-xs text-red-600" }, fieldErrors[key])
    : null;
