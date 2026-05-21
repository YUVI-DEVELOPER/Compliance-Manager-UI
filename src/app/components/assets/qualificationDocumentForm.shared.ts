import React from "react";
import axios from "axios";

import { apiBaseUrl } from "../../../services/api";
import {
  CreateQualificationDocumentPayload,
  QualificationDocumentActionRecord,
  QualificationDocumentRecord,
  UpdateQualificationDocumentPayload,
} from "../../../services/qualification-document.service";

export const QUALIFICATION_TYPE_IQ = "IQ";
export const QUALIFICATION_TYPE_OQ = "OQ";
export const QUALIFICATION_TYPE_PQ = "PQ";
export const QUALIFICATION_STATUS_SUBMITTED = "SUBMITTED";
export const QUALIFICATION_STATUS_IN_REVIEW = "IN_REVIEW";
export const QUALIFICATION_STATUS_ACCEPTED = "ACCEPTED";
export const QUALIFICATION_STATUS_REJECTED = "REJECTED";
export const QUALIFICATION_STATUS_NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION";
export const QUALIFICATION_ACTION_REGISTER = "REGISTER";
export const QUALIFICATION_ACTION_SUBMIT_FOR_REVIEW = "SUBMIT_FOR_REVIEW";
export const QUALIFICATION_ACTION_ACCEPT = "ACCEPT";
export const QUALIFICATION_ACTION_REJECT = "REJECT";
export const QUALIFICATION_ACTION_REQUEST_CLARIFICATION = "REQUEST_CLARIFICATION";

export type QualificationContextScope = "ASSET" | "RELEASE";

export type QualificationDocumentContext =
  | {
      type: "asset";
      assetId: string | null;
      assetName?: string | null;
      assetCode?: string | null;
      assetVersion?: string | null;
    }
  | {
      type: "release";
      assetId?: string | null;
      releaseId: string | null;
      assetName?: string | null;
      assetCode?: string | null;
      releaseVersion?: string | null;
    };

export interface QualificationDocumentFormState {
  qualification_type: string;
  supplier_id: string;
  context_scope: QualificationContextScope;
  release_id: string;
  document_name: string;
  document_version: string;
  source_system: string;
  external_document_id: string;
  document_url: string;
  source_reference: string;
  submission_date: string;
  notes: string;
}

export interface QualificationDocumentFieldErrors {
  [key: string]: string;
}

export const EMPTY_QUALIFICATION_DOCUMENT_FORM: QualificationDocumentFormState = {
  qualification_type: QUALIFICATION_TYPE_IQ,
  supplier_id: "",
  context_scope: "ASSET",
  release_id: "",
  document_name: "",
  document_version: "",
  source_system: "",
  external_document_id: "",
  document_url: "",
  source_reference: "",
  submission_date: "",
  notes: "",
};

const optionalString = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeDateTimeInput = (value?: string | null): string => {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  const normalized = trimmed.replace(" ", "T");
  const dateTimeMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (dateTimeMatch) {
    return `${dateTimeMatch[1]}T${dateTimeMatch[2]}`;
  }

  const dateMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateMatch) {
    return `${dateMatch[1]}T00:00`;
  }

  return normalized.slice(0, 16);
};

export const getNowDateTimeLocal = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  const hour = `${now.getHours()}`.padStart(2, "0");
  const minute = `${now.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const fieldErrorFromMessage = (message?: string | null): QualificationDocumentFieldErrors => {
  const nextMessage = message?.trim();
  if (!nextMessage) return {};

  const normalized = nextMessage.toLowerCase();
  if (normalized.includes("qualification_type") || normalized.includes("qualification type")) {
    return { qualification_type: nextMessage };
  }
  if (normalized.includes("supplier")) return { supplier_id: nextMessage };
  if (normalized.includes("asset")) return { context_scope: nextMessage };
  if (normalized.includes("release")) return { release_id: nextMessage };
  if (normalized.includes("document_name") || normalized.includes("document name")) {
    return { document_name: nextMessage };
  }
  if (normalized.includes("document_version") || normalized.includes("document version")) {
    return { document_version: nextMessage };
  }
  if (normalized.includes("source_system") || normalized.includes("source system")) {
    return { source_system: nextMessage };
  }
  if (normalized.includes("external_document_id") || normalized.includes("external document id")) {
    return { external_document_id: nextMessage };
  }
  if (normalized.includes("document_url") || normalized.includes("document url")) {
    return { document_url: nextMessage };
  }
  if (normalized.includes("source_reference") || normalized.includes("source reference")) {
    return { source_reference: nextMessage };
  }
  if (normalized.includes("submission")) return { submission_date: nextMessage };
  if (normalized.includes("comment")) return { comment_text: nextMessage };
  if (normalized.includes("notes")) return { notes: nextMessage };
  return { form: nextMessage };
};

export const formatQualificationDocumentDate = (value?: string | null): string => {
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

export const formatQualificationType = (value?: string | null): string => {
  if (!value) return "-";
  if (value === QUALIFICATION_TYPE_IQ) return "IQ";
  if (value === QUALIFICATION_TYPE_OQ) return "OQ";
  if (value === QUALIFICATION_TYPE_PQ) return "PQ";
  return value;
};

export const getQualificationTypeBadgeClass = (value?: string | null): string => {
  if (value === QUALIFICATION_TYPE_IQ) return "border-cyan-200 bg-cyan-50 text-cyan-700";
  if (value === QUALIFICATION_TYPE_OQ) return "border-sky-200 bg-sky-50 text-sky-700";
  if (value === QUALIFICATION_TYPE_PQ) return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
};

export const formatQualificationStatus = (value?: string | null): string => {
  if (!value) return "-";
  if (value === QUALIFICATION_STATUS_SUBMITTED) return "Submitted";
  if (value === QUALIFICATION_STATUS_IN_REVIEW) return "In Review";
  if (value === QUALIFICATION_STATUS_ACCEPTED) return "Accepted";
  if (value === QUALIFICATION_STATUS_REJECTED) return "Rejected";
  if (value === QUALIFICATION_STATUS_NEEDS_CLARIFICATION) return "Needs Clarification";
  return value;
};

export const getQualificationStatusBadgeClass = (value?: string | null): string => {
  if (value === QUALIFICATION_STATUS_IN_REVIEW) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }
  if (value === QUALIFICATION_STATUS_ACCEPTED) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (value === QUALIFICATION_STATUS_REJECTED) {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }
  if (value === QUALIFICATION_STATUS_NEEDS_CLARIFICATION) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  return "border-amber-200 bg-amber-50 text-amber-700";
};

export const formatQualificationActionType = (
  value?: QualificationDocumentActionRecord["action_type"] | string | null,
): string => {
  if (!value) return "-";
  if (value === QUALIFICATION_ACTION_REGISTER) return "Registered";
  if (value === QUALIFICATION_ACTION_SUBMIT_FOR_REVIEW) return "Submitted for Review";
  if (value === QUALIFICATION_ACTION_ACCEPT) return "Accepted";
  if (value === QUALIFICATION_ACTION_REJECT) return "Rejected";
  if (value === QUALIFICATION_ACTION_REQUEST_CLARIFICATION) return "Clarification Requested";
  return value;
};

export const canEditQualificationDocument = (status?: string | null): boolean =>
  status === QUALIFICATION_STATUS_SUBMITTED || status === QUALIFICATION_STATUS_NEEDS_CLARIFICATION;

export const canDeleteQualificationDocument = (status?: string | null): boolean =>
  canEditQualificationDocument(status);

export const canSubmitQualificationDocument = (status?: string | null): boolean =>
  canEditQualificationDocument(status);

export const canReviewQualificationDocument = (status?: string | null): boolean =>
  status === QUALIFICATION_STATUS_IN_REVIEW;

export const getQualificationDocumentExternalLink = (
  document?: Pick<QualificationDocumentRecord, "document_url"> | null,
): string | null => {
  const candidate = document?.document_url?.trim();
  if (!candidate) return null;
  return isHttpUrl(candidate) ? candidate : null;
};

export const formatQualificationLinkedContext = (
  document?: QualificationDocumentRecord | null,
): string => {
  if (!document) return "-";
  if (document.release_id) {
    return document.release_version?.trim() ? `Release ${document.release_version}` : "Release-linked";
  }
  return "Asset-level";
};

export const qualificationDocumentToForm = (
  document: QualificationDocumentRecord,
): QualificationDocumentFormState => ({
  qualification_type: document.qualification_type ?? QUALIFICATION_TYPE_IQ,
  supplier_id: document.supplier_id ?? "",
  context_scope: document.release_id ? "RELEASE" : "ASSET",
  release_id: document.release_id ?? "",
  document_name: document.document_name ?? "",
  document_version: document.document_version ?? "",
  source_system: document.source_system ?? "",
  external_document_id: document.external_document_id ?? "",
  document_url: document.document_url ?? "",
  source_reference: document.source_reference ?? "",
  submission_date: normalizeDateTimeInput(document.submission_date) || getNowDateTimeLocal(),
  notes: document.notes ?? "",
});

export const buildInitialQualificationDocumentForm = (
  context: QualificationDocumentContext,
): QualificationDocumentFormState => ({
  ...EMPTY_QUALIFICATION_DOCUMENT_FORM,
  context_scope: context.type === "release" ? "RELEASE" : "ASSET",
  release_id: context.type === "release" ? context.releaseId ?? "" : "",
  submission_date: getNowDateTimeLocal(),
});

export const buildCreateQualificationDocumentPayload = (
  form: QualificationDocumentFormState,
  context: QualificationDocumentContext,
  createdBy: string,
): CreateQualificationDocumentPayload => {
  const payload: CreateQualificationDocumentPayload = {
    qualification_type: form.qualification_type.trim(),
    supplier_id: form.supplier_id.trim(),
    document_name: form.document_name.trim(),
    document_url: form.document_url.trim(),
    submission_date: form.submission_date.trim(),
    created_by: createdBy,
  };

  if (context.type === "asset" && context.assetId) {
    payload.asset_id = context.assetId;
    if (form.context_scope === "RELEASE" && form.release_id.trim()) {
      payload.release_id = form.release_id.trim();
    }
  }
  if (context.type === "release" && context.releaseId) {
    payload.release_id = context.releaseId;
    if (context.assetId) {
      payload.asset_id = context.assetId;
    }
  }

  const documentVersion = optionalString(form.document_version);
  const sourceSystem = optionalString(form.source_system);
  const externalDocumentId = optionalString(form.external_document_id);
  const sourceReference = optionalString(form.source_reference);
  const notes = optionalString(form.notes);

  if (documentVersion !== null) payload.document_version = documentVersion;
  if (sourceSystem !== null) payload.source_system = sourceSystem;
  if (externalDocumentId !== null) payload.external_document_id = externalDocumentId;
  if (sourceReference !== null) payload.source_reference = sourceReference;
  if (notes !== null) payload.notes = notes;

  return payload;
};

export const buildUpdateQualificationDocumentPayload = (
  initialForm: QualificationDocumentFormState,
  form: QualificationDocumentFormState,
  context: QualificationDocumentContext,
  modifiedBy: string,
): UpdateQualificationDocumentPayload => {
  const payload: UpdateQualificationDocumentPayload = {
    modified_by: modifiedBy,
  };

  const fields: Array<keyof QualificationDocumentFormState> = [
    "qualification_type",
    "supplier_id",
    "context_scope",
    "release_id",
    "document_name",
    "document_version",
    "source_system",
    "external_document_id",
    "document_url",
    "source_reference",
    "submission_date",
    "notes",
  ];

  const resolveContextIds = (state: QualificationDocumentFormState) => {
    if (context.type === "release") {
      return {
        asset_id: context.assetId ?? null,
        release_id: context.releaseId ?? null,
      };
    }
    if (state.context_scope === "RELEASE") {
      return {
        asset_id: context.assetId ?? null,
        release_id: state.release_id.trim() || null,
      };
    }
    return {
      asset_id: context.assetId ?? null,
      release_id: null,
    };
  };

  const nextContext = resolveContextIds(form);
  const initialContext = resolveContextIds(initialForm);
  if (nextContext.asset_id !== initialContext.asset_id) payload.asset_id = nextContext.asset_id;
  if (nextContext.release_id !== initialContext.release_id) payload.release_id = nextContext.release_id;

  fields.forEach((field) => {
    if (field === "context_scope" || field === "release_id") return;

    const nextValue =
      field === "document_version" ||
      field === "source_system" ||
      field === "external_document_id" ||
      field === "source_reference" ||
      field === "notes"
        ? optionalString(form[field])
        : form[field].trim();
    const initialValue =
      field === "document_version" ||
      field === "source_system" ||
      field === "external_document_id" ||
      field === "source_reference" ||
      field === "notes"
        ? optionalString(initialForm[field])
        : initialForm[field].trim();

    if (nextValue === initialValue) return;

    if (field === "qualification_type") payload.qualification_type = nextValue ?? "";
    if (field === "supplier_id") payload.supplier_id = nextValue ?? "";
    if (field === "document_name") payload.document_name = nextValue ?? "";
    if (field === "document_version") payload.document_version = nextValue;
    if (field === "source_system") payload.source_system = nextValue;
    if (field === "external_document_id") payload.external_document_id = nextValue;
    if (field === "document_url") payload.document_url = nextValue ?? "";
    if (field === "source_reference") payload.source_reference = nextValue;
    if (field === "submission_date") payload.submission_date = nextValue ?? "";
    if (field === "notes") payload.notes = nextValue;
  });

  return payload;
};

export const validateQualificationDocumentForm = (
  form: QualificationDocumentFormState,
  context: QualificationDocumentContext,
): QualificationDocumentFieldErrors => {
  const errors: QualificationDocumentFieldErrors = {};

  if (!form.qualification_type.trim()) {
    errors.qualification_type = "Qualification type is required";
  }
  if (!form.supplier_id.trim()) {
    errors.supplier_id = "Supplier is required";
  }
  if (context.type === "asset" && form.context_scope === "RELEASE" && !form.release_id.trim()) {
    errors.release_id = "Release is required for release-linked qualification evidence";
  }
  if (!form.document_name.trim()) {
    errors.document_name = "Document name is required";
  }
  if (!form.submission_date.trim()) {
    errors.submission_date = "Submission date is required";
  }
  if (!form.document_url.trim()) {
    errors.document_url = "Document URL is required";
  } else if (!isHttpUrl(form.document_url.trim())) {
    errors.document_url = "Document URL must start with http:// or https://";
  }

  return errors;
};

export const mapQualificationDocumentAxiosError = (
  error: unknown,
): { message: string; fieldErrors?: QualificationDocumentFieldErrors } => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : "Unexpected error occurred" };
  }

  if (!error.response) {
    return {
      message:
        `Could not reach the qualification-document API at ${apiBaseUrl}. Verify the backend is running and CORS allows this frontend.`,
    };
  }

  const status = error.response.status;
  const data = error.response.data as { message?: string; detail?: unknown } | undefined;

  if (status === 400 || status === 422) {
    const fieldErrors: QualificationDocumentFieldErrors = {};

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
        "Qualification document not found",
    };
  }

  if (status === 409) {
    const message =
      (typeof data?.detail === "string" ? data.detail : undefined) ||
      data?.message ||
      "Qualification document request conflicts with an existing record";
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

export const renderQualificationDocumentFieldError = (
  fieldErrors: QualificationDocumentFieldErrors,
  key: string,
) =>
  fieldErrors[key]
    ? React.createElement("p", { className: "text-xs text-red-600" }, fieldErrors[key])
    : null;
