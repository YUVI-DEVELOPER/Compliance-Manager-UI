import React from "react";
import { AlertCircle, FileCheck2, FileText, Gauge, Layers3, ShieldCheck } from "lucide-react";

import {
  AuditReviewJobDetail,
  AuditReviewReportDetail,
} from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import {
  formatAuditReviewLabel,
  formatAuditReviewNumber,
  getAuditReviewScoreLabel,
  getAuditReviewReportStatusBadgeClass,
} from "./auditReviewUi.shared";
import {
  formatAuditReviewRating,
  getAuditReviewRatingBadgeClass,
} from "./AuditReviewScoreCard";

interface AuditReviewKpiRowProps {
  job: AuditReviewJobDetail | null;
  report: AuditReviewReportDetail | null;
  severityCounts: {
    high: number;
    medium: number;
    low: number;
  };
  totalFindings: number;
}

const KpiCard = ({
  label,
  value,
  helper,
  icon,
  badgeClass,
}: {
  label: string;
  value: React.ReactNode;
  helper?: React.ReactNode;
  icon: React.ReactNode;
  badgeClass?: string;
}) => (
  <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {badgeClass ? (
          <Badge variant="outline" className={`mt-2 max-w-full ${badgeClass}`}>
            <span className="truncate">{value}</span>
          </Badge>
        ) : (
          <p className="mt-2 truncate text-xl font-semibold leading-7 text-slate-950" title={typeof value === "string" ? value : undefined}>
            {value}
          </p>
        )}
        {helper ? <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div> : null}
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
        {icon}
      </div>
    </div>
  </div>
);

export function AuditReviewKpiRow({
  job,
  report,
  severityCounts,
  totalFindings,
}: AuditReviewKpiRowProps) {
  const reportStatus = report?.status || job?.latest_report_status || "Not generated";

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Audit review key metrics">
      <KpiCard
        label={getAuditReviewScoreLabel(job)}
        value={job?.overall_score !== undefined && job?.overall_score !== null ? `${job.overall_score}` : "-"}
        helper="Scoped audit review score"
        icon={<Gauge className="h-4 w-4" />}
      />
      <KpiCard
        label="Rating"
        value={formatAuditReviewRating(job?.rating)}
        helper="Review risk category"
        icon={<ShieldCheck className="h-4 w-4" />}
        badgeClass={getAuditReviewRatingBadgeClass(job?.rating)}
      />
      <KpiCard
        label="Total Findings"
        value={formatAuditReviewNumber(totalFindings)}
        helper="Deterministic check output"
        icon={<AlertCircle className="h-4 w-4" />}
      />
      <KpiCard
        label="Severity Mix"
        value={`${severityCounts.high}/${severityCounts.medium}/${severityCounts.low}`}
        helper={
          <span className="inline-flex flex-wrap gap-1">
            <span className="text-red-700">High {severityCounts.high}</span>
            <span>Medium {severityCounts.medium}</span>
            <span>Low {severityCounts.low}</span>
          </span>
        }
        icon={<Layers3 className="h-4 w-4" />}
      />
      <KpiCard
        label="Records Reviewed"
        value={formatAuditReviewNumber(job?.record_count)}
        helper="Normalized records, no raw payload"
        icon={<FileCheck2 className="h-4 w-4" />}
      />
      <KpiCard
        label="Report Lifecycle"
        value={formatAuditReviewLabel(reportStatus)}
        helper="Draft, QA review, or approved"
        icon={<FileText className="h-4 w-4" />}
        badgeClass={getAuditReviewReportStatusBadgeClass(report?.status || job?.latest_report_status)}
      />
    </section>
  );
}
