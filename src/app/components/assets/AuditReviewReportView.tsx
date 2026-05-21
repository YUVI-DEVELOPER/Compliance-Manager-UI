import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Download, Eye, FileText, Loader2, RefreshCw, RotateCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  AuditReviewReportDetail,
  AuditReviewReportReviewDecisionPayload,
  AuditReviewReportStatus,
  AuditReviewReportSubmitReviewPayload,
  downloadAuditReviewReportPdf,
  getAuditReviewReportHtmlPreview,
} from "../../../services/audit-review.service";
import { PermissionGuard } from "../../auth/PermissionGuard";
import { useAuth } from "../../auth/useAuth";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Textarea } from "../ui/textarea";
import { AuditReviewAiSummaryPanel } from "./AuditReviewAiSummaryPanel";
import {
  AUDIT_REVIEW_SIGNATURE_MEANING,
  AuditReviewESignatureFields,
  getAuditReviewESignatureFieldErrors,
  type AuditReviewESignatureFieldErrors,
} from "./AuditReviewESignatureFields";
import { AuditReviewNotificationsPanel } from "./AuditReviewNotificationsPanel";

interface AuditReviewReportViewProps {
  report: AuditReviewReportDetail | null;
  loading?: boolean;
  refreshing?: boolean;
  actionLoading?: "submit-review" | "approve" | "reject" | "request-changes" | null;
  onRefresh?: () => void;
  onSubmitReview?: (payload: AuditReviewReportSubmitReviewPayload) => Promise<void>;
  onApprove?: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
  onReject?: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
  onRequestChanges?: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
  defaultNotificationActor?: string | null;
  onNotificationsChanged?: () => void;
  showRelatedPanels?: boolean;
}

const formatDateTime = (value?: string | null): string => {
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

const formatLabel = (value?: string | null): string => {
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

const getReportStatusBadgeClass = (status?: AuditReviewReportStatus | null): string => {
  if (status === "APPROVED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "UNDER_REVIEW") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "REJECTED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "CHANGES_REQUESTED") return "border-orange-200 bg-orange-50 text-orange-700";
  if (status === "SUPERSEDED") return "border-slate-200 bg-slate-100 text-slate-600";
  if (status === "DRAFT") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-slate-200 bg-white text-slate-700";
};

const getSubmissionNotes = (approvalDecision?: Record<string, unknown> | null): string | null => {
  const submission = approvalDecision?.submission;
  if (submission && typeof submission === "object" && !Array.isArray(submission)) {
    const notes = (submission as Record<string, unknown>).submission_notes;
    if (typeof notes === "string" && notes.trim()) return notes;
  }

  const fallback = approvalDecision?.submission_notes;
  return typeof fallback === "string" && fallback.trim() ? fallback : null;
};

const getWorkflowText = (workflow: Record<string, unknown> | undefined, key: string): string | null => {
  const value = workflow?.[key];
  return typeof value === "string" && value.trim() ? value : null;
};

const formatStatusWithDate = (label: string, value?: string | null): string => {
  if (!value) return label;
  return `${label} (${formatDateTime(value)})`;
};

const getPdfButtonLabel = (status?: AuditReviewReportStatus | null): string => {
  if (status === "APPROVED") return "Download Approved PDF";
  return "Download Approved PDF";
};

const MetadataItem = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="min-w-0">
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-1 break-words text-sm font-medium text-slate-900">{value && value.trim() ? value : "-"}</p>
  </div>
);

function ReportPdfPreviewFrame({
  reportId,
  html,
  loading,
  error,
  onRetry,
}: {
  reportId?: string | null;
  html: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="ml-2">Loading report preview...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 px-6 text-center text-sm text-red-700">
        <span>{error}</span>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }
  if (!html) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
        Report preview is loading.
      </div>
    );
  }
  return (
    <iframe
      title={`Audit review report preview ${reportId || ""}`}
      srcDoc={html}
      sandbox=""
      className="h-full w-full rounded-lg border border-slate-300 bg-white shadow-sm"
    />
  );
}

export function AuditReviewReportView({
  report,
  loading = false,
  refreshing = false,
  actionLoading = null,
  onRefresh,
  onSubmitReview,
  onApprove,
  onReject,
  onRequestChanges,
  defaultNotificationActor,
  onNotificationsChanged,
  showRelatedPanels = true,
}: AuditReviewReportViewProps) {
  const { hasPermission, user } = useAuth();
  const [fullOpen, setFullOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [submissionNotes, setSubmissionNotes] = useState("Please review the draft audit trail report.");
  const [approveComments, setApproveComments] = useState("");
  const [approveEmail, setApproveEmail] = useState("");
  const [approvePassword, setApprovePassword] = useState("");
  const [approveConfirmed, setApproveConfirmed] = useState(false);
  const [approveErrors, setApproveErrors] = useState<AuditReviewESignatureFieldErrors>({});
  const [rejectComments, setRejectComments] = useState("");
  const [changesComments, setChangesComments] = useState("");
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const status = report?.status;
  const reportId = report?.report_id || null;
  const reportPreviewKey = report ? `${report.report_id}:${report.status}:${report.modified_dt || ""}` : "";
  const reportStatusText = formatLabel(status);
  const submissionNotesText = getSubmissionNotes(report?.approval_decision_json);
  const workflowMetadata = report?.workflow_metadata;
  const decisionBy = getWorkflowText(workflowMetadata, "decision_by_name") || report?.reviewed_by || null;
  const decisionAt = getWorkflowText(workflowMetadata, "decision_at") || report?.reviewed_dt || null;
  const eSignatureStatus = report?.is_e_signed
    ? formatStatusWithDate("Signed", report.e_signed_at || getWorkflowText(workflowMetadata, "e_signed_at"))
    : "Not signed";
  const lockStatus = report?.is_locked
    ? formatStatusWithDate("Locked", report.locked_at || getWorkflowText(workflowMetadata, "locked_at"))
    : "Unlocked";
  const canSubmitReview = Boolean(report && status === "DRAFT" && onSubmitReview && hasPermission("AUDIT_REPORT_SUBMIT"));
  const canApproveReport = Boolean(report && status === "UNDER_REVIEW" && onApprove && hasPermission("AUDIT_REPORT_APPROVE"));
  const canRejectReport = Boolean(report && status === "UNDER_REVIEW" && onReject && hasPermission("AUDIT_REPORT_REJECT"));
  const canRequestReportChanges = Boolean(
    report && status === "UNDER_REVIEW" && onRequestChanges && hasPermission("AUDIT_REPORT_REQUEST_CHANGES"),
  );
  const isSubmitBusy = actionLoading === "submit-review";
  const isApproveBusy = actionLoading === "approve";
  const isRejectBusy = actionLoading === "reject";
  const isChangesBusy = actionLoading === "request-changes";
  const isPdfBusy = pdfDownloading;
  const canDownloadApprovedPdf = Boolean(report && status === "APPROVED");
  const canSubmitApproval = Boolean(
    approveComments.trim() &&
    approveEmail.trim() &&
    approvePassword.trim() &&
    approveConfirmed &&
    !isApproveBusy,
  );

  const loadPreview = useCallback(async (showToast = false) => {
    if (!reportId) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const html = await getAuditReviewReportHtmlPreview(reportId);
      setPreviewHtml(html);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Audit review report preview failed.";
      setPreviewError(message);
      if (showToast) toast.error(message);
    } finally {
      setPreviewLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    setPreviewHtml(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setApproveComments("");
    setApproveEmail("");
    setApprovePassword("");
    setApproveConfirmed(false);
    setApproveErrors({});
    if (reportId) void loadPreview(false);
  }, [loadPreview, reportId, reportPreviewKey]);

  const closeApproveDialog = () => {
    setApproveOpen(false);
    setApproveEmail("");
    setApprovePassword("");
    setApproveConfirmed(false);
    setApproveErrors({});
  };

  const clearApproveError = (field: keyof AuditReviewESignatureFieldErrors) => {
    setApproveErrors((current) => ({ ...current, [field]: null, form: null }));
  };

  const handleSubmitReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onSubmitReview || !canSubmitReview) return;
    try {
      await onSubmitReview({
        submission_notes: submissionNotes.trim() || null,
      });
      setSubmitOpen(false);
    } catch {
      return;
    }
  };

  const handleApprove = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onApprove || !canApproveReport) return;
    if (!approveEmail.trim() || !approvePassword.trim() || !approveConfirmed) {
      setApproveErrors({
        email: !approveEmail.trim() ? "Enter your user email." : null,
        password: !approvePassword.trim() ? "Enter your current password." : null,
        confirmed: !approveConfirmed ? "Confirm the electronic signature acknowledgement." : null,
      });
      return;
    }
    const signedInEmail = user?.email?.trim().toLowerCase();
    if (signedInEmail && approveEmail.trim().toLowerCase() !== signedInEmail) {
      setApproveErrors({ email: "Electronic signature email must match the signed-in user." });
      return;
    }
    setApproveErrors({});
    try {
      await onApprove({
        reviewer_comments: approveComments.trim(),
        e_signature: {
          user_email: approveEmail.trim(),
          current_password: approvePassword,
          signature_meaning: AUDIT_REVIEW_SIGNATURE_MEANING,
          confirmed: approveConfirmed,
        },
      });
      closeApproveDialog();
    } catch (error) {
      setApproveErrors(getAuditReviewESignatureFieldErrors(error));
      return;
    }
  };

  const handleReject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onReject || !canRejectReport) return;
    try {
      await onReject({
        reviewer_comments: rejectComments.trim(),
      });
      setRejectOpen(false);
    } catch {
      return;
    }
  };

  const handleRequestChanges = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onRequestChanges || !canRequestReportChanges) return;
    try {
      await onRequestChanges({
        reviewer_comments: changesComments.trim(),
      });
      setChangesOpen(false);
    } catch {
      return;
    }
  };

  const handleDownloadPdf = async () => {
    if (!report) return;
    if (report.status !== "APPROVED") {
      toast.error("PDF download is available only after final QA approval.");
      return;
    }

    setPdfDownloading(true);
    try {
      const download = await downloadAuditReviewReportPdf(report.report_id);
      const url = URL.createObjectURL(download.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = download.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Audit review PDF download failed.");
    } finally {
      setPdfDownloading(false);
    }
  };

  return (
    <>
      <section id="audit-review-report-section" className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit review report">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Audit Review Report</h3>
                {report ? (
                  <Badge variant="outline" className={getReportStatusBadgeClass(report.status)}>
                    {formatLabel(report.status)}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {report ? `Generated ${formatDateTime(report.created_dt)}` : "Draft report becomes available after report generation."}
              </p>
              {report?.report_id ? (
                <p className="mt-1 max-w-full truncate font-mono text-[11px] text-slate-400" title={report.report_id}>
                  Report ID {report.report_id}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <PermissionGuard permission="AUDIT_REPORT_SUBMIT">
              {canSubmitReview ? (
                <Button type="button" size="sm" onClick={() => setSubmitOpen(true)} disabled={loading || Boolean(actionLoading)}>
                  {isSubmitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit for QA Review
                </Button>
              ) : null}
            </PermissionGuard>
            <PermissionGuard permission="AUDIT_REPORT_APPROVE">
              {canApproveReport ? (
                <Button type="button" size="sm" onClick={() => setApproveOpen(true)} disabled={loading || Boolean(actionLoading)}>
                  {isApproveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Sign and Approve
                </Button>
              ) : null}
            </PermissionGuard>
            <PermissionGuard permission="AUDIT_REPORT_REJECT">
              {canRejectReport ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setRejectOpen(true)} disabled={loading || Boolean(actionLoading)}>
                  {isRejectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Reject
                </Button>
              ) : null}
            </PermissionGuard>
            <PermissionGuard permission="AUDIT_REPORT_REQUEST_CHANGES">
              {canRequestReportChanges ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setChangesOpen(true)} disabled={loading || Boolean(actionLoading)}>
                  {isChangesBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Request Changes
                </Button>
              ) : null}
            </PermissionGuard>
            {status === "APPROVED" ? (
              <Badge variant="outline" className="h-9 border-emerald-200 bg-emerald-50 px-3 text-emerald-700">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                Approved
              </Badge>
            ) : null}
            {status === "REJECTED" ? (
              <Badge variant="outline" className="h-9 border-red-200 bg-red-50 px-3 text-red-700">
                <XCircle className="mr-1 h-3.5 w-3.5" />
                Rejected
              </Badge>
            ) : null}
            {canDownloadApprovedPdf ? (
              <PermissionGuard permission="REPORT_EXPORT">
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadPdf} disabled={loading || isPdfBusy}>
                  {isPdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {getPdfButtonLabel(status)}
                </Button>
              </PermissionGuard>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFullOpen(true);
                if (!previewHtml && !previewLoading) void loadPreview(true);
              }}
              disabled={!report || loading}
            >
              <Eye className="h-4 w-4" />
              Open PDF Preview
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={!onRefresh || loading || refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh Report
            </Button>
            <span title="Regeneration will be enabled when backend support is available.">
              <Button type="button" variant="outline" size="sm" disabled>
                <RotateCw className="h-4 w-4" />
                Regenerate Report
              </Button>
            </span>
          </div>
        </div>

        <div className="bg-slate-50/70 p-4">
          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
              Loading audit review report...
            </div>
          ) : !report ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
              <h4 className="text-sm font-semibold text-slate-900">No report generated yet</h4>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Generate a draft report after analysis to preview the compliance narrative, score summary, and review findings.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
                <MetadataItem label="Submitted by" value={report.submitted_by} />
                <MetadataItem label="Submitted date" value={formatDateTime(report.submitted_dt)} />
                <MetadataItem label="Reviewed by" value={report.reviewed_by} />
                <MetadataItem label="Reviewed date" value={formatDateTime(report.reviewed_dt)} />
                <MetadataItem label="Decision by" value={decisionBy} />
                <MetadataItem label="Decision date" value={formatDateTime(decisionAt)} />
                <MetadataItem label="E-signature" value={eSignatureStatus} />
                <MetadataItem label="Lock status" value={lockStatus} />
                <MetadataItem label="Report status" value={reportStatusText} />
                <MetadataItem label="Report version" value={report.report_version} />
                <MetadataItem label="Final PDF hash" value={report.final_pdf_hash} />
                <div className="md:col-span-2">
                  <MetadataItem label="Submission notes" value={submissionNotesText} />
                </div>
                <div className="md:col-span-2">
                  <MetadataItem label="Reviewer comments" value={report.reviewer_comments} />
                </div>
              </div>
              {showRelatedPanels ? (
                <>
                  <AuditReviewNotificationsPanel
                    report={report}
                    defaultActor={defaultNotificationActor}
                    onNotificationsChanged={onNotificationsChanged}
                  />
                  <AuditReviewAiSummaryPanel report={report} defaultActor={defaultNotificationActor} />
                </>
              ) : null}
              <div className="h-[34rem] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-3 shadow-sm">
                <ReportPdfPreviewFrame
                  reportId={report.report_id}
                  html={previewHtml}
                  loading={previewLoading}
                  error={previewError}
                  onRetry={() => void loadPreview(true)}
                />
              </div>
            </div>
          )}
        </div>
      </section>

      <Dialog open={fullOpen} onOpenChange={setFullOpen}>
        <DialogContent className="h-[94vh] w-[96vw] max-w-none gap-0 overflow-hidden p-0 sm:max-w-none xl:w-[1180px]">
          <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-left">
            <DialogTitle>Report PDF Preview</DialogTitle>
            <DialogDescription className="mt-1 block text-sm text-slate-600">
              {report ? `Report ${report.report_id}` : "No report selected."}
            </DialogDescription>
          </DialogHeader>
          <div className="h-[calc(94vh-88px)] overflow-hidden bg-slate-100 p-4">
            <ReportPdfPreviewFrame
              reportId={report?.report_id}
              html={previewHtml}
              loading={previewLoading}
              error={previewError}
              onRetry={() => void loadPreview(true)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={submitOpen && canSubmitReview} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Submit for QA Review</DialogTitle>
            <DialogDescription>Submit draft report for QA review.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmitReview}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="audit-review-submission-notes">
                Submission notes
              </label>
              <Textarea
                id="audit-review-submission-notes"
                value={submissionNotes}
                onChange={(event) => setSubmissionNotes(event.target.value)}
                placeholder="Please review the draft audit trail report."
                disabled={isSubmitBusy}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSubmitOpen(false)} disabled={isSubmitBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitBusy}>
                {isSubmitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={approveOpen && canApproveReport} onOpenChange={(open) => (open ? setApproveOpen(true) : closeApproveDialog())}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Approve Report</DialogTitle>
            <DialogDescription>Approve audit review report with an electronic signature.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleApprove}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="audit-review-approve-comments">
                Reviewer comments
              </label>
              <Textarea
                id="audit-review-approve-comments"
                value={approveComments}
                onChange={(event) => setApproveComments(event.target.value)}
                placeholder="Reviewed and approved. Minor findings accepted with follow-up action."
                disabled={isApproveBusy}
                required
              />
            </div>
            <AuditReviewESignatureFields
              email={approveEmail}
              password={approvePassword}
              confirmed={approveConfirmed}
              errors={approveErrors}
              disabled={isApproveBusy}
              onEmailChange={(value) => {
                setApproveEmail(value);
                clearApproveError("email");
              }}
              onPasswordChange={(value) => {
                setApprovePassword(value);
                clearApproveError("password");
              }}
              onConfirmedChange={(value) => {
                setApproveConfirmed(value);
                clearApproveError("confirmed");
              }}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeApproveDialog} disabled={isApproveBusy}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmitApproval}>
                {isApproveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Sign and Approve
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen && canRejectReport} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Reject Report</DialogTitle>
            <DialogDescription>Reject audit review report.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleReject}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="audit-review-reject-comments">
                Reviewer comments
              </label>
              <Textarea
                id="audit-review-reject-comments"
                value={rejectComments}
                onChange={(event) => setRejectComments(event.target.value)}
                placeholder="Rejected. Missing justification for off-hours activities."
                disabled={isRejectBusy}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)} disabled={isRejectBusy}>
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={isRejectBusy || !rejectComments.trim()}>
                {isRejectBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Reject
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={changesOpen && canRequestReportChanges} onOpenChange={setChangesOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>Return audit review report to the reviewer workflow.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleRequestChanges}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700" htmlFor="audit-review-request-changes-comments-inline">
                Reviewer comments
              </label>
              <Textarea
                id="audit-review-request-changes-comments-inline"
                value={changesComments}
                onChange={(event) => setChangesComments(event.target.value)}
                placeholder="Request changes before approval."
                disabled={isChangesBusy}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setChangesOpen(false)} disabled={isChangesBusy}>
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={isChangesBusy || !changesComments.trim()}>
                {isChangesBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Request Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
