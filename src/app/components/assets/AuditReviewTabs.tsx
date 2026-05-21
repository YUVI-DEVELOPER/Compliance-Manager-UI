import React from "react";
import { Brain, BellRing, CheckCircle2, FileText, History, ListChecks, Rows3 } from "lucide-react";

import {
  AuditReviewFinding,
  AuditReviewJobDetail,
  AuditReviewJobListItem,
  AuditReviewReportDetail,
  AuditReviewReportListItem,
  AuditReviewReportReviewDecisionPayload,
  AuditReviewReportSubmitReviewPayload,
  AuditReviewScheduleRun,
  AuditReviewScore,
  AuditTrailRecord,
} from "../../../services/audit-review.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { AuditReviewAiSummaryPanel } from "./AuditReviewAiSummaryPanel";
import { AuditReviewApprovalPanel } from "./AuditReviewApprovalPanel";
import { AuditReviewFindingsTable } from "./AuditReviewFindingsTable";
import { AuditReviewHistoryPanel } from "./AuditReviewHistoryPanel";
import { AuditReviewNotificationsPanel } from "./AuditReviewNotificationsPanel";
import { AuditReviewOverviewPanel } from "./AuditReviewOverviewPanel";
import { AuditReviewRecordsTable } from "./AuditReviewRecordsTable";
import { AuditReviewReportView } from "./AuditReviewReportView";
import {
  AuditReviewUiAction,
  AuditReviewUiActionKey,
} from "./auditReviewUi.shared";
import { useAuth } from "../../auth/useAuth";

export type AuditReviewWorkspaceTab =
  | "overview"
  | "records"
  | "findings"
  | "report"
  | "approval"
  | "notifications"
  | "ai-summary"
  | "history";

interface AuditReviewTabsProps {
  activeTab: AuditReviewWorkspaceTab;
  onTabChange: (tab: AuditReviewWorkspaceTab) => void;
  job: AuditReviewJobDetail | null;
  jobs: AuditReviewJobListItem[];
  selectedJobId: string | null;
  report: AuditReviewReportDetail | null;
  reports: AuditReviewReportListItem[];
  findings: AuditReviewFinding[];
  scores: AuditReviewScore[];
  records: AuditTrailRecord[];
  scheduleRuns: AuditReviewScheduleRun[];
  severityCounts: {
    high: number;
    medium: number;
    low: number;
  };
  totalFindings: number;
  refreshing: boolean;
  reportAction: "submit-review" | "approve" | "reject" | "request-changes" | null;
  approvalRequest?: {
    action: "submit" | "decision" | null;
    token: number;
  };
  nextAction: AuditReviewUiAction;
  defaultActor?: string | null;
  onAction: (action: AuditReviewUiActionKey) => void;
  onSelectJob: (jobId: string) => void;
  onOpenReport: (jobId: string) => void;
  onRefresh: () => void;
  onSubmitReview: (payload: AuditReviewReportSubmitReviewPayload) => Promise<void>;
  onApprove: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
  onReject: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
  onRequestChanges: (payload: AuditReviewReportReviewDecisionPayload) => Promise<void>;
}

const EmptyPanel = ({ title, description }: { title: string; description: string }) => (
  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
  </div>
);

export function AuditReviewTabs({
  activeTab,
  onTabChange,
  job,
  jobs,
  selectedJobId,
  report,
  reports,
  findings,
  scores,
  records,
  scheduleRuns,
  severityCounts,
  totalFindings,
  refreshing,
  reportAction,
  approvalRequest,
  nextAction,
  defaultActor,
  onAction,
  onSelectJob,
  onOpenReport,
  onRefresh,
  onSubmitReview,
  onApprove,
  onReject,
  onRequestChanges,
}: AuditReviewTabsProps) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const canViewOverview = hasPermission("AUDIT_REVIEW_VIEW");
  const canViewFindings = hasPermission("AUDIT_FINDING_VIEW");
  const canViewRecords = hasPermission("AUDIT_RECORD_VIEW");
  const canViewReport = hasPermission("AUDIT_REPORT_VIEW");
  const canUseApproval = hasAnyPermission([
    "AUDIT_REPORT_SUBMIT",
    "AUDIT_REPORT_APPROVE",
    "AUDIT_REPORT_REJECT",
    "AUDIT_REPORT_REQUEST_CHANGES",
  ]);
  const canViewNotifications = hasAnyPermission(["NOTIFICATION_VIEW", "NOTIFICATION_MANAGE"]);
  const canViewAiSummary = hasAnyPermission(["AUDIT_REPORT_VIEW", "AUDIT_REPORT_GENERATE"]);
  const canViewHistory = hasPermission("AUDIT_REVIEW_VIEW");
  const visibleTabs: AuditReviewWorkspaceTab[] = [
    ...(canViewOverview ? (["overview"] as const) : []),
    ...(canViewFindings ? (["findings"] as const) : []),
    ...(canViewRecords ? (["records"] as const) : []),
    ...(canViewReport ? (["report"] as const) : []),
    ...(canUseApproval ? (["approval"] as const) : []),
    ...(canViewNotifications ? (["notifications"] as const) : []),
    ...(canViewAiSummary ? (["ai-summary"] as const) : []),
    ...(canViewHistory ? (["history"] as const) : []),
  ];
  const safeActiveTab = visibleTabs.includes(activeTab) ? activeTab : visibleTabs[0] ?? "overview";

  React.useEffect(() => {
    if (visibleTabs.length > 0 && activeTab !== safeActiveTab) {
      onTabChange(safeActiveTab);
    }
  }, [activeTab, onTabChange, safeActiveTab, visibleTabs.length]);

  if (visibleTabs.length === 0) return null;

  return (
    <section id="audit-review-workspace" className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Audit review workspace">
      <Tabs value={safeActiveTab} onValueChange={(value) => onTabChange(value as AuditReviewWorkspaceTab)} className="gap-4">
        <div className="overflow-x-auto">
          <TabsList className="h-auto w-max rounded-lg bg-slate-100 p-1">
            {canViewOverview ? <TabsTrigger value="overview" className="rounded-md px-3 py-2 text-xs">
              <Rows3 className="h-4 w-4" />
              Overview
            </TabsTrigger> : null}
            {canViewFindings ? <TabsTrigger value="findings" className="rounded-md px-3 py-2 text-xs">
              <ListChecks className="h-4 w-4" />
              Findings
            </TabsTrigger> : null}
            {canViewRecords ? <TabsTrigger value="records" className="rounded-md px-3 py-2 text-xs">
              <Rows3 className="h-4 w-4" />
              Records
            </TabsTrigger> : null}
            {canViewReport ? <TabsTrigger value="report" className="rounded-md px-3 py-2 text-xs">
              <FileText className="h-4 w-4" />
              Report
            </TabsTrigger> : null}
            {canUseApproval ? <TabsTrigger value="approval" className="rounded-md px-3 py-2 text-xs">
              <CheckCircle2 className="h-4 w-4" />
              Approval
            </TabsTrigger> : null}
            {canViewNotifications ? <TabsTrigger value="notifications" className="rounded-md px-3 py-2 text-xs">
              <BellRing className="h-4 w-4" />
              Notifications
            </TabsTrigger> : null}
            {canViewAiSummary ? <TabsTrigger value="ai-summary" className="rounded-md px-3 py-2 text-xs">
              <Brain className="h-4 w-4" />
              AI Summary
            </TabsTrigger> : null}
            {canViewHistory ? <TabsTrigger value="history" className="rounded-md px-3 py-2 text-xs">
              <History className="h-4 w-4" />
              History
            </TabsTrigger> : null}
          </TabsList>
        </div>

        {canViewOverview ? <TabsContent value="overview" className="mt-0">
          <AuditReviewOverviewPanel
            job={job}
            report={report}
            findings={findings}
            scores={scores}
            records={records}
            severityCounts={severityCounts}
            totalFindings={totalFindings}
            nextAction={nextAction}
            onAction={onAction}
          />
        </TabsContent> : null}

        {canViewRecords ? <TabsContent value="records" className="mt-0">
          {job ? (
            <AuditReviewRecordsTable job={job} records={records} />
          ) : (
            <EmptyPanel
              title="Records are not available yet"
              description="Create and extract an audit review job before browsing records."
            />
          )}
        </TabsContent> : null}

        {canViewFindings ? <TabsContent value="findings" className="mt-0">
          {job ? (
            <AuditReviewFindingsTable findings={findings} loading={refreshing && findings.length === 0} />
          ) : (
            <EmptyPanel
              title="Findings are not available yet"
              description="Create and analyze an audit review job before reviewing findings."
            />
          )}
        </TabsContent> : null}

        {canViewReport ? <TabsContent value="report" className="mt-0">
          <AuditReviewReportView
            report={report}
            loading={refreshing && Boolean(job?.latest_report_id) && !report}
            refreshing={refreshing}
            actionLoading={reportAction}
            onRefresh={onRefresh}
            onSubmitReview={onSubmitReview}
            onApprove={onApprove}
            onReject={onReject}
            onRequestChanges={onRequestChanges}
            defaultNotificationActor={defaultActor}
            showRelatedPanels={false}
          />
        </TabsContent> : null}

        {canUseApproval ? <TabsContent value="approval" className="mt-0">
          <AuditReviewApprovalPanel
            report={report}
            actionLoading={reportAction}
            defaultActor={defaultActor}
            requestedAction={approvalRequest?.action}
            requestToken={approvalRequest?.token}
            onSubmitReview={onSubmitReview}
            onApprove={onApprove}
            onReject={onReject}
            onRequestChanges={onRequestChanges}
          />
        </TabsContent> : null}

        {canViewNotifications ? <TabsContent value="notifications" className="mt-0">
          {report ? (
            <AuditReviewNotificationsPanel
              report={report}
              defaultActor={defaultActor}
              onNotificationsChanged={onRefresh}
            />
          ) : (
            <EmptyPanel
              title="Notifications are not prepared"
              description="Generate a report before preparing stakeholder notifications."
            />
          )}
        </TabsContent> : null}

        {canViewAiSummary ? <TabsContent value="ai-summary" className="mt-0">
          {report ? (
            <AuditReviewAiSummaryPanel report={report} defaultActor={defaultActor} />
          ) : (
            <EmptyPanel
              title="AI summary is not available"
              description="Generate a report before requesting an AI-assisted narrative summary."
            />
          )}
        </TabsContent> : null}

        {canViewHistory ? <TabsContent value="history" className="mt-0">
          <AuditReviewHistoryPanel
            jobs={jobs}
            reports={reports}
            scheduleRuns={scheduleRuns}
            selectedJobId={selectedJobId}
            onSelectJob={onSelectJob}
            onOpenReport={onOpenReport}
          />
        </TabsContent> : null}
      </Tabs>
    </section>
  );
}
