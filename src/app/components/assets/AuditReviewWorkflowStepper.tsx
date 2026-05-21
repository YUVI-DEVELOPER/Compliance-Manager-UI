import React from "react";
import {
  CheckCircle2,
  Circle,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  Loader2,
  Send,
  TriangleAlert,
} from "lucide-react";

import {
  AuditReviewJobDetail,
  AuditReviewJobStatus,
  AuditReviewReportDetail,
} from "../../../services/audit-review.service";
import { Button } from "../ui/button";
import { useAuth } from "../../auth/useAuth";
import {
  AuditReviewUiActionKey,
  canUseAuditReviewAction,
  formatAuditReviewDateTime,
} from "./auditReviewUi.shared";

type StepVisualState = "completed" | "current" | "pending" | "failed";

interface WorkflowStep {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AuditReviewWorkflowStepperProps {
  job: AuditReviewJobDetail | null;
  report?: AuditReviewReportDetail | null;
  action?: "extract" | "analyze" | "generate-report" | null;
  reportAction?: "submit-review" | "approve" | "reject" | "request-changes" | null;
  onAction?: (action: AuditReviewUiActionKey) => void;
}

const steps: WorkflowStep[] = [
  {
    key: "created",
    label: "Job Created",
    description: "Review scope captured",
    icon: Clock3,
  },
  {
    key: "records",
    label: "Records Extracted",
    description: "Veeva audit activity loaded",
    icon: Database,
  },
  {
    key: "analysis",
    label: "Analysis Completed",
    description: "Checks and scores calculated",
    icon: FileCheck2,
  },
  {
    key: "report",
    label: "Draft Report Generated",
    description: "Draft review report available",
    icon: FileText,
  },
  {
    key: "approval",
    label: "Approval & Closure",
    description: "QA decision captured",
    icon: Send,
  },
];

const getCurrentIndex = (status?: AuditReviewJobStatus | null): number => {
  if (!status) return 0;
  if (status === "CREATED" || status === "EXTRACTING") return 1;
  if (status === "EXTRACTED" || status === "PARTIAL_EXTRACTION" || status === "ANALYZING") return 2;
  if (status === "ANALYZED" || status === "REPORT_GENERATING") return 3;
  if (status === "REPORT_DRAFTED") return 4;
  return 1;
};

const getFailedIndex = (job: AuditReviewJobDetail): number => {
  if (job.latest_report_id || job.latest_report_status) return 4;
  if (job.overall_score !== undefined && job.overall_score !== null) return 3;
  if (job.record_count > 0) return 2;
  return 1;
};

const hasRecords = (job: AuditReviewJobDetail): boolean =>
  job.record_count > 0 || ["EXTRACTED", "PARTIAL_EXTRACTION", "ANALYZING", "ANALYZED", "REPORT_GENERATING", "REPORT_DRAFTED"].includes(job.status);

const hasAnalysis = (job: AuditReviewJobDetail): boolean =>
  job.overall_score !== undefined && job.overall_score !== null || job.finding_count > 0 || ["ANALYZED", "REPORT_GENERATING", "REPORT_DRAFTED"].includes(job.status);

const hasReport = (job: AuditReviewJobDetail, report?: AuditReviewReportDetail | null): boolean =>
  Boolean(report || job.latest_report_id || job.latest_report_status || job.status === "REPORT_DRAFTED");

const getStepState = (
  job: AuditReviewJobDetail | null,
  report: AuditReviewReportDetail | null | undefined,
  index: number,
): StepVisualState => {
  if (!job) return index === 0 ? "current" : "pending";
  if (job.status === "FAILED") {
    const failedIndex = getFailedIndex(job);
    if (index < failedIndex) return "completed";
    if (index === failedIndex) return "failed";
    return "pending";
  }
  if (job.status === "CANCELLED") return index === 0 ? "failed" : "pending";

  if (index === 0) return "completed";
  if (index === 1 && hasRecords(job)) return "completed";
  if (index === 2 && hasAnalysis(job)) return "completed";
  if (index === 3 && hasReport(job, report)) return "completed";
  if (index === 4) {
    if (report?.status === "APPROVED") return "completed";
    if (report?.status === "REJECTED") return "failed";
    if (hasReport(job, report)) return "current";
    return "pending";
  }

  const currentIndex = getCurrentIndex(job.status);
  if (index === currentIndex && currentIndex < steps.length) return "current";
  return "pending";
};

const stateClasses: Record<StepVisualState, { node: string; line: string; label: string; icon: string; status: string }> = {
  completed: {
    node: "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm",
    line: "bg-emerald-200",
    label: "text-slate-900",
    icon: "text-emerald-600",
    status: "Completed",
  },
  current: {
    node: "border-blue-200 bg-blue-50 text-blue-700 shadow-sm ring-4 ring-blue-50",
    line: "bg-slate-200",
    label: "text-slate-900",
    icon: "text-blue-600",
    status: "Current",
  },
  pending: {
    node: "border-slate-200 bg-white text-slate-400",
    line: "bg-slate-200",
    label: "text-slate-500",
    icon: "text-slate-400",
    status: "Pending",
  },
  failed: {
    node: "border-red-200 bg-red-50 text-red-700 shadow-sm ring-4 ring-red-50",
    line: "bg-red-200",
    label: "text-red-900",
    icon: "text-red-600",
    status: "Failed",
  },
};

const getStepTimestamp = (
  stepKey: string,
  job: AuditReviewJobDetail | null,
  report?: AuditReviewReportDetail | null,
): string | null => {
  if (!job) return null;
  if (stepKey === "created") return job.created_dt;
  if (stepKey === "records" && hasRecords(job)) return job.modified_dt || job.completed_at || job.created_dt;
  if (stepKey === "analysis" && hasAnalysis(job)) return job.modified_dt || job.completed_at || null;
  if (stepKey === "report" && hasReport(job, report)) return report?.created_dt || job.modified_dt || null;
  if (stepKey === "approval") return report?.reviewed_dt || report?.submitted_dt || null;
  return null;
};

const getStepAction = (
  stepKey: string,
  job: AuditReviewJobDetail | null,
  report?: AuditReviewReportDetail | null,
): { key: AuditReviewUiActionKey; label: string } | null => {
  if (!job && stepKey === "created") return { key: "run", label: "Run Audit Review" };
  if (!job) return null;
  if (stepKey === "records" && (job.status === "CREATED" || job.status === "FAILED")) {
    return { key: "extract", label: "Extract Records" };
  }
  if (stepKey === "analysis" && (job.status === "EXTRACTED" || job.status === "PARTIAL_EXTRACTION")) {
    return { key: "analyze", label: "Analyze Job" };
  }
  if (stepKey === "report" && job.status === "ANALYZED") {
    return { key: "generate-report", label: "Generate Draft" };
  }
  if (stepKey === "approval" && report?.status === "DRAFT") {
    return { key: "submit-review", label: "Submit Review" };
  }
  if (stepKey === "approval" && report?.status === "UNDER_REVIEW") {
    return { key: "review-decision", label: "Approve / Reject" };
  }
  return null;
};

const isStepActionLoading = (
  actionKey: AuditReviewUiActionKey,
  action?: "extract" | "analyze" | "generate-report" | null,
  reportAction?: "submit-review" | "approve" | "reject" | "request-changes" | null,
): boolean => {
  if (actionKey === "extract") return action === "extract";
  if (actionKey === "analyze") return action === "analyze";
  if (actionKey === "generate-report") return action === "generate-report";
  if (actionKey === "submit-review") return reportAction === "submit-review";
  if (actionKey === "review-decision") return Boolean(reportAction && reportAction !== "submit-review");
  return false;
};

export function AuditReviewWorkflowStepper({
  job,
  report,
  action,
  reportAction,
  onAction,
}: AuditReviewWorkflowStepperProps) {
  const { hasAnyPermission } = useAuth();
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm" aria-label="Audit review workflow">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Review Workflow</h3>
          <p className="mt-1 text-xs text-slate-500">Traceable progression from job creation through QA closure.</p>
        </div>
        {job?.status === "FAILED" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
            <TriangleAlert className="h-3.5 w-3.5" />
            Attention needed
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
        {steps.map((step, index) => {
          const state = getStepState(job, report, index);
          const classes = stateClasses[state];
          const StepIcon = state === "completed" ? CheckCircle2 : state === "failed" ? TriangleAlert : step.icon;
          const timestamp = getStepTimestamp(step.key, job, report);
          const candidateAction = state === "current" ? getStepAction(step.key, job, report) : null;
          const stepAction = candidateAction && canUseAuditReviewAction(candidateAction.key, hasAnyPermission) ? candidateAction : null;
          const stepActionLoading = stepAction ? isStepActionLoading(stepAction.key, action, reportAction) : false;

          return (
            <div key={step.key} className="relative">
              {index < steps.length - 1 ? (
                <div className={`absolute left-10 right-[-0.75rem] top-5 hidden h-0.5 lg:block ${classes.line}`} aria-hidden="true" />
              ) : null}
              <div className="relative flex gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 lg:block lg:bg-transparent lg:p-0 lg:border-0">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${classes.node}`}>
                  <StepIcon className={`h-5 w-5 ${classes.icon}`} />
                </div>
                <div className="min-w-0 lg:mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold ${classes.label}`}>{step.label}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                      {classes.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.description}</p>
                  {timestamp ? (
                    <p className="mt-1 text-[11px] leading-4 text-slate-400">{formatAuditReviewDateTime(timestamp)}</p>
                  ) : null}
                  {stepAction && onAction ? (
                    <Button
                      type="button"
                      size="sm"
                      className="mt-3 h-7 px-2 text-xs"
                      onClick={() => onAction(stepAction.key)}
                      disabled={stepActionLoading}
                    >
                      {stepActionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      {stepAction.label}
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!job ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Circle className="mt-0.5 h-3.5 w-3.5 text-slate-400" />
          No workflow has started for this asset.
        </div>
      ) : null}
    </section>
  );
}
