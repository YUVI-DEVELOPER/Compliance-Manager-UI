import React from "react";
import { FileText, History } from "lucide-react";

import {
  AuditReviewJobListItem,
  AuditReviewReportListItem,
  AuditReviewScheduleRun,
} from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  formatAuditReviewDateTime,
  formatAuditReviewLabel,
  formatAuditReviewNumber,
  formatAuditReviewPeriod,
  getAuditReviewSelectedTypes,
  getAuditReviewJobStatusBadgeClass,
  getAuditReviewReportStatusBadgeClass,
  shortAuditReviewIdentifier,
} from "./auditReviewUi.shared";

interface AuditReviewHistoryPanelProps {
  jobs: AuditReviewJobListItem[];
  reports: AuditReviewReportListItem[];
  scheduleRuns: AuditReviewScheduleRun[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onOpenReport: (jobId: string) => void;
}

const getScheduleRunBadgeClass = (status?: string | null): string => {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "STARTED") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "SKIPPED") return "border-slate-200 bg-slate-50 text-slate-600";
  return "border-slate-200 bg-white text-slate-700";
};

const SectionHeader = ({ title, count }: { title: string; count: number }) => (
  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
    <div className="flex items-center gap-2">
      <History className="h-4 w-4 text-slate-500" />
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    </div>
    <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
      {formatAuditReviewNumber(count)}
    </Badge>
  </div>
);

export function AuditReviewHistoryPanel({
  jobs,
  reports,
  scheduleRuns,
  selectedJobId,
  onSelectJob,
  onOpenReport,
}: AuditReviewHistoryPanelProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit review job history">
        <SectionHeader title="Audit Review Job History" count={jobs.length} />
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Review Period</TableHead>
              <TableHead className="font-semibold">Scope</TableHead>
              <TableHead className="font-semibold">Audit Trails</TableHead>
              <TableHead className="font-semibold">Records</TableHead>
              <TableHead className="font-semibold">Created</TableHead>
              <TableHead className="font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                  No audit review jobs have been created for this asset.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job) => {
                const selected = job.job_id === selectedJobId;
                return (
                  <TableRow key={job.job_id} className={selected ? "bg-blue-50/60" : "hover:bg-slate-50"}>
                    <TableCell>
                      <Badge variant="outline" className={getAuditReviewJobStatusBadgeClass(job.status)}>
                        {formatAuditReviewLabel(job.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-700">{formatAuditReviewPeriod(job.review_start_dt, job.review_end_dt)}</TableCell>
                    <TableCell className="text-slate-700">{formatAuditReviewLabel(job.review_scope)}</TableCell>
                    <TableCell className="max-w-64 whitespace-normal text-slate-700">
                      {getAuditReviewSelectedTypes(job).map(formatAuditReviewLabel).join(", ")}
                    </TableCell>
                    <TableCell className="text-slate-700">{formatAuditReviewNumber(job.record_count)}</TableCell>
                    <TableCell className="text-slate-600">{formatAuditReviewDateTime(job.created_dt)}</TableCell>
                    <TableCell>
                      <Button type="button" size="sm" variant={selected ? "default" : "outline"} onClick={() => onSelectJob(job.job_id)}>
                        {selected ? "Selected" : "Open Job"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit review report versions">
        <SectionHeader title="Report Versions" count={reports.length} />
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Report ID</TableHead>
              <TableHead className="font-semibold">Score</TableHead>
              <TableHead className="font-semibold">Rating</TableHead>
              <TableHead className="font-semibold">Generated</TableHead>
              <TableHead className="font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                  No report versions have been generated yet.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow key={report.report_id} className="hover:bg-slate-50">
                  <TableCell>
                    <Badge variant="outline" className={getAuditReviewReportStatusBadgeClass(report.status)}>
                      {formatAuditReviewLabel(report.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600" title={report.report_id}>
                    {shortAuditReviewIdentifier(report.report_id)}
                  </TableCell>
                  <TableCell className="text-slate-700">{report.overall_score ?? "-"}</TableCell>
                  <TableCell className="text-slate-700">{formatAuditReviewLabel(report.rating)}</TableCell>
                  <TableCell className="text-slate-600">{formatAuditReviewDateTime(report.created_dt)}</TableCell>
                  <TableCell>
                    <Button type="button" size="sm" variant="outline" onClick={() => onOpenReport(report.job_id)}>
                      <FileText className="h-4 w-4" />
                      Open Report
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Scheduler run history">
        <SectionHeader title="Scheduler Run History" count={scheduleRuns.length} />
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="bg-white">
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Started</TableHead>
              <TableHead className="font-semibold">Completed</TableHead>
              <TableHead className="font-semibold">Job</TableHead>
              <TableHead className="font-semibold">Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scheduleRuns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                  No scheduler runs have been recorded.
                </TableCell>
              </TableRow>
            ) : (
              scheduleRuns.map((run) => (
                <TableRow key={run.run_id} className={run.status === "FAILED" ? "bg-red-50/50" : "hover:bg-slate-50"}>
                  <TableCell>
                    <Badge variant="outline" className={getScheduleRunBadgeClass(run.status)}>
                      {formatAuditReviewLabel(run.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">{formatAuditReviewDateTime(run.started_at)}</TableCell>
                  <TableCell className="text-slate-600">{formatAuditReviewDateTime(run.completed_at)}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {run.job_id ? (
                      <button type="button" className="text-blue-700 hover:underline" onClick={() => onSelectJob(run.job_id!)}>
                        {shortAuditReviewIdentifier(run.job_id)}
                      </button>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="max-w-xl whitespace-normal text-sm text-slate-700">
                    {run.error_message || run.message || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
