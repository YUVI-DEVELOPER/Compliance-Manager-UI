import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Gauge,
  History,
  Layers3,
  ListChecks,
  Loader2,
  Pencil,
  PlayCircle,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import {
  analyzeAuditReviewJob,
  approveAuditReviewReport,
  createAssetAuditReviewSchedule,
  AuditReviewFinding,
  AuditReviewJobCreatePayload,
  AuditReviewJobDetail,
  AuditReviewJobListItem,
  AuditReviewJobStatus,
  AuditReviewMetadata,
  AuditReviewReportDetail,
  AuditReviewReportESignaturePayload,
  AuditReviewReportListItem,
  AuditReviewReportStatus,
  AuditReviewScope,
  AuditReviewSchedule,
  AuditReviewScheduleFrequency,
  AuditReviewScheduleRunNowResponse,
  AuditReviewScore,
  AuditTrailRecord,
  createAuditReviewJob,
  downloadAuditReviewReportPdf,
  extractAuditReviewJob,
  generateAuditReviewReport,
  getAssetAuditReviewSchedules,
  getAuditReviewFindings,
  getAuditReviewJob,
  getAuditReviewMetadata,
  getAuditReviewRecords,
  getAuditReviewReportHtmlPreview,
  getAuditReviewReport,
  getAuditReviewScores,
  listAssetAuditReviewReports,
  listAuditReviewJobs,
  rejectAuditReviewReport,
  requestChangesAuditReviewReport,
  runAuditReviewScheduleNow,
  submitAuditReviewReport,
  updateAuditReviewSchedule,
} from "../../services/audit-review.service";
import { AssetRecord, getAuditReviewAssets } from "../../services/asset.service";
import { useCurrentActor } from "../auth/useCurrentActor";
import { useAuth } from "../auth/useAuth";
import { ConfirmStrip, EmptyState, FilterBar, SearchableCombobox, StatusBadge, WorkflowStepper, type WorkflowStep } from "../components/foundation";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardBody } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { cn } from "../components/ui/utils";
import {
  formatAuditReviewDate,
  formatAuditReviewDateTime,
  formatAuditReviewLabel,
  formatAuditReviewNumber,
  formatAuditReviewPeriod,
  getAuditReviewReportStatusBadgeClass,
} from "../components/assets/auditReviewUi.shared";
import {
  formatAuditReviewRating,
  getAuditReviewRatingBadgeClass,
} from "../components/assets/AuditReviewScoreCard";
import {
  AUDIT_REVIEW_SIGNATURE_MEANING,
  AuditReviewESignatureFields,
  getAuditReviewESignatureFieldErrors,
  type AuditReviewESignatureFieldErrors,
} from "../components/assets/AuditReviewESignatureFields";
import { AuditReviewNotificationsPanel } from "../components/assets/AuditReviewNotificationsPanel";

const FULL_GXP_TYPES = [
  "login_audit_trail",
  "document_audit_trail",
  "object_audit_trail",
  "system_audit_trail",
  "domain_audit_trail",
] as const;

const FALLBACK_METADATA: AuditReviewMetadata = {
  supported_audit_trail_types: [
    { code: "login_audit_trail", label: "Login Audit Trail" },
    { code: "document_audit_trail", label: "Document Audit Trail" },
    { code: "object_audit_trail", label: "Object Audit Trail" },
    { code: "system_audit_trail", label: "System Audit Trail" },
    { code: "domain_audit_trail", label: "Domain Audit Trail" },
  ],
  review_scopes: [
    { code: "LOGIN_ONLY", label: "Login Only", score_label: "Login Audit Trail Score", audit_trail_types: ["login_audit_trail"] },
    { code: "DOCUMENT_ONLY", label: "Document Only", score_label: "Document Audit Trail Score", audit_trail_types: ["document_audit_trail"] },
    { code: "OBJECT_ONLY", label: "Object Only", score_label: "Object Audit Trail Score", audit_trail_types: ["object_audit_trail"] },
    { code: "SYSTEM_ONLY", label: "System Only", score_label: "System Audit Trail Score", audit_trail_types: ["system_audit_trail"] },
    { code: "DOMAIN_ONLY", label: "Domain Only", score_label: "Domain Audit Trail Score", audit_trail_types: ["domain_audit_trail"] },
    { code: "FULL_GXP", label: "Full GxP", score_label: "Full GxP Audit Trail Score", audit_trail_types: [...FULL_GXP_TYPES] },
    { code: "CUSTOM", label: "Custom", score_label: "Custom Audit Trail Review Score", audit_trail_types: [] },
  ],
  full_gxp_audit_trail_types: [...FULL_GXP_TYPES],
  checkpoint_metadata: [],
  checkpoint_applicability_matrix: {},
  parameter_card_metadata: [],
  veeva_audit_lookback_days: 30,
  veeva_audit_calendar_boundary_grace_days: 0,
  veeva_audit_extraction_chunk_days: 14,
};

const SOFTWARE_TERMS = [
  "software",
  "it system",
  "application",
  "validated computerized system",
  "validated computerised system",
  "validated system",
  "veeva",
  "vault",
  "lims",
  "qms",
  "dms",
  "mes",
  "ctms",
  "rim",
  "promomats",
  "qualitydocs",
  "trackwise",
  "labware",
  "empower",
  "pas-x",
  "pas x",
];

const SOFTWARE_ASSET_FIELDS = [
  "asset_class",
  "asset_category",
  "asset_sub_category",
  "asset_type",
  "asset_name",
  "tags",
  "description",
  "asset_description",
  "short_description",
] as const;

const SOFTWARE_CLASSIFICATION_FIELDS = [
  "asset_class",
  "asset_category",
  "asset_sub_category",
  "asset_type",
  "asset_nature",
  "tags",
] as const;

const EXPLICIT_SOFTWARE_CLASSIFICATION_TERMS = [
  "software",
  "it system",
  "application",
  "validated computerized system",
  "validated computerised system",
  "computerized system",
  "computerised system",
  "information system",
];

const SOFTWARE_PRODUCT_TERMS = [
  "veeva",
  "vault",
  "qualitydocs",
  "quality docs",
  "promomats",
  "promo mats",
  "lims",
  "qms",
  "dms",
  "mes",
  "ctms",
  "rim",
  "trackwise",
  "labware",
  "empower",
  "pas-x",
  "pas x",
];

const PHYSICAL_ASSET_TERMS = [
  "reactor",
  "sterilizer",
  "steriliser",
  "homogenizer",
  "homogeniser",
  "pump",
  "balance",
  "equipment",
  "process equipment",
  "router",
];

const SOURCE_SYSTEM_FIELDS = [
  "source_system",
  "source_system_name",
  "source_system_display",
  "system_source",
  "system_name",
  "veeva_instance_name",
] as const;

const INACTIVE_TERMS = ["inactive", "retired", "obsolete", "decommissioned", "disposed", "scrapped"];
const SCHEDULE_FREQUENCIES: AuditReviewScheduleFrequency[] = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "HALF_YEARLY",
  "ANNUAL",
];
const REVIEW_WINDOW_DAYS_BY_FREQUENCY: Record<AuditReviewScheduleFrequency, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
  QUARTERLY: 90,
  HALF_YEARLY: 182,
  ANNUAL: 365,
};
const SCHEDULE_END_CONDITION_OPTIONS: Array<{ value: ScheduleEndCondition; label: string }> = [
  { value: "NO_END_DATE", label: "No end date" },
  { value: "END_ON_DATE", label: "End on specific date" },
  { value: "END_AFTER_RUNS", label: "End after number of runs" },
];
const AUDIT_RETRIEVAL_MODE_OPTIONS: Array<{ value: AuditRetrievalMode; label: string }> = [
  { value: "AUTO", label: "Automatic completed period" },
  { value: "SINCE_LAST_SUCCESSFUL", label: "Since last successful run" },
  { value: "CUSTOM", label: "Custom start/end range" },
];
const WEEKDAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];
const MONTH_OPTIONS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];
const CALENDAR_QUARTER_ROWS = [
  { quarter: "Q1", period: "Jan 1 - Mar 31", runsOn: "Apr 1" },
  { quarter: "Q2", period: "Apr 1 - Jun 30", runsOn: "Jul 1" },
  { quarter: "Q3", period: "Jul 1 - Sep 30", runsOn: "Oct 1" },
  { quarter: "Q4", period: "Oct 1 - Dec 31", runsOn: "Jan 1" },
];
const NO_END_QUARTER_VALUE = "NO_END_QUARTER";
const NO_END_HALF_YEAR_VALUE = "NO_END_HALF_YEAR";
const NO_END_ANNUAL_YEAR_VALUE = "NO_END_YEAR";
const TECHNICAL_ACTION_LABELS: Record<string, string> = {
  GetDocumentVersion: "Document Version Retrieved",
  getdocumentversion: "Document Version Retrieved",
};

type TopTab = "dashboard" | "manual" | "schedules" | "jobs" | "approvals" | "notifications" | "history";
type ResultTab = "summary" | "preview" | "findings" | "evidence";
type WorkspaceSection = "scope" | "extraction" | "analysis" | "report" | "approval" | "archive";
type PendingScheduleAction = "disable" | "run-now";
type ScheduleEndCondition = "NO_END_DATE" | "END_ON_DATE" | "END_AFTER_RUNS";
type AuditRetrievalMode = "AUTO" | "SINCE_LAST_SUCCESSFUL" | "CUSTOM";
type ScheduleRunTiming = "FIRST_DAY_AFTER_PERIOD_END" | "CUSTOM_RUN_DAY";
type ScheduleCycleType =
  | "CALENDAR_QUARTER"
  | "CUSTOM_QUARTER_CYCLE"
  | "CALENDAR_HALF_YEAR"
  | "CUSTOM_SIX_MONTH_CYCLE"
  | "CALENDAR_YEAR"
  | "FISCAL_YEAR";
type ReviewDecisionAction = "approve" | "reject" | "request-changes";
type ReportWorkflowAction = ReviewDecisionAction | "submit-review";
type PipelineStepKey =
  | "asset"
  | "created"
  | "extracted"
  | "analyzed";
type PipelineStepStatus = "pending" | "active" | "done" | "warning" | "failed";

const TOP_TAB_LABELS: Record<TopTab, string> = {
  dashboard: "Dashboard",
  manual: "Manual Reviews",
  schedules: "Review Schedules",
  jobs: "Jobs / Runs",
  approvals: "Reports Awaiting Approval",
  notifications: "Notifications",
  history: "History",
};

const WORKSPACE_SECTION_LABELS: Record<WorkspaceSection, string> = {
  scope: "Scope & Job Summary",
  extraction: "Extraction Results",
  analysis: "Analysis Findings",
  report: "Report Preview",
  approval: "Submit / QA Approval",
  archive: "Archived Report",
};

interface ReviewRuntime {
  job: AuditReviewJobDetail;
  report: AuditReviewReportDetail | null;
  findings: AuditReviewFinding[];
  scores: AuditReviewScore[];
  records: AuditTrailRecord[];
  reviewScope: AuditReviewScope;
  selectedAuditTrailTypes: string[];
}

interface RunFormState {
  reviewStart: string;
  reviewEnd: string;
  reviewScope: AuditReviewScope;
  selectedAuditTrailTypes: string[];
  veevaInstanceName: string;
  veevaAppName: string;
}

interface ScheduleFormState {
  enabled: boolean;
  frequency: AuditReviewScheduleFrequency;
  reviewWindowDays: string;
  nextRun: string;
  scheduleStartDate: string;
  startQuarter: string;
  endQuarter: string;
  startHalfYear: string;
  endHalfYear: string;
  startReviewYear: string;
  endReviewYear: string;
  endCondition: ScheduleEndCondition;
  scheduleEndDate: string;
  endAfterRuns: string;
  runTime: string;
  dayOfWeek: string;
  useLastDayOfMonth: boolean;
  cycleType: ScheduleCycleType;
  runTiming: ScheduleRunTiming;
  runMonth: string;
  customCycleStartMonth: string;
  fiscalYearStartMonth: string;
  auditRetrievalMode: AuditRetrievalMode;
  customAuditStart: string;
  customAuditEnd: string;
  timezone: string;
  reviewScope: AuditReviewScope;
  selectedAuditTrailTypes: string[];
  veevaInstanceName: string;
  veevaAppName: string;
  vaultDns: string;
  actor: string;
}

interface PipelineStep {
  key: PipelineStepKey;
  label: string;
  status: PipelineStepStatus;
  message?: string;
}

interface FindingGroup {
  key: string;
  name: string;
  count: number;
  highestSeverity: string;
  recommendedAction: string;
  findings: AuditReviewFinding[];
}

const toDatetimeLocalValue = (date: Date): string => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const metadataLookbackDays = (metadata: AuditReviewMetadata): number =>
  Number.isFinite(metadata.veeva_audit_lookback_days) && Number(metadata.veeva_audit_lookback_days) > 0
    ? Number(metadata.veeva_audit_lookback_days)
    : 30;

const metadataCalendarBoundaryGraceDays = (metadata: AuditReviewMetadata): number =>
  Number.isFinite(metadata.veeva_audit_calendar_boundary_grace_days) &&
  Number(metadata.veeva_audit_calendar_boundary_grace_days) > 0
    ? Number(metadata.veeva_audit_calendar_boundary_grace_days)
    : 0;

const oldestSupportedReviewStart = (metadata: AuditReviewMetadata, reference = new Date()): Date => {
  const lookbackDays = metadataLookbackDays(metadata) + metadataCalendarBoundaryGraceDays(metadata);
  return new Date(reference.getTime() - lookbackDays * MS_PER_DAY);
};

const defaultReviewWindow = (metadata: AuditReviewMetadata = FALLBACK_METADATA): Pick<RunFormState, "reviewStart" | "reviewEnd"> => {
  const end = new Date();
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 0, 0);
  const start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
  const oldestStart = oldestSupportedReviewStart(metadata);
  if (start < oldestStart) {
    start.setTime(oldestStart.getTime());
  }
  return { reviewStart: toDatetimeLocalValue(start), reviewEnd: toDatetimeLocalValue(end) };
};

const buildDefaultRunForm = (metadata: AuditReviewMetadata = FALLBACK_METADATA): RunFormState => ({
  ...defaultReviewWindow(metadata),
  reviewScope: "LOGIN_ONLY",
  selectedAuditTrailTypes: ["login_audit_trail"],
  veevaInstanceName: "Veeva Quality Vault",
  veevaAppName: "QualityDocs",
});

const reviewWindowValidationMessage = (
  metadata: AuditReviewMetadata,
  reviewStart: string,
  reviewEnd: string,
): string | null => {
  if (!reviewStart || !reviewEnd) return null;
  const start = new Date(reviewStart);
  const end = new Date(reviewEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end <= start) return "Review end must be after the start date.";
  const oldestStart = oldestSupportedReviewStart(metadata);
  if (start < oldestStart) {
    const oldestLabel = oldestStart.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Veeva audit extraction supports the last ${metadataLookbackDays(metadata)} day(s). Choose a start on or after ${oldestLabel}.`;
  }
  return null;
};

const initialPipeline = (): PipelineStep[] => [
  { key: "asset", label: "Validate asset", status: "pending" },
  { key: "created", label: "Create review job", status: "pending" },
  { key: "extracted", label: "Extract records", status: "pending" },
  { key: "analyzed", label: "Analyse records", status: "pending" },
];

const updateStep = (
  steps: PipelineStep[],
  key: PipelineStepKey,
  status: PipelineStepStatus,
  message?: string,
): PipelineStep[] => steps.map((step) => (step.key === key ? { ...step, status, message } : step));

const pipelineStepLabels: Record<PipelineStepKey, Partial<Record<PipelineStepStatus, string>>> = {
  asset: {
    pending: "Validate asset",
    active: "Validating asset",
    done: "Asset validated",
    failed: "Asset validation failed",
  },
  created: {
    pending: "Create review job",
    active: "Creating review job",
    done: "Review job created",
    failed: "Review job creation failed",
  },
  extracted: {
    pending: "Extract records",
    active: "Extracting records",
    done: "Records extracted",
    warning: "Records partially extracted",
    failed: "Record extraction failed",
  },
  analyzed: {
    pending: "Analyse records",
    active: "Analysing records",
    done: "Records analysed",
    failed: "Analysis failed",
  },
};

const pipelineStepLabel = (step: PipelineStep): string =>
  pipelineStepLabels[step.key]?.[step.status] || step.label;

const apiErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { message?: string; detail?: string } } }).response;
    return response?.data?.message || response?.data?.detail || "Audit review request failed.";
  }
  return error instanceof Error ? error.message : "Audit review request failed.";
};

const assetField = (asset: AssetRecord, field: string): unknown =>
  (asset as Record<string, unknown>)[field];

const textValue = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const items = value.map(textValue).filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(" ") : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

const normalizedText = (...values: unknown[]): string =>
  values
    .map(textValue)
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase()
    .replace(/[_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasTerm = (text: string, term: string): boolean => {
  if (!text || !term) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}([^a-z0-9]|$)`).test(text);
};

const hasAnyTerm = (text: string, terms: string[]): boolean => terms.some((term) => hasTerm(text, term));

const isActiveAsset = (asset: AssetRecord): boolean => {
  const status = normalizedText(asset.asset_status, assetField(asset, "status"), assetField(asset, "lifecycle_state"));
  return !INACTIVE_TERMS.some((term) => status.includes(term));
};

const isValidatedSoftwareAsset = (asset: AssetRecord): boolean => {
  if (!isActiveAsset(asset)) return false;

  const classification = normalizedText(...SOFTWARE_CLASSIFICATION_FIELDS.map((field) => assetField(asset, field)));
  const allSignals = normalizedText(
    ...SOFTWARE_ASSET_FIELDS.map((field) => assetField(asset, field)),
    ...SOURCE_SYSTEM_FIELDS.map((field) => assetField(asset, field)),
  );
  const hasExplicitSoftwareSignal =
    hasAnyTerm(classification, EXPLICIT_SOFTWARE_CLASSIFICATION_TERMS) ||
    hasAnyTerm(allSignals, EXPLICIT_SOFTWARE_CLASSIFICATION_TERMS) ||
    hasAnyTerm(allSignals, SOFTWARE_PRODUCT_TERMS);
  const hasSoftwareSignal = hasAnyTerm(allSignals, SOFTWARE_TERMS) || hasAnyTerm(allSignals, SOFTWARE_PRODUCT_TERMS);
  const hasPhysicalSignal = hasAnyTerm(allSignals, PHYSICAL_ASSET_TERMS);

  if (!hasSoftwareSignal) return false;
  if (hasPhysicalSignal && !hasExplicitSoftwareSignal) return false;
  return true;
};

const assetNameLabel = (asset: AssetRecord | null): string =>
  textValue(asset?.asset_name) || textValue(asset?.asset_id) || textValue(asset?.asset_code) || "Untitled asset";

const assetIdLabel = (asset: AssetRecord | null): string =>
  textValue(asset?.asset_id) || textValue(asset?.asset_code) || textValue(asset?.asset_uuid) || "No asset ID";

const assetSelectionId = (asset: AssetRecord): string =>
  textValue(asset.asset_uuid) || textValue(assetField(asset, "uuid")) || textValue(asset.asset_id) || "";

const assetSourceSystemLabel = (asset: AssetRecord): string | null =>
  SOURCE_SYSTEM_FIELDS.map((field) => textValue(assetField(asset, field))).find(Boolean) ?? null;

const assetStatusLabel = (asset: AssetRecord): string | null => {
  const status = textValue(asset.asset_status) || textValue(assetField(asset, "status")) || textValue(assetField(asset, "lifecycle_state"));
  return status ? formatAuditReviewLabel(status) : null;
};

const uniqueTextParts = (...parts: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>();
  return parts.reduce<string[]>((items, part) => {
    const value = part?.trim();
    if (!value) return items;
    const key = value.toLowerCase();
    if (seen.has(key)) return items;
    seen.add(key);
    items.push(value);
    return items;
  }, []);
};

const assetPrimaryLabel = (asset: AssetRecord): string => `${assetNameLabel(asset)} — ${assetIdLabel(asset)}`;

const assetSecondaryLabel = (asset: AssetRecord): string => {
  const parts = uniqueTextParts(
    textValue(asset.org_node_name),
    assetStatusLabel(asset),
    textValue(asset.criticality_class) || textValue(asset.asset_criticality),
    assetSourceSystemLabel(asset),
  );
  return parts.join(" · ");
};

const assetSearchLabel = (asset: AssetRecord): string =>
  normalizedText(
    assetPrimaryLabel(asset),
    assetSecondaryLabel(asset),
    asset.asset_class,
    asset.asset_category,
    asset.asset_sub_category,
    asset.asset_type,
    asset.tags,
    asset.asset_description,
    asset.short_description,
  );

const sameStringSet = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((item) => rightSet.has(item));
};

const toUtcIso = (value: string): string => new Date(value).toISOString();

const selectedTypesForScope = (
  metadata: AuditReviewMetadata,
  scope: AuditReviewScope,
  customTypes: string[],
): string[] => {
  if (scope === "CUSTOM") return customTypes;
  const scopeMetadata = metadata.review_scopes.find((item) => item.code === scope);
  return scopeMetadata?.audit_trail_types?.length ? scopeMetadata.audit_trail_types : ["login_audit_trail"];
};

const toDateInputValue = (date: Date): string => toDatetimeLocalValue(date).slice(0, 10);

const defaultScheduleStartDate = (): string => toDateInputValue(new Date());

const defaultAuditRetrievalMode = (_frequency: AuditReviewScheduleFrequency): AuditRetrievalMode => "AUTO";

const auditRetrievalModeOptionsForFrequency = (
  frequency: AuditReviewScheduleFrequency,
): Array<{ value: AuditRetrievalMode; label: string }> => {
  if (frequency === "QUARTERLY" || frequency === "MONTHLY" || frequency === "ANNUAL") {
    return AUDIT_RETRIEVAL_MODE_OPTIONS.filter((option) => option.value === "AUTO");
  }
  return AUDIT_RETRIEVAL_MODE_OPTIONS.filter((option) => option.value !== "SINCE_LAST_SUCCESSFUL");
};

const auditRetrievalModeLabel = (
  mode: AuditRetrievalMode,
  frequency: AuditReviewScheduleFrequency,
): string =>
  auditRetrievalModeOptionsForFrequency(frequency).find((option) => option.value === mode)?.label ??
  AUDIT_RETRIEVAL_MODE_OPTIONS.find((option) => option.value === mode)?.label ??
  formatAuditReviewLabel(mode);

const defaultCycleType = (frequency: AuditReviewScheduleFrequency): ScheduleCycleType => {
  if (frequency === "QUARTERLY") return "CALENDAR_QUARTER";
  if (frequency === "HALF_YEARLY") return "CALENDAR_HALF_YEAR";
  if (frequency === "ANNUAL") return "CALENDAR_YEAR";
  return "CALENDAR_QUARTER";
};

const parseOptionalInt = (value: string | number | null | undefined): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const coerceEndCondition = (value?: string | null): ScheduleEndCondition => {
  if (value === "END_ON_DATE" || value === "END_AFTER_RUNS") return value;
  return "NO_END_DATE";
};

const coerceAuditRetrievalMode = (
  value: string | null | undefined,
  frequency: AuditReviewScheduleFrequency,
  customAuditStart?: string | null,
  customAuditEnd?: string | null,
): AuditRetrievalMode => {
  if (frequency === "QUARTERLY" || frequency === "MONTHLY") return "AUTO";
  if (value === "CUSTOM" || (customAuditStart && customAuditEnd)) return "CUSTOM";
  if (value === "AUTO") return "AUTO";
  return "AUTO";
};

const coerceRunTiming = (value?: string | null): ScheduleRunTiming =>
  value === "CUSTOM_RUN_DAY" ? "CUSTOM_RUN_DAY" : "FIRST_DAY_AFTER_PERIOD_END";

const coerceCycleType = (
  value: string | null | undefined,
  frequency: AuditReviewScheduleFrequency,
): ScheduleCycleType => {
  const allowed: ScheduleCycleType[] =
    frequency === "QUARTERLY"
      ? ["CALENDAR_QUARTER"]
      : frequency === "HALF_YEARLY"
        ? ["CALENDAR_HALF_YEAR", "CUSTOM_SIX_MONTH_CYCLE"]
        : frequency === "ANNUAL"
          ? ["CALENDAR_YEAR", "FISCAL_YEAR"]
          : [];
  return allowed.includes(value as ScheduleCycleType) ? (value as ScheduleCycleType) : defaultCycleType(frequency);
};

const toDateInputFromIso = (value?: string | null, fallback = defaultScheduleStartDate()): string => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : toDateInputValue(parsed);
};

const toTimeInputFromIso = (value?: string | null, fallback = "09:00"): string => {
  if (!value) return fallback;
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : toDatetimeLocalValue(parsed).slice(11, 16);
};

const toDatetimeLocalInputFromIso = (value?: string | null): string => {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : toDatetimeLocalValue(parsed);
};

const defaultScheduleNextRun = (): string => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return toDatetimeLocalValue(next);
};

const toDatetimeLocalInput = (value?: string | null): string => {
  if (!value) return defaultScheduleNextRun();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? defaultScheduleNextRun() : toDatetimeLocalValue(parsed);
};

const fallbackScheduleAuditRange = (
  frequency: AuditReviewScheduleFrequency,
  nextRunInput: string,
): { start: string; end: string } => {
  const fallbackEnd = new Date(nextRunInput || defaultScheduleNextRun());
  const end = Number.isNaN(fallbackEnd.getTime()) ? new Date() : fallbackEnd;
  const start = addDays(end, -(REVIEW_WINDOW_DAYS_BY_FREQUENCY[frequency] ?? REVIEW_WINDOW_DAYS_BY_FREQUENCY.MONTHLY));
  return {
    start: toDatetimeLocalValue(start),
    end: toDatetimeLocalValue(end),
  };
};

const buildDefaultScheduleForm = (
  schedule?: AuditReviewSchedule | null,
  actor?: string | null,
  asset?: AssetRecord | null,
): ScheduleFormState => {
  const frequency = schedule?.frequency ?? "MONTHLY";
  const nextRunInput = toDatetimeLocalInput(schedule?.next_run_dt);
  const runTime = schedule?.run_time ?? toTimeInputFromIso(schedule?.next_run_dt, "09:00");
  const fallbackAuditRange = fallbackScheduleAuditRange(frequency, nextRunInput);
  const selectedAuditTrailTypes = schedule?.selected_audit_trail_types?.length
    ? schedule.selected_audit_trail_types
    : schedule
      ? [schedule.audit_trail_type ?? "login_audit_trail"]
      : [...FULL_GXP_TYPES];
  const sourceSystem = asset ? assetSourceSystemLabel(asset) : null;
  const vaultDns = asset ? textValue(assetField(asset, "vault_dns")) : null;
  const timezone = schedule?.timezone ?? "Asia/Kolkata";
  const scheduleStartDate = toDateInputFromIso(schedule?.schedule_start_dt ?? schedule?.next_run_dt, defaultScheduleStartDate());
  const cycleType = frequency === "QUARTERLY"
    ? "CALENDAR_QUARTER"
    : frequency === "ANNUAL"
      ? "CALENDAR_YEAR"
      : coerceCycleType(schedule?.cycle_type, frequency);
  const customCycleStartMonth = schedule?.custom_cycle_start_month ? String(schedule.custom_cycle_start_month) : "1";
  return {
    enabled: schedule?.enabled ?? true,
    frequency,
    reviewWindowDays: schedule?.review_window_days ? String(schedule.review_window_days) : String(REVIEW_WINDOW_DAYS_BY_FREQUENCY[frequency]),
    nextRun: nextRunInput,
    scheduleStartDate,
    startQuarter: startQuarterForSchedule(schedule, timezone),
    endQuarter: endQuarterForSchedule(schedule, timezone),
    startHalfYear: startHalfYearForSchedule(schedule, timezone),
    endHalfYear: endHalfYearForSchedule(schedule, timezone),
    startReviewYear: startReviewYearForSchedule(schedule, timezone),
    endReviewYear: endReviewYearForSchedule(schedule, timezone),
    endCondition: coerceEndCondition(schedule?.end_condition),
    scheduleEndDate: toDateInputFromIso(schedule?.schedule_end_dt, ""),
    endAfterRuns: schedule?.end_after_runs ? String(schedule.end_after_runs) : "12",
    runTime,
    dayOfWeek: schedule?.day_of_week != null ? String(schedule.day_of_week) : String(new Date(schedule?.next_run_dt ?? Date.now()).getDay()),
    useLastDayOfMonth: false,
    cycleType,
    runTiming: frequency === "QUARTERLY" ? "FIRST_DAY_AFTER_PERIOD_END" : coerceRunTiming(schedule?.run_timing),
    runMonth: schedule?.run_month ? String(schedule.run_month) : "1",
    customCycleStartMonth,
    fiscalYearStartMonth: schedule?.fiscal_year_start_month ? String(schedule.fiscal_year_start_month) : "1",
    auditRetrievalMode: frequency === "ANNUAL"
      ? "AUTO"
      : coerceAuditRetrievalMode(
          schedule?.audit_retrieval_mode,
          frequency,
          schedule?.custom_audit_start_dt,
          schedule?.custom_audit_end_dt,
        ),
    customAuditStart: toDatetimeLocalInputFromIso(schedule?.custom_audit_start_dt) || fallbackAuditRange.start,
    customAuditEnd: toDatetimeLocalInputFromIso(schedule?.custom_audit_end_dt) || fallbackAuditRange.end,
    timezone,
    reviewScope: schedule?.review_scope ?? "FULL_GXP",
    selectedAuditTrailTypes,
    veevaInstanceName: schedule?.veeva_instance_name ?? sourceSystem ?? "Veeva Quality Vault",
    veevaAppName: schedule?.veeva_app_name ?? "QualityDocs",
    vaultDns: schedule?.vault_dns ?? vaultDns ?? "",
    actor: schedule?.modified_by ?? schedule?.created_by ?? (actor?.trim() || asset?.asset_owner || ""),
  };
};

const scoreLabelForSelection = (scope?: string | null, selectedTypes: string[] = []): string => {
  const allFullTypes = FULL_GXP_TYPES.every((type) => selectedTypes.includes(type)) && selectedTypes.length === FULL_GXP_TYPES.length;
  if (allFullTypes) return "Full GxP Audit Trail Score";
  if (selectedTypes.length === 1) {
    if (selectedTypes[0] === "login_audit_trail") return "Login Audit Trail Score";
    if (selectedTypes[0] === "document_audit_trail") return "Document Audit Trail Score";
    if (selectedTypes[0] === "object_audit_trail") return "Object Audit Trail Score";
    if (selectedTypes[0] === "system_audit_trail") return "System Audit Trail Score";
    if (selectedTypes[0] === "domain_audit_trail") return "Domain Audit Trail Score";
  }
  if (scope === "LOGIN_ONLY") return "Login Audit Trail Score";
  if (scope === "DOCUMENT_ONLY") return "Document Audit Trail Score";
  if (scope === "OBJECT_ONLY") return "Object Audit Trail Score";
  if (scope === "SYSTEM_ONLY") return "System Audit Trail Score";
  if (scope === "DOMAIN_ONLY") return "Domain Audit Trail Score";
  return "Custom Audit Trail Review Score";
};

const combineLocalDateAndTime = (dateValue: string, timeValue: string): Date | null => {
  if (!dateValue || !timeValue) return null;
  const parsed = new Date(`${dateValue}T${timeValue}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const dateAtTime = (year: number, monthIndex: number, day: number, timeValue: string): Date => {
  const [hourText, minuteText] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return new Date(year, monthIndex, day, Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
};

const lastDayOfMonth = (year: number, monthIndex: number): number => new Date(year, monthIndex + 1, 0).getDate();

const candidateDayOfMonth = (year: number, monthIndex: number, form: ScheduleFormState): number => {
  void year;
  void monthIndex;
  void form;
  return 1;
};

const addDays = (value: Date, days: number): Date => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

interface TimeZoneDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const browserTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const safeTimeZone = (value?: string | null): string => {
  const timezone = value?.trim() || browserTimeZone();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return browserTimeZone();
  }
};

const parseDateInputParts = (value: string): Pick<TimeZoneDateParts, "year" | "month" | "day"> | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
};

const parseTimeInputParts = (value: string): Pick<TimeZoneDateParts, "hour" | "minute"> | null => {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

const parseDatetimeLocalInputParts = (value: string): TimeZoneDateParts | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const dateParts = parseDateInputParts(`${match[1]}-${match[2]}-${match[3]}`);
  const timeParts = parseTimeInputParts(`${match[4]}:${match[5]}`);
  if (!dateParts || !timeParts) return null;
  return { ...dateParts, ...timeParts, second: 0 };
};

const timeZoneParts = (value: Date, timezoneValue?: string | null): TimeZoneDateParts => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timezoneValue),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(value).reduce<Record<string, string>>((items, part) => {
    if (part.type !== "literal") items[part.type] = part.value;
    return items;
  }, {});
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

const timeZoneOffsetMs = (timezone: string, value: Date): number => {
  const parts = timeZoneParts(value, timezone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - value.getTime();
};

const zonedDateTimeToDate = (
  dateParts: Pick<TimeZoneDateParts, "year" | "month" | "day">,
  timeParts: Pick<TimeZoneDateParts, "hour" | "minute"> & Partial<Pick<TimeZoneDateParts, "second">>,
  timezoneValue?: string | null,
): Date => {
  const timezone = safeTimeZone(timezoneValue);
  const utcGuess = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second ?? 0,
  );
  const firstPass = new Date(utcGuess - timeZoneOffsetMs(timezone, new Date(utcGuess)));
  return new Date(utcGuess - timeZoneOffsetMs(timezone, firstPass));
};

const datetimeLocalInputToDate = (value: string, timezoneValue?: string | null): Date | null => {
  const parts = parseDatetimeLocalInputParts(value);
  if (!parts) return null;
  return zonedDateTimeToDate(parts, parts, timezoneValue);
};

const addCalendarDays = (
  dateParts: Pick<TimeZoneDateParts, "year" | "month" | "day">,
  days: number,
): Pick<TimeZoneDateParts, "year" | "month" | "day"> => {
  const shifted = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

const addCalendarMonths = (
  dateParts: Pick<TimeZoneDateParts, "year" | "month" | "day">,
  months: number,
): Pick<TimeZoneDateParts, "year" | "month" | "day"> => {
  const shifted = new Date(Date.UTC(dateParts.year, dateParts.month - 1 + months, dateParts.day));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

const scheduleStartDayForForm = (form: ScheduleFormState): Date | null => {
  const scheduleStartParts = parseDateInputParts(form.scheduleStartDate);
  if (!scheduleStartParts) return null;
  return zonedDateTimeToDate(scheduleStartParts, { hour: 0, minute: 0, second: 0 }, form.timezone);
};

const monthlyScheduleBaseDate = (form: ScheduleFormState, now = new Date()): Date | null => {
  const scheduleStart = scheduleStartDayForForm(form);
  if (!scheduleStart) return null;
  return scheduleStart.getTime() > now.getTime() ? scheduleStart : now;
};

const previousCompletedDayRange = (nextRun: Date, timezone: string): { start: Date; end: Date } => {
  const runParts = timeZoneParts(nextRun, timezone);
  const previousDay = addCalendarDays(runParts, -1);
  return {
    start: zonedDateTimeToDate(previousDay, { hour: 0, minute: 0, second: 0 }, timezone),
    end: zonedDateTimeToDate(previousDay, { hour: 23, minute: 59, second: 59 }, timezone),
  };
};

const previousCompletedWeekRange = (nextRun: Date, timezone: string): { start: Date; end: Date } => {
  const runParts = timeZoneParts(nextRun, timezone);
  const periodEndDay = addCalendarDays(runParts, -1);
  const periodStartDay = addCalendarDays(periodEndDay, -6);
  return {
    start: zonedDateTimeToDate(periodStartDay, { hour: 0, minute: 0, second: 0 }, timezone),
    end: zonedDateTimeToDate(periodEndDay, { hour: 23, minute: 59, second: 59 }, timezone),
  };
};

const previousMonthRange = (nextRun: Date, timezone: string): { start: Date; end: Date } => {
  const runParts = timeZoneParts(nextRun, timezone);
  const previousMonthStart = addCalendarMonths({ year: runParts.year, month: runParts.month, day: 1 }, -1);
  const previousMonthEndDate = new Date(Date.UTC(runParts.year, runParts.month - 1, 0));
  const previousMonthEnd = {
    year: previousMonthEndDate.getUTCFullYear(),
    month: previousMonthEndDate.getUTCMonth() + 1,
    day: previousMonthEndDate.getUTCDate(),
  };
  return {
    start: zonedDateTimeToDate(previousMonthStart, { hour: 0, minute: 0, second: 0 }, timezone),
    end: zonedDateTimeToDate(previousMonthEnd, { hour: 23, minute: 59, second: 59 }, timezone),
  };
};

const clampMonthlyRangeToScheduleStart = (
  range: { start: Date; end: Date },
  form: ScheduleFormState,
): { start: Date; end: Date; clamped: boolean } | null => {
  const scheduleStart = scheduleStartDayForForm(form);
  if (!scheduleStart) return { ...range, clamped: false };
  if (range.end.getTime() < scheduleStart.getTime()) return null;
  if (scheduleStart.getTime() > range.start.getTime() && scheduleStart.getTime() <= range.end.getTime()) {
    return { start: scheduleStart, end: range.end, clamped: true };
  }
  return { ...range, clamped: false };
};

const previousQuarterRange = (nextRun: Date, timezone: string): { start: Date; end: Date } => {
  const runParts = timeZoneParts(nextRun, timezone);
  const currentQuarterStartMonth = Math.floor((runParts.month - 1) / 3) * 3 + 1;
  const currentQuarterStart = { year: runParts.year, month: currentQuarterStartMonth, day: 1 };
  const previousQuarterStart = addCalendarMonths(currentQuarterStart, -3);
  const previousQuarterEndDate = new Date(Date.UTC(currentQuarterStart.year, currentQuarterStart.month - 1, 0));
  const previousQuarterEnd = {
    year: previousQuarterEndDate.getUTCFullYear(),
    month: previousQuarterEndDate.getUTCMonth() + 1,
    day: previousQuarterEndDate.getUTCDate(),
  };
  return {
    start: zonedDateTimeToDate(previousQuarterStart, { hour: 0, minute: 0, second: 0 }, timezone),
    end: zonedDateTimeToDate(previousQuarterEnd, { hour: 23, minute: 59, second: 59 }, timezone),
  };
};

const parseQuarterValue = (value: string): { year: number; quarter: number } | null => {
  const match = /^(\d{4})-Q([1-4])$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), quarter: Number(match[2]) };
};

const quarterIndex = (value: string): number => {
  const parsed = parseQuarterValue(value);
  return parsed ? parsed.year * 4 + parsed.quarter - 1 : Number.MAX_SAFE_INTEGER;
};

const addQuartersToValue = (value: string, quarters: number): string => {
  const parsed = parseQuarterValue(value);
  if (!parsed) return value;
  const nextIndex = quarterIndex(value) + quarters;
  const year = Math.floor(nextIndex / 4);
  const quarter = (nextIndex % 4) + 1;
  return `${year}-Q${quarter}`;
};

const quarterLabelFromValue = (value: string): string => {
  const parsed = parseQuarterValue(value);
  return parsed ? `Q${parsed.quarter} ${parsed.year}` : value || "-";
};

const quarterValueFromParts = (parts: Pick<TimeZoneDateParts, "year" | "month">): string =>
  `${parts.year}-Q${Math.floor((parts.month - 1) / 3) + 1}`;

const quarterValueFromDate = (value: Date, timezone: string): string =>
  quarterValueFromParts(timeZoneParts(value, timezone));

const defaultStartQuarterValue = (timezoneValue?: string | null): string =>
  quarterValueFromParts(timeZoneParts(new Date(), safeTimeZone(timezoneValue)));

const startQuarterForSchedule = (schedule: AuditReviewSchedule | null | undefined, timezoneValue?: string | null): string => {
  const timezone = safeTimeZone(timezoneValue);
  if (schedule?.schedule_start_dt) {
    const scheduleStart = new Date(schedule.schedule_start_dt);
    if (!Number.isNaN(scheduleStart.getTime())) return quarterValueFromDate(scheduleStart, timezone);
  }
  if (schedule?.next_run_dt) {
    const nextRun = new Date(schedule.next_run_dt);
    if (!Number.isNaN(nextRun.getTime())) return quarterValueFromDate(previousQuarterRange(nextRun, timezone).start, timezone);
  }
  return defaultStartQuarterValue(timezone);
};

const endQuarterForSchedule = (schedule: AuditReviewSchedule | null | undefined, timezoneValue?: string | null): string => {
  const timezone = safeTimeZone(timezoneValue);
  if (!schedule?.schedule_end_dt) return NO_END_QUARTER_VALUE;
  const scheduleEnd = new Date(schedule.schedule_end_dt);
  if (Number.isNaN(scheduleEnd.getTime())) return NO_END_QUARTER_VALUE;
  return quarterValueFromDate(previousQuarterRange(scheduleEnd, timezone).start, timezone);
};

const calendarQuarterRange = (
  quarterValue: string,
  timezoneValue?: string | null,
): { start: Date; end: Date } | null => {
  const parsed = parseQuarterValue(quarterValue);
  if (!parsed) return null;
  const timezone = safeTimeZone(timezoneValue);
  const startMonth = (parsed.quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return {
    start: zonedDateTimeToDate({ year: parsed.year, month: startMonth, day: 1 }, { hour: 0, minute: 0, second: 0 }, timezone),
    end: zonedDateTimeToDate(
      { year: parsed.year, month: endMonth, day: lastDayOfMonth(parsed.year, endMonth - 1) },
      { hour: 23, minute: 59, second: 59 },
      timezone,
    ),
  };
};

const calendarQuarterRunDate = (
  quarterValue: string,
  runTime: string,
  timezoneValue?: string | null,
): Date | null => {
  const parsed = parseQuarterValue(quarterValue);
  const runTimeParts = parseTimeInputParts(runTime);
  if (!parsed || !runTimeParts) return null;
  const startMonth = (parsed.quarter - 1) * 3 + 1;
  const runDay = addCalendarMonths({ year: parsed.year, month: startMonth, day: 1 }, 3);
  return zonedDateTimeToDate(runDay, { ...runTimeParts, second: 0 }, timezoneValue);
};

const quarterlyStartOptions = (
  selectedValue: string,
  timezoneValue?: string | null,
): Array<{ value: string; label: string }> => {
  const currentParts = timeZoneParts(new Date(), safeTimeZone(timezoneValue));
  const firstValue = `${currentParts.year}-Q1`;
  const values = new Set<string>();
  for (let offset = 0; offset < 24; offset += 1) {
    values.add(addQuartersToValue(firstValue, offset));
  }
  if (selectedValue) values.add(selectedValue);
  return Array.from(values)
    .sort((left, right) => quarterIndex(left) - quarterIndex(right))
    .map((value) => ({ value, label: quarterLabelFromValue(value) }));
};

const quarterlyEndOptions = (
  startValue: string,
  selectedValue: string,
  timezoneValue?: string | null,
): Array<{ value: string; label: string }> => [
  { value: NO_END_QUARTER_VALUE, label: "No end quarter" },
  ...quarterlyStartOptions(selectedValue === NO_END_QUARTER_VALUE ? startValue : selectedValue, timezoneValue),
];

const selectedEndQuarterLabel = (value: string): string =>
  value === NO_END_QUARTER_VALUE ? "No end quarter" : quarterLabelFromValue(value);

const parseHalfYearValue = (value: string): { year: number; month: number } | null => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
};

const halfYearValue = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;

const halfYearIndex = (value: string): number => {
  const parsed = parseHalfYearValue(value);
  return parsed ? parsed.year * 12 + parsed.month - 1 : Number.MAX_SAFE_INTEGER;
};

const monthShortLabel = (month: number): string =>
  new Date(2000, Math.max(0, Math.min(month - 1, 11)), 1).toLocaleString("en-US", { month: "short" });

const halfYearEndParts = (value: string): Pick<TimeZoneDateParts, "year" | "month" | "day"> | null => {
  const parsed = parseHalfYearValue(value);
  if (!parsed) return null;
  const endMonth = addCalendarMonths({ year: parsed.year, month: parsed.month, day: 1 }, 5);
  return {
    ...endMonth,
    day: lastDayOfMonth(endMonth.year, endMonth.month - 1),
  };
};

const halfYearMonthSpanLabel = (value: string): string => {
  const parsed = parseHalfYearValue(value);
  const end = halfYearEndParts(value);
  if (!parsed || !end) return value || "-";
  return `${monthShortLabel(parsed.month)}-${monthShortLabel(end.month)}`;
};

const halfYearPeriodLabel = (value: string): string => {
  const parsed = parseHalfYearValue(value);
  const end = halfYearEndParts(value);
  if (!parsed || !end) return value || "-";
  const yearLabel = end.year === parsed.year ? `${parsed.year}` : `${parsed.year}-${String(end.year).slice(-2)}`;
  return `${halfYearMonthSpanLabel(value)} ${yearLabel}`;
};

const halfYearTypeLabel = (cycleType: ScheduleCycleType): string =>
  cycleType === "CUSTOM_SIX_MONTH_CYCLE" ? "Custom Six-Month Cycle" : "Calendar Half-Year";

const halfYearOptionLabel = (value: string, cycleType: ScheduleCycleType): string => {
  const parsed = parseHalfYearValue(value);
  if (!parsed) return value || "-";
  if (cycleType === "CALENDAR_HALF_YEAR") {
    const half = parsed.month <= 6 ? "H1" : "H2";
    return `${half} ${parsed.year} ${halfYearMonthSpanLabel(value)}`;
  }
  return halfYearPeriodLabel(value);
};

const addHalfYearsToValue = (value: string, halfYears: number): string => {
  const parsed = parseHalfYearValue(value);
  if (!parsed) return value;
  const shifted = addCalendarMonths({ year: parsed.year, month: parsed.month, day: 1 }, halfYears * 6);
  return halfYearValue(shifted.year, shifted.month);
};

const halfYearValueFromLocalParts = (
  parts: Pick<TimeZoneDateParts, "year" | "month" | "day">,
  cycleType: ScheduleCycleType,
  customStartMonthValue: string | number | null | undefined,
): string => {
  if (cycleType !== "CUSTOM_SIX_MONTH_CYCLE") {
    return halfYearValue(parts.year, parts.month <= 6 ? 1 : 7);
  }
  const startMonth = Math.max(1, Math.min(parseOptionalInt(customStartMonthValue) ?? 1, 12));
  const referenceIndex = parts.year * 12 + parts.month - 1;
  const starts: string[] = [];
  for (let year = parts.year - 2; year <= parts.year + 1; year += 1) {
    let cursor = { year, month: startMonth, day: 1 };
    for (let offset = 0; offset < 4; offset += 1) {
      starts.push(halfYearValue(cursor.year, cursor.month));
      cursor = addCalendarMonths(cursor, 6);
    }
  }
  return starts
    .filter((candidate) => halfYearIndex(candidate) <= referenceIndex)
    .sort((left, right) => halfYearIndex(right) - halfYearIndex(left))[0] ?? halfYearValue(parts.year, startMonth);
};

const halfYearValueFromDate = (
  value: Date,
  timezoneValue: string,
  cycleType: ScheduleCycleType,
  customStartMonthValue: string | number | null | undefined,
): string => halfYearValueFromLocalParts(timeZoneParts(value, timezoneValue), cycleType, customStartMonthValue);

const halfYearValueBeforeRunDate = (
  value: Date,
  timezoneValue: string,
  cycleType: ScheduleCycleType,
  customStartMonthValue: string | number | null | undefined,
): string => {
  const runParts = timeZoneParts(value, timezoneValue);
  const previousDay = addCalendarDays(runParts, -1);
  return halfYearValueFromLocalParts(previousDay, cycleType, customStartMonthValue);
};

const defaultStartHalfYearValue = (
  timezoneValue?: string | null,
  cycleType: ScheduleCycleType = "CALENDAR_HALF_YEAR",
  customStartMonthValue: string | number | null | undefined = 1,
): string => {
  const currentParts = timeZoneParts(new Date(), safeTimeZone(timezoneValue));
  if (cycleType === "CALENDAR_HALF_YEAR") return halfYearValueFromLocalParts(currentParts, cycleType, customStartMonthValue);
  return halfYearValueFromLocalParts(currentParts, cycleType, customStartMonthValue);
};

const startHalfYearForSchedule = (schedule: AuditReviewSchedule | null | undefined, timezoneValue?: string | null): string => {
  const timezone = safeTimeZone(timezoneValue);
  const cycleType = coerceCycleType(schedule?.cycle_type, "HALF_YEARLY");
  const customStartMonth = schedule?.custom_cycle_start_month ?? 1;
  if (schedule?.schedule_start_dt) {
    const scheduleStart = new Date(schedule.schedule_start_dt);
    if (!Number.isNaN(scheduleStart.getTime())) return halfYearValueFromDate(scheduleStart, timezone, cycleType, customStartMonth);
  }
  if (schedule?.next_run_dt) {
    const nextRun = new Date(schedule.next_run_dt);
    if (!Number.isNaN(nextRun.getTime())) return halfYearValueBeforeRunDate(nextRun, timezone, cycleType, customStartMonth);
  }
  return defaultStartHalfYearValue(timezone, cycleType, customStartMonth);
};

const endHalfYearForSchedule = (schedule: AuditReviewSchedule | null | undefined, timezoneValue?: string | null): string => {
  const timezone = safeTimeZone(timezoneValue);
  if (!schedule?.schedule_end_dt) return NO_END_HALF_YEAR_VALUE;
  const scheduleEnd = new Date(schedule.schedule_end_dt);
  if (Number.isNaN(scheduleEnd.getTime())) return NO_END_HALF_YEAR_VALUE;
  const cycleType = coerceCycleType(schedule?.cycle_type, "HALF_YEARLY");
  return halfYearValueBeforeRunDate(scheduleEnd, timezone, cycleType, schedule?.custom_cycle_start_month ?? 1);
};

const halfYearRange = (
  halfYear: string,
  timezoneValue?: string | null,
): { start: Date; end: Date } | null => {
  const parsed = parseHalfYearValue(halfYear);
  const end = halfYearEndParts(halfYear);
  if (!parsed || !end) return null;
  const timezone = safeTimeZone(timezoneValue);
  return {
    start: zonedDateTimeToDate({ year: parsed.year, month: parsed.month, day: 1 }, { hour: 0, minute: 0, second: 0 }, timezone),
    end: zonedDateTimeToDate(end, { hour: 23, minute: 59, second: 59 }, timezone),
  };
};

const halfYearRunDate = (
  halfYear: string,
  runTime: string,
  timezoneValue?: string | null,
): Date | null => {
  const parsed = parseHalfYearValue(halfYear);
  const runTimeParts = parseTimeInputParts(runTime);
  if (!parsed || !runTimeParts) return null;
  const runDay = addCalendarMonths({ year: parsed.year, month: parsed.month, day: 1 }, 6);
  return zonedDateTimeToDate(runDay, { ...runTimeParts, second: 0 }, timezoneValue);
};

const halfYearStartOptions = (
  selectedValue: string,
  cycleType: ScheduleCycleType,
  customStartMonthValue: string,
  timezoneValue?: string | null,
): Array<{ value: string; label: string }> => {
  const currentValue = defaultStartHalfYearValue(timezoneValue, cycleType, customStartMonthValue);
  const firstValue = cycleType === "CUSTOM_SIX_MONTH_CYCLE" ? addHalfYearsToValue(currentValue, -1) : currentValue;
  const values = new Set<string>();
  for (let offset = 0; offset < 24; offset += 1) {
    values.add(addHalfYearsToValue(firstValue, offset));
  }
  if (selectedValue) values.add(selectedValue);
  return Array.from(values)
    .sort((left, right) => halfYearIndex(left) - halfYearIndex(right))
    .map((value) => ({ value, label: halfYearOptionLabel(value, cycleType) }));
};

const halfYearEndOptions = (
  startValue: string,
  selectedValue: string,
  cycleType: ScheduleCycleType,
  customStartMonthValue: string,
): Array<{ value: string; label: string }> => {
  const values = new Set<string>();
  const seed = parseHalfYearValue(startValue) ? startValue : defaultStartHalfYearValue(undefined, cycleType, customStartMonthValue);
  for (let offset = 0; offset < 24; offset += 1) {
    values.add(addHalfYearsToValue(seed, offset));
  }
  if (selectedValue && selectedValue !== NO_END_HALF_YEAR_VALUE) values.add(selectedValue);
  return [
    { value: NO_END_HALF_YEAR_VALUE, label: "No end half-year" },
    ...Array.from(values)
      .sort((left, right) => halfYearIndex(left) - halfYearIndex(right))
      .map((value) => ({ value, label: halfYearOptionLabel(value, cycleType) })),
  ];
};

const selectedEndHalfYearLabel = (value: string): string =>
  value === NO_END_HALF_YEAR_VALUE ? "No end half-year" : halfYearPeriodLabel(value);

const parseReviewYear = (value: string): number | null => {
  if (!/^\d{4}$/.test(value)) return null;
  const year = Number(value);
  return Number.isInteger(year) ? year : null;
};

const defaultStartReviewYearValue = (timezoneValue?: string | null): string =>
  String(timeZoneParts(new Date(), safeTimeZone(timezoneValue)).year);

const annualReviewYearBeforeRunDate = (value: Date, timezoneValue?: string | null): string => {
  const runParts = timeZoneParts(value, safeTimeZone(timezoneValue));
  const previousDay = addCalendarDays(runParts, -1);
  return String(previousDay.year);
};

const startReviewYearForSchedule = (schedule: AuditReviewSchedule | null | undefined, timezoneValue?: string | null): string => {
  const timezone = safeTimeZone(timezoneValue);
  if (schedule?.schedule_start_dt) {
    const scheduleStart = new Date(schedule.schedule_start_dt);
    if (!Number.isNaN(scheduleStart.getTime())) return String(timeZoneParts(scheduleStart, timezone).year);
  }
  if (schedule?.next_run_dt) {
    const nextRun = new Date(schedule.next_run_dt);
    if (!Number.isNaN(nextRun.getTime())) return annualReviewYearBeforeRunDate(nextRun, timezone);
  }
  return defaultStartReviewYearValue(timezone);
};

const endReviewYearForSchedule = (schedule: AuditReviewSchedule | null | undefined, timezoneValue?: string | null): string => {
  if (!schedule?.schedule_end_dt) return NO_END_ANNUAL_YEAR_VALUE;
  const timezone = safeTimeZone(timezoneValue);
  const scheduleEnd = new Date(schedule.schedule_end_dt);
  if (Number.isNaN(scheduleEnd.getTime())) return NO_END_ANNUAL_YEAR_VALUE;
  const local = timeZoneParts(scheduleEnd, timezone);
  if (local.month === 1 && local.day === 1) return String(local.year - 1);
  return String(local.year);
};

const reviewYearOptions = (
  selectedValue: string,
  timezoneValue?: string | null,
): Array<{ value: string; label: string }> => {
  const currentYear = Number(defaultStartReviewYearValue(timezoneValue));
  const values = new Set<string>();
  for (let offset = 0; offset < 12; offset += 1) {
    values.add(String(currentYear + offset));
  }
  if (selectedValue) values.add(selectedValue);
  return Array.from(values)
    .filter((value) => parseReviewYear(value) !== null)
    .sort((left, right) => (parseReviewYear(left) ?? 0) - (parseReviewYear(right) ?? 0))
    .map((value) => ({ value, label: value }));
};

const annualEndYearOptions = (
  startValue: string,
  selectedValue: string,
  timezoneValue?: string | null,
): Array<{ value: string; label: string }> => {
  const startYear = parseReviewYear(startValue) ?? Number(defaultStartReviewYearValue(timezoneValue));
  const values = new Set<string>();
  for (let offset = 0; offset < 12; offset += 1) {
    values.add(String(startYear + offset));
  }
  if (selectedValue && selectedValue !== NO_END_ANNUAL_YEAR_VALUE) values.add(selectedValue);
  return [
    { value: NO_END_ANNUAL_YEAR_VALUE, label: "No end year" },
    ...Array.from(values)
      .filter((value) => parseReviewYear(value) !== null)
      .sort((left, right) => (parseReviewYear(left) ?? 0) - (parseReviewYear(right) ?? 0))
      .map((value) => ({ value, label: value })),
  ];
};

const selectedEndReviewYearLabel = (value: string): string =>
  value === NO_END_ANNUAL_YEAR_VALUE ? "No end year" : value || "-";

const annualReviewRange = (
  yearValue: string,
  timezoneValue?: string | null,
): { start: Date; end: Date } | null => {
  const year = parseReviewYear(yearValue);
  if (year === null) return null;
  const timezone = safeTimeZone(timezoneValue);
  return {
    start: zonedDateTimeToDate({ year, month: 1, day: 1 }, { hour: 0, minute: 0, second: 0 }, timezone),
    end: zonedDateTimeToDate({ year, month: 12, day: 31 }, { hour: 23, minute: 59, second: 59 }, timezone),
  };
};

const annualRunDate = (
  yearValue: string,
  runTime: string,
  timezoneValue?: string | null,
): Date | null => {
  const year = parseReviewYear(yearValue);
  const runTimeParts = parseTimeInputParts(runTime);
  if (year === null || !runTimeParts) return null;
  return zonedDateTimeToDate({ year: year + 1, month: 1, day: 1 }, { ...runTimeParts, second: 0 }, timezoneValue);
};

const annualPlanRows = (form: ScheduleFormState): Array<{ year: string; period: string; runsOn: string; timezone: string }> => {
  const startYear = parseReviewYear(form.startReviewYear);
  if (startYear === null) return [];
  const endYear = form.endReviewYear !== NO_END_ANNUAL_YEAR_VALUE ? parseReviewYear(form.endReviewYear) : null;
  const finalYear = endYear ?? startYear + 3;
  if (finalYear < startYear) return [];
  const runTimeLabel = formatRunTimeLabel(form.runTime);
  const rows: Array<{ year: string; period: string; runsOn: string; timezone: string }> = [];
  for (let year = startYear; year <= Math.min(finalYear, startYear + 11); year += 1) {
    rows.push({
      year: String(year),
      period: "Jan 1 - Dec 31",
      runsOn: `Jan 1, ${year + 1} at ${runTimeLabel}`,
      timezone: form.timezone || "-",
    });
  }
  return rows;
};

const formatMonthDayLabel = (month: number, day: number): string => `${monthShortLabel(month)} ${day}`;

const halfYearPlanRows = (form: ScheduleFormState): Array<{ halfYear: string; period: string; runsOn: string; timezone: string }> => {
  const runTimeLabel = formatRunTimeLabel(form.runTime);
  const cycleType = coerceCycleType(form.cycleType, "HALF_YEARLY");
  const startMonths = cycleType === "CUSTOM_SIX_MONTH_CYCLE"
    ? [Math.max(1, Math.min(parseOptionalInt(form.customCycleStartMonth) ?? 1, 12))]
    : [1];
  const starts = [startMonths[0], ((startMonths[0] + 5) % 12) + 1];
  return starts.map((startMonth, index) => {
    const startYear = startMonth < starts[0] ? 2027 : 2026;
    const endParts = addCalendarMonths({ year: startYear, month: startMonth, day: 1 }, 5);
    const runParts = addCalendarMonths({ year: startYear, month: startMonth, day: 1 }, 6);
    const halfYear = cycleType === "CUSTOM_SIX_MONTH_CYCLE" ? `Cycle ${index + 1}` : index === 0 ? "H1" : "H2";
    return {
      halfYear,
      period: `${formatMonthDayLabel(startMonth, 1)} - ${formatMonthDayLabel(endParts.month, lastDayOfMonth(endParts.year, endParts.month - 1))}`,
      runsOn: `${formatMonthDayLabel(runParts.month, 1)} at ${runTimeLabel}`,
      timezone: form.timezone || "-",
    };
  });
};

const addMonths = (value: Date, months: number): Date => {
  const next = new Date(value);
  next.setMonth(next.getMonth() + months);
  return next;
};

const isSameOrAfter = (left: Date, right: Date): boolean => left.getTime() >= right.getTime();

const scheduleBaseDate = (form: ScheduleFormState, now = new Date()): Date | null => {
  const start = combineLocalDateAndTime(form.scheduleStartDate, form.runTime || "09:00");
  if (!start) return null;
  return start.getTime() > now.getTime() ? start : now;
};

const firstCandidateAfter = (candidates: Date[], base: Date): Date | null =>
  candidates
    .filter((candidate) => isSameOrAfter(candidate, base))
    .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;

const computeScheduleNextRun = (form: ScheduleFormState, now = new Date()): Date | null => {
  if (!/^\d{2}:\d{2}$/.test(form.runTime)) return null;

  if (form.frequency === "QUARTERLY") {
    let candidateQuarter = form.startQuarter || defaultStartQuarterValue(form.timezone);
    const endQuarterIndex = form.endQuarter && form.endQuarter !== NO_END_QUARTER_VALUE
      ? quarterIndex(form.endQuarter)
      : null;
    for (let offset = 0; offset < 32; offset += 1) {
      if (endQuarterIndex != null && quarterIndex(candidateQuarter) > endQuarterIndex) return null;
      const candidate = calendarQuarterRunDate(candidateQuarter, form.runTime, form.timezone);
      if (candidate && candidate.getTime() > now.getTime()) return candidate;
      candidateQuarter = addQuartersToValue(candidateQuarter, 1);
    }
    return null;
  }

  if (form.frequency === "HALF_YEARLY") {
    let candidateHalfYear = form.startHalfYear || defaultStartHalfYearValue(form.timezone, form.cycleType, form.customCycleStartMonth);
    const endHalfYearIndex = form.endHalfYear && form.endHalfYear !== NO_END_HALF_YEAR_VALUE
      ? halfYearIndex(form.endHalfYear)
      : null;
    for (let offset = 0; offset < 48; offset += 1) {
      if (endHalfYearIndex != null && halfYearIndex(candidateHalfYear) > endHalfYearIndex) return null;
      const candidate = halfYearRunDate(candidateHalfYear, form.runTime, form.timezone);
      if (candidate && candidate.getTime() > now.getTime()) return candidate;
      candidateHalfYear = addHalfYearsToValue(candidateHalfYear, 1);
    }
    return null;
  }

  if (form.frequency === "ANNUAL") {
    const startYear = parseReviewYear(form.startReviewYear);
    const endYear = form.endReviewYear !== NO_END_ANNUAL_YEAR_VALUE ? parseReviewYear(form.endReviewYear) : null;
    if (startYear === null || (form.endReviewYear !== NO_END_ANNUAL_YEAR_VALUE && endYear === null)) return null;
    if (endYear !== null && endYear < startYear) return null;
    const timezone = safeTimeZone(form.timezone);
    const baseParts = timeZoneParts(now, timezone);
    const finalYear = endYear ?? Math.max(startYear, baseParts.year + 20);
    for (let year = startYear; year <= finalYear; year += 1) {
      const candidate = annualRunDate(String(year), form.runTime, timezone);
      if (candidate && candidate.getTime() > now.getTime()) return candidate;
    }
    return null;
  }

  const base = scheduleBaseDate(form, now);
  if (!base) return null;

  if (form.frequency === "DAILY") {
    const scheduleStartParts = parseDateInputParts(form.scheduleStartDate);
    const runTimeParts = parseTimeInputParts(form.runTime);
    if (!scheduleStartParts || !runTimeParts) return null;
    const timezone = safeTimeZone(form.timezone);
    const scheduleStart = zonedDateTimeToDate(scheduleStartParts, { hour: 0, minute: 0, second: 0 }, timezone);
    const dailyBase = scheduleStart.getTime() > now.getTime() ? scheduleStart : now;
    const baseParts = timeZoneParts(dailyBase, timezone);
    const candidate = zonedDateTimeToDate(baseParts, { ...runTimeParts, second: 0 }, timezone);
    if (candidate.getTime() > dailyBase.getTime()) return candidate;
    return zonedDateTimeToDate(addCalendarDays(baseParts, 1), { ...runTimeParts, second: 0 }, timezone);
  }

  if (form.frequency === "WEEKLY") {
    const dayOfWeek = parseOptionalInt(form.dayOfWeek);
    if (dayOfWeek == null) return null;
    const start = combineLocalDateAndTime(toDateInputValue(base), form.runTime);
    if (!start) return null;
    const offset = (dayOfWeek - start.getDay() + 7) % 7;
    const candidate = addDays(start, offset);
    return candidate.getTime() >= base.getTime() ? candidate : addDays(candidate, 7);
  }

  if (form.frequency === "MONTHLY") {
    const timezone = safeTimeZone(form.timezone);
    const monthlyBase = monthlyScheduleBaseDate(form, now);
    const scheduleStartDay = scheduleStartDayForForm(form);
    const runTimeParts = parseTimeInputParts(form.runTime);
    if (!monthlyBase || !scheduleStartDay || !runTimeParts) return null;
    const baseParts = timeZoneParts(monthlyBase, timezone);
    const monthStart = { year: baseParts.year, month: baseParts.month, day: 1 };
    for (let offset = 0; offset < 24; offset += 1) {
      const candidateMonth = addCalendarMonths(monthStart, offset);
      const candidateDay = candidateDayOfMonth(candidateMonth.year, candidateMonth.month - 1, form);
      const candidate = zonedDateTimeToDate(
        { ...candidateMonth, day: candidateDay },
        {
          ...runTimeParts,
          second: 0,
        },
        timezone,
      );
      if (candidate.getTime() <= monthlyBase.getTime()) continue;
      const reviewRange = previousMonthRange(candidate, timezone);
      if (!clampMonthlyRangeToScheduleStart(reviewRange, form)) continue;
      return candidate;
    }
    return null;
  }

  return null;
};

const endOfDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(23, 59, 59, 0);
  return next;
};

const startOfDay = (value: Date): Date => {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
};

const previousHalfYearRange = (reference: Date): { start: Date; end: Date } => {
  const currentHalfStartMonth = reference.getMonth() < 6 ? 0 : 6;
  const start = new Date(reference.getFullYear(), currentHalfStartMonth - 6, 1, 0, 0, 0, 0);
  const end = endOfDay(new Date(reference.getFullYear(), currentHalfStartMonth, 0));
  return { start, end };
};

const previousCustomCycleRange = (reference: Date, startMonth: number, spanMonths: number): { start: Date; end: Date } => {
  const normalizedStartMonth = Math.max(1, Math.min(startMonth, 12));
  const starts: Date[] = [];
  for (let year = reference.getFullYear() - 2; year <= reference.getFullYear() + 1; year += 1) {
    let cursor = new Date(year, normalizedStartMonth - 1, 1, 0, 0, 0, 0);
    while (cursor.getFullYear() <= reference.getFullYear() + 1) {
      starts.push(new Date(cursor));
      cursor = addMonths(cursor, spanMonths);
    }
  }
  const currentStart = starts
    .filter((candidate) => candidate.getTime() <= reference.getTime())
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? new Date(reference.getFullYear(), normalizedStartMonth - 1, 1, 0, 0, 0, 0);
  return { start: addMonths(currentStart, -spanMonths), end: endOfDay(addDays(currentStart, -1)) };
};

const previousAnnualRange = (form: ScheduleFormState, reference: Date): { start: Date; end: Date } => {
  if (form.cycleType === "FISCAL_YEAR") {
    const fiscalStartMonth = parseOptionalInt(form.fiscalYearStartMonth) ?? 1;
    const startMonthIndex = Math.max(0, Math.min(fiscalStartMonth - 1, 11));
    const currentStartYear = reference.getMonth() >= startMonthIndex ? reference.getFullYear() : reference.getFullYear() - 1;
    const currentStart = new Date(currentStartYear, startMonthIndex, 1, 0, 0, 0, 0);
    return {
      start: new Date(currentStartYear - 1, startMonthIndex, 1, 0, 0, 0, 0),
      end: endOfDay(addDays(currentStart, -1)),
    };
  }
  return {
    start: new Date(reference.getFullYear() - 1, 0, 1, 0, 0, 0, 0),
    end: endOfDay(new Date(reference.getFullYear() - 1, 11, 31)),
  };
};

const expectedAuditRetrievalRange = (
  form: ScheduleFormState,
  nextRun: Date | null,
): { start: Date | null; end: Date | null; basis: string; note?: string } => {
  if (form.auditRetrievalMode === "CUSTOM") {
    const start = form.customAuditStart ? datetimeLocalInputToDate(form.customAuditStart, form.timezone) : null;
    const end = form.customAuditEnd ? datetimeLocalInputToDate(form.customAuditEnd, form.timezone) : null;
    return {
      start: start && !Number.isNaN(start.getTime()) ? start : null,
        end: end && !Number.isNaN(end.getTime()) ? end : null,
      basis: "This custom range will be used for the next run/manual run only.",
    };
  }

  if (!nextRun) return { start: null, end: null, basis: "Complete the schedule timing fields to preview the audit retrieval range." };

  if (form.frequency === "DAILY") {
    return { ...previousCompletedDayRange(nextRun, form.timezone), basis: "Daily schedules review the full previous calendar day." };
  }
  if (form.frequency === "WEEKLY") {
    return { ...previousCompletedWeekRange(nextRun, form.timezone), basis: "Weekly schedules review the previous completed week." };
  }
  if (form.frequency === "MONTHLY") {
    const monthRange = previousMonthRange(nextRun, form.timezone);
    const clampedRange = clampMonthlyRangeToScheduleStart(monthRange, form);
    if (!clampedRange) {
      return {
        start: null,
        end: null,
        basis: "The next monthly candidate is before the schedule start date.",
      };
    }
    return {
      start: clampedRange.start,
      end: clampedRange.end,
      basis: "Previous calendar month.",
      note: clampedRange.clamped
        ? "First monthly run starts from the schedule start date. Future runs will review full calendar months."
        : undefined,
    };
  }
  if (form.frequency === "QUARTERLY") {
    const quarterRange = previousQuarterRange(nextRun, form.timezone);
    return { ...quarterRange, basis: "Full calendar quarter." };
  }
  if (form.frequency === "HALF_YEARLY") {
    const halfYear = halfYearValueBeforeRunDate(nextRun, form.timezone, form.cycleType, form.customCycleStartMonth);
    const range = halfYearRange(halfYear, form.timezone);
    if (range) {
      return {
        ...range,
        basis: "Full selected six-month period.",
      };
    }
    return form.cycleType === "CUSTOM_SIX_MONTH_CYCLE"
      ? { ...previousCustomCycleRange(nextRun, parseOptionalInt(form.customCycleStartMonth) ?? 1, 6), basis: "Previous completed custom half-year." }
      : { ...previousHalfYearRange(nextRun), basis: "Previous completed calendar half-year." };
  }
  if (form.frequency === "ANNUAL") {
    const reviewYear = annualReviewYearBeforeRunDate(nextRun, form.timezone);
    const range = annualReviewRange(reviewYear, form.timezone);
    if (range) {
      return {
        ...range,
        basis: "Full selected calendar year.",
      };
    }
  }
  return { ...previousAnnualRange(form, nextRun), basis: form.cycleType === "FISCAL_YEAR" ? "Previous fiscal year." : "Previous calendar year." };
};

const defaultCustomAuditRangeForFrequency = (
  form: ScheduleFormState,
  frequency: AuditReviewScheduleFrequency,
): { start: string; end: string } => {
  const previewForm: ScheduleFormState = {
    ...form,
    frequency,
    auditRetrievalMode: defaultAuditRetrievalMode(frequency),
    cycleType: coerceCycleType(form.cycleType, frequency),
  };
  const nextRun = computeScheduleNextRun(previewForm) ?? new Date();
  const expectedRange = expectedAuditRetrievalRange(previewForm, nextRun);
  const end = expectedRange.end ?? nextRun;
  const start = expectedRange.start ?? addDays(end, -(REVIEW_WINDOW_DAYS_BY_FREQUENCY[frequency] ?? REVIEW_WINDOW_DAYS_BY_FREQUENCY.MONTHLY));
  return {
    start: toDatetimeLocalValue(start),
    end: toDatetimeLocalValue(end),
  };
};

const monthLabel = (monthValue: string): string =>
  MONTH_OPTIONS.find((option) => option.value === monthValue)?.label ?? "selected month";

const plannerTimingLabel = (form: ScheduleFormState): string => {
  if (form.frequency === "DAILY") return `Every day at ${formatRunTimeLabel(form.runTime)}`;
  if (form.frequency === "WEEKLY") {
    const weekday = WEEKDAY_OPTIONS.find((option) => option.value === form.dayOfWeek)?.label ?? "selected day";
    return `Weekly on ${weekday} at ${form.runTime || "-"}`;
  }
  if (form.frequency === "MONTHLY") {
    return `Monthly on the 1st day of the next month at ${formatRunTimeLabel(form.runTime)}`;
  }
  if (form.frequency === "QUARTERLY") {
    return `Every quarter after quarter end at ${formatRunTimeLabel(form.runTime)}`;
  }
  if (form.frequency === "HALF_YEARLY") {
    return `Every six months after the half-year period ends at ${formatRunTimeLabel(form.runTime)}`;
  }
  return `Every year after the year ends at ${formatRunTimeLabel(form.runTime)}`;
};

const formatRunTimeLabel = (value: string): string => {
  const parts = parseTimeInputParts(value);
  if (!parts) return value || "-";
  const date = new Date(2000, 0, 1, parts.hour, parts.minute, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const formatSchedulePreviewDateTime = (value: Date | string | null | undefined, timezoneValue?: string | null): string => {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("en-US", {
    timeZone: safeTimeZone(timezoneValue),
    month: "long",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const frequencyIntervalDays = (frequency: AuditReviewScheduleFrequency): number =>
  REVIEW_WINDOW_DAYS_BY_FREQUENCY[frequency] ?? REVIEW_WINDOW_DAYS_BY_FREQUENCY.MONTHLY;

const dateRangeDays = (start: Date | null, end: Date | null): number | null => {
  if (!start || !end) return null;
  return (end.getTime() - start.getTime()) / 86_400_000;
};

const statusLabel = (value?: string | null): string => {
  if (!value) return "-";
  if (value === "DRAFT") return "Draft Generated";
  if (value === "UNDER_REVIEW") return "Under Review";
  if (value === "CHANGES_REQUESTED") return "Changes Requested";
  return formatAuditReviewLabel(value);
};

const reportStatusForJob = (
  job: AuditReviewJobListItem,
  report?: AuditReviewReportListItem,
): AuditReviewReportStatus | null => {
  const jobWithReportStatus = job as AuditReviewJobListItem & {
    latest_report_status?: AuditReviewReportStatus | null;
    latest_report_approval_status?: AuditReviewReportStatus | null;
  };
  return report?.status || jobWithReportStatus.latest_report_status || jobWithReportStatus.latest_report_approval_status || null;
};

const isHistoricalReviewReportStatus = (status?: AuditReviewReportStatus | null): boolean =>
  status === "APPROVED" || status === "REJECTED";

const canDownloadAuditReviewReport = (status?: AuditReviewReportStatus | null): boolean =>
  status === "APPROVED";

const isProgressReviewReportStatus = (
  status: AuditReviewReportStatus | null,
  canSubmit: boolean,
  canDecide: boolean,
): boolean => {
  if ((status === "DRAFT" || status === "CHANGES_REQUESTED") && canSubmit) return true;
  if (status === "UNDER_REVIEW" && (canSubmit || canDecide)) return true;
  return false;
};

const getScheduleRunBadgeClass = (status?: string | null): string => {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "STARTED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "SKIPPED") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-slate-200 bg-white text-slate-700";
};

const dateMs = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const formatRunDuration = (startedAt?: string | null, completedAt?: string | null): string => {
  const start = dateMs(startedAt);
  const end = dateMs(completedAt);
  if (start === null) return "-";
  if (end === null) return "In progress";
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
};

const isScheduledReviewOrigin = (
  job: AuditReviewJobListItem | AuditReviewJobDetail,
  report?: AuditReviewReportListItem | AuditReviewReportDetail | null,
): boolean => {
  const jobWorkflow = job as AuditReviewJobDetail;
  const triggerMode = String(jobWorkflow.trigger_mode || "").toUpperCase();
  const periodBasis = String(jobWorkflow.period_basis || "").toUpperCase();
  const reviewType = String(report?.review_type || "").toUpperCase();
  return (
    reviewType === "SCHEDULED" ||
    Boolean(report?.schedule_id || report?.schedule_run_id) ||
    periodBasis === "SCHEDULED" ||
    triggerMode.startsWith("SCHEDULED")
  );
};

const TECHNICAL_UNAVAILABLE = "Not returned by source";
const SUMMARY_UNAVAILABLE = "Unavailable";
const UNKNOWN_TEXT_VALUES = new Set(["", "unknown", "none", "null", "n/a", "na", "-"]);

type BusinessHoursConfig = {
  timezone: string;
  startHour: number;
  endHour: number;
};

type EvidenceDisplayColumn = {
  key: string;
  header: string;
  className?: string;
  optional?: boolean;
  fallback?: string;
  getValue: (record: AuditTrailRecord, config: BusinessHoursConfig) => string | null;
};

const displayText = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const items = value.map(displayText).filter((item): item is string => Boolean(item));
    return items.length > 0 ? items.join(", ") : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return UNKNOWN_TEXT_VALUES.has(trimmed.toLowerCase()) ? null : trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
};

const asRecordObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

const normalizedObjectKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const firstObjectText = (source: unknown, keys: string[], maxDepth = 3): string | null => {
  const object = asRecordObject(source);
  if (!object) return null;
  const wanted = new Set(keys.map(normalizedObjectKey));
  const visit = (item: unknown, depth: number): string | null => {
    const current = asRecordObject(item);
    if (!current || depth > maxDepth) return null;
    for (const [key, value] of Object.entries(current)) {
      if (wanted.has(normalizedObjectKey(key))) {
        const text = displayText(value);
        if (text) return text;
      }
    }
    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          const found = visit(child, depth + 1);
          if (found) return found;
        }
        continue;
      }
      const found = visit(value, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return visit(object, 0);
};

const recordText = (
  record: AuditTrailRecord,
  fields: Array<keyof AuditTrailRecord>,
  extraKeys: string[] = [],
  rawKeys: string[] = [],
): string | null => {
  for (const field of fields) {
    const value = displayText(record[field]);
    if (value) return value;
  }
  const extraValue = firstObjectText(record.normalized_extra_json, extraKeys);
  if (extraValue) return extraValue;
  return firstObjectText(record.raw_payload_json, rawKeys);
};

const evidenceText = (finding: AuditReviewFinding, keys: string[]): string | null =>
  firstObjectText(finding.evidence_json, keys);

const compactText = (...parts: Array<string | null | undefined>): string | null => {
  const values = parts.filter((part): part is string => Boolean(part && part.trim()));
  return values.length > 0 ? values.join(" / ") : null;
};

const sourceRecordId = (record: AuditTrailRecord): string =>
  displayText(record.source_record_key) || displayText(record.record_id) || "Source record unavailable";

const recordUserLabel = (record: AuditTrailRecord): string =>
  recordText(
    record,
    ["user_name", "user_id"],
    ["user_name", "user_id", "performed_by", "actor"],
    ["user_name", "userName", "username", "user_id", "userId", "performed_by", "performedBy", "actor"],
  ) || "Unspecified user";

const rawActionText = (record: AuditTrailRecord): string | null =>
  recordText(
    record,
    ["display_action", "action_type", "detected_action_category", "raw_action"],
    ["display_action", "action_category", "detected_action_category", "raw_action"],
    ["action_type", "action", "event_action", "event", "event_name", "eventName", "operation", "activity"],
  );

const canonicalAction = (value?: string | null): string =>
  String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();

const fallbackActionForType = (auditTrailType?: string | null): string => {
  if (auditTrailType === "login_audit_trail") return "Login / Access Activity";
  if (auditTrailType === "document_audit_trail") return "Document Activity";
  if (auditTrailType === "object_audit_trail") return "Object Activity";
  if (auditTrailType === "system_audit_trail") return "Configuration Activity";
  if (auditTrailType === "domain_audit_trail") return "Access / Security Activity";
  return "Audit Activity";
};

const friendlyActionLabel = (auditTrailType?: string | null, value?: string | null): string | null => {
  const action = canonicalAction(value);
  if (!action) return null;
  if (auditTrailType === "login_audit_trail") {
    if (action.includes("LOGINSUCCESS") || action === "SUCCESS") return "Successful Login";
    if (action.includes("LOGINFAILURE") || action.includes("LOGINFAILED") || action === "FAILURE") return "Failed Login";
    if (action.includes("LOGOUT")) return "Logout";
    return null;
  }
  if (auditTrailType === "document_audit_trail") {
    if (action === "GETDOCUMENTVERSION" || action === "DOWNLOAD" || action.includes("DOCUMENTDOWNLOAD")) return "Document Download / Retrieval";
    if (action === "VIEW" || action.includes("VIEW")) return "Document Viewed";
    if (action === "UPDATE" || action.includes("UPDATE") || action.includes("CHANGE")) return "Document Updated";
    if (action === "DELETE" || action.includes("DELETE") || action.includes("REMOVE")) return "Document Deleted / Removed";
    if (action === "APPROVE" || action.includes("APPROVE")) return "Document Approved";
    if (action === "REJECT" || action.includes("REJECT")) return "Document Rejected";
    if (action === "EXPORT" || action.includes("EXPORT")) return "Document Exported";
    return null;
  }
  if (auditTrailType === "object_audit_trail") {
    if (action === "CREATE" || action.includes("CREATE") || action.includes("ADD")) return "Object Record Created";
    if (action === "UPDATE" || action.includes("UPDATE") || action.includes("CHANGE")) return "Object Record Updated";
    if (action === "DELETE" || action.includes("DELETE") || action.includes("REMOVE")) return "Object Record Deleted / Removed";
    if (action === "EXPORT" || action === "DOWNLOAD" || action.includes("EXPORT") || action.includes("DOWNLOAD")) return "Object Data Exported";
    return null;
  }
  if (auditTrailType === "system_audit_trail") {
    if (action === "CONFIGCHANGE" || action.includes("CONFIG") || action.includes("SETTING")) return "Configuration Changed";
    if (action === "UPDATE" || action.includes("UPDATE") || action.includes("CHANGE")) return "System Setting Updated";
    if (action === "CREATE" || action.includes("CREATE")) return "Configuration Created";
    if (action === "DELETE" || action.includes("DELETE") || action.includes("REMOVE")) return "Configuration Deleted / Removed";
    return null;
  }
  if (auditTrailType === "domain_audit_trail") {
    if (action === "PERMISSIONCHANGE" || action.includes("PERMISSION") || action.includes("ACCESS") || action.includes("ROLE")) {
      return "Permission / Access Changed";
    }
    if (action === "CREATE" || action.includes("CREATE") || action.includes("ADD")) return "Access Created";
    if (action === "DELETE" || action.includes("DELETE") || action.includes("REMOVE")) return "Access Removed";
    if (action === "UPDATE" || action.includes("UPDATE") || action.includes("CHANGE")) return "Security Setting Updated";
    return null;
  }
  return null;
};

const actionDisplay = (record: AuditTrailRecord): { label: string; raw?: string | null } => {
  const raw = displayText(record.raw_action);
  const first = rawActionText(record);
  const friendly = first
    ? friendlyActionLabel(record.audit_trail_type, first) || TECHNICAL_ACTION_LABELS[first] || TECHNICAL_ACTION_LABELS[first.toLowerCase()]
    : null;
  return {
    label: friendly || first || fallbackActionForType(record.audit_trail_type),
    raw: raw && raw !== friendly && raw !== first ? raw : raw,
  };
};

const auditBusinessConfig = (job: AuditReviewJobDetail): BusinessHoursConfig => {
  const summary = asRecordObject(job.analysis_summary_json) || {};
  const timezone = displayText(summary.business_timezone) || "Asia/Kolkata";
  const startHour = Number(summary.business_start_hour ?? 9);
  const endHour = Number(summary.business_end_hour ?? 18);
  return {
    timezone,
    startHour: Number.isFinite(startHour) ? startHour : 9,
    endHour: Number.isFinite(endHour) ? endHour : 18,
  };
};

const formatBusinessHour = (hour: number): string => `${String(hour).padStart(2, "0")}:00`;

const businessHoursWindow = (config: BusinessHoursConfig): string =>
  `${formatBusinessHour(config.startHour)}-${formatBusinessHour(config.endHour)} ${config.timezone}`;

const formatEventTime = (value?: string | null, timezone?: string): string => {
  if (!value) return "Event time unavailable";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  };
  try {
    return parsed.toLocaleString("en-US", timezone ? { ...options, timeZone: timezone } : options);
  } catch {
    return parsed.toLocaleString("en-US", options);
  }
};

const hourInTimezone = (value: string | null | undefined, timezone: string): number | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  try {
    const hourPart = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: timezone,
    }).formatToParts(parsed).find((part) => part.type === "hour")?.value;
    if (!hourPart) return null;
    const hour = Number(hourPart);
    if (!Number.isFinite(hour)) return null;
    return hour === 24 ? 0 : hour;
  } catch {
    return parsed.getHours();
  }
};

const businessHoursStatus = (record: AuditTrailRecord, config: BusinessHoursConfig): string => {
  const hour = hourInTimezone(record.event_timestamp, config.timezone);
  if (hour === null) return "Business hours not evaluated";
  return hour >= config.startHour && hour < config.endHour ? "Within business hours" : "Outside business hours";
};

const documentNameOrId = (record: AuditTrailRecord): string | null =>
  compactText(
    recordText(record, ["object_id"], ["document_id", "document_number"], ["document_id", "documentId", "document_number", "documentNumber"]),
    recordText(record, ["object_name"], ["document_name", "document_title"], ["document_name", "documentName", "document_title", "title", "name"]),
  );

const documentVersion = (record: AuditTrailRecord): string | null =>
  recordText(
    record,
    [],
    ["document_version", "version"],
    ["document_version", "documentVersion", "version", "major_version_number", "major_version_number__v", "minor_version_number", "minor_version_number__v"],
  );

const lifecycleState = (record: AuditTrailRecord): string | null =>
  recordText(record, ["event_status"], ["lifecycle_state", "state"], ["lifecycle_state", "lifecycleState", "lifecycle", "state", "status"]);

const objectRecordName = (record: AuditTrailRecord): string | null =>
  compactText(
    recordText(record, ["object_id"], ["record_id"], ["record_id", "recordId", "id"]),
    recordText(record, ["object_name"], ["record_name"], ["record_name", "recordName", "name"]),
  );

const systemArea = (record: AuditTrailRecord): string | null =>
  recordText(record, ["object_type"], ["system_area", "configuration_area"], ["system_area", "configuration_area", "component_type", "area", "object_type"]);

const componentName = (record: AuditTrailRecord): string | null =>
  recordText(record, ["object_name", "object_id"], ["component_name"], ["component_name", "componentName", "object_name", "name"]);

const domainArea = (record: AuditTrailRecord): string | null =>
  recordText(record, ["object_type", "object_name"], ["domain_area", "security_area"], ["domain_area", "security_area", "area", "object_type"]);

const targetUser = (record: AuditTrailRecord): string | null =>
  recordText(record, [], ["target_user", "target_user_name", "affected_user"], ["target_user", "targetUser", "target_user_name", "affected_user", "affectedUser"]);

const roleGroupPermission = (record: AuditTrailRecord): string | null =>
  recordText(record, ["field_name", "object_name"], ["role", "group", "permission", "profile"], ["role", "group", "permission", "profile", "role_name", "group_name", "permission_name"]);

const sessionOrAuthMethod = (record: AuditTrailRecord): string | null =>
  compactText(
    recordText(record, ["session_id"], ["session_id"], ["session_id", "sessionId", "session"]),
    recordText(record, ["auth_method"], ["auth_method"], ["auth_method", "authMethod", "authentication_method", "mfa_method"]),
  );

const evidenceColumnsForType = (auditTrailType: string): EvidenceDisplayColumn[] => {
  const eventTime: EvidenceDisplayColumn = {
    key: "event_time",
    header: "Event Time",
    className: "min-w-52 px-3",
    fallback: "Event time unavailable",
    getValue: (record, config) => displayText(record.event_timestamp) ? formatEventTime(record.event_timestamp, config.timezone) : null,
  };
  const sourceRecord: EvidenceDisplayColumn = {
    key: "source_record",
    header: "Source Record ID",
    className: "min-w-56 px-3",
    fallback: "Source record unavailable",
    getValue: (record) => sourceRecordId(record),
  };
  const auditTrailColumn: EvidenceDisplayColumn = {
    key: "audit_type",
    header: "Audit Trail Type",
    className: "min-w-44 px-3",
    getValue: (record) => formatAuditReviewLabel(record.audit_trail_type),
  };

  if (auditTrailType === "login_audit_trail") {
    return [
      eventTime,
      { key: "user", header: "User", className: "min-w-56 px-3", fallback: "Unspecified user", getValue: (record) => recordUserLabel(record) },
      { key: "action", header: "Login / Access Action", className: "min-w-56 px-3", getValue: (record) => actionDisplay(record).label },
      auditTrailColumn,
      sourceRecord,
      { key: "business_hours", header: "Business Hours Status", className: "min-w-56 px-3", getValue: businessHoursStatus },
      { key: "ip_address", header: "IP Address", className: "min-w-40 px-3", optional: true, getValue: (record) => recordText(record, ["ip_address"], [], ["ip_address", "ipAddress", "client_ip", "remote_address"]) },
      { key: "session_auth", header: "Session/Auth Method", className: "min-w-56 px-3", optional: true, getValue: sessionOrAuthMethod },
    ];
  }

  if (auditTrailType === "document_audit_trail") {
    return [
      eventTime,
      { key: "user", header: "User", className: "min-w-56 px-3", fallback: "Unspecified user", getValue: (record) => recordUserLabel(record) },
      { key: "document", header: "Document ID / Document Name", className: "min-w-72 px-3", fallback: "Document not identified", getValue: documentNameOrId },
      { key: "version", header: "Version", className: "min-w-32 px-3", optional: true, getValue: documentVersion },
      { key: "action", header: "Document Action", className: "min-w-56 px-3", getValue: (record) => actionDisplay(record).label },
      auditTrailColumn,
      { key: "lifecycle", header: "Lifecycle State", className: "min-w-48 px-3", optional: true, getValue: lifecycleState },
      { key: "field", header: "Field Changed", className: "min-w-52 px-3", optional: true, getValue: (record) => recordText(record, ["field_name"], [], ["field_name", "fieldName", "field"]) },
      { key: "old", header: "Old Value", className: "min-w-64 px-3", optional: true, getValue: (record) => recordText(record, ["old_value"], [], ["old_value", "oldValue", "previous_value", "old"]) },
      { key: "new", header: "New Value", className: "min-w-64 px-3", optional: true, getValue: (record) => recordText(record, ["new_value"], [], ["new_value", "newValue", "current_value", "new", "value"]) },
      sourceRecord,
    ];
  }

  if (auditTrailType === "object_audit_trail") {
    return [
      eventTime,
      { key: "user", header: "User", className: "min-w-56 px-3", fallback: "Unspecified user", getValue: (record) => recordUserLabel(record) },
      { key: "object_name", header: "Object Name", className: "min-w-56 px-3", fallback: "Object not identified", getValue: (record) => recordText(record, ["object_type", "object_name"], [], ["object_type", "objectType", "object_name", "objectName"]) },
      { key: "record", header: "Record ID / Record Name", className: "min-w-72 px-3", fallback: "Record not identified", getValue: objectRecordName },
      { key: "action", header: "Object Action", className: "min-w-52 px-3", getValue: (record) => actionDisplay(record).label },
      auditTrailColumn,
      { key: "field", header: "Field Changed", className: "min-w-52 px-3", fallback: "Field not captured", getValue: (record) => recordText(record, ["field_name"], [], ["field_name", "fieldName", "field"]) },
      { key: "old", header: "Old Value", className: "min-w-64 px-3", fallback: "Old value not captured", getValue: (record) => recordText(record, ["old_value"], [], ["old_value", "oldValue", "previous_value", "old"]) },
      { key: "new", header: "New Value", className: "min-w-64 px-3", fallback: "New value not captured", getValue: (record) => recordText(record, ["new_value"], [], ["new_value", "newValue", "current_value", "new", "value"]) },
      { key: "reason", header: "Reason", className: "min-w-56 px-3", optional: true, getValue: (record) => recordText(record, ["reason"], [], ["reason", "comment", "justification", "change_reason"]) },
      sourceRecord,
    ];
  }

  if (auditTrailType === "system_audit_trail") {
    return [
      eventTime,
      { key: "admin_user", header: "Admin User", className: "min-w-56 px-3", fallback: "Unspecified admin", getValue: (record) => recordUserLabel(record) },
      { key: "area", header: "System Area / Configuration Area", className: "min-w-72 px-3", fallback: "Configuration area unavailable", getValue: systemArea },
      { key: "action", header: "Configuration Action", className: "min-w-56 px-3", getValue: (record) => actionDisplay(record).label },
      auditTrailColumn,
      { key: "component", header: "Component Name", className: "min-w-56 px-3", fallback: "Component not identified", getValue: componentName },
      { key: "field", header: "Field / Setting Changed", className: "min-w-56 px-3", fallback: "Setting not captured", getValue: (record) => recordText(record, ["field_name"], [], ["field_name", "fieldName", "setting", "property"]) },
      { key: "old", header: "Old Value", className: "min-w-64 px-3", fallback: "Old value not captured", getValue: (record) => recordText(record, ["old_value"], [], ["old_value", "oldValue", "previous_value", "old"]) },
      { key: "new", header: "New Value", className: "min-w-64 px-3", fallback: "New value not captured", getValue: (record) => recordText(record, ["new_value"], [], ["new_value", "newValue", "current_value", "new", "value"]) },
      { key: "change_control", header: "Change Control Reference", className: "min-w-60 px-3", optional: true, getValue: (record) => recordText(record, ["change_control_id"], [], ["change_control_id", "changeControlId", "change_control", "change_request"]) },
      sourceRecord,
    ];
  }

  if (auditTrailType === "domain_audit_trail") {
    return [
      eventTime,
      { key: "performed_by", header: "Performed By", className: "min-w-56 px-3", fallback: "Unspecified user", getValue: (record) => recordUserLabel(record) },
      { key: "target_user", header: "Target User", className: "min-w-56 px-3", optional: true, getValue: targetUser },
      { key: "domain_area", header: "Domain/Security Area", className: "min-w-64 px-3", fallback: "Security area unavailable", getValue: domainArea },
      { key: "action", header: "Access Action", className: "min-w-56 px-3", getValue: (record) => actionDisplay(record).label },
      auditTrailColumn,
      { key: "role_group_permission", header: "Role / Group / Permission", className: "min-w-64 px-3", optional: true, getValue: roleGroupPermission },
      { key: "old", header: "Old Value", className: "min-w-64 px-3", fallback: "Old value not captured", getValue: (record) => recordText(record, ["old_value"], [], ["old_value", "oldValue", "previous_value", "old"]) },
      { key: "new", header: "New Value", className: "min-w-64 px-3", fallback: "New value not captured", getValue: (record) => recordText(record, ["new_value"], [], ["new_value", "newValue", "current_value", "new", "value"]) },
      sourceRecord,
    ];
  }

  return [
    eventTime,
    { key: "user", header: "Performed By", className: "min-w-56 px-3", fallback: "Unspecified user", getValue: (record) => recordUserLabel(record) },
    { key: "action", header: "Detected Action", className: "min-w-56 px-3", getValue: (record) => actionDisplay(record).label },
    auditTrailColumn,
    sourceRecord,
  ];
};

const visibleEvidenceColumns = (
  auditTrailType: string,
  records: AuditTrailRecord[],
  config: BusinessHoursConfig,
): EvidenceDisplayColumn[] =>
  evidenceColumnsForType(auditTrailType).filter(
    (column) => !column.optional || records.some((record) => Boolean(column.getValue(record, config))),
  );

const severityWeight = (severity?: string | null): number => {
  if (severity === "HIGH" || severity === "CRITICAL") return 3;
  if (severity === "MEDIUM") return 2;
  if (severity === "LOW") return 1;
  return 0;
};

const groupForFinding = (finding: AuditReviewFinding): { name: string; action: string } => {
  const text = normalizedText(
    finding.check_code,
    finding.check_name,
    finding.finding_type,
    finding.finding_title,
    finding.finding_summary,
    finding.description,
  );
  if (text.includes("export") || text.includes("download")) {
    return { name: "Data Export / Download", action: "Confirm export/download business justification and reviewer approval." };
  }
  if (text.includes("old") || text.includes("new") || text.includes("missing value")) {
    return { name: "Missing Old/New Values", action: "Review source configuration and verify the change can be reconstructed." };
  }
  if (text.includes("delete") || text.includes("deletion")) {
    return { name: "Delete Action", action: "Confirm deletion authorization and retention impact." };
  }
  if (text.includes("off") || text.includes("after hour") || text.includes("business hour")) {
    return { name: "Off-hours Activity", action: "Validate user activity timing against approved operational need." };
  }
  if (text.includes("addition") || text.includes("record add") || text.includes("create")) {
    return { name: "Record Addition Gap", action: "Confirm record creation has expected approval or traceability." };
  }
  if (text.includes("user") || text.includes("identity")) {
    return { name: "Missing User Identity", action: "Verify identity mapping and remediate missing user attribution." };
  }
  if (text.includes("permission") || text.includes("role") || text.includes("security")) {
    return { name: "Permission Changes", action: "Review privilege change authorization and segregation of duties." };
  }
  if (text.includes("config") || text.includes("workflow") || text.includes("field") || text.includes("system")) {
    return { name: "Configuration Changes", action: "Confirm configuration changes are linked to approved change control." };
  }
  return { name: "Other Audit Trail Findings", action: "Review evidence and assign corrective action if required." };
};

const groupFindings = (findings: AuditReviewFinding[]): FindingGroup[] => {
  const groups = new Map<string, FindingGroup>();
  findings.forEach((finding) => {
    const group = groupForFinding(finding);
    const key = group.name;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        key,
        name: group.name,
        count: 1,
        highestSeverity: finding.severity || "-",
        recommendedAction: group.action,
        findings: [finding],
      });
      return;
    }
    current.count += 1;
    current.findings.push(finding);
    if (severityWeight(finding.severity) > severityWeight(current.highestSeverity)) {
      current.highestSeverity = finding.severity || "-";
    }
  });
  return Array.from(groups.values()).sort((left, right) => severityWeight(right.highestSeverity) - severityWeight(left.highestSeverity));
};

const findingMatchedRecord = (finding: AuditReviewFinding, records: AuditTrailRecord[]): AuditTrailRecord | null => {
  const evidenceRecordId = evidenceText(finding, ["record_id"]);
  const evidenceSourceKey = evidenceText(finding, ["source_record_key"]);
  return records.find((record) =>
    (finding.primary_record_id && record.record_id === finding.primary_record_id) ||
    (evidenceRecordId && record.record_id === evidenceRecordId) ||
    (evidenceSourceKey && record.source_record_key === evidenceSourceKey)
  ) || null;
};

const findingAuditTrailType = (finding: AuditReviewFinding, record: AuditTrailRecord | null): string =>
  record?.audit_trail_type || finding.audit_trail_type || evidenceText(finding, ["audit_trail_type"]) || "audit_trail";

const findingUser = (finding: AuditReviewFinding, record: AuditTrailRecord | null): string =>
  record
    ? recordUserLabel(record)
    : evidenceText(finding, ["user_name", "user_id", "performed_by", "actor"]) || "Unspecified user";

const findingSourceRecord = (finding: AuditReviewFinding, record: AuditTrailRecord | null): string =>
  record
    ? sourceRecordId(record)
    : evidenceText(finding, ["source_record_key", "record_id"]) || finding.primary_record_id || "Source record unavailable";

const findingEventTime = (
  finding: AuditReviewFinding,
  record: AuditTrailRecord | null,
  config: BusinessHoursConfig,
): string => {
  const timestamp = record?.event_timestamp || evidenceText(finding, ["event_timestamp"]);
  return formatEventTime(timestamp, config.timezone);
};

const findingAction = (finding: AuditReviewFinding, record: AuditTrailRecord | null): string => {
  const auditType = findingAuditTrailType(finding, record);
  if (record) return actionDisplay(record).label;
  const action = evidenceText(finding, ["display_action", "action_type", "detected_action_category", "raw_action"]);
  return friendlyActionLabel(auditType, action) || action || fallbackActionForType(auditType);
};

const findingTarget = (finding: AuditReviewFinding, record: AuditTrailRecord | null): string => {
  const auditType = findingAuditTrailType(finding, record);
  if (record) {
    if (auditType === "document_audit_trail") {
      return documentNameOrId(record) || recordText(record, ["field_name"]) || "the document";
    }
    if (auditType === "object_audit_trail") {
      return objectRecordName(record) || recordText(record, ["object_name", "object_type", "field_name"]) || "the object record";
    }
    if (auditType === "system_audit_trail") {
      return componentName(record) || systemArea(record) || "system configuration";
    }
    if (auditType === "domain_audit_trail") {
      return roleGroupPermission(record) || targetUser(record) || domainArea(record) || "security/access settings";
    }
    return recordText(record, ["object_name", "object_id", "field_name"]) || "the audited item";
  }
  return evidenceText(finding, ["object_name", "object_id", "field_name", "object_type"]) || "the audited item";
};

const findingRecommendation = (checkCode?: string | null): string => {
  if (checkCode === "OFF_HOURS_ACTIVITY") return "Verify approved business need or documented exception for the off-hours activity.";
  if (checkCode === "DATA_EXPORT_LOGGING") return "Verify business purpose, recipient, and authorization.";
  if (checkCode === "MODIFICATION_CAPTURE_OLD_NEW_VALUES") return "Verify old/new value traceability or source-system audit configuration.";
  if (checkCode === "DELETE_ACTION") return "Verify deletion justification and approval.";
  if (checkCode === "PERMISSION_ACCESS_CHANGE") return "Verify authorization and segregation of duties.";
  if (checkCode === "CONFIGURATION_SYSTEM_CHANGE") return "Verify approved change control reference.";
  return "Review the source evidence, document QA disposition, and assign corrective action if needed.";
};

const findingReason = (finding: AuditReviewFinding): string => {
  if (finding.check_code === "OFF_HOURS_ACTIVITY") return "Activity occurred outside approved business hours.";
  if (finding.check_code === "DATA_EXPORT_LOGGING") return "Export, download, or retrieval activity requires QA review.";
  if (finding.check_code === "MODIFICATION_CAPTURE_OLD_NEW_VALUES") return "Old/new value traceability is incomplete.";
  if (finding.check_code === "DELETE_ACTION") return "Delete or remove activity requires justification and approval review.";
  if (finding.check_code === "PERMISSION_ACCESS_CHANGE") return "Permission, access, role, group, or security setting changed.";
  if (finding.check_code === "CONFIGURATION_SYSTEM_CHANGE") return "System configuration changed and may require change-control evidence.";
  return finding.finding_summary || finding.description || "Audit review check raised this finding.";
};

const findingBusinessSummary = (
  finding: AuditReviewFinding,
  record: AuditTrailRecord | null,
  config: BusinessHoursConfig,
): string => {
  const user = findingUser(finding, record);
  const action = findingAction(finding, record);
  const localTime = findingEventTime(finding, record, config);
  const auditTrailLabel = formatAuditReviewLabel(findingAuditTrailType(finding, record));
  const target = findingTarget(finding, record);

  if (finding.check_code === "OFF_HOURS_ACTIVITY") {
    return `${user} performed ${action} at ${localTime} from ${auditTrailLabel}, outside approved business hours ${businessHoursWindow(config)}.`;
  }
  if (finding.check_code === "DATA_EXPORT_LOGGING") {
    return `${user} performed ${action} at ${localTime} from ${auditTrailLabel}. QA should verify business purpose, recipient, and authorization.`;
  }
  if (finding.check_code === "MODIFICATION_CAPTURE_OLD_NEW_VALUES") {
    return `${user} performed update/change activity on ${target} at ${localTime}, but old/new value traceability is incomplete.`;
  }
  if (finding.check_code === "DELETE_ACTION") {
    return `${user} performed delete/remove activity on ${target} at ${localTime}. QA should verify deletion justification and approval.`;
  }
  if (finding.check_code === "PERMISSION_ACCESS_CHANGE") {
    return `${user} changed permission/access/security settings at ${localTime}. QA should verify authorization and segregation of duties.`;
  }
  if (finding.check_code === "CONFIGURATION_SYSTEM_CHANGE") {
    return `${user} changed system configuration at ${localTime}. QA should verify approved change control reference.`;
  }
  return `${user} performed ${action} at ${localTime} from ${auditTrailLabel}. ${findingReason(finding)}`;
};

const escapeExcelHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const excelSafeValue = (value?: string | number | null): string => escapeExcelHtml(String(value ?? ""));

const exportFindingsToExcel = (
  findings: AuditReviewFinding[],
  records: AuditTrailRecord[],
  config: BusinessHoursConfig,
  fileName: string,
): void => {
  const columns = [
    "Finding Title",
    "Check Code",
    "Check Name",
    "Severity",
    "Status",
    "Performed By",
    "Detected Action",
    "Event Time",
    "Audit Trail Type",
    "Why Flagged",
    "Recommended QA Action",
    "Source Record ID",
    "Business Summary",
  ];
  const rows = findings.map((finding) => {
    const record = findingMatchedRecord(finding, records);
    return [
      finding.finding_title || finding.title || finding.check_name || "Audit review finding",
      finding.check_code,
      finding.check_name,
      formatAuditReviewLabel(finding.severity),
      formatAuditReviewLabel(finding.status),
      findingUser(finding, record),
      findingAction(finding, record),
      findingEventTime(finding, record, config),
      formatAuditReviewLabel(findingAuditTrailType(finding, record)),
      findingReason(finding),
      findingRecommendation(finding.check_code),
      findingSourceRecord(finding, record),
      findingBusinessSummary(finding, record, config),
    ];
  });
  const tableHead = columns.map((column) => `<th>${excelSafeValue(column)}</th>`).join("");
  const tableRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${excelSafeValue(cell)}</td>`).join("")}</tr>`)
    .join("");
  const workbookHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
      th { background: #e2e8f0; font-weight: 700; }
      th, td { border: 1px solid #cbd5e1; padding: 6px 8px; mso-number-format: "\\@"; vertical-align: top; }
    </style>
  </head>
  <body>
    <table>
      <thead><tr>${tableHead}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </body>
</html>`;
  const blob = new Blob([workbookHtml], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.endsWith(".xls") ? fileName : `${fileName}.xls`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const CHECK_CODE_ALIASES: Record<string, string> = {
  TIMESTAMP_INTEGRITY: "MISSING_TIMESTAMP",
  USER_ATTRIBUTION: "MISSING_USER_ID",
  CREATION_TRACEABILITY: "RECORD_ADDITION_TRACEABILITY",
  OLD_NEW_VALUE_CAPTURE: "MODIFICATION_CAPTURE_OLD_NEW_VALUES",
  DELETE_TRACEABILITY: "DELETE_ACTION",
  BUSINESS_HOURS_REVIEW: "OFF_HOURS_ACTIVITY",
  PERMISSION_CHANGE_REVIEW: "PERMISSION_ACCESS_CHANGE",
  CONFIGURATION_CHANGE_REVIEW: "CONFIGURATION_SYSTEM_CHANGE",
  EXPORT_TRACEABILITY: "DATA_EXPORT_LOGGING",
  EXTRACTION_COMPLETENESS: "AUDIT_TRAIL_COMPLETENESS",
  OFF_HOUR_ACTIVITY: "OFF_HOURS_ACTIVITY",
  OFFHOURS_ACTIVITY: "OFF_HOURS_ACTIVITY",
  OFF_HOURS_ACCESS: "OFF_HOURS_ACTIVITY",
  OFF_HOURS_LOGIN: "OFF_HOURS_ACTIVITY",
};

type ChecklistCategory = "passed" | "withFindings" | "notApplicable" | "noData" | "partial";
type ChecklistRow = Record<string, unknown> & {
  check_code: string;
  check_name?: string | null;
  normalized_check_code: string;
  evaluated_record_count: number;
  finding_count: number;
};

const normalizeCheckCode = (value: unknown): string => {
  const normalized = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return CHECK_CODE_ALIASES[normalized] || normalized;
};

const finiteNumber = (value: unknown): number | null => {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : null;
};

const firstFiniteNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    const numeric = finiteNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
};

const maxFiniteNumber = (...values: unknown[]): number | null => {
  const numbers = values
    .map(finiteNumber)
    .filter((value): value is number => value !== null);
  return numbers.length > 0 ? Math.max(...numbers) : null;
};

const rowCheckCode = (row: Record<string, unknown>): string =>
  normalizeCheckCode(row.check_code ?? row.checkpoint_code);

const findingsByCheckCode = (findings: AuditReviewFinding[]): Map<string, number> => {
  const counts = new Map<string, number>();
  findings.forEach((finding) => {
    const checkCode = normalizeCheckCode(finding.check_code);
    if (!checkCode) return;
    counts.set(checkCode, (counts.get(checkCode) ?? 0) + 1);
  });
  return counts;
};

const checklistStatus = (row: Record<string, unknown>): string =>
  String(row.check_status ?? row.applicability ?? row.score_status ?? "").trim().toUpperCase();

const checklistCategory = (row: Record<string, unknown>): ChecklistCategory => {
  const findingCount = firstFiniteNumber(row.finding_count) ?? 0;
  const evaluatedCount = firstFiniteNumber(row.evaluated_record_count, row.applicable_record_count) ?? 0;
  const noDataCount = firstFiniteNumber(row.no_data_count) ?? 0;
  const status = checklistStatus(row);

  if (findingCount > 0) return "withFindings";
  if (status === "NOT_APPLICABLE") return "notApplicable";
  if (status === "NO_DATA" || evaluatedCount === 0) return "noData";
  if (status === "PARTIAL" && noDataCount > 0) return "partial";
  return "passed";
};

const checklistFriendlyStatus = (row: Record<string, unknown>): string => {
  const category = checklistCategory(row);
  if (category === "withFindings") return "With Findings";
  if (category === "passed") return "Checked";
  if (category === "notApplicable") return "Not applicable for this audit type";
  if (category === "noData") return "No records available";
  if (category === "partial") return "Checked with limitations";
  return formatAuditReviewLabel(checklistStatus(row) || "-");
};

const checklistRows = (
  job: AuditReviewJobDetail | null,
  scores: AuditReviewScore[],
  findings: AuditReviewFinding[] = [],
): ChecklistRow[] => {
  const summaryRows = (job?.checklist_applicability?.filter((item) => item && typeof item === "object") ?? []) as Array<Record<string, unknown>>;
  const jobScoreRows = (job?.checkpoint_scores?.filter((item) => item && typeof item === "object") ?? []) as Array<Record<string, unknown>>;
  const endpointScoreRows = scores
    .filter((score) => String(score.score_scope).toUpperCase() === "CHECKPOINT")
    .map((score) => score as unknown as Record<string, unknown>);
  const scoreRows = [...jobScoreRows, ...endpointScoreRows];
  const scoreByCheckCode = new Map<string, Record<string, unknown>>();
  scoreRows.forEach((score) => {
    const checkCode = rowCheckCode(score);
    if (checkCode) scoreByCheckCode.set(checkCode, score);
  });

  const baseRows = summaryRows.length > 0 ? [...summaryRows] : [...scoreRows];
  const seen = new Set(baseRows.map(rowCheckCode).filter(Boolean));
  scoreRows.forEach((score) => {
    const checkCode = rowCheckCode(score);
    if (checkCode && !seen.has(checkCode)) {
      seen.add(checkCode);
      baseRows.push(score);
    }
  });

  const computedFindingCounts = findingsByCheckCode(findings);
  return baseRows
    .map((row) => {
      const checkCode = rowCheckCode(row);
      const scoreRow = scoreByCheckCode.get(checkCode);
      const backendFindingCount = maxFiniteNumber(
        row.finding_count,
        row.findings_count,
        row.total_findings,
        scoreRow?.finding_count,
      ) ?? 0;
      const computedFindingCount = computedFindingCounts.get(checkCode) ?? 0;
      const findingCount = Math.max(backendFindingCount, computedFindingCount);
      const evaluatedRecordCount = firstFiniteNumber(
        row.evaluated_record_count,
        scoreRow?.evaluated_record_count,
        row.applicable_record_count,
        scoreRow?.applicable_record_count,
      ) ?? 0;

      return {
        ...(scoreRow ?? {}),
        ...row,
        check_code: checkCode || String(row.check_code ?? scoreRow?.check_code ?? "-"),
        check_name: row.check_name ?? scoreRow?.check_name ?? null,
        normalized_check_code: checkCode,
        evaluated_record_count: evaluatedRecordCount,
        finding_count: findingCount,
      };
    })
    .sort((left, right) => (firstFiniteNumber(left.sort_order) ?? 0) - (firstFiniteNumber(right.sort_order) ?? 0));
};

const checklistSummary = (
  job: AuditReviewJobDetail | null,
  scores: AuditReviewScore[],
  findings: AuditReviewFinding[] = [],
) => {
  const rows = checklistRows(job, scores, findings);
  return rows.reduce(
    (acc, row) => {
      const category = checklistCategory(row);
      if (category === "passed") acc.passed += 1;
      else if (category === "withFindings") acc.withFindings += 1;
      else if (category === "notApplicable") acc.notApplicable += 1;
      else if (category === "noData") acc.noData += 1;
      else if (category === "partial") acc.partial += 1;
      return acc;
    },
    { passed: 0, withFindings: 0, notApplicable: 0, noData: 0, partial: 0 },
  );
};

function SectionTitle({ icon, title, description, action, quiet = false }: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  quiet?: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
      quiet ? "px-0 pb-3 pt-0" : "border-b border-slate-200 px-5 py-4",
    )}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <div className="mt-0.5 text-slate-500">{icon}</div> : null}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function AssetSelector({
  assets,
  selectedAssetId,
  onSelect,
  loading,
  error,
  disabled,
  showAllActive,
  activeAssetCount,
  onShowAllActive,
  onShowValidatedOnly,
  onGoToAssetMaster,
}: {
  assets: AssetRecord[];
  selectedAssetId: string | null;
  onSelect: (assetId: string) => void;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  showAllActive?: boolean;
  activeAssetCount?: number;
  onShowAllActive?: () => void;
  onShowValidatedOnly?: () => void;
  onGoToAssetMaster?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedAsset = assets.find((asset) => assetSelectionId(asset) === selectedAssetId) ?? null;
  const hasAssets = assets.length > 0;
  const selectorDisabled = Boolean(disabled || loading || error || !hasAssets);
  const statusText = loading
    ? "Loading validated software/system assets..."
    : error
      ? "Unable to load validated software/system assets."
      : selectedAsset
        ? assetPrimaryLabel(selectedAsset)
        : "Search or select a validated software/system asset...";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <label className="block text-sm font-medium text-slate-700">Select Validated Software Asset</label>
        <span className="text-xs font-medium text-slate-500">
          {loading ? "Loading" : showAllActive ? `${assets.length} active assets` : `${assets.length} validated software/system assets`}
        </span>
      </div>

      <Popover open={open && !selectorDisabled} onOpenChange={(nextOpen) => setOpen(selectorDisabled ? false : nextOpen)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            disabled={selectorDisabled}
            className={cn(
              "flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm shadow-sm transition-colors",
              "focus-visible:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25",
              selectorDisabled ? "cursor-not-allowed opacity-70" : "hover:border-slate-400",
            )}
          >
            <span className={cn("min-w-0 flex-1 truncate", selectedAsset ? "font-medium text-slate-950" : "text-slate-500")}>
              {statusText}
            </span>
            {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter>
            <CommandInput placeholder="Search or select a validated software/system asset..." />
            <CommandList className="max-h-80">
              <CommandEmpty>No matching assets found.</CommandEmpty>
              <CommandGroup>
                {assets.map((asset) => {
                  const optionId = assetSelectionId(asset);
                  const secondary = assetSecondaryLabel(asset);
                  const selected = optionId === selectedAssetId;
                  return (
                    <CommandItem
                      key={optionId || `${assetIdLabel(asset)}-${assetNameLabel(asset)}`}
                      value={`${assetSearchLabel(asset)} ${optionId}`}
                      disabled={!optionId}
                      onSelect={() => {
                        if (!optionId) return;
                        onSelect(optionId);
                        setOpen(false);
                      }}
                      className="items-start gap-3 px-3 py-2"
                    >
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-950">{assetPrimaryLabel(asset)}</div>
                        {secondary ? <div className="mt-0.5 truncate text-xs text-slate-500">{secondary}</div> : null}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {loading ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
          Loading validated software/system assets...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          Unable to load validated software/system assets.
        </div>
      ) : !hasAssets ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">
            {showAllActive ? "No active assets found." : "No validated software/system assets found."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {onGoToAssetMaster ? <Button type="button" variant="outline" onClick={onGoToAssetMaster}>
              <ExternalLink className="h-4 w-4" />
              Go to Asset Master
            </Button> : null}
            {!showAllActive && onShowAllActive && (activeAssetCount ?? 0) > 0 ? (
              <Button type="button" variant="secondary" onClick={onShowAllActive}>
                Show all active assets for troubleshooting
              </Button>
            ) : null}
          </div>
        </div>
      ) : showAllActive ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>Troubleshooting view: showing all active assets. The validated software filter is relaxed.</span>
          {onShowValidatedOnly ? <Button type="button" size="sm" variant="outline" onClick={onShowValidatedOnly}>
            Show validated software assets only
          </Button> : null}
        </div>
      ) : null}
    </div>
  );
}

function AssetContextCard({
  asset,
  jobs,
  schedules,
  action,
  collapsed = false,
  onCollapsedChange,
}: {
  asset: AssetRecord;
  jobs: AuditReviewJobListItem[];
  schedules: AuditReviewSchedule[];
  action?: React.ReactNode;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}) {
  const latestJob = jobs[0];
  const nextRun = schedules.find((schedule) => schedule.enabled)?.next_run_dt;
  const tags = Array.isArray(asset.tags)
    ? asset.tags.map(textValue).filter((tag): tag is string => Boolean(tag))
    : [];
  const items = [
    ["Asset name", assetNameLabel(asset)],
    ["Asset ID", assetIdLabel(asset)],
    ["Current status", assetStatusLabel(asset)],
    ["Current/validated version", textValue(asset.asset_version)],
    ["Organization/business unit", textValue(asset.org_node_name)],
    ["Owner / QA owner / IT owner", textValue(asset.asset_owner)],
    ["Criticality", textValue(asset.criticality_class) || textValue(asset.asset_criticality)],
    ["GxP impact", tags.find((tag) => tag.toLowerCase().includes("gxp")) || null],
    ["Part 11 applicability", tags.find((tag) => tag.toLowerCase().includes("part 11")) || null],
    ["Veeva instance/app/source", assetSourceSystemLabel(asset) || (latestJob?.audit_trail_type ? "Veeva audit trail" : null)],
    ["Last review", latestJob?.created_dt ? formatAuditReviewDate(latestJob.created_dt) : null],
    ["Next review due", nextRun ? formatAuditReviewDate(nextRun) : null],
  ];

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
      <SectionTitle
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Asset Compliance Context"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {action}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onCollapsedChange?.(!collapsed)}
              aria-expanded={!collapsed}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed ? "" : "rotate-180")} />
              {collapsed ? "Show Context" : "Hide Context"}
            </Button>
          </div>
        }
      />
      {!collapsed ? (
        <CardBody className="grid grid-cols-1 gap-3 py-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
              <div className="mt-1 text-sm font-medium text-slate-900">{value || "-"}</div>
            </div>
          ))}
        </CardBody>
      ) : null}
    </Card>
  );
}

function RunReviewActionButton({
  disabled,
  running,
  onClick,
}: {
  disabled: boolean;
  running: boolean;
  onClick: () => void;
}) {
  const disabledReason = disabled && !running ? "Select a validated software asset first." : null;
  const button = (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabledReason ?? undefined}
    >
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
      Run Audit Trail Review
    </Button>
  );

  if (!disabledReason) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{disabledReason}</TooltipContent>
    </Tooltip>
  );
}

function ReviewHistoryTable({
  jobs,
  reports,
  selectedJobId,
  title = "Previous Audit Reviews",
  description = "Closed periodic review reports appear here after QA approval or rejection.",
  emptyMessage = "No closed audit trail reviews found for this asset.",
  statusFilter,
  onView,
  onDownload,
  showRunSource = false,
}: {
  jobs: AuditReviewJobListItem[];
  reports: AuditReviewReportListItem[];
  selectedJobId?: string | null;
  title?: string;
  description?: string;
  emptyMessage?: string;
  showRunSource?: boolean;
  statusFilter?: (
    status: AuditReviewReportStatus | null,
    job: AuditReviewJobListItem,
    report?: AuditReviewReportListItem,
  ) => boolean;
  onView: (jobId: string) => void;
  onDownload?: (reportId: string) => void;
}) {
  const reportByJob = useMemo(() => {
    const map = new Map<string, AuditReviewReportListItem>();
    reports.forEach((report) => {
      if (!map.has(report.job_id)) map.set(report.job_id, report);
    });
    return map;
  }, [reports]);
  const visibleJobs = jobs.filter((job) => {
    const report = reportByJob.get(job.job_id);
    const reportStatus = reportStatusForJob(job, report);
    return statusFilter ? statusFilter(reportStatus, job, report) : true;
  });
  const columnCount = showRunSource ? 9 : 8;

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
      <SectionTitle
        icon={<History className="h-5 w-5" />}
        title={title}
        description={description}
      />
      <div className="overflow-x-auto">
        <Table className={cn(showRunSource ? "min-w-[1240px]" : "min-w-[1100px]")}>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Date</TableHead>
              {showRunSource ? <TableHead>Run source</TableHead> : null}
              <TableHead>Review period</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Audit trail types</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Report status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-8 text-center text-slate-500">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              visibleJobs.map((job) => {
                const report = reportByJob.get(job.job_id);
                const reportStatus = reportStatusForJob(job, report);
                const scheduled = isScheduledReviewOrigin(job, report);
                const runDuration = formatRunDuration(job.created_dt, job.completed_at);
                const decisionDate =
                  reportStatus === "APPROVED" || reportStatus === "REJECTED" ? report?.reviewed_dt : null;
                return (
                  <TableRow
                    key={job.job_id}
                    className={cn(
                      selectedJobId === job.job_id ? "bg-blue-50/50" : undefined,
                      showRunSource && scheduled ? "border-l-4 border-l-cyan-400 bg-cyan-50/30" : undefined,
                    )}
                  >
                    <TableCell>
                      <div className="font-medium text-slate-900">{formatAuditReviewDateTime(job.created_dt)}</div>
                      <div className="mt-1 text-xs text-slate-500">Running time: {runDuration}</div>
                      {decisionDate ? (
                        <div className="mt-1 text-xs text-slate-500">Decision: {formatAuditReviewDateTime(decisionDate)}</div>
                      ) : null}
                    </TableCell>
                    {showRunSource ? (
                      <TableCell>
                        <div className="space-y-1">
                          <Badge
                            variant="outline"
                            className={
                              scheduled
                                ? "border-cyan-200 bg-cyan-50 text-cyan-700"
                                : "border-slate-200 bg-slate-50 text-slate-600"
                            }
                          >
                            {scheduled ? "Scheduled audit trail review" : "Manual review"}
                          </Badge>
                          {scheduled ? (
                            <div className="text-xs font-medium text-cyan-800">Scheduler generated draft workflow</div>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                    <TableCell>{formatAuditReviewPeriod(job.review_start_dt, job.review_end_dt)}</TableCell>
                    <TableCell>{formatAuditReviewLabel(job.review_scope)}</TableCell>
                    <TableCell className="max-w-72 whitespace-normal">
                      {(job.selected_audit_trail_types?.length ? job.selected_audit_trail_types : [job.audit_trail_type])
                        .map(formatAuditReviewLabel)
                        .join(", ")}
                    </TableCell>
                    <TableCell>{report?.overall_score ?? ("overall_score" in job ? (job as AuditReviewJobDetail).overall_score ?? "-" : "-")}</TableCell>
                    <TableCell>
                      {report?.rating || ("rating" in job && (job as AuditReviewJobDetail).rating) ? (
                        <Badge variant="outline" className={getAuditReviewRatingBadgeClass(report?.rating || (job as AuditReviewJobDetail).rating)}>
                          {formatAuditReviewRating(report?.rating || (job as AuditReviewJobDetail).rating)}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getAuditReviewReportStatusBadgeClass(reportStatus)}>
                        {statusLabel(reportStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => onView(job.job_id)}>
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        {report && onDownload && canDownloadAuditReviewReport(reportStatus) ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => onDownload(report.report_id)}>
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function PipelineTimeline({ steps, visible }: { steps: PipelineStep[]; visible: boolean }) {
  if (!visible) return null;
  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
      <SectionTitle icon={<RefreshCw className="h-5 w-5" />} title="Live Progress" description="One-click pipeline status for this review run." />
      <CardBody className="grid grid-cols-1 gap-3 py-5 lg:grid-cols-4">
        {steps.map((step) => {
          const color =
            step.status === "done"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : step.status === "active"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : step.status === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : step.status === "failed"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-slate-200 bg-slate-50 text-slate-500";
          return (
            <div key={step.key} className={`rounded-lg border px-3 py-3 ${color}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {step.status === "active" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {pipelineStepLabel(step)}
              </div>
              {step.message ? <p className="mt-1 text-xs leading-5">{step.message}</p> : null}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function RunReviewDialog({
  open,
  asset,
  metadata,
  jobs,
  creating,
  onClose,
  onRun,
  onViewExisting,
}: {
  open: boolean;
  asset: AssetRecord | null;
  metadata: AuditReviewMetadata;
  jobs: AuditReviewJobListItem[];
  creating: boolean;
  onClose: () => void;
  onRun: (payload: AuditReviewJobCreatePayload, form: RunFormState) => Promise<void>;
  onViewExisting: (jobId: string) => void;
}) {
  const [form, setForm] = useState<RunFormState>(buildDefaultRunForm);
  const [duplicate, setDuplicate] = useState<AuditReviewJobListItem | null>(null);

  useEffect(() => {
    if (open) {
      setForm(buildDefaultRunForm(metadata));
      setDuplicate(null);
    }
  }, [open]);

  const effectiveTypes = selectedTypesForScope(metadata, form.reviewScope, form.selectedAuditTrailTypes);
  const reviewWindowError = reviewWindowValidationMessage(metadata, form.reviewStart, form.reviewEnd);
  const canRun = Boolean(asset && form.reviewStart && form.reviewEnd && effectiveTypes.length > 0 && !reviewWindowError && !creating);

  const updateScope = (scope: AuditReviewScope) => {
    const types = selectedTypesForScope(metadata, scope, form.selectedAuditTrailTypes);
    setForm((previous) => ({
      ...previous,
      reviewScope: scope,
      selectedAuditTrailTypes: scope === "CUSTOM" ? previous.selectedAuditTrailTypes : types,
    }));
    setDuplicate(null);
  };

  const toggleCustomType = (type: string, checked: boolean) => {
    setForm((previous) => ({
      ...previous,
      selectedAuditTrailTypes: checked
        ? Array.from(new Set([...previous.selectedAuditTrailTypes, type]))
        : previous.selectedAuditTrailTypes.filter((item) => item !== type),
    }));
    setDuplicate(null);
  };

  const findDuplicate = (): AuditReviewJobListItem | null => {
    const startIso = toUtcIso(form.reviewStart);
    const endIso = toUtcIso(form.reviewEnd);
    return jobs.find((job) => {
      const jobTypes = job.selected_audit_trail_types?.length ? job.selected_audit_trail_types : [job.audit_trail_type];
      return (
        new Date(job.review_start_dt).toISOString() === startIso &&
        new Date(job.review_end_dt).toISOString() === endIso &&
        job.review_scope === form.reviewScope &&
        sameStringSet(jobTypes, effectiveTypes)
      );
    }) ?? null;
  };

  const submit = async (force = false) => {
    if (!asset || !canRun) return;
    if (reviewWindowError) return;
    const existing = findDuplicate();
    if (existing && !force) {
      setDuplicate(existing);
      return;
    }
    setDuplicate(null);
    await onRun(
      {
        review_start_dt: toUtcIso(form.reviewStart),
        review_end_dt: toUtcIso(form.reviewEnd),
        audit_trail_type: effectiveTypes[0],
        review_scope: form.reviewScope,
        selected_audit_trail_types: effectiveTypes,
        veeva_instance_name: form.veevaInstanceName.trim() || null,
        veeva_app_name: form.veevaAppName.trim() || null,
      },
      { ...form, selectedAuditTrailTypes: effectiveTypes },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen && !creating ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] w-[min(980px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)] lg:max-w-5xl">
        <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-left">
          <DialogTitle className="text-lg font-semibold text-slate-950">Run Audit Trail Review</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-slate-600">
            Review scope controls the audit trail types unless Custom is selected.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-9rem)] space-y-5 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[1.4fr_1fr_1fr]">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asset</div>
              <div className="mt-1 break-words text-sm font-semibold text-slate-900">{asset?.asset_name || "-"}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asset ID</div>
              <div className="mt-1 break-words text-sm font-semibold text-slate-900">{asset?.asset_id || "-"}</div>
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Owner</div>
              <div className="mt-1 break-words text-sm font-semibold text-slate-900">{asset?.asset_owner || "-"}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Review start"
              type="datetime-local"
              value={form.reviewStart}
              onChange={(event) => {
                setForm((previous) => ({ ...previous, reviewStart: event.target.value }));
                setDuplicate(null);
              }}
              disabled={creating}
              className="h-10"
            />
            <Input
              label="Review end"
              type="datetime-local"
              value={form.reviewEnd}
              onChange={(event) => {
                setForm((previous) => ({ ...previous, reviewEnd: event.target.value }));
                setDuplicate(null);
              }}
              disabled={creating}
              className="h-10"
            />
          </div>
          {reviewWindowError ? <p className="text-sm text-red-600">{reviewWindowError}</p> : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Review scope</label>
              <Select value={form.reviewScope} onValueChange={(value) => updateScope(value as AuditReviewScope)} disabled={creating}>
                <SelectTrigger className="h-10 min-w-0 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metadata.review_scopes.map((scope) => (
                    <SelectItem key={scope.code} value={scope.code}>{scope.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Selected audit trail types</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {effectiveTypes.map((type) => (
                <Badge key={type} variant="outline" className="border-slate-200 bg-white text-slate-700">
                  {metadata.supported_audit_trail_types.find((item) => item.code === type)?.label || formatAuditReviewLabel(type)}
                </Badge>
              ))}
            </div>
            {form.reviewScope === "CUSTOM" ? (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {metadata.supported_audit_trail_types.map((type) => (
                  <label key={type.code} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    <Checkbox
                      checked={form.selectedAuditTrailTypes.includes(type.code)}
                      onCheckedChange={(checked) => toggleCustomType(type.code, checked === true)}
                      disabled={creating}
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            ) : null}
            {effectiveTypes.length === 0 ? <p className="mt-2 text-sm text-red-600">Select at least one audit trail type.</p> : null}
          </div>

          {duplicate ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5" />
                <div>
                  <div className="font-semibold">A review already exists for this period. View existing review or run again?</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => onViewExisting(duplicate.job_id)} disabled={creating}>
                      View Existing
                    </Button>
                    <Button type="button" onClick={() => void submit(true)} disabled={creating}>
                      Run Again
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={creating}>Cancel</Button>
          <Button type="button" onClick={() => void submit(false)} disabled={!canRun}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Run Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultSummaryHeader({
  runtime,
  onGenerateDraft,
  onDownloadReport,
  onSubmitForApproval,
  generatingDraft = false,
  downloadingReport = false,
  submittingReport = false,
  quiet = false,
}: {
  runtime: ReviewRuntime;
  onGenerateDraft?: () => void;
  onDownloadReport?: () => void;
  onSubmitForApproval?: () => void;
  generatingDraft?: boolean;
  downloadingReport?: boolean;
  submittingReport?: boolean;
  quiet?: boolean;
}) {
  const scoreLabel = scoreLabelForSelection(runtime.reviewScope, runtime.selectedAuditTrailTypes);
  const reportReady = Boolean(runtime.report?.report_id || runtime.job.latest_report_id);
  const reportStatus = runtime.report?.status;
  const canGenerateDraft = !reportReady && (runtime.job.status === "ANALYZED" || runtime.job.status === "REPORT_DRAFTED") && Boolean(onGenerateDraft);
  const canSubmitDraft = (reportStatus === "DRAFT" || reportStatus === "CHANGES_REQUESTED") && Boolean(onSubmitForApproval);
  const canDownloadApprovedReport = canDownloadAuditReviewReport(reportStatus) && Boolean(onDownloadReport);
  const submitLabel = reportStatus === "CHANGES_REQUESTED" ? "Resubmit for QA Review" : "Submit for QA Review";

  return (
    <SectionTitle
      icon={<ClipboardCheck className="h-5 w-5" />}
      title="Current Review Result"
      action={
        <div className="flex flex-wrap items-center justify-end gap-3">
          {canGenerateDraft ? (
            <Button
              type="button"
              size="sm"
              onClick={onGenerateDraft}
              disabled={generatingDraft}
            >
              {generatingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate Report Preview
            </Button>
          ) : null}
          {canSubmitDraft ? (
            <Button
              type="button"
              size="sm"
              onClick={onSubmitForApproval}
              disabled={submittingReport}
            >
              {submittingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitLabel}
            </Button>
          ) : null}
          {canDownloadApprovedReport ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onDownloadReport}
              disabled={!reportReady || downloadingReport}
              className="bg-white"
            >
              {downloadingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download Approved PDF
            </Button>
          ) : null}
          <div className={cn(
            "flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2",
            quiet ? "" : "border border-slate-200",
          )}>
            <div className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700",
              quiet ? "" : "border border-blue-100",
            )}>
              <Gauge className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{scoreLabel}</div>
              <div className="mt-1 flex items-end">
                <div className="text-3xl font-semibold leading-none text-slate-950">{runtime.job.overall_score ?? "-"}</div>
              </div>
            </div>
          </div>
        </div>
      }
      quiet={quiet}
    />
  );
}

function ResultSummary({
  runtime,
  onGenerateDraft,
  onDownloadReport,
  generatingDraft = false,
  downloadingReport = false,
  quiet = false,
}: {
  runtime: ReviewRuntime;
  onGenerateDraft?: () => void;
  onDownloadReport?: () => void;
  generatingDraft?: boolean;
  downloadingReport?: boolean;
  quiet?: boolean;
}) {
  return (
    <Card className={cn(
      "rounded-lg bg-white",
      quiet ? "border-0 bg-transparent shadow-none" : "border-slate-200 shadow-sm",
    )} padding="none">
      <ResultSummaryHeader
        runtime={runtime}
        onGenerateDraft={onGenerateDraft}
        onDownloadReport={onDownloadReport}
        generatingDraft={generatingDraft}
        downloadingReport={downloadingReport}
        quiet={quiet}
      />
    </Card>
  );
}

function CurrentResultSummaryTab({
  runtime,
}: {
  runtime: ReviewRuntime;
}) {
  const reportStatus = runtime.report?.status || runtime.job.latest_report_status;
  const items = [
    ["Review period", formatAuditReviewPeriod(runtime.job.review_start_dt, runtime.job.review_end_dt)],
    ["Scope", formatAuditReviewLabel(runtime.reviewScope)],
    ["Audit trails", runtime.selectedAuditTrailTypes.map(formatAuditReviewLabel).join(", ")],
    ["Records analyzed", formatAuditReviewNumber(runtime.job.record_count)],
    ["Findings", formatAuditReviewNumber(runtime.job.finding_count)],
    ["Report status", statusLabel(reportStatus)],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{value || "-"}</div>
          </div>
        ))}
      </div>
      <TechnicalChecklistSummary runtime={runtime} />
    </div>
  );
}

function ReviewApprovalDecisionPanel({
  runtime,
  canApprove = false,
  canReject = false,
  canRequestChanges = false,
  canSubmit = false,
  actionLoading = null,
  quiet = false,
  onSubmitReview,
  onDecision,
}: {
  runtime: ReviewRuntime;
  canApprove?: boolean;
  canReject?: boolean;
  canRequestChanges?: boolean;
  canSubmit?: boolean;
  actionLoading?: ReportWorkflowAction | null;
  quiet?: boolean;
  onSubmitReview?: (submissionNotes: string) => Promise<void>;
  onDecision?: (
    action: ReviewDecisionAction,
    reviewerComments: string,
    eSignature?: AuditReviewReportESignaturePayload,
  ) => Promise<void>;
}) {
  const [reviewerComments, setReviewerComments] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("Requested changes have been addressed. Please review again.");
  const [approvalCardOpen, setApprovalCardOpen] = useState(false);
  const [approvalEmail, setApprovalEmail] = useState("");
  const [approvalPassword, setApprovalPassword] = useState("");
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [approvalErrors, setApprovalErrors] = useState<AuditReviewESignatureFieldErrors>({});
  const { user } = useAuth();
  const report = runtime.report;
  const isUnderReview = report?.status === "UNDER_REVIEW";
  const isDraft = report?.status === "DRAFT";
  const isChangesRequested = report?.status === "CHANGES_REQUESTED";
  const canTakeDecision = Boolean(isUnderReview && onDecision && (canApprove || canReject || canRequestChanges));
  const canSubmitForReview = Boolean((isDraft || isChangesRequested) && canSubmit && onSubmitReview);
  const actionBusy = Boolean(actionLoading);
  const decisionDisabled = actionBusy || !reviewerComments.trim();
  const approveDisabled = decisionDisabled;
  const canSubmitApproval = Boolean(
    reviewerComments.trim() &&
    approvalEmail.trim() &&
    approvalPassword.trim() &&
    approvalConfirmed &&
    !actionBusy,
  );
  const submitDisabled = actionBusy || !submissionNotes.trim();

  useEffect(() => {
    setReviewerComments("");
    setApprovalCardOpen(false);
    setApprovalEmail("");
    setApprovalPassword("");
    setApprovalConfirmed(false);
    setApprovalErrors({});
    setSubmissionNotes(
      report?.status === "CHANGES_REQUESTED"
        ? "Requested changes have been addressed. Please review again."
        : "Please review the draft audit trail report.",
    );
  }, [report?.report_id, report?.status]);

  if (!report || (!canTakeDecision && !canSubmitForReview && !report.reviewed_by && !report.reviewer_comments && report.status !== "UNDER_REVIEW" && report.status !== "CHANGES_REQUESTED")) {
    return null;
  }

  const clearApprovalError = (field: keyof AuditReviewESignatureFieldErrors) => {
    setApprovalErrors((current) => ({ ...current, [field]: null, form: null }));
  };

  const submitDecision = async (action: ReviewDecisionAction) => {
    if (!onDecision || !reviewerComments.trim()) return;
    const eSignature =
      action === "approve"
        ? {
            user_email: approvalEmail.trim(),
            current_password: approvalPassword,
            signature_meaning: AUDIT_REVIEW_SIGNATURE_MEANING,
            confirmed: approvalConfirmed,
          }
        : undefined;
    if (action === "approve") {
      if (!approvalEmail.trim() || !approvalPassword.trim() || !approvalConfirmed) {
        setApprovalErrors({
          email: !approvalEmail.trim() ? "Enter your user email." : null,
          password: !approvalPassword.trim() ? "Enter your current password." : null,
          confirmed: !approvalConfirmed ? "Confirm the electronic signature acknowledgement." : null,
        });
        return;
      }
      const signedInEmail = user?.email?.trim().toLowerCase();
      if (signedInEmail && approvalEmail.trim().toLowerCase() !== signedInEmail) {
        setApprovalErrors({ email: "Electronic signature email must match the signed-in user." });
        return;
      }
    }
    setApprovalErrors({});
    try {
      await onDecision(action, reviewerComments.trim(), eSignature);
      if (action === "approve") setApprovalCardOpen(false);
    } catch (error) {
      if (action === "approve") {
        setApprovalErrors(getAuditReviewESignatureFieldErrors(error));
      }
    }
  };

  const submitForReview = async () => {
    if (!onSubmitReview || !submissionNotes.trim()) return;
    await onSubmitReview(submissionNotes.trim());
  };

  const closeApprovalCard = () => {
    if (actionBusy) return;
    setApprovalCardOpen(false);
    setApprovalEmail("");
    setApprovalPassword("");
    setApprovalConfirmed(false);
    setApprovalErrors({});
  };

  const panelTitle = canSubmitForReview
    ? isChangesRequested
      ? "Reviewer Response"
      : "Reviewer Submission"
    : "Approval Decision";
  const panelDescription = canTakeDecision
    ? "Capture the final QA decision for this submitted report."
    : canSubmitForReview && isChangesRequested
      ? "Respond to the requested changes and send the report back for final QA approval."
      : canSubmitForReview
        ? "Submit this draft report for final QA approval."
        : isChangesRequested
          ? "Changes were requested and are waiting for QA Reviewer response."
          : "Final QA decision recorded for this report.";

  return (
    <>
      <Card className={cn(
      "rounded-lg bg-white",
      quiet ? "border-0 bg-transparent shadow-none" : "border-slate-200 shadow-sm",
      )} padding="none">
      <SectionTitle
        icon={<ShieldCheck className="h-5 w-5" />}
        title={panelTitle}
        description={panelDescription}
        quiet={quiet}
        action={
          <Badge variant="outline" className={getAuditReviewReportStatusBadgeClass(report.status)}>
            {statusLabel(report.status)}
          </Badge>
        }
      />
      <CardBody className={cn("space-y-4", quiet ? "px-0 pb-2 pt-0" : "py-5")}>
        {canSubmitForReview ? (
          <>
            {isChangesRequested ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className={cn("rounded-lg bg-slate-50 px-3 py-3", quiet ? "" : "border border-slate-200")}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Requested by</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{report.reviewed_by || "-"}</div>
                </div>
                <div className={cn("rounded-lg bg-slate-50 px-3 py-3", quiet ? "" : "border border-slate-200")}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Requested date</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{formatAuditReviewDateTime(report.reviewed_dt)}</div>
                </div>
                <div className={cn("rounded-lg bg-orange-50 px-3 py-3", quiet ? "" : "border border-orange-200")}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-700">Requested changes</div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{report.reviewer_comments || "-"}</div>
                </div>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="periodic-review-submission-response-notes">
                {isChangesRequested ? "Response notes" : "Submission notes"}
              </label>
              <Textarea
                id="periodic-review-submission-response-notes"
                value={submissionNotes}
                onChange={(event) => setSubmissionNotes(event.target.value)}
                placeholder={isChangesRequested ? "Summarize how the requested changes were addressed." : "Please review the draft audit trail report."}
                disabled={actionBusy}
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void submitForReview()} disabled={submitDisabled}>
                {actionLoading === "submit-review" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isChangesRequested ? "Resubmit for QA Review" : "Submit for QA Review"}
              </Button>
            </div>
          </>
        ) : canTakeDecision ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className={cn("rounded-lg bg-slate-50 px-3 py-3", quiet ? "" : "border border-slate-200")}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Submitted by</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{report.submitted_by || "-"}</div>
              </div>
              <div className={cn("rounded-lg bg-slate-50 px-3 py-3", quiet ? "" : "border border-slate-200")}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Submitted date</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formatAuditReviewDateTime(report.submitted_dt)}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="periodic-review-decision-comments">
                Reviewer comments
              </label>
              <Textarea
                id="periodic-review-decision-comments"
                value={reviewerComments}
                onChange={(event) => setReviewerComments(event.target.value)}
                placeholder="Document the QA decision rationale."
                disabled={actionBusy}
                required
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {canApprove ? (
                <Button type="button" size="sm" onClick={() => setApprovalCardOpen(true)} disabled={approveDisabled}>
                  {actionLoading === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Sign and Approve
                </Button>
              ) : null}
              {canReject ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void submitDecision("reject")} disabled={decisionDisabled}>
                  {actionLoading === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Reject Report
                </Button>
              ) : null}
              {canRequestChanges ? (
                <Button type="button" size="sm" variant="outline" onClick={() => void submitDecision("request-changes")} disabled={decisionDisabled}>
                  {actionLoading === "request-changes" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Request Changes
                </Button>
              ) : null}
            </div>
          </>
        ) : isUnderReview ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This report is under review and waiting for a user with final QA approval permission.
          </div>
        ) : isChangesRequested ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className={cn("rounded-lg bg-slate-50 px-3 py-3", quiet ? "" : "border border-slate-200")}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Requested by</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{report.reviewed_by || "-"}</div>
              </div>
              <div className={cn("rounded-lg bg-slate-50 px-3 py-3", quiet ? "" : "border border-slate-200")}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Requested date</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{formatAuditReviewDateTime(report.reviewed_dt)}</div>
              </div>
              <div className={cn("rounded-lg bg-orange-50 px-3 py-3", quiet ? "" : "border border-orange-200")}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-700">Requested changes</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{report.reviewer_comments || "-"}</div>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Waiting for a QA Reviewer with audit report submission permission to respond and resubmit.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className={cn("rounded-lg bg-slate-50 px-3 py-3", quiet ? "" : "border border-slate-200")}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Reviewed by</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{report.reviewed_by || "-"}</div>
            </div>
            <div className={cn("rounded-lg bg-slate-50 px-3 py-3", quiet ? "" : "border border-slate-200")}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Reviewed date</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{formatAuditReviewDateTime(report.reviewed_dt)}</div>
            </div>
            <div className={cn("rounded-lg bg-slate-50 px-3 py-3", quiet ? "" : "border border-slate-200")}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Comments</div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{report.reviewer_comments || "-"}</div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
      <Dialog
        open={approvalCardOpen && canTakeDecision && canApprove}
        onOpenChange={(open) => (open ? setApprovalCardOpen(true) : closeApprovalCard())}
      >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Electronic Signature</DialogTitle>
          <DialogDescription>Confirm your credentials to approve this audit review report.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitDecision("approve");
          }}
        >
          <AuditReviewESignatureFields
            email={approvalEmail}
            password={approvalPassword}
            confirmed={approvalConfirmed}
            errors={approvalErrors}
            disabled={actionBusy}
            onEmailChange={(value) => {
              setApprovalEmail(value);
              clearApprovalError("email");
            }}
            onPasswordChange={(value) => {
              setApprovalPassword(value);
              clearApprovalError("password");
            }}
            onConfirmedChange={(value) => {
              setApprovalConfirmed(value);
              clearApprovalError("confirmed");
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeApprovalCard} disabled={actionBusy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmitApproval}>
              {actionLoading === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Sign and Approve
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}

function DraftInternalReportPreview({
  runtime,
  quiet = false,
}: {
  runtime: ReviewRuntime;
  quiet?: boolean;
}) {
  const report = runtime.report;
  const reportId = report?.report_id;
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState<string | null>(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null);

  const loadPdfPreview = useCallback(async (showToast = false) => {
    if (!reportId) return;
    setPdfPreviewLoading(true);
    setPdfPreviewError(null);
    try {
      const html = await getAuditReviewReportHtmlPreview(reportId);
      setPdfPreviewHtml(html);
    } catch (error) {
      const message = apiErrorMessage(error);
      setPdfPreviewError(message);
      if (showToast) toast.error(message);
    } finally {
      setPdfPreviewLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    setPdfPreviewHtml(null);
    setPdfPreviewLoading(false);
    setPdfPreviewError(null);
    if (reportId) void loadPdfPreview(false);
  }, [loadPdfPreview, reportId]);

  if (!report) return null;

  const previewFrame = pdfPreviewLoading ? (
    <div className={cn(
      "flex h-full items-center justify-center rounded-lg bg-white text-sm text-slate-500",
      quiet ? "" : "border border-slate-200",
    )}>
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="ml-2">Loading report preview...</span>
    </div>
  ) : pdfPreviewError ? (
    <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 text-center text-sm text-red-700">
      <span>{pdfPreviewError}</span>
      <Button type="button" size="sm" variant="outline" onClick={() => void loadPdfPreview(true)}>
        <RefreshCw className="h-4 w-4" />
        Retry
      </Button>
    </div>
  ) : pdfPreviewHtml ? (
    <iframe
      title={`Audit review report preview ${report.report_id}`}
      srcDoc={pdfPreviewHtml}
      sandbox=""
      className={cn(
        "h-full w-full rounded-lg bg-white",
        quiet ? "border-0 shadow-none" : "border border-slate-300 shadow-sm",
      )}
    />
  ) : (
    <div className={cn(
      "flex h-full items-center justify-center rounded-lg bg-white text-sm text-slate-500",
      quiet ? "" : "border border-slate-200",
    )}>
      Report preview is loading.
    </div>
  );

  return (
    <Card className={cn(
      "rounded-lg bg-white",
      quiet ? "border-0 bg-transparent shadow-none" : "border-slate-200 shadow-sm",
    )} padding="none">
      <SectionTitle
        icon={<FileText className="h-5 w-5" />}
        title="Report PDF Preview"
        description="Document-style report preview for QA review before final approval."
        quiet={quiet}
        action={<Badge variant="outline" className={getAuditReviewReportStatusBadgeClass(report.status)}>{statusLabel(report.status)}</Badge>}
      />
      <CardBody className={cn(quiet ? "px-0 py-0" : "py-4")}>
        <div className={cn(
          "h-[72vh] min-h-[520px] overflow-hidden rounded-lg bg-slate-100",
          quiet ? "p-2" : "border border-slate-200 p-3",
        )}>
          {previewFrame}
        </div>
      </CardBody>
    </Card>
  );
}

function FindingBusinessCard({
  finding,
  record,
  config,
}: {
  finding: AuditReviewFinding;
  record: AuditTrailRecord | null;
  config: BusinessHoursConfig;
}) {
  const auditTrailType = findingAuditTrailType(finding, record);
  const technicalPayload = record?.raw_payload_json || finding.evidence_json || {};
  const details = [
    ["Performed By", findingUser(finding, record)],
    ["Detected Action", findingAction(finding, record)],
    ["Event Time", findingEventTime(finding, record, config)],
    ["Audit Trail Type", formatAuditReviewLabel(auditTrailType)],
    ["Why Flagged", findingReason(finding)],
    ["Recommended QA Action", findingRecommendation(finding.check_code)],
    ["Source Record ID", findingSourceRecord(finding, record)],
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-none">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-950">
            {finding.finding_title || finding.title || finding.check_name || "Audit review finding"}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {findingBusinessSummary(finding, record, config)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Badge variant="outline" className={getAuditReviewRatingBadgeClass(finding.severity || "")}>
            {formatAuditReviewLabel(finding.severity)}
          </Badge>
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            {formatAuditReviewLabel(finding.status)}
          </Badge>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
            <div className="mt-1 whitespace-normal break-words text-sm font-medium text-slate-900">{value}</div>
          </div>
        ))}
      </div>
      <details className="mt-4 rounded-md border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">View Technical Source Payload</summary>
        <pre className="mt-3 max-h-64 overflow-auto rounded bg-white p-3 text-xs text-slate-600">
          {Object.keys(technicalPayload).length > 0 ? JSON.stringify(technicalPayload, null, 2) : TECHNICAL_UNAVAILABLE}
        </pre>
      </details>
    </div>
  );
}

function FindingsWorkspace({ runtime, canExport = false }: { runtime: ReviewRuntime; canExport?: boolean }) {
  const [auditType, setAuditType] = useState("ALL");
  const [checkCode, setCheckCode] = useState("ALL");
  const [severity, setSeverity] = useState("ALL");
  const { findings, records } = runtime;
  const config = auditBusinessConfig(runtime.job);
  const groups = useMemo(() => groupFindings(findings), [findings]);
  const auditTypes = useMemo(() => Array.from(new Set(findings.map((finding) => finding.audit_trail_type).filter(Boolean))) as string[], [findings]);
  const checkCodes = useMemo(() => Array.from(new Set(findings.map((finding) => finding.check_code).filter(Boolean))), [findings]);
  const severities = useMemo(() => Array.from(new Set(findings.map((finding) => finding.severity).filter(Boolean))) as string[], [findings]);
  const filtered = findings.filter((finding) => {
    if (auditType !== "ALL" && finding.audit_trail_type !== auditType) return false;
    if (checkCode !== "ALL" && finding.check_code !== checkCode) return false;
    if (severity !== "ALL" && finding.severity !== severity) return false;
    return true;
  });
  const exportCurrentFindings = () => {
    if (filtered.length === 0) {
      toast.info("No findings match the selected filters.");
      return;
    }
    const dateStamp = new Date().toISOString().slice(0, 10);
    exportFindingsToExcel(
      filtered,
      records,
      config,
      `audit-review-findings-${runtime.job.job_id.slice(0, 8)}-${dateStamp}.xls`,
    );
    toast.success("Findings exported to Excel");
  };

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-none" padding="none">
      <SectionTitle
        icon={<Filter className="h-5 w-5" />}
        title="Findings Requiring QA Review"
        action={
          canExport ? <Button type="button" size="sm" variant="outline" onClick={exportCurrentFindings} disabled={filtered.length === 0}>
            <Download className="h-4 w-4" />
            Export Excel
          </Button> : null
        }
      />
      <CardBody className="space-y-4 py-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select value={auditType} onValueChange={setAuditType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All audit trail types</SelectItem>
              {auditTypes.map((type) => <SelectItem key={type} value={type}>{formatAuditReviewLabel(type)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={checkCode} onValueChange={setCheckCode}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All checks</SelectItem>
              {checkCodes.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All severities</SelectItem>
              {severities.map((item) => <SelectItem key={item} value={item}>{formatAuditReviewLabel(item)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          {groups.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
              No grouped findings to action.
            </div>
          ) : (
            groups.map((group) => (
              <Badge key={group.key} variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                {group.name}: {group.count}
              </Badge>
            ))
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            No findings match the selected filters.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((finding) => (
              <FindingBusinessCard
                key={finding.finding_id}
                finding={finding}
                record={findingMatchedRecord(finding, records)}
                config={config}
              />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function EvidenceRecordDetails({
  record,
  auditTrailType,
  config,
}: {
  record: AuditTrailRecord;
  auditTrailType: string;
  config: BusinessHoursConfig;
}) {
  const detailColumns = evidenceColumnsForType(auditTrailType);
  const technicalPayload = record.raw_payload_json || record.normalized_extra_json || {};

  return (
    <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-slate-700">View Record Details</summary>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {detailColumns.map((column) => (
          <div key={column.key} className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{column.header}</div>
            <div className="mt-1 break-words text-sm font-medium text-slate-900">
              {column.getValue(record, config) || TECHNICAL_UNAVAILABLE}
            </div>
          </div>
        ))}
      </div>
      <details className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
        <summary className="cursor-pointer font-medium text-slate-700">View Technical Source Payload</summary>
        <pre className="mt-3 max-h-72 overflow-auto rounded bg-slate-50 p-3 text-xs text-slate-600">
          {Object.keys(technicalPayload).length > 0 ? JSON.stringify(technicalPayload, null, 2) : TECHNICAL_UNAVAILABLE}
        </pre>
      </details>
    </details>
  );
}

function AuditTypeEvidenceTable({
  auditTrailType,
  records,
  config,
}: {
  auditTrailType: string;
  records: AuditTrailRecord[];
  config: BusinessHoursConfig;
}) {
  const columns = visibleEvidenceColumns(auditTrailType, records, config);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">{formatAuditReviewLabel(auditTrailType)}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {formatAuditReviewNumber(records.length)} normalized evidence records
          </p>
        </div>
      </div>
      <Table className="min-w-[1100px]" containerClassName="rounded-lg border border-slate-200">
        <TableHeader>
          <TableRow className="bg-slate-50">
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="py-8 text-center text-slate-500">
                No evidence records returned for this audit trail type.
              </TableCell>
            </TableRow>
          ) : (
            records.slice(0, 200).map((record) => (
              <React.Fragment key={record.record_id}>
                <TableRow>
                  {columns.map((column) => (
                    <TableCell key={column.key} className="whitespace-normal px-3">
                      <span className="font-medium text-slate-900">
                        {column.getValue(record, config) || column.fallback || SUMMARY_UNAVAILABLE}
                      </span>
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-white hover:bg-white">
                  <TableCell colSpan={columns.length} className="px-3 py-3">
                    <EvidenceRecordDetails record={record} auditTrailType={auditTrailType} config={config} />
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))
          )}
        </TableBody>
      </Table>
      {records.length > 200 ? (
        <p className="text-xs text-slate-500">Showing the first 200 records for this audit trail type.</p>
      ) : null}
    </div>
  );
}

function EvidenceRecordsTable({ runtime }: { runtime: ReviewRuntime }) {
  const [activeType, setActiveType] = useState("ALL");
  const config = auditBusinessConfig(runtime.job);
  const recordTypes = useMemo(
    () => Array.from(new Set(runtime.records.map((record) => record.audit_trail_type).filter(Boolean))),
    [runtime.records],
  );
  const availableTypes = useMemo(() => {
    return Array.from(new Set([...runtime.selectedAuditTrailTypes, ...recordTypes]));
  }, [recordTypes, runtime.selectedAuditTrailTypes]);
  const visibleTypes = activeType === "ALL" ? recordTypes : [activeType];

  return (
    <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
      <SectionTitle
        icon={<Layers3 className="h-5 w-5" />}
        title="Evidence Records"
        description="Evidence is displayed with audit-trail-type-specific fields. Technical source payload stays collapsed."
        action={
          <Select value={activeType} onValueChange={setActiveType}>
            <SelectTrigger className="w-56 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All audit trail types</SelectItem>
              {availableTypes.map((type) => <SelectItem key={type} value={type}>{formatAuditReviewLabel(type)}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <CardBody className="space-y-6 py-5">
        {runtime.records.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
            No evidence records returned for this selection.
          </div>
        ) : (
          visibleTypes.map((type) => (
            <AuditTypeEvidenceTable
              key={type}
              auditTrailType={type}
              records={runtime.records.filter((record) => record.audit_trail_type === type)}
              config={config}
            />
          ))
        )}
      </CardBody>
    </Card>
  );
}

function TechnicalChecklistSummary({ runtime }: { runtime: ReviewRuntime }) {
  const [expanded, setExpanded] = useState(false);
  const rows = checklistRows(runtime.job, runtime.scores, runtime.findings);
  const summary = checklistSummary(runtime.job, runtime.scores, runtime.findings);
  const cards = [
    ["Passed", summary.passed],
    ["With findings", summary.withFindings],
    ["Not applicable", summary.notApplicable],
    ["No data", summary.noData],
    ["Partial", summary.partial],
  ];

  return (
    <section className="space-y-4 border-t border-slate-200 pt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 text-slate-500">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950">Technical Checklist</h3>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Checklist status is included in the result summary for reviewers who need it.
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Hide Details" : "Show Details"}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>
      {expanded ? (
        <Table className="min-w-[920px]" containerClassName="rounded-lg border border-slate-200">
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Checkpoint</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Evaluated</TableHead>
              <TableHead>Findings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-slate-500">Checklist details are available after analysis.</TableCell></TableRow>
            ) : (
              rows.map((row) => {
                return (
                  <TableRow key={String(row.check_code)}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium text-slate-900">{String(row.check_name ?? row.check_code ?? "-")}</div>
                      <div className="mt-1 font-mono text-xs text-slate-400">{String(row.check_code ?? "-")}</div>
                    </TableCell>
                    <TableCell>{checklistFriendlyStatus(row)}</TableCell>
                    <TableCell>{formatAuditReviewNumber(Number(row.evaluated_record_count ?? 0))}</TableCell>
                    <TableCell>{formatAuditReviewNumber(Number(row.finding_count ?? 0))}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      ) : null}
    </section>
  );
}

function ReadOnlyReviewDialog({
  runtime,
  open,
  canViewFindings = false,
  canViewRecords = false,
  canExport = false,
  canApprove = false,
  canReject = false,
  canRequestChanges = false,
  canSubmit = false,
  canGenerateDraft = false,
  actionLoading = null,
  generatingDraft = false,
  downloadingReport = false,
  onGenerateDraft,
  onDownloadReport,
  onSubmitReview,
  onDecision,
  onClose,
}: {
  runtime: ReviewRuntime | null;
  open: boolean;
  canViewFindings?: boolean;
  canViewRecords?: boolean;
  canExport?: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  canRequestChanges?: boolean;
  canSubmit?: boolean;
  canGenerateDraft?: boolean;
  actionLoading?: ReportWorkflowAction | null;
  generatingDraft?: boolean;
  downloadingReport?: boolean;
  onGenerateDraft?: () => void;
  onDownloadReport?: () => void;
  onSubmitReview?: (submissionNotes: string) => Promise<void>;
  onDecision?: (
    action: ReviewDecisionAction,
    reviewerComments: string,
    eSignature?: AuditReviewReportESignaturePayload,
  ) => Promise<void>;
  onClose: () => void;
}) {
  if (!runtime) return null;
  const isApprovalReview = runtime.report?.status === "UNDER_REVIEW" && Boolean(onDecision) && (canApprove || canReject || canRequestChanges);
  const hideReviewerEvidence = canApprove || canReject || canRequestChanges;
  const isReviewerResponse = Boolean(
    runtime.report &&
    ["DRAFT", "CHANGES_REQUESTED"].includes(runtime.report.status) &&
    canSubmit &&
    onSubmitReview,
  );
  const isDraftCreation = Boolean(!runtime.report && canGenerateDraft && onGenerateDraft);
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <DialogContent className="max-h-[92vh] w-[min(1280px,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)] xl:max-w-7xl">
        <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-left">
          <DialogTitle>{isApprovalReview ? "Audit Review Approval" : isReviewerResponse ? "Audit Review Response" : isDraftCreation ? "Scheduled Review Draft" : "Read-only Audit Review Detail"}</DialogTitle>
          <DialogDescription>
            {isApprovalReview
              ? "Review the submitted audit trail report and record the final QA decision."
              : isReviewerResponse
                ? "Submit or resubmit the audit trail report for final QA approval."
                : isDraftCreation
                  ? "Create the draft report, then continue the QA submission workflow."
                : `Historical review from ${formatAuditReviewPeriod(runtime.job.review_start_dt, runtime.job.review_end_dt)}.`}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-8rem)] space-y-4 overflow-y-auto px-6 py-5">
          <ResultSummary
            runtime={runtime}
            onGenerateDraft={isDraftCreation ? onGenerateDraft : undefined}
            onDownloadReport={onDownloadReport}
            generatingDraft={generatingDraft}
            downloadingReport={downloadingReport}
            quiet
          />
          <ReviewApprovalDecisionPanel
            runtime={runtime}
            canApprove={canApprove}
            canReject={canReject}
            canRequestChanges={canRequestChanges}
            canSubmit={canSubmit}
            actionLoading={actionLoading}
            onSubmitReview={onSubmitReview}
            onDecision={onDecision}
            quiet
          />
          <DraftInternalReportPreview runtime={runtime} quiet />
          {canViewFindings && !hideReviewerEvidence ? <FindingsWorkspace runtime={runtime} canExport={canExport} /> : null}
          {canViewRecords && !hideReviewerEvidence ? <EvidenceRecordsTable runtime={runtime} /> : null}
        </div>
        <DialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleSetupPanel({
  asset,
  schedule,
  form,
  metadata,
  jobs,
  reports,
  saving,
  running,
  canCreateSchedule,
  canUpdateSchedule,
  canRunSchedule,
  editing,
  lastResult,
  onChange,
  onSave,
  onRunNow,
  onDisable,
  onEdit,
}: {
  asset: AssetRecord;
  schedule: AuditReviewSchedule | null;
  form: ScheduleFormState;
  metadata: AuditReviewMetadata;
  jobs: AuditReviewJobListItem[];
  reports: AuditReviewReportListItem[];
  saving: boolean;
  running: boolean;
  canCreateSchedule: boolean;
  canUpdateSchedule: boolean;
  canRunSchedule: boolean;
  editing: boolean;
  lastResult: AuditReviewScheduleRunNowResponse | null;
  onChange: (field: keyof ScheduleFormState, value: string | boolean | string[]) => void;
  onSave: () => void;
  onRunNow: () => void;
  onDisable: () => void;
  onEdit: () => void;
}) {
  const canManageSchedule = schedule ? canUpdateSchedule : canCreateSchedule;
  const actionDisabled = saving || running || !canManageSchedule;
  const effectiveTypes = selectedTypesForScope(metadata, form.reviewScope, form.selectedAuditTrailTypes);
  const selectedScope = metadata.review_scopes.find((scope) => scope.code === form.reviewScope);
  const isQuarterlySchedule = form.frequency === "QUARTERLY";
  const isHalfYearlySchedule = form.frequency === "HALF_YEARLY";
  const isAnnualSchedule = form.frequency === "ANNUAL";
  const isAutomaticCompletedPeriodOnly = isQuarterlySchedule || form.frequency === "MONTHLY" || isAnnualSchedule;
  const nextRunDate = computeScheduleNextRun(form);
  const retrievalRange = expectedAuditRetrievalRange(form, nextRunDate);
  const auditRetrievalOptions = auditRetrievalModeOptionsForFrequency(form.frequency);
  const isDailySchedule = form.frequency === "DAILY";
  const customMissing = form.reviewScope === "CUSTOM" && effectiveTypes.length === 0;
  const approvedReportJobIds = new Set(reports.filter((report) => report.status === "APPROVED").map((report) => report.job_id));
  const overlapsApprovedReview = Boolean(
    retrievalRange.start &&
    retrievalRange.end &&
    jobs.some((job) => {
      if (!approvedReportJobIds.has(job.job_id)) return false;
      const jobTypes = job.selected_audit_trail_types?.length ? job.selected_audit_trail_types : [job.audit_trail_type];
      if (job.review_scope !== form.reviewScope || !sameStringSet(jobTypes, effectiveTypes)) return false;
      const jobStart = new Date(job.review_start_dt);
      const jobEnd = new Date(job.review_end_dt);
      if (Number.isNaN(jobStart.getTime()) || Number.isNaN(jobEnd.getTime())) return false;
      return retrievalRange.start.getTime() < jobEnd.getTime() && retrievalRange.end.getTime() > jobStart.getTime();
    }),
  );
  const retrievalDays = dateRangeDays(retrievalRange.start, retrievalRange.end);
  const customAuditStartDate = form.customAuditStart ? datetimeLocalInputToDate(form.customAuditStart, form.timezone) : null;
  const customAuditEndDate = form.customAuditEnd ? datetimeLocalInputToDate(form.customAuditEnd, form.timezone) : null;
  const customAuditStartValid = customAuditStartDate !== null && !Number.isNaN(customAuditStartDate.getTime());
  const customAuditEndValid = customAuditEndDate !== null && !Number.isNaN(customAuditEndDate.getTime());
  const customAuditEndBeforeStart = Boolean(
    form.auditRetrievalMode === "CUSTOM" &&
    customAuditStartDate &&
    customAuditEndDate &&
    customAuditStartValid &&
    customAuditEndValid &&
    customAuditEndDate.getTime() < customAuditStartDate.getTime(),
  );
  const customAuditEndAfterNextRun = Boolean(
    form.auditRetrievalMode === "CUSTOM" &&
    nextRunDate &&
    customAuditEndDate &&
    customAuditEndValid &&
    customAuditEndDate.getTime() > nextRunDate.getTime(),
  );
  const customAuditRangeInFuture = Boolean(
    form.auditRetrievalMode === "CUSTOM" &&
    ((customAuditStartDate && customAuditStartValid && customAuditStartDate.getTime() > Date.now()) ||
      (customAuditEndDate && customAuditEndValid && customAuditEndDate.getTime() > Date.now())),
  );
  const rangeLongerThanFrequency = Boolean(
    form.auditRetrievalMode === "CUSTOM" &&
    retrievalDays != null &&
    retrievalDays > frequencyIntervalDays(form.frequency),
  );
  const quarterlyEndBeforeStart = Boolean(
    isQuarterlySchedule &&
      form.endQuarter !== NO_END_QUARTER_VALUE &&
      parseQuarterValue(form.startQuarter) &&
      parseQuarterValue(form.endQuarter) &&
      quarterIndex(form.endQuarter) < quarterIndex(form.startQuarter),
  );
  const halfYearEndBeforeStart = Boolean(
    isHalfYearlySchedule &&
      form.endHalfYear !== NO_END_HALF_YEAR_VALUE &&
      parseHalfYearValue(form.startHalfYear) &&
      parseHalfYearValue(form.endHalfYear) &&
      halfYearIndex(form.endHalfYear) < halfYearIndex(form.startHalfYear),
  );
  const annualEndBeforeStart = Boolean(
    isAnnualSchedule &&
      form.endReviewYear !== NO_END_ANNUAL_YEAR_VALUE &&
      parseReviewYear(form.startReviewYear) !== null &&
      parseReviewYear(form.endReviewYear) !== null &&
      (parseReviewYear(form.endReviewYear) ?? 0) < (parseReviewYear(form.startReviewYear) ?? 0),
  );
  const validationErrors = [
    isQuarterlySchedule && !parseQuarterValue(form.startQuarter) ? "Start reviewing from is required." : null,
    quarterlyEndBeforeStart ? "Schedule ending quarter must be the same as or after the start reviewing quarter." : null,
    isHalfYearlySchedule && !parseHalfYearValue(form.startHalfYear) ? "Start reviewing from is required." : null,
    halfYearEndBeforeStart ? "Schedule ending half-year must be the same as or after the start reviewing half-year." : null,
    isAnnualSchedule && parseReviewYear(form.startReviewYear) === null ? "Start reviewing from is required." : null,
    annualEndBeforeStart ? "Schedule ending year must be the same as or after the start reviewing year." : null,
    !isQuarterlySchedule && !isHalfYearlySchedule && !isAnnualSchedule && !form.scheduleStartDate ? "Schedule start date is required." : null,
    !form.runTime ? "Run time is required." : null,
    !isQuarterlySchedule &&
      !isHalfYearlySchedule &&
      !isAnnualSchedule &&
      Boolean(form.scheduleEndDate) &&
      form.scheduleStartDate &&
      form.scheduleEndDate &&
      new Date(`${form.scheduleEndDate}T23:59`).getTime() < new Date(`${form.scheduleStartDate}T00:00`).getTime()
      ? "Schedule end date must be on or after schedule start date."
      : null,
    form.frequency === "WEEKLY" && !form.dayOfWeek ? "Weekly schedule requires a day of week." : null,
    form.frequency === "HALF_YEARLY" && !form.cycleType ? "Half yearly schedule requires a half-year cycle." : null,
    form.frequency === "HALF_YEARLY" && form.cycleType === "CUSTOM_SIX_MONTH_CYCLE" && !form.customCycleStartMonth ? "Half yearly custom cycle requires a start month." : null,
    isAnnualSchedule && form.cycleType !== "CALENDAR_YEAR" ? "Annual cycle must be Calendar Year." : null,
    form.auditRetrievalMode === "CUSTOM" && (!form.customAuditStart || !form.customAuditEnd)
      ? "Custom audit retrieval start and end dates are required."
      : null,
    customAuditEndBeforeStart
      ? "Custom audit start date/time must be before or equal to custom audit end date/time."
      : null,
    customAuditEndAfterNextRun
      ? "Custom audit end date/time must not be after the next run time."
      : null,
    customAuditRangeInFuture
      ? "Custom audit period must not be in the future."
      : null,
    customMissing ? "Select at least one audit trail type before saving or running." : null,
    form.runTime && !nextRunDate ? "Next run date/time could not be calculated from this schedule." : null,
  ].filter((message): message is string => Boolean(message));
  const warningMessages = [
    rangeLongerThanFrequency
      ? isDailySchedule
        ? "Daily schedules normally review one completed day. This custom range will be used only for the next run."
        : "This audit retrieval range is longer than the selected frequency. Some audit records may be reviewed more than once."
      : null,
    overlapsApprovedReview ? "This period overlaps an existing approved review." : null,
  ].filter((message): message is string => Boolean(message));
  const latestRun = lastResult?.run ?? null;
  const statusEnabled = schedule?.enabled ?? form.enabled;
  const statusText = !schedule
    ? "No schedule configured for this asset"
    : statusEnabled
      ? "Schedule enabled for this asset"
      : "Schedule disabled for this asset";
  const scheduleSummaryText = form.frequency === "WEEKLY" && form.dayOfWeek
    ? `Runs weekly on ${WEEKDAY_OPTIONS.find((item) => item.value === form.dayOfWeek)?.label ?? "selected day"} at ${form.runTime}.`
    : null;
  const reviewPeriodLabel = form.auditRetrievalMode === "CUSTOM"
    ? "Custom range for next run"
    : form.frequency === "DAILY"
      ? "Previous completed day"
      : form.frequency === "WEEKLY"
        ? "Previous completed week"
        : form.frequency === "MONTHLY"
          ? "Previous completed month"
          : form.frequency === "QUARTERLY"
            ? retrievalRange.start
              ? quarterLabelFromValue(quarterValueFromDate(retrievalRange.start, form.timezone))
              : quarterLabelFromValue(form.startQuarter)
            : form.frequency === "HALF_YEARLY"
              ? retrievalRange.start
                ? halfYearPeriodLabel(halfYearValueFromDate(retrievalRange.start, form.timezone, form.cycleType, form.customCycleStartMonth))
                : halfYearPeriodLabel(form.startHalfYear)
              : retrievalRange.start
                ? String(timeZoneParts(retrievalRange.start, form.timezone).year)
                : form.startReviewYear || "-";
  const auditTrailTypesLabel = effectiveTypes.map((type) => metadata.supported_audit_trail_types.find((item) => item.code === type)?.label ?? formatAuditReviewLabel(type)).join(", ") || "-";
  const quarterlyPlanTimeLabel = formatRunTimeLabel(form.runTime);
  const quarterlyStartReviewOptions = quarterlyStartOptions(form.startQuarter, form.timezone);
  const quarterlyEndReviewOptions = quarterlyEndOptions(form.startQuarter, form.endQuarter, form.timezone);
  const halfYearCycleType = coerceCycleType(form.cycleType, "HALF_YEARLY");
  const halfYearStartReviewOptions = halfYearStartOptions(form.startHalfYear, halfYearCycleType, form.customCycleStartMonth, form.timezone);
  const halfYearEndReviewOptions = halfYearEndOptions(form.startHalfYear, form.endHalfYear, halfYearCycleType, form.customCycleStartMonth);
  const halfYearPlanTableRows = halfYearPlanRows({ ...form, cycleType: halfYearCycleType });
  const annualStartReviewOptions = reviewYearOptions(form.startReviewYear, form.timezone);
  const annualEndReviewOptions = annualEndYearOptions(form.startReviewYear, form.endReviewYear, form.timezone);
  const annualPlanTableRows = annualPlanRows(form);
  const schedulePreviewRows: Array<[string, string]> = isDailySchedule
    ? [
        ["Next run", nextRunDate ? formatSchedulePreviewDateTime(nextRunDate, form.timezone) : "-"],
        ["Frequency", "Daily"],
        ["Runs", `Every day at ${formatRunTimeLabel(form.runTime)}`],
        ["Review period", reviewPeriodLabel],
        ["Period start", retrievalRange.start ? formatSchedulePreviewDateTime(retrievalRange.start, form.timezone) : "-"],
        ["Period end", retrievalRange.end ? formatSchedulePreviewDateTime(retrievalRange.end, form.timezone) : "-"],
        ["Timezone", form.timezone || "-"],
        ["Review scope", selectedScope?.label ?? formatAuditReviewLabel(form.reviewScope)],
        ["Audit trail types", auditTrailTypesLabel],
      ]
    : isQuarterlySchedule
      ? [
          ["Frequency", "Quarterly"],
          ["Quarter type", "Calendar Quarter"],
          ["Start reviewing from", quarterLabelFromValue(form.startQuarter)],
          ["Schedule ending quarter", selectedEndQuarterLabel(form.endQuarter)],
          ["Runs", `Every quarter after quarter end at ${quarterlyPlanTimeLabel}`],
          ["Next run", nextRunDate ? formatSchedulePreviewDateTime(nextRunDate, form.timezone) : "-"],
          ["Review period", reviewPeriodLabel],
          ["Period start", retrievalRange.start ? formatSchedulePreviewDateTime(retrievalRange.start, form.timezone) : "-"],
          ["Period end", retrievalRange.end ? formatSchedulePreviewDateTime(retrievalRange.end, form.timezone) : "-"],
          ["Timezone", form.timezone || "-"],
          ["Review scope", selectedScope?.label ?? formatAuditReviewLabel(form.reviewScope)],
          ["Audit trail types", auditTrailTypesLabel],
        ]
      : isHalfYearlySchedule
        ? [
            ["Frequency", formatAuditReviewLabel(form.frequency)],
            ["Half-year type", halfYearTypeLabel(halfYearCycleType)],
            ...(halfYearCycleType === "CUSTOM_SIX_MONTH_CYCLE" ? [["Cycle starts in", monthLabel(form.customCycleStartMonth)] as [string, string]] : []),
            ["Start reviewing from", halfYearPeriodLabel(form.startHalfYear)],
            ["Schedule ending half-year", selectedEndHalfYearLabel(form.endHalfYear)],
            ["Runs", plannerTimingLabel({ ...form, cycleType: halfYearCycleType })],
            ["Next run", nextRunDate ? formatSchedulePreviewDateTime(nextRunDate, form.timezone) : "-"],
            ["Review period", reviewPeriodLabel],
            ["Period start", retrievalRange.start ? formatSchedulePreviewDateTime(retrievalRange.start, form.timezone) : "-"],
            ["Period end", retrievalRange.end ? formatSchedulePreviewDateTime(retrievalRange.end, form.timezone) : "-"],
            ["Timezone", form.timezone || "-"],
            ["Review scope", selectedScope?.label ?? formatAuditReviewLabel(form.reviewScope)],
            ["Audit trail types", auditTrailTypesLabel],
          ]
        : isAnnualSchedule
          ? [
              ["Frequency", "Annual"],
              ["Annual cycle", "Calendar Year"],
              ["Start reviewing from", form.startReviewYear || "-"],
              ["Schedule ending year", selectedEndReviewYearLabel(form.endReviewYear)],
              ["Runs", plannerTimingLabel(form)],
              ["Next run", nextRunDate ? formatSchedulePreviewDateTime(nextRunDate, form.timezone) : "-"],
              ["Review period", reviewPeriodLabel],
              ["Period start", retrievalRange.start ? formatSchedulePreviewDateTime(retrievalRange.start, form.timezone) : "-"],
              ["Period end", retrievalRange.end ? formatSchedulePreviewDateTime(retrievalRange.end, form.timezone) : "-"],
              ["Timezone", form.timezone || "-"],
              ["Review scope", selectedScope?.label ?? formatAuditReviewLabel(form.reviewScope)],
              ["Audit trail types", auditTrailTypesLabel],
            ]
        : [
        ["Frequency", formatAuditReviewLabel(form.frequency)],
        ...(form.frequency === "MONTHLY" ? [["Audit retrieval mode", "Automatic completed period"] as [string, string]] : []),
        ["Runs", plannerTimingLabel(form)],
        ["Next run", nextRunDate ? formatSchedulePreviewDateTime(nextRunDate, form.timezone) : "-"],
        ["Review period", reviewPeriodLabel],
        ["Period start", retrievalRange.start ? formatSchedulePreviewDateTime(retrievalRange.start, form.timezone) : "-"],
        ["Period end", retrievalRange.end ? formatSchedulePreviewDateTime(retrievalRange.end, form.timezone) : "-"],
        ["Timezone", form.timezone || "-"],
        ["Review scope", selectedScope?.label ?? formatAuditReviewLabel(form.reviewScope)],
        ["Audit trail types", auditTrailTypesLabel],
      ];
  const schedulePreviewSummary = isDailySchedule && retrievalRange.start && retrievalRange.end
    ? `This run will review: ${formatSchedulePreviewDateTime(retrievalRange.start, form.timezone)} to ${formatSchedulePreviewDateTime(retrievalRange.end, form.timezone)}`
    : form.frequency === "MONTHLY" && nextRunDate && retrievalRange.start && retrievalRange.end
      ? `${reviewPeriodLabel} reviews ${formatSchedulePreviewDateTime(retrievalRange.start, form.timezone)} to ${formatSchedulePreviewDateTime(retrievalRange.end, form.timezone)} and runs ${formatSchedulePreviewDateTime(nextRunDate, form.timezone)}.`
    : isQuarterlySchedule && nextRunDate && retrievalRange.start && retrievalRange.end
      ? `${reviewPeriodLabel} reviews ${formatSchedulePreviewDateTime(retrievalRange.start, form.timezone)} to ${formatSchedulePreviewDateTime(retrievalRange.end, form.timezone)} and runs ${formatSchedulePreviewDateTime(nextRunDate, form.timezone)}.`
    : isHalfYearlySchedule && nextRunDate && retrievalRange.start && retrievalRange.end
      ? `${reviewPeriodLabel} reviews ${formatSchedulePreviewDateTime(retrievalRange.start, form.timezone)} to ${formatSchedulePreviewDateTime(retrievalRange.end, form.timezone)} and runs ${formatSchedulePreviewDateTime(nextRunDate, form.timezone)}.`
    : isAnnualSchedule && nextRunDate && retrievalRange.start && retrievalRange.end
      ? `${reviewPeriodLabel} reviews ${formatSchedulePreviewDateTime(retrievalRange.start, form.timezone)} to ${formatSchedulePreviewDateTime(retrievalRange.end, form.timezone)} and runs ${formatSchedulePreviewDateTime(nextRunDate, form.timezone)}.`
    : nextRunDate
      ? `Next run ${formatSchedulePreviewDateTime(nextRunDate, form.timezone)}`
      : "Complete timing fields to preview the schedule.";
  const schedulePreviewNotes = [
    scheduleSummaryText,
    retrievalRange.basis,
    retrievalRange.note,
    isQuarterlySchedule && form.endQuarter !== NO_END_QUARTER_VALUE
      ? "This schedule stops after the selected ending quarter review is completed."
      : null,
    isHalfYearlySchedule && form.endHalfYear !== NO_END_HALF_YEAR_VALUE
      ? "This schedule stops after the selected ending half-year review is completed."
      : null,
    isAnnualSchedule && form.endReviewYear !== NO_END_ANNUAL_YEAR_VALUE
      ? "This schedule stops after the selected ending year review is completed."
      : null,
    !isQuarterlySchedule && !isHalfYearlySchedule && !isAnnualSchedule ? "Leave schedule end date blank if this schedule should continue without an end date." : null,
  ].filter((message): message is string => Boolean(message));

  const handleScopeChange = (scope: AuditReviewScope) => {
    const nextTypes = selectedTypesForScope(metadata, scope, form.selectedAuditTrailTypes);
    onChange("reviewScope", scope);
    if (scope !== "CUSTOM") onChange("selectedAuditTrailTypes", nextTypes);
  };

  const toggleCustomType = (type: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...form.selectedAuditTrailTypes, type]))
      : form.selectedAuditTrailTypes.filter((item) => item !== type);
    onChange("selectedAuditTrailTypes", next);
  };

  return (
    <div className="space-y-5">
      <Card className="rounded-lg border-slate-200 bg-white px-4 py-3 shadow-sm" padding="none">
        <SectionTitle
          icon={<CalendarClock className="h-5 w-5" />}
          title="Current Schedule Status"
          quiet
        />
        <CardBody className="grid grid-cols-1 gap-2 p-0 md:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={statusEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>
                {statusEnabled ? "Enabled" : "Disabled"}
              </Badge>
              {latestRun ? (
                <Badge variant="outline" className={getScheduleRunBadgeClass(latestRun.status)}>
                  Last run {formatAuditReviewLabel(latestRun.status)}
                </Badge>
              ) : null}
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{statusText}</div>
            <div className="mt-1 text-xs text-slate-500">{assetNameLabel(asset)} · {assetIdLabel(asset)}</div>
            {latestRun?.error_message ? <div className="mt-2 text-xs text-red-700">{latestRun.error_message}</div> : null}
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Planned next run</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{nextRunDate ? formatSchedulePreviewDateTime(nextRunDate, form.timezone) : "-"}</div>
          </div>
          <div className="rounded-md bg-slate-50 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Last run</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-900">{formatAuditReviewDateTime(schedule?.last_run_dt)}</div>
          </div>
        </CardBody>
      </Card>

      <Card className="rounded-lg border-slate-200 bg-white shadow-sm" padding="none">
        <SectionTitle
          icon={<RefreshCw className="h-5 w-5" />}
          title="Schedule Configuration"
          description={schedule && !editing ? "Saved recurring periodic review settings." : schedule ? "Edit the saved recurring periodic review settings." : "No schedule configured for this asset. Create a schedule from the form below."}
          action={schedule && !editing && canManageSchedule ? (
            <Button type="button" variant="outline" onClick={onEdit} disabled={saving || running}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          ) : undefined}
        />
        {!editing && schedule ? (
          <CardBody className="space-y-4 py-5">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4">
                <div className="text-sm font-semibold text-slate-900">Schedule preview</div>
                <div className="mt-1 text-xs text-slate-500">
                  {schedulePreviewSummary}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm md:grid-cols-2 xl:grid-cols-3">
                {schedulePreviewRows.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[130px_minmax(0,1fr)] gap-2">
                    <span className="text-slate-500">{label}</span>
                    <span className="break-words font-medium text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              {canUpdateSchedule ? <Button type="button" variant="outline" onClick={onDisable} disabled={!schedule || saving || running || !statusEnabled}>
                Disable Schedule
              </Button> : null}
              {canRunSchedule ? <Button type="button" variant="outline" onClick={onRunNow} disabled={running || saving || validationErrors.length > 0}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                Run Now
              </Button> : null}
            </div>
          </CardBody>
        ) : (
        <CardBody className="space-y-5 py-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-start">
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Schedule enabled</div>
                  <div className="text-xs text-slate-500">{form.enabled ? "Automatic due runs active" : "Automatic due runs paused"}</div>
                </div>
                {canUpdateSchedule || canCreateSchedule ? (
                  <Switch checked={form.enabled} disabled={actionDisabled} onCheckedChange={(checked) => onChange("enabled", checked)} />
                ) : null}
              </div>

              <div className="space-y-6 p-4">
                <section className="space-y-4" aria-label="Frequency and review period">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Frequency and review period</h4>
                  </div>
                  {isDailySchedule ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Frequency</label>
                        <Select value={form.frequency} disabled={actionDisabled} onValueChange={(value) => onChange("frequency", value as AuditReviewScheduleFrequency)}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SCHEDULE_FREQUENCIES.map((frequency) => (
                              <SelectItem key={frequency} value={frequency}>{formatAuditReviewLabel(frequency)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Audit retrieval mode</label>
                          <Select value={form.auditRetrievalMode} disabled={actionDisabled} onValueChange={(value) => onChange("auditRetrievalMode", value as AuditRetrievalMode)}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {auditRetrievalOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                      {form.auditRetrievalMode === "CUSTOM" ? (
                        <>
                          <Input label="Custom audit start date/time" type="datetime-local" value={form.customAuditStart} onChange={(event) => onChange("customAuditStart", event.target.value)} disabled={actionDisabled} />
                          <Input label="Custom audit end date/time" type="datetime-local" value={form.customAuditEnd} onChange={(event) => onChange("customAuditEnd", event.target.value)} disabled={actionDisabled} />
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Frequency</label>
                        <Select value={form.frequency} disabled={actionDisabled} onValueChange={(value) => onChange("frequency", value as AuditReviewScheduleFrequency)}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SCHEDULE_FREQUENCIES.map((frequency) => (
                              <SelectItem key={frequency} value={frequency}>{formatAuditReviewLabel(frequency)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {form.frequency === "WEEKLY" ? (
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Day of week</label>
                          <Select value={form.dayOfWeek} disabled={actionDisabled} onValueChange={(value) => onChange("dayOfWeek", value)}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {WEEKDAY_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                      {isAutomaticCompletedPeriodOnly ? (
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Audit retrieval mode</label>
                          <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900">
                            Automatic completed period
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Audit retrieval mode</label>
                          <Select value={form.auditRetrievalMode} disabled={actionDisabled} onValueChange={(value) => onChange("auditRetrievalMode", value as AuditRetrievalMode)}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {auditRetrievalOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {form.auditRetrievalMode === "CUSTOM" && !isAutomaticCompletedPeriodOnly ? (
                        <>
                          <Input label="Audit start date/time" type="datetime-local" value={form.customAuditStart} onChange={(event) => onChange("customAuditStart", event.target.value)} disabled={actionDisabled} />
                          <Input label="Audit end date/time" type="datetime-local" value={form.customAuditEnd} onChange={(event) => onChange("customAuditEnd", event.target.value)} disabled={actionDisabled} />
                        </>
                      ) : null}
                    </div>
                  )}
                </section>

                {isQuarterlySchedule ? (
                  <section className="space-y-4 border-t border-slate-200 pt-5" aria-label="Quarterly run setup">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Quarterly run setup</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Quarter type</label>
                        <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900">
                          Calendar Quarter
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Start reviewing from</label>
                        <Select value={form.startQuarter} disabled={actionDisabled} onValueChange={(value) => onChange("startQuarter", value)}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {quarterlyStartReviewOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Schedule ending quarter</label>
                        <Select value={form.endQuarter} disabled={actionDisabled} onValueChange={(value) => onChange("endQuarter", value)}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {quarterlyEndReviewOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input label="Run time" type="time" value={form.runTime} onChange={(event) => onChange("runTime", event.target.value)} disabled={actionDisabled} />
                    </div>
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Quarter</th>
                            <th className="px-3 py-2 text-left font-medium">Period reviewed</th>
                            <th className="px-3 py-2 text-left font-medium">Runs on</th>
                            <th className="px-3 py-2 text-left font-medium">Timezone</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                          {CALENDAR_QUARTER_ROWS.map((row) => (
                            <tr key={row.quarter}>
                              <td className="px-3 py-2 font-medium">{row.quarter}</td>
                              <td className="px-3 py-2">{row.period}</td>
                              <td className="px-3 py-2">{`${row.runsOn} at ${quarterlyPlanTimeLabel}`}</td>
                              <td className="px-3 py-2">{form.timezone || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : isHalfYearlySchedule ? (
                  <section className="space-y-4 border-t border-slate-200 pt-5" aria-label="Half-yearly run setup">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Half-yearly run setup</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Half-year type</label>
                        <Select value={halfYearCycleType} disabled={actionDisabled} onValueChange={(value) => onChange("cycleType", value as ScheduleCycleType)}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CALENDAR_HALF_YEAR">Calendar Half-Year</SelectItem>
                            <SelectItem value="CUSTOM_SIX_MONTH_CYCLE">Custom Six-Month Cycle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {halfYearCycleType === "CUSTOM_SIX_MONTH_CYCLE" ? (
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">Cycle starts in</label>
                          <Select value={form.customCycleStartMonth} disabled={actionDisabled} onValueChange={(value) => onChange("customCycleStartMonth", value)}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MONTH_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Start reviewing from</label>
                        <Select value={form.startHalfYear} disabled={actionDisabled} onValueChange={(value) => onChange("startHalfYear", value)}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {halfYearStartReviewOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Schedule ending half-year</label>
                        <Select value={form.endHalfYear} disabled={actionDisabled} onValueChange={(value) => onChange("endHalfYear", value)}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {halfYearEndReviewOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input label="Run time" type="time" value={form.runTime} onChange={(event) => onChange("runTime", event.target.value)} disabled={actionDisabled} />
                    </div>
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Half-year</th>
                            <th className="px-3 py-2 text-left font-medium">Period reviewed</th>
                            <th className="px-3 py-2 text-left font-medium">Runs on</th>
                            <th className="px-3 py-2 text-left font-medium">Timezone</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                          {halfYearPlanTableRows.map((row) => (
                            <tr key={row.halfYear}>
                              <td className="px-3 py-2 font-medium">{row.halfYear}</td>
                              <td className="px-3 py-2">{row.period}</td>
                              <td className="px-3 py-2">{row.runsOn}</td>
                              <td className="px-3 py-2">{row.timezone}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : isAnnualSchedule ? (
                  <section className="space-y-4 border-t border-slate-200 pt-5" aria-label="Annual run setup">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Annual run setup</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Annual cycle</label>
                        <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-900">
                          Calendar Year
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Start reviewing from</label>
                        <Select value={form.startReviewYear} disabled={actionDisabled} onValueChange={(value) => onChange("startReviewYear", value)}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {annualStartReviewOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Schedule ending year</label>
                        <Select value={form.endReviewYear} disabled={actionDisabled} onValueChange={(value) => onChange("endReviewYear", value)}>
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {annualEndReviewOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input label="Run time" type="time" value={form.runTime} onChange={(event) => onChange("runTime", event.target.value)} disabled={actionDisabled} />
                      <Input label="Timezone" value={form.timezone} onChange={(event) => onChange("timezone", event.target.value)} disabled={actionDisabled} />
                    </div>
                    <div className="overflow-hidden rounded-md border border-slate-200">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Year</th>
                            <th className="px-3 py-2 text-left font-medium">Period reviewed</th>
                            <th className="px-3 py-2 text-left font-medium">Runs on</th>
                            <th className="px-3 py-2 text-left font-medium">Timezone</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                          {annualPlanTableRows.map((row) => (
                            <tr key={row.year}>
                              <td className="px-3 py-2 font-medium">{row.year}</td>
                              <td className="px-3 py-2">{row.period}</td>
                              <td className="px-3 py-2">{row.runsOn}</td>
                              <td className="px-3 py-2">{row.timezone}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : (
                  <section className="space-y-4 border-t border-slate-200 pt-5" aria-label="Schedule timing">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Schedule window</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <Input label="Schedule start date" type="date" value={form.scheduleStartDate} onChange={(event) => onChange("scheduleStartDate", event.target.value)} disabled={actionDisabled} />
                      <Input
                        label="Schedule end date (optional)"
                        type="date"
                        value={form.scheduleEndDate}
                        onChange={(event) => onChange("scheduleEndDate", event.target.value)}
                        disabled={actionDisabled}
                      />
                      <Input label="Run time" type="time" value={form.runTime} onChange={(event) => onChange("runTime", event.target.value)} disabled={actionDisabled} />
                      <Input label="Timezone" value={form.timezone} onChange={(event) => onChange("timezone", event.target.value)} disabled={actionDisabled} />
                    </div>
                  </section>
                )}

                <section className="space-y-4 border-t border-slate-200 pt-5" aria-label="Audit scope">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Audit scope</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="md:col-span-2 xl:col-span-3">
                      <p className="mb-2 text-sm font-medium text-slate-700">Selected audit trail types</p>
                      <div className="flex min-h-9 flex-wrap gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        {effectiveTypes.length > 0 ? effectiveTypes.map((type) => (
                          <Badge key={type} variant="outline" className="border-slate-200 bg-white text-slate-700">
                            {metadata.supported_audit_trail_types.find((item) => item.code === type)?.label ?? formatAuditReviewLabel(type)}
                          </Badge>
                        )) : (
                          <span className="text-sm text-slate-500">Select at least one audit trail type.</span>
                        )}
                      </div>
                    </div>
                    <div className="md:col-span-2 xl:col-span-1">
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Review scope</label>
                      <Select value={form.reviewScope} disabled={actionDisabled} onValueChange={(value) => handleScopeChange(value as AuditReviewScope)}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {metadata.review_scopes.map((scope) => (
                            <SelectItem key={scope.code} value={scope.code}>{scope.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.reviewScope === "CUSTOM" ? (
                      <div className="md:col-span-2 xl:col-span-4">
                        <p className="mb-2 text-sm font-medium text-slate-700">Choose audit trail types</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                          {metadata.supported_audit_trail_types.map((type) => (
                            <label key={type.code} className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                              <Checkbox
                                checked={form.selectedAuditTrailTypes.includes(type.code)}
                                disabled={actionDisabled}
                                onCheckedChange={(checked) => toggleCustomType(type.code, checked === true)}
                              />
                              <span>{type.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 lg:self-start xl:sticky xl:top-4">
              <div className="mb-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Schedule preview</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {schedulePreviewSummary}
                  </div>
                </div>
              </div>
              <div id="schedule-preview-details" className="space-y-2 text-sm">
                {schedulePreviewRows.map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-2">
                    <span className="text-slate-500">{label}</span>
                    <span className="break-words font-medium text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
              {schedulePreviewNotes.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-slate-200 pt-4">
                  {schedulePreviewNotes.map((message) => (
                    <div key={message} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                      {message}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4">
                {canManageSchedule ? <Button type="button" onClick={onSave} disabled={actionDisabled || validationErrors.length > 0} fullWidth>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {schedule ? "Save Changes" : "Save Schedule"}
                </Button> : null}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {canRunSchedule ? <Button type="button" variant="outline" onClick={onRunNow} disabled={running || saving || validationErrors.length > 0} fullWidth>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
                    Run Now
                  </Button> : null}
                  {canUpdateSchedule ? <Button type="button" variant="outline" onClick={onDisable} disabled={!schedule || actionDisabled || !statusEnabled} fullWidth>
                    Disable Schedule
                  </Button> : null}
                </div>
              </div>
            </div>
          </div>

          {validationErrors.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {validationErrors[0]}
            </div>
          ) : null}

          {warningMessages.length > 0 ? (
            <div className="space-y-2">
              {warningMessages.map((message) => (
                <div key={message} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </div>
              ))}
            </div>
          ) : null}

        </CardBody>
        )}
      </Card>
    </div>
  );
}

interface PeriodicReviewPageProps {
  onNavigate?: (page: "asset") => void;
}

export function PeriodicReviewPage({ onNavigate }: PeriodicReviewPageProps = {}) {
  const { hasPermission, hasAllPermissions } = useAuth();
  const currentActor = useCurrentActor();
  const actorName = currentActor.auditName ?? currentActor.displayName;
  const canViewAuditReview = hasPermission("AUDIT_REVIEW_VIEW");
  const canGenerateReport = hasPermission("AUDIT_REPORT_GENERATE");
  const canRunReviewPipeline = hasAllPermissions([
    "AUDIT_REVIEW_CREATE",
    "AUDIT_REVIEW_EXTRACT",
    "AUDIT_REVIEW_ANALYZE",
    "AUDIT_REPORT_GENERATE",
  ]);
  const canViewFindings = hasPermission("AUDIT_FINDING_VIEW");
  const canViewRecords = hasPermission("AUDIT_RECORD_VIEW");
  const canViewReport = hasPermission("AUDIT_REPORT_VIEW");
  const canSubmitReport = hasPermission("AUDIT_REPORT_SUBMIT");
  const canApproveReport = hasPermission("AUDIT_REPORT_APPROVE");
  const canRejectReport = hasPermission("AUDIT_REPORT_REJECT");
  const canRequestReportChanges = hasPermission("AUDIT_REPORT_REQUEST_CHANGES");
  const canDecideReport = canApproveReport || canRejectReport || canRequestReportChanges;
  const canViewProgressReview = canViewAuditReview && canViewReport && (canSubmitReport || canDecideReport);
  const canExportReport = hasPermission("REPORT_EXPORT");
  const canViewAssetMaster = hasPermission("ASSET_VIEW");
  const canViewSchedule = hasPermission("SCHEDULE_VIEW");
  const canCreateSchedule = hasPermission("SCHEDULE_CREATE");
  const canUpdateSchedule = hasPermission("SCHEDULE_UPDATE");
  const canRunSchedule = hasPermission("SCHEDULE_RUN");
  const [activeTab, setActiveTab] = useState<TopTab>("new-review");
  const [resultTab, setResultTab] = useState<ResultTab>("summary");
  const [allAssets, setAllAssets] = useState<AssetRecord[]>([]);
  const [showAllActiveAssets, setShowAllActiveAssets] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<AuditReviewMetadata>(FALLBACK_METADATA);
  const [jobs, setJobs] = useState<AuditReviewJobListItem[]>([]);
  const [reports, setReports] = useState<AuditReviewReportListItem[]>([]);
  const [schedules, setSchedules] = useState<AuditReviewSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetLoadError, setAssetLoadError] = useState<string | null>(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [pipeline, setPipeline] = useState<PipelineStep[]>(initialPipeline);
  const [runtime, setRuntime] = useState<ReviewRuntime | null>(null);
  const [historyRuntime, setHistoryRuntime] = useState<ReviewRuntime | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyReportAction, setHistoryReportAction] = useState<ReportWorkflowAction | null>(null);
  const [historyGeneratingDraftReport, setHistoryGeneratingDraftReport] = useState(false);
  const [assetContextCollapsed, setAssetContextCollapsed] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(() => buildDefaultScheduleForm(null, actorName));
  const [scheduleFormDirty, setScheduleFormDirty] = useState(false);
  const [scheduleConfigEditing, setScheduleConfigEditing] = useState(false);
  const [customAuditRangeLocked, setCustomAuditRangeLocked] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [runningSchedule, setRunningSchedule] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [generatingDraftReport, setGeneratingDraftReport] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [submitReviewOpen, setSubmitReviewOpen] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState("Please review the draft audit trail report.");
  const [lastScheduleResult, setLastScheduleResult] = useState<AuditReviewScheduleRunNowResponse | null>(null);
  const assetContextRequestRef = useRef(0);

  const validatedSoftwareAssets = useMemo(() => allAssets.filter(isValidatedSoftwareAsset), [allAssets]);
  const activeAssets = useMemo(() => allAssets.filter(isActiveAsset), [allAssets]);
  const selectableAssets = showAllActiveAssets ? activeAssets : validatedSoftwareAssets;
  const currentSchedule = schedules[0] ?? null;
  const assetSelectorBusy = running || savingSchedule || runningSchedule;
  const visibleTopTabs = useMemo<TopTab[]>(
    () => [
      ...(canRunReviewPipeline ? (["new-review"] as const) : []),
      ...(canViewProgressReview ? (["progress-review"] as const) : []),
      ...(canViewAuditReview ? (["history"] as const) : []),
      ...(canViewSchedule ? (["schedule"] as const) : []),
    ],
    [canRunReviewPipeline, canViewAuditReview, canViewProgressReview, canViewSchedule],
  );

  useEffect(() => {
    if (visibleTopTabs.length > 0 && !visibleTopTabs.includes(activeTab)) {
      setActiveTab(visibleTopTabs[0]);
    }
  }, [activeTab, visibleTopTabs]);

  const selectedAsset = useMemo(
    () => allAssets.find((asset) => assetSelectionId(asset) === selectedAssetId) ?? null,
    [allAssets, selectedAssetId],
  );

  const resetAssetScopedState = useCallback(() => {
    assetContextRequestRef.current += 1;
    setJobs([]);
    setReports([]);
    setSchedules([]);
    setAssetLoading(false);
    setRuntime(null);
    setHistoryRuntime(null);
    setHistoryOpen(false);
    setHistoryReportAction(null);
    setHistoryGeneratingDraftReport(false);
    setAssetContextCollapsed(false);
    setRunDialogOpen(false);
    setScheduleForm(buildDefaultScheduleForm(null, actorName));
    setScheduleFormDirty(false);
    setScheduleConfigEditing(false);
    setCustomAuditRangeLocked(false);
    setSavingSchedule(false);
    setRunningSchedule(false);
    setGeneratingDraftReport(false);
    setLastScheduleResult(null);
    setResultTab("summary");
    setPipeline(initialPipeline());
  }, [actorName]);

  const loadAssetContext = useCallback(async (
    assetId: string,
    options: { showLoading?: boolean; showErrorToast?: boolean } = {},
  ) => {
    const { showLoading = true, showErrorToast = true } = options;
    const requestId = assetContextRequestRef.current + 1;
    assetContextRequestRef.current = requestId;
    if (showLoading) setAssetLoading(true);
    try {
      const [jobList, reportList, scheduleList] = await Promise.all([
        canViewAuditReview ? listAuditReviewJobs(assetId) : Promise.resolve([]),
        canViewReport ? listAssetAuditReviewReports(assetId) : Promise.resolve([]),
        canViewSchedule ? getAssetAuditReviewSchedules(assetId) : Promise.resolve([]),
      ]);
      if (assetContextRequestRef.current !== requestId) return;
      setJobs(jobList);
      setReports(reportList);
      setSchedules(scheduleList);
    } catch (error) {
      if (assetContextRequestRef.current !== requestId) return;
      if (showErrorToast) {
        toast.error(apiErrorMessage(error));
        setJobs([]);
        setReports([]);
        setSchedules([]);
      }
    } finally {
      if (showLoading && assetContextRequestRef.current === requestId) setAssetLoading(false);
    }
  }, [canViewAuditReview, canViewReport, canViewSchedule]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      canViewAuditReview || canViewSchedule ? getAuditReviewAssets() : Promise.resolve([]),
      canViewAuditReview ? getAuditReviewMetadata().catch(() => FALLBACK_METADATA) : Promise.resolve(FALLBACK_METADATA),
    ])
      .then(([assetList, nextMetadata]) => {
        if (cancelled) return;
        setAllAssets(Array.isArray(assetList) ? assetList : []);
        setAssetLoadError(null);
        setMetadata(nextMetadata);
      })
      .catch((error) => {
        if (cancelled) return;
        setAllAssets([]);
        setAssetLoadError("Unable to load validated software assets.");
        toast.error(apiErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canViewAuditReview, canViewSchedule]);

  useEffect(() => {
    if (!selectedAssetId) {
      setAssetLoading(false);
      return;
    }
    void loadAssetContext(selectedAssetId);
  }, [loadAssetContext, selectedAssetId]);

  useEffect(() => {
    setScheduleForm(buildDefaultScheduleForm(currentSchedule, actorName, selectedAsset));
    setScheduleFormDirty(false);
    setLastScheduleResult(null);
    setScheduleConfigEditing(!currentSchedule);
    setCustomAuditRangeLocked(false);
  }, [actorName, currentSchedule?.schedule_id, selectedAsset, selectedAssetId]);

  useEffect(() => {
    if (!currentSchedule || scheduleFormDirty || savingSchedule || runningSchedule) return;
    setScheduleForm(buildDefaultScheduleForm(currentSchedule, actorName, selectedAsset));
    setCustomAuditRangeLocked(false);
  }, [
    currentSchedule?.modified_dt,
    currentSchedule?.next_run_dt,
    currentSchedule?.last_run_dt,
    scheduleFormDirty,
    savingSchedule,
    runningSchedule,
    actorName,
    selectedAsset,
  ]);

  useEffect(() => {
    if (activeTab !== "schedule" || !selectedAssetId || savingSchedule || runningSchedule || !canViewSchedule) return;
    void loadAssetContext(selectedAssetId, { showLoading: false, showErrorToast: false });
    const interval = window.setInterval(() => {
      void loadAssetContext(selectedAssetId, { showLoading: false, showErrorToast: false });
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [activeTab, canViewSchedule, loadAssetContext, runningSchedule, savingSchedule, selectedAssetId]);

  const handleAssetSelect = useCallback((assetId: string) => {
    if (assetId === selectedAssetId) return;
    resetAssetScopedState();
    setSelectedAssetId(assetId || null);
  }, [resetAssetScopedState, selectedAssetId]);

  const handleShowAllActiveAssets = useCallback(() => {
    setShowAllActiveAssets(true);
  }, []);

  const handleShowValidatedOnly = useCallback(() => {
    setShowAllActiveAssets(false);
    if (selectedAsset && !isValidatedSoftwareAsset(selectedAsset)) {
      resetAssetScopedState();
      setSelectedAssetId(null);
    }
  }, [resetAssetScopedState, selectedAsset]);

  const handleGoToAssetMaster = useCallback(() => {
    if (onNavigate) {
      onNavigate("asset");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("app_current_page", "asset");
      window.location.reload();
    }
  }, [onNavigate]);

  const updateScheduleForm = useCallback((field: keyof ScheduleFormState, value: string | boolean | string[]) => {
    setScheduleConfigEditing(true);
    if ((field === "customAuditStart" || field === "customAuditEnd") && typeof value === "string") {
      setCustomAuditRangeLocked(true);
    }
    if (field === "auditRetrievalMode" && value !== "CUSTOM") {
      setCustomAuditRangeLocked(false);
    }
    setScheduleForm((previous) => {
      if (field === "frequency" && typeof value === "string") {
        const frequency = value as AuditReviewScheduleFrequency;
        const cycleType = coerceCycleType(null, frequency);
        const customCycleStartMonth = "1";
        const nextForm: ScheduleFormState = {
          ...previous,
          frequency,
          reviewWindowDays: String(REVIEW_WINDOW_DAYS_BY_FREQUENCY[frequency] ?? REVIEW_WINDOW_DAYS_BY_FREQUENCY.MONTHLY),
          auditRetrievalMode: frequency === "QUARTERLY" || frequency === "MONTHLY" || frequency === "ANNUAL"
            ? "AUTO"
            : previous.auditRetrievalMode === "CUSTOM"
              ? "CUSTOM"
              : defaultAuditRetrievalMode(frequency),
          cycleType: frequency === "ANNUAL" ? "CALENDAR_YEAR" : cycleType,
          runTiming: "FIRST_DAY_AFTER_PERIOD_END",
          runMonth: "1",
          customCycleStartMonth,
          fiscalYearStartMonth: "1",
          startQuarter: frequency === "QUARTERLY"
            ? previous.startQuarter || defaultStartQuarterValue(previous.timezone)
            : previous.startQuarter,
          endQuarter: frequency === "QUARTERLY"
            ? previous.endQuarter || NO_END_QUARTER_VALUE
            : previous.endQuarter,
          startHalfYear: frequency === "HALF_YEARLY"
            ? defaultStartHalfYearValue(previous.timezone, cycleType, customCycleStartMonth)
            : previous.startHalfYear,
          endHalfYear: frequency === "HALF_YEARLY"
            ? NO_END_HALF_YEAR_VALUE
            : previous.endHalfYear,
          startReviewYear: frequency === "ANNUAL"
            ? previous.startReviewYear || defaultStartReviewYearValue(previous.timezone)
            : previous.startReviewYear,
          endReviewYear: frequency === "ANNUAL"
            ? NO_END_ANNUAL_YEAR_VALUE
            : previous.endReviewYear,
        };
        const fallbackRange = defaultCustomAuditRangeForFrequency(nextForm, frequency);
        return {
          ...nextForm,
          customAuditStart: customAuditRangeLocked && previous.customAuditStart ? previous.customAuditStart : fallbackRange.start,
          customAuditEnd: customAuditRangeLocked && previous.customAuditEnd ? previous.customAuditEnd : fallbackRange.end,
        };
      }
      if (field === "cycleType" && typeof value === "string" && previous.frequency === "HALF_YEARLY") {
        const cycleType = coerceCycleType(value, "HALF_YEARLY");
        return {
          ...previous,
          cycleType,
          runTiming: "FIRST_DAY_AFTER_PERIOD_END",
          startHalfYear: defaultStartHalfYearValue(previous.timezone, cycleType, previous.customCycleStartMonth),
          endHalfYear: NO_END_HALF_YEAR_VALUE,
        };
      }
      if (field === "customCycleStartMonth" && typeof value === "string" && previous.frequency === "HALF_YEARLY") {
        return {
          ...previous,
          customCycleStartMonth: value,
          startHalfYear: defaultStartHalfYearValue(previous.timezone, previous.cycleType, value),
          endHalfYear: NO_END_HALF_YEAR_VALUE,
        };
      }
      if (field === "cycleType" && previous.frequency === "ANNUAL") {
        return {
          ...previous,
          cycleType: "CALENDAR_YEAR",
        };
      }
      if (field === "auditRetrievalMode" && value === "CUSTOM") {
        const fallbackRange = defaultCustomAuditRangeForFrequency(previous, previous.frequency);
        return {
          ...previous,
          auditRetrievalMode: "CUSTOM",
          customAuditStart: previous.customAuditStart || fallbackRange.start,
          customAuditEnd: previous.customAuditEnd || fallbackRange.end,
        };
      }
      if ((field === "customAuditStart" || field === "customAuditEnd") && typeof value === "string") {
        return {
          ...previous,
          [field]: value,
          auditRetrievalMode: "CUSTOM",
        };
      }
      return { ...previous, [field]: value };
    });
    setScheduleFormDirty(true);
    setLastScheduleResult(null);
  }, [customAuditRangeLocked]);

  const buildSchedulePayload = (mode: "create" | "update") => {
    void mode;
    const nextRunDate = computeScheduleNextRun(scheduleForm);
    const isQuarterlySchedule = scheduleForm.frequency === "QUARTERLY";
    const isHalfYearlySchedule = scheduleForm.frequency === "HALF_YEARLY";
    const isAnnualSchedule = scheduleForm.frequency === "ANNUAL";
    const effectiveHalfYearCycleType = coerceCycleType(scheduleForm.cycleType, "HALF_YEARLY");
    const selectedQuarterRange = isQuarterlySchedule
      ? calendarQuarterRange(scheduleForm.startQuarter, scheduleForm.timezone)
      : null;
    const selectedEndQuarterRunDate = isQuarterlySchedule && scheduleForm.endQuarter !== NO_END_QUARTER_VALUE
      ? calendarQuarterRunDate(scheduleForm.endQuarter, scheduleForm.runTime, scheduleForm.timezone)
      : null;
    const selectedHalfYearRange = isHalfYearlySchedule
      ? halfYearRange(scheduleForm.startHalfYear, scheduleForm.timezone)
      : null;
    const selectedEndHalfYearRunDate = isHalfYearlySchedule && scheduleForm.endHalfYear !== NO_END_HALF_YEAR_VALUE
      ? halfYearRunDate(scheduleForm.endHalfYear, scheduleForm.runTime, scheduleForm.timezone)
      : null;
    const selectedAnnualRange = isAnnualSchedule
      ? annualReviewRange(scheduleForm.startReviewYear, scheduleForm.timezone)
      : null;
    const selectedEndAnnualRunDate = isAnnualSchedule && scheduleForm.endReviewYear !== NO_END_ANNUAL_YEAR_VALUE
      ? annualRunDate(scheduleForm.endReviewYear, scheduleForm.runTime, scheduleForm.timezone)
      : null;
    const scheduleStartParts = parseDateInputParts(scheduleForm.scheduleStartDate);
    const scheduleStartDate = selectedQuarterRange?.start ?? selectedHalfYearRange?.start ?? selectedAnnualRange?.start ?? (scheduleStartParts
      ? zonedDateTimeToDate(scheduleStartParts, { hour: 0, minute: 0, second: 0 }, scheduleForm.timezone)
      : null);
    const effectiveEndCondition: ScheduleEndCondition = isQuarterlySchedule
      ? selectedEndQuarterRunDate
        ? "END_ON_DATE"
        : "NO_END_DATE"
      : isHalfYearlySchedule
      ? selectedEndHalfYearRunDate
        ? "END_ON_DATE"
        : "NO_END_DATE"
      : isAnnualSchedule
      ? selectedEndAnnualRunDate
        ? "END_ON_DATE"
        : "NO_END_DATE"
      : scheduleForm.scheduleEndDate
      ? "END_ON_DATE"
      : "NO_END_DATE";
    const scheduleEndParts = parseDateInputParts(scheduleForm.scheduleEndDate);
    const scheduleEndDate = selectedEndQuarterRunDate ?? selectedEndHalfYearRunDate ?? selectedEndAnnualRunDate ?? (!isQuarterlySchedule && !isHalfYearlySchedule && !isAnnualSchedule && effectiveEndCondition === "END_ON_DATE" && scheduleEndParts
      ? zonedDateTimeToDate(scheduleEndParts, { hour: 23, minute: 59, second: 59 }, scheduleForm.timezone)
      : null);
    const customAuditStart = scheduleForm.customAuditStart
      ? datetimeLocalInputToDate(scheduleForm.customAuditStart, scheduleForm.timezone)
      : null;
    const customAuditEnd = scheduleForm.customAuditEnd
      ? datetimeLocalInputToDate(scheduleForm.customAuditEnd, scheduleForm.timezone)
      : null;
    const auditRetrievalMode = isQuarterlySchedule
      ? "AUTO"
      : scheduleForm.frequency === "MONTHLY"
        ? "AUTO"
      : isAnnualSchedule
        ? "AUTO"
      : scheduleForm.frequency === "DAILY" && scheduleForm.auditRetrievalMode === "SINCE_LAST_SUCCESSFUL"
        ? "AUTO"
        : scheduleForm.auditRetrievalMode;
    const selectedAuditTrailTypes = selectedTypesForScope(metadata, scheduleForm.reviewScope, scheduleForm.selectedAuditTrailTypes);

    if (!scheduleStartDate) {
      throw new Error(isQuarterlySchedule || isHalfYearlySchedule || isAnnualSchedule ? "Start reviewing from is required." : "Schedule start date is required.");
    }
    if (!scheduleForm.runTime) {
      throw new Error("Run time is required.");
    }
    if (
      isQuarterlySchedule &&
      scheduleForm.endQuarter !== NO_END_QUARTER_VALUE &&
      quarterIndex(scheduleForm.endQuarter) < quarterIndex(scheduleForm.startQuarter)
    ) {
      throw new Error("Schedule ending quarter must be the same as or after the start reviewing quarter.");
    }
    if (
      isHalfYearlySchedule &&
      scheduleForm.endHalfYear !== NO_END_HALF_YEAR_VALUE &&
      halfYearIndex(scheduleForm.endHalfYear) < halfYearIndex(scheduleForm.startHalfYear)
    ) {
      throw new Error("Schedule ending half-year must be the same as or after the start reviewing half-year.");
    }
    if (
      isAnnualSchedule &&
      scheduleForm.endReviewYear !== NO_END_ANNUAL_YEAR_VALUE &&
      parseReviewYear(scheduleForm.endReviewYear) !== null &&
      parseReviewYear(scheduleForm.startReviewYear) !== null &&
      (parseReviewYear(scheduleForm.endReviewYear) ?? 0) < (parseReviewYear(scheduleForm.startReviewYear) ?? 0)
    ) {
      throw new Error("Schedule ending year must be the same as or after the start reviewing year.");
    }
    if (!nextRunDate) {
      throw new Error("Next run date/time could not be calculated from this schedule.");
    }
    if (!isQuarterlySchedule && !isHalfYearlySchedule && !isAnnualSchedule && effectiveEndCondition === "END_ON_DATE") {
      if (!scheduleEndDate) throw new Error("Schedule end date is required.");
      if (scheduleEndDate.getTime() < scheduleStartDate.getTime()) throw new Error("Schedule end date must be on or after schedule start date.");
    }
    if (scheduleForm.frequency === "WEEKLY" && parseOptionalInt(scheduleForm.dayOfWeek) == null) {
      throw new Error("Weekly schedule requires a day of week.");
    }
    if (scheduleForm.frequency === "HALF_YEARLY") {
      if (!parseHalfYearValue(scheduleForm.startHalfYear)) throw new Error("Start reviewing from is required.");
      if (!scheduleForm.cycleType) throw new Error("Half yearly schedule requires a half-year cycle.");
      if (effectiveHalfYearCycleType === "CUSTOM_SIX_MONTH_CYCLE" && parseOptionalInt(scheduleForm.customCycleStartMonth) == null) {
        throw new Error("Half yearly custom cycle requires a start month.");
      }
    }
    if (scheduleForm.frequency === "ANNUAL") {
      if (scheduleForm.cycleType !== "CALENDAR_YEAR") throw new Error("Annual cycle must be Calendar Year.");
      if (parseReviewYear(scheduleForm.startReviewYear) === null) throw new Error("Start reviewing from is required.");
      if (scheduleForm.endReviewYear !== NO_END_ANNUAL_YEAR_VALUE && parseReviewYear(scheduleForm.endReviewYear) === null) {
        throw new Error("Schedule ending year is invalid.");
      }
    }
    if (auditRetrievalMode === "CUSTOM") {
      if (!customAuditStart || !customAuditEnd || Number.isNaN(customAuditStart.getTime()) || Number.isNaN(customAuditEnd.getTime())) {
        throw new Error("Custom audit retrieval start and end dates are required.");
      }
      if (customAuditEnd.getTime() < customAuditStart.getTime()) {
        throw new Error("Custom audit start date/time must be before or equal to custom audit end date/time.");
      }
      if (nextRunDate && customAuditEnd.getTime() > nextRunDate.getTime()) {
        throw new Error("Custom audit end date/time must not be after the next run time.");
      }
      if (customAuditStart.getTime() > Date.now() || customAuditEnd.getTime() > Date.now()) {
        throw new Error("Custom audit period must not be in the future.");
      }
    }
    if (!scheduleForm.timezone.trim()) {
      throw new Error("Timezone is required.");
    }
    if (selectedAuditTrailTypes.length === 0) {
      throw new Error("Select at least one audit trail type.");
    }

    const effectiveCycleType: ScheduleCycleType | null = scheduleForm.frequency === "QUARTERLY"
      ? "CALENDAR_QUARTER"
      : scheduleForm.frequency === "HALF_YEARLY"
        ? effectiveHalfYearCycleType
      : ["QUARTERLY", "HALF_YEARLY", "ANNUAL"].includes(scheduleForm.frequency)
        ? scheduleForm.cycleType
        : null;
    const effectiveRunTiming: ScheduleRunTiming | null = scheduleForm.frequency === "QUARTERLY"
      ? "FIRST_DAY_AFTER_PERIOD_END"
      : scheduleForm.frequency === "HALF_YEARLY"
        ? "FIRST_DAY_AFTER_PERIOD_END"
        : null;

    return {
      enabled: scheduleForm.enabled,
      audit_trail_type: selectedAuditTrailTypes[0],
      review_scope: scheduleForm.reviewScope,
      selected_audit_trail_types: selectedAuditTrailTypes,
      veeva_instance_name: scheduleForm.veevaInstanceName.trim() || null,
      veeva_app_name: scheduleForm.veevaAppName.trim() || null,
      vault_dns: scheduleForm.vaultDns.trim() || null,
      frequency: scheduleForm.frequency,
      review_window_days: parseOptionalInt(scheduleForm.reviewWindowDays) ?? REVIEW_WINDOW_DAYS_BY_FREQUENCY[scheduleForm.frequency],
      schedule_start_dt: scheduleStartDate.toISOString(),
      schedule_end_dt: scheduleEndDate ? scheduleEndDate.toISOString() : null,
      end_condition: effectiveEndCondition,
      end_after_runs: null,
      run_time: scheduleForm.runTime,
      day_of_week: scheduleForm.frequency === "WEEKLY" ? parseOptionalInt(scheduleForm.dayOfWeek) : null,
      day_of_month: scheduleForm.frequency === "MONTHLY" ? 1 : null,
      use_last_day_of_month: scheduleForm.frequency === "MONTHLY" ? false : null,
      cycle_type: effectiveCycleType,
      run_timing: effectiveRunTiming,
      run_month: scheduleForm.frequency === "ANNUAL" && scheduleForm.cycleType === "CALENDAR_YEAR"
        ? parseOptionalInt(scheduleForm.runMonth)
        : null,
      custom_cycle_start_month: effectiveCycleType === "CUSTOM_QUARTER_CYCLE" || effectiveCycleType === "CUSTOM_SIX_MONTH_CYCLE"
        ? parseOptionalInt(scheduleForm.customCycleStartMonth)
        : null,
      fiscal_year_start_month: scheduleForm.frequency === "ANNUAL" && scheduleForm.cycleType === "FISCAL_YEAR"
        ? parseOptionalInt(scheduleForm.fiscalYearStartMonth)
        : null,
      audit_retrieval_mode: auditRetrievalMode,
      custom_audit_start_dt: auditRetrievalMode === "CUSTOM" && customAuditStart ? customAuditStart.toISOString() : null,
      custom_audit_end_dt: auditRetrievalMode === "CUSTOM" && customAuditEnd ? customAuditEnd.toISOString() : null,
      timezone: scheduleForm.timezone.trim(),
    };
  };

  const persistSchedule = async (showSuccessToast: boolean): Promise<AuditReviewSchedule> => {
    if (!selectedAssetId) throw new Error("Select an asset before saving a schedule.");
    if (!(currentSchedule ? canUpdateSchedule : canCreateSchedule)) throw new Error("You do not have access to this area.");

    const payload = buildSchedulePayload(currentSchedule ? "update" : "create");
    const saved = currentSchedule
      ? await updateAuditReviewSchedule(currentSchedule.schedule_id, payload)
      : await createAssetAuditReviewSchedule(selectedAssetId, payload);
    const savedWithRequestedRange: AuditReviewSchedule = payload.audit_retrieval_mode === "CUSTOM"
      ? {
          ...saved,
          audit_retrieval_mode: "CUSTOM",
          custom_audit_start_dt: saved.custom_audit_start_dt ?? payload.custom_audit_start_dt,
          custom_audit_end_dt: saved.custom_audit_end_dt ?? payload.custom_audit_end_dt,
        }
      : saved;

    setSchedules((previous) => [savedWithRequestedRange, ...previous.filter((item) => item.schedule_id !== savedWithRequestedRange.schedule_id)]);
    setScheduleForm(buildDefaultScheduleForm(savedWithRequestedRange, actorName, selectedAsset));
    setScheduleFormDirty(false);
    setScheduleConfigEditing(false);
    setCustomAuditRangeLocked(false);
    setLastScheduleResult(null);
    if (showSuccessToast) toast.success("Periodic review schedule saved");
    return savedWithRequestedRange;
  };

  const handleSaveSchedule = async () => {
    if (!(currentSchedule ? canUpdateSchedule : canCreateSchedule)) return;
    setSavingSchedule(true);
    try {
      await persistSchedule(true);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDisableSchedule = async () => {
    if (!currentSchedule || !canUpdateSchedule) return;
    setSavingSchedule(true);
    try {
      const updated = await updateAuditReviewSchedule(currentSchedule.schedule_id, {
        enabled: false,
      });
      setSchedules((previous) => [updated, ...previous.filter((item) => item.schedule_id !== updated.schedule_id)]);
      setScheduleForm(buildDefaultScheduleForm(updated, actorName, selectedAsset));
      setScheduleFormDirty(false);
      setScheduleConfigEditing(false);
      setCustomAuditRangeLocked(false);
      setLastScheduleResult(null);
      toast.success("Periodic review schedule disabled");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleRunScheduleNow = async () => {
    if (!selectedAssetId || !canRunSchedule) return;
    setRunningSchedule(true);
    try {
      const savedSchedule = await persistSchedule(false);
      const result = await runAuditReviewScheduleNow(savedSchedule.schedule_id);
      const resultSchedule: AuditReviewSchedule = savedSchedule.audit_retrieval_mode === "CUSTOM"
        ? {
            ...result.schedule,
            audit_retrieval_mode: "CUSTOM",
            custom_audit_start_dt: result.schedule.custom_audit_start_dt ?? savedSchedule.custom_audit_start_dt,
            custom_audit_end_dt: result.schedule.custom_audit_end_dt ?? savedSchedule.custom_audit_end_dt,
          }
        : result.schedule;
      setLastScheduleResult(result);
      setSchedules((previous) => [resultSchedule, ...previous.filter((item) => item.schedule_id !== resultSchedule.schedule_id)]);
      setScheduleForm(buildDefaultScheduleForm(resultSchedule, actorName, selectedAsset));
      setScheduleFormDirty(false);
      setScheduleConfigEditing(false);
      setCustomAuditRangeLocked(false);
      if (result.run.status === "COMPLETED") {
        toast.success("Scheduled audit review completed");
      } else if (result.run.status === "FAILED") {
        toast.error(result.run.error_message || "Scheduled audit review failed");
      } else {
        toast.info(result.run.message || "Scheduled audit review run started");
      }
      await loadAssetContext(selectedAssetId);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setRunningSchedule(false);
    }
  };

  const refreshRuntime = useCallback(async (jobId: string, scope?: AuditReviewScope, selectedTypes?: string[]): Promise<ReviewRuntime> => {
    const detail = await getAuditReviewJob(jobId);
    const [findings, scores, records, reportList] = await Promise.all([
      canViewFindings ? getAuditReviewFindings(jobId) : Promise.resolve([]),
      canViewAuditReview ? getAuditReviewScores(jobId) : Promise.resolve([]),
      canViewRecords ? getAuditReviewRecords(jobId, true) : Promise.resolve([]),
      canViewReport ? listAssetAuditReviewReports(detail.asset_id) : Promise.resolve([]),
    ]);
    const reportId = detail.latest_report_id || reportList.find((item) => item.job_id === jobId)?.report_id || null;
    const report = canViewReport && reportId ? await getAuditReviewReport(reportId) : null;
    return {
      job: detail,
      report,
      findings,
      scores,
      records,
      reviewScope: scope || detail.review_scope || "LOGIN_ONLY",
      selectedAuditTrailTypes: selectedTypes?.length
        ? selectedTypes
        : detail.selected_audit_trail_types?.length
          ? detail.selected_audit_trail_types
          : [detail.audit_trail_type],
    };
  }, [canViewAuditReview, canViewFindings, canViewRecords, canViewReport]);

  const handleRunReview = async (payload: AuditReviewJobCreatePayload, form: RunFormState) => {
    if (!selectedAssetId || !canRunReviewPipeline) return;
    setRunning(true);
    setRunDialogOpen(false);
    setResultTab("summary");
    setRuntime(null);
    setPipeline(updateStep(initialPipeline(), "asset", "done"));
    let createdJobId: string | null = null;

    try {
      setPipeline((steps) => updateStep(steps, "created", "active"));
      const created = await createAuditReviewJob(selectedAssetId, payload);
      createdJobId = created.job_id;
      setPipeline((steps) => updateStep(steps, "created", "done"));

      setPipeline((steps) => updateStep(steps, "extracted", "active"));
      const extraction = await extractAuditReviewJob(created.job_id);
      if (extraction.status === "FAILED") {
        setPipeline((steps) => updateStep(steps, "extracted", "failed", "FAILED: all selected audit trail types failed extraction."));
        throw new Error("All selected audit trail types failed extraction.");
      }
      setPipeline((steps) =>
        updateStep(
          steps,
          "extracted",
          extraction.status === "PARTIAL_EXTRACTION" ? "warning" : "done",
          extraction.status === "PARTIAL_EXTRACTION" ? "PARTIAL_EXTRACTION: available audit types will continue." : undefined,
        ),
      );

      setPipeline((steps) => updateStep(steps, "analyzed", "active"));
      await analyzeAuditReviewJob(created.job_id, {
        business_timezone: "Asia/Kolkata",
        business_start_hour: 9,
        business_end_hour: 18,
      });
      setPipeline((steps) => updateStep(steps, "analyzed", "done"));

      const nextRuntime = await refreshRuntime(created.job_id, form.reviewScope, form.selectedAuditTrailTypes);
      setRuntime(nextRuntime);
      setAssetContextCollapsed(true);
      await loadAssetContext(selectedAssetId);
      toast.success("Audit review analysis completed. Generate the draft report when ready.");
    } catch (error) {
      setPipeline((steps) => {
        const active = steps.find((step) => step.status === "active");
        return active ? updateStep(steps, active.key, "failed", apiErrorMessage(error)) : steps;
      });
      if (createdJobId) {
        const failedRuntime = await refreshRuntime(createdJobId, form.reviewScope, form.selectedAuditTrailTypes).catch(() => null);
        if (failedRuntime) setRuntime(failedRuntime);
      }
      toast.error(apiErrorMessage(error));
    } finally {
      setRunning(false);
    }
  };

  const handleViewHistory = async (jobId: string) => {
    try {
      const detail = await refreshRuntime(jobId);
      setHistoryRuntime(detail);
      setHistoryOpen(true);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };

  const handleHistoryGenerateDraftReport = async () => {
    if (!historyRuntime || historyRuntime.report || !canGenerateReport) return;
    if (historyRuntime.job.status !== "ANALYZED" && historyRuntime.job.status !== "REPORT_DRAFTED") {
      toast.error("Draft report can be generated only after analysis is complete.");
      return;
    }

    setHistoryGeneratingDraftReport(true);
    try {
      await generateAuditReviewReport(historyRuntime.job.job_id);
      const nextRuntime = await refreshRuntime(
        historyRuntime.job.job_id,
        historyRuntime.reviewScope,
        historyRuntime.selectedAuditTrailTypes,
      );
      setHistoryRuntime(nextRuntime);
      setRuntime((current) => current?.job.job_id === nextRuntime.job.job_id ? nextRuntime : current);
      if (selectedAssetId) await loadAssetContext(selectedAssetId, { showLoading: false, showErrorToast: false });
      toast.success("Report preview generated");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setHistoryGeneratingDraftReport(false);
    }
  };

  const handleHistoryReportDecision = async (
    action: ReviewDecisionAction,
    reviewerComments: string,
    eSignature?: AuditReviewReportESignaturePayload,
  ) => {
    const report = historyRuntime?.report;
    if (!historyRuntime || !report || report.status !== "UNDER_REVIEW") return;

    setHistoryReportAction(action);
    try {
      if (action === "approve") {
        if (!eSignature) {
          toast.error("Electronic signature confirmation is required before approval.");
          return;
        }
        await approveAuditReviewReport(report.report_id, { reviewer_comments: reviewerComments, e_signature: eSignature });
      } else if (action === "reject") {
        await rejectAuditReviewReport(report.report_id, { reviewer_comments: reviewerComments });
      } else {
        await requestChangesAuditReviewReport(report.report_id, { reviewer_comments: reviewerComments });
      }

      const nextRuntime = await refreshRuntime(
        historyRuntime.job.job_id,
        historyRuntime.reviewScope,
        historyRuntime.selectedAuditTrailTypes,
      );
      setHistoryRuntime(nextRuntime);
      setRuntime((current) => current?.job.job_id === nextRuntime.job.job_id ? nextRuntime : current);
      if (selectedAssetId) await loadAssetContext(selectedAssetId, { showLoading: false, showErrorToast: false });
      if ((action === "approve" || action === "reject") && canViewAuditReview) {
        setActiveTab("history");
      } else if (action === "request-changes" && canViewProgressReview) {
        setActiveTab("progress-review");
      }
      toast.success(
        action === "approve"
          ? "Audit review report approved"
          : action === "reject"
            ? "Audit review report rejected and moved to Review History"
            : "Audit review report returned for changes",
      );
    } catch (error) {
      toast.error(apiErrorMessage(error));
      throw error;
    } finally {
      setHistoryReportAction(null);
    }
  };

  const handleHistorySubmitForReview = async (submissionNotes: string) => {
    const report = historyRuntime?.report;
    if (
      !historyRuntime ||
      !report ||
      !canSubmitReport ||
      (report.status !== "DRAFT" && report.status !== "CHANGES_REQUESTED")
    ) {
      return;
    }

    const isResubmission = report.status === "CHANGES_REQUESTED";
    setHistoryReportAction("submit-review");
    try {
      await submitAuditReviewReport(report.report_id, {
        submission_notes: submissionNotes.trim() || null,
      });
      const nextRuntime = await refreshRuntime(
        historyRuntime.job.job_id,
        historyRuntime.reviewScope,
        historyRuntime.selectedAuditTrailTypes,
      );
      setHistoryRuntime(nextRuntime);
      setRuntime((current) => current?.job.job_id === nextRuntime.job.job_id ? nextRuntime : current);
      if (selectedAssetId) await loadAssetContext(selectedAssetId, { showLoading: false, showErrorToast: false });
      toast.success(isResubmission ? "Audit review report resubmitted for QA review" : "Audit review report submitted for QA review");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setHistoryReportAction(null);
    }
  };

  const handleDownloadPdf = async (reportId?: string | null) => {
    if (!canExportReport) return;
    const knownReport = reportId
      ? reports.find((item) => item.report_id === reportId) || (historyRuntime?.report?.report_id === reportId ? historyRuntime.report : null)
      : runtime?.report;
    const targetReportId = reportId || runtime?.report?.report_id;
    if (!targetReportId) {
      toast.error("Approved PDF is not available for download yet.");
      return;
    }
    if (knownReport && !canDownloadAuditReviewReport(knownReport.status)) {
      toast.error("PDF download is available only after final QA approval.");
      return;
    }
    setDownloadingReport(true);
    try {
      const download = await downloadAuditReviewReportPdf(targetReportId);
      const url = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = download.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleGenerateDraftReport = async () => {
    if (!runtime || runtime.report || !canRunReviewPipeline) return;
    if (runtime.job.status !== "ANALYZED" && runtime.job.status !== "REPORT_DRAFTED") {
      toast.error("Draft report can be generated only after analysis is complete.");
      return;
    }

    setGeneratingDraftReport(true);
    try {
      await generateAuditReviewReport(runtime.job.job_id);
      const nextRuntime = await refreshRuntime(
        runtime.job.job_id,
        runtime.reviewScope,
        runtime.selectedAuditTrailTypes,
      );
      setRuntime(nextRuntime);
      setResultTab(nextRuntime.report ? "preview" : "summary");
      if (selectedAssetId) await loadAssetContext(selectedAssetId, { showLoading: false, showErrorToast: false });
      toast.success("Report preview generated");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setGeneratingDraftReport(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (
      !runtime?.report ||
      !canSubmitReport ||
      (runtime.report.status !== "DRAFT" && runtime.report.status !== "CHANGES_REQUESTED")
    ) {
      return;
    }

    const isResubmission = runtime.report.status === "CHANGES_REQUESTED";
    setSubmittingReport(true);
    try {
      await submitAuditReviewReport(runtime.report.report_id, {
        submission_notes: submissionNotes.trim() || null,
      });
      const nextRuntime = await refreshRuntime(
        runtime.job.job_id,
        runtime.reviewScope,
        runtime.selectedAuditTrailTypes,
      );
      setRuntime(nextRuntime);
      if (selectedAssetId) await loadAssetContext(selectedAssetId, { showLoading: false, showErrorToast: false });
      setSubmitReviewOpen(false);
      toast.success(isResubmission ? "Audit review report resubmitted for QA review" : "Audit review report submitted for QA review");
    } catch (error) {
      toast.error(apiErrorMessage(error));
    } finally {
      setSubmittingReport(false);
    }
  };

  const submitDialogIsResubmission = runtime?.report?.status === "CHANGES_REQUESTED";

  return (
    <div className="min-h-full bg-slate-50">
      <section className="border-b border-slate-200 bg-white px-4 py-5 shadow-sm lg:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Periodic Review</h1>
          </div>
        </div>
        <div className="mt-5">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TopTab)}>
            <TabsList className="rounded-lg bg-slate-100 p-1">
              {canRunReviewPipeline ? <TabsTrigger value="new-review" className="rounded-md px-4">New Review</TabsTrigger> : null}
              {canViewProgressReview ? <TabsTrigger value="progress-review" className="rounded-md px-4">Progress Review</TabsTrigger> : null}
              {canViewAuditReview ? <TabsTrigger value="history" className="rounded-md px-4">Review History</TabsTrigger> : null}
              {canViewSchedule ? <TabsTrigger value="schedule" className="rounded-md px-4">Schedule</TabsTrigger> : null}
            </TabsList>
          </Tabs>
        </div>
      </section>

      <main className="space-y-5 px-4 py-5 lg:px-6">
        {activeTab === "new-review" && canRunReviewPipeline ? (
          <div className="space-y-5">
            <Card className="rounded-lg border-slate-200 bg-white p-5 shadow-sm">
              <AssetSelector
                assets={selectableAssets}
                selectedAssetId={selectedAssetId}
                onSelect={handleAssetSelect}
                loading={loading}
                error={assetLoadError}
                disabled={assetSelectorBusy}
                showAllActive={showAllActiveAssets}
                activeAssetCount={activeAssets.length}
                onShowAllActive={canViewAssetMaster ? handleShowAllActiveAssets : undefined}
                onShowValidatedOnly={canViewAssetMaster ? handleShowValidatedOnly : undefined}
                onGoToAssetMaster={canViewAssetMaster ? handleGoToAssetMaster : undefined}
              />
            </Card>

            {!selectedAsset ? (
              null
            ) : (
              <>
                {assetLoading ? (
                  <Card className="rounded-lg border-slate-200 bg-white p-5 text-sm text-slate-500">Loading asset compliance context...</Card>
                ) : null}
                <AssetContextCard
                  asset={selectedAsset}
                  jobs={jobs}
                  schedules={schedules}
                  collapsed={assetContextCollapsed}
                  onCollapsedChange={setAssetContextCollapsed}
                  action={(
                    <RunReviewActionButton
                      disabled={!selectedAsset || assetSelectorBusy || !canRunReviewPipeline}
                      running={running}
                      onClick={() => setRunDialogOpen(true)}
                    />
                  )}
                />
                <PipelineTimeline steps={pipeline} visible={running} />

                {runtime ? (
                  <Card className="rounded-lg border-slate-200 bg-white shadow-none" padding="none">
                    <ResultSummaryHeader
                      runtime={runtime}
                      onGenerateDraft={
                        canRunReviewPipeline && !runtime.report && (runtime.job.status === "ANALYZED" || runtime.job.status === "REPORT_DRAFTED")
                          ? () => void handleGenerateDraftReport()
                          : undefined
                      }
                      onDownloadReport={canExportReport && canDownloadAuditReviewReport(runtime.report?.status) ? () => void handleDownloadPdf() : undefined}
                      onSubmitForApproval={
                        canSubmitReport && (runtime.report?.status === "DRAFT" || runtime.report?.status === "CHANGES_REQUESTED")
                          ? () => {
                              setSubmissionNotes(
                                runtime.report?.status === "CHANGES_REQUESTED"
                                  ? "Requested changes have been addressed. Please review again."
                                  : "Please review the draft audit trail report.",
                              );
                              setSubmitReviewOpen(true);
                            }
                          : undefined
                      }
                      generatingDraft={generatingDraftReport}
                      downloadingReport={downloadingReport}
                      submittingReport={submittingReport}
                    />
                    <Tabs value={resultTab} onValueChange={(value) => setResultTab(value as ResultTab)} className="gap-0">
                      <div className="border-b border-slate-200 px-3 py-3">
                        <TabsList className="rounded-lg bg-slate-100 p-1">
                          <TabsTrigger value="summary">Result Summary</TabsTrigger>
                          {runtime.report ? <TabsTrigger value="preview">Report Preview</TabsTrigger> : null}
                          {canViewFindings ? <TabsTrigger value="findings">Findings</TabsTrigger> : null}
                          {canViewRecords ? <TabsTrigger value="evidence">Evidence Records</TabsTrigger> : null}
                        </TabsList>
                      </div>
                      <TabsContent value="summary" className="m-0 px-3 py-4">
                        <CurrentResultSummaryTab runtime={runtime} />
                      </TabsContent>
                      {runtime.report ? <TabsContent value="preview" className="m-0 px-3 py-4">
                        <DraftInternalReportPreview runtime={runtime} />
                      </TabsContent> : null}
                      {canViewFindings ? <TabsContent value="findings" className="m-0 px-3 py-4">
                        <FindingsWorkspace runtime={runtime} canExport={canExportReport} />
                      </TabsContent> : null}
                      {canViewRecords ? <TabsContent value="evidence" className="m-0 px-3 py-4">
                        <EvidenceRecordsTable runtime={runtime} />
                      </TabsContent> : null}
                    </Tabs>
                  </Card>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {activeTab === "progress-review" && canViewProgressReview ? (
          <div className="space-y-5">
            <Card className="rounded-lg border-slate-200 bg-white p-5 shadow-sm">
              <AssetSelector
                assets={selectableAssets}
                selectedAssetId={selectedAssetId}
                onSelect={handleAssetSelect}
                loading={loading}
                error={assetLoadError}
                disabled={assetSelectorBusy}
                showAllActive={showAllActiveAssets}
                activeAssetCount={activeAssets.length}
                onShowAllActive={canViewAssetMaster ? handleShowAllActiveAssets : undefined}
                onShowValidatedOnly={canViewAssetMaster ? handleShowValidatedOnly : undefined}
                onGoToAssetMaster={canViewAssetMaster ? handleGoToAssetMaster : undefined}
              />
            </Card>
            {selectedAsset ? (
              <ReviewHistoryTable
                jobs={jobs}
                reports={reports}
                title="Progress Review"
                description="Drafts and QA decisions in progress, with scheduled audit trail reviews highlighted by run date and running time."
                emptyMessage="No pending review reports found for this asset."
                statusFilter={(status) => isProgressReviewReportStatus(status, canSubmitReport, canDecideReport)}
                showRunSource
                onView={handleViewHistory}
              />
            ) : (
              !loading && !assetLoadError && selectableAssets.length > 0 ? (
                <Card className="rounded-lg border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  Select an asset to view pending review reports.
                </Card>
              ) : null
            )}
          </div>
        ) : null}

        {activeTab === "history" && canViewAuditReview ? (
          <div className="space-y-5">
            <Card className="rounded-lg border-slate-200 bg-white p-5 shadow-sm">
              <AssetSelector
                assets={selectableAssets}
                selectedAssetId={selectedAssetId}
                onSelect={handleAssetSelect}
                loading={loading}
                error={assetLoadError}
                disabled={assetSelectorBusy}
                showAllActive={showAllActiveAssets}
                activeAssetCount={activeAssets.length}
                onShowAllActive={canViewAssetMaster ? handleShowAllActiveAssets : undefined}
                onShowValidatedOnly={canViewAssetMaster ? handleShowValidatedOnly : undefined}
                onGoToAssetMaster={canViewAssetMaster ? handleGoToAssetMaster : undefined}
              />
            </Card>
            {selectedAsset ? (
              <ReviewHistoryTable
                jobs={jobs}
                reports={reports}
                statusFilter={isHistoricalReviewReportStatus}
                onView={handleViewHistory}
                onDownload={canExportReport ? (reportId) => void handleDownloadPdf(reportId) : undefined}
              />
            ) : (
              !loading && !assetLoadError && selectableAssets.length > 0 ? (
                <Card className="rounded-lg border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                  Select an asset to view closed reviews.
                </Card>
              ) : null
            )}
          </div>
        ) : null}

        {activeTab === "schedule" && canViewSchedule ? (
          <div className="space-y-5">
            <Card className="rounded-lg border-slate-200 bg-white p-5 shadow-sm">
              <AssetSelector
                assets={selectableAssets}
                selectedAssetId={selectedAssetId}
                onSelect={handleAssetSelect}
                loading={loading}
                error={assetLoadError}
                disabled={assetSelectorBusy}
                showAllActive={showAllActiveAssets}
                activeAssetCount={activeAssets.length}
                onShowAllActive={canViewAssetMaster ? handleShowAllActiveAssets : undefined}
                onShowValidatedOnly={canViewAssetMaster ? handleShowValidatedOnly : undefined}
                onGoToAssetMaster={canViewAssetMaster ? handleGoToAssetMaster : undefined}
              />
            </Card>
            {!selectedAsset ? (
              <Card className="rounded-lg border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                Select an asset to view or configure its periodic review schedule.
              </Card>
            ) : (
              <ScheduleSetupPanel
                asset={selectedAsset}
                schedule={currentSchedule}
                form={scheduleForm}
                metadata={metadata}
                jobs={jobs}
                reports={reports}
                saving={savingSchedule}
                running={runningSchedule}
                canCreateSchedule={canCreateSchedule}
                canUpdateSchedule={canUpdateSchedule}
                canRunSchedule={canRunSchedule}
                editing={scheduleConfigEditing}
                lastResult={lastScheduleResult}
                onChange={updateScheduleForm}
                onSave={() => void handleSaveSchedule()}
                onRunNow={() => void handleRunScheduleNow()}
                onDisable={() => void handleDisableSchedule()}
                onEdit={() => setScheduleConfigEditing(true)}
              />
            )}
          </div>
        ) : null}
      </main>

      {canRunReviewPipeline ? <RunReviewDialog
        open={runDialogOpen}
        asset={selectedAsset}
        metadata={metadata}
        jobs={jobs}
        creating={running}
        onClose={() => setRunDialogOpen(false)}
        onRun={handleRunReview}
        onViewExisting={(jobId) => {
          setRunDialogOpen(false);
          void handleViewHistory(jobId);
        }}
      /> : null}

      <Dialog open={submitReviewOpen} onOpenChange={(open) => (!open && !submittingReport ? setSubmitReviewOpen(false) : undefined)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{submitDialogIsResubmission ? "Resubmit for QA Review" : "Submit for QA Review"}</DialogTitle>
            <DialogDescription>
              {submitDialogIsResubmission
                ? "Send the updated periodic review report back to QA Validation Manager."
                : "Submit this draft periodic review report for QA approval."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="periodic-review-submission-notes">
              Submission notes
            </label>
            <Textarea
              id="periodic-review-submission-notes"
              value={submissionNotes}
              onChange={(event) => setSubmissionNotes(event.target.value)}
              placeholder="Please review the draft audit trail report."
              disabled={submittingReport}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSubmitReviewOpen(false)} disabled={submittingReport}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSubmitForApproval()} disabled={submittingReport}>
              {submittingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitDialogIsResubmission ? "Resubmit" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReadOnlyReviewDialog
        runtime={historyRuntime}
        open={historyOpen}
        canViewFindings={canViewFindings}
        canViewRecords={canViewRecords}
        canExport={canExportReport}
        canApprove={canApproveReport}
        canReject={canRejectReport}
        canRequestChanges={canRequestReportChanges}
        canSubmit={canSubmitReport}
        canGenerateDraft={canGenerateReport}
        actionLoading={historyReportAction}
        generatingDraft={historyGeneratingDraftReport}
        downloadingReport={downloadingReport}
        onGenerateDraft={() => void handleHistoryGenerateDraftReport()}
        onDownloadReport={() => void handleDownloadPdf(historyRuntime?.report?.report_id)}
        onSubmitReview={handleHistorySubmitForReview}
        onDecision={handleHistoryReportDecision}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
