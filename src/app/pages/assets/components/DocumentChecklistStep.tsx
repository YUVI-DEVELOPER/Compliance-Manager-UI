import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CheckCircle2, ExternalLink, FileText, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  completeDocumentChecklist,
  DocumentRequirementGenerateResponse,
  DocumentRequirementRow,
  generateDocumentRequirements,
  getDocumentRequirements,
  linkDocumentRequirement,
  ReleaseRecord,
  updateDocumentRequirementStatus,
  waiveDocumentRequirement,
} from "../../../../services/release.service";
import { useCurrentActor } from "../../../auth/useCurrentActor";
import { EmptyState } from "../../../components/foundation";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Textarea } from "../../../components/ui/textarea";
import { formatReleaseEnum, mapReleaseAxiosError } from "../../../components/assets/releaseForm.shared";

interface DocumentChecklistStepProps {
  release: ReleaseRecord | null;
  canEdit: boolean;
  onLifecycleChanged?: (result: DocumentRequirementGenerateResponse | null) => Promise<void> | void;
  onOpenDocumentPortal?: () => void;
}

type ActionMode = "link" | "external" | "waiver";

interface PendingAction {
  mode: ActionMode;
  requirement: DocumentRequirementRow;
}

const normalize = (value?: string | null): string => (value ?? "").trim();

const statusBadgeClass = (status?: string | null): string => {
  if (status === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "WAIVED") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "IN_REVIEW") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "MISSING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "OBSOLETE" || status === "NOT_REQUIRED") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-slate-200 bg-white text-slate-700";
};

const levelBadgeClass = (level?: string | null): string => {
  if (level === "REQUIRED") return "border-red-200 bg-red-50 text-red-700";
  if (level === "CONDITIONAL") return "border-amber-200 bg-amber-50 text-amber-700";
  if (level === "OPTIONAL") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-slate-200 bg-white text-slate-600";
};

const SummaryCard = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
  </div>
);

const deriveFallbackActions = (row: DocumentRequirementRow): string[] => {
  if (["APPROVED", "WAIVED", "OBSOLETE", "NOT_REQUIRED"].includes(row.status)) {
    return row.external_url || row.file_path ? ["VIEW_SOURCE"] : [];
  }
  const actions: string[] = [];
  if (row.external_url || row.file_path) actions.push("VIEW_SOURCE");
  if (["MISSING", "DRAFT", "REJECTED"].includes(row.status)) actions.push("LINK_EXISTING", "ADD_EXTERNAL_URL");
  if (["DRAFT", "UPLOADED", "LINKED", "REJECTED"].includes(row.status)) actions.push("MARK_IN_REVIEW");
  if (row.status === "IN_REVIEW") actions.push("MARK_APPROVED", "MARK_REJECTED");
  if (row.waivable_flag) actions.push("REQUEST_WAIVER");
  return actions;
};

const sourceLabel = (row: DocumentRequirementRow): string => {
  if (row.external_url) return row.external_url;
  if (row.linked_document_link_id) return `Document Portal: ${row.linked_document_link_id}`;
  if (row.linked_authored_document_id) return `Authored: ${row.linked_authored_document_id}`;
  if (row.linked_qualification_document_id) return `Qualification: ${row.linked_qualification_document_id}`;
  if (row.file_name) return row.file_name;
  if (row.file_path) return row.file_path;
  return "-";
};

export function DocumentChecklistStep({
  release,
  canEdit,
  onLifecycleChanged,
  onOpenDocumentPortal,
}: DocumentChecklistStepProps) {
  const currentActor = useCurrentActor();
  const actorName = currentActor.auditName ?? currentActor.displayName;
  const releaseId = release?.release_id ?? null;
  const validationPackage = release?.validation_package ?? null;
  const [checklist, setChecklist] = useState<DocumentRequirementGenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [linkSourceType, setLinkSourceType] = useState("DOCUMENT_PORTAL");
  const [linkValue, setLinkValue] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [waiverReason, setWaiverReason] = useState("");
  const [approveWaiver, setApproveWaiver] = useState(false);

  const impactComplete =
    validationPackage?.impact_assessment_status === "COMPLETED" &&
    validationPackage.validation_scope !== "NOT_ASSESSED" &&
    validationPackage.risk_level !== "NOT_ASSESSED";
  const checklistStatus =
    checklist?.document_checklist_status ?? validationPackage?.document_checklist_status ?? "NOT_GENERATED";
  const summary = checklist?.summary;
  const requirements = checklist?.requirements ?? [];
  const canGenerate =
    impactComplete &&
    (checklistStatus === "NOT_GENERATED" || checklistStatus === "STALE" || requirements.length === 0);

  const load = useCallback(async () => {
    if (!releaseId || !validationPackage) {
      setChecklist(null);
      setPageError(null);
      return;
    }
    setLoading(true);
    setPageError(null);
    try {
      const data = await getDocumentRequirements(releaseId);
      setChecklist(data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setChecklist(null);
        setPageError("Validation package is missing for this release.");
      } else {
        const mapped = mapReleaseAxiosError(error);
        setPageError(mapped.message);
      }
    } finally {
      setLoading(false);
    }
  }, [releaseId, validationPackage]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetAction = () => {
    setPendingAction(null);
    setLinkSourceType("DOCUMENT_PORTAL");
    setLinkValue("");
    setExternalUrl("");
    setWaiverReason("");
    setApproveWaiver(false);
  };

  const handleGenerate = async () => {
    if (!releaseId || !canEdit) return;
    setBusy(true);
    setPageError(null);
    try {
      const result = await generateDocumentRequirements(releaseId);
      setChecklist(result);
      toast.success("Document checklist generated");
      await onLifecycleChanged?.(result);
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      setPageError(mapped.message);
      toast.error(mapped.message);
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (row: DocumentRequirementRow, status: string) => {
    if (!releaseId || !canEdit) return;
    setBusy(true);
    try {
      await updateDocumentRequirementStatus(releaseId, row.requirement_id, { status });
      toast.success("Requirement status updated");
      await load();
      await onLifecycleChanged?.(checklist);
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLinkSubmit = async () => {
    if (!releaseId || !pendingAction || !canEdit || !normalize(linkValue)) return;
    setBusy(true);
    try {
      await linkDocumentRequirement(releaseId, pendingAction.requirement.requirement_id, {
        source_type: linkSourceType,
        linked_document_link_id: linkSourceType === "DOCUMENT_PORTAL" ? normalize(linkValue) : null,
        linked_authored_document_id: linkSourceType === "AUTHORED_DOCUMENT" ? normalize(linkValue) : null,
        linked_qualification_document_id: linkSourceType === "QUALIFICATION_DOCUMENT" ? normalize(linkValue) : null,
        file_name: linkSourceType === "UPLOAD" ? normalize(linkValue) : null,
        status: "LINKED",
      });
      toast.success("Requirement linked");
      resetAction();
      await load();
      await onLifecycleChanged?.(checklist);
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setBusy(false);
    }
  };

  const handleExternalSubmit = async () => {
    if (!releaseId || !pendingAction || !canEdit || !normalize(externalUrl)) return;
    setBusy(true);
    try {
      await linkDocumentRequirement(releaseId, pendingAction.requirement.requirement_id, {
        source_type: "EXTERNAL_URL",
        external_url: normalize(externalUrl),
        status: "LINKED",
      });
      toast.success("External URL linked");
      resetAction();
      await load();
      await onLifecycleChanged?.(checklist);
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setBusy(false);
    }
  };

  const handleWaiverSubmit = async () => {
    if (!releaseId || !pendingAction || !canEdit || !normalize(waiverReason)) return;
    setBusy(true);
    try {
      await waiveDocumentRequirement(releaseId, pendingAction.requirement.requirement_id, {
        waiver_reason: normalize(waiverReason),
        approve: approveWaiver,
      });
      toast.success(approveWaiver ? "Waiver approved" : "Waiver requested");
      resetAction();
      await load();
      await onLifecycleChanged?.(checklist);
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!releaseId || !summary?.can_complete || !canEdit) return;
    setBusy(true);
    setPageError(null);
    try {
      const result = await completeDocumentChecklist(releaseId);
      setChecklist(result);
      if (result.nextStep === "TEST_EXECUTION") {
        toast.success("Checklist completed. Next step: Test Execution.");
      } else if (result.nextStep === "VALIDATION_SUMMARY") {
        toast.success("Checklist completed. Next step: Validation Summary.");
      } else {
        toast.success("Document checklist completed");
      }
      await onLifecycleChanged?.(result);
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      setPageError(mapped.message);
      toast.error(mapped.message);
    } finally {
      setBusy(false);
    }
  };

  const actionForm = useMemo(() => {
    if (!pendingAction) return null;
    const row = pendingAction.requirement;

    if (pendingAction.mode === "link") {
      return (
        <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 space-y-1">
              <label className="text-sm font-medium text-slate-700">Source Type</label>
              <select
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                value={linkSourceType}
                onChange={(event) => setLinkSourceType(event.target.value)}
                disabled={busy}
              >
                <option value="DOCUMENT_PORTAL">Document Portal</option>
                <option value="AUTHORED_DOCUMENT">Authored Document</option>
                <option value="QUALIFICATION_DOCUMENT">Qualification Document</option>
                <option value="UPLOAD">Uploaded File Metadata</option>
              </select>
            </div>
            <Input
              label={linkSourceType === "UPLOAD" ? "File Name" : "Document ID"}
              value={linkValue}
              onChange={(event) => setLinkValue(event.target.value)}
              wrapperClassName="min-w-72 flex-1"
              disabled={busy}
            />
            <Button type="button" onClick={() => void handleLinkSubmit()} disabled={busy || !normalize(linkValue)}>
              <Link2 className="h-4 w-4" />
              Link
            </Button>
            <Button type="button" variant="ghost" onClick={resetAction} disabled={busy}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-slate-500">Actor: {actorName || "-"}</p>
        </section>
      );
    }

    if (pendingAction.mode === "external") {
      return (
        <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <Input
              label="External URL"
              type="url"
              value={externalUrl}
              onChange={(event) => setExternalUrl(event.target.value)}
              wrapperClassName="min-w-80 flex-1"
              disabled={busy}
            />
            <Button type="button" onClick={() => void handleExternalSubmit()} disabled={busy || !normalize(externalUrl)}>
              <ExternalLink className="h-4 w-4" />
              Add URL
            </Button>
            <Button type="button" variant="ghost" onClick={resetAction} disabled={busy}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-slate-500">Actor: {actorName || "-"}</p>
        </section>
      );
    }

    return (
      <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">Waiver Reason</label>
          <Textarea
            rows={3}
            value={waiverReason}
            onChange={(event) => setWaiverReason(event.target.value)}
            disabled={busy}
          />
        </div>
        {row.waiver_requires_qa_flag ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">Waiver requires QA approval.</p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox
                checked={approveWaiver}
                onCheckedChange={(checked) => setApproveWaiver(Boolean(checked))}
                disabled={busy}
              />
              Approve waiver now
            </label>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleWaiverSubmit()} disabled={busy || !normalize(waiverReason)}>
            <ShieldCheck className="h-4 w-4" />
            {approveWaiver || !row.waiver_requires_qa_flag ? "Waive Requirement" : "Request Waiver"}
          </Button>
          <Button type="button" variant="ghost" onClick={resetAction} disabled={busy}>
            Cancel
          </Button>
        </div>
        <p className="text-xs text-slate-500">Actor: {actorName || "-"}</p>
      </section>
    );
  }, [actorName, approveWaiver, busy, externalUrl, linkSourceType, linkValue, pendingAction, waiverReason]);

  const openSource = (row: DocumentRequirementRow) => {
    const url = row.external_url || row.file_path;
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    onOpenDocumentPortal?.();
  };

  if (!release) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        Select or create a release to manage the document checklist.
      </div>
    );
  }

  if (!validationPackage) {
    return (
      <EmptyState
        title="Validation package required"
        description="This release does not have the Step 1 validation package needed for document checklist tracking."
        icon={<FileText className="h-5 w-5" />}
      />
    );
  }

  if (!impactComplete) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
        Complete Impact Assessment before generating document checklist.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 md:grid-cols-4">
          <SummaryCard label="Package No." value={checklist?.package_no ?? validationPackage.package_no ?? "-"} />
          <SummaryCard label="Validation Scope" value={formatReleaseEnum(checklist?.validation_scope ?? validationPackage.validation_scope)} />
          <SummaryCard label="Risk Level" value={formatReleaseEnum(checklist?.risk_level ?? validationPackage.risk_level)} />
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <p className="text-xs font-medium text-slate-500">Checklist Status</p>
            <Badge variant="outline" className={`mt-1 ${statusBadgeClass(checklistStatus)}`}>
              {formatReleaseEnum(checklistStatus)}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading || busy}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          {canGenerate ? (
            <Button type="button" onClick={() => void handleGenerate()} disabled={!canEdit || busy}>
              <FileText className="h-4 w-4" />
              {checklistStatus === "STALE" ? "Regenerate Checklist" : "Generate Checklist"}
            </Button>
          ) : null}
        </div>
      </section>

      {pageError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {pageError}
        </div>
      ) : null}

      {checklistStatus === "STALE" ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Impact assessment was reopened after checklist generation. Regenerate checklist before completion.
        </div>
      ) : null}

      {summary ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
          <SummaryCard label="Total" value={summary.total} />
          <SummaryCard label="Required" value={summary.required} />
          <SummaryCard label="Missing" value={summary.missing} />
          <SummaryCard label="In Review" value={summary.in_review} />
          <SummaryCard label="Approved" value={summary.approved} />
          <SummaryCard label="Waived" value={summary.waived} />
          <SummaryCard label="Blocking" value={summary.blocking_count} />
        </section>
      ) : null}

      {!summary?.can_complete && requirements.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Mandatory document requirements are still missing, rejected, or under review.
        </div>
      ) : null}

      {actionForm}

      {loading ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Loading document checklist...
        </div>
      ) : requirements.length === 0 ? (
        <EmptyState
          title="Checklist not generated"
          description="Generate the backend-controlled checklist after impact assessment completion."
          icon={<FileText className="h-5 w-5" />}
        />
      ) : (
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="min-w-[18rem] font-semibold">Document</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Requirement Level</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="min-w-[18rem] font-semibold">Trigger Reason</TableHead>
                  <TableHead className="font-semibold">Owner</TableHead>
                  <TableHead className="min-w-[14rem] font-semibold">Linked Source</TableHead>
                  <TableHead className="min-w-[18rem] font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requirements.map((row) => {
                  const actions = row.available_actions?.length ? row.available_actions : deriveFallbackActions(row);
                  return (
                    <TableRow key={row.requirement_id} className="align-top">
                      <TableCell>
                        <div className="font-medium text-slate-900">{row.document_name}</div>
                        <p className="mt-1 text-xs text-slate-500">{row.document_code}</p>
                        {!row.waivable_flag ? <p className="mt-2 text-xs text-slate-500">Non-waivable document.</p> : null}
                      </TableCell>
                      <TableCell>{formatReleaseEnum(row.document_category)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={levelBadgeClass(row.requirement_level)}>
                          {formatReleaseEnum(row.requirement_level)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadgeClass(row.status)}>
                          {formatReleaseEnum(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{row.trigger_reason || "-"}</TableCell>
                      <TableCell>{row.owner_role || "-"}</TableCell>
                      <TableCell className="break-all text-sm text-slate-600">{sourceLabel(row)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          {actions.includes("VIEW_SOURCE") ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => openSource(row)}>
                              View Source
                            </Button>
                          ) : null}
                          {actions.includes("LINK_EXISTING") ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setPendingAction({ mode: "link", requirement: row })} disabled={!canEdit || busy}>
                              Link Existing
                            </Button>
                          ) : null}
                          {actions.includes("ADD_EXTERNAL_URL") ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setPendingAction({ mode: "external", requirement: row })} disabled={!canEdit || busy}>
                              Add External URL
                            </Button>
                          ) : null}
                          {actions.includes("MARK_IN_REVIEW") ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => void handleStatus(row, "IN_REVIEW")} disabled={!canEdit || busy}>
                              Mark In Review
                            </Button>
                          ) : null}
                          {actions.includes("MARK_APPROVED") ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => void handleStatus(row, "APPROVED")} disabled={!canEdit || busy}>
                              Mark Approved
                            </Button>
                          ) : null}
                          {actions.includes("MARK_REJECTED") ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => void handleStatus(row, "REJECTED")} disabled={!canEdit || busy}>
                              Mark Rejected
                            </Button>
                          ) : null}
                          {actions.includes("REQUEST_WAIVER") ? (
                            <Button type="button" variant="ghost" size="sm" onClick={() => setPendingAction({ mode: "waiver", requirement: row })} disabled={!canEdit || busy}>
                              Request Waiver
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3">
        <PermissionHint canEdit={canEdit} />
        {summary?.can_complete ? (
          <Button type="button" onClick={() => void handleComplete()} disabled={!canEdit || busy || checklistStatus === "STALE"}>
            <CheckCircle2 className="h-4 w-4" />
            Complete Checklist
          </Button>
        ) : null}
      </section>
    </div>
  );
}

function PermissionHint({ canEdit }: { canEdit: boolean }) {
  if (canEdit) return null;
  return <p className="text-sm text-slate-500">Release update permission is required to change checklist requirements.</p>;
}
