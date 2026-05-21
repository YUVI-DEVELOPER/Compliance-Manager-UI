import React, { useMemo } from "react";
import { AlertCircle, CalendarDays, FileText, Gauge, ShieldCheck } from "lucide-react";

import {
  AuditReviewFinding,
  AuditReviewJobDetail,
  AuditReviewReportDetail,
  AuditReviewScore,
  AuditTrailRecord,
} from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import {
  formatAuditReviewDateTime,
  formatAuditReviewLabel,
  formatAuditReviewNumber,
  formatAuditReviewPeriod,
  getAuditReviewReportStatusBadgeClass,
} from "./auditReviewUi.shared";
import {
  formatAuditReviewRating,
  getAuditReviewRatingBadgeClass,
} from "./AuditReviewScoreCard";
import { getAuditReviewSeverityBadgeClass } from "./AuditReviewFindingsTable";
import { NextRecommendedActionCard } from "./NextRecommendedActionCard";
import {
  AuditReviewUiAction,
  AuditReviewUiActionKey,
} from "./auditReviewUi.shared";
import { AuditReviewChecklistMatrix } from "./AuditReviewChecklistMatrix";
import { AuditReviewCoverageTable } from "./AuditReviewCoverageTable";
import { AuditReviewRecordsTable } from "./AuditReviewRecordsTable";

interface AuditReviewOverviewPanelProps {
  job: AuditReviewJobDetail | null;
  report: AuditReviewReportDetail | null;
  findings: AuditReviewFinding[];
  scores: AuditReviewScore[];
  records: AuditTrailRecord[];
  severityCounts: {
    high: number;
    medium: number;
    low: number;
  };
  totalFindings: number;
  nextAction: AuditReviewUiAction;
  onAction: (action: AuditReviewUiActionKey) => void;
}

const getScoreColor = (score: number): string => {
  if (score >= 90) return "#059669";
  if (score >= 75) return "#d97706";
  if (score >= 60) return "#ea580c";
  return "#dc2626";
};

const getFindingTitle = (finding: AuditReviewFinding): string =>
  finding.finding_title || finding.title || finding.check_name || "Audit review finding";

const InfoTile = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
  </div>
);

export function AuditReviewOverviewPanel({
  job,
  report,
  findings,
  scores,
  records,
  severityCounts,
  totalFindings,
  nextAction,
  onAction,
}: AuditReviewOverviewPanelProps) {
  const score = job?.overall_score ?? null;
  const normalizedScore = Math.max(0, Math.min(100, score ?? 0));
  const scoreColor = getScoreColor(normalizedScore);
  const topFindings = useMemo(
    () =>
      [...findings]
        .sort((left, right) => {
          const impact = right.score_impact - left.score_impact;
          if (impact !== 0) return impact;
          return right.source_record_count - left.source_record_count;
        })
        .slice(0, 4),
    [findings],
  );
  const visibleScores = useMemo(
    () => [...scores].sort((left, right) => left.sort_order - right.sort_order).slice(0, 4),
    [scores],
  );

  return (
    <div className="space-y-4">
      <NextRecommendedActionCard action={nextAction} onAction={onAction} />

      {!job ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-sm">
          <h3 className="text-base font-semibold text-slate-950">No audit review has been run for this asset yet.</h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Start a review to extract Veeva audit trail records, analyze deterministic findings, and generate a draft QA report.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(20rem,24rem)_1fr]">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Score summary">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Score Summary</h3>
                <p className="mt-1 text-xs text-slate-500">Overall posture for the selected review job.</p>
              </div>
              <Badge variant="outline" className={getAuditReviewRatingBadgeClass(job.rating)}>
                <ShieldCheck className="h-3.5 w-3.5" />
                {formatAuditReviewRating(job.rating)}
              </Badge>
            </div>

            <div className="mt-5 flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-5 text-center">
              <div
                className="grid h-32 w-32 place-items-center rounded-full"
                style={{
                  background: `conic-gradient(${scoreColor} ${normalizedScore * 3.6}deg, #e2e8f0 0deg)`,
                }}
                role="img"
                aria-label={`Overall audit review score ${score ?? "not scored"}`}
              >
                <div className="grid h-24 w-24 place-items-center rounded-full bg-white shadow-inner">
                  <div>
                    <p className="text-3xl font-semibold text-slate-950">{score ?? "-"}</p>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Score</p>
                  </div>
                </div>
              </div>
              <div className="grid w-full grid-cols-3 gap-2 text-left">
                <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">High</p>
                  <p className="mt-1 text-lg font-semibold text-red-900">{severityCounts.high}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">Medium</p>
                  <p className="mt-1 text-lg font-semibold text-amber-900">{severityCounts.medium}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Low</p>
                  <p className="mt-1 text-lg font-semibold text-blue-900">{severityCounts.low}</p>
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Selected review job summary">
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">Selected Review Job</h3>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoTile label="Review Period" value={formatAuditReviewPeriod(job.review_start_dt, job.review_end_dt)} />
                <InfoTile label="Review Scope" value={formatAuditReviewLabel(job.review_scope)} />
                <InfoTile label="Audit Trails" value={(job.selected_audit_trail_types || [job.audit_trail_type]).map(formatAuditReviewLabel).join(", ")} />
                <InfoTile label="Records Reviewed" value={formatAuditReviewNumber(job.record_count)} />
                <InfoTile label="Created" value={formatAuditReviewDateTime(job.created_dt)} />
              </div>
              {job.error_message ? (
                <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{job.error_message}</span>
                </div>
              ) : null}
            </section>

            <AuditReviewCoverageTable job={job} />
            <AuditReviewChecklistMatrix job={job} scores={scores} />
            <AuditReviewRecordsTable job={job} records={records.slice(0, 12)} />

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Top findings snapshot">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Key Findings Snapshot</h3>
                  <p className="mt-1 text-xs text-slate-500">Highest score-impact findings, without raw audit payload.</p>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                  {formatAuditReviewNumber(totalFindings)} total
                </Badge>
              </div>
              <div className="mt-4 space-y-2">
                {topFindings.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                    Findings will appear after analysis.
                  </div>
                ) : (
                  topFindings.map((finding) => (
                    <div key={finding.finding_id} className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={getAuditReviewSeverityBadgeClass(finding.severity)}>
                          {finding.severity || "INFO"}
                        </Badge>
                        <span className="font-mono text-xs font-semibold text-slate-600">{finding.check_code}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                          -{finding.score_impact} score
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-900">{getFindingTitle(finding)}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                        {finding.finding_summary || finding.description || "No finding summary was provided."}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Report summary">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">Report Summary</h3>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <InfoTile
                  label="Report Status"
                  value={
                    <Badge variant="outline" className={getAuditReviewReportStatusBadgeClass(report?.status || job.latest_report_status)}>
                      {formatAuditReviewLabel(report?.status || job.latest_report_status || "Not generated")}
                    </Badge>
                  }
                />
                <InfoTile label="Generated" value={formatAuditReviewDateTime(report?.created_dt)} />
                <InfoTile label="Submitted By" value={report?.submitted_by || "-"} />
                <InfoTile label="Reviewed By" value={report?.reviewed_by || "-"} />
                <InfoTile
                  label="E-Signature"
                  value={report?.is_e_signed ? `Signed ${formatAuditReviewDateTime(report.e_signed_at)}` : "Not signed"}
                />
                <InfoTile
                  label="Lock Status"
                  value={report?.is_locked ? `Locked ${formatAuditReviewDateTime(report.locked_at)}` : "Unlocked"}
                />
              </div>
              {visibleScores.length ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Check-level score highlights</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {visibleScores.map((scoreRow) => (
                      <div key={scoreRow.score_id} className="rounded-md bg-white px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate font-medium text-slate-900">{scoreRow.check_name}</span>
                          <span className="text-xs text-slate-500">-{scoreRow.applied_penalty}</span>
                        </div>
                        <p className="mt-1 truncate font-mono text-xs text-slate-500">{scoreRow.check_code}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
