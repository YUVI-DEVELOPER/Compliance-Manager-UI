import React from "react";
import axios from "axios";
import { apiBaseUrl } from "../../../services/api";
import {
  CreateReleasePayload,
  ReleaseImpactAssessmentRecord,
  ReleaseRecord,
  UpdateReleasePayload,
} from "../../../services/release.service";

export const DOCUMENTATION_MODE_MANUAL = "MANUAL";
export const DOCUMENTATION_MODE_ONLINE_FETCH = "ONLINE_FETCH";

export interface ReleaseFormState {
  version: string;
  system_config_report: string;
  documentation_mode: string;
  documentation_text: string;
  documentation_source_url: string;
  end_dt: string;
}

export interface ReleaseFieldErrors {
  [key: string]: string;
}

export const EMPTY_RELEASE_FORM: ReleaseFormState = {
  version: "",
  system_config_report: "",
  documentation_mode: DOCUMENTATION_MODE_MANUAL,
  documentation_text: "",
  documentation_source_url: "",
  end_dt: "",
};

const normalizeDateInput = (value?: string | null): string => {
  if (!value) return "";
  return value.slice(0, 10);
};

const optionalString = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

export const formatDocumentationMode = (value?: string | null): string => {
  if (value === DOCUMENTATION_MODE_MANUAL) return "Manual";
  if (value === DOCUMENTATION_MODE_ONLINE_FETCH) return "Online Fetch";
  return value?.trim() || "-";
};

export const getDocumentationModeBadgeClass = (value?: string | null): string => {
  if (value === DOCUMENTATION_MODE_ONLINE_FETCH) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (value === DOCUMENTATION_MODE_MANUAL) {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }
  return "border-slate-200 bg-white text-slate-600";
};

export const getImpactLevelBadgeClass = (value?: string | null): string => {
  if (value === "HIGH") return "border-red-200 bg-red-50 text-red-700";
  if (value === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  if (value === "LOW") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

export const formatReleaseDateTime = (value?: string | null): string => {
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

const fieldErrorFromMessage = (message?: string | null): ReleaseFieldErrors => {
  const nextMessage = message?.trim();
  if (!nextMessage) return {};

  const normalized = nextMessage.toLowerCase();
  if (normalized.includes("version")) {
    return { version: nextMessage };
  }
  if (normalized.includes("end_dt") || normalized.includes("end date")) {
    return { end_dt: nextMessage };
  }
  if (normalized.includes("system_config_report") || normalized.includes("system configuration")) {
    return { system_config_report: nextMessage };
  }
  if (normalized.includes("documentation_mode") || normalized.includes("documentation mode")) {
    return { documentation_mode: nextMessage };
  }
  if (normalized.includes("documentation_text") || normalized.includes("documentation text")) {
    return { documentation_text: nextMessage };
  }
  if (normalized.includes("documentation_source_url") || normalized.includes("documentation source url")) {
    return { documentation_source_url: nextMessage };
  }

  return {};
};

export const releaseToForm = (release: ReleaseRecord): ReleaseFormState => ({
  version: release.version ?? "",
  system_config_report: release.system_config_report ?? "",
  documentation_mode: release.documentation_mode ?? DOCUMENTATION_MODE_MANUAL,
  documentation_text: release.documentation_text ?? "",
  documentation_source_url: release.documentation_source_url ?? "",
  end_dt: normalizeDateInput(release.end_dt),
});

export const buildCreateReleasePayload = (
  form: ReleaseFormState,
  createdBy: string,
): CreateReleasePayload => {
  const payload: CreateReleasePayload = {
    version: form.version.trim(),
    created_by: createdBy,
    documentation_mode: form.documentation_mode,
  };

  const systemConfigReport = optionalString(form.system_config_report);
  const documentationText = optionalString(form.documentation_text);
  const documentationSourceUrl = optionalString(form.documentation_source_url);
  const endDate = optionalString(form.end_dt);

  if (systemConfigReport !== null) payload.system_config_report = systemConfigReport;
  if (form.documentation_mode === DOCUMENTATION_MODE_MANUAL && documentationText !== null) {
    payload.documentation_text = documentationText;
  }
  if (form.documentation_mode === DOCUMENTATION_MODE_ONLINE_FETCH && documentationSourceUrl !== null) {
    payload.documentation_source_url = documentationSourceUrl;
  }
  if (endDate !== null) payload.end_dt = endDate;

  return payload;
};

export const buildUpdateReleasePayload = (
  initialForm: ReleaseFormState,
  form: ReleaseFormState,
  modifiedBy: string,
): UpdateReleasePayload => {
  const payload: UpdateReleasePayload = { modified_by: modifiedBy };

  const nextVersion = form.version.trim();
  const initialVersion = initialForm.version.trim();
  if (nextVersion !== initialVersion) {
    payload.version = nextVersion;
  }

  const nextSystemConfig = optionalString(form.system_config_report);
  const initialSystemConfig = optionalString(initialForm.system_config_report);
  if (nextSystemConfig !== initialSystemConfig) {
    payload.system_config_report = nextSystemConfig;
  }

  const nextDocumentationMode = form.documentation_mode.trim().toUpperCase();
  const initialDocumentationMode = initialForm.documentation_mode.trim().toUpperCase();
  if (nextDocumentationMode !== initialDocumentationMode) {
    payload.documentation_mode = nextDocumentationMode;
  }

  const nextDocumentationText = optionalString(form.documentation_text);
  const initialDocumentationText = optionalString(initialForm.documentation_text);
  if (
    nextDocumentationMode === DOCUMENTATION_MODE_MANUAL &&
    (nextDocumentationText !== initialDocumentationText || nextDocumentationMode !== initialDocumentationMode)
  ) {
    payload.documentation_text = nextDocumentationText;
  }

  const nextDocumentationSourceUrl = optionalString(form.documentation_source_url);
  const initialDocumentationSourceUrl = optionalString(initialForm.documentation_source_url);
  if (
    nextDocumentationMode === DOCUMENTATION_MODE_ONLINE_FETCH &&
    (
      nextDocumentationSourceUrl !== initialDocumentationSourceUrl ||
      nextDocumentationMode !== initialDocumentationMode
    )
  ) {
    payload.documentation_source_url = nextDocumentationSourceUrl;
  }

  const nextEndDate = optionalString(form.end_dt);
  const initialEndDate = optionalString(initialForm.end_dt);
  if (nextEndDate !== initialEndDate) {
    payload.end_dt = nextEndDate;
  }

  return payload;
};

export const validateReleaseForm = (
  form: ReleaseFormState,
  options?: { createdDt?: string | null },
): ReleaseFieldErrors => {
  const errors: ReleaseFieldErrors = {};

  if (!form.version.trim()) {
    errors.version = "Version is required";
  }

  const documentationMode = form.documentation_mode.trim().toUpperCase();
  if (!documentationMode) {
    errors.documentation_mode = "Documentation mode is required";
  } else if (
    documentationMode !== DOCUMENTATION_MODE_MANUAL &&
    documentationMode !== DOCUMENTATION_MODE_ONLINE_FETCH
  ) {
    errors.documentation_mode = "Documentation mode must be MANUAL or ONLINE_FETCH";
  }

  if (documentationMode === DOCUMENTATION_MODE_MANUAL && !form.documentation_text.trim()) {
    errors.documentation_text = "Documentation text is required when mode is MANUAL";
  }

  if (documentationMode === DOCUMENTATION_MODE_ONLINE_FETCH) {
    const sourceUrl = form.documentation_source_url.trim();
    if (!sourceUrl) {
      errors.documentation_source_url = "Documentation source URL is required when mode is ONLINE_FETCH";
    } else if (!isHttpUrl(sourceUrl)) {
      errors.documentation_source_url = "Documentation source URL must start with http:// or https://";
    }
  }

  const endDate = normalizeDateInput(form.end_dt);
  const createdDate = normalizeDateInput(options?.createdDt);
  if (endDate && createdDate && endDate < createdDate) {
    errors.end_dt = "End date cannot be earlier than the created date";
  }

  return errors;
};

export const mapReleaseAxiosError = (
  error: unknown,
): { message: string; fieldErrors?: ReleaseFieldErrors } => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : "Unexpected error occurred" };
  }

  if (!error.response) {
    return {
      message:
        `Could not reach the Release API at ${apiBaseUrl}. Verify the backend is running and CORS allows this frontend.`,
    };
  }

  const status = error.response?.status;
  const data = error.response?.data as { message?: string; detail?: unknown } | undefined;

  if (status === 400 || status === 422) {
    const fieldErrors: ReleaseFieldErrors = {};
    if (Array.isArray(data?.detail)) {
      data.detail.forEach((item) => {
        if (typeof item !== "object" || item === null) return;
        const loc = (item as { loc?: unknown }).loc;
        const msg = (item as { msg?: string }).msg;
        const field = Array.isArray(loc) && loc.length > 0 ? String(loc[loc.length - 1]) : "form";
        fieldErrors[field] = msg ?? "Invalid value";
      });
    }

    const derivedFieldErrors = fieldErrorFromMessage(data?.message);
    const combinedFieldErrors = { ...derivedFieldErrors, ...fieldErrors };

    return {
      message: data?.message || (status === 422 ? "Field validation failed" : "Validation failed"),
      fieldErrors: Object.keys(combinedFieldErrors).length > 0 ? combinedFieldErrors : undefined,
    };
  }

  if (status === 404) {
    return { message: data?.message || "Release not found" };
  }

  if (status === 409) {
    const message = data?.message || "This asset already has a release with that version";
    return {
      message,
      fieldErrors: { version: message },
    };
  }

  return { message: data?.message || error.message || "Request failed" };
};

export const renderReleaseFieldError = (
  fieldErrors: ReleaseFieldErrors,
  key: keyof ReleaseFormState | "form",
) =>
  fieldErrors[key]
    ? React.createElement("p", { className: "text-xs text-red-600" }, fieldErrors[key])
    : null;

export const getAssessmentDiffSummary = (
  assessment?: ReleaseImpactAssessmentRecord | null,
): Record<string, unknown> | null => {
  const diffSummary = assessment?.diff_summary;
  if (!diffSummary || typeof diffSummary !== "object" || Array.isArray(diffSummary)) {
    return null;
  }
  return diffSummary;
};
