import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import {
  DocumentAiAutofillBadge,
  DocumentAiAutofillControls,
  DocumentAiAutofillFieldHint,
} from "./DocumentAiAutofillControls";
import { DocumentUploadUrlField } from "./DocumentUploadUrlField";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Modal } from "../ui/Modal";
import { LookupOption } from "../../services/lookupValue.service";
import {
  analyzeDocumentLinkAutofill,
  getDocumentLink,
  updateDocumentLink,
} from "../../../services/document-link.service";
import { UploadedDocumentFileRecord } from "../../../services/file-upload.service";
import {
  buildUpdateDocumentLinkPayload,
  DOCUMENT_LINK_TYPE_OPTIONS,
  DocumentAiAutofillField,
  documentLinkToForm,
  DocumentLinkContext,
  DocumentLinkFieldErrors,
  DocumentLinkFormState,
  EMPTY_DOCUMENT_LINK_FORM,
  EMPTY_DOCUMENT_AI_AUTOFILL_STATE,
  OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS,
  formatLocalDateTimeInput,
  formatDocumentLinkDate,
  mapDocumentLinkAxiosError,
  renderDocumentLinkFieldError,
  validateDocumentLinkForm,
} from "./documentLinkForm.shared";

interface EditDocumentLinkModalProps {
  open: boolean;
  documentLinkId: string | null;
  context: DocumentLinkContext;
  sourceSystemOptions?: LookupOption[];
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
}

const DEFAULT_MODIFIED_BY = "admin";
const AI_AUTOFILL_FIELD_KEYS = new Set<keyof DocumentLinkFormState>([
  "document_type",
  "external_document_id",
  "document_version",
]);

const formatValue = (value?: string | null): string => {
  if (!value || !value.trim()) return "-";
  return value;
};

export function EditDocumentLinkModal({
  open,
  documentLinkId,
  context,
  sourceSystemOptions = [],
  onClose,
  onUpdated,
}: EditDocumentLinkModalProps) {
  const [formData, setFormData] = useState<DocumentLinkFormState>(EMPTY_DOCUMENT_LINK_FORM);
  const [initialFormData, setInitialFormData] = useState<DocumentLinkFormState>(EMPTY_DOCUMENT_LINK_FORM);
  const [fieldErrors, setFieldErrors] = useState<DocumentLinkFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiAutofillEnabled, setAiAutofillEnabled] = useState(false);
  const [aiAutofill, setAiAutofill] = useState(EMPTY_DOCUMENT_AI_AUTOFILL_STATE);
  const [showAiBadges, setShowAiBadges] = useState(false);
  const aiManualOverrideRef = useRef<Set<DocumentAiAutofillField>>(new Set());
  const aiRequestIdRef = useRef(0);
  const aiBadgeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const availableSourceSystemOptions = useMemo(
    () => (sourceSystemOptions.length > 0 ? sourceSystemOptions : OMS_SOURCE_SYSTEM_FALLBACK_OPTIONS),
    [sourceSystemOptions],
  );

  const clearAiBadgeTimer = () => {
    if (aiBadgeTimerRef.current !== null) {
      clearTimeout(aiBadgeTimerRef.current);
      aiBadgeTimerRef.current = null;
    }
  };

  const showAiBadgesTemporarily = () => {
    clearAiBadgeTimer();
    setShowAiBadges(true);
    aiBadgeTimerRef.current = setTimeout(() => {
      setShowAiBadges(false);
      aiBadgeTimerRef.current = null;
    }, 3000);
  };

  useEffect(
    () => () => {
      if (aiBadgeTimerRef.current !== null) {
        clearTimeout(aiBadgeTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || !documentLinkId) return;

    clearAiBadgeTimer();
    let cancelled = false;
    setLoading(true);
    setFieldErrors({});
    setAiAutofillEnabled(false);
    setAiAutofill(EMPTY_DOCUMENT_AI_AUTOFILL_STATE);
    setShowAiBadges(false);
    aiManualOverrideRef.current = new Set();
    aiRequestIdRef.current += 1;

    const run = async () => {
      try {
        const detail = await getDocumentLink(documentLinkId);
        if (cancelled) return;

        const nextForm = documentLinkToForm(detail);
        setFormData(nextForm);
        setInitialFormData(nextForm);
      } catch (error) {
        if (cancelled) return;
        const mapped = mapDocumentLinkAxiosError(error);
        toast.error(mapped.message);
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [documentLinkId, onClose, open]);

  useEffect(() => {
    if (open) return;

    setFormData(EMPTY_DOCUMENT_LINK_FORM);
    setInitialFormData(EMPTY_DOCUMENT_LINK_FORM);
    setFieldErrors({});
    setLoading(false);
    setSubmitting(false);
    setAiAutofillEnabled(false);
    setAiAutofill(EMPTY_DOCUMENT_AI_AUTOFILL_STATE);
    setShowAiBadges(false);
    clearAiBadgeTimer();
    aiManualOverrideRef.current = new Set();
    aiRequestIdRef.current += 1;
  }, [open]);

  const handleAiAutofillToggle = (checked: boolean) => {
    setAiAutofillEnabled(checked);
    setFieldErrors({});
    aiManualOverrideRef.current = new Set();
    setShowAiBadges(false);
    setFormData((previous) => ({
      ...previous,
      upload_dt: previous.upload_dt.trim() ? previous.upload_dt : formatLocalDateTimeInput(),
    }));
    if (!checked) {
      aiRequestIdRef.current += 1;
      setAiAutofill(EMPTY_DOCUMENT_AI_AUTOFILL_STATE);
    }
  };

  const updateField = <K extends keyof DocumentLinkFormState>(key: K, value: DocumentLinkFormState[K]) => {
    if (AI_AUTOFILL_FIELD_KEYS.has(key)) {
      aiManualOverrideRef.current.add(key as DocumentAiAutofillField);
    }
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const runAiAutofill = async (uploaded: UploadedDocumentFileRecord) => {
    const requestId = aiRequestIdRef.current + 1;
    aiRequestIdRef.current = requestId;
    aiManualOverrideRef.current = new Set();
    setShowAiBadges(false);
    setAiAutofill({ status: "analyzing", result: null, error: null });

    try {
      const result = await analyzeDocumentLinkAutofill({
        access_url: uploaded.access_url,
        relative_path: uploaded.relative_path,
        file_name: uploaded.file_name,
        original_file_name: uploaded.original_file_name,
      });
      if (aiRequestIdRef.current !== requestId) return;

      setFormData((previous) => ({
        ...previous,
        document_type:
          !aiManualOverrideRef.current.has("document_type") && result.document_type
            ? result.document_type
            : previous.document_type,
        external_document_id:
          !aiManualOverrideRef.current.has("external_document_id") && result.external_document_id
            ? result.external_document_id
            : previous.external_document_id,
        document_version:
          !aiManualOverrideRef.current.has("document_version") && result.document_version
            ? result.document_version
            : previous.document_version,
      }));
      setAiAutofill({ status: "complete", result, error: null });
      showAiBadgesTemporarily();
      toast.success("AI Autofill values are ready for review");
    } catch (error) {
      if (aiRequestIdRef.current !== requestId) return;
      const mapped = mapDocumentLinkAxiosError(error);
      setAiAutofill({ status: "failed", result: null, error: mapped.message });
      toast.error(mapped.message);
    }
  };

  const handleUploadedDocument = (uploaded: UploadedDocumentFileRecord) => {
    setFormData((previous) => ({
      ...previous,
      access_url: uploaded.access_url,
      document_name: previous.document_name.trim() ? previous.document_name : uploaded.original_file_name,
      source_reference: previous.source_reference.trim() ? previous.source_reference : uploaded.original_file_name,
      upload_dt: formatLocalDateTimeInput(),
    }));

    if (aiAutofillEnabled) {
      void runAiAutofill(uploaded);
    }
  };

  const showAiReviewFields =
    !aiAutofillEnabled || aiAutofill.status === "complete" || aiAutofill.status === "failed";
  const showAiMetadataReview = aiAutofillEnabled && showAiReviewFields;
  const showManualOnlyFields = !aiAutofillEnabled;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!documentLinkId || submitting) return;

    const nextFormData = {
      ...formData,
      upload_dt: formData.upload_dt.trim() ? formData.upload_dt : formatLocalDateTimeInput(),
    };
    const validationErrors = validateDocumentLinkForm(nextFormData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    const payload = buildUpdateDocumentLinkPayload(initialFormData, nextFormData, DEFAULT_MODIFIED_BY);
    if (Object.keys(payload).length === 1 && payload.modified_by) {
      toast.message("No changes to save");
      return;
    }

    setSubmitting(true);
    setFieldErrors({});

    try {
      await updateDocumentLink(documentLinkId, payload);
      toast.success("Document link updated successfully");
      await onUpdated();
      onClose();
    } catch (error) {
      const mapped = mapDocumentLinkAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Document"
      description="Only modified fields are sent to the backend. Target context remains fixed."
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-document-link-form"
            disabled={
              loading ||
              submitting ||
              !documentLinkId ||
              aiAutofill.status === "analyzing" ||
              (aiAutofillEnabled && !showAiReviewFields)
            }
          >
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="text-sm text-slate-600">Loading document link...</div>
      ) : (
        <form id="edit-document-link-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          {renderDocumentLinkFieldError(fieldErrors, "form")}

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {context.type === "asset" ? (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Asset Name</p>
                    <p className="text-sm font-medium text-slate-900">{formatValue(context.assetName)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Asset Code</p>
                    <p className="text-sm font-medium text-slate-900">{formatValue(context.assetCode)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Asset Version</p>
                    <p className="text-sm font-medium text-slate-900">{formatValue(context.assetVersion)}</p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-slate-500">Asset Name</p>
                    <p className="text-sm font-medium text-slate-900">{formatValue(context.assetName)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Release Version</p>
                    <p className="text-sm font-medium text-slate-900">{formatValue(context.releaseVersion)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Release Created</p>
                    <p className="text-sm font-medium text-slate-900">{formatDocumentLinkDate(context.createdDt)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Document Info</h4>
            <DocumentAiAutofillControls
              enabled={aiAutofillEnabled}
              disabled={submitting}
              state={aiAutofill}
              onEnabledChange={handleAiAutofillToggle}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Source System</label>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                  value={formData.source_system}
                  onChange={(event) => updateField("source_system", event.target.value)}
                >
                  <option value="">Select source system</option>
                  {availableSourceSystemOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.value}
                    </option>
                  ))}
                </select>
                {renderDocumentLinkFieldError(fieldErrors, "source_system")}
              </div>

              {showAiReviewFields ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-700">Document Type</label>
                    {aiAutofillEnabled && aiAutofill.result ? (
                      <DocumentAiAutofillBadge
                        confidence={aiAutofill.result.confidence.document_type}
                        source={aiAutofill.result.extraction_source.document_type}
                        visible={showAiBadges}
                      />
                    ) : null}
                  </div>
                  <DocumentAiAutofillFieldHint
                    enabled={aiAutofillEnabled && Boolean(aiAutofill.result)}
                    confidence={aiAutofill.result?.confidence.document_type}
                    source={aiAutofill.result?.extraction_source.document_type}
                  >
                    <select
                      className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                      value={formData.document_type}
                      onChange={(event) => updateField("document_type", event.target.value)}
                    >
                      <option value="">Select document type</option>
                      {DOCUMENT_LINK_TYPE_OPTIONS.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.value}
                        </option>
                      ))}
                    </select>
                  </DocumentAiAutofillFieldHint>
                  {renderDocumentLinkFieldError(fieldErrors, "document_type")}
                </div>
              ) : null}

              {showAiReviewFields ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-700">External Document ID</label>
                    {aiAutofillEnabled && aiAutofill.result ? (
                      <DocumentAiAutofillBadge
                        confidence={aiAutofill.result.confidence.external_document_id}
                        source={aiAutofill.result.extraction_source.external_document_id}
                        visible={showAiBadges}
                      />
                    ) : null}
                  </div>
                  <DocumentAiAutofillFieldHint
                    enabled={aiAutofillEnabled && Boolean(aiAutofill.result)}
                    confidence={aiAutofill.result?.confidence.external_document_id}
                    source={aiAutofill.result?.extraction_source.external_document_id}
                  >
                    <Input
                      value={formData.external_document_id}
                      onChange={(event) => updateField("external_document_id", event.target.value)}
                    />
                  </DocumentAiAutofillFieldHint>
                  {renderDocumentLinkFieldError(fieldErrors, "external_document_id")}
                </div>
              ) : null}

              {showAiReviewFields ? (
                <div className="space-y-1 col-span-2">
                  <Input
                    label="Document Name"
                    value={formData.document_name}
                    onChange={(event) => updateField("document_name", event.target.value)}
                  />
                  {renderDocumentLinkFieldError(fieldErrors, "document_name")}
                </div>
              ) : null}

              {showAiReviewFields ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-700">Document Version</label>
                    {aiAutofillEnabled && aiAutofill.result ? (
                      <DocumentAiAutofillBadge
                        confidence={aiAutofill.result.confidence.document_version}
                        source={aiAutofill.result.extraction_source.document_version}
                        visible={showAiBadges}
                      />
                    ) : null}
                  </div>
                  <DocumentAiAutofillFieldHint
                    enabled={aiAutofillEnabled && Boolean(aiAutofill.result)}
                    confidence={aiAutofill.result?.confidence.document_version}
                    source={aiAutofill.result?.extraction_source.document_version}
                  >
                    <Input
                      value={formData.document_version}
                      onChange={(event) => updateField("document_version", event.target.value)}
                    />
                  </DocumentAiAutofillFieldHint>
                  {renderDocumentLinkFieldError(fieldErrors, "document_version")}
                </div>
              ) : null}

              {showAiMetadataReview ? (
                <div className="space-y-1">
                  <Input label="Upload Date" type="datetime-local" value={formData.upload_dt} disabled />
                  {renderDocumentLinkFieldError(fieldErrors, "upload_dt")}
                </div>
              ) : null}

              <div className="space-y-1">
                <DocumentUploadUrlField
                  label="Access URL"
                  value={formData.access_url}
                  onChange={(value) => updateField("access_url", value)}
                  error={fieldErrors.access_url}
                  uploadCategory="document-links"
                  disabled={submitting || aiAutofill.status === "analyzing"}
                  onUploaded={handleUploadedDocument}
                />
              </div>

              {showManualOnlyFields ? (
                <div className="space-y-1 col-span-2">
                  <Input
                    label="Source Reference"
                    value={formData.source_reference}
                    onChange={(event) => updateField("source_reference", event.target.value)}
                  />
                  {renderDocumentLinkFieldError(fieldErrors, "source_reference")}
                </div>
              ) : null}
            </div>
          </section>

          {showManualOnlyFields ? (
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Notes</h4>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <Textarea
                  rows={4}
                  value={formData.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder="Add optional context for this validated document link"
                />
                {renderDocumentLinkFieldError(fieldErrors, "notes")}
              </div>
            </section>
          ) : null}
        </form>
      )}
    </Modal>
  );
}
