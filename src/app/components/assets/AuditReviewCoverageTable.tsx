import React from "react";

import { AuditReviewJobDetail } from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { formatAuditReviewLabel, formatAuditReviewNumber, getAuditReviewSelectedTypes } from "./auditReviewUi.shared";

interface AuditReviewCoverageTableProps {
  job: AuditReviewJobDetail | null;
}

const statusClass = (status?: string | null): string => {
  if (status === "EXTRACTED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  if (status === "PARTIAL_EXTRACTION") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const getCoverageRow = (job: AuditReviewJobDetail, auditTrailType: string) => {
  const coverage = job.coverage_by_audit_type?.[auditTrailType];
  return coverage && typeof coverage === "object" && !Array.isArray(coverage)
    ? (coverage as Record<string, unknown>)
    : {};
};

export function AuditReviewCoverageTable({ job }: AuditReviewCoverageTableProps) {
  const selectedTypes = getAuditReviewSelectedTypes(job);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Extraction coverage by audit type">
      <div className="border-b border-slate-200 px-4 py-4">
        <h3 className="text-sm font-semibold text-slate-900">Extraction Coverage</h3>
        <p className="mt-1 text-xs text-slate-500">Coverage by selected audit trail type.</p>
      </div>
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Audit Trail Type</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Records</TableHead>
            <TableHead className="font-semibold">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!job || selectedTypes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                Coverage appears after a review job is created.
              </TableCell>
            </TableRow>
          ) : (
            selectedTypes.map((auditTrailType) => {
              const row = getCoverageRow(job, auditTrailType);
              const status = String(row.status ?? job.status ?? "-");
              return (
                <TableRow key={auditTrailType}>
                  <TableCell className="font-medium text-slate-900">{formatAuditReviewLabel(auditTrailType)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusClass(status)}>
                      {formatAuditReviewLabel(status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-700">{formatAuditReviewNumber(Number(row.record_count ?? 0))}</TableCell>
                  <TableCell className="max-w-md whitespace-normal text-sm text-slate-600">
                    {String(row.error_message ?? row.mcp_status_code ?? row.extracted_at ?? "-")}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </section>
  );
}
