import React, { useMemo } from "react";

import { AuditReviewJobDetail, AuditReviewScore } from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatAuditReviewLabel, formatAuditReviewNumber } from "./auditReviewUi.shared";

interface AuditReviewChecklistMatrixProps {
  job: AuditReviewJobDetail | null;
  scores: AuditReviewScore[];
}

const statusClass = (status?: string | null): string => {
  if (status === "ACTIVE" || status === "PASS") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "PARTIAL") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "NO_DATA") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "NOT_APPLICABLE") return "border-slate-200 bg-slate-50 text-slate-600";
  if (status === "FAIL") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-white text-slate-700";
};

const toRows = (job: AuditReviewJobDetail | null, scores: AuditReviewScore[]) => {
  const summaryRows = job?.checklist_applicability?.filter((item) => item && typeof item === "object") ?? [];
  if (summaryRows.length > 0) return summaryRows as Array<Record<string, unknown>>;
  return scores
    .filter((score) => score.score_scope === "CHECKPOINT")
    .map((score) => ({
      check_code: score.check_code,
      check_name: score.check_name,
      applicability: score.applicability ?? score.score_status,
      evaluated_record_count: score.evaluated_record_count,
      skipped_record_count: score.skipped_record_count,
      no_data_count: score.no_data_count,
      applicable_audit_trail_types: score.scoring_summary_json?.applicable_audit_trail_types,
    }));
};

export function AuditReviewChecklistMatrix({ job, scores }: AuditReviewChecklistMatrixProps) {
  const rows = useMemo(() => toRows(job, scores), [job, scores]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Checklist applicability matrix">
      <div className="border-b border-slate-200 px-4 py-4">
        <h3 className="text-sm font-semibold text-slate-900">Checklist Applicability</h3>
        <p className="mt-1 text-xs text-slate-500">Audit checks evaluated against selected audit trail types.</p>
      </div>
      <Table className="min-w-[860px]">
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Checkpoint</TableHead>
            <TableHead className="font-semibold">Applicability</TableHead>
            <TableHead className="font-semibold">Applicable Types</TableHead>
            <TableHead className="font-semibold">Evaluated</TableHead>
            <TableHead className="font-semibold">Skipped</TableHead>
            <TableHead className="font-semibold">No Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                Checklist details are available after analysis.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const applicability = String(row.applicability ?? row.check_status ?? "-");
              const types = Array.isArray(row.applicable_audit_trail_types)
                ? row.applicable_audit_trail_types.map((item) => formatAuditReviewLabel(String(item))).join(", ")
                : "-";
              return (
                <TableRow key={String(row.check_code)}>
                  <TableCell className="whitespace-normal">
                    <div className="font-medium text-slate-900">{String(row.check_name ?? row.check_code ?? "-")}</div>
                    <p className="mt-1 font-mono text-xs text-slate-500">{String(row.check_code ?? "-")}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusClass(applicability)}>
                      {formatAuditReviewLabel(applicability)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal text-sm text-slate-600">{types}</TableCell>
                  <TableCell>{formatAuditReviewNumber(Number(row.evaluated_record_count ?? 0))}</TableCell>
                  <TableCell>{formatAuditReviewNumber(Number(row.skipped_record_count ?? 0))}</TableCell>
                  <TableCell>{formatAuditReviewNumber(Number(row.no_data_count ?? 0))}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </section>
  );
}
