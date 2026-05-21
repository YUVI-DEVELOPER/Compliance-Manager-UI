import React, { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronRight, ListFilter, SearchX } from "lucide-react";

import { AuditReviewFinding } from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { SearchInput } from "../ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

type FindingFilter =
  | "ALL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "MISSING_TIMESTAMP"
  | "MISSING_USER_ID"
  | "RECORD_ADDITION_TRACEABILITY"
  | "MODIFICATION_CAPTURE_OLD_NEW_VALUES"
  | "DELETE_ACTION"
  | "OFF_HOURS_ACTIVITY"
  | "PERMISSION_ACCESS_CHANGE"
  | "CONFIGURATION_SYSTEM_CHANGE"
  | "DATA_EXPORT_LOGGING"
  | "AUDIT_TRAIL_COMPLETENESS";

type SortKey = "severity" | "check" | "impact" | "records";

interface AuditReviewFindingsTableProps {
  findings: AuditReviewFinding[];
  loading?: boolean;
}

const filters: Array<{ key: FindingFilter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "HIGH", label: "High" },
  { key: "MEDIUM", label: "Medium" },
  { key: "LOW", label: "Low" },
  { key: "MISSING_TIMESTAMP", label: "Timestamp" },
  { key: "MISSING_USER_ID", label: "Missing User ID" },
  { key: "RECORD_ADDITION_TRACEABILITY", label: "Additions" },
  { key: "MODIFICATION_CAPTURE_OLD_NEW_VALUES", label: "Modifications" },
  { key: "DELETE_ACTION", label: "Delete Actions" },
  { key: "OFF_HOURS_ACTIVITY", label: "Off-hours Activity" },
  { key: "PERMISSION_ACCESS_CHANGE", label: "Permission Changes" },
  { key: "CONFIGURATION_SYSTEM_CHANGE", label: "Config Changes" },
  { key: "DATA_EXPORT_LOGGING", label: "Exports" },
  { key: "AUDIT_TRAIL_COMPLETENESS", label: "Completeness" },
];

const severityRank = (severity?: string | null): number => {
  if (severity === "HIGH") return 0;
  if (severity === "MEDIUM") return 1;
  if (severity === "LOW") return 2;
  return 3;
};

export const getAuditReviewSeverityBadgeClass = (severity?: string | null): string => {
  if (severity === "HIGH") return "border-red-200 bg-red-50 text-red-700";
  if (severity === "MEDIUM") return "border-amber-200 bg-amber-50 text-amber-700";
  if (severity === "LOW") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const formatSeverity = (severity?: string | null): string => severity || "INFO";

const getFindingTitle = (finding: AuditReviewFinding): string =>
  finding.finding_title || finding.title || finding.check_name || "Audit review finding";

const getFindingSummary = (finding: AuditReviewFinding): string =>
  finding.finding_summary || finding.description || "No finding summary was provided.";

const matchesFilter = (finding: AuditReviewFinding, filter: FindingFilter): boolean => {
  if (filter === "ALL") return true;
  if (filter === "HIGH" || filter === "MEDIUM" || filter === "LOW") return finding.severity === filter;
  return finding.check_code === filter;
};

export function AuditReviewFindingsTable({ findings, loading = false }: AuditReviewFindingsTableProps) {
  const [activeFilter, setActiveFilter] = useState<FindingFilter>("ALL");
  const [auditTypeFilter, setAuditTypeFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  const filteredFindings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const auditTypeRows = auditTypeFilter === "ALL"
      ? findings
      : findings.filter((finding) => finding.audit_trail_type === auditTypeFilter);
    const rows = auditTypeRows.filter((finding) => {
      if (!matchesFilter(finding, activeFilter)) return false;
      if (!normalizedQuery) return true;

      return [
        finding.severity,
        finding.check_code,
        finding.check_name,
        getFindingTitle(finding),
        getFindingSummary(finding),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return [...rows].sort((left, right) => {
      if (sortKey === "severity") {
        return severityRank(left.severity) - severityRank(right.severity) || right.score_impact - left.score_impact;
      }
      if (sortKey === "check") return left.check_code.localeCompare(right.check_code);
      if (sortKey === "impact") return right.score_impact - left.score_impact;
      return right.source_record_count - left.source_record_count;
    });
  }, [activeFilter, auditTypeFilter, findings, query, sortKey]);
  const auditTypeOptions = useMemo(
    () => Array.from(new Set(findings.map((finding) => finding.audit_trail_type).filter(Boolean))) as string[],
    [findings],
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit review findings">
      <div className="border-b border-slate-200 px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Findings</h3>
            <p className="mt-1 text-xs text-slate-500">Filtered review findings with severity, check code, evidence summary, and score impact.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <SearchInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onClear={() => setQuery("")}
              placeholder="Search findings"
              className="sm:w-64"
              aria-label="Search audit review findings"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setSortKey(sortKey === "severity" ? "impact" : "severity")}>
              <ArrowUpDown className="h-4 w-4" />
              {sortKey === "severity" ? "Severity" : "Impact"}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAuditTypeFilter("ALL")}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              auditTypeFilter === "ALL"
                ? "border-blue-900 bg-blue-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            All Types
          </button>
          {auditTypeOptions.map((auditType) => (
            <button
              key={auditType}
              type="button"
              onClick={() => setAuditTypeFilter(auditType)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                auditTypeFilter === auditType
                  ? "border-blue-900 bg-blue-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {formatEvidenceLabel(auditType)}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {filters.map((filter) => {
            const selected = activeFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selected
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {filter.key === "ALL" ? <ListFilter className="h-3.5 w-3.5" /> : null}
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <Table className="min-w-[920px]">
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Severity</TableHead>
            <TableHead className="font-semibold">Audit Trail</TableHead>
            <TableHead className="font-semibold">Check Code</TableHead>
            <TableHead className="min-w-56 font-semibold">Finding Title</TableHead>
            <TableHead className="min-w-80 font-semibold">Finding Summary</TableHead>
            <TableHead className="font-semibold">Source Records</TableHead>
            <TableHead className="font-semibold">Score Impact</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                Loading audit findings...
              </TableCell>
            </TableRow>
          ) : filteredFindings.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                    <SearchX className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">
                    {findings.length === 0 ? "No findings recorded" : "No findings match the current filters"}
                  </p>
                  <p className="mt-1 max-w-md text-sm text-slate-500">
                    {findings.length === 0
                      ? "Analysis did not return review findings for the selected job."
                      : "Adjust the search or quick filters to broaden the findings view."}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            filteredFindings.map((finding) => {
              const expanded = expandedFindingId === finding.finding_id;
              const safeEvidence = getSafeEvidenceEntries(finding.evidence_json);

              return (
                <React.Fragment key={finding.finding_id}>
                  <TableRow className="hover:bg-slate-50/80">
                    <TableCell className="align-top">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                          onClick={() => setExpandedFindingId(expanded ? null : finding.finding_id)}
                          aria-label={expanded ? "Collapse evidence" : "Expand evidence"}
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        <Badge variant="outline" className={getAuditReviewSeverityBadgeClass(finding.severity)}>
                          {formatSeverity(finding.severity)}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        {formatEvidenceLabel(finding.audit_trail_type || "unspecified")}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="max-w-44 whitespace-normal break-words font-mono text-xs font-semibold text-slate-700">
                        {finding.check_code}
                      </div>
                      <p className="mt-1 max-w-44 whitespace-normal text-xs text-slate-500">{finding.check_name}</p>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      <div className="max-w-72 break-words font-medium leading-5 text-slate-900">
                        {getFindingTitle(finding)}
                      </div>
                    </TableCell>
                    <TableCell className="align-top whitespace-normal">
                      <p className="max-w-[34rem] break-words text-sm leading-5 text-slate-600">
                        {getFindingSummary(finding)}
                      </p>
                    </TableCell>
                    <TableCell className="align-top text-slate-700">{finding.source_record_count}</TableCell>
                    <TableCell className="align-top">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        -{finding.score_impact}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow className="bg-slate-50/70">
                      <TableCell colSpan={7} className="px-4 py-3">
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">Evidence Summary</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Normalized evidence only. Raw audit payload, credentials, and session identifiers are not displayed.
                              </p>
                            </div>
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                              {finding.source_record_count} source records
                            </Badge>
                          </div>
                          {safeEvidence.length === 0 ? (
                            <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                              No display-safe evidence fields were returned for this finding.
                            </div>
                          ) : (
                            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                              {safeEvidence.map(([key, value]) => (
                                <div key={key} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{formatEvidenceLabel(key)}</p>
                                  <p className="mt-1 break-words text-sm font-medium text-slate-900">{formatEvidenceValue(value)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </section>
  );
}

const HIDDEN_EVIDENCE_PATTERNS = ["raw", "payload", "credential", "password", "token", "session"];

const getSafeEvidenceEntries = (evidence?: Record<string, unknown>): Array<[string, unknown]> => {
  if (!evidence) return [];
  return Object.entries(evidence).filter(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    if (HIDDEN_EVIDENCE_PATTERNS.some((pattern) => normalizedKey.includes(pattern))) return false;
    if (value === undefined || value === null || value === "") return false;
    return typeof value !== "object" || value instanceof Date;
  });
};

const formatEvidenceLabel = (value: string): string =>
  value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const formatEvidenceValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
};
