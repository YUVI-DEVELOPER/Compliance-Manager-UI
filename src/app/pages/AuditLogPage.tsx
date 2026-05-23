import React, { useEffect, useMemo, useState } from "react";
import { Download, Search, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import {
  AuditLogFilters,
  AuditLogRecord,
  AuditLogSummary,
  exportAuditLogs,
  getAuditLogSummary,
  listAuditLogs,
} from "../../services/audit-log.service";

const emptySummary: AuditLogSummary = {
  total_logs: 0,
  today_logs: 0,
  failed_actions: 0,
  critical_changes: 0,
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const JsonBlock = ({ value }: { value: unknown }) => (
  <pre className="max-h-64 overflow-auto rounded-md bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
    {value === null || value === undefined ? "null" : JSON.stringify(value, null, 2)}
  </pre>
);

export function AuditLogPage() {
  const { hasPermission, hasRole } = useAuth();
  const canExport = hasRole("ADMIN") || hasPermission("AUDIT_LOG_EXPORT");
  const header = getPageHeaderConfig("audit-log");
  const [summary, setSummary] = useState<AuditLogSummary>(emptySummary);
  const [rows, setRows] = useState<AuditLogRecord[]>([]);
  const [selected, setSelected] = useState<AuditLogRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, limit: 20 });
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / (filters.limit ?? 20))), [filters.limit, total]);

  const load = async () => {
    setLoading(true);
    try {
      const [summaryData, listData] = await Promise.all([
        getAuditLogSummary(),
        listAuditLogs(filters),
      ]);
      setSummary(summaryData);
      setRows(listData.data);
      setTotal(listData.pagination.total);
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filters.page, filters.limit]);

  const applyFilters = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, page: 1 }));
    void load();
  };

  const updateFilter = (key: keyof AuditLogFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  };

  const exportRows = async () => {
    try {
      const blob = await exportAuditLogs(filters);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "audit-log-export.csv";
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Audit log export started");
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to export audit logs");
    }
  };

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={header.subtitle}
      />
      <div className={PAGE_CONTENT_CLASS}>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["Total Logs", summary.total_logs],
            ["Today's Logs", summary.today_logs],
            ["Failed Actions", summary.failed_actions],
            ["Critical Changes", summary.critical_changes],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
            </div>
          ))}
        </div>

        <form onSubmit={applyFilters} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <Input type="datetime-local" onChange={(event) => updateFilter("from_date", event.target.value)} />
            <Input type="datetime-local" onChange={(event) => updateFilter("to_date", event.target.value)} />
            <Input placeholder="Module" onChange={(event) => updateFilter("module_name", event.target.value)} />
            <Input placeholder="Action" onChange={(event) => updateFilter("action", event.target.value)} />
            <Input placeholder="User/email" onChange={(event) => updateFilter("performed_by_email", event.target.value)} />
            <Input placeholder="Role" onChange={(event) => updateFilter("performed_by_role", event.target.value)} />
            <Input placeholder="Record ID" onChange={(event) => updateFilter("record_id", event.target.value)} />
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
              onChange={(event) => updateFilter("status", event.target.value)}
            >
              <option value="">Any status</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="relative min-w-64 flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input className="pl-9" placeholder="Search audit details..." onChange={(event) => updateFilter("search", event.target.value)} />
            </div>
            <Button type="submit" disabled={loading}>Apply</Button>
            {canExport && (
              <Button type="button" variant="outline" onClick={() => void exportRows()}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
          </div>
        </form>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Event Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Record ID</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.audit_id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(row)}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(row.event_time)}</td>
                    <td className="px-4 py-3 text-slate-900">{row.performed_by.name || row.performed_by.email || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{row.performed_by.role || "-"}</td>
                    <td className="px-4 py-3 text-slate-700">{row.module_name}</td>
                    <td className="px-4 py-3 text-slate-700">{row.entity_name}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.action}</td>
                    <td className="px-4 py-3 text-slate-600">{row.record_id || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${row.status === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">No audit logs found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
            <span>Page {filters.page ?? 1} of {totalPages}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) - 1 }))}>
                Previous
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={(filters.page ?? 1) >= totalPages} onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}>
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onClick={() => setSelected(null)}>
          <aside className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Audit Log #{selected.audit_id}</h2>
                <p className="text-sm text-slate-500">{selected.action} at {formatDateTime(selected.event_time)}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              {[
                ["Module", selected.module_name],
                ["Entity", selected.entity_name],
                ["Table", selected.table_name || "-"],
                ["Record ID", selected.record_id || "-"],
                ["User", selected.performed_by.name || "-"],
                ["Email", selected.performed_by.email || "-"],
                ["Role", selected.performed_by.role || "-"],
                ["Status", selected.status],
                ["IP Address", selected.ip_address || "-"],
                ["User Agent", selected.user_agent || "-"],
                ["Reason", selected.reason || "-"],
                ["Description", selected.event_description || "-"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-slate-200 p-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-1 break-words text-slate-900">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 space-y-4">
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Changed Fields</h3>
                <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                  {selected.changed_fields.length ? selected.changed_fields.join(", ") : "No field-level changes captured"}
                </div>
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">Old Data</h3>
                <JsonBlock value={selected.old_data} />
              </section>
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-900">New Data</h3>
                <JsonBlock value={selected.new_data} />
              </section>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
