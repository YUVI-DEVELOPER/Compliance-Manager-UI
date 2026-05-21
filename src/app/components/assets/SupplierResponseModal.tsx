import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  bulkSaveSupplierRequirementResponses,
  createSupplierResponseDocument,
  deleteSupplierResponseDocument,
  getSupplierEvaluationResponse,
  getSupplierResponseRequirements,
  SupplierEvaluationResponseDetailRecord,
  SupplierRequirementResponseMatrixRowRecord,
  submitSupplierEvaluationResponse,
  updateSupplierEvaluationResponse,
} from "../../../services/supplier-evaluation.service";
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
import { Input, SearchInput } from "../ui/input";
import { Modal } from "../ui/Modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Textarea } from "../ui/textarea";
import { DocumentUploadUrlField } from "./DocumentUploadUrlField";
import { OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS } from "./documentLinkForm.shared";
import {
  canEditSupplierResponse,
  canSubmitSupplierResponse,
  DEFAULT_SUPPLIER_EVALUATION_ACTOR,
  formatEvaluationDate,
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

interface SupplierResponseModalProps {
  open: boolean;
  responseId: string | null;
  sourceSystemOptions?: LookupOption[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

interface ResponseFormState {
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

const EMPTY_RESPONSE_FORM: ResponseFormState = {
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

export function SupplierResponseModal({
  open,
  responseId,
  sourceSystemOptions = [],
  onClose,
  onSaved,
}: SupplierResponseModalProps) {
  const availableSourceSystemOptions = useMemo(
    () => (sourceSystemOptions.length > 0 ? sourceSystemOptions : OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS),
    [sourceSystemOptions],
  );

  const [detail, setDetail] = useState<SupplierEvaluationResponseDetailRecord | null>(null);
  const [requirementRows, setRequirementRows] = useState<SupplierRequirementResponseMatrixRowRecord[]>([]);
  const [initialRequirementRows, setInitialRequirementRows] = useState<SupplierRequirementResponseMatrixRowRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [responseForm, setResponseForm] = useState<ResponseFormState>(EMPTY_RESPONSE_FORM);
  const [initialResponseForm, setInitialResponseForm] = useState<ResponseFormState>(EMPTY_RESPONSE_FORM);
  const [documentForm, setDocumentForm] = useState<DocumentFormState>(createEmptyDocumentForm(""));
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [requirementSearch, setRequirementSearch] = useState("");
  const [fitFilter, setFitFilter] = useState("ALL");
  const [documentToDelete, setDocumentToDelete] = useState<{
    document_id: string;
    document_name: string;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const canEdit = canEditSupplierResponse(detail?.evaluation_status, detail?.submission_status);
  const canSubmit = canSubmitSupplierResponse(detail?.evaluation_status, detail?.submission_status);

  const loadResponse = async () => {
    if (!responseId) return;

    setLoading(true);
    try {
      const [nextDetail, nextRequirementRows] = await Promise.all([
        getSupplierEvaluationResponse(responseId),
        getSupplierResponseRequirements(responseId),
      ]);
      const nextForm = {
        quotation_reference: nextDetail.quotation_reference ?? "",
        notes: nextDetail.notes ?? "",
      };
      setDetail(nextDetail);
      setResponseForm(nextForm);
      setInitialResponseForm(nextForm);
      setRequirementRows(nextRequirementRows);
      setInitialRequirementRows(nextRequirementRows);
      setGeneralError(null);
    } catch (error) {
      const message = mapSupplierEvaluationAxiosError(error);
      setGeneralError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !responseId) {
      setDetail(null);
      setRequirementRows([]);
      setInitialRequirementRows([]);
      setLoading(false);
      setSaving(false);
      setWorkflowBusy(false);
      setDocumentBusy(false);
      setGeneralError(null);
      setDocumentError(null);
      setRequirementSearch("");
      setFitFilter("ALL");
      setDocumentToDelete(null);
      setDeleteBusy(false);
      setResponseForm(EMPTY_RESPONSE_FORM);
      setInitialResponseForm(EMPTY_RESPONSE_FORM);
      setDocumentForm(createEmptyDocumentForm(availableSourceSystemOptions[0]?.code ?? ""));
      return;
    }

    void loadResponse();
  }, [availableSourceSystemOptions, open, responseId]);

  useEffect(() => {
    if (!open) return;
    setDocumentForm((previous) => ({
      ...previous,
      source_system: previous.source_system || availableSourceSystemOptions[0]?.code || "",
    }));
  }, [availableSourceSystemOptions, open]);

  const responseDirty = useMemo(
    () =>
      responseForm.quotation_reference.trim() !== initialResponseForm.quotation_reference.trim() ||
      responseForm.notes.trim() !== initialResponseForm.notes.trim(),
    [initialResponseForm.notes, initialResponseForm.quotation_reference, responseForm.notes, responseForm.quotation_reference],
  );

  const initialRequirementMap = useMemo(
    () => new Map(initialRequirementRows.map((row) => [row.requirement_item_id, row])),
    [initialRequirementRows],
  );

  const requirementDirty = useMemo(
    () =>
      requirementRows.some((row) => !requirementsMatch(row, initialRequirementMap.get(row.requirement_item_id))),
    [initialRequirementMap, requirementRows],
  );

  const totalRequirementCount = requirementRows.length;
  const answeredRequirementCount = useMemo(
    () => requirementRows.filter((row) => Boolean(row.fit_status)).length,
    [requirementRows],
  );
  const meetsCount = useMemo(
    () => requirementRows.filter((row) => row.fit_status === "MEETS").length,
    [requirementRows],
  );
  const gapCount = useMemo(
    () =>
      requirementRows.filter(
        (row) => row.fit_status === "PARTIALLY_MEETS" || row.fit_status === "NOT_MEETS",
      ).length,
    [requirementRows],
  );

  const filteredRequirementRows = useMemo(() => {
    const searchValue = requirementSearch.trim().toLowerCase();
    return requirementRows.filter((row) => {
      const matchesSearch =
        searchValue.length === 0 ||
        row.requirement_text.toLowerCase().includes(searchValue) ||
        (row.requirement_section ?? "").toLowerCase().includes(searchValue) ||
        (row.requirement_key ?? "").toLowerCase().includes(searchValue);
      const matchesFit = fitFilter === "ALL" || (row.fit_status ?? "") === fitFilter;
      return matchesSearch && matchesFit;
    });
  }, [fitFilter, requirementRows, requirementSearch]);

  const resetDocumentForm = () => {
    setDocumentForm(createEmptyDocumentForm(availableSourceSystemOptions[0]?.code ?? ""));
    setDocumentError(null);
  };

  const updateRequirementDraft = (
    requirementItemId: string,
    field: "fit_status" | "supplier_response_text" | "evidence_reference" | "notes",
    value: string,
  ) => {
    setRequirementRows((previous) =>
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

  const persistResponseHeader = async () => {
    if (!responseId || !responseDirty) return;
    const updated = await updateSupplierEvaluationResponse(responseId, {
      modified_by: DEFAULT_SUPPLIER_EVALUATION_ACTOR,
      quotation_reference: responseForm.quotation_reference.trim() || null,
      notes: responseForm.notes.trim() || null,
    });
    const nextForm = {
      quotation_reference: updated.quotation_reference ?? "",
      notes: updated.notes ?? "",
    };
    setDetail(updated);
    setResponseForm(nextForm);
    setInitialResponseForm(nextForm);
  };

  const persistRequirementMatrix = async () => {
    if (!responseId || !requirementDirty) return;
    const changedRows = requirementRows
      .filter((row) => !requirementsMatch(row, initialRequirementMap.get(row.requirement_item_id)))
      .map((row) => normalizeRequirementDraft(row));

    if (changedRows.length === 0) {
      return;
    }

    const updatedRows = await bulkSaveSupplierRequirementResponses(responseId, {
      modified_by: DEFAULT_SUPPLIER_EVALUATION_ACTOR,
      items: changedRows,
    });
    setRequirementRows(updatedRows);
    setInitialRequirementRows(updatedRows);
    setDetail((previous) =>
      previous && previous.submission_status === "NOT_STARTED"
        ? {
            ...previous,
            submission_status: "IN_PROGRESS",
          }
        : previous,
    );
  };

  const handleSaveAll = async ({ showToast = true }: { showToast?: boolean } = {}): Promise<boolean> => {
    if (!canEdit || (!responseDirty && !requirementDirty)) {
      return true;
    }

    let changedAny = false;
    setSaving(true);
    try {
      if (responseDirty) {
        await persistResponseHeader();
        changedAny = true;
      }
      if (requirementDirty) {
        await persistRequirementMatrix();
        changedAny = true;
      }
      setGeneralError(null);
      if (changedAny && showToast) {
        toast.success("Supplier response saved successfully");
      }
      return true;
    } catch (error) {
      const message = mapSupplierEvaluationAxiosError(error);
      setGeneralError(message);
      toast.error(message);
      return false;
    } finally {
      if (changedAny) {
        await onSaved();
      }
      setSaving(false);
    }
  };

  const handleSubmitResponse = async () => {
    if (!responseId || !canSubmit) {
      return;
    }

    setWorkflowBusy(true);
    try {
      const saved = await handleSaveAll({ showToast: false });
      if (!saved) {
        return;
      }

      const submitted = await submitSupplierEvaluationResponse(responseId, {
        action_by: DEFAULT_SUPPLIER_EVALUATION_ACTOR,
      });
      setDetail(submitted);
      setResponseForm({
        quotation_reference: submitted.quotation_reference ?? "",
        notes: submitted.notes ?? "",
      });
      setInitialResponseForm({
        quotation_reference: submitted.quotation_reference ?? "",
        notes: submitted.notes ?? "",
      });
      setGeneralError(null);
      await onSaved();
      toast.success("Supplier response submitted successfully");
    } catch (error) {
      const message = mapSupplierEvaluationAxiosError(error);
      setGeneralError(message);
      toast.error(message);
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleAddDocument = async (event: FormEvent) => {
    event.preventDefault();
    if (!responseId || !canEdit || documentBusy) {
      return;
    }

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
      await createSupplierResponseDocument(responseId, {
        document_type: documentForm.document_type,
        source_system: documentForm.source_system || null,
        external_document_id: documentForm.external_document_id.trim() || null,
        document_name: documentForm.document_name.trim(),
        document_version: documentForm.document_version.trim() || null,
        upload_dt: documentForm.upload_dt,
        access_url: documentForm.access_url.trim(),
        source_reference: documentForm.source_reference.trim() || null,
        notes: documentForm.notes.trim() || null,
        created_by: DEFAULT_SUPPLIER_EVALUATION_ACTOR,
      });
      await loadResponse();
      await onSaved();
      resetDocumentForm();
      toast.success("Response document added successfully");
    } catch (error) {
      const message = mapSupplierEvaluationAxiosError(error);
      setDocumentError(message);
      toast.error(message);
    } finally {
      setDocumentBusy(false);
    }
  };

  const handleDeleteDocument = async () => {
    if (!documentToDelete) return;

    setDeleteBusy(true);
    try {
      await deleteSupplierResponseDocument(documentToDelete.document_id);
      await loadResponse();
      await onSaved();
      setDocumentToDelete(null);
      toast.success("Response document deleted successfully");
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Supplier Response Detail"
        description="Capture supplier notes, supporting documents, and requirement-by-requirement fit responses before submission or evaluation lock."
        size="xl"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving || workflowBusy || documentBusy}>
              Close
            </Button>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSaveAll()}
                disabled={saving || workflowBusy || documentBusy || (!responseDirty && !requirementDirty)}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            ) : null}
            {canSubmit ? (
              <Button
                type="button"
                onClick={() => void handleSubmitResponse()}
                disabled={workflowBusy || documentBusy || !detail || detail.documents.length === 0}
              >
                {workflowBusy ? "Submitting..." : "Submit Response"}
              </Button>
            ) : null}
          </>
        }
      >
        {loading ? (
          <div className="py-8 text-sm text-slate-600">Loading supplier response...</div>
        ) : !detail ? (
          <div className="py-8 text-sm text-slate-600">No supplier response selected.</div>
        ) : (
          <div className="space-y-5">
            {generalError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {generalError}
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <div>
                  <p className="text-xs text-slate-500">Supplier</p>
                  <p className="text-sm font-medium text-slate-900">{detail.supplier_name || "-"}</p>
                  <p className="text-xs text-slate-500">{detail.supplier_type || "Supplier"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Response Status</p>
                  <Badge
                    variant="outline"
                    className={getSupplierResponseStatusBadgeClass(detail.submission_status)}
                  >
                    {formatSupplierResponseStatus(detail.submission_status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Submitted</p>
                  <p className="text-sm font-medium text-slate-900">{formatEvaluationDate(detail.submitted_at)}</p>
                  <p className="text-xs text-slate-500">{detail.submitted_by || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Requirement Rows</p>
                  <p className="text-sm font-medium text-slate-900">
                    {answeredRequirementCount} / {totalRequirementCount}
                  </p>
                  <p className="text-xs text-slate-500">Answered / total</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Documents</p>
                  <p className="text-sm font-medium text-slate-900">{detail.documents.length}</p>
                  <p className="text-xs text-slate-500">
                    Evaluation: {detail.evaluation_status.split("_").join(" ")}
                  </p>
                </div>
              </div>

              {!canEdit ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  This supplier response is controlled. Header fields, requirement matrix answers, and document changes are disabled after submission or evaluation lock.
                </div>
              ) : null}
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Response Notes</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Input
                    label="Quotation Reference"
                    value={responseForm.quotation_reference}
                    onChange={(event) =>
                      setResponseForm((previous) => ({
                        ...previous,
                        quotation_reference: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                    placeholder="Supplier quotation or bid reference"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Notes</label>
                  <Textarea
                    rows={4}
                    value={responseForm.notes}
                    onChange={(event) =>
                      setResponseForm((previous) => ({
                        ...previous,
                        notes: event.target.value,
                      }))
                    }
                    disabled={!canEdit}
                    placeholder="Add optional notes about the supplier response, assumptions, or clarifications."
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Requirement Responses</p>
                </div>
                {totalRequirementCount > 0 ? (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p>
                      <p className="text-sm font-semibold text-slate-900">{totalRequirementCount}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Answered</p>
                      <p className="text-sm font-semibold text-slate-900">{answeredRequirementCount}</p>
                    </div>
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-emerald-700">Meets</p>
                      <p className="text-sm font-semibold text-emerald-800">{meetsCount}</p>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-amber-700">Gaps</p>
                      <p className="text-sm font-semibold text-amber-800">{gapCount}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {totalRequirementCount === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  No requirement baseline exists.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
                    <SearchInput
                      value={requirementSearch}
                      onChange={(event) => setRequirementSearch(event.target.value)}
                      onClear={() => setRequirementSearch("")}
                      placeholder="Search requirement text, section, or key"
                    />
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Fit Status Filter</label>
                      <select
                        className="h-9 w-full rounded-md border border-slate-200 bg-input-background px-3 text-sm"
                        value={fitFilter}
                        onChange={(event) => setFitFilter(event.target.value)}
                      >
                        <option value="ALL">All statuses</option>
                        {SUPPLIER_REQUIREMENT_FIT_STATUS_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="max-h-[30rem] overflow-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="font-semibold">Requirement</TableHead>
                          <TableHead className="font-semibold">Fit Status</TableHead>
                          <TableHead className="font-semibold">Supplier Response</TableHead>
                          <TableHead className="font-semibold">Evidence Reference</TableHead>
                          <TableHead className="font-semibold">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRequirementRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                              No requirement rows match the current search or fit-status filter.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRequirementRows.map((row) => (
                            <TableRow key={row.requirement_item_id} className="align-top hover:bg-slate-50">
                              <TableCell className="min-w-[20rem] align-top whitespace-normal">
                                <div className="space-y-1">
                                  <div className="text-sm font-medium text-slate-900">
                                    {row.requirement_section || "General"}
                                  </div>
                                  <p className="text-sm text-slate-700">{row.requirement_text}</p>
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span>{row.requirement_key || "No key"}</span>
                                    <span>{row.source_reference || "No source reference"}</span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="min-w-[11rem] align-top">
                                {canEdit ? (
                                  <select
                                    className="h-9 w-full rounded-md border border-slate-200 bg-input-background px-3 text-sm"
                                    value={row.fit_status ?? ""}
                                    onChange={(event) =>
                                      updateRequirementDraft(row.requirement_item_id, "fit_status", event.target.value)
                                    }
                                  >
                                    <option value="">Select fit status</option>
                                    {SUPPLIER_REQUIREMENT_FIT_STATUS_OPTIONS.map((option) => (
                                      <option key={option.code} value={option.code}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : row.fit_status ? (
                                  <Badge
                                    variant="outline"
                                    className={getSupplierRequirementFitStatusBadgeClass(row.fit_status)}
                                  >
                                    {formatSupplierRequirementFitStatus(row.fit_status)}
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-slate-500">Not answered</span>
                                )}
                              </TableCell>
                              <TableCell className="min-w-[16rem] align-top">
                                {canEdit ? (
                                  <Textarea
                                    rows={3}
                                    value={row.supplier_response_text ?? ""}
                                    onChange={(event) =>
                                      updateRequirementDraft(
                                        row.requirement_item_id,
                                        "supplier_response_text",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Explain how the supplier meets or partially meets this requirement"
                                  />
                                ) : (
                                  <div className="whitespace-pre-wrap text-sm text-slate-700">
                                    {row.supplier_response_text || "-"}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="min-w-[14rem] align-top">
                                {canEdit ? (
                                  <input
                                    className="h-9 w-full rounded-md border border-slate-200 bg-input-background px-3 text-sm outline-none focus:border-slate-300"
                                    value={row.evidence_reference ?? ""}
                                    onChange={(event) =>
                                      updateRequirementDraft(
                                        row.requirement_item_id,
                                        "evidence_reference",
                                        event.target.value,
                                      )
                                    }
                                    placeholder="Document section, URL, attachment name, or page reference"
                                  />
                                ) : (
                                  <div className="whitespace-pre-wrap text-sm text-slate-700">
                                    {row.evidence_reference || "-"}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="min-w-[16rem] align-top">
                                {canEdit ? (
                                  <Textarea
                                    rows={3}
                                    value={row.notes ?? ""}
                                    onChange={(event) =>
                                      updateRequirementDraft(row.requirement_item_id, "notes", event.target.value)
                                    }
                                    placeholder="Optional internal notes or clarifications"
                                  />
                                ) : (
                                  <div className="whitespace-pre-wrap text-sm text-slate-700">{row.notes || "-"}</div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Response Documents</p>
                <p className="text-xs text-slate-500">
                  Documents stay explicitly bound to this supplier response and remain separate from generic asset linked documents.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200">
                <Table>
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
                    {detail.documents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                          No response documents have been attached yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      detail.documents.map((document) => {
                        const safeUrl = getSafeAccessUrl(document.access_url);
                        return (
                          <TableRow key={document.document_id} className="hover:bg-slate-50">
                            <TableCell className="align-top">
                              {formatSupplierResponseDocumentType(document.document_type)}
                            </TableCell>
                            <TableCell className="align-top whitespace-normal">
                              <div className="font-medium text-slate-900">{document.document_name}</div>
                              <p className="mt-1 text-xs text-slate-500">
                                {document.document_version || "No version"}
                                {document.external_document_id ? ` | ${document.external_document_id}` : ""}
                              </p>
                            </TableCell>
                            <TableCell className="align-top whitespace-normal text-slate-600">
                              {document.source_system || "-"}
                            </TableCell>
                            <TableCell className="align-top text-slate-600">
                              {formatEvaluationDate(document.upload_dt)}
                            </TableCell>
                            <TableCell className="align-top text-right">
                              <div className="flex items-center justify-end gap-2">
                                {safeUrl ? (
                                  <Button type="button" variant="ghost" size="sm" asChild>
                                    <a href={safeUrl} target="_blank" rel="noopener noreferrer">
                                      Open
                                    </a>
                                  </Button>
                                ) : null}
                                {canEdit ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() =>
                                      setDocumentToDelete({
                                        document_id: document.document_id,
                                        document_name: document.document_name,
                                      })
                                    }
                                  >
                                    Delete
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

              {canEdit ? (
                <form className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={(event) => void handleAddDocument(event)}>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Add Response Document</p>
                  </div>

                  {documentError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {documentError}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Document Type</label>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                        value={documentForm.document_type}
                        onChange={(event) =>
                          setDocumentForm((previous) => ({
                            ...previous,
                            document_type: event.target.value,
                          }))
                        }
                        disabled={documentBusy}
                      >
                        {SUPPLIER_RESPONSE_DOCUMENT_TYPE_OPTIONS.map((option) => (
                          <option key={option.code} value={option.code}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Source System</label>
                      <select
                        className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                        value={documentForm.source_system}
                        onChange={(event) =>
                          setDocumentForm((previous) => ({
                            ...previous,
                            source_system: event.target.value,
                          }))
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
                    </div>

                    <div className="space-y-1">
                      <Input
                        label="Document Name"
                        value={documentForm.document_name}
                        onChange={(event) =>
                          setDocumentForm((previous) => ({
                            ...previous,
                            document_name: event.target.value,
                          }))
                        }
                        disabled={documentBusy}
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Input
                        label="Document Version"
                        value={documentForm.document_version}
                        onChange={(event) =>
                          setDocumentForm((previous) => ({
                            ...previous,
                            document_version: event.target.value,
                          }))
                        }
                        disabled={documentBusy}
                      />
                    </div>

                    <div className="space-y-1">
                      <Input
                        label="External Document ID"
                        value={documentForm.external_document_id}
                        onChange={(event) =>
                          setDocumentForm((previous) => ({
                            ...previous,
                            external_document_id: event.target.value,
                          }))
                        }
                        disabled={documentBusy}
                      />
                    </div>

                    <div className="space-y-1">
                      <Input
                        label="Upload Date"
                        type="datetime-local"
                        value={documentForm.upload_dt}
                        onChange={(event) =>
                          setDocumentForm((previous) => ({
                            ...previous,
                            upload_dt: event.target.value,
                          }))
                        }
                        disabled={documentBusy}
                        required
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
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
                            document_name: previous.document_name.trim()
                              ? previous.document_name
                              : uploaded.original_file_name,
                            source_reference: previous.source_reference.trim()
                              ? previous.source_reference
                              : uploaded.original_file_name,
                            upload_dt: previous.upload_dt || normalizeDateTimeInput(new Date().toISOString()),
                          }));
                        }}
                      />
                    </div>

                    <div className="space-y-1">
                      <Input
                        label="Source Reference"
                        value={documentForm.source_reference}
                        onChange={(event) =>
                          setDocumentForm((previous) => ({
                            ...previous,
                            source_reference: event.target.value,
                          }))
                        }
                        disabled={documentBusy}
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-sm font-medium text-slate-700">Document Notes</label>
                      <Textarea
                        rows={3}
                        value={documentForm.notes}
                        onChange={(event) =>
                          setDocumentForm((previous) => ({
                            ...previous,
                            notes: event.target.value,
                          }))
                        }
                        disabled={documentBusy}
                        placeholder="Optional notes for this response document"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={resetDocumentForm} disabled={documentBusy}>
                      Reset
                    </Button>
                    <Button type="submit" disabled={documentBusy}>
                      {documentBusy ? "Adding..." : "Add Document"}
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <AlertDialog open={Boolean(documentToDelete)} onOpenChange={(openState) => !openState && setDocumentToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Response Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.document_name}" from this supplier response?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteDocument();
              }}
              disabled={deleteBusy}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteBusy ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
