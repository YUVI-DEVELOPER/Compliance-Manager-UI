import axios from "axios";

import { apiBaseUrl } from "../../../services/api";

export const DEFAULT_SUPPLIER_EVALUATION_ACTOR = "admin";

export interface EvaluationUrsOption {
  authored_document_id: string;
  title: string;
  status: string;
  scope: "ASSET" | "RELEASE";
  asset_name?: string | null;
  asset_code?: string | null;
  release_version?: string | null;
}

export const SUPPLIER_RESPONSE_DOCUMENT_TYPE_OPTIONS = [
  { code: "QUOTATION", label: "Quotation" },
  { code: "TECHNICAL_RESPONSE", label: "Technical Response" },
  { code: "COMMERCIAL_RESPONSE", label: "Commercial Response" },
  { code: "SUPPORTING_DOCUMENT", label: "Supporting Document" },
];

export const SUPPLIER_REQUIREMENT_FIT_STATUS_OPTIONS = [
  { code: "MEETS", label: "Meets" },
  { code: "PARTIALLY_MEETS", label: "Partially Meets" },
  { code: "NOT_MEETS", label: "Does Not Meet" },
];

export const normalizeDateTimeInput = (value?: string | null): string => {
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

export const formatSupplierEvaluationStatus = (status?: string | null): string => {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "OPEN_FOR_RESPONSE":
      return "Open for Response";
    case "LOCKED":
      return "Locked";
    case "CLOSED":
      return "Closed";
    default:
      return status || "-";
  }
};

export const formatSupplierResponseStatus = (status?: string | null): string => {
  switch (status) {
    case "NOT_STARTED":
      return "Not Started";
    case "IN_PROGRESS":
      return "In Progress";
    case "SUBMITTED":
      return "Submitted";
    case "LOCKED":
      return "Locked";
    default:
      return status || "-";
  }
};

export const formatSupplierResponseDocumentType = (value?: string | null): string => {
  const match = SUPPLIER_RESPONSE_DOCUMENT_TYPE_OPTIONS.find((option) => option.code === value);
  return match?.label ?? value ?? "-";
};

export const formatSupplierRequirementFitStatus = (value?: string | null): string => {
  const match = SUPPLIER_REQUIREMENT_FIT_STATUS_OPTIONS.find((option) => option.code === value);
  return match?.label ?? value ?? "-";
};

export const getSupplierEvaluationStatusBadgeClass = (status?: string | null): string => {
  switch (status) {
    case "DRAFT":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "OPEN_FOR_RESPONSE":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "LOCKED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "CLOSED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
};

export const getSupplierResponseStatusBadgeClass = (status?: string | null): string => {
  switch (status) {
    case "NOT_STARTED":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "IN_PROGRESS":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "SUBMITTED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "LOCKED":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
};

export const getSupplierRequirementFitStatusBadgeClass = (status?: string | null): string => {
  switch (status) {
    case "MEETS":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PARTIALLY_MEETS":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "NOT_MEETS":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
};

export const formatEvaluationDate = (value?: string | null): string => {
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

export const formatEvaluationUrsLabel = (option: EvaluationUrsOption): string => {
  const scopeLabel = option.scope === "RELEASE" && option.release_version
    ? `Release ${option.release_version}`
    : "Asset";
  return `${option.title} (${scopeLabel})`;
};

export const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const getSafeAccessUrl = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed || !isHttpUrl(trimmed)) {
    return null;
  }
  return trimmed;
};

export const canEditEvaluation = (status?: string | null): boolean =>
  status === "DRAFT" || status === "OPEN_FOR_RESPONSE";

export const canAddSuppliersToEvaluation = canEditEvaluation;

export const canEditSupplierResponse = (
  evaluationStatus?: string | null,
  responseStatus?: string | null,
): boolean =>
  (evaluationStatus === "DRAFT" || evaluationStatus === "OPEN_FOR_RESPONSE") &&
  responseStatus !== "SUBMITTED" &&
  responseStatus !== "LOCKED";

export const canSubmitSupplierResponse = (
  evaluationStatus?: string | null,
  responseStatus?: string | null,
): boolean =>
  (evaluationStatus === "DRAFT" || evaluationStatus === "OPEN_FOR_RESPONSE") &&
  responseStatus !== "SUBMITTED" &&
  responseStatus !== "LOCKED";

export const mapSupplierEvaluationAxiosError = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Unexpected error occurred";
  }

  if (!error.response) {
    return `Could not reach the supplier evaluation API at ${apiBaseUrl}. Verify the backend is running.`;
  }

  const data = error.response.data as { message?: string; detail?: unknown } | undefined;
  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail;
  }
  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }
  return error.message || "Request failed";
};
