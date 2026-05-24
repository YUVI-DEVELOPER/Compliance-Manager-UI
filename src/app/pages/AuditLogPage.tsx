import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Download, Eye, FileSearch, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "../auth/useAuth";
import { EmptyState, FilterBar, RightPanel, StatusBadge, type ActiveFilter } from "../components/foundation";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input, SearchInput } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  AuditLogFilters,
  AuditLogRecord,
  AuditLogSummary,
  exportAuditLogs,
  getAuditLogSummary,
  listAuditLogs,
} from "../../services/audit-log.service";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const baseFilters: AuditLogFilters = {
  page: 1,
  limit: 20,
};

const emptySummary: AuditLogSummary = {
  total_logs: 0,
  today_logs: 0,
  failed_actions: 0,
  critical_changes: 0,
};

const summaryCards = [
  { key: "total_logs", label: "Total Logs", tone: "text-blue-700", icon: <FileSearch className="h-4 w-4" /> },
  { key: "today_logs", label: "Today", tone: "text-emerald-700", icon: <CalendarClock className="h-4 w-4" /> },
  { key: "failed_actions", label: "Failed Actions", tone: "text-red-700", icon: <AlertTriangle className="h-4 w-4" /> },
  { key: "critical_changes", label: "Critical Changes", tone: "text-violet-700", icon: <ShieldCheck className="h-4 w-4" /> },
] as const;

const filterLabels: Partial<Record<keyof AuditLogFilters, string>> = {
  from_date: "From",
  to_date: "To",
  module_name: "Module",
  entity_name: "Record Type",
  action: "Action",
  performed_by_email: "Actor",
  performed_by_role: "Role",
  record_id: "Record ID",
  status: "Result",
  search: "Search",
};

type OptionalAuditMetadata = AuditLogRecord & {
  session_id?: string | null;
  metadata?: unknown;
  request_metadata?: unknown;
};

const formatDateTime = (value?: string | null, includeMilliseconds = false): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const formatted = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: includeMilliseconds ? "2-digit" : undefined,
  }).format(date);
  if (!includeMilliseconds) return formatted;
  return `${formatted}.${String(date.getMilliseconds()).padStart(3, "0")}`;
};

const formatDateFilterValue = (value?: string): string => {
  if (!value) return "";
  return formatDateTime(value);
};

const cleanText = (value?: string | null): string => {
  const text = (value ?? "").trim();
  return text || "-";
};

const formatAction = (value?: string | null): string => cleanText(value).replace(/_/g, " ");

const statusKind = (status?: string | null): "active" | "inactive" | "pending" | "error" => {
  const normalized = (status ?? "").trim().toUpperCase();
  if (!normalized) return "inactive";
  if (normalized === "SUCCESS") return "active";
  if (normalized === "FAILED" || normalized === "ERROR") return "error";
  if (normalized === "PENDING") return "pending";
  return "inactive";
};

const actorLabel = (row: AuditLogRecord): string =>
  row.performed_by.name || row.performed_by.email || row.performed_by.user_id || "System";

const metadataSummary = (row: AuditLogRecord): string => {
  const optional = row as OptionalAuditMetadata;
  const parts = [
    row.ip_address ? `IP ${row.ip_address}` : null,
    row.request_id ? `Req ${row.request_id}` : null,
    optional.session_id ? `Session ${optional.session_id}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" | ") : "-";
};

const recordLabel = (row: AuditLogRecord): string => {
  const type = cleanText(row.entity_name);
  const id = cleanText(row.record_id);
  return id === "-" ? type : `${type} / ${id}`;
};

const summaryText = (row: AuditLogRecord): string => {
  if (row.event_description?.trim()) return row.event_description.trim();
  if (row.changed_fields.length > 0) {
    return `Changed ${row.changed_fields.length} field${row.changed_fields.length === 1 ? "" : "s"}`;
  }
  return row.reason?.trim() || "Audit event captured";
};

const hasPayload = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
};

const JsonBlock = ({ value }: { value: unknown }) => (
  <pre className="max-h-80 overflow-auto rounded-md border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100">
    {value === null || value === undefined ? "null" : JSON.stringify(value, null, 2)}
  </pre>
);

function FieldBlock({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className={`mt-1 break-words text-sm font-medium text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

function ResultBadge({ status }: { status?: string | null }) {
  const kind = statusKind(status);
  return (
    <span className="inline-flex items-center gap-2">
      <StatusBadge status={kind}>{cleanText(status)}</StatusBadge>
    </span>
  );
}

function AuditPayloadSection({ title, value, emptyText }: { title: string; value: unknown; emptyText: string }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{title}</h3>
      {hasPayload(value) ? (
        <JsonBlock value={value} />
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">{emptyText}</div>
      )}
    </section>
  );
}

export function AuditLogPage() {
  const { hasPermission, hasRole } = useAuth();
  const canExport = hasRole("ADMIN") || hasPermission("AUDIT_LOG_EXPORT");
  const header = getPageHeaderConfig("audit-log");

  const [summary, setSummary] = useState<AuditLogSummary>(emptySummary);
  const [rows, setRows] = useState<AuditLogRecord[]>([]);
  const [selected, setSelected] = useState<AuditLogRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<AuditLogFilters>(baseFilters);
  const [appliedFilters, setAppliedFilters] = useState<AuditLogFilters>(baseFilters);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / (appliedFilters.limit ?? 20))),
    [appliedFilters.limit, total],
  );

  const hasActiveFilters = useMemo(
    () =>
      Object.entries(appliedFilters).some(([key, value]) => {
        if (key === "page" || key === "limit") return false;
        return value !== undefined && value !== null && value !== "";
      }),
    [appliedFilters],
  );

  const activeFilters: ActiveFilter[] = useMemo(
    () =>
      Object.entries(appliedFilters)
        .filter(([key, value]) => key !== "page" && key !== "limit" && value !== undefined && value !== null && value !== "")
        .map(([key, value]) => {
          const filterKey = key as keyof AuditLogFilters;
          const labelValue = filterKey === "from_date" || filterKey === "to_date" ? formatDateFilterValue(String(value)) : String(value);
          return {
            key,
            label: `${filterLabels[filterKey] ?? key}: ${labelValue}`,
            onRemove: () => removeFilter(filterKey),
          };
        }),
    [appliedFilters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryData, listData] = await Promise.all([getAuditLogSummary(), listAuditLogs(appliedFilters)]);
      setSummary(summaryData);
      setRows(listData.data);
      setTotal(listData.pagination.total);
    } catch (loadError: any) {
      const message = loadError?.response?.data?.detail || "Failed to load audit logs";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraftFilter = (key: keyof AuditLogFilters, value: string | number) => {
    setDraftFilters((current) => ({ ...current, [key]: value || undefined }));
  };

  function removeFilter(key: keyof AuditLogFilters) {
    setDraftFilters((current) => ({ ...current, [key]: undefined, page: 1 }));
    setAppliedFilters((current) => ({ ...current, [key]: undefined, page: 1 }));
  }

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setAppliedFilters({ ...draftFilters, page: 1 });
  };

  const clearFilters = () => {
    setDraftFilters(baseFilters);
    setAppliedFilters(baseFilters);
  };

  const setPage = (page: number) => {
    setDraftFilters((current) => ({ ...current, page }));
    setAppliedFilters((current) => ({ ...current, page }));
  };

  const setLimit = (limit: number) => {
    setDraftFilters((current) => ({ ...current, limit, page: 1 }));
    setAppliedFilters((current) => ({ ...current, limit, page: 1 }));
  };

  const exportRows = async () => {
    setExporting(true);
    try {
      const blob = await exportAuditLogs(appliedFilters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `audit-log-export-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Audit log export started");
    } catch (exportError: any) {
      toast.error(exportError?.response?.data?.detail || "Failed to export audit logs");
    } finally {
      setExporting(false);
    }
  };

  const selectedOptional = selected as OptionalAuditMetadata | null;
  const exportLabel = hasActiveFilters ? "Export Filtered CSV" : "Export All CSV";
  const showingStart = total === 0 ? 0 : ((appliedFilters.page ?? 1) - 1) * (appliedFilters.limit ?? 20) + 1;
  const showingEnd = Math.min(total, (appliedFilters.page ?? 1) * (appliedFilters.limit ?? 20));

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Audit Log"
        subtitle="Review application-level audit trail records for regulated activity"
      />

      <div className={PAGE_CONTENT_CLASS}>
        <div className="grid gap-3 md:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.label}</div>
                <div className={card.tone}>{card.icon}</div>
              </div>
              <div className={`mt-3 text-2xl font-semibold ${card.tone}`}>{summary[card.key]}</div>
            </div>
          ))}
        </div>

        <form onSubmit={applyFilters}>
          <FilterBar activeFilters={activeFilters} onClearAll={activeFilters.length ? clearFilters : undefined} className="shadow-sm">
            <Input
              label="From"
              type="datetime-local"
              value={draftFilters.from_date ?? ""}
              onChange={(event) => updateDraftFilter("from_date", event.target.value)}
              wrapperClassName="w-full sm:w-52"
            />
            <Input
              label="To"
              type="datetime-local"
              value={draftFilters.to_date ?? ""}
              onChange={(event) => updateDraftFilter("to_date", event.target.value)}
              wrapperClassName="w-full sm:w-52"
            />
            <Input
              label="Actor"
              placeholder="Email or user"
              value={draftFilters.performed_by_email ?? ""}
              onChange={(event) => updateDraftFilter("performed_by_email", event.target.value)}
              wrapperClassName="w-full sm:w-56"
            />
            <Input
              label="Module"
              placeholder="Module name"
              value={draftFilters.module_name ?? ""}
              onChange={(event) => updateDraftFilter("module_name", event.target.value)}
              wrapperClassName="w-full sm:w-48"
            />
            <Input
              label="Action"
              placeholder="Exact action"
              value={draftFilters.action ?? ""}
              onChange={(event) => updateDraftFilter("action", event.target.value)}
              wrapperClassName="w-full sm:w-48"
            />
            <Input
              label="Record Type"
              placeholder="Entity"
              value={draftFilters.entity_name ?? ""}
              onChange={(event) => updateDraftFilter("entity_name", event.target.value)}
              wrapperClassName="w-full sm:w-48"
            />
            <Input
              label="Record ID"
              placeholder="Record ID"
              value={draftFilters.record_id ?? ""}
              onChange={(event) => updateDraftFilter("record_id", event.target.value)}
              wrapperClassName="w-full sm:w-48"
            />
            <label className="flex w-full flex-col gap-1.5 sm:w-40">
              <span className="text-sm font-medium text-slate-700">Result</span>
              <select
                value={draftFilters.status ?? ""}
                onChange={(event) => updateDraftFilter("status", event.target.value)}
                className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
              >
                <option value="">Any result</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>
            <div className="w-full min-w-64 flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
              <SearchInput
                value={draftFilters.search ?? ""}
                placeholder="Search details, actor, record, or payload"
                onChange={(event) => updateDraftFilter("search", event.target.value)}
                onClear={() => updateDraftFilter("search", "")}
                className="h-9 bg-white"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={loading}>
                Apply Filters
              </Button>
              {canExport ? (
                <Button type="button" variant="secondary" onClick={() => void exportRows()} disabled={exporting}>
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {exportLabel}
                </Button>
              ) : null}
            </div>
          </FilterBar>
        </form>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Audit Trail Records</h2>
              <p className="mt-1 text-xs text-slate-500">
                Showing {showingStart}-{showingEnd} of {total} records. Most recent entries are listed first.
              </p>
            </div>
            {loading && rows.length > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Refreshing
              </div>
            ) : null}
          </div>

          {loading && rows.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium text-slate-600">Loading audit trail...</p>
              </div>
            </div>
          ) : error && rows.length === 0 ? (
            <EmptyState
              title="Unable to load audit logs"
              description={error}
              icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
              action={
                <Button type="button" variant="secondary" onClick={() => void load()}>
                  Try Again
                </Button>
              }
              className="m-4 min-h-72 bg-white"
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={hasActiveFilters ? "No audit logs match the filters" : "No audit logs found"}
              description={hasActiveFilters ? "Clear filters or broaden the search to review more audit trail records." : "Audit trail records will appear here as regulated activity is captured."}
              className="m-4 min-h-72 bg-white"
            />
          ) : (
            <Table containerClassName="max-h-[62vh]">
              <TableHeader className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <TableRow>
                  <TableHead className="min-w-44 px-4">Timestamp</TableHead>
                  <TableHead className="min-w-48 px-4">Actor</TableHead>
                  <TableHead className="min-w-40 px-4">Module</TableHead>
                  <TableHead className="min-w-44 px-4">Action</TableHead>
                  <TableHead className="min-w-56 px-4">Record</TableHead>
                  <TableHead className="min-w-72 px-4">Summary</TableHead>
                  <TableHead className="min-w-28 px-4">Result</TableHead>
                  <TableHead className="min-w-64 px-4">Request Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.audit_id}
                    className="cursor-pointer hover:bg-blue-50/40"
                    onClick={() => setSelected(row)}
                    title="View audit details"
                  >
                    <TableCell className="px-4 font-medium text-slate-800">{formatDateTime(row.event_time)}</TableCell>
                    <TableCell className="px-4">
                      <div className="font-medium text-slate-900">{actorLabel(row)}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{row.performed_by.role || row.performed_by.email || "-"}</div>
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        {cleanText(row.module_name)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 font-medium text-slate-900">{formatAction(row.action)}</TableCell>
                    <TableCell className="px-4">
                      <div className="font-medium text-slate-800">{cleanText(row.entity_name)}</div>
                      <div className="mt-0.5 max-w-56 truncate font-mono text-xs text-slate-500" title={row.record_id ?? undefined}>
                        {cleanText(row.record_id)}
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="max-w-80 truncate text-slate-700" title={summaryText(row)}>
                        {summaryText(row)}
                      </div>
                      {row.changed_fields.length > 0 ? (
                        <div className="mt-1 text-xs text-slate-500">{row.changed_fields.length} changed field(s)</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4">
                      <ResultBadge status={row.status} />
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="max-w-64 truncate font-mono text-xs text-slate-600" title={metadataSummary(row)}>
                        {metadataSummary(row)}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                value={appliedFilters.limit ?? 20}
                onChange={(event) => setLimit(Number(event.target.value))}
                className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span>
                Page {appliedFilters.page ?? 1} of {totalPages}
              </span>
              <Button type="button" variant="outline" size="sm" disabled={(appliedFilters.page ?? 1) <= 1 || loading} onClick={() => setPage((appliedFilters.page ?? 1) - 1)}>
                Previous
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={(appliedFilters.page ?? 1) >= totalPages || loading} onClick={() => setPage((appliedFilters.page ?? 1) + 1)}>
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <RightPanel
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Audit Log #${selected.audit_id}` : "Audit Log Detail"}
        description={selected ? `${formatAction(selected.action)} | ${formatDateTime(selected.event_time, true)}` : undefined}
        widthClassName="max-w-3xl"
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
                <Eye className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                    {cleanText(selected.module_name)}
                  </Badge>
                  <ResultBadge status={selected.status} />
                </div>
                <h2 className="mt-2 text-base font-semibold text-slate-900">{formatAction(selected.action)}</h2>
                <p className="mt-1 break-words text-sm text-slate-500">{summaryText(selected)}</p>
              </div>
            </div>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Event Identity</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <FieldBlock label="Timestamp" value={formatDateTime(selected.event_time, true)} />
                <FieldBlock label="Created At" value={formatDateTime(selected.created_at, true)} />
                <FieldBlock label="Actor" value={actorLabel(selected)} />
                <FieldBlock label="Actor Email" value={cleanText(selected.performed_by.email)} />
                <FieldBlock label="Actor Role" value={cleanText(selected.performed_by.role)} />
                <FieldBlock label="Actor User ID" value={cleanText(selected.performed_by.user_id)} mono />
                <FieldBlock label="Module" value={cleanText(selected.module_name)} />
                <FieldBlock label="Record" value={recordLabel(selected)} />
                <FieldBlock label="Table" value={cleanText(selected.table_name)} mono />
                <FieldBlock label="Record ID" value={cleanText(selected.record_id)} mono />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Request Metadata</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <FieldBlock label="Request ID" value={cleanText(selected.request_id)} mono />
                <FieldBlock label="Session ID" value={cleanText(selectedOptional?.session_id)} mono />
                <FieldBlock label="IP Address" value={cleanText(selected.ip_address)} mono />
                <FieldBlock label="User Agent" value={cleanText(selected.user_agent)} />
                <FieldBlock label="Reason" value={cleanText(selected.reason)} />
                <FieldBlock label="Description" value={cleanText(selected.event_description)} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Changed Fields</h3>
              {selected.changed_fields.length > 0 ? (
                <div className="flex flex-wrap gap-2 rounded-md border border-slate-200 bg-white p-3">
                  {selected.changed_fields.map((fieldName) => (
                    <span key={fieldName} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-medium text-slate-700">
                      {fieldName}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No field-level changes captured for this event.
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <AuditPayloadSection title="Old Values" value={selected.old_data} emptyText="No previous values captured." />
              <AuditPayloadSection title="New Values" value={selected.new_data} emptyText="No new values captured." />
            </div>

            {hasPayload(selectedOptional?.metadata) || hasPayload(selectedOptional?.request_metadata) ? (
              <AuditPayloadSection
                title="Raw Metadata"
                value={selectedOptional?.metadata ?? selectedOptional?.request_metadata}
                emptyText="No raw metadata captured."
              />
            ) : null}
          </div>
        ) : (
          <EmptyState title="No audit record selected" description="Select an audit log row to review full details." />
        )}
      </RightPanel>
    </div>
  );
}
