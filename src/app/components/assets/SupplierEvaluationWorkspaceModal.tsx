import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SupplierRecord } from "../../../services/supplier.service";
import {
  addSupplierEvaluationResponses,
  createEvaluationRequirement,
  deleteEvaluationRequirement,
  EvaluationRequirementItemRecord,
  getSupplierEvaluationAnalysis,
  getSupplierEvaluationComparison,
  getSupplierEvaluation,
  getSupplierEvaluationRequirements,
  getSupplierEvaluationResponses,
  lockSupplierEvaluation,
  openSupplierEvaluation,
  runSupplierEvaluationAnalysis,
  seedSupplierEvaluationRequirements,
  SupplierComparisonSummaryRecord,
  SupplierEvaluationAnalysisRecord,
  SupplierEvaluationComparisonRecord,
  submitSupplierEvaluationResponse,
  SupplierRequirementAnalysisRecord,
  SupplierEvaluationRecord,
  SupplierEvaluationResponseRecord,
  updateEvaluationRequirement,
} from "../../../services/supplier-evaluation.service";
import { useCurrentActor } from "../../auth/useCurrentActor";
import { LookupOption } from "../../services/lookupValue.service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Modal } from "../ui/Modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Textarea } from "../ui/textarea";
import {
  canAddSuppliersToEvaluation,
  canSubmitSupplierResponse,
  formatEvaluationDate,
  formatSupplierEvaluationStatus,
  formatSupplierRequirementFitStatus,
  formatSupplierResponseStatus,
  getSupplierEvaluationStatusBadgeClass,
  getSupplierRequirementFitStatusBadgeClass,
  getSupplierResponseStatusBadgeClass,
  mapSupplierEvaluationAxiosError,
} from "./supplierEvaluationForm.shared";
import { SupplierResponseModal } from "./SupplierResponseModal";

interface SupplierEvaluationWorkspaceModalProps {
  open: boolean;
  evaluationId: string | null;
  suppliers: SupplierRecord[];
  sourceSystemOptions?: LookupOption[];
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

interface RequirementFormState {
  requirement_key: string;
  requirement_section: string;
  requirement_text: string;
  requirement_order: string;
  source_reference: string;
}

const EMPTY_REQUIREMENT_FORM: RequirementFormState = {
  requirement_key: "",
  requirement_section: "",
  requirement_text: "",
  requirement_order: "",
  source_reference: "",
};

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
  return `${value.toFixed(1)}`;
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
      requirement.requirement_section || "",
      requirement.requirement_key || "",
      requirement.requirement_text || "",
      requirement.source_reference || "",
    ]),
  ];

  return rows.map((row) => row.map(csvValue).join(",")).join("\n");
};

const safeFileSegment = (value?: string | null): string => {
  const normalized = (value || "supplier-evaluation").trim().toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "supplier-evaluation";
};

const downloadTextFile = (fileName: string, content: string, type: string) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export function SupplierEvaluationWorkspaceModal({
  open,
  evaluationId,
  suppliers,
  sourceSystemOptions = [],
  onClose,
  onChanged,
}: SupplierEvaluationWorkspaceModalProps) {
  const currentActor = useCurrentActor();
  const actor = currentActor.auditName ?? currentActor.displayName;
  const [evaluation, setEvaluation] = useState<SupplierEvaluationRecord | null>(null);
  const [responses, setResponses] = useState<SupplierEvaluationResponseRecord[]>([]);
  const [requirements, setRequirements] = useState<EvaluationRequirementItemRecord[]>([]);
  const [analysis, setAnalysis] = useState<SupplierEvaluationAnalysisRecord | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<SupplierEvaluationAnalysisRecord[]>([]);
  const [comparison, setComparison] = useState<SupplierEvaluationComparisonRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [requirementBusy, setRequirementBusy] = useState(false);
  const [responseActionId, setResponseActionId] = useState<string | null>(null);
  const [responseModalId, setResponseModalId] = useState<string | null>(null);
  const [showAddSuppliers, setShowAddSuppliers] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [editingRequirement, setEditingRequirement] = useState<EvaluationRequirementItemRecord | null>(null);
  const [showRequirementForm, setShowRequirementForm] = useState(false);
  const [requirementForm, setRequirementForm] = useState<RequirementFormState>(EMPTY_REQUIREMENT_FORM);
  const [requirementFormError, setRequirementFormError] = useState<string | null>(null);
  const [requirementToDelete, setRequirementToDelete] = useState<EvaluationRequirementItemRecord | null>(null);
  const [deleteRequirementBusy, setDeleteRequirementBusy] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!evaluationId) return;

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
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setLoading(false);
    }
  }, [evaluationId]);

  useEffect(() => {
    if (!open || !evaluationId) {
      setEvaluation(null);
      setResponses([]);
      setRequirements([]);
      setAnalysis(null);
      setAnalysisHistory([]);
      setComparison(null);
      setLoading(false);
      setActionBusy(false);
      setAnalysisBusy(false);
      setRequirementBusy(false);
      setResponseActionId(null);
      setResponseModalId(null);
      setShowAddSuppliers(false);
      setSelectedSupplierIds([]);
      setEditingRequirement(null);
      setShowRequirementForm(false);
      setRequirementForm(EMPTY_REQUIREMENT_FORM);
      setRequirementFormError(null);
      setRequirementToDelete(null);
      setDeleteRequirementBusy(false);
      return;
    }

    void loadWorkspace();
  }, [evaluationId, loadWorkspace, open]);

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
  const supplierComparisonColumns = useMemo(
    () => {
      if (comparisonSummaries.length > 0) {
        return comparisonSummaries.map((summary) => ({
          supplier_id: summary.supplier_id,
          supplier_name: summary.supplier_name || "Supplier",
          recommendation_rank: summary.recommendation_rank,
          overall_score: summary.overall_score,
        }));
      }
      return responses.map((response, index) => ({
        supplier_id: response.supplier_id,
        supplier_name: response.supplier_name || "Supplier",
        recommendation_rank: index + 1,
        overall_score: null as number | null,
      }));
    },
    [comparisonSummaries, responses],
  );
  const requirementAnalysisByKey = useMemo(() => {
    const map = new Map<string, SupplierRequirementAnalysisRecord>();
    requirementAnalyses.forEach((row) => {
      map.set(`${row.requirement_id}:${row.supplier_id}`, row);
    });
    return map;
  }, [requirementAnalyses]);
  const latestAnalysisStatus = comparison?.status ?? analysis?.status ?? "NOT_STARTED";
  const latestSummary = comparison?.summary_json ?? analysis?.summary_json ?? null;
  const analysisInsight = getSummaryString(latestSummary, [
    "evaluation_summary",
    "overall_comparison_insight",
  ]);

  const toggleSupplierSelection = (supplierId: string) => {
    setSelectedSupplierIds((previous) =>
      previous.includes(supplierId)
        ? previous.filter((item) => item !== supplierId)
        : [...previous, supplierId],
    );
  };

  const runWorkspaceAction = async (action: () => Promise<void>) => {
    setActionBusy(true);
    try {
      await action();
      await loadWorkspace();
      await onChanged();
    } finally {
      setActionBusy(false);
    }
  };

  const resetRequirementForm = () => {
    setEditingRequirement(null);
    setShowRequirementForm(false);
    setRequirementForm(buildRequirementFormFromItem(null, nextRequirementOrder));
    setRequirementFormError(null);
  };

  const startRequirementCreate = () => {
    setEditingRequirement(null);
    setShowRequirementForm(true);
    setRequirementForm(buildRequirementFormFromItem(null, nextRequirementOrder));
    setRequirementFormError(null);
  };

  const startRequirementEdit = (item: EvaluationRequirementItemRecord) => {
    setEditingRequirement(item);
    setShowRequirementForm(true);
    setRequirementForm(buildRequirementFormFromItem(item));
    setRequirementFormError(null);
  };

  const handleOpenForResponse = async () => {
    if (!evaluation) return;

    try {
      await runWorkspaceAction(async () => {
        await openSupplierEvaluation(evaluation.evaluation_id, {
          action_by: actor,
        });
        toast.success("Evaluation opened for response");
      });
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    }
  };

  const handleLockEvaluation = async () => {
    if (!evaluation) return;

    try {
      await runWorkspaceAction(async () => {
        await lockSupplierEvaluation(evaluation.evaluation_id, {
          action_by: actor,
        });
        toast.success("Evaluation locked successfully");
      });
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    }
  };

  const handleRunAnalysis = async () => {
    if (!evaluation) return;

    setAnalysisBusy(true);
    try {
      const result = await runSupplierEvaluationAnalysis(evaluation.evaluation_id, {
        triggered_by: actor,
      });
      setAnalysis(result);
      await loadWorkspace();
      await onChanged();
      if (result.status === "FAILED") {
        toast.error(result.error_message || "Supplier evaluation analysis failed");
      } else {
        toast.success("Supplier AI evaluation completed");
      }
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setAnalysisBusy(false);
    }
  };

  const handleAddSuppliers = async () => {
    if (!evaluation || selectedSupplierIds.length === 0) {
      return;
    }

    try {
      await runWorkspaceAction(async () => {
        const result = await addSupplierEvaluationResponses(evaluation.evaluation_id, {
          supplier_ids: selectedSupplierIds,
          created_by: actor,
        });
        toast.success(
          result.created_count === 1
            ? "1 supplier added to the evaluation"
            : `${result.created_count} suppliers added to the evaluation`,
        );
      });
      setSelectedSupplierIds([]);
      setShowAddSuppliers(false);
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    }
  };

  const handleQuickSubmit = async (responseId: string) => {
    setResponseActionId(responseId);
    try {
      await runWorkspaceAction(async () => {
        await submitSupplierEvaluationResponse(responseId, {
          action_by: actor,
        });
        toast.success("Supplier response submitted successfully");
      });
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setResponseActionId(null);
    }
  };

  const handleSeedRequirements = async () => {
    if (!evaluation) return;

    setRequirementBusy(true);
    try {
      const result = await seedSupplierEvaluationRequirements(evaluation.evaluation_id, {
        created_by: actor,
      });
      setRequirements(result.requirements);
      await loadWorkspace();
      await onChanged();
      if (result.created_count > 0) {
        toast.success(
          result.created_count === 1
            ? "1 requirement was seeded from the approved URS"
            : `${result.created_count} requirements were seeded from the approved URS`,
        );
      } else {
        toast("No deterministic requirement candidates were found in the approved URS. Add rows manually.");
      }
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
        toast.success("Requirement baseline row updated");
      } else {
        await createEvaluationRequirement(evaluation.evaluation_id, {
          created_by: actor,
          requirement_key: requirementForm.requirement_key.trim() || null,
          requirement_section: requirementForm.requirement_section.trim() || null,
          requirement_text: requirementForm.requirement_text.trim(),
          requirement_order: parsedOrder,
          source_reference: requirementForm.source_reference.trim() || null,
        });
        toast.success("Requirement baseline row created");
      }
      resetRequirementForm();
      await loadWorkspace();
      await onChanged();
    } catch (error) {
      const message = mapSupplierEvaluationAxiosError(error);
      setRequirementFormError(message);
      toast.error(message);
    } finally {
      setRequirementBusy(false);
    }
  };

  const handleDeleteRequirement = async () => {
    if (!requirementToDelete) return;

    setDeleteRequirementBusy(true);
    try {
      await deleteEvaluationRequirement(requirementToDelete.requirement_item_id);
      setRequirementToDelete(null);
      await loadWorkspace();
      await onChanged();
      toast.success("Requirement baseline row deleted");
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setDeleteRequirementBusy(false);
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

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Supplier Evaluation Workspace"
        description="Manage the frozen URS requirement baseline, collect supplier responses, and lock the evaluation when all suppliers are submitted."
        size="full"
        footer={
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        }
      >
        {loading ? (
          <div className="py-8 text-sm text-slate-600">Loading supplier evaluation workspace...</div>
        ) : !evaluation ? (
          <div className="py-8 text-sm text-slate-600">No supplier evaluation selected.</div>
        ) : (
          <div className="min-w-0 space-y-5">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 break-words text-lg font-semibold text-slate-900">
                        {evaluation.evaluation_name}
                      </h3>
                      <Badge
                        variant="outline"
                        className={getSupplierEvaluationStatusBadgeClass(evaluation.status)}
                      >
                        {formatSupplierEvaluationStatus(evaluation.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Controlled supplier collection cycle linked to one asset and one approved URS baseline.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.7fr)_minmax(0,0.9fr)]">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Asset</p>
                      <p className="break-words text-sm font-medium text-slate-900">
                        {evaluation.asset_name || "-"}{evaluation.asset_code ? ` (${evaluation.asset_code})` : ""}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">URS</p>
                      <p className="break-words text-sm font-medium text-slate-900 [overflow-wrap:anywhere]">
                        {evaluation.urs_title || "-"}
                      </p>
                      {evaluation.urs_release_version ? (
                        <p className="break-words text-xs text-slate-500">Release {evaluation.urs_release_version}</p>
                      ) : (
                        <p className="text-xs text-slate-500">Asset-level URS</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500">Lifecycle</p>
                      <p className="break-words text-sm font-medium text-slate-900">
                        Opened {formatEvaluationDate(evaluation.opened_at)}
                      </p>
                      <p className="text-xs text-slate-500">Locked {formatEvaluationDate(evaluation.locked_at)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                  {canAddSuppliersToEvaluation(evaluation.status) ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddSuppliers((previous) => !previous)}
                      disabled={actionBusy || availableSuppliers.length === 0}
                    >
                      Add Suppliers
                    </Button>
                  ) : null}

                  {evaluation.status === "DRAFT" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleOpenForResponse()}
                      disabled={actionBusy || responses.length === 0}
                    >
                      {actionBusy ? "Opening..." : "Open for Response"}
                    </Button>
                  ) : null}

                  {evaluation.status === "OPEN_FOR_RESPONSE" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleLockEvaluation()}
                      disabled={actionBusy || responses.length === 0 || pendingResponseCount > 0}
                    >
                      {actionBusy ? "Locking..." : "Lock Evaluation"}
                    </Button>
                  ) : null}

                  {evaluation.status === "LOCKED" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleRunAnalysis()}
                      disabled={analysisBusy || responses.length === 0 || requirements.length === 0}
                    >
                      {analysisBusy ? "Running AI..." : "Run AI Evaluation"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {requirements.length === 0 ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  No requirement baseline.
                </div>
              ) : null}

              {showAddSuppliers && canAddSuppliersToEvaluation(evaluation.status) ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Add Participating Suppliers</p>
                      <p className="text-xs text-slate-500">
                        Create one response row per selected supplier. Existing suppliers are automatically excluded.
                      </p>
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
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleAddSuppliers()}
                        disabled={actionBusy || selectedSupplierIds.length === 0}
                      >
                        {actionBusy ? "Adding..." : "Add Selected Suppliers"}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-slate-200">
                    {availableSuppliers.length === 0 ? (
                      <div className="px-4 py-6 text-sm text-slate-500">
                        All suppliers in supplier master are already attached to this evaluation.
                      </div>
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
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900">{supplier.supplier_name}</p>
                              <p className="text-xs text-slate-500">
                                {supplier.supplier_type || "Supplier"}
                                {supplier.contact_email ? ` | ${supplier.contact_email}` : ""}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Requirements</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{requirements.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Suppliers</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{responses.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Submitted / Ready</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{submittedResponseCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Pending</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{pendingResponseCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Locked Responses</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{lockedResponseCount}</p>
              </div>
            </div>

            {evaluation.status === "LOCKED" || analysis ? (
              <div className="rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">AI Evaluation & Recommendation</p>
                      <Badge variant="outline" className={getAnalysisStatusBadgeClass(latestAnalysisStatus)}>
                        {formatAnalysisStatus(latestAnalysisStatus)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Read-only comparison generated from the frozen requirement matrix, supplier structured responses, and document metadata.
                    </p>
                    {analysisInsight ? (
                      <p className="mt-2 text-sm text-slate-700">{analysisInsight}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {analysis?.completed_at ? <span>Completed {formatEvaluationDate(analysis.completed_at)}</span> : null}
                    {analysis?.provider ? <span>Provider: {analysis.provider}</span> : null}
                    {analysisHistory.length > 0 ? <span>Runs: {analysisHistory.length}</span> : null}
                  </div>
                </div>

                {analysis?.error_message ? (
                  <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {analysis.error_message}
                  </div>
                ) : null}

                {latestAnalysisStatus === "NOT_STARTED" ? (
                  <div className="px-4 py-8 text-sm text-slate-500">
                    Lock the evaluation, then run AI evaluation to generate supplier scoring, fit comparison, and recommendation traceability.
                  </div>
                ) : (
                  <div className="space-y-5 p-4">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Supplier Ranking</p>
                        <p className="text-xs text-slate-500">Score: MEETS=1, PARTIALLY_MEETS=0.5, NOT_MEETS=0</p>
                      </div>
                      {comparisonSummaries.length === 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                          No supplier ranking is available for this analysis run yet.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                          {comparisonSummaries.map((summary) => (
                            <div
                              key={summary.id}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                            >
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
                                  <p className="text-xl font-semibold text-slate-900">
                                    {formatScore(summary.overall_score)}
                                  </p>
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
                                <span className="font-medium">Strengths:</span>{" "}
                                {summary.strengths.slice(0, 2).join(", ") || "-"}
                              </p>
                              <p className="mt-1 text-xs text-slate-600">
                                <span className="font-medium">Risks:</span>{" "}
                                {summary.risk_flags.slice(0, 2).join(", ") || "-"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="mb-3 text-sm font-semibold text-slate-900">Requirement vs Supplier Fit</p>
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="min-w-72 font-semibold">Requirement</TableHead>
                              {supplierComparisonColumns.map((supplier) => (
                                <TableHead key={supplier.supplier_id} className="min-w-44 font-semibold">
                                  <div>{supplier.supplier_name}</div>
                                  {supplier.overall_score !== null ? (
                                    <p className="text-xs font-normal text-slate-500">
                                      Rank {supplier.recommendation_rank} | {formatScore(supplier.overall_score)}
                                    </p>
                                  ) : null}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {requirementAnalyses.length === 0 ? (
                              <TableRow>
                                <TableCell
                                  colSpan={Math.max(2, supplierComparisonColumns.length + 1)}
                                  className="py-8 text-center text-slate-500"
                                >
                                  No requirement-level analysis rows are available yet.
                                </TableCell>
                              </TableRow>
                            ) : (
                              requirements.map((requirement) => (
                                <TableRow key={requirement.requirement_item_id} className="hover:bg-slate-50">
                                  <TableCell className="align-top whitespace-normal">
                                    <div className="font-medium text-slate-900">
                                      {requirement.requirement_key || requirement.requirement_section || "Requirement"}
                                    </div>
                                    <p className="mt-1 line-clamp-3 text-xs text-slate-600">
                                      {requirement.requirement_text}
                                    </p>
                                  </TableCell>
                                  {supplierComparisonColumns.map((supplier) => {
                                    const row = requirementAnalysisByKey.get(
                                      `${requirement.requirement_item_id}:${supplier.supplier_id}`,
                                    );
                                    return (
                                      <TableCell key={supplier.supplier_id} className="align-top">
                                        {row ? (
                                          <div className="space-y-1">
                                            <Badge
                                              variant="outline"
                                              className={getSupplierRequirementFitStatusBadgeClass(row.evaluated_fit)}
                                            >
                                              {formatSupplierRequirementFitStatus(row.evaluated_fit)}
                                            </Badge>
                                            <p className="text-xs text-slate-500">
                                              Confidence {(row.confidence_score * 100).toFixed(0)}%
                                            </p>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-slate-400">-</span>
                                        )}
                                      </TableCell>
                                    );
                                  })}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-sm font-semibold text-slate-900">Detailed Requirement Reasoning</p>
                      <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50">
                              <TableHead className="font-semibold">Supplier</TableHead>
                              <TableHead className="font-semibold">Requirement</TableHead>
                              <TableHead className="font-semibold">AI Fit</TableHead>
                              <TableHead className="font-semibold">Reasoning</TableHead>
                              <TableHead className="font-semibold">Evidence</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {requirementAnalyses.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                                  No analysis rows.
                                </TableCell>
                              </TableRow>
                            ) : (
                              requirementAnalyses.map((row) => (
                                <TableRow key={row.id} className="hover:bg-slate-50">
                                  <TableCell className="align-top whitespace-normal text-slate-700">
                                    {row.supplier_name || "Supplier"}
                                  </TableCell>
                                  <TableCell className="align-top whitespace-normal">
                                    <div className="font-medium text-slate-900">
                                      {row.requirement_key || row.requirement_section || "Requirement"}
                                    </div>
                                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                                      {row.requirement_text}
                                    </p>
                                  </TableCell>
                                  <TableCell className="align-top">
                                    <Badge
                                      variant="outline"
                                      className={getSupplierRequirementFitStatusBadgeClass(row.evaluated_fit)}
                                    >
                                      {formatSupplierRequirementFitStatus(row.evaluated_fit)}
                                    </Badge>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {(row.confidence_score * 100).toFixed(0)}%
                                    </p>
                                  </TableCell>
                                  <TableCell className="align-top whitespace-normal text-sm text-slate-700">
                                    {row.reasoning_text || "-"}
                                  </TableCell>
                                  <TableCell className="align-top whitespace-normal text-sm text-slate-600">
                                    {row.evidence_reference || "-"}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Requirement Baseline</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleSeedRequirements()}
                        disabled={requirementBusy}
                      >
                        {requirementBusy ? "Seeding..." : "Seed From URS"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={startRequirementCreate}
                        disabled={requirementBusy}
                      >
                        Add Requirement
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>

              <Table
                className="min-w-[64rem] table-fixed"
                containerClassName="max-h-none overflow-x-auto overflow-y-visible overscroll-auto [scrollbar-gutter:auto]"
              >
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-20 font-semibold">Order</TableHead>
                    <TableHead className="w-56 font-semibold">Section / Key</TableHead>
                    <TableHead className="font-semibold">Requirement Text</TableHead>
                    <TableHead className="w-64 font-semibold">Source Reference</TableHead>
                    <TableHead className="w-32 font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requirements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                        No requirement rows exist yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requirements.map((requirement) => (
                      <TableRow key={requirement.requirement_item_id} className="hover:bg-slate-50">
                        <TableCell className="w-20 align-top text-slate-700">
                          {requirement.requirement_order ?? "-"}
                        </TableCell>
                        <TableCell className="w-56 align-top whitespace-normal break-words">
                          <div className="font-medium text-slate-900 [overflow-wrap:anywhere]">
                            {requirement.requirement_section || "General"}
                          </div>
                          <p className="mt-1 text-xs text-slate-500 [overflow-wrap:anywhere]">
                            {requirement.requirement_key || "No key"}
                          </p>
                        </TableCell>
                        <TableCell className="align-top whitespace-normal break-words text-slate-700 [overflow-wrap:anywhere]">
                          {requirement.requirement_text}
                        </TableCell>
                        <TableCell className="w-64 align-top whitespace-normal break-words text-slate-600 [overflow-wrap:anywhere]">
                          {requirement.source_reference || "-"}
                        </TableCell>
                        <TableCell className="w-32 align-top text-right">
                          {canManageRequirements ? (
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => startRequirementEdit(requirement)}
                              >
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
                          ) : (
                            <span className="text-xs text-slate-500">Frozen</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {showRequirementForm ? (
                <div className="border-t border-slate-100 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {editingRequirement ? "Edit Requirement Row" : "Add Requirement Row"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetRequirementForm}
                        disabled={requirementBusy}
                      >
                        Cancel
                      </Button>
                      <Button type="button" size="sm" onClick={() => void handleSaveRequirement()} disabled={requirementBusy}>
                        {requirementBusy ? "Saving..." : editingRequirement ? "Save Requirement" : "Create Requirement"}
                      </Button>
                    </div>
                  </div>

                  {requirementFormError ? (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {requirementFormError}
                    </div>
                  ) : null}

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Input
                      label="Requirement Key"
                      value={requirementForm.requirement_key}
                      onChange={(event) =>
                        setRequirementForm((previous) => ({
                          ...previous,
                          requirement_key: event.target.value,
                        }))
                      }
                      disabled={requirementBusy}
                      placeholder="Optional internal code"
                    />

                    <Input
                      label="Requirement Section"
                      value={requirementForm.requirement_section}
                      onChange={(event) =>
                        setRequirementForm((previous) => ({
                          ...previous,
                          requirement_section: event.target.value,
                        }))
                      }
                      disabled={requirementBusy}
                      placeholder="Example: Functional Requirements"
                    />

                    <Input
                      label="Requirement Order"
                      type="number"
                      min={0}
                      value={requirementForm.requirement_order}
                      onChange={(event) =>
                        setRequirementForm((previous) => ({
                          ...previous,
                          requirement_order: event.target.value,
                        }))
                      }
                      disabled={requirementBusy}
                    />

                    <Input
                      label="Source Reference"
                      value={requirementForm.source_reference}
                      onChange={(event) =>
                        setRequirementForm((previous) => ({
                          ...previous,
                          source_reference: event.target.value,
                        }))
                      }
                      disabled={requirementBusy}
                      placeholder="Section heading, line marker, or paragraph reference"
                    />

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-sm font-medium text-slate-700">Requirement Text</label>
                      <Textarea
                        rows={4}
                        value={requirementForm.requirement_text}
                        onChange={(event) =>
                          setRequirementForm((previous) => ({
                            ...previous,
                            requirement_text: event.target.value,
                          }))
                        }
                        disabled={requirementBusy}
                        placeholder="Enter the exact requirement statement suppliers must respond against."
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Supplier Responses</p>
                  <p className="text-xs text-slate-500">
                    One supplier, one response row, with document bundles and a requirement-by-requirement matrix inside each response workspace.
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-semibold">Supplier</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Documents</TableHead>
                    <TableHead className="font-semibold">Quotation Ref</TableHead>
                    <TableHead className="font-semibold">Updated</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                        No suppliers are attached yet. Add participating suppliers to create response rows.
                      </TableCell>
                    </TableRow>
                  ) : (
                    responses.map((response) => (
                      <TableRow key={response.response_id} className="hover:bg-slate-50">
                        <TableCell className="align-top whitespace-normal">
                          <div className="font-medium text-slate-900">{response.supplier_name || "-"}</div>
                          <p className="mt-1 text-xs text-slate-500">{response.supplier_type || "Supplier"}</p>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge
                            variant="outline"
                            className={getSupplierResponseStatusBadgeClass(response.submission_status)}
                          >
                            {formatSupplierResponseStatus(response.submission_status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top text-slate-700">{response.document_count}</TableCell>
                        <TableCell className="align-top whitespace-normal text-slate-700">
                          {response.quotation_reference || "-"}
                        </TableCell>
                        <TableCell className="align-top text-slate-600">
                          {formatEvaluationDate(response.modified_dt || response.created_dt)}
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setResponseModalId(response.response_id)}
                            >
                              Open
                            </Button>
                            {canSubmitSupplierResponse(evaluation.status, response.submission_status) ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void handleQuickSubmit(response.response_id)}
                                disabled={
                                  actionBusy ||
                                  responseActionId === response.response_id ||
                                  response.document_count === 0
                                }
                              >
                                {responseActionId === response.response_id ? "Submitting..." : "Submit"}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Modal>

      <SupplierResponseModal
        open={Boolean(responseModalId)}
        responseId={responseModalId}
        sourceSystemOptions={sourceSystemOptions}
        onClose={() => setResponseModalId(null)}
        onSaved={async () => {
          await loadWorkspace();
          await onChanged();
        }}
      />

      <AlertDialog
        open={Boolean(requirementToDelete)}
        onOpenChange={(openState) => !openState && setRequirementToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Requirement Row</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this requirement row from the evaluation baseline? Any draft structured responses tied to it will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteRequirementBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteRequirement();
              }}
              disabled={deleteRequirementBusy}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteRequirementBusy ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
