import React, { useEffect, useState } from "react";
import axios from "axios";
import { apiBaseUrl } from "../../../services/api";
import {
  CreateDocumentLinkPayload,
  DocumentAiAutofillAnalyzeResult,
  DocumentLinkRecord,
  UpdateDocumentLinkPayload,
} from "../../../services/document-link.service";
import { LookupOption, getLookupOptionsByMasterCode } from "../../services/lookupValue.service";

export type DocumentLinkContext =
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
      releaseVersion?: string | null;
      createdDt?: string | null;
      endDt?: string | null;
    };

export interface DocumentLinkFormState {
  source_system: string;
  document_type: string;
  external_document_id: string;
  document_name: string;
  document_version: string;
  upload_dt: string;
  access_url: string;
  source_reference: string;
  notes: string;
}

export interface DocumentLinkFieldErrors {
  [key: string]: string;
}

export type DocumentAiAutofillField = "document_type" | "external_document_id" | "document_version";

export type DocumentAiAutofillStatus = "idle" | "analyzing" | "complete" | "failed";

export interface DocumentAiAutofillUiState {
  status: DocumentAiAutofillStatus;
  result: DocumentAiAutofillAnalyzeResult | null;
  error: string | null;
}

export const EMPTY_DOCUMENT_AI_AUTOFILL_STATE: DocumentAiAutofillUiState = {
  status: "idle",
  result: null,
  error: null,
};

export const OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS: LookupOption[] = [
  { code: "VEEVA_VAULT", value: "Veeva Vault" },
  { code: "MANUAL_URL", value: "Manual URL" },
  { code: "SHAREPOINT", value: "SharePoint" },
  { code: "OTHER", value: "Other" },
];

export const DOCUMENT_LINK_TYPE_OPTIONS: LookupOption[] = [
  { code: "URS", value: "URS" },
  { code: "FRS", value: "FRS" },
  { code: "SOP", value: "SOP" },
  { code: "OTHER", value: "Other" },
  { code: "TRAINING_CONTENT", value: "Training Content" },
];

export const EMPTY_DOCUMENT_LINK_FORM: DocumentLinkFormState = {
  source_system: "",
  document_type: "",
  external_document_id: "",
  document_name: "",
  document_version: "",
  upload_dt: "",
  access_url: "",
  source_reference: "",
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

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const fieldErrorFromMessage = (message?: string | null): DocumentLinkFieldErrors => {
  const nextMessage = message?.trim();
  if (!nextMessage) return {};

  const normalized = nextMessage.toLowerCase();
  if (normalized.includes("source_system") || normalized.includes("source system")) {
    return { source_system: nextMessage };
  }
  if (normalized.includes("document_type") || normalized.includes("document type")) {
    return { document_type: nextMessage };
  }
  if (normalized.includes("external_document_id") || normalized.includes("external document id")) {
    return { external_document_id: nextMessage };
  }
  if (normalized.includes("document_name") || normalized.includes("document name")) {
    return { document_name: nextMessage };
  }
  if (normalized.includes("document_version") || normalized.includes("document version")) {
    return { document_version: nextMessage };
  }
  if (normalized.includes("upload_dt") || normalized.includes("upload date")) {
    return { upload_dt: nextMessage };
  }
  if (normalized.includes("access_url") || normalized.includes("access url")) {
    return { access_url: nextMessage };
  }
  if (normalized.includes("source_reference") || normalized.includes("source reference")) {
    return { source_reference: nextMessage };
  }
  if (normalized.includes("notes")) {
    return { notes: nextMessage };
  }

  return {};
};

export const formatDocumentLinkDate = (value?: string | null): string => {
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

export const formatDocumentSourceSystem = (
  value?: string | null,
  options: LookupOption[] = OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS,
): string => {
  if (!value) return "-";

  const lookupOptions = options.length > 0 ? options : OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS;
  const match = lookupOptions.find((item) => item.code === value);
  if (match?.value) {
    return match.value;
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((segment) => {
      const normalized = segment.toUpperCase();
      if (normalized === "URL" || normalized === "ID") return normalized;
      return normalized.charAt(0) + normalized.slice(1).toLowerCase();
    })
    .join(" ");
};

export const formatDocumentLinkType = (value?: string | null): string => {
  if (!value) return "-";

  const match = DOCUMENT_LINK_TYPE_OPTIONS.find((item) => item.code === value);
  if (match?.value) return match.value;

  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => {
      const normalized = segment.toUpperCase();
      if (normalized === "URS" || normalized === "FRS" || normalized === "SOP") return normalized;
      return normalized.charAt(0) + normalized.slice(1).toLowerCase();
    })
    .join(" ");
};

export const formatVectorizationStatus = (value?: string | null): string => {
  if (!value) return "Not requested";

  const normalized = value.toUpperCase();
  if (normalized === "NOT_SUPPORTED_FOR_VECTORIZATION") return "Not supported";
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0) + segment.slice(1).toLowerCase())
    .join(" ");
};

export const getVectorizationStatusBadgeClass = (value?: string | null): string => {
  const normalized = value?.toUpperCase();
  if (normalized === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (normalized === "PROCESSING" || normalized === "QUEUED" || normalized === "PENDING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (normalized === "NOT_SUPPORTED_FOR_VECTORIZATION") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-200 bg-white text-slate-600";
};

const ACTIVE_VECTORIZATION_STATUSES = new Set(["PENDING", "QUEUED", "PROCESSING"]);

export const isDocumentVectorizationActive = (document: DocumentLinkRecord): boolean => {
  const status = document.vectorization_status || document.vectorization_job?.status;
  return ACTIVE_VECTORIZATION_STATUSES.has((status ?? "").toUpperCase());
};

export const getSafeDocumentAccessUrl = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed || !isHttpUrl(trimmed)) {
    return null;
  }

  return trimmed;
};

export const formatLocalDateTimeInput = (value = new Date()): string => {
  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
};

export const formatAiAutofillConfidence = (value?: number | null): string => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "review";
  }

  return `${Math.round(value * 100)}%`;
};

export const getAiAutofillConfidenceClass = (value?: number | null): string => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0.68) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
};

export const loadOmsSourceSystemOptions = async (): Promise<LookupOption[]> => {
  try {
    const options = await getLookupOptionsByMasterCode("OMS_SOURCE_SYSTEM");
    if (options.length > 0) {
      return options;
    }
  } catch {
    // Fall back to built-in source systems when the lookup API is unavailable.
  }

  return OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS;
};

export const useOmsSourceSystemOptions = (enabled = true) => {
  const [options, setOptions] = useState<LookupOption[]>(OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const run = async () => {
      const loadedOptions = await loadOmsSourceSystemOptions();
      if (!cancelled) {
        setOptions(loadedOptions);
      }
    };

    void run().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { options, loading };
};

export const documentLinkToForm = (documentLink: DocumentLinkRecord): DocumentLinkFormState => ({
  source_system: documentLink.source_system ?? "",
  document_type: documentLink.document_type ?? "",
  external_document_id: documentLink.external_document_id ?? "",
  document_name: documentLink.document_name ?? "",
  document_version: documentLink.document_version ?? "",
  upload_dt: normalizeDateTimeInput(documentLink.upload_dt),
  access_url: documentLink.access_url ?? "",
  source_reference: documentLink.source_reference ?? "",
  notes: documentLink.notes ?? "",
});

export const buildCreateDocumentLinkPayload = (
  form: DocumentLinkFormState,
  createdBy: string,
): CreateDocumentLinkPayload => {
  const payload: CreateDocumentLinkPayload = {
    source_system: form.source_system.trim(),
    document_type: form.document_type.trim(),
    external_document_id: form.external_document_id.trim(),
    document_name: form.document_name.trim(),
    document_version: form.document_version.trim(),
    upload_dt: form.upload_dt.trim(),
    access_url: form.access_url.trim(),
    created_by: createdBy,
  };

  const sourceReference = optionalString(form.source_reference);
  const notes = optionalString(form.notes);

  if (sourceReference !== null) payload.source_reference = sourceReference;
  if (notes !== null) payload.notes = notes;

  return payload;
};

export const buildUpdateDocumentLinkPayload = (
  initialForm: DocumentLinkFormState,
  form: DocumentLinkFormState,
  modifiedBy: string,
): UpdateDocumentLinkPayload => {
  const payload: UpdateDocumentLinkPayload = {
    modified_by: modifiedBy,
  };

  const fields: Array<keyof DocumentLinkFormState> = [
    "source_system",
    "document_type",
    "external_document_id",
    "document_name",
    "document_version",
    "upload_dt",
    "access_url",
    "source_reference",
    "notes",
  ];

  fields.forEach((field) => {
    const nextValue =
      field === "source_reference" || field === "notes"
        ? optionalString(form[field])
        : form[field].trim();
    const initialValue =
      field === "source_reference" || field === "notes"
        ? optionalString(initialForm[field])
        : initialForm[field].trim();

    if (nextValue !== initialValue) {
      if (field === "source_reference" || field === "notes") {
        payload[field] = nextValue;
      } else {
        payload[field] = nextValue ?? "";
      }
    }
  });

  return payload;
};

export const validateDocumentLinkForm = (form: DocumentLinkFormState): DocumentLinkFieldErrors => {
  const errors: DocumentLinkFieldErrors = {};

  if (!form.source_system.trim()) {
    errors.source_system = "Source system is required";
  }
  if (!form.document_type.trim()) {
    errors.document_type = "Document type is required";
  }
  if (!form.external_document_id.trim()) {
    errors.external_document_id = "External document ID is required";
  }
  if (!form.document_name.trim()) {
    errors.document_name = "Document name is required";
  }
  if (!form.document_version.trim()) {
    errors.document_version = "Document version is required";
  }
  if (!form.upload_dt.trim()) {
    errors.upload_dt = "Upload date is required";
  }
  if (!form.access_url.trim()) {
    errors.access_url = "Access URL is required";
  } else if (!isHttpUrl(form.access_url.trim())) {
    errors.access_url = "Access URL must start with http:// or https://";
  }

  return errors;
};

export const mapDocumentLinkAxiosError = (
  error: unknown,
): { message: string; fieldErrors?: DocumentLinkFieldErrors } => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : "Unexpected error occurred" };
  }

  if (!error.response) {
    return {
      message:
        `Could not reach the document-link API at ${apiBaseUrl}. Verify the backend is running and CORS allows this frontend.`,
    };
  }

  const status = error.response.status;
  const data = error.response.data as { message?: string; detail?: unknown } | undefined;
  const detailMessage = typeof data?.detail === "string" ? data.detail : undefined;

  if (status === 400 || status === 422) {
    const fieldErrors: DocumentLinkFieldErrors = {};

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
      message: data?.message || detailMessage || (status === 422 ? "Field validation failed" : "Validation failed"),
      fieldErrors: Object.keys(combinedFieldErrors).length > 0 ? combinedFieldErrors : undefined,
    };
  }

  if (status === 404) {
    return { message: data?.message || detailMessage || "Document link not found" };
  }

  if (status === 409) {
    const message =
      data?.message || detailMessage || "A document with this source system and external document ID is already linked";

    return {
      message,
      fieldErrors: {
        source_system: message,
        external_document_id: message,
      },
    };
  }

  return { message: data?.message || detailMessage || error.message || "Request failed" };
};

export const renderDocumentLinkFieldError = (
  fieldErrors: DocumentLinkFieldErrors,
  key: keyof DocumentLinkFormState | "form",
) =>
  fieldErrors[key]
    ? React.createElement("p", { className: "text-xs text-red-600" }, fieldErrors[key])
    : null;
