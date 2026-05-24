import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { SupplierRecord } from "../../../services/supplier.service";
import {
  addSupplierEvaluationResponses,
  bulkSaveSupplierRequirementResponses,
  createEvaluationRequirement,
  createSupplierResponseDocument,
  deleteEvaluationRequirement,
  deleteSupplierResponseDocument,
  EvaluationRequirementItemRecord,
  getSupplierEvaluation,
  getSupplierEvaluationAnalysis,
  getSupplierEvaluationComparison,
  getSupplierEvaluationRequirements,
  getSupplierEvaluationResponse,
  getSupplierEvaluationResponses,
  getSupplierResponseRequirements,
  lockSupplierEvaluation,
  openSupplierEvaluation,
  runSupplierEvaluationAnalysis,
  seedSupplierEvaluationRequirements,
  submitSupplierEvaluationResponse,
  SupplierComparisonSummaryRecord,
  SupplierEvaluationAnalysisRecord,
  SupplierEvaluationComparisonRecord,
  SupplierEvaluationRecord,
  SupplierEvaluationResponseDetailRecord,
  SupplierEvaluationResponseRecord,
  SupplierRequirementAnalysisRecord,
  SupplierRequirementResponseMatrixRowRecord,
  SupplierResponseDocumentRecord,
  updateEvaluationRequirement,
  updateSupplierEvaluation,
  updateSupplierEvaluationResponse,
} from "../../../services/supplier-evaluation.service";
import { useCurrentActor } from "../../auth/useCurrentActor";
import { PermissionGuard } from "../../auth/PermissionGuard";
import { ConfirmStrip, EmptyState, StatusBadge, WorkflowStepper, type WorkflowStep } from "../foundation";
import { LookupOption } from "../../services/lookupValue.service";
import { navigateToDocumentPortal } from "../../utils/moduleNavigation";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input, SearchInput } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Textarea } from "../ui/textarea";
import { DocumentUploadUrlField } from "./DocumentUploadUrlField";
import { OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS } from "./documentLinkForm.shared";
import { buildSupplierEvaluationUrsOptions } from "./SupplierEvaluationSetupPanel";
import {
  canAddSuppliersToEvaluation,
  canEditEvaluation,
  canEditSupplierResponse,
  canSubmitSupplierResponse,
  formatEvaluationDate,
  formatEvaluationUrsLabel,
  formatSupplierEvaluationStatus,
  formatSupplierRequirementFitStatus,
  formatSupplierResponseDocumentType,
  formatSupplierResponseStatus,
  getSafeAccessUrl,
  getSupplierRequirementFitStatusBadgeClass,
  getSupplierResponseStatusBadgeClass,
  isHttpUrl,
  mapSupplierEvaluationAxiosError,
  normalizeDateTimeInput,
  SUPPLIER_REQUIREMENT_FIT_STATUS_OPTIONS,
  SUPPLIER_RESPONSE_DOCUMENT_TYPE_OPTIONS,
} from "./supplierEvaluationForm.shared";
import { getReleasesByAssetId } from "../../../services/release.service";

interface SupplierEvaluationWorkspaceProps {
  evaluationId: string;
  suppliers: SupplierRecord[];
  sourceSystemOptions?: LookupOption[];
  onBack: () => void;
  onChanged: () => Promise<void> | void;
}

type WorkspaceStepKey = "setup" | "requirements" | "responses" | "evidence" | "analysis" | "close";

interface RequirementFormState {
  requirement_key: string;
  requirement_section: string;
  requirement_text: string;
  requirement_order: string;
  source_reference: string;
}

interface ResponseHeaderFormState {
  quotation_reference: string;
  notes: string;
}

interface DocumentFormState {
  document_type: string;
  source_system: string;
  external_document_id: string;
  document_name: string;
  document_version: string;
  upload_dt: string;
  access_url: string;
  source_reference: string;
  notes: string;
}

const WORKFLOW_STEPS: Array<{ key: WorkspaceStepKey; label: string; description: string }> = [
  { key: "setup", label: "Setup", description: "Evaluation metadata and participants" },
  { key: "requirements", label: "Requirements", description: "URS requirement baseline" },
  { key: "responses", label: "Supplier Responses", description: "Supplier fit matrix" },
  { key: "evidence", label: "Evidence", description: "Supplier response documents" },
  { key: "analysis", label: "Analysis / Scoring", description: "AI comparison and findings" },
  { key: "close", label: "Lock / Close", description: "Lifecycle controls" },
];

const EMPTY_REQUIREMENT_FORM: RequirementFormState = {
  requirement_key: "",
  requirement_section: "",
  requirement_text: "",
  requirement_order: "",
  source_reference: "",
};

const EMPTY_RESPONSE_FORM: ResponseHeaderFormState = {
  quotation_reference: "",
  notes: "",
};

const createEmptyDocumentForm = (sourceSystem: string): DocumentFormState => ({
  document_type: "QUOTATION",
  source_system: sourceSystem,
  external_document_id: "",
  document_name: "",
  document_version: "",
  upload_dt: "",
  access_url: "",
  source_reference: "",
  notes: "",
});

const buildRequirementFormFromItem = (
  item?: EvaluationRequirementItemRecord | null,
  nextOrder?: number,
): RequirementFormState => ({
  requirement_key: item?.requirement_key ?? "",
  requirement_section: item?.requirement_section ?? "",
  requirement_text: item?.requirement_text ?? "",
  requirement_order:
    item?.requirement_order !== undefined && item?.requirement_order !== null
      ? String(item.requirement_order)
      : nextOrder !== undefined
        ? String(nextOrder)
        : "",
  source_reference: item?.source_reference ?? "",
});

const normalizeRequirementDraft = (row: SupplierRequirementResponseMatrixRowRecord) => ({
  requirement_item_id: row.requirement_item_id,
  fit_status: row.fit_status ?? null,
  supplier_response_text: row.supplier_response_text?.trim() || null,
  evidence_reference: row.evidence_reference?.trim() || null,
  notes: row.notes?.trim() || null,
});

const requirementsMatch = (
  left: SupplierRequirementResponseMatrixRowRecord,
  right: SupplierRequirementResponseMatrixRowRecord | undefined,
) => {
  if (!right) return false;
  const nextLeft = normalizeRequirementDraft(left);
  const nextRight = normalizeRequirementDraft(right);
  return (
    nextLeft.fit_status === nextRight.fit_status &&
    nextLeft.supplier_response_text === nextRight.supplier_response_text &&
    nextLeft.evidence_reference === nextRight.evidence_reference &&
    nextLeft.notes === nextRight.notes
  );
};

const formatAnalysisStatus = (status?: string | null): string => {
  switch (status) {
    case "RUNNING":
      return "Running";
    case "COMPLETED":
      return "Completed";
    case "FAILED":
      return "Failed";
    case "NOT_STARTED":
      return "Not Started";
    default:
      return status || "Not Started";
  }
};

const getAnalysisStatusBadgeClass = (status?: string | null): string => {
  switch (status) {
    case "RUNNING":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "COMPLETED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "FAILED":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
};

const formatScore = (value?: number | null): string => {
  if (value === undefined || value === null || Number.isNaN(value)) return "-";
  return value.toFixed(1);
};

const getSummaryString = (
  source: Record<string, unknown> | null | undefined,
  path: string[],
): string | null => {
  let current: unknown = source;
  for (const segment of path) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" && current.trim() ? current : null;
};

const csvValue = (value: string | number | null | undefined): string => {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const safeFileSegment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "supplier-evaluation";

const downloadTextFile = (fileName: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const buildRequirementBaselineCsv = (
  evaluation: SupplierEvaluationRecord,
  requirements: EvaluationRequirementItemRecord[],
): string => {
  const rows = [
    ["Evaluation", evaluation.evaluation_name],
    ["Asset", `${evaluation.asset_name || ""}${evaluation.asset_code ? ` (${evaluation.asset_code})` : ""}`],
    ["URS", evaluation.urs_title || ""],
    [],
    ["Order", "Section", "Key", "Requirement Text", "Source Reference"],
    ...requirements.map((requirement) => [
      requirement.requirement_order ?? "",
      requirement.requirement_section ?? "",
      requirement.requirement_key ?? "",
      requirement.requirement_text,
      requirement.source_reference ?? "",
    ]),
  ];
  return rows.map((row) => row.map(csvValue).join(",")).join("\n");
};

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 break-words text-sm font-medium text-slate-900">{value || "-"}</div>
    </div>
  );
}

function EvaluationStatusBadge({ status }: { status?: string | null }) {
  const kind = status === "CLOSED" ? "inactive" : status === "LOCKED" || status === "DRAFT" ? "pending" : "active";
  return (
    <span className="inline-flex items-center gap-2">
      <StatusBadge status={kind} title={formatSupplierEvaluationStatus(status)} />
      <span className="text-xs font-medium text-slate-700">{formatSupplierEvaluationStatus(status)}</span>
    </span>
  );
}

function ResponseStatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge variant="outline" className={getSupplierResponseStatusBadgeClass(status)}>
      {formatSupplierResponseStatus(status)}
    </Badge>
  );
}

function FitStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-sm text-slate-500">Not answered</span>;
  return (
    <Badge variant="outline" className={getSupplierRequirementFitStatusBadgeClass(status)}>
      {formatSupplierRequirementFitStatus(status)}
    </Badge>
  );
}

export function SupplierEvaluationWorkspace({
  evaluationId,
  suppliers,
  sourceSystemOptions = [],
  onBack,
  onChanged,
}: SupplierEvaluationWorkspaceProps) {
  const currentActor = useCurrentActor();
  const actor = currentActor.auditName ?? currentActor.displayName;
  const availableSourceSystemOptions = useMemo(
    () => (sourceSystemOptions.length > 0 ? sourceSystemOptions : OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS),
    [sourceSystemOptions],
  );

  const [activeStep, setActiveStep] = useState<WorkspaceStepKey>("setup");
  const [evaluation, setEvaluation] = useState<SupplierEvaluationRecord | null>(null);
  const [responses, setResponses] = useState<SupplierEvaluationResponseRecord[]>([]);
  const [requirements, setRequirements] = useState<EvaluationRequirementItemRecord[]>([]);
  const [analysis, setAnalysis] = useState<SupplierEvaluationAnalysisRecord | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<SupplierEvaluationAnalysisRecord[]>([]);
  const [comparison, setComparison] = useState<SupplierEvaluationComparisonRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [requirementBusy, setRequirementBusy] = useState(false);
  const [setupEditing, setSetupEditing] = useState(false);
  const [setupName, setSetupName] = useState("");
  const [setupUrsId, setSetupUrsId] = useState("");
  const [setupUrsOptions, setSetupUrsOptions] = useState<Awaited<ReturnType<typeof buildSupplierEvaluationUrsOptions>>>([]);
  const [setupOptionsLoading, setSetupOptionsLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [showAddSuppliers, setShowAddSuppliers] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [editingRequirement, setEditingRequirement] = useState<EvaluationRequirementItemRecord | null>(null);
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [requirementForm, setRequirementForm] = useState<RequirementFormState>(EMPTY_REQUIREMENT_FORM);
  const [requirementFormError, setRequirementFormError] = useState<string | null>(null);
  const [requirementToDelete, setRequirementToDelete] = useState<EvaluationRequirementItemRecord | null>(null);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [responseDetail, setResponseDetail] = useState<SupplierEvaluationResponseDetailRecord | null>(null);
  const [responseForm, setResponseForm] = useState<ResponseHeaderFormState>(EMPTY_RESPONSE_FORM);
  const [initialResponseForm, setInitialResponseForm] = useState<ResponseHeaderFormState>(EMPTY_RESPONSE_FORM);
  const [matrixRows, setMatrixRows] = useState<SupplierRequirementResponseMatrixRowRecord[]>([]);
  const [initialMatrixRows, setInitialMatrixRows] = useState<SupplierRequirementResponseMatrixRowRecord[]>([]);
  const [responseLoading, setResponseLoading] = useState(false);
  const [responseSaving, setResponseSaving] = useState(false);
  const [responseSearch, setResponseSearch] = useState("");
  const [fitFilter, setFitFilter] = useState("ALL");
  const [responseActionId, setResponseActionId] = useState<string | null>(null);
  const [documentForm, setDocumentForm] = useState<DocumentFormState>(
    createEmptyDocumentForm(availableSourceSystemOptions[0]?.code ?? ""),
  );
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<SupplierResponseDocumentRecord | null>(null);
  const [lifecycleAction, setLifecycleAction] = useState<"open" | "lock" | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const [evaluationDetail, responseRows, requirementRows, analysisRows, comparisonResult] = await Promise.all([
        getSupplierEvaluation(evaluationId),
        getSupplierEvaluationResponses(evaluationId),
        getSupplierEvaluationRequirements(evaluationId),
        getSupplierEvaluationAnalysis(evaluationId),
        getSupplierEvaluationComparison(evaluationId),
      ]);
      setEvaluation(evaluationDetail);
      setResponses(responseRows);
      setRequirements(requirementRows);
      setAnalysis(analysisRows.latest ?? null);
      setAnalysisHistory(analysisRows.history ?? []);
      setComparison(comparisonResult);
      setSelectedResponseId((current) => current ?? responseRows[0]?.response_id ?? null);
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setLoading(false);
    }
  }, [evaluationId]);

  const loadSelectedResponse = useCallback(async () => {
    if (!selectedResponseId) {
      setResponseDetail(null);
      setMatrixRows([]);
      setInitialMatrixRows([]);
      setResponseForm(EMPTY_RESPONSE_FORM);
      setInitialResponseForm(EMPTY_RESPONSE_FORM);
      return;
    }

    setResponseLoading(true);
    try {
      const [detail, rows] = await Promise.all([
        getSupplierEvaluationResponse(selectedResponseId),
        getSupplierResponseRequirements(selectedResponseId),
      ]);
      const nextForm = {
        quotation_reference: detail.quotation_reference ?? "",
        notes: detail.notes ?? "",
      };
      setResponseDetail(detail);
      setResponseForm(nextForm);
      setInitialResponseForm(nextForm);
      setMatrixRows(rows);
      setInitialMatrixRows(rows);
      setDocumentForm((previous) => ({
        ...createEmptyDocumentForm(previous.source_system || availableSourceSystemOptions[0]?.code || ""),
        source_system: previous.source_system || availableSourceSystemOptions[0]?.code || "",
      }));
      setDocumentError(null);
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setResponseLoading(false);
    }
  }, [availableSourceSystemOptions, selectedResponseId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    void loadSelectedResponse();
  }, [loadSelectedResponse]);

  useEffect(() => {
    setDocumentForm((previous) => ({
      ...previous,
      source_system: previous.source_system || availableSourceSystemOptions[0]?.code || "",
    }));
  }, [availableSourceSystemOptions]);

  const selectedSupplierSet = useMemo(() => new Set(selectedSupplierIds), [selectedSupplierIds]);
  const existingSupplierIds = useMemo(() => new Set(responses.map((response) => response.supplier_id)), [responses]);
  const availableSuppliers = useMemo(
    () => suppliers.filter((supplier) => !existingSupplierIds.has(supplier.supplier_id)),
    [existingSupplierIds, suppliers],
  );
  const pendingResponseCount = useMemo(
    () =>
      responses.filter(
        (response) => response.submission_status !== "SUBMITTED" && response.submission_status !== "LOCKED",
      ).length,
    [responses],
  );
  const submittedResponseCount = useMemo(
    () =>
      responses.filter(
        (response) => response.submission_status === "SUBMITTED" || response.submission_status === "LOCKED",
      ).length,
    [responses],
  );
  const lockedResponseCount = useMemo(
    () => responses.filter((response) => response.submission_status === "LOCKED").length,
    [responses],
  );
  const documentCount = useMemo(
    () => responses.reduce((count, response) => count + response.document_count, 0),
    [responses],
  );
  const nextRequirementOrder = useMemo(() => {
    const orderValues = requirements
      .map((item) => item.requirement_order)
      .filter((value): value is number => typeof value === "number");
    return (orderValues.length > 0 ? Math.max(...orderValues) : 0) + 1;
  }, [requirements]);
  const canManageRequirements = useMemo(
    () =>
      evaluation?.status === "DRAFT" &&
      responses.every((response) => response.submission_status === "NOT_STARTED"),
    [evaluation?.status, responses],
  );
  const canEditSelectedResponse = canEditSupplierResponse(evaluation?.status, responseDetail?.submission_status);
  const canSubmitSelectedResponse = canSubmitSupplierResponse(evaluation?.status, responseDetail?.submission_status);
  const comparisonSummaries = useMemo<SupplierComparisonSummaryRecord[]>(
    () =>
      [...(comparison?.comparison_summaries ?? analysis?.comparison_summaries ?? [])].sort(
        (left, right) => left.recommendation_rank - right.recommendation_rank,
      ),
    [analysis?.comparison_summaries, comparison?.comparison_summaries],
  );
  const requirementAnalyses = useMemo<SupplierRequirementAnalysisRecord[]>(
    () => comparison?.requirement_analyses ?? analysis?.requirement_analyses ?? [],
    [analysis?.requirement_analyses, comparison?.requirement_analyses],
  );
  const latestAnalysisStatus = comparison?.status ?? analysis?.status ?? "NOT_STARTED";
  const analysisInsight =
    getSummaryString(comparison?.summary_json, ["executive_summary"]) ??
    getSummaryString(analysis?.summary_json, ["executive_summary"]) ??
    getSummaryString(analysis?.summary_json, ["recommendation"]);

  const initialMatrixMap = useMemo(
    () => new Map(initialMatrixRows.map((row) => [row.requirement_item_id, row])),
    [initialMatrixRows],
  );
  const responseDirty =
    responseForm.quotation_reference.trim() !== initialResponseForm.quotation_reference.trim() ||
    responseForm.notes.trim() !== initialResponseForm.notes.trim();
  const matrixDirty = useMemo(
    () => matrixRows.some((row) => !requirementsMatch(row, initialMatrixMap.get(row.requirement_item_id))),
    [initialMatrixMap, matrixRows],
  );
  const filteredMatrixRows = useMemo(() => {
    const query = responseSearch.trim().toLowerCase();
    return matrixRows.filter((row) => {
      const matchesSearch =
        !query ||
        row.requirement_text.toLowerCase().includes(query) ||
        (row.requirement_section ?? "").toLowerCase().includes(query) ||
        (row.requirement_key ?? "").toLowerCase().includes(query);
      const matchesFit = fitFilter === "ALL" || (row.fit_status ?? "") === fitFilter;
      return matchesSearch && matchesFit;
    });
  }, [fitFilter, matrixRows, responseSearch]);

  const workflowSteps = useMemo<WorkflowStep[]>(
    () =>
      WORKFLOW_STEPS.map((step) => {
        let status: WorkflowStep["status"] = step.key === activeStep ? "active" : "pending";
        if (step.key === "setup" && evaluation) status = "complete";
        if (step.key === "requirements" && requirements.length > 0) status = "complete";
        if (step.key === "responses" && responses.length > 0 && pendingResponseCount === 0) status = "complete";
        if (step.key === "evidence" && documentCount > 0) status = "complete";
        if (step.key === "analysis" && latestAnalysisStatus === "COMPLETED") status = "complete";
        if (step.key === "analysis" && latestAnalysisStatus === "FAILED") status = "error";
        if (step.key === "close" && (evaluation?.status === "LOCKED" || evaluation?.status === "CLOSED")) {
          status = "complete";
        }
        if (step.key === activeStep) status = status === "complete" ? "active" : status;
        return { ...step, status };
      }),
    [activeStep, documentCount, evaluation, latestAnalysisStatus, pendingResponseCount, requirements.length, responses.length],
  );

  const refreshAll = async () => {
    await loadWorkspace();
    await loadSelectedResponse();
    await onChanged();
  };

  const startSetupEdit = async () => {
    if (!evaluation || !canEditEvaluation(evaluation.status)) return;
    setSetupEditing(true);
    setSetupName(evaluation.evaluation_name ?? "");
    setSetupUrsId(evaluation.urs_document_id ?? "");
    setSetupError(null);
    setSetupOptionsLoading(true);
    try {
      const releases = await getReleasesByAssetId(evaluation.asset_uuid);
      setSetupUrsOptions(await buildSupplierEvaluationUrsOptions(evaluation.asset_uuid, releases));
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
      setSetupUrsOptions([]);
    } finally {
      setSetupOptionsLoading(false);
    }
  };

  const saveSetup = async () => {
    if (!evaluation || actionBusy) return;
    const normalizedName = setupName.trim();
    if (!normalizedName) {
      setSetupError("Evaluation title is required");
      return;
    }
    if (!setupUrsId) {
      setSetupError("Select an approved URS baseline");
      return;
    }

    setActionBusy(true);
    setSetupError(null);
    try {
      await updateSupplierEvaluation(evaluation.evaluation_id, {
        modified_by: actor,
        evaluation_name: normalizedName,
        ...(evaluation.status === "DRAFT" ? { urs_document_id: setupUrsId } : {}),
      });
      setSetupEditing(false);
      toast.success("Evaluation setup updated");
      await refreshAll();
    } catch (error) {
      const message = mapSupplierEvaluationAxiosError(error);
      setSetupError(message);
      toast.error(message);
    } finally {
      setActionBusy(false);
    }
  };

  const toggleSupplierSelection = (supplierId: string) => {
    setSelectedSupplierIds((previous) =>
      previous.includes(supplierId) ? previous.filter((item) => item !== supplierId) : [...previous, supplierId],
    );
  };

  const handleAddSuppliers = async () => {
    if (!evaluation || selectedSupplierIds.length === 0 || actionBusy) return;
    setActionBusy(true);
    try {
      const result = await addSupplierEvaluationResponses(evaluation.evaluation_id, {
        supplier_ids: selectedSupplierIds,
        created_by: actor,
      });
      setSelectedSupplierIds([]);
      setShowAddSuppliers(false);
      toast.success(
        result.created_count === 1
          ? "1 supplier response row was created"
          : `${result.created_count} supplier response rows were created`,
      );
      await refreshAll();
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setActionBusy(false);
    }
  };

  const startRequirementCreate = () => {
    setEditingRequirement(null);
    setRequirementForm(buildRequirementFormFromItem(null, nextRequirementOrder));
    setRequirementFormError(null);
    setShowRequirementForm(true);
  };

  const startRequirementEdit = (requirement: EvaluationRequirementItemRecord) => {
    setEditingRequirement(requirement);
    setRequirementForm(buildRequirementFormFromItem(requirement));
    setRequirementFormError(null);
    setShowRequirementForm(true);
  };

  const resetRequirementForm = () => {
    setEditingRequirement(null);
    setRequirementForm(EMPTY_REQUIREMENT_FORM);
    setRequirementFormError(null);
    setShowRequirementForm(false);
  };

  const handleSeedRequirements = async () => {
    if (!evaluation || requirementBusy) return;
    setRequirementBusy(true);
    try {
      const result = await seedSupplierEvaluationRequirements(evaluation.evaluation_id, { created_by: actor });
      toast.success(
        result.created_count === 0
          ? "No new requirement candidates were seeded"
          : result.created_count === 1
            ? "1 requirement was seeded from the approved URS"
            : `${result.created_count} requirements were seeded from the approved URS`,
      );
      await refreshAll();
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setRequirementBusy(false);
    }
  };

  const handleSaveRequirement = async () => {
    if (!evaluation || requirementBusy) return;
    if (!requirementForm.requirement_text.trim()) {
      setRequirementFormError("Requirement text is required");
      return;
    }

    const parsedOrder = requirementForm.requirement_order.trim()
      ? Number(requirementForm.requirement_order.trim())
      : null;
    if (parsedOrder !== null && (!Number.isInteger(parsedOrder) || parsedOrder < 0)) {
      setRequirementFormError("Requirement order must be a whole number greater than or equal to zero");
      return;
    }

    setRequirementBusy(true);
    setRequirementFormError(null);
    try {
      if (editingRequirement) {
        await updateEvaluationRequirement(editingRequirement.requirement_item_id, {
          modified_by: actor,
          requirement_key: requirementForm.requirement_key.trim() || null,
          requirement_section: requirementForm.requirement_section.trim() || null,
          requirement_text: requirementForm.requirement_text.trim(),
          requirement_order: parsedOrder,
          source_reference: requirementForm.source_reference.trim() || null,
        });
        toast.success("Requirement row updated");
      } else {
        await createEvaluationRequirement(evaluation.evaluation_id, {
          created_by: actor,
          requirement_key: requirementForm.requirement_key.trim() || null,
          requirement_section: requirementForm.requirement_section.trim() || null,
          requirement_text: requirementForm.requirement_text.trim(),
          requirement_order: parsedOrder,
          source_reference: requirementForm.source_reference.trim() || null,
        });
        toast.success("Requirement row created");
      }
      resetRequirementForm();
      await refreshAll();
    } catch (error) {
      const message = mapSupplierEvaluationAxiosError(error);
      setRequirementFormError(message);
      toast.error(message);
    } finally {
      setRequirementBusy(false);
    }
  };

  const handleDeleteRequirement = async () => {
    if (!requirementToDelete || requirementBusy) return;
    setRequirementBusy(true);
    try {
      await deleteEvaluationRequirement(requirementToDelete.requirement_item_id);
      setRequirementToDelete(null);
      toast.success("Requirement row deleted");
      await refreshAll();
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setRequirementBusy(false);
    }
  };

  const handleDownloadRequirementBaseline = () => {
    if (!evaluation || requirements.length === 0) {
      toast("No requirement baseline rows are available to download.");
      return;
    }
    const fileName = `${safeFileSegment(evaluation.evaluation_name)}-requirement-baseline.csv`;
    downloadTextFile(fileName, buildRequirementBaselineCsv(evaluation, requirements), "text/csv;charset=utf-8");
  };

  const updateMatrixDraft = (
    requirementItemId: string,
    field: "fit_status" | "supplier_response_text" | "evidence_reference" | "notes",
    value: string,
  ) => {
    setMatrixRows((previous) =>
      previous.map((row) =>
        row.requirement_item_id === requirementItemId
          ? {
              ...row,
              [field]: value || null,
            }
          : row,
      ),
    );
  };

  const handleSaveResponse = async ({ showToast = true }: { showToast?: boolean } = {}): Promise<boolean> => {
    if (!selectedResponseId || !canEditSelectedResponse || responseSaving || (!responseDirty && !matrixDirty)) {
      return true;
    }

    setResponseSaving(true);
    try {
      if (responseDirty) {
        const updated = await updateSupplierEvaluationResponse(selectedResponseId, {
          modified_by: actor,
          quotation_reference: responseForm.quotation_reference.trim() || null,
          notes: responseForm.notes.trim() || null,
        });
        const nextForm = {
          quotation_reference: updated.quotation_reference ?? "",
          notes: updated.notes ?? "",
        };
        setResponseDetail(updated);
        setResponseForm(nextForm);
        setInitialResponseForm(nextForm);
      }
      if (matrixDirty) {
        const changedRows = matrixRows
          .filter((row) => !requirementsMatch(row, initialMatrixMap.get(row.requirement_item_id)))
          .map((row) => normalizeRequirementDraft(row));
        if (changedRows.length > 0) {
          const updatedRows = await bulkSaveSupplierRequirementResponses(selectedResponseId, {
            modified_by: actor,
            items: changedRows,
          });
          setMatrixRows(updatedRows);
          setInitialMatrixRows(updatedRows);
        }
      }
      if (showToast) toast.success("Supplier response saved");
      await refreshAll();
      return true;
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
      return false;
    } finally {
      setResponseSaving(false);
    }
  };

  const handleSubmitSelectedResponse = async () => {
    if (!selectedResponseId || !canSubmitSelectedResponse) return;
    setResponseActionId(selectedResponseId);
    try {
      const saved = await handleSaveResponse({ showToast: false });
      if (!saved) return;
      await submitSupplierEvaluationResponse(selectedResponseId, { action_by: actor });
      toast.success("Supplier response submitted");
      await refreshAll();
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setResponseActionId(null);
    }
  };

  const handleAddDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedResponseId || !canEditSelectedResponse || documentBusy) return;
    if (!documentForm.document_type) {
      setDocumentError("Document type is required");
      return;
    }
    if (!documentForm.document_name.trim()) {
      setDocumentError("Document name is required");
      return;
    }
    if (!documentForm.upload_dt.trim()) {
      setDocumentError("Upload date is required");
      return;
    }
    if (!documentForm.access_url.trim()) {
      setDocumentError("Access URL is required");
      return;
    }
    if (!isHttpUrl(documentForm.access_url.trim())) {
      setDocumentError("Access URL must start with http:// or https://");
      return;
    }

    setDocumentBusy(true);
    setDocumentError(null);
    try {
      await createSupplierResponseDocument(selectedResponseId, {
        document_type: documentForm.document_type,
        source_system: documentForm.source_system || null,
        external_document_id: documentForm.external_document_id.trim() || null,
        document_name: documentForm.document_name.trim(),
        document_version: documentForm.document_version.trim() || null,
        upload_dt: documentForm.upload_dt,
        access_url: documentForm.access_url.trim(),
        source_reference: documentForm.source_reference.trim() || null,
        notes: documentForm.notes.trim() || null,
        created_by: actor,
      });
      setDocumentForm(createEmptyDocumentForm(availableSourceSystemOptions[0]?.code ?? ""));
      toast.success("Evidence document added");
      await refreshAll();
    } catch (error) {
      const message = mapSupplierEvaluationAxiosError(error);
      setDocumentError(message);
      toast.error(message);
    } finally {
      setDocumentBusy(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete || documentBusy) return;
    setDocumentBusy(true);
    try {
      await deleteSupplierResponseDocument(documentToDelete.document_id);
      setDocumentToDelete(null);
      toast.success("Evidence document removed");
      await refreshAll();
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setDocumentBusy(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!evaluation || analysisBusy) return;
    setAnalysisBusy(true);
    try {
      const nextAnalysis = await runSupplierEvaluationAnalysis(evaluation.evaluation_id, { triggered_by: actor });
      setAnalysis(nextAnalysis);
      toast.success("Supplier evaluation analysis completed");
      await refreshAll();
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setAnalysisBusy(false);
    }
  };

  const handleLifecycleAction = async () => {
    if (!evaluation || !lifecycleAction || actionBusy) return;
    setActionBusy(true);
    try {
      if (lifecycleAction === "open") {
        await openSupplierEvaluation(evaluation.evaluation_id, { action_by: actor });
        toast.success("Evaluation opened for supplier response");
      }
      if (lifecycleAction === "lock") {
        await lockSupplierEvaluation(evaluation.evaluation_id, { action_by: actor });
        toast.success("Evaluation locked");
      }
      setLifecycleAction(null);
      await refreshAll();
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setActionBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[32rem] items-center justify-center rounded-md border border-slate-200 bg-white text-sm text-slate-500">
        Loading supplier evaluation workspace...
      </div>
    );
  }

  if (!evaluation) {
    return (
      <EmptyState
        title="Evaluation not found"
        description="The selected supplier evaluation could not be loaded."
        action={
          <Button type="button" variant="outline" onClick={onBack}>
            Back to Supplier Evaluations
          </Button>
        }
      />
    );
  }

  const selectedResponse = responses.find((response) => response.response_id === selectedResponseId) ?? null;

  const renderSetupStep = () => (
    <div className="space-y-4">
      <SectionCard
        title="Evaluation Setup"
        description="Metadata remains editable only while the evaluation is Draft or Open for Response."
        action={
          canEditEvaluation(evaluation.status) && !setupEditing ? (
            <PermissionGuard permission="ASSET_UPDATE">
              <Button type="button" size="sm" variant="outline" onClick={() => void startSetupEdit()}>
                Edit Setup
              </Button>
            </PermissionGuard>
          ) : null
        }
      >
        {setupEditing ? (
          <div className="space-y-4">
            {setupError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {setupError}
              </div>
            ) : null}
            <Input
              label="Evaluation Title"
              value={setupName}
              onChange={(event) => setSetupName(event.target.value)}
              disabled={actionBusy}
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">URS Baseline</label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-input-background px-3 text-sm"
                value={setupUrsId}
                onChange={(event) => setSetupUrsId(event.target.value)}
                disabled={actionBusy || setupOptionsLoading || evaluation.status !== "DRAFT"}
              >
                <option value="">{setupOptionsLoading ? "Loading approved baselines..." : "Select approved URS"}</option>
                {setupUrsOptions.map((option) => (
                  <option key={option.authored_document_id} value={option.authored_document_id}>
                    {formatEvaluationUrsLabel(option)}
                  </option>
                ))}
              </select>
              {evaluation.status !== "DRAFT" ? (
                <p className="text-xs text-slate-500">URS baseline changes are only allowed while Draft.</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSetupEditing(false);
                  setSetupError(null);
                }}
                disabled={actionBusy}
              >
                Cancel
              </Button>
              <PermissionGuard permission="ASSET_UPDATE">
                <Button type="button" onClick={() => void saveSetup()} disabled={actionBusy}>
                  {actionBusy ? "Saving..." : "Save Setup"}
                </Button>
              </PermissionGuard>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Evaluation Title" value={evaluation.evaluation_name} />
            <Field label="Asset" value={`${evaluation.asset_name || "-"}${evaluation.asset_code ? ` (${evaluation.asset_code})` : ""}`} />
            <Field label="Status" value={<EvaluationStatusBadge status={evaluation.status} />} />
            <Field label="URS / Authored Document" value={evaluation.urs_title || "-"} />
            <Field
              label="Release"
              value={evaluation.urs_release_version ? `Release ${evaluation.urs_release_version}` : "Asset-level URS"}
            />
            <Field label="Last Updated" value={formatEvaluationDate(evaluation.modified_dt || evaluation.created_dt)} />
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Participating Suppliers"
        description="Add supplier response rows before the evaluation is locked."
        action={
          canAddSuppliersToEvaluation(evaluation.status) ? (
            <PermissionGuard permission="ASSET_UPDATE">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowAddSuppliers((previous) => !previous)}
                disabled={actionBusy || availableSuppliers.length === 0}
              >
                Add Suppliers
              </Button>
            </PermissionGuard>
          ) : null
        }
      >
        <div className="space-y-4">
          {showAddSuppliers ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Add Participating Suppliers</p>
                  <p className="mt-1 text-xs text-slate-500">Existing supplier response rows are excluded.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowAddSuppliers(false);
                      setSelectedSupplierIds([]);
                    }}
                    disabled={actionBusy}
                  >
                    Cancel
                  </Button>
                  <PermissionGuard permission="ASSET_UPDATE">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleAddSuppliers()}
                      disabled={actionBusy || selectedSupplierIds.length === 0}
                    >
                      {actionBusy ? "Adding..." : "Add Selected"}
                    </Button>
                  </PermissionGuard>
                </div>
              </div>
              <div className="mt-4 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white">
                {availableSuppliers.length === 0 ? (
                  <EmptyState
                    title="No available suppliers"
                    description="All suppliers in supplier master are already attached to this evaluation."
                    className="border-0"
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {availableSuppliers.map((supplier) => (
                      <label
                        key={supplier.supplier_id}
                        className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                          checked={selectedSupplierSet.has(supplier.supplier_id)}
                          onChange={() => toggleSupplierSelection(supplier.supplier_id)}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-900">{supplier.supplier_name}</span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {[supplier.supplier_type || "Supplier", supplier.contact_email].filter(Boolean).join(" | ")}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {responses.length === 0 ? (
            <EmptyState title="No supplier responses" description="Add suppliers to create response rows." />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {responses.map((response) => (
                <button
                  key={response.response_id}
                  type="button"
                  className="rounded-md border border-slate-200 bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/40"
                  onClick={() => {
                    setSelectedResponseId(response.response_id);
                    setActiveStep("responses");
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{response.supplier_name || "-"}</p>
                      <p className="mt-1 text-xs text-slate-500">{response.supplier_type || "Supplier"}</p>
                    </div>
                    <ResponseStatusBadge status={response.submission_status} />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    {response.document_count} evidence document{response.document_count === 1 ? "" : "s"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );

  const renderRequirementsStep = () => (
    <SectionCard
      title="Requirement Matrix"
      description="The baseline is seeded from the approved URS and can be manually refined before supplier response capture starts."
      action={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadRequirementBaseline}
            disabled={requirements.length === 0}
          >
            Download Baseline
          </Button>
          {canManageRequirements ? (
            <PermissionGuard permission="ASSET_UPDATE">
              <Button type="button" variant="outline" size="sm" onClick={() => void handleSeedRequirements()} disabled={requirementBusy}>
                {requirementBusy ? "Seeding..." : "Seed From URS"}
              </Button>
              <Button type="button" size="sm" onClick={startRequirementCreate} disabled={requirementBusy}>
                Add Requirement
              </Button>
            </PermissionGuard>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        {requirementToDelete ? (
          <ConfirmStrip
            tone="danger"
            title="Delete requirement row?"
            message="Any draft structured responses tied to this row will also be removed by the existing API."
            confirmLabel="Delete"
            disabled={requirementBusy}
            onCancel={() => setRequirementToDelete(null)}
            onConfirm={() => void handleDeleteRequirement()}
          />
        ) : null}

        {requirements.length === 0 ? (
          <EmptyState title="No requirements" description="Seed from the approved URS or add requirement rows manually." />
        ) : (
          <Table className="min-w-[64rem] table-fixed" containerClassName="max-h-none overflow-x-auto overflow-y-visible">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-20 font-semibold">Order</TableHead>
                <TableHead className="w-56 font-semibold">Section / Key</TableHead>
                <TableHead className="font-semibold">Requirement Text</TableHead>
                <TableHead className="w-64 font-semibold">Source</TableHead>
                <TableHead className="w-32 font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requirements.map((requirement) => (
                <TableRow key={requirement.requirement_item_id} className="hover:bg-slate-50">
                  <TableCell className="w-20 align-top text-slate-700">{requirement.requirement_order ?? "-"}</TableCell>
                  <TableCell className="w-56 align-top whitespace-normal break-words">
                    <div className="font-medium text-slate-900">{requirement.requirement_section || "General"}</div>
                    <p className="mt-1 text-xs text-slate-500">{requirement.requirement_key || "No key"}</p>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal break-words text-slate-700">
                    {requirement.requirement_text}
                  </TableCell>
                  <TableCell className="w-64 align-top whitespace-normal break-words text-slate-600">
                    {requirement.source_reference || "-"}
                  </TableCell>
                  <TableCell className="w-32 align-top text-right">
                    {canManageRequirements ? (
                      <PermissionGuard permission="ASSET_UPDATE">
                        <div className="flex items-center justify-end gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => startRequirementEdit(requirement)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setRequirementToDelete(requirement)}
                          >
                            Delete
                          </Button>
                        </div>
                      </PermissionGuard>
                    ) : (
                      <span className="text-xs text-slate-500">Controlled</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {showRequirementForm ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {editingRequirement ? "Edit Requirement" : "Add Requirement"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={resetRequirementForm} disabled={requirementBusy}>
                  Cancel
                </Button>
                <PermissionGuard permission="ASSET_UPDATE">
                  <Button type="button" size="sm" onClick={() => void handleSaveRequirement()} disabled={requirementBusy}>
                    {requirementBusy ? "Saving..." : "Save Requirement"}
                  </Button>
                </PermissionGuard>
              </div>
            </div>
            {requirementFormError ? (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {requirementFormError}
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Requirement ID"
                value={requirementForm.requirement_key}
                onChange={(event) => setRequirementForm((previous) => ({ ...previous, requirement_key: event.target.value }))}
                disabled={requirementBusy}
              />
              <Input
                label="Section"
                value={requirementForm.requirement_section}
                onChange={(event) =>
                  setRequirementForm((previous) => ({ ...previous, requirement_section: event.target.value }))
                }
                disabled={requirementBusy}
              />
              <Input
                label="Order"
                type="number"
                min={0}
                value={requirementForm.requirement_order}
                onChange={(event) =>
                  setRequirementForm((previous) => ({ ...previous, requirement_order: event.target.value }))
                }
                disabled={requirementBusy}
              />
              <Input
                label="Source Document Info"
                value={requirementForm.source_reference}
                onChange={(event) =>
                  setRequirementForm((previous) => ({ ...previous, source_reference: event.target.value }))
                }
                disabled={requirementBusy}
              />
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-medium text-slate-700">Requirement Text</label>
                <Textarea
                  rows={4}
                  value={requirementForm.requirement_text}
                  onChange={(event) =>
                    setRequirementForm((previous) => ({ ...previous, requirement_text: event.target.value }))
                  }
                  disabled={requirementBusy}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );

  const renderResponsesStep = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <SectionCard title="Suppliers" description="Select a supplier response to edit its requirement matrix.">
        {responses.length === 0 ? (
          <EmptyState title="No responses" description="Add suppliers in the Setup step." />
        ) : (
          <div className="space-y-2">
            {responses.map((response) => (
              <button
                key={response.response_id}
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left transition ${
                  response.response_id === selectedResponseId
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
                onClick={() => setSelectedResponseId(response.response_id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{response.supplier_name || "-"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{response.document_count} docs</p>
                  </div>
                  <ResponseStatusBadge status={response.submission_status} />
                </div>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={selectedResponse ? `${selectedResponse.supplier_name || "Supplier"} Response` : "Supplier Response"}
        description="Capture supplier remarks, internal notes, fit status, and evidence references per requirement."
        action={
          selectedResponseId && canEditSelectedResponse ? (
            <PermissionGuard permission="ASSET_UPDATE">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleSaveResponse()}
                disabled={responseSaving || (!responseDirty && !matrixDirty)}
              >
                {responseSaving ? "Saving..." : "Save Response"}
              </Button>
            </PermissionGuard>
          ) : null
        }
      >
        {!selectedResponseId ? (
          <EmptyState title="No response selected" description="Select a supplier response to view the requirement matrix." />
        ) : responseLoading ? (
          <div className="py-8 text-sm text-slate-500">Loading supplier response...</div>
        ) : !responseDetail ? (
          <EmptyState title="Response not available" />
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
              <Field label="Supplier" value={responseDetail.supplier_name || "-"} />
              <Field label="Status" value={<ResponseStatusBadge status={responseDetail.submission_status} />} />
              <Field
                label="Completion"
                value={`${matrixRows.filter((row) => Boolean(row.fit_status)).length} / ${matrixRows.length}`}
              />
              <Field label="Submitted" value={formatEvaluationDate(responseDetail.submitted_at)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Quotation Reference"
                value={responseForm.quotation_reference}
                onChange={(event) =>
                  setResponseForm((previous) => ({ ...previous, quotation_reference: event.target.value }))
                }
                disabled={!canEditSelectedResponse || responseSaving}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Supplier / Internal Remarks</label>
                <Textarea
                  rows={3}
                  value={responseForm.notes}
                  onChange={(event) => setResponseForm((previous) => ({ ...previous, notes: event.target.value }))}
                  disabled={!canEditSelectedResponse || responseSaving}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="w-full max-w-md">
                <SearchInput
                  value={responseSearch}
                  onChange={(event) => setResponseSearch(event.target.value)}
                  onClear={() => setResponseSearch("")}
                  placeholder="Search requirements..."
                />
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
                Fit
                <select
                  className="h-9 min-w-44 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={fitFilter}
                  onChange={(event) => setFitFilter(event.target.value)}
                >
                  <option value="ALL">All fit statuses</option>
                  {SUPPLIER_REQUIREMENT_FIT_STATUS_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {matrixRows.length === 0 ? (
              <EmptyState title="No response matrix" description="Seed or add requirements before capturing supplier responses." />
            ) : filteredMatrixRows.length === 0 ? (
              <EmptyState title="No response search results" description="Adjust search or fit filters." />
            ) : (
              <Table className="min-w-[76rem] table-fixed" containerClassName="max-h-none overflow-x-auto overflow-y-visible">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-72 font-semibold">Requirement</TableHead>
                    <TableHead className="w-44 font-semibold">Fit</TableHead>
                    <TableHead className="w-80 font-semibold">Supplier Response</TableHead>
                    <TableHead className="w-64 font-semibold">Evidence Reference</TableHead>
                    <TableHead className="w-80 font-semibold">Internal Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMatrixRows.map((row) => (
                    <TableRow key={row.requirement_item_id} className="hover:bg-slate-50">
                      <TableCell className="w-72 align-top whitespace-normal break-words">
                        <div className="font-medium text-slate-900">{row.requirement_section || "General"}</div>
                        <p className="mt-1 text-sm text-slate-700">{row.requirement_text}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.requirement_key || "No requirement ID"}</p>
                      </TableCell>
                      <TableCell className="w-44 align-top">
                        {canEditSelectedResponse ? (
                          <select
                            className="h-9 w-full rounded-md border border-slate-200 bg-input-background px-3 text-sm"
                            value={row.fit_status ?? ""}
                            onChange={(event) => updateMatrixDraft(row.requirement_item_id, "fit_status", event.target.value)}
                            disabled={responseSaving}
                          >
                            <option value="">Select fit</option>
                            {SUPPLIER_REQUIREMENT_FIT_STATUS_OPTIONS.map((option) => (
                              <option key={option.code} value={option.code}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <FitStatusBadge status={row.fit_status} />
                        )}
                      </TableCell>
                      <TableCell className="w-80 align-top">
                        {canEditSelectedResponse ? (
                          <Textarea
                            rows={3}
                            value={row.supplier_response_text ?? ""}
                            onChange={(event) =>
                              updateMatrixDraft(row.requirement_item_id, "supplier_response_text", event.target.value)
                            }
                            disabled={responseSaving}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap text-sm text-slate-700">{row.supplier_response_text || "-"}</div>
                        )}
                      </TableCell>
                      <TableCell className="w-64 align-top">
                        {canEditSelectedResponse ? (
                          <Input
                            value={row.evidence_reference ?? ""}
                            onChange={(event) =>
                              updateMatrixDraft(row.requirement_item_id, "evidence_reference", event.target.value)
                            }
                            disabled={responseSaving}
                            placeholder="Document section, file, URL, or page"
                          />
                        ) : (
                          <div className="whitespace-pre-wrap text-sm text-slate-700">{row.evidence_reference || "-"}</div>
                        )}
                      </TableCell>
                      <TableCell className="w-80 align-top">
                        {canEditSelectedResponse ? (
                          <Textarea
                            rows={3}
                            value={row.notes ?? ""}
                            onChange={(event) => updateMatrixDraft(row.requirement_item_id, "notes", event.target.value)}
                            disabled={responseSaving}
                          />
                        ) : (
                          <div className="whitespace-pre-wrap text-sm text-slate-700">{row.notes || "-"}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <div className="flex items-center justify-end gap-2">
              {canSubmitSelectedResponse ? (
                <PermissionGuard permission="ASSET_UPDATE">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSubmitSelectedResponse()}
                    disabled={responseActionId === selectedResponseId || responseDetail.documents.length === 0}
                  >
                    {responseActionId === selectedResponseId ? "Submitting..." : "Submit Response"}
                  </Button>
                </PermissionGuard>
              ) : null}
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderEvidenceStep = () => (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <SectionCard title="Response Context" description="Evidence is attached to the selected supplier response.">
        {responses.length === 0 ? (
          <EmptyState title="No responses" description="Add supplier response rows first." />
        ) : (
          <div className="space-y-2">
            {responses.map((response) => (
              <button
                key={response.response_id}
                type="button"
                className={`w-full rounded-md border px-3 py-2 text-left transition ${
                  response.response_id === selectedResponseId
                    ? "border-blue-300 bg-blue-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
                onClick={() => setSelectedResponseId(response.response_id)}
              >
                <p className="truncate text-sm font-semibold text-slate-900">{response.supplier_name || "-"}</p>
                <p className="mt-1 text-xs text-slate-500">{response.document_count} evidence documents</p>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Supplier Evidence"
        description="Upload or link response-specific evidence using the existing supplier response document API."
        action={
          evaluation.asset_uuid ? (
            <PermissionGuard permission="DOCUMENT_VIEW">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigateToDocumentPortal(evaluation.asset_uuid)}
              >
                <ExternalLink className="h-4 w-4" />
                Document Portal
              </Button>
            </PermissionGuard>
          ) : null
        }
      >
        {!selectedResponseId ? (
          <EmptyState title="No response selected" description="Select a supplier response to manage evidence." />
        ) : responseLoading ? (
          <div className="py-8 text-sm text-slate-500">Loading evidence...</div>
        ) : !responseDetail ? (
          <EmptyState title="Evidence unavailable" />
        ) : (
          <div className="space-y-5">
            {documentToDelete ? (
              <ConfirmStrip
                tone="danger"
                title="Remove evidence document?"
                message={`Remove "${documentToDelete.document_name}" from this supplier response.`}
                confirmLabel="Remove"
                disabled={documentBusy}
                onCancel={() => setDocumentToDelete(null)}
                onConfirm={() => void handleDeleteDocument()}
              />
            ) : null}

            {responseDetail.documents.length === 0 ? (
              <EmptyState title="No evidence" description="Attach supplier response evidence or link to an external document." />
            ) : (
              <Table className="min-w-[56rem]" containerClassName="max-h-none overflow-x-auto overflow-y-visible">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Document</TableHead>
                    <TableHead className="font-semibold">Source</TableHead>
                    <TableHead className="font-semibold">Uploaded</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responseDetail.documents.map((document) => {
                    const safeUrl = getSafeAccessUrl(document.access_url);
                    return (
                      <TableRow key={document.document_id} className="hover:bg-slate-50">
                        <TableCell className="align-top">{formatSupplierResponseDocumentType(document.document_type)}</TableCell>
                        <TableCell className="align-top whitespace-normal">
                          <div className="font-medium text-slate-900">{document.document_name}</div>
                          <p className="mt-1 text-xs text-slate-500">
                            {[document.document_version, document.external_document_id].filter(Boolean).join(" | ") || "-"}
                          </p>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal text-slate-600">
                          {document.source_system || "-"}
                        </TableCell>
                        <TableCell className="align-top text-slate-600">{formatEvaluationDate(document.upload_dt)}</TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                            {safeUrl ? (
                              <Button type="button" variant="ghost" size="sm" asChild>
                                <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                                  Open
                                </a>
                              </Button>
                            ) : null}
                            {canEditSelectedResponse ? (
                              <PermissionGuard permission="DOCUMENT_DELETE">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => setDocumentToDelete(document)}
                                >
                                  Remove
                                </Button>
                              </PermissionGuard>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {canEditSelectedResponse ? (
              <PermissionGuard anyOf={["DOCUMENT_UPLOAD", "DOCUMENT_LINK"]}>
                <form className="space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => void handleAddDocument(event)}>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Add Evidence</p>
                  </div>
                  {documentError ? (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {documentError}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-1.5 text-sm font-medium text-slate-700">
                      Document Type
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-input-background px-3 text-sm"
                        value={documentForm.document_type}
                        onChange={(event) =>
                          setDocumentForm((previous) => ({ ...previous, document_type: event.target.value }))
                        }
                        disabled={documentBusy}
                      >
                        {SUPPLIER_RESPONSE_DOCUMENT_TYPE_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-sm font-medium text-slate-700">
                      Source System
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 bg-input-background px-3 text-sm"
                        value={documentForm.source_system}
                        onChange={(event) =>
                          setDocumentForm((previous) => ({ ...previous, source_system: event.target.value }))
                        }
                        disabled={documentBusy}
                      >
                        <option value="">Select source system</option>
                        {availableSourceSystemOptions.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.value}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input
                      label="Document Name"
                      value={documentForm.document_name}
                      onChange={(event) =>
                        setDocumentForm((previous) => ({ ...previous, document_name: event.target.value }))
                      }
                      disabled={documentBusy}
                      required
                    />
                    <Input
                      label="Document Version"
                      value={documentForm.document_version}
                      onChange={(event) =>
                        setDocumentForm((previous) => ({ ...previous, document_version: event.target.value }))
                      }
                      disabled={documentBusy}
                    />
                    <Input
                      label="External Document ID"
                      value={documentForm.external_document_id}
                      onChange={(event) =>
                        setDocumentForm((previous) => ({ ...previous, external_document_id: event.target.value }))
                      }
                      disabled={documentBusy}
                    />
                    <Input
                      label="Upload Date"
                      type="datetime-local"
                      value={documentForm.upload_dt}
                      onChange={(event) =>
                        setDocumentForm((previous) => ({ ...previous, upload_dt: event.target.value }))
                      }
                      disabled={documentBusy}
                      required
                    />
                    <div className="md:col-span-2">
                      <DocumentUploadUrlField
                        label="Access URL"
                        value={documentForm.access_url}
                        onChange={(value) =>
                          setDocumentForm((previous) => ({
                            ...previous,
                            access_url: value,
                          }))
                        }
                        disabled={documentBusy}
                        uploadCategory="supplier-response-documents"
                        onUploaded={(uploaded) => {
                          setDocumentForm((previous) => ({
                            ...previous,
                            access_url: uploaded.access_url,
                            document_name: previous.document_name.trim() ? previous.document_name : uploaded.original_file_name,
                            source_reference: previous.source_reference.trim()
                              ? previous.source_reference
                              : uploaded.original_file_name,
                            upload_dt: previous.upload_dt || normalizeDateTimeInput(new Date().toISOString()),
                          }));
                        }}
                      />
                    </div>
                    <Input
                      label="Source Reference"
                      value={documentForm.source_reference}
                      onChange={(event) =>
                        setDocumentForm((previous) => ({ ...previous, source_reference: event.target.value }))
                      }
                      disabled={documentBusy}
                    />
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-sm font-medium text-slate-700">Notes</label>
                      <Textarea
                        rows={3}
                        value={documentForm.notes}
                        onChange={(event) => setDocumentForm((previous) => ({ ...previous, notes: event.target.value }))}
                        disabled={documentBusy}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setDocumentForm(createEmptyDocumentForm(availableSourceSystemOptions[0]?.code ?? ""))}
                      disabled={documentBusy}
                    >
                      Reset
                    </Button>
                    <Button type="submit" disabled={documentBusy}>
                      {documentBusy ? "Adding..." : "Add Evidence"}
                    </Button>
                  </div>
                </form>
              </PermissionGuard>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderAnalysisStep = () => (
    <SectionCard
      title="Analysis / Scoring"
      description="AI analysis uses the frozen requirement baseline, structured supplier responses, and evidence metadata."
      action={
        evaluation.status === "LOCKED" ? (
          <PermissionGuard permission="ASSET_UPDATE">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleRunAnalysis()}
              disabled={analysisBusy || responses.length === 0 || requirements.length === 0}
            >
              {analysisBusy ? "Running..." : "Run Analysis"}
            </Button>
          </PermissionGuard>
        ) : null
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-4">
          <Field
            label="Analysis Status"
            value={
              <Badge variant="outline" className={getAnalysisStatusBadgeClass(latestAnalysisStatus)}>
                {formatAnalysisStatus(latestAnalysisStatus)}
              </Badge>
            }
          />
          <Field label="Latest Completed" value={formatEvaluationDate(analysis?.completed_at)} />
          <Field label="Provider" value={analysis?.provider || "-"} />
          <Field label="Runs" value={analysisHistory.length} />
        </div>

        {analysis?.error_message ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {analysis.error_message}
          </div>
        ) : null}

        {analysisInsight ? <p className="text-sm text-slate-700">{analysisInsight}</p> : null}

        {latestAnalysisStatus === "NOT_STARTED" ? (
          <EmptyState
            title="No analysis yet"
            description="Lock the evaluation, then run analysis to generate supplier scoring and requirement-level findings."
          />
        ) : (
          <>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Supplier Ranking</p>
                <p className="text-xs text-slate-500">Score: MEETS=1, PARTIALLY_MEETS=0.5, NOT_MEETS=0</p>
              </div>
              {comparisonSummaries.length === 0 ? (
                <EmptyState title="No score summary" description="No supplier ranking is available for this analysis run." />
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {comparisonSummaries.map((summary) => (
                    <div key={summary.id} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Rank {summary.recommendation_rank}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {summary.supplier_name || "Supplier"}
                          </p>
                          <p className="text-xs text-slate-500">{summary.supplier_type || "Supplier"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-semibold text-slate-900">{formatScore(summary.overall_score)}</p>
                          <p className="text-xs text-slate-500">score</p>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-md bg-white px-2 py-1">
                          <p className="font-semibold text-emerald-700">{summary.meets_percent}%</p>
                          <p className="text-slate-500">Meets</p>
                        </div>
                        <div className="rounded-md bg-white px-2 py-1">
                          <p className="font-semibold text-amber-700">{summary.partially_meets_percent}%</p>
                          <p className="text-slate-500">Partial</p>
                        </div>
                        <div className="rounded-md bg-white px-2 py-1">
                          <p className="font-semibold text-rose-700">{summary.not_meets_percent}%</p>
                          <p className="text-slate-500">Not</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-600">
                        <span className="font-medium">Strengths:</span> {summary.strengths.join("; ") || "-"}
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        <span className="font-medium">Risks:</span> {summary.risk_flags.join("; ") || "-"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-slate-900">Requirement-Level Findings</p>
              {requirementAnalyses.length === 0 ? (
                <EmptyState title="No findings" description="No requirement-level analysis rows are available." />
              ) : (
                <Table className="min-w-[72rem] table-fixed" containerClassName="max-h-none overflow-x-auto overflow-y-visible">
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="w-48 font-semibold">Supplier</TableHead>
                      <TableHead className="w-72 font-semibold">Requirement</TableHead>
                      <TableHead className="w-40 font-semibold">AI Fit</TableHead>
                      <TableHead className="font-semibold">Reasoning</TableHead>
                      <TableHead className="w-64 font-semibold">Evidence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requirementAnalyses.map((row) => (
                      <TableRow key={row.id} className="hover:bg-slate-50">
                        <TableCell className="w-48 align-top whitespace-normal text-slate-700">
                          {row.supplier_name || "Supplier"}
                        </TableCell>
                        <TableCell className="w-72 align-top whitespace-normal">
                          <div className="font-medium text-slate-900">
                            {row.requirement_key || row.requirement_section || "Requirement"}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{row.requirement_text}</p>
                        </TableCell>
                        <TableCell className="w-40 align-top">
                          <FitStatusBadge status={row.evaluated_fit} />
                          <p className="mt-1 text-xs text-slate-500">{(row.confidence_score * 100).toFixed(0)}%</p>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal text-sm text-slate-700">
                          {row.reasoning_text || "-"}
                        </TableCell>
                        <TableCell className="w-64 align-top whitespace-normal text-sm text-slate-600">
                          {row.evidence_reference || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );

  const renderCloseStep = () => (
    <div className="space-y-4">
      <SectionCard title="Lifecycle Actions" description="Use the existing workflow APIs for open and lock transitions.">
        <div className="space-y-4">
          {lifecycleAction ? (
            <ConfirmStrip
              tone={lifecycleAction === "lock" ? "warning" : "neutral"}
              title={lifecycleAction === "lock" ? "Lock this evaluation?" : "Open evaluation for response?"}
              message={
                lifecycleAction === "lock"
                  ? "Locking freezes the submitted supplier responses and enables analysis."
                  : "Opening allows suppliers to continue response capture."
              }
              confirmLabel={lifecycleAction === "lock" ? "Lock Evaluation" : "Open"}
              disabled={actionBusy}
              onCancel={() => setLifecycleAction(null)}
              onConfirm={() => void handleLifecycleAction()}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Open for Response</p>
              <p className="mt-1 text-xs text-slate-500">Move Draft evaluations into supplier response collection.</p>
              {evaluation.status === "DRAFT" ? (
                <PermissionGuard permission="ASSET_UPDATE">
                  <Button
                    type="button"
                    className="mt-4"
                    size="sm"
                    onClick={() => setLifecycleAction("open")}
                    disabled={responses.length === 0}
                  >
                    Open for Response
                  </Button>
                </PermissionGuard>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Current state: {formatSupplierEvaluationStatus(evaluation.status)}</p>
              )}
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Lock Evaluation</p>
              <p className="mt-1 text-xs text-slate-500">Freeze responses after all suppliers submit.</p>
              {evaluation.status === "OPEN_FOR_RESPONSE" ? (
                <PermissionGuard permission="ASSET_UPDATE">
                  <Button
                    type="button"
                    className="mt-4"
                    size="sm"
                    onClick={() => setLifecycleAction("lock")}
                    disabled={responses.length === 0 || pendingResponseCount > 0}
                  >
                    Lock Evaluation
                  </Button>
                </PermissionGuard>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Pending responses: {pendingResponseCount}</p>
              )}
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Close Evaluation</p>
              <p className="mt-1 text-xs text-slate-500">Final close is read-only until the backend exposes a close transition.</p>
              {/* TODO: Backend workflow status endpoint required for final close transition. */}
              <p className="mt-4 text-xs font-medium text-slate-600">
                Backend workflow status required for final close transition.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Requirements</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{requirements.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Suppliers</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{responses.length}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Submitted</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{submittedResponseCount}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Locked Responses</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{lockedResponseCount}</p>
        </div>
      </div>
    </div>
  );

  const renderActiveStep = () => {
    if (activeStep === "setup") return renderSetupStep();
    if (activeStep === "requirements") return renderRequirementsStep();
    if (activeStep === "responses") return renderResponsesStep();
    if (activeStep === "evidence") return renderEvidenceStep();
    if (activeStep === "analysis") return renderAnalysisStep();
    return renderCloseStep();
  };

  return (
    <div className="flex flex-1 flex-col gap-4">
      <section className="rounded-md border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back to Supplier Evaluations
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-xl font-semibold text-slate-900">{evaluation.evaluation_name}</h2>
              <EvaluationStatusBadge status={evaluation.status} />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {[evaluation.asset_name || evaluation.asset_code || "Asset", evaluation.urs_release_version ? `Release ${evaluation.urs_release_version}` : null]
                .filter(Boolean)
                .join(" | ")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4 xl:min-w-[34rem]">
            <Field label="Suppliers" value={responses.length} />
            <Field label="Submitted" value={`${submittedResponseCount} / ${responses.length}`} />
            <Field label="Evidence" value={documentCount} />
            <Field label="Updated" value={formatEvaluationDate(evaluation.modified_dt || evaluation.created_dt)} />
          </div>
        </div>
      </section>

      <div className="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="rounded-md border border-slate-200 bg-white p-3">
          <WorkflowStepper
            steps={workflowSteps}
            currentStep={activeStep}
            onStepClick={(step) => setActiveStep(step.key as WorkspaceStepKey)}
          />
        </aside>
        <main className="min-w-0">{renderActiveStep()}</main>
      </div>
    </div>
  );
}
