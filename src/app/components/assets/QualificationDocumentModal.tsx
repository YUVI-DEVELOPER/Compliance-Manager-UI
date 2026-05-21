import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ReleaseRecord } from "../../../services/release.service";
import { SupplierRecord } from "../../../services/supplier.service";
import {
  acceptQualificationDocument,
  createQualificationDocument,
  getQualificationDocument,
  getQualificationDocumentHistory,
  QualificationDocumentActionRecord,
  QualificationDocumentRecord,
  rejectQualificationDocument,
  requestQualificationDocumentClarification,
  submitQualificationDocumentForReview,
  updateQualificationDocument,
} from "../../../services/qualification-document.service";
import { LookupOption } from "../../services/lookupValue.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DocumentUploadUrlField } from "./DocumentUploadUrlField";
import { Input } from "../ui/input";
import { Modal } from "../ui/Modal";
import { Textarea } from "../ui/textarea";
import {
  buildCreateQualificationDocumentPayload,
  buildInitialQualificationDocumentForm,
  buildUpdateQualificationDocumentPayload,
  canEditQualificationDocument,
  canReviewQualificationDocument,
  canSubmitQualificationDocument,
  formatQualificationActionType,
  formatQualificationDocumentDate,
  formatQualificationLinkedContext,
  formatQualificationStatus,
  getQualificationStatusBadgeClass,
  mapQualificationDocumentAxiosError,
  QualificationDocumentContext,
  QualificationDocumentFieldErrors,
  QualificationDocumentFormState,
  qualificationDocumentToForm,
  renderQualificationDocumentFieldError,
  validateQualificationDocumentForm,
} from "./qualificationDocumentForm.shared";

interface QualificationDocumentModalProps {
  open: boolean;
  context: QualificationDocumentContext;
  suppliers: SupplierRecord[];
  releaseOptions?: ReleaseRecord[];
  sourceSystemOptions?: LookupOption[];
  qualificationDocumentId: string | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const DEFAULT_ACTOR = "admin";

const formatValue = (value?: string | null): string => {
  if (!value || !value.trim()) return "-";
  return value;
};

export function QualificationDocumentModal({
  open,
  context,
  suppliers,
  releaseOptions = [],
  sourceSystemOptions = [],
  qualificationDocumentId,
  onClose,
  onSaved,
}: QualificationDocumentModalProps) {
  const isEditing = Boolean(qualificationDocumentId);
  const [document, setDocument] = useState<QualificationDocumentRecord | null>(null);
  const [history, setHistory] = useState<QualificationDocumentActionRecord[]>([]);
  const [formData, setFormData] = useState<QualificationDocumentFormState>(
    buildInitialQualificationDocumentForm(context),
  );
  const [initialFormData, setInitialFormData] = useState<QualificationDocumentFormState>(
    buildInitialQualificationDocumentForm(context),
  );
  const [workflowComment, setWorkflowComment] = useState("");
  const [fieldErrors, setFieldErrors] = useState<QualificationDocumentFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);

  const availableReleaseOptions = useMemo(
    () =>
      [...releaseOptions].sort((left, right) => {
        const leftValue = Date.parse(left.created_dt ?? left.modified_dt ?? "") || 0;
        const rightValue = Date.parse(right.created_dt ?? right.modified_dt ?? "") || 0;
        return rightValue - leftValue;
      }),
    [releaseOptions],
  );

  const selectedRelease = useMemo(
    () => availableReleaseOptions.find((item) => item.release_id === formData.release_id) ?? null,
    [availableReleaseOptions, formData.release_id],
  );
  const metadataEditable = !isEditing || canEditQualificationDocument(document?.status);
  const reviewable = canReviewQualificationDocument(document?.status);
  const submittable = canSubmitQualificationDocument(document?.status);

  const loadDocument = useCallback(async () => {
    if (!qualificationDocumentId) return;

    setLoading(true);
    setFieldErrors({});

    try {
      const [detail, detailHistory] = await Promise.all([
        getQualificationDocument(qualificationDocumentId),
        getQualificationDocumentHistory(qualificationDocumentId),
      ]);
      const nextForm = qualificationDocumentToForm(detail);
      setDocument(detail);
      setHistory(detailHistory);
      setFormData(nextForm);
      setInitialFormData(nextForm);
    } catch (error) {
      const mapped = mapQualificationDocumentAxiosError(error);
      toast.error(mapped.message);
      onClose();
    } finally {
      setLoading(false);
    }
  }, [onClose, qualificationDocumentId]);

  useEffect(() => {
    if (!open) return;

    if (qualificationDocumentId) {
      void loadDocument();
      return;
    }

    const nextForm = buildInitialQualificationDocumentForm(context);
    setDocument(null);
    setHistory([]);
    setFormData(nextForm);
    setInitialFormData(nextForm);
    setWorkflowComment("");
    setFieldErrors({});
    setLoading(false);
    setSubmitting(false);
    setWorkflowBusy(false);
  }, [context, loadDocument, open, qualificationDocumentId]);

  useEffect(() => {
    if (open) return;

    const nextForm = buildInitialQualificationDocumentForm(context);
    setDocument(null);
    setHistory([]);
    setFormData(nextForm);
    setInitialFormData(nextForm);
    setWorkflowComment("");
    setFieldErrors({});
    setLoading(false);
    setSubmitting(false);
    setWorkflowBusy(false);
  }, [context, open]);

  const updateField = <K extends keyof QualificationDocumentFormState>(
    key: K,
    value: QualificationDocumentFormState[K],
  ) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || submitting || workflowBusy) return;

    const validationErrors = validateQualificationDocumentForm(formData, context);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      if (qualificationDocumentId) {
        const payload = buildUpdateQualificationDocumentPayload(
          initialFormData,
          formData,
          context,
          DEFAULT_ACTOR,
        );
        if (Object.keys(payload).length === 1 && payload.modified_by) {
          toast.message("No changes to save");
          setSubmitting(false);
          return;
        }

        await updateQualificationDocument(qualificationDocumentId, payload);
        toast.success("Qualification document updated successfully");
      } else {
        const payload = buildCreateQualificationDocumentPayload(formData, context, DEFAULT_ACTOR);
        await createQualificationDocument(payload);
        toast.success("Qualification document registered successfully");
      }

      await onSaved();
      onClose();
    } catch (error) {
      const mapped = mapQualificationDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  const runWorkflowAction = async (
    action: "submit" | "accept" | "reject" | "clarification",
  ) => {
    if (!qualificationDocumentId || workflowBusy) return;

    setWorkflowBusy(true);
    setFieldErrors({});

    try {
      if (action === "submit") {
        await submitQualificationDocumentForReview(qualificationDocumentId, {
          action_by: DEFAULT_ACTOR,
          comment_text: workflowComment.trim() || undefined,
        });
        toast.success("Qualification document submitted for review");
      }
      if (action === "accept") {
        await acceptQualificationDocument(qualificationDocumentId, {
          action_by: DEFAULT_ACTOR,
          comment_text: workflowComment.trim() || undefined,
        });
        toast.success("Qualification document accepted");
      }
      if (action === "reject") {
        await rejectQualificationDocument(qualificationDocumentId, {
          action_by: DEFAULT_ACTOR,
          comment_text: workflowComment.trim() || undefined,
        });
        toast.success("Qualification document rejected");
      }
      if (action === "clarification") {
        await requestQualificationDocumentClarification(qualificationDocumentId, {
          action_by: DEFAULT_ACTOR,
          comment_text: workflowComment.trim() || undefined,
        });
        toast.success("Clarification requested for qualification document");
      }

      setWorkflowComment("");
      await Promise.all([loadDocument(), Promise.resolve(onSaved())]);
    } catch (error) {
      const mapped = mapQualificationDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setWorkflowBusy(false);
    }
  };

  const showReleaseSelector =
    context.type === "asset" &&
    (availableReleaseOptions.length > 0 || formData.context_scope === "RELEASE" || Boolean(document?.release_id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? "Qualification Document" : "Add Qualification Document"}
      size="xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting || workflowBusy}>
            {isEditing ? "Close" : "Cancel"}
          </Button>
          {metadataEditable ? (
            <Button
              type="submit"
              form="qualification-document-form"
              disabled={loading || submitting || workflowBusy}
            >
              {submitting ? "Saving..." : isEditing ? "Save Changes" : "Register Document"}
            </Button>
          ) : null}
        </>
      }
    >
      {loading ? (
        <div className="text-sm text-slate-600">Loading qualification document...</div>
      ) : (
        <form
          id="qualification-document-form"
          className="space-y-5"
          onSubmit={(event) => void handleSubmit(event)}
        >
          {renderQualificationDocumentFieldError(fieldErrors, "form")}

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Asset Name</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(context.assetName)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{context.type === "release" ? "Release Version" : "Asset ID"}</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatValue(context.type === "release" ? context.releaseVersion : context.assetCode)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Context</p>
                <p className="text-sm font-medium text-slate-900">
                  {context.type === "release"
                    ? "Release-linked validation evidence"
                    : formData.context_scope === "RELEASE"
                      ? formatValue(selectedRelease?.version ? `Release ${selectedRelease.version}` : "Release-linked")
                      : "Asset-level validation evidence"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                {document ? (
                  <Badge
                    variant="outline"
                    className={`mt-1 ${getQualificationStatusBadgeClass(document.status)}`}
                  >
                    {formatQualificationStatus(document.status)}
                  </Badge>
                ) : (
                  <p className="text-sm font-medium text-slate-900">Submitted</p>
                )}
              </div>
            </div>
          </div>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Qualification Context</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Qualification Type</label>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                  value={formData.qualification_type}
                  onChange={(event) => updateField("qualification_type", event.target.value)}
                  disabled={!metadataEditable}
                >
                  <option value="IQ">IQ</option>
                  <option value="OQ">OQ</option>
                  <option value="PQ">PQ</option>
                </select>
                {renderQualificationDocumentFieldError(fieldErrors, "qualification_type")}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Supplier</label>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                  value={formData.supplier_id}
                  onChange={(event) => updateField("supplier_id", event.target.value)}
                  disabled={!metadataEditable}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.supplier_id} value={supplier.supplier_id}>
                      {supplier.supplier_name}
                    </option>
                  ))}
                </select>
                {renderQualificationDocumentFieldError(fieldErrors, "supplier_id")}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Linked Context</label>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                  value={formData.context_scope}
                  onChange={(event) =>
                    updateField("context_scope", event.target.value as QualificationDocumentFormState["context_scope"])
                  }
                  disabled={!metadataEditable || context.type === "release"}
                >
                  <option value="ASSET">Asset-level</option>
                  {showReleaseSelector ? <option value="RELEASE">Specific release</option> : null}
                </select>
                {renderQualificationDocumentFieldError(fieldErrors, "context_scope")}
              </div>

              {context.type === "asset" && formData.context_scope === "RELEASE" ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Release</label>
                  <select
                    className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                    value={formData.release_id}
                    onChange={(event) => updateField("release_id", event.target.value)}
                    disabled={!metadataEditable}
                  >
                    <option value="">Select release</option>
                    {availableReleaseOptions.map((release) => (
                      <option key={release.release_id} value={release.release_id}>
                        {release.version}
                      </option>
                    ))}
                  </select>
                  {renderQualificationDocumentFieldError(fieldErrors, "release_id")}
                </div>
              ) : null}
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Document Reference</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Input
                  label="Document Name"
                  value={formData.document_name}
                  onChange={(event) => updateField("document_name", event.target.value)}
                  disabled={!metadataEditable}
                />
                {renderQualificationDocumentFieldError(fieldErrors, "document_name")}
              </div>

              <div className="space-y-1">
                <Input
                  label="Document Version"
                  value={formData.document_version}
                  onChange={(event) => updateField("document_version", event.target.value)}
                  disabled={!metadataEditable}
                />
                {renderQualificationDocumentFieldError(fieldErrors, "document_version")}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Source System</label>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                  value={formData.source_system}
                  onChange={(event) => updateField("source_system", event.target.value)}
                  disabled={!metadataEditable}
                >
                  <option value="">Select source system</option>
                  {sourceSystemOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.value}
                    </option>
                  ))}
                </select>
                {renderQualificationDocumentFieldError(fieldErrors, "source_system")}
              </div>

              <div className="space-y-1">
                <Input
                  label="External Document ID"
                  value={formData.external_document_id}
                  onChange={(event) => updateField("external_document_id", event.target.value)}
                  disabled={!metadataEditable}
                />
                {renderQualificationDocumentFieldError(fieldErrors, "external_document_id")}
              </div>

              <div className="space-y-1">
                <DocumentUploadUrlField
                  label="Document URL"
                  value={formData.document_url}
                  onChange={(value) => updateField("document_url", value)}
                  disabled={!metadataEditable}
                  error={fieldErrors.document_url}
                  uploadCategory="qualification-documents"
                  onUploaded={(uploaded) => {
                    setFormData((previous) => ({
                      ...previous,
                      document_url: uploaded.access_url,
                      document_name: previous.document_name.trim() ? previous.document_name : uploaded.original_file_name,
                      source_reference: previous.source_reference.trim()
                        ? previous.source_reference
                        : uploaded.original_file_name,
                    }));
                  }}
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Submission Date"
                  type="datetime-local"
                  value={formData.submission_date}
                  onChange={(event) => updateField("submission_date", event.target.value)}
                  disabled={!metadataEditable}
                />
                {renderQualificationDocumentFieldError(fieldErrors, "submission_date")}
              </div>

              <div className="space-y-1 md:col-span-2">
                <Input
                  label="Source Reference"
                  value={formData.source_reference}
                  onChange={(event) => updateField("source_reference", event.target.value)}
                  disabled={!metadataEditable}
                />
                {renderQualificationDocumentFieldError(fieldErrors, "source_reference")}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Notes</h4>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Notes</label>
              <Textarea
                rows={4}
                value={formData.notes}
                onChange={(event) => updateField("notes", event.target.value)}
                placeholder="Capture qualification scope, supplier remarks, or evidence notes"
                disabled={!metadataEditable}
              />
              {renderQualificationDocumentFieldError(fieldErrors, "notes")}
            </div>
          </section>

          {document ? (
            <>
              <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Workflow</h4>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Current Status</p>
                    <Badge
                      variant="outline"
                      className={`mt-2 ${getQualificationStatusBadgeClass(document.status)}`}
                    >
                      {formatQualificationStatus(document.status)}
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Supplier Context</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{formatValue(document.supplier_name)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Linked Context</p>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      {formatQualificationLinkedContext(document)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Review Comment</label>
                  <Textarea
                    rows={3}
                    value={workflowComment}
                    onChange={(event) => setWorkflowComment(event.target.value)}
                    placeholder="Add optional review remarks. Reject and clarification actions require a comment."
                    disabled={workflowBusy}
                  />
                  {renderQualificationDocumentFieldError(fieldErrors, "comment_text")}
                </div>

                <div className="flex flex-wrap gap-2">
                  {submittable ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void runWorkflowAction("submit")}
                      disabled={workflowBusy}
                    >
                      {workflowBusy ? "Working..." : "Submit for Review"}
                    </Button>
                  ) : null}
                  {reviewable ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => void runWorkflowAction("accept")}
                        disabled={workflowBusy}
                      >
                        {workflowBusy ? "Working..." : "Accept"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void runWorkflowAction("clarification")}
                        disabled={workflowBusy}
                      >
                        {workflowBusy ? "Working..." : "Request Clarification"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-red-200 text-red-700 hover:bg-red-50"
                        onClick={() => void runWorkflowAction("reject")}
                        disabled={workflowBusy}
                      >
                        {workflowBusy ? "Working..." : "Reject"}
                      </Button>
                    </>
                  ) : null}
                </div>
              </section>

              <section className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Review History</h4>
                  <p className="mt-1 text-xs text-slate-500">
                    Status transitions and review comments are retained here for auditability.
                  </p>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  {history.length === 0 ? (
                    <p className="text-sm text-slate-500">No workflow history recorded yet.</p>
                  ) : (
                    history.map((action) => (
                      <div
                        key={action.id}
                        className="rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {formatQualificationActionType(action.action_type)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatQualificationStatus(action.from_status)} to{" "}
                              {formatQualificationStatus(action.to_status)}
                            </p>
                          </div>
                          <div className="text-xs text-slate-500 md:text-right">
                            <p>{formatQualificationDocumentDate(action.action_dt)}</p>
                            <p className="mt-1">By {formatValue(action.action_by)}</p>
                          </div>
                        </div>
                        {action.comment_text?.trim() ? (
                          <p className="mt-3 text-sm text-slate-700">{action.comment_text}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs text-slate-500">Record Created</p>
                    <p className="text-sm font-medium text-slate-900">
                      {formatQualificationDocumentDate(document.created_dt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Last Updated</p>
                    <p className="text-sm font-medium text-slate-900">
                      {formatQualificationDocumentDate(document.modified_dt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Registered Context</p>
                    <p className="text-sm font-medium text-slate-900">{formatQualificationLinkedContext(document)}</p>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </form>
      )}
    </Modal>
  );
}
