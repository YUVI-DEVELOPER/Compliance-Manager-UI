import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AuthoredDocumentRecord,
  AuthoredDocumentReviewActionRecord,
  DocumentTemplateRecord,
  approveAuthoredDocument,
  commentOnAuthoredDocument,
  createAuthoredDocumentAiDraft,
  createAuthoredDocumentFromTemplate,
  getAuthoredDocument,
  getAuthoredDocumentPdfPreviewUrl,
  getAuthoredDocumentHistory,
  getDocumentTemplates,
  publishAuthoredDocumentToVeeva,
  regenerateAuthoredDocumentAiContent,
  rejectAuthoredDocument,
  retryAuthoredDocumentPublish,
  requestAuthoredDocumentChanges,
  submitAuthoredDocumentForReview,
  updateAuthoredDocument,
} from "../../../services/authored-document.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DocumentUploadUrlField } from "./DocumentUploadUrlField";
import { Input } from "../ui/input";
import { Modal } from "../ui/Modal";
import { Textarea } from "../ui/textarea";
import { AuthoredDocumentHistoryPanel } from "./AuthoredDocumentHistoryPanel";
import {
  AUTHORED_DOCUMENT_AI_OPERATION_IMPROVE,
  AUTHORED_DOCUMENT_AI_OPERATION_REGENERATE,
  AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED,
  AUTHORED_DOCUMENT_GENERATION_MODE_TEMPLATE_PREFILL,
  AUTHORED_DOCUMENT_STATUS_CHANGES_REQUESTED,
  AUTHORED_DOCUMENT_STATUS_DRAFT,
  AUTHORED_DOCUMENT_TYPE_URS,
  AiAssistFormState,
  AuthoredDocumentContext,
  AuthoredDocumentFieldErrors,
  EMPTY_AI_ASSIST_FORM,
  EMPTY_CREATE_AUTHORED_DOCUMENT_FORM,
  EMPTY_EDIT_AUTHORED_DOCUMENT_FORM,
  authoredDocumentToAiAssistForm,
  authoredDocumentToEditForm,
  buildCreateAuthoredDocumentAiPayload,
  buildCreateAuthoredDocumentPayload,
  buildRegenerateAuthoredDocumentAiPayload,
  buildUpdateAuthoredDocumentPayload,
  canEditAuthoredDocument,
  canPublishAuthoredDocumentToVeeva,
  canReviewAuthoredDocument,
  canRetryAuthoredDocumentPublish,
  canSubmitAuthoredDocument,
  didAuthoredDocumentAIFallback,
  formatAuthoredDocumentAIFallbackReason,
  formatAuthoredDocumentDate,
  formatAuthoredDocumentGenerationMode,
  formatAuthoredDocumentPublishStatus,
  formatAuthoredDocumentStatus,
  getAuthoredDocumentExternalLink,
  getAuthoredDocumentAssetVersion,
  getAuthoredDocumentGenerationBadgeClass,
  getAuthoredDocumentPublishBadgeClass,
  getAuthoredDocumentStatusBadgeClass,
  hasRequestedAuthoredDocumentAIAssist,
  mapAuthoredDocumentAxiosError,
  renderAuthoredDocumentFieldError,
  validateCreateAuthoredDocumentForm,
  validateEditAuthoredDocumentForm,
} from "./authoredDocumentForm.shared";

interface AuthoredDocumentEditorModalProps {
  open: boolean;
  context: AuthoredDocumentContext | null;
  authoredDocumentId?: string | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const DEFAULT_CREATED_BY = "admin";
const DEFAULT_MODIFIED_BY = "admin";
const DEFAULT_WORKFLOW_USER = "admin";

const formatValue = (value?: string | null): string => {
  if (!value || !value.trim()) return "-";
  return value;
};

const normalizePreviewValue = (value?: string | null): string => {
  const normalized = value?.trim();
  return normalized || "";
};

const stripAdditionalNotesSection = (content: string): string =>
  content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n?##\s+Additional Notes\s*\n[\s\S]*?(?=\n##\s+|$)/gi, "\n")
    .trim();

const formatGeneratedPreviewDate = (): string =>
  new Date().toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const getCreateDraftAssetLabel = (context: AuthoredDocumentContext | null): string => {
  const assetName = normalizePreviewValue(context?.assetName);
  const assetCode = normalizePreviewValue(context?.assetCode);
  if (assetName && assetCode) return `${assetName} (${assetCode})`;
  return assetName || assetCode || "selected asset";
};

const getCreateDraftTitlePreview = (
  form: typeof EMPTY_CREATE_AUTHORED_DOCUMENT_FORM,
  context: AuthoredDocumentContext | null,
): string => normalizePreviewValue(form.title) || `${form.document_type || "URS"} - ${getCreateDraftAssetLabel(context)}`;

const buildCreateDraftScopePreview = (context: AuthoredDocumentContext | null): string => {
  const assetLabel = getCreateDraftAssetLabel(context);
  if (context?.type === "release") {
    return `This URS applies to ${assetLabel} and the release-scoped changes for version ${context.releaseVersion || "the selected release"}.`;
  }
  return `This URS applies to the lifecycle, controls, and supporting specifications for ${assetLabel}.`;
};

const buildCreateDraftReleasePreview = (context: AuthoredDocumentContext | null): string => {
  if (context?.type !== "release") {
    return "This URS draft is linked at the asset level and is not scoped to a specific release.";
  }
  return `- Release Version: ${context.releaseVersion || "Selected release"}\n- Documentation Mode: To be confirmed from release context`;
};

const buildCreateDraftSourcePreview = (form: typeof EMPTY_CREATE_AUTHORED_DOCUMENT_FORM): string => {
  const pastedText = normalizePreviewValue(form.source_urs_text);
  if (pastedText) return pastedText;

  const sourceName = normalizePreviewValue(form.source_document_name);
  const sourceUrl = normalizePreviewValue(form.source_document_url);
  if (sourceName || sourceUrl) {
    return [
      `Attached URS source: ${sourceName || sourceUrl}`,
      "Extracted document text will be merged during draft creation when the uploaded format supports extraction.",
    ].join("\n");
  }

  return "No uploaded or pasted URS source content has been added.";
};

const buildCreateDraftPreview = (
  template: DocumentTemplateRecord,
  form: typeof EMPTY_CREATE_AUTHORED_DOCUMENT_FORM,
  context: AuthoredDocumentContext | null,
): string => {
  const title = getCreateDraftTitlePreview(form, context);
  const assetLabel = getCreateDraftAssetLabel(context);
  const sourceReference = normalizePreviewValue(form.source_document_name) || normalizePreviewValue(form.source_document_url);
  const values: Record<string, string> = {
    document_title: title,
    document_type: form.document_type || AUTHORED_DOCUMENT_TYPE_URS,
    status: AUTHORED_DOCUMENT_STATUS_DRAFT,
    template_name: template.template_name,
    template_code: template.template_code,
    generated_on: formatGeneratedPreviewDate(),
    purpose:
      normalizePreviewValue(form.purpose_notes) ||
      `Define the user requirements for ${assetLabel} using current asset master and specification data.`,
    scope: buildCreateDraftScopePreview(context),
    asset_name: normalizePreviewValue(context?.assetName) || "Selected asset",
    asset_id: normalizePreviewValue(context?.assetCode) || "Selected asset ID",
    asset_code: normalizePreviewValue(context?.assetCode) || "Selected asset ID",
    asset_description: "Asset description will be resolved from asset master during draft creation.",
    short_description: "Short description will be resolved from asset master during draft creation.",
    asset_owner: "Asset owner will be resolved from asset master during draft creation.",
    organization_name: "Organization will be resolved from asset master during draft creation.",
    supplier_name: "Supplier will be resolved from asset master during draft creation.",
    manufacturer: "Manufacturer will be resolved from asset master during draft creation.",
    model: "Model will be resolved from asset master during draft creation.",
    asset_version:
      context?.type === "asset"
        ? normalizePreviewValue(context.assetVersion) || "Current asset version"
        : "Release-linked asset version",
    asset_class: "Asset class will be resolved from asset master during draft creation.",
    asset_category: "Asset category will be resolved from asset master during draft creation.",
    asset_sub_category: "Asset sub-category will be resolved from asset master during draft creation.",
    asset_type: "Asset type will be resolved from asset master during draft creation.",
    criticality_class: "Criticality will be resolved from asset master during draft creation.",
    asset_nature: "Asset nature will be resolved from asset master during draft creation.",
    asset_status: "Asset status will be resolved from asset master during draft creation.",
    release_context: buildCreateDraftReleasePreview(context),
    release_version: context?.type === "release" ? normalizePreviewValue(context.releaseVersion) || "Selected release" : "",
    asset_specs_summary: "Active asset specifications will be resolved during draft creation.",
    special_instructions: normalizePreviewValue(form.special_instructions) || "No special instructions entered.",
    source_urs_reference: sourceReference || "No source URS document attached.",
    source_urs_text: buildCreateDraftSourcePreview(form),
  };

  return stripAdditionalNotesSection(template.template_content)
    .replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => {
      if (key === "additional_notes") return "";
      const value = values[key];
      return value === undefined ? "To be resolved during draft creation." : value;
    })
    .trim();
};

export function AuthoredDocumentEditorModal({
  open,
  context,
  authoredDocumentId,
  onClose,
  onSaved,
}: AuthoredDocumentEditorModalProps) {
  const [templates, setTemplates] = useState<DocumentTemplateRecord[]>([]);
  const [document, setDocument] = useState<AuthoredDocumentRecord | null>(null);
  const [history, setHistory] = useState<AuthoredDocumentReviewActionRecord[]>([]);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_AUTHORED_DOCUMENT_FORM);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_AUTHORED_DOCUMENT_FORM);
  const [initialEditForm, setInitialEditForm] = useState(EMPTY_EDIT_AUTHORED_DOCUMENT_FORM);
  const [aiAssistForm, setAiAssistForm] = useState<AiAssistFormState>(EMPTY_AI_ASSIST_FORM);
  const [reviewerName, setReviewerName] = useState("");
  const [workflowComment, setWorkflowComment] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AuthoredDocumentFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [sourceEditorOpen, setSourceEditorOpen] = useState(false);

  const isEditingExistingDocument = Boolean(authoredDocumentId);
  const activeTemplate = useMemo(
    () => templates.find((template) => template.template_id === createForm.template_id) ?? null,
    [createForm.template_id, templates],
  );
  const isEditorStage = Boolean(document) || isEditingExistingDocument;
  const documentStatus = document?.status ?? null;
  const canEditContent = canEditAuthoredDocument(documentStatus);
  const canSubmit = canSubmitAuthoredDocument(documentStatus);
  const canReview = canReviewAuthoredDocument(documentStatus);
  const canPublishToVeeva = canPublishAuthoredDocumentToVeeva(document);
  const canRetryPublish = canRetryAuthoredDocumentPublish(document);
  const isCreateAIMode = createForm.generation_mode === AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED;
  const hasRequestedAiAssist = hasRequestedAuthoredDocumentAIAssist(document);
  const generationLabel = formatAuthoredDocumentGenerationMode(
    document?.generation_mode,
    document?.generation_requested_mode,
  );
  const generationFallback = didAuthoredDocumentAIFallback(document);
  const generationFallbackReason = formatAuthoredDocumentAIFallbackReason(document?.generation_fallback_reason);
  const publishStatusLabel = formatAuthoredDocumentPublishStatus(document?.publish_status);
  const externalDocumentLink = getAuthoredDocumentExternalLink(document);
  const pdfPreviewUrl = useMemo(() => {
    if (!document?.authored_document_id) return "";
    const cacheKey = encodeURIComponent(document.modified_dt || document.created_dt || "");
    return `${getAuthoredDocumentPdfPreviewUrl(document.authored_document_id)}?v=${cacheKey}`;
  }, [document?.authored_document_id, document?.created_dt, document?.modified_dt]);

  const applyDocumentState = useCallback(
    (detail: AuthoredDocumentRecord, options?: { preserveReviewerInput?: boolean }) => {
      const nextEditForm = authoredDocumentToEditForm(detail);
      setDocument(detail);
      setEditForm(nextEditForm);
      setInitialEditForm(nextEditForm);
      setAiAssistForm(authoredDocumentToAiAssistForm(detail));
      if (!options?.preserveReviewerInput) {
        setReviewerName(detail.reviewer_name ?? "");
      }
    },
    [],
  );

  const loadExistingDocument = useCallback(
    async (documentId: string) => {
      const [detail, nextHistory] = await Promise.all([
        getAuthoredDocument(documentId),
        getAuthoredDocumentHistory(documentId),
      ]);
      applyDocumentState(detail);
      setHistory(nextHistory);
      setWorkflowComment("");
    },
    [applyDocumentState],
  );

  const refreshHistory = useCallback(async (documentId: string) => {
    const nextHistory = await getAuthoredDocumentHistory(documentId);
    setHistory(nextHistory);
  }, []);

  const refreshDocumentDetail = useCallback(
    async (documentId: string, options?: { preserveReviewerInput?: boolean }) => {
      const detail = await getAuthoredDocument(documentId);
      applyDocumentState(detail, options);
    },
    [applyDocumentState],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setFieldErrors({});

    if (authoredDocumentId) {
      setLoading(true);
      setHistoryLoading(true);
      void Promise.all([getAuthoredDocument(authoredDocumentId), getAuthoredDocumentHistory(authoredDocumentId)])
        .then(([detail, nextHistory]) => {
          if (cancelled) return;
          applyDocumentState(detail);
          setHistory(nextHistory);
          setWorkflowComment("");
        })
        .catch((error) => {
          if (cancelled) return;
          const mapped = mapAuthoredDocumentAxiosError(error);
          toast.error(mapped.message);
          onClose();
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
            setHistoryLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    setTemplatesLoading(true);
    void getDocumentTemplates({ document_type: AUTHORED_DOCUMENT_TYPE_URS, active_only: true })
      .then((data) => {
        if (cancelled) return;
        setTemplates(data);
        setCreateForm((previous) => ({
          ...previous,
          template_id: previous.template_id || data[0]?.template_id || "",
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        const mapped = mapAuthoredDocumentAxiosError(error);
        toast.error(mapped.message);
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyDocumentState, authoredDocumentId, onClose, open]);

  useEffect(() => {
    if (open) return;

    setTemplates([]);
    setDocument(null);
    setHistory([]);
    setCreateForm(EMPTY_CREATE_AUTHORED_DOCUMENT_FORM);
    setEditForm(EMPTY_EDIT_AUTHORED_DOCUMENT_FORM);
    setInitialEditForm(EMPTY_EDIT_AUTHORED_DOCUMENT_FORM);
    setAiAssistForm(EMPTY_AI_ASSIST_FORM);
    setReviewerName("");
    setWorkflowComment("");
    setFieldErrors({});
    setLoading(false);
    setTemplatesLoading(false);
    setHistoryLoading(false);
    setSubmitting(false);
    setActiveAction(null);
    setSourceEditorOpen(false);
  }, [open]);

  const updateCreateField = <K extends keyof typeof EMPTY_CREATE_AUTHORED_DOCUMENT_FORM>(
    key: K,
    value: (typeof EMPTY_CREATE_AUTHORED_DOCUMENT_FORM)[K],
  ) => {
    setCreateForm((previous) => ({ ...previous, [key]: value }));
  };

  const updateSourceDocumentUrl = (value: string) => {
    setCreateForm((previous) => ({
      ...previous,
      source_document_url: value,
      source_document_relative_path: value === previous.source_document_url ? previous.source_document_relative_path : "",
    }));
  };

  const updateEditField = <K extends keyof typeof EMPTY_EDIT_AUTHORED_DOCUMENT_FORM>(
    key: K,
    value: (typeof EMPTY_EDIT_AUTHORED_DOCUMENT_FORM)[K],
  ) => {
    setEditForm((previous) => ({ ...previous, [key]: value }));
  };

  const updateAiAssistField = <K extends keyof AiAssistFormState>(key: K, value: AiAssistFormState[K]) => {
    setAiAssistForm((previous) => ({ ...previous, [key]: value }));
  };

  const buildWorkflowPayload = () => {
    const payload: {
      action_by: string;
      comment_text?: string;
      reviewer_name?: string;
    } = {
      action_by: DEFAULT_WORKFLOW_USER,
    };

    const trimmedComment = workflowComment.trim();
    const trimmedReviewer = reviewerName.trim();

    if (trimmedComment) payload.comment_text = trimmedComment;
    if (trimmedReviewer) payload.reviewer_name = trimmedReviewer;

    return payload;
  };

  const syncWorkflowDocument = async (nextDocument: AuthoredDocumentRecord, successMessage: string) => {
    applyDocumentState(nextDocument);
    setWorkflowComment("");
    await refreshHistory(nextDocument.authored_document_id);
    toast.success(successMessage);
    await onSaved();
  };

  const persistDraftChanges = async (options?: {
    preserveReviewerInput?: boolean;
    successMessage?: string | null;
  }): Promise<{ updatedDocument: AuthoredDocumentRecord; changed: boolean } | null> => {
    if (!document) return null;

    const validationErrors = validateEditAuthoredDocumentForm(editForm);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return null;
    }

    const payload = buildUpdateAuthoredDocumentPayload(initialEditForm, editForm, DEFAULT_MODIFIED_BY);
    const hasChanges = Object.keys(payload).length > 1;

    if (!hasChanges) {
      return { updatedDocument: document, changed: false };
    }

    const updated = await updateAuthoredDocument(document.authored_document_id, payload);
    applyDocumentState(updated, { preserveReviewerInput: options?.preserveReviewerInput });
    if (options?.successMessage) {
      toast.success(options.successMessage);
    }
    await onSaved();
    return { updatedDocument: updated, changed: true };
  };

  const handleCreateDraft = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || !context) return;

    const validationErrors = validateCreateAuthoredDocumentForm(createForm);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setActiveAction("create");
    setFieldErrors({});
    try {
      const created = isCreateAIMode
        ? await createAuthoredDocumentAiDraft(buildCreateAuthoredDocumentAiPayload(createForm, context, DEFAULT_CREATED_BY))
        : await createAuthoredDocumentFromTemplate(buildCreateAuthoredDocumentPayload(createForm, context, DEFAULT_CREATED_BY));

      applyDocumentState(created);
      setHistory([]);
      setWorkflowComment("");
      toast.success(
        isCreateAIMode && created.generation_mode === AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED
          ? "AI-assisted URS draft created successfully"
          : isCreateAIMode
            ? "AI unavailable, draft created with template prefill"
            : "URS draft created successfully",
      );
      await onSaved();
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleGenerateAiDraft = async (
    operation: typeof AUTHORED_DOCUMENT_AI_OPERATION_REGENERATE | typeof AUTHORED_DOCUMENT_AI_OPERATION_IMPROVE,
  ) => {
    if (!document || submitting) return;

    const validationErrors = validateEditAuthoredDocumentForm(editForm);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    if (operation === AUTHORED_DOCUMENT_AI_OPERATION_IMPROVE && !editForm.content.trim()) {
      setFieldErrors({ content: "Content is required before AI can improve the draft" });
      return;
    }

    setSubmitting(true);
    setActiveAction(operation === AUTHORED_DOCUMENT_AI_OPERATION_IMPROVE ? "improve-ai" : "regenerate-ai");
    setFieldErrors({});
    try {
      const updated = await regenerateAuthoredDocumentAiContent(
        document.authored_document_id,
        buildRegenerateAuthoredDocumentAiPayload(editForm, aiAssistForm, DEFAULT_MODIFIED_BY, operation),
      );
      applyDocumentState(updated, { preserveReviewerInput: true });
      toast.success(
        operation === AUTHORED_DOCUMENT_AI_OPERATION_IMPROVE
          ? "AI improved the current draft"
          : "AI draft regenerated successfully",
      );
      await onSaved();
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!document || submitting) return;

    setSubmitting(true);
    setActiveAction("save");
    setFieldErrors({});
    try {
      const result = await persistDraftChanges({
        preserveReviewerInput: true,
        successMessage:
          document.status === AUTHORED_DOCUMENT_STATUS_CHANGES_REQUESTED
            ? "Changes saved successfully"
            : "Draft saved successfully",
      });
      if (!result) return;
      if (!result.changed) {
        toast.message("No changes to save");
      }
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleSubmitForReview = async () => {
    if (!document || submitting) return;

    setSubmitting(true);
    setActiveAction("submit");
    setFieldErrors({});
    try {
      const saved = await persistDraftChanges({ preserveReviewerInput: true });
      if (!saved) return;

      const updated = await submitAuthoredDocumentForReview(document.authored_document_id, buildWorkflowPayload());
      await syncWorkflowDocument(
        updated,
        document.status === AUTHORED_DOCUMENT_STATUS_CHANGES_REQUESTED
          ? "Document resubmitted for review"
          : "Document submitted for review",
      );
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleApprove = async () => {
    if (!document || submitting) return;

    setSubmitting(true);
    setActiveAction("approve");
    setFieldErrors({});
    try {
      const updated = await approveAuthoredDocument(document.authored_document_id, {
        action_by: DEFAULT_WORKFLOW_USER,
        comment_text: workflowComment.trim() || null,
      });
      await syncWorkflowDocument(updated, "Document approved successfully");
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handlePublishToVeeva = async () => {
    if (!document || submitting) return;

    setSubmitting(true);
    setActiveAction("publish");
    setFieldErrors({});
    try {
      const updated = await publishAuthoredDocumentToVeeva(document.authored_document_id, {
        action_by: DEFAULT_WORKFLOW_USER,
      });
      applyDocumentState(updated, { preserveReviewerInput: true });
      toast.success("Document published to Veeva successfully");
      await onSaved();
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      try {
        await refreshDocumentDetail(document.authored_document_id, { preserveReviewerInput: true });
        await onSaved();
      } catch {
        // Keep the original publish error visible even if a refresh is not available.
      }
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleRetryPublish = async () => {
    if (!document || submitting) return;

    setSubmitting(true);
    setActiveAction("retry-publish");
    setFieldErrors({});
    try {
      const updated = await retryAuthoredDocumentPublish(document.authored_document_id, {
        action_by: DEFAULT_WORKFLOW_USER,
      });
      applyDocumentState(updated, { preserveReviewerInput: true });
      toast.success("Veeva publish retry succeeded");
      await onSaved();
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      try {
        await refreshDocumentDetail(document.authored_document_id, { preserveReviewerInput: true });
        await onSaved();
      } catch {
        // Keep the original publish error visible even if a refresh is not available.
      }
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleRequestChanges = async () => {
    if (!document || submitting) return;
    if (!workflowComment.trim()) {
      setFieldErrors({ comment_text: "A review comment is required to request changes" });
      return;
    }

    setSubmitting(true);
    setActiveAction("request-changes");
    setFieldErrors({});
    try {
      const updated = await requestAuthoredDocumentChanges(document.authored_document_id, {
        action_by: DEFAULT_WORKFLOW_USER,
        comment_text: workflowComment.trim(),
        reviewer_name: reviewerName.trim() || null,
      });
      await syncWorkflowDocument(updated, "Changes requested successfully");
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleReject = async () => {
    if (!document || submitting) return;
    if (!workflowComment.trim()) {
      setFieldErrors({ comment_text: "A review comment is required to reject this document" });
      return;
    }

    setSubmitting(true);
    setActiveAction("reject");
    setFieldErrors({});
    try {
      const updated = await rejectAuthoredDocument(document.authored_document_id, {
        action_by: DEFAULT_WORKFLOW_USER,
        comment_text: workflowComment.trim(),
        reviewer_name: reviewerName.trim() || null,
      });
      await syncWorkflowDocument(updated, "Document rejected successfully");
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleAddComment = async () => {
    if (!document || submitting) return;
    if (!workflowComment.trim()) {
      setFieldErrors({ comment_text: "Comment is required" });
      return;
    }

    setSubmitting(true);
    setActiveAction("comment");
    setFieldErrors({});
    try {
      await commentOnAuthoredDocument(document.authored_document_id, {
        action_by: DEFAULT_WORKFLOW_USER,
        comment_text: workflowComment.trim(),
      });
      setWorkflowComment("");
      await loadExistingDocument(document.authored_document_id);
      toast.success("Comment added successfully");
      await onSaved();
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
      setActiveAction(null);
    }
  };

  const activeContext: AuthoredDocumentContext | null = document
    ? document.release_id
      ? {
          type: "release",
          releaseId: document.release_id,
          assetName: document.asset_name,
          assetCode: document.asset_code,
          releaseVersion: document.release_version,
        }
      : {
          type: "asset",
          assetId: document.asset_id,
          assetName: document.asset_name,
          assetCode: document.asset_code,
          assetVersion: getAuthoredDocumentAssetVersion(document),
        }
    : context;

  let createReferenceValue: string | null | undefined = null;
  if (activeContext?.type === "release") {
    createReferenceValue = activeContext.releaseVersion;
  } else if (activeContext?.type === "asset") {
    createReferenceValue = activeContext.assetCode || activeContext.assetVersion;
  }

  const activeTemplatePreview = useMemo(
    () => (activeTemplate ? buildCreateDraftPreview(activeTemplate, createForm, activeContext) : ""),
    [activeContext, activeTemplate, createForm],
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditorStage ? "Authored URS Workflow" : "Create URS Draft"}
      size={isEditorStage ? "full" : "xl"}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          {!isEditorStage ? (
            <Button
              type="submit"
              form="create-authored-document-form"
              disabled={templatesLoading || submitting || !context || templates.length === 0}
            >
              {submitting && activeAction === "create"
                ? isCreateAIMode
                  ? "Generating..."
                  : "Creating..."
                : isCreateAIMode
                  ? "Create AI Draft"
                  : "Create Draft"}
            </Button>
          ) : null}
        </>
      }
    >
      {!isEditorStage ? (
        <form id="create-authored-document-form" className="space-y-5" onSubmit={(event) => void handleCreateDraft(event)}>
          {renderAuthoredDocumentFieldError(fieldErrors, "form")}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs text-slate-500">Context</p>
                <p className="text-sm font-medium text-slate-900">
                  {activeContext?.type === "release" ? "Release-linked draft" : "Asset-linked draft"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Asset Name</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(activeContext?.assetName)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Reference</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(createReferenceValue)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">Generation Mode</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={
                  createForm.generation_mode === AUTHORED_DOCUMENT_GENERATION_MODE_TEMPLATE_PREFILL ? "default" : "outline"
                }
                onClick={() => updateCreateField("generation_mode", AUTHORED_DOCUMENT_GENERATION_MODE_TEMPLATE_PREFILL)}
                disabled={submitting}
              >
                Template Prefill
              </Button>
              <Button
                type="button"
                variant={createForm.generation_mode === AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED ? "default" : "outline"}
                onClick={() => updateCreateField("generation_mode", AUTHORED_DOCUMENT_GENERATION_MODE_AI_ASSISTED)}
                disabled={submitting}
              >
                AI-Assisted Draft
              </Button>
            </div>
            {renderAuthoredDocumentFieldError(fieldErrors, "generation_mode")}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Input label="Document Type" value={createForm.document_type} disabled readOnly />
              {renderAuthoredDocumentFieldError(fieldErrors, "document_type")}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Template</label>
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-input-background px-3 text-sm"
                value={createForm.template_id}
                onChange={(event) => updateCreateField("template_id", event.target.value)}
                disabled={templatesLoading || templates.length === 0}
              >
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.template_id} value={template.template_id}>
                    {template.template_name}
                  </option>
                ))}
              </select>
              {renderAuthoredDocumentFieldError(fieldErrors, "template_id")}
            </div>
          </div>

          <div className="space-y-1">
            <Input
              label="Draft Title"
              value={createForm.title}
              onChange={(event) => updateCreateField("title", event.target.value)}
              placeholder="Leave blank to auto-generate from asset or release context"
            />
            {renderAuthoredDocumentFieldError(fieldErrors, "title")}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Purpose Notes</label>
            <Textarea
              rows={4}
              value={createForm.purpose_notes}
              onChange={(event) => updateCreateField("purpose_notes", event.target.value)}
              placeholder="Optional notes that should influence the generated Purpose section"
            />
            {renderAuthoredDocumentFieldError(fieldErrors, "purpose_notes")}
          </div>

          {isCreateAIMode ? (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Special Instructions</label>
              <Textarea
                rows={4}
                value={createForm.special_instructions}
                onChange={(event) => updateCreateField("special_instructions", event.target.value)}
                placeholder="Optional instructions for tone, emphasis, or constraints to apply during AI generation"
              />
              {renderAuthoredDocumentFieldError(fieldErrors, "special_instructions")}
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">Existing Asset URS Source</p>

            <div className="mt-4 space-y-4">
              <DocumentUploadUrlField
                label="Attach URS Document"
                value={createForm.source_document_url}
                onChange={updateSourceDocumentUrl}
                error={fieldErrors.source_document_url}
                uploadCategory="urs-source"
                onUploaded={(uploaded) => {
                  setCreateForm((previous) => ({
                    ...previous,
                    source_document_url: uploaded.access_url,
                    source_document_name: uploaded.original_file_name,
                    source_document_relative_path: uploaded.relative_path,
                    title: previous.title.trim()
                      ? previous.title
                      : uploaded.original_file_name.replace(/\.[^.]+$/, ""),
                  }));
                }}
              />

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">Paste URS Content</label>
                <Textarea
                  rows={8}
                  value={createForm.source_urs_text}
                  onChange={(event) => updateCreateField("source_urs_text", event.target.value)}
                  placeholder="Paste URS requirements or source document text here when you want the draft and supplier baseline to use this content directly."
                />
                {renderAuthoredDocumentFieldError(fieldErrors, "source_urs_text")}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-sm font-semibold text-slate-900">
              {activeTemplate?.template_name || "Template Preview"}
            </p>
            {activeTemplate ? (
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 px-4 py-3 text-xs text-slate-100">
                {activeTemplatePreview}
              </pre>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No template selected.</p>
            )}
          </div>
        </form>
      ) : loading ? (
        <div className="text-sm text-slate-600">Loading document...</div>
      ) : !document ? (
        <div className="text-sm text-slate-600">Document not available.</div>
      ) : (
        <div className="space-y-5">
          {renderAuthoredDocumentFieldError(fieldErrors, "form")}

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
              <div className="xl:col-span-2">
                <p className="text-xs text-slate-500">Template</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(document.template_name || document.template_code)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Draft Source</p>
                <Badge
                  variant="outline"
                  className={`mt-1 ${getAuthoredDocumentGenerationBadgeClass(document.generation_mode)}`}
                >
                  {generationLabel}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-slate-500">Status</p>
                <Badge
                  variant="outline"
                  className={`mt-1 ${getAuthoredDocumentStatusBadgeClass(document.status)}`}
                >
                  {formatAuthoredDocumentStatus(document.status)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-slate-500">Reviewer</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(document.reviewer_name)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Approver</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(document.approver_name)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Generated</p>
                <p className="text-sm font-medium text-slate-900">{formatAuthoredDocumentDate(document.last_generated_at)}</p>
              </div>
            </div>

            {generationFallback ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                AI generation was requested for the latest draft update, but the system used deterministic template prefill instead.
                {generationFallbackReason ? ` ${generationFallbackReason}` : ""}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Workflow Actions</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canEditContent ? (
                  <Button type="button" variant="outline" onClick={() => void handleSaveDraft()} disabled={submitting}>
                    {submitting && activeAction === "save"
                      ? "Saving..."
                      : document.status === AUTHORED_DOCUMENT_STATUS_CHANGES_REQUESTED
                        ? "Save Changes"
                        : "Save Draft"}
                  </Button>
                ) : null}

                {canSubmit ? (
                  <Button type="button" onClick={() => void handleSubmitForReview()} disabled={submitting}>
                    {submitting && activeAction === "submit"
                      ? "Submitting..."
                      : document.status === AUTHORED_DOCUMENT_STATUS_CHANGES_REQUESTED
                        ? "Resubmit for Review"
                        : "Submit for Review"}
                  </Button>
                ) : null}

                {canReview ? (
                  <Button type="button" variant="outline" onClick={() => void handleApprove()} disabled={submitting}>
                    {submitting && activeAction === "approve" ? "Approving..." : "Approve"}
                  </Button>
                ) : null}

                {canReview ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:text-orange-800"
                    onClick={() => void handleRequestChanges()}
                    disabled={submitting}
                  >
                    {submitting && activeAction === "request-changes" ? "Submitting..." : "Request Changes"}
                  </Button>
                ) : null}

                {canReview ? (
                  <Button type="button" variant="destructive" onClick={() => void handleReject()} disabled={submitting}>
                    {submitting && activeAction === "reject" ? "Rejecting..." : "Reject"}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Veeva Publish</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canPublishToVeeva ? (
                  <Button type="button" onClick={() => void handlePublishToVeeva()} disabled={submitting}>
                    {submitting && activeAction === "publish" ? "Publishing..." : "Publish to Veeva"}
                  </Button>
                ) : null}

                {canRetryPublish ? (
                  <Button type="button" variant="outline" onClick={() => void handleRetryPublish()} disabled={submitting}>
                    {submitting && activeAction === "retry-publish" ? "Retrying..." : "Retry Publish"}
                  </Button>
                ) : null}

                {externalDocumentLink ? (
                  <Button type="button" variant="outline" asChild>
                    <a href={externalDocumentLink} target="_blank" rel="noopener noreferrer">
                      Open in Veeva
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Publish Status</p>
                <Badge
                  variant="outline"
                  className={`mt-1 ${getAuthoredDocumentPublishBadgeClass(document.publish_status)}`}
                >
                  {publishStatusLabel}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-slate-500">External Document ID</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(document.external_document_id)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">External Version</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(document.external_document_version)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">External System</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(document.external_system)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Published At</p>
                <p className="text-sm font-medium text-slate-900">{formatAuthoredDocumentDate(document.published_at)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Published By</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(document.published_by)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Last Attempt</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatAuthoredDocumentDate(document.last_publish_attempt_at)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Last Attempt By</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(document.last_publish_attempt_by)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">External Document Name</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(document.external_document_name)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">External Reference</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(document.external_source_reference)}</p>
              </div>
            </div>

            {document.publish_error_message ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-800">
                Last publish error: {document.publish_error_message}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(22rem,1fr)]">
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Input
                    label="Document Title"
                    value={editForm.title}
                    onChange={(event) => updateEditField("title", event.target.value)}
                    readOnly={!canEditContent}
                  />
                  {renderAuthoredDocumentFieldError(fieldErrors, "title")}
                </div>
                <div className="space-y-1">
                  <Input
                    label={document.status === AUTHORED_DOCUMENT_STATUS_CHANGES_REQUESTED ? "Reviewer for Resubmission" : "Reviewer"}
                    value={reviewerName}
                    onChange={(event) => setReviewerName(event.target.value)}
                    placeholder="Optional reviewer name"
                    readOnly={!canSubmit}
                    disabled={!canSubmit}
                  />
                  {renderAuthoredDocumentFieldError(fieldErrors, "reviewer_name")}
                </div>
              </div>

              {canEditContent ? (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">AI Draft Assistance</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => void handleGenerateAiDraft(AUTHORED_DOCUMENT_AI_OPERATION_REGENERATE)}
                        disabled={submitting}
                      >
                        {submitting && activeAction === "regenerate-ai"
                          ? "Generating..."
                          : hasRequestedAiAssist
                            ? "Regenerate AI Draft"
                            : "Generate AI Draft"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void handleGenerateAiDraft(AUTHORED_DOCUMENT_AI_OPERATION_IMPROVE)}
                        disabled={submitting || !editForm.content.trim()}
                      >
                        {submitting && activeAction === "improve-ai" ? "Improving..." : "Improve Draft"}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Purpose Notes</label>
                      <Textarea
                        rows={4}
                        value={aiAssistForm.purpose_notes}
                        onChange={(event) => updateAiAssistField("purpose_notes", event.target.value)}
                        placeholder="Optional notes to steer the purpose and business intent"
                      />
                      {renderAuthoredDocumentFieldError(fieldErrors, "purpose_notes")}
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-slate-700">Special Instructions</label>
                      <Textarea
                        rows={4}
                        value={aiAssistForm.special_instructions}
                        onChange={(event) => updateAiAssistField("special_instructions", event.target.value)}
                        placeholder="Optional instructions for emphasis, constraints, or drafting style"
                      />
                      {renderAuthoredDocumentFieldError(fieldErrors, "special_instructions")}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Document Preview</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pdfPreviewUrl ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <a href={pdfPreviewUrl} target="_blank" rel="noopener noreferrer">
                          Open PDF
                        </a>
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSourceEditorOpen((previous) => !previous)}
                    >
                      {sourceEditorOpen ? "Hide Source" : canEditContent ? "Edit Source" : "View Source"}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 h-[38rem] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  {pdfPreviewUrl ? (
                    <iframe
                      key={pdfPreviewUrl}
                      src={pdfPreviewUrl}
                      title="Authored URS PDF preview"
                      className="h-full w-full bg-white"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      PDF preview is unavailable until the document is saved.
                    </div>
                  )}
                </div>
              </div>

              {sourceEditorOpen ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Source Content</label>
                  <Textarea
                    rows={22}
                    className={`font-mono text-sm ${canEditContent ? "" : "bg-slate-50 text-slate-700"}`}
                    value={editForm.content}
                    onChange={(event) => updateEditField("content", event.target.value)}
                    placeholder="Document content"
                    readOnly={!canEditContent}
                  />
                  {renderAuthoredDocumentFieldError(fieldErrors, "content")}
                </div>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Review Comments</p>
                  </div>
                  <Button type="button" variant="outline" onClick={() => void handleAddComment()} disabled={submitting}>
                    {submitting && activeAction === "comment" ? "Adding..." : "Add Comment"}
                  </Button>
                </div>

                <div className="mt-4 space-y-1">
                  <Textarea
                    rows={5}
                    value={workflowComment}
                    onChange={(event) => setWorkflowComment(event.target.value)}
                    placeholder={
                      canReview
                        ? "Enter approval rationale, requested changes, or rejection reasons."
                        : canSubmit
                          ? "Optional note for the reviewer."
                          : "Add a workflow comment for audit history."
                    }
                  />
                  {renderAuthoredDocumentFieldError(fieldErrors, "comment_text")}
                </div>
              </div>
            </div>

            <AuthoredDocumentHistoryPanel history={history} loading={historyLoading} />
          </div>
        </div>
      )}
    </Modal>
  );
}
