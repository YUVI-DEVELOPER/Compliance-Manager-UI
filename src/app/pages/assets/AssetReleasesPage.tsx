import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Download, ExternalLink, FileText, Plus, RefreshCw } from "lucide-react";
import { toast, Toaster } from "sonner";

import { AssetRecord, getAssets } from "../../../services/asset.service";
import { AuthoredDocumentRecord, getReleaseAuthoredDocuments } from "../../../services/authored-document.service";
import { DocumentLinkRecord, getReleaseDocuments } from "../../../services/document-link.service";
import { QualificationDocumentRecord, getReleaseQualificationDocuments } from "../../../services/qualification-document.service";
import {
  createRelease,
  deleteRelease,
  downloadImpactAssessment,
  getImpactAssessment,
  getReleaseById,
  getReleasesByAssetId,
  regenerateImpactAssessment,
  ReleaseImpactAssessmentRecord,
  ReleaseRecord,
  updateRelease,
} from "../../../services/release.service";
import { navigateToDocumentPortal } from "../../utils/moduleNavigation";
import { PermissionGuard } from "../../auth/PermissionGuard";
import { useAuth } from "../../auth/useAuth";
import { useCurrentActor } from "../../auth/useCurrentActor";
import { ConfirmStrip, EmptyState, FilterBar, RightPanel, SearchableCombobox, StatusBadge, WorkflowStepper, type WorkflowStep } from "../../components/foundation";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Textarea } from "../../components/ui/textarea";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import {
  buildCreateReleasePayload,
  buildUpdateReleasePayload,
  DOCUMENTATION_MODE_MANUAL,
  DOCUMENTATION_MODE_ONLINE_FETCH,
  EMPTY_RELEASE_FORM,
  formatDocumentationMode,
  formatReleaseDateTime,
  getAssessmentDiffSummary,
  getDocumentationModeBadgeClass,
  getImpactLevelBadgeClass,
  mapReleaseAxiosError,
  releaseToForm,
  renderReleaseFieldError,
  ReleaseFieldErrors,
  ReleaseFormState,
  validateReleaseForm,
} from "../../components/assets/releaseForm.shared";
import {
  formatAuthoredDocumentDate,
  formatAuthoredDocumentPublishStatus,
  formatAuthoredDocumentStatus,
  getAuthoredDocumentPublishBadgeClass,
  getAuthoredDocumentStatusBadgeClass,
} from "../../components/assets/authoredDocumentForm.shared";
import {
  formatDocumentLinkDate,
  formatDocumentLinkType,
  formatDocumentSourceSystem,
  formatVectorizationStatus,
  getVectorizationStatusBadgeClass,
  loadOmsSourceSystemOptions,
} from "../../components/assets/documentLinkForm.shared";
import {
  formatQualificationDocumentDate,
  formatQualificationStatus,
  formatQualificationType,
  getQualificationStatusBadgeClass,
  getQualificationTypeBadgeClass,
} from "../../components/assets/qualificationDocumentForm.shared";
import { LookupOption } from "../../services/lookupValue.service";

interface ReleaseRow {
  release: ReleaseRecord;
  asset: AssetRecord;
}

type AssessmentAvailability = "unknown" | "available" | "missing" | "error";
type WorkflowStepKey = "details" | "assessment" | "documentation" | "decision";
type PanelMode = "create" | "detail";
type DerivedWorkflowStatus = "DRAFT" | "ASSESSMENT_PENDING" | "ASSESSMENT_DONE" | "DOCUMENTATION_AVAILABLE" | "RELEASED";

interface WorkflowStatusMeta {
  code: DerivedWorkflowStatus;
  label: string;
  badge: "active" | "inactive" | "pending" | "error";
}

interface WorkflowDocuments {
  authored: AuthoredDocumentRecord[];
  qualification: QualificationDocumentRecord[];
  linked: DocumentLinkRecord[];
}

const WORKFLOW_STEPS: Array<{ key: WorkflowStepKey; label: string; description: string }> = [
  { key: "details", label: "Release Details", description: "Version, dates, and documentation source" },
  { key: "assessment", label: "Impact Assessment", description: "Generate, review, and download impact report" },
  { key: "documentation", label: "Documentation", description: "Release documents and portal navigation" },
  { key: "decision", label: "Release Decision", description: "Completion readiness and final transition" },
];

const STATUS_FILTERS: Array<{ value: DerivedWorkflowStatus; label: string }> = [
  { value: "DRAFT", label: "Draft" },
  { value: "ASSESSMENT_PENDING", label: "Assessment Pending" },
  { value: "ASSESSMENT_DONE", label: "Assessment Done" },
  { value: "DOCUMENTATION_AVAILABLE", label: "Documentation Available" },
  { value: "RELEASED", label: "Released" },
];

const normalize = (value?: string | null): string => (value ?? "").trim();

const getInitialAssetFilter = (): string | null => {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("asset_id") || null;
};

const updateAssetQueryParam = (assetId: string | null) => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.pathname = "/asset-releases";
  if (!assetId) {
    url.searchParams.delete("asset_id");
  } else {
    url.searchParams.set("asset_id", assetId);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
};

const findAssetByToken = (assets: AssetRecord[], token: string | null): AssetRecord | null => {
  if (!token) return null;
  return assets.find((asset) => asset.asset_uuid === token || asset.asset_id === token) ?? null;
};

const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const getSortValue = (release: ReleaseRecord): number => {
  const parsed = Date.parse(release.modified_dt ?? release.created_dt ?? release.end_dt ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatValue = (value?: string | null): string => {
  if (!value || !value.trim()) return "-";
  return value;
};

const hasReleaseDocumentation = (release: ReleaseRecord, documents?: WorkflowDocuments | null): boolean => {
  if (normalize(release.documentation_text) || normalize(release.documentation_source_url) || release.documentation_fetched_at) {
    return true;
  }
  if (!documents) return false;
  return documents.authored.length + documents.qualification.length + documents.linked.length > 0;
};

const realWorkflowStatus = (release: ReleaseRecord): string | null => {
  const record = release as ReleaseRecord & {
    workflow_status?: string | null;
    release_status?: string | null;
    status?: string | null;
    is_released?: boolean | null;
  };
  if (record.is_released) return "RELEASED";
  return record.workflow_status ?? record.release_status ?? record.status ?? null;
};

const deriveWorkflowStatus = (
  release: ReleaseRecord | null,
  assessmentAvailability: AssessmentAvailability,
  documents?: WorkflowDocuments | null,
): WorkflowStatusMeta => {
  if (!release) return { code: "DRAFT", label: "Draft", badge: "pending" };

  const persistedStatus = realWorkflowStatus(release);
  if (persistedStatus === "RELEASED") return { code: "RELEASED", label: "Released", badge: "active" };

  if (hasReleaseDocumentation(release, documents)) {
    return { code: "DOCUMENTATION_AVAILABLE", label: "Documentation Available", badge: "active" };
  }
  if (assessmentAvailability === "available") {
    return { code: "ASSESSMENT_DONE", label: "Assessment Done", badge: "active" };
  }
  return { code: "ASSESSMENT_PENDING", label: "Assessment Pending", badge: "pending" };
};

const assessmentLabel = (availability: AssessmentAvailability): string => {
  if (availability === "available") return "Available";
  if (availability === "missing") return "Pending";
  if (availability === "error") return "Unavailable";
  return "Checking";
};

const WorkflowStatusBadge = ({ status }: { status: WorkflowStatusMeta }) => (
  <span className="inline-flex flex-wrap items-center gap-2">
    <StatusBadge status={status.badge} />
    <span className="text-xs font-medium text-slate-600">{status.label}</span>
  </span>
);

const DocumentCount = ({ label, count }: { label: string; count: number }) => (
  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-semibold text-slate-900">{count}</p>
  </div>
);

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <div className="mt-1 break-words text-sm font-medium text-slate-900">{value}</div>
  </div>
);

function ReleaseFormFields({
  formData,
  fieldErrors,
  disabled,
  onChange,
}: {
  formData: ReleaseFormState;
  fieldErrors: ReleaseFieldErrors;
  disabled?: boolean;
  onChange: <K extends keyof ReleaseFormState>(key: K, value: ReleaseFormState[K]) => void;
}) {
  return (
    <div className="space-y-4">
      {renderReleaseFieldError(fieldErrors, "form")}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <Input
            label="Version"
            value={formData.version}
            onChange={(event) => onChange("version", event.target.value)}
            disabled={disabled}
            required
          />
          {renderReleaseFieldError(fieldErrors, "version")}
        </div>
        <div className="space-y-1">
          <Input
            label="Release / Effective Date"
            type="date"
            value={formData.end_dt}
            onChange={(event) => onChange("end_dt", event.target.value)}
            disabled={disabled}
          />
          {renderReleaseFieldError(fieldErrors, "end_dt")}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">Documentation Mode</label>
        <select
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
          value={formData.documentation_mode}
          onChange={(event) => onChange("documentation_mode", event.target.value)}
          disabled={disabled}
        >
          <option value={DOCUMENTATION_MODE_MANUAL}>{formatDocumentationMode(DOCUMENTATION_MODE_MANUAL)}</option>
          <option value={DOCUMENTATION_MODE_ONLINE_FETCH}>{formatDocumentationMode(DOCUMENTATION_MODE_ONLINE_FETCH)}</option>
        </select>
        {renderReleaseFieldError(fieldErrors, "documentation_mode")}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700">System Configuration Report</label>
        <Textarea
          rows={5}
          value={formData.system_config_report}
          onChange={(event) => onChange("system_config_report", event.target.value)}
          placeholder="Add system configuration details"
          disabled={disabled}
        />
        {renderReleaseFieldError(fieldErrors, "system_config_report")}
      </div>

      {formData.documentation_mode === DOCUMENTATION_MODE_MANUAL ? (
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Documentation Text</label>
          <Textarea
            rows={7}
            value={formData.documentation_text}
            onChange={(event) => onChange("documentation_text", event.target.value)}
            placeholder="Paste or enter release documentation used for impact assessment"
            disabled={disabled}
          />
          {renderReleaseFieldError(fieldErrors, "documentation_text")}
        </div>
      ) : (
        <div className="space-y-1">
          <Input
            label="Documentation Source URL"
            type="url"
            value={formData.documentation_source_url}
            onChange={(event) => onChange("documentation_source_url", event.target.value)}
            placeholder="https://example.com/release-notes"
            disabled={disabled}
          />
          {renderReleaseFieldError(fieldErrors, "documentation_source_url")}
        </div>
      )}
    </div>
  );
}

function ReleaseWorkflowPanel({
  open,
  initialMode,
  releaseRow,
  initialAssetId,
  assets,
  sourceSystemOptions,
  assessmentAvailability,
  onClose,
  onSaved,
}: {
  open: boolean;
  initialMode: PanelMode;
  releaseRow: ReleaseRow | null;
  initialAssetId: string | null;
  assets: AssetRecord[];
  sourceSystemOptions: LookupOption[];
  assessmentAvailability: AssessmentAvailability;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const { hasPermission } = useAuth();
  const currentActor = useCurrentActor();
  const actorName = currentActor.auditName ?? currentActor.displayName;
  const canCreate = hasPermission("ASSET_CREATE");
  const canEdit = hasPermission("ASSET_UPDATE");
  const canDeleteOrGenerate = hasPermission("ASSET_DELETE") || hasPermission("ASSET_UPDATE");
  const canExport = hasPermission("REPORT_EXPORT");
  const [panelMode, setPanelMode] = useState<PanelMode>(initialMode);
  const [step, setStep] = useState<WorkflowStepKey>("details");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(initialAssetId);
  const [release, setRelease] = useState<ReleaseRecord | null>(releaseRow?.release ?? null);
  const [asset, setAsset] = useState<AssetRecord | null>(releaseRow?.asset ?? null);
  const [formData, setFormData] = useState<ReleaseFormState>(EMPTY_RELEASE_FORM);
  const [initialFormData, setInitialFormData] = useState<ReleaseFormState>(EMPTY_RELEASE_FORM);
  const [fieldErrors, setFieldErrors] = useState<ReleaseFieldErrors>({});
  const [editingDetails, setEditingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [assessment, setAssessment] = useState<ReleaseImpactAssessmentRecord | null>(null);
  const [assessmentState, setAssessmentState] = useState<AssessmentAvailability>(assessmentAvailability);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<WorkflowDocuments>({ authored: [], qualification: [], linked: [] });
  const [documentsLoading, setDocumentsLoading] = useState(false);

  const selectedAsset = useMemo(() => findAssetByToken(assets, selectedAssetId), [assets, selectedAssetId]);
  const currentStatus = deriveWorkflowStatus(release, assessmentState, documents);
  const documentCount = documents.authored.length + documents.qualification.length + documents.linked.length;
  const workflowSteps: WorkflowStep[] = WORKFLOW_STEPS.map((item, index) => {
    const currentIndex = WORKFLOW_STEPS.findIndex((candidate) => candidate.key === step);
    return {
      key: item.key,
      label: item.label,
      description: item.description,
      status: index < currentIndex ? "complete" : item.key === step ? "active" : "pending",
    };
  });
  const assetOptions = useMemo(
    () => assets.map((item) => ({
      value: item.asset_uuid,
      label: `${item.asset_id} | ${item.asset_name || "Unnamed asset"}`,
      description: item.can_create_release ? "Release-managed asset" : "Release support may be unavailable",
      disabled: panelMode === "create" ? !item.can_create_release : false,
    })),
    [assets, panelMode],
  );

  const loadAssessment = useCallback(async (releaseId: string, options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setAssessmentLoading(true);
      setAssessmentError(null);
    }
    try {
      const data = await getImpactAssessment(releaseId);
      setAssessment(data);
      setAssessmentState("available");
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      const missing =
        axios.isAxiosError(error) &&
        error.response?.status === 404 &&
        mapped.message.toLowerCase().includes("impact assessment");
      setAssessment(null);
      setAssessmentState(missing ? "missing" : "error");
      if (!missing) setAssessmentError(mapped.message);
    } finally {
      if (!options.silent) setAssessmentLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async (releaseId: string) => {
    setDocumentsLoading(true);
    try {
      const [authored, qualification, linked] = await Promise.all([
        getReleaseAuthoredDocuments(releaseId),
        getReleaseQualificationDocuments(releaseId),
        getReleaseDocuments(releaseId),
      ]);
      setDocuments({ authored, qualification, linked });
    } catch (error) {
      console.error("Failed to load release documents:", error);
      toast.error("Failed to load release documents");
      setDocuments({ authored: [], qualification: [], linked: [] });
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setPanelMode(initialMode);
      setStep("details");
      setSelectedAssetId(initialAssetId);
      setRelease(null);
      setAsset(null);
      setFormData(EMPTY_RELEASE_FORM);
      setInitialFormData(EMPTY_RELEASE_FORM);
      setFieldErrors({});
      setEditingDetails(false);
      setSubmitting(false);
      setAssessment(null);
      setAssessmentState("unknown");
      setAssessmentLoading(false);
      setAssessmentError(null);
      setDocuments({ authored: [], qualification: [], linked: [] });
      setDocumentsLoading(false);
      return;
    }

    setPanelMode(initialMode);
    setStep("details");
    setSelectedAssetId(initialMode === "create" ? initialAssetId : releaseRow?.asset.asset_uuid ?? null);
    setRelease(releaseRow?.release ?? null);
    setAsset(releaseRow?.asset ?? null);
    setFormData(releaseRow?.release ? releaseToForm(releaseRow.release) : EMPTY_RELEASE_FORM);
    setInitialFormData(releaseRow?.release ? releaseToForm(releaseRow.release) : EMPTY_RELEASE_FORM);
    setFieldErrors({});
    setEditingDetails(initialMode === "create");
    setAssessmentState(assessmentAvailability);

    if (releaseRow?.release.release_id) {
      void loadAssessment(releaseRow.release.release_id, { silent: true });
      void loadDocuments(releaseRow.release.release_id);
    }
  }, [assessmentAvailability, initialAssetId, initialMode, loadAssessment, loadDocuments, open, releaseRow]);

  const updateField = <K extends keyof ReleaseFormState>(key: K, value: ReleaseFormState[K]) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const saveDetails = async () => {
    if (submitting) return;
    const targetAsset = selectedAsset ?? asset;
    const validationErrors = validateReleaseForm(formData, { createdDt: release?.created_dt });
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }
    if (panelMode === "create" && !targetAsset) {
      setFieldErrors({ form: "Select an asset before creating the release." });
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      if (panelMode === "create") {
        if (!targetAsset || !canCreate) return;
        const created = await createRelease(targetAsset.asset_uuid, buildCreateReleasePayload(formData, actorName));
        toast.success("Release created successfully");
        setPanelMode("detail");
        setRelease(created);
        setAsset(targetAsset);
        setSelectedAssetId(targetAsset.asset_uuid);
        setFormData(releaseToForm(created));
        setInitialFormData(releaseToForm(created));
        setEditingDetails(false);
        setStep("assessment");
        await onSaved();
        await loadAssessment(created.release_id, { silent: true });
        await loadDocuments(created.release_id);
      } else if (release && canEdit) {
        const payload = buildUpdateReleasePayload(initialFormData, formData, actorName);
        if (Object.keys(payload).filter((key) => key !== "modified_by").length === 0) {
          toast.message("No changes to save");
          setEditingDetails(false);
          return;
        }
        const updated = await updateRelease(release.release_id, payload);
        toast.success("Release updated successfully");
        setRelease(updated);
        setFormData(releaseToForm(updated));
        setInitialFormData(releaseToForm(updated));
        setEditingDetails(false);
        await onSaved();
      }
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void saveDetails();
  };

  const handleGenerateAssessment = async () => {
    if (!release || !canDeleteOrGenerate) return;
    setAssessmentLoading(true);
    setAssessmentError(null);
    try {
      const data = await regenerateImpactAssessment(release.release_id);
      setAssessment(data);
      setAssessmentState("available");
      toast.success("Impact assessment generated successfully");
      await onSaved();
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      setAssessmentError(mapped.message);
      toast.error(mapped.message);
    } finally {
      setAssessmentLoading(false);
    }
  };

  const handleDownloadAssessment = async () => {
    if (!release || !canExport) return;
    try {
      const fileName = await downloadImpactAssessment(release.release_id);
      toast.success(`Downloaded ${fileName}`);
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    }
  };

  const openDocumentPortal = () => {
    const assetToken = asset?.asset_uuid || asset?.asset_id || release?.asset_id;
    if (!assetToken || !release) return;
    navigateToDocumentPortal(assetToken, release.release_id);
  };

  const renderDetails = () => (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Asset" value={asset?.asset_name || selectedAsset?.asset_name || "-"} />
          <Field label="Asset ID" value={asset?.asset_id || selectedAsset?.asset_id || release?.asset_id || "-"} />
          <Field label="Workflow Status" value={<WorkflowStatusBadge status={currentStatus} />} />
        </div>
      </div>

      {panelMode === "create" ? (
        <div className="space-y-1">
          <SearchableCombobox
            label="Asset"
            value={selectedAssetId}
            options={assetOptions}
            placeholder="Select release-managed asset"
            emptyText="No assets found"
            onChange={setSelectedAssetId}
          />
          {selectedAssetId && !selectedAsset?.can_create_release ? (
            <p className="text-xs text-amber-700">This asset class is not configured for upgrade-managed releases.</p>
          ) : null}
        </div>
      ) : null}

      <ReleaseFormFields
        formData={formData}
        fieldErrors={fieldErrors}
        disabled={panelMode === "detail" && !editingDetails}
        onChange={updateField}
      />

      <div className="flex justify-end gap-2">
        {panelMode === "detail" && !editingDetails ? (
          <PermissionGuard permission="ASSET_UPDATE">
            <Button type="button" onClick={() => setEditingDetails(true)}>
              Edit Release
            </Button>
          </PermissionGuard>
        ) : (
          <>
            {panelMode === "detail" ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setFormData(initialFormData);
                  setFieldErrors({});
                  setEditingDetails(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
            ) : null}
            <PermissionGuard permission={panelMode === "create" ? "ASSET_CREATE" : "ASSET_UPDATE"}>
              <Button type="submit" disabled={submitting || (panelMode === "create" && (!selectedAsset || !selectedAsset.can_create_release))}>
                {submitting ? "Saving..." : panelMode === "create" ? "Create Release" : "Save Changes"}
              </Button>
            </PermissionGuard>
          </>
        )}
      </div>
    </form>
  );

  const renderAssessment = () => {
    const diffSummary = getAssessmentDiffSummary(assessment);
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field label="Assessment Status" value={assessmentLabel(assessmentState)} />
          <Field label="Impact Level" value={
            assessment ? (
              <Badge variant="outline" className={getImpactLevelBadgeClass(assessment.impact_level)}>
                {assessment.impact_level || "Not Rated"}
              </Badge>
            ) : "-"
          } />
          <Field label="Generated" value={formatReleaseDateTime(assessment?.generated_dt)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <PermissionGuard permission="ASSET_UPDATE">
            <Button type="button" onClick={() => void handleGenerateAssessment()} disabled={!release || assessmentLoading}>
              <RefreshCw className="h-4 w-4" />
              {assessment ? "Regenerate Assessment" : "Generate Assessment"}
            </Button>
          </PermissionGuard>
          <PermissionGuard permission="REPORT_EXPORT">
            <Button type="button" variant="secondary" onClick={() => void handleDownloadAssessment()} disabled={!release || !assessment}>
              <Download className="h-4 w-4" />
              Download Assessment PDF
            </Button>
          </PermissionGuard>
        </div>

        {assessmentLoading ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Loading impact assessment...
          </div>
        ) : assessmentError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            {assessmentError}
          </div>
        ) : !assessment ? (
          <EmptyState title="No impact assessment available" description="Generate an impact assessment using the existing release assessment API." />
        ) : (
          <div className="space-y-4">
            {diffSummary ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="Comparison Type" value={typeof diffSummary.comparison_type === "string" ? diffSummary.comparison_type : "-"} />
                <Field label="Similarity Ratio" value={typeof diffSummary.similarity_ratio === "number" ? diffSummary.similarity_ratio.toFixed(4) : "-"} />
                <Field label="Changed Segments" value={typeof diffSummary.changed_segments === "number" ? diffSummary.changed_segments : "-"} />
              </div>
            ) : null}
            <div className="max-h-[28rem] overflow-y-auto rounded-md border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900">{assessment.report_title}</p>
              <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {assessment.report_content}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderDocumentRows = () => {
    if (documentsLoading) {
      return <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">Loading documents...</div>;
    }
    if (documentCount === 0) {
      return (
        <EmptyState
          title="No release documents found"
          description="Use Document Portal for full document authoring, qualification, linking, and lifecycle management."
        />
      );
    }

    return (
      <div className="space-y-4">
        {documents.authored.length > 0 ? (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900">Authored Documents</h4>
            {documents.authored.slice(0, 5).map((document) => (
              <div key={document.authored_document_id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{document.title || document.document_type}</p>
                    <p className="mt-1 text-xs text-slate-500">{document.document_type} - {formatAuthoredDocumentDate(document.modified_dt ?? document.created_dt)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={getAuthoredDocumentStatusBadgeClass(document.status)}>
                      {formatAuthoredDocumentStatus(document.status)}
                    </Badge>
                    <Badge variant="outline" className={getAuthoredDocumentPublishBadgeClass(document.publish_status)}>
                      {formatAuthoredDocumentPublishStatus(document.publish_status)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {documents.qualification.length > 0 ? (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900">Qualification Documents</h4>
            {documents.qualification.slice(0, 5).map((document) => (
              <div key={document.qualification_document_id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{document.document_name || document.qualification_type}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatQualificationDocumentDate(document.submission_date)} - {document.supplier_name || "-"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={getQualificationTypeBadgeClass(document.qualification_type)}>
                      {formatQualificationType(document.qualification_type)}
                    </Badge>
                    <Badge variant="outline" className={getQualificationStatusBadgeClass(document.status)}>
                      {formatQualificationStatus(document.status)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {documents.linked.length > 0 ? (
          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-900">Linked Documents</h4>
            {documents.linked.slice(0, 5).map((document) => (
              <div key={document.document_link_id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{document.document_name || document.external_document_id || "-"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDocumentLinkType(document.document_type)} - {formatDocumentSourceSystem(document.source_system, sourceSystemOptions)} - {formatDocumentLinkDate(document.upload_dt)}
                    </p>
                  </div>
                  <Badge variant="outline" className={getVectorizationStatusBadgeClass(document.vectorization_status)}>
                    {formatVectorizationStatus(document.vectorization_status)}
                  </Badge>
                </div>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    );
  };

  const renderDocumentation = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Documentation Mode" value={
          <Badge variant="outline" className={getDocumentationModeBadgeClass(release?.documentation_mode)}>
            {formatDocumentationMode(release?.documentation_mode)}
          </Badge>
        } />
        <Field label="Source URL" value={formatValue(release?.documentation_source_url)} />
        <Field label="Fetched At" value={formatReleaseDateTime(release?.documentation_fetched_at)} />
      </div>

      {release?.documentation_text ? (
        <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700">
          {release.documentation_text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <DocumentCount label="Authored" count={documents.authored.length} />
        <DocumentCount label="Qualification" count={documents.qualification.length} />
        <DocumentCount label="Linked" count={documents.linked.length} />
      </div>

      <PermissionGuard permission="DOCUMENT_VIEW">
        <Button type="button" variant="secondary" onClick={openDocumentPortal} disabled={!release}>
          <ExternalLink className="h-4 w-4" />
          Open Document Portal
        </Button>
      </PermissionGuard>

      {renderDocumentRows()}
    </div>
  );

  const renderDecision = () => {
    const hasAssessment = assessmentState === "available";
    const hasDocs = documentCount > 0 || hasReleaseDocumentation(release ?? ({} as ReleaseRecord), documents);
    const released = currentStatus.code === "RELEASED";
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Current Status" value={<WorkflowStatusBadge status={currentStatus} />} />
          <Field label="Last Updated" value={formatReleaseDateTime(release?.modified_dt ?? release?.created_dt)} />
        </div>
        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-4">
          {[
            { label: "Release record saved", done: Boolean(release) },
            { label: "Impact assessment generated", done: hasAssessment },
            { label: "Documentation available", done: hasDocs },
            { label: "Final release transition persisted", done: released },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
              <span className="text-sm font-medium text-slate-700">{item.label}</span>
              <StatusBadge status={item.done ? "active" : "pending"} />
            </div>
          ))}
        </div>
        {!released ? (
          <EmptyState
            title="Release transition is read-only"
            description="Backend workflow status is required before Asset Releases can persist a final release transition."
            icon={<FileText className="h-5 w-5" />}
          />
        ) : null}
        {/* TODO: Backend workflow status required for final release transition. */}
      </div>
    );
  };

  return (
    <RightPanel
      open={open}
      title={panelMode === "create" ? "Create Release" : `Release ${release?.version || ""}`}
      description={panelMode === "create" ? "Create a release using the existing asset release API." : asset?.asset_name || release?.asset_name}
      onClose={onClose}
      widthClassName="max-w-6xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Close
          </Button>
          {panelMode === "detail" ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setStep("details")}>Details</Button>
              <Button type="button" variant="secondary" onClick={() => setStep("assessment")}>Assessment</Button>
              <Button type="button" variant="secondary" onClick={() => setStep("documentation")}>Documentation</Button>
            </div>
          ) : null}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="rounded-md border border-slate-200 bg-white p-3">
          <WorkflowStepper
            steps={workflowSteps}
            currentStep={step}
            onStepClick={(nextStep) => {
              if (panelMode === "create" && nextStep.key !== "details") return;
              setStep(nextStep.key as WorkflowStepKey);
            }}
          />
        </aside>
        <div className="min-w-0">
          {step === "details" ? renderDetails() : null}
          {step === "assessment" ? renderAssessment() : null}
          {step === "documentation" ? renderDocumentation() : null}
          {step === "decision" ? renderDecision() : null}
        </div>
      </div>
    </RightPanel>
  );
}

export function AssetReleasesPage() {
  const header = getPageHeaderConfig("asset-releases");
  const { hasPermission } = useAuth();
  const canEditRelease = hasPermission("ASSET_UPDATE");
  const canDeleteRelease = hasPermission("ASSET_DELETE");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [sourceSystemOptions, setSourceSystemOptions] = useState<LookupOption[]>([]);
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [assessmentByReleaseId, setAssessmentByReleaseId] = useState<Record<string, AssessmentAvailability>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState<string | null>(getInitialAssetFilter);
  const [statusFilter, setStatusFilter] = useState<DerivedWorkflowStatus | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("detail");
  const [selectedRow, setSelectedRow] = useState<ReleaseRow | null>(null);
  const [releaseToDelete, setReleaseToDelete] = useState<ReleaseRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedAsset = useMemo(() => findAssetByToken(assets, assetFilter), [assetFilter, assets]);
  const assetOptions = useMemo(
    () => assets.map((asset) => ({
      value: asset.asset_uuid,
      label: `${asset.asset_id} | ${asset.asset_name || "Unnamed asset"}`,
      description: asset.can_create_release ? "Release-managed asset" : "Release support may be unavailable",
    })),
    [assets],
  );

  const refreshAssessmentAvailability = useCallback(async (nextRows: ReleaseRow[]) => {
    const nextEntries = await Promise.all(
      nextRows.map(async ({ release }) => {
        try {
          await getImpactAssessment(release.release_id);
          return [release.release_id, "available"] as const;
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            return [release.release_id, "missing"] as const;
          }
          return [release.release_id, "error"] as const;
        }
      }),
    );
    setAssessmentByReleaseId(Object.fromEntries(nextEntries));
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const [assetData, sourceOptions] = await Promise.all([getAssets(), loadOmsSourceSystemOptions()]);
      const releaseResults = await Promise.allSettled(
        assetData.map(async (asset) => ({
          asset,
          releases: await getReleasesByAssetId(asset.asset_uuid),
        })),
      );
      const nextRows = releaseResults.flatMap((result) => {
        if (result.status !== "fulfilled") return [];
        return result.value.releases.map((release) => ({ asset: result.value.asset, release }));
      }).sort((left, right) => getSortValue(right.release) - getSortValue(left.release));

      setAssets(assetData);
      setSourceSystemOptions(sourceOptions);
      setRows(nextRows);

      const initialAsset = findAssetByToken(assetData, assetFilter);
      if (initialAsset && initialAsset.asset_uuid !== assetFilter) {
        setAssetFilter(initialAsset.asset_uuid);
        updateAssetQueryParam(initialAsset.asset_uuid);
      }

      void refreshAssessmentAvailability(nextRows);
    } catch (error) {
      console.error("Failed to load asset releases:", error);
      toast.error("Failed to load asset releases");
    } finally {
      setLoading(false);
    }
  }, [assetFilter, refreshAssessmentAvailability]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(({ asset, release }) => {
      if (assetFilter && asset.asset_uuid !== assetFilter && asset.asset_id !== assetFilter) return false;
      const status = deriveWorkflowStatus(release, assessmentByReleaseId[release.release_id] ?? "unknown");
      if (statusFilter && status.code !== statusFilter) return false;
      if (!query) return true;
      return [
        release.version,
        release.system_config_report,
        release.documentation_text,
        release.documentation_source_url,
        asset.asset_id,
        asset.asset_name,
        release.asset_name,
      ]
        .map((value) => normalize(value).toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [assetFilter, assessmentByReleaseId, rows, search, statusFilter]);

  const headerStats = buildPageHeaderStats(header.stats, {
    releases: filteredRows.length,
    assets: new Set(filteredRows.map((row) => row.asset.asset_uuid)).size,
    manual: filteredRows.filter((row) => row.release.documentation_mode === DOCUMENTATION_MODE_MANUAL).length,
    online: filteredRows.filter((row) => row.release.documentation_mode === DOCUMENTATION_MODE_ONLINE_FETCH).length,
  });

  const handleAssetFilterChange = (value: string | null) => {
    setAssetFilter(value);
    updateAssetQueryParam(value);
  };

  const openCreatePanel = () => {
    setPanelMode("create");
    setSelectedRow(null);
    setPanelOpen(true);
  };

  const openWorkflowPanel = (row: ReleaseRow) => {
    setPanelMode("detail");
    setSelectedRow(row);
    setPanelOpen(true);
  };

  const handleDeleteRelease = async () => {
    if (!releaseToDelete || !canDeleteRelease) return;
    setDeleting(true);
    try {
      await deleteRelease(releaseToDelete.release.release_id);
      toast.success("Release deleted successfully");
      setReleaseToDelete(null);
      if (selectedRow?.release.release_id === releaseToDelete.release.release_id) {
        setPanelOpen(false);
        setSelectedRow(null);
      }
      await loadPage();
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Asset Releases"
        subtitle="Manage asset release versions, impact assessments, and supporting documentation"
        stats={headerStats}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <PermissionGuard permission="ASSET_CREATE">
              <Button type="button" onClick={openCreatePanel} disabled={loading}>
                <Plus className="h-4 w-4" />
                Create Release
              </Button>
            </PermissionGuard>
            <Button type="button" variant="secondary" onClick={() => void loadPage()} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className={PAGE_CONTENT_CLASS}>
        <FilterBar
          activeFilters={[
            ...(search.trim() ? [{ key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }] : []),
            ...(assetFilter ? [{ key: "asset", label: `Asset: ${selectedAsset?.asset_name || selectedAsset?.asset_id || assetFilter}`, onRemove: () => handleAssetFilterChange(null) }] : []),
            ...(statusFilter ? [{ key: "status", label: `Status: ${STATUS_FILTERS.find((item) => item.value === statusFilter)?.label ?? statusFilter}`, onRemove: () => setStatusFilter(null) }] : []),
          ]}
          onClearAll={() => {
            setSearch("");
            setStatusFilter(null);
            handleAssetFilterChange(null);
          }}
        >
          <Input
            label="Search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Version, title, or asset"
            wrapperClassName="min-w-64 flex-1"
          />
          <SearchableCombobox
            label="Asset"
            value={assetFilter}
            options={assetOptions}
            placeholder="All assets"
            emptyText="No assets found"
            onChange={handleAssetFilterChange}
          />
          <SearchableCombobox
            label="Workflow Status"
            value={statusFilter}
            options={STATUS_FILTERS.map((item) => ({ value: item.value, label: item.label }))}
            placeholder="All statuses"
            emptyText="No statuses found"
            onChange={(value) => setStatusFilter(value as DerivedWorkflowStatus | null)}
          />
        </FilterBar>

        {selectedAsset ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            Viewing releases for <span className="font-semibold">{selectedAsset.asset_name || selectedAsset.asset_id}</span>
          </div>
        ) : null}

        {releaseToDelete ? (
          <ConfirmStrip
            tone="danger"
            title="Delete release?"
            message={`This will delete release "${releaseToDelete.release.version}" for ${releaseToDelete.asset.asset_name || releaseToDelete.asset.asset_id}.`}
            confirmLabel={deleting ? "Deleting..." : "Delete"}
            onConfirm={() => void handleDeleteRelease()}
            onCancel={() => setReleaseToDelete(null)}
            disabled={deleting}
          />
        ) : null}

        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="min-w-[16rem] font-semibold">Asset</TableHead>
                <TableHead className="font-semibold">Release / Version</TableHead>
                <TableHead className="font-semibold">Release Date</TableHead>
                <TableHead className="font-semibold">Documentation Mode</TableHead>
                <TableHead className="font-semibold">Impact Assessment</TableHead>
                <TableHead className="font-semibold">Workflow Status</TableHead>
                <TableHead className="font-semibold">Last Updated</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                    Loading asset releases...
                  </TableCell>
                </TableRow>
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8">
                    <EmptyState title="No releases found" description="Create a release or adjust the filters to view existing release records." />
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row) => {
                  const availability = assessmentByReleaseId[row.release.release_id] ?? "unknown";
                  const status = deriveWorkflowStatus(row.release, availability);
                  return (
                    <TableRow key={row.release.release_id} className="hover:bg-slate-50">
                      <TableCell>
                        <div className="font-medium text-slate-900">{row.asset.asset_name || row.release.asset_name || "-"}</div>
                        <p className="mt-1 text-xs text-slate-500">{row.asset.asset_id || row.release.asset_id}</p>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900">{row.release.version || "-"}</TableCell>
                      <TableCell>{formatDate(row.release.end_dt ?? row.release.created_dt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getDocumentationModeBadgeClass(row.release.documentation_mode)}>
                          {formatDocumentationMode(row.release.documentation_mode)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            availability === "available"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : availability === "error"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                          }
                        >
                          {assessmentLabel(availability)}
                        </Badge>
                      </TableCell>
                      <TableCell><WorkflowStatusBadge status={status} /></TableCell>
                      <TableCell>{formatReleaseDateTime(row.release.modified_dt ?? row.release.created_dt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => openWorkflowPanel(row)}>
                            Open Workflow
                          </Button>
                          <PermissionGuard permission="ASSET_UPDATE">
                            {canEditRelease ? (
                              <Button type="button" variant="ghost" size="sm" onClick={() => openWorkflowPanel(row)}>
                                Edit
                              </Button>
                            ) : null}
                          </PermissionGuard>
                          <PermissionGuard permission="ASSET_DELETE">
                            {canDeleteRelease ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setReleaseToDelete(row)}
                              >
                                Delete
                              </Button>
                            ) : null}
                          </PermissionGuard>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </section>
      </div>

      <ReleaseWorkflowPanel
        open={panelOpen}
        initialMode={panelMode}
        releaseRow={selectedRow}
        initialAssetId={selectedAsset?.asset_uuid ?? assetFilter}
        assets={assets}
        sourceSystemOptions={sourceSystemOptions}
        assessmentAvailability={selectedRow ? assessmentByReleaseId[selectedRow.release.release_id] ?? "unknown" : "unknown"}
        onClose={() => {
          setPanelOpen(false);
          setSelectedRow(null);
        }}
        onSaved={async () => {
          await loadPage();
          if (selectedRow) {
            const detail = await getReleaseById(selectedRow.release.release_id).catch(() => null);
            if (detail) setSelectedRow((previous) => previous ? { ...previous, release: detail } : previous);
          }
        }}
      />

      <Toaster position="top-right" richColors />
    </div>
  );
}
