import React, { useMemo } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, Gauge, ShieldAlert, ShieldCheck } from "lucide-react";

import {
  AuditReviewJobDetail,
  AuditReviewRating,
  AuditReviewScore,
} from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { getAuditReviewScoreLabel } from "./auditReviewUi.shared";

interface AuditReviewScoreCardProps {
  job: AuditReviewJobDetail | null;
  scores: AuditReviewScore[];
  severityCounts: {
    high: number;
    medium: number;
    low: number;
  };
  totalFindings: number;
  loading?: boolean;
}

export const formatAuditReviewRating = (rating?: AuditReviewRating | null): string => {
  if (!rating) return "-";
  return rating
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

export const getAuditReviewRatingBadgeClass = (rating?: AuditReviewRating | null): string => {
  if (rating === "COMPLIANT") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (rating === "MINOR_FINDINGS") return "border-amber-200 bg-amber-50 text-amber-700";
  if (rating === "MAJOR_FINDINGS") return "border-orange-200 bg-orange-50 text-orange-700";
  if (rating === "CRITICAL_RISK") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const getScoreColor = (score: number): string => {
  if (score >= 90) return "#059669";
  if (score >= 75) return "#d97706";
  if (score >= 60) return "#ea580c";
  return "#dc2626";
};

const getScoreLabel = (score?: number | null): string => {
  if (score === undefined || score === null) return "Not scored";
  if (score >= 90) return "Strong control posture";
  if (score >= 75) return "Minor review attention";
  if (score >= 60) return "Elevated review attention";
  return "Critical review attention";
};

const getRatingIcon = (rating?: AuditReviewRating | null) => {
  if (rating === "COMPLIANT") return CheckCircle2;
  if (rating === "CRITICAL_RISK") return ShieldAlert;
  if (rating === "MAJOR_FINDINGS") return AlertTriangle;
  return ShieldCheck;
};

export function AuditReviewScoreCard({
  job,
  scores,
  severityCounts,
  totalFindings,
  loading = false,
}: AuditReviewScoreCardProps) {
  const score = job?.overall_score ?? null;
  const normalizedScore = Math.max(0, Math.min(100, score ?? 0));
  const scoreColor = getScoreColor(normalizedScore);
  const RatingIcon = getRatingIcon(job?.rating);
  const visibleScores = useMemo(
    () => [...scores].sort((left, right) => left.sort_order - right.sort_order),
    [scores],
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit review score summary">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{getAuditReviewScoreLabel(job)}</h3>
            <p className="mt-1 text-xs text-slate-500">Overall score, rating, severity mix, and check-level penalty view.</p>
          </div>
          <Badge variant="outline" className={getAuditReviewRatingBadgeClass(job?.rating)}>
            <RatingIcon className="h-3.5 w-3.5" />
            {formatAuditReviewRating(job?.rating)}
          </Badge>
        </div>
      </div>

      <div className="space-y-5 p-4">
        <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-5 text-center">
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
                <p className="text-3xl font-semibold text-slate-950">{loading ? "..." : score ?? "-"}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Score</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{getScoreLabel(score)}</p>
            <p className="mt-1 text-xs text-slate-500">{job?.record_count ?? 0} records analyzed</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs text-slate-500">Total Findings</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{loading ? "..." : totalFindings}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs text-slate-500">Records</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{loading ? "..." : job?.record_count ?? 0}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-semibold text-slate-900">Severity Mix</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
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

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3">
            <BarChart3 className="h-4 w-4 text-slate-500" />
            <p className="text-sm font-semibold text-slate-900">Score Breakdown</p>
          </div>
          {visibleScores.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-slate-500">Score breakdown is available after analysis.</div>
          ) : (
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Check</TableHead>
                  <TableHead className="font-semibold">Findings</TableHead>
                  <TableHead className="font-semibold">Penalty</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleScores.map((item) => (
                  <TableRow key={item.score_id}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium text-slate-900">{item.check_name}</div>
                      <p className="mt-1 text-xs text-slate-500">{item.check_code}</p>
                    </TableCell>
                    <TableCell>{item.finding_count}</TableCell>
                    <TableCell>
                      <div className="min-w-24">
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span>{item.applied_penalty}</span>
                          <span>cap {item.penalty_cap}</span>
                        </div>
                        <Progress value={item.penalty_cap ? Math.min(100, (item.applied_penalty / item.penalty_cap) * 100) : 0} className="mt-1 h-1.5 bg-slate-100" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        {item.score_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </section>
  );
}
