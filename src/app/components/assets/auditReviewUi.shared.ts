import {
  AuditReviewJobDetail,
  AuditReviewReportDetail,
  AuditReviewReportStatus,
} from "../../../services/audit-review.service";

export type AuditReviewUiActionKey =
  | "run"
  | "extract"
  | "analyze"
  | "generate-report"
  | "open-report"
  | "submit-review"
  | "review-decision"
  | "download-pdf"
  | "refresh"
  | "none";

export interface AuditReviewUiAction {
  key: AuditReviewUiActionKey;
  label: string;
  description: string;
  disabled?: boolean;
  loading?: boolean;
}

export const AUDIT_REVIEW_ACTION_PERMISSIONS: Partial<Record<AuditReviewUiActionKey, readonly string[]>> = {
  run: ["AUDIT_REVIEW_CREATE"],
  extract: ["AUDIT_REVIEW_EXTRACT"],
  analyze: ["AUDIT_REVIEW_ANALYZE"],
  "generate-report": ["AUDIT_REPORT_GENERATE"],
  "open-report": ["AUDIT_REPORT_VIEW"],
  "submit-review": ["AUDIT_REPORT_SUBMIT"],
  "review-decision": ["AUDIT_REPORT_APPROVE", "AUDIT_REPORT_REJECT", "AUDIT_REPORT_REQUEST_CHANGES"],
  "download-pdf": ["REPORT_EXPORT"],
};

export const canUseAuditReviewAction = (
  actionKey: AuditReviewUiActionKey,
  hasAnyPermission: (codes: string[]) => boolean,
): boolean => {
  const permissions = AUDIT_REVIEW_ACTION_PERMISSIONS[actionKey];
  return !permissions || hasAnyPermission([...permissions]);
};

export const formatAuditReviewValue = (value?: string | number | null): string => {
  if (value === undefined || value === null || String(value).trim() === "") return "-";
  return String(value);
};

export const formatAuditReviewNumber = (value?: number | null): string => {
  if (value === undefined || value === null) return "0";
  return value.toLocaleString();
};

export const formatAuditReviewDateTime = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatAuditReviewDate = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

export const formatAuditReviewPeriod = (start?: string | null, end?: string | null): string => {
  if (!start && !end) return "-";
  return `${formatAuditReviewDate(start)} - ${formatAuditReviewDate(end)}`;
};

export const formatAuditReviewLabel = (value?: string | null): string => {
  if (!value) return "-";
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      return upper.length <= 4 ? upper : upper.charAt(0) + upper.slice(1).toLowerCase();
    })
    .join(" ");
};

export const getAuditReviewSelectedTypes = (job?: Pick<AuditReviewJobDetail, "selected_audit_trail_types" | "audit_trail_type"> | null): string[] => {
  if (Array.isArray(job?.selected_audit_trail_types) && job.selected_audit_trail_types.length > 0) {
    return job.selected_audit_trail_types;
  }
  return job?.audit_trail_type ? [job.audit_trail_type] : [];
};

export const getAuditReviewScoreLabel = (job?: AuditReviewJobDetail | null): string => {
  if (job?.score_label) return job.score_label;
  const scope = job?.review_scope;
  if (scope === "FULL_GXP") return "Full GxP Audit Trail Score";
  if (scope === "DOCUMENT_ONLY") return "Document Audit Trail Score";
  if (scope === "OBJECT_ONLY") return "Object Audit Trail Score";
  if (scope === "SYSTEM_ONLY") return "System Audit Trail Score";
  if (scope === "DOMAIN_ONLY") return "Domain Audit Trail Score";
  if (scope === "CUSTOM") return "Custom Audit Trail Review Score";
  return "Login Audit Trail Score";
};

export const shortAuditReviewIdentifier = (value?: string | null): string =>
  value ? `${value.slice(0, 8)}...` : "Not saved";

export const getAuditReviewJobStatusBadgeClass = (status?: string | null): string => {
  if (status === "REPORT_DRAFTED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "ANALYZED" || status === "EXTRACTED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "PARTIAL_EXTRACTION") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "EXTRACTING" || status === "ANALYZING" || status === "REPORT_GENERATING") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "CANCELLED") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-200 bg-white text-slate-700";
};

export const getAuditReviewReportStatusBadgeClass = (status?: AuditReviewReportStatus | null): string => {
  if (status === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "UNDER_REVIEW") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "CHANGES_REQUESTED") return "border-orange-200 bg-orange-50 text-orange-700";
  if (status === "SUPERSEDED") return "border-slate-200 bg-slate-100 text-slate-600";
  if (status === "DRAFT") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-white text-slate-700";
};

export const getAuditReviewLifecycleStatus = (
  job: AuditReviewJobDetail | null,
  report: AuditReviewReportDetail | null,
): string => {
  if (
    report?.status === "APPROVED" ||
    report?.status === "UNDER_REVIEW" ||
    report?.status === "REJECTED" ||
    report?.status === "CHANGES_REQUESTED"
  ) {
    return report.status;
  }
  return job?.status || "NO_JOB";
};

export const getAuditReviewLastUpdated = (
  job: AuditReviewJobDetail | null,
  report: AuditReviewReportDetail | null,
): string | null =>
  report?.modified_dt || report?.created_dt || job?.modified_dt || job?.completed_at || job?.created_dt || null;
