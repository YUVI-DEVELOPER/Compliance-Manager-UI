import React, { useMemo, useState } from "react";

import { AuditReviewJobDetail, AuditTrailRecord } from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  formatAuditReviewDateTime,
  formatAuditReviewLabel,
  formatAuditReviewNumber,
  formatAuditReviewValue,
  getAuditReviewSelectedTypes,
} from "./auditReviewUi.shared";

interface AuditReviewRecordsTableProps {
  job: AuditReviewJobDetail | null;
  records: AuditTrailRecord[];
}

const columnsForType = (auditTrailType?: string | null) => {
  if (auditTrailType === "login_audit_trail") {
    return ["event_timestamp", "user_name", "user_id", "action_type", "event_status", "ip_address", "auth_method"];
  }
  if (auditTrailType === "system_audit_trail" || auditTrailType === "domain_audit_trail") {
    return ["event_timestamp", "user_name", "action_type", "object_type", "object_name", "field_name", "change_control_id"];
  }
  return ["event_timestamp", "user_name", "action_type", "object_type", "object_name", "field_name", "old_value", "new_value"];
};

const isKnownAction = (value?: string | null): value is string => {
  if (value === undefined || value === null) return false;
  const normalized = String(value).trim().toUpperCase();
  return normalized !== "" && normalized !== "UNKNOWN" && normalized !== "N/A" && normalized !== "NA" && normalized !== "-";
};

const displayActionForRecord = (record: AuditTrailRecord): string =>
  [
    record.display_action,
    record.action_type,
    record.detected_action_category,
    record.raw_action,
  ].find(isKnownAction) ?? "UNKNOWN";

const valueForColumn = (record: AuditTrailRecord, column: string): string => {
  if (column === "event_timestamp") return formatAuditReviewDateTime(record.event_timestamp);
  if (column === "action_type") return formatAuditReviewValue(displayActionForRecord(record));
  const value = record[column as keyof AuditTrailRecord];
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return formatAuditReviewValue(value as string | number | null | undefined);
};

export function AuditReviewRecordsTable({ job, records }: AuditReviewRecordsTableProps) {
  const selectedTypes = getAuditReviewSelectedTypes(job);
  const [activeType, setActiveType] = useState<string>("ALL");
  const visibleRecords = useMemo(
    () => (activeType === "ALL" ? records : records.filter((record) => record.audit_trail_type === activeType)),
    [activeType, records],
  );
  const sampleType = activeType === "ALL" ? visibleRecords[0]?.audit_trail_type ?? selectedTypes[0] : activeType;
  const columns = columnsForType(sampleType);

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Audit trail records">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Records</h3>
          <p className="mt-1 text-xs text-slate-500">Normalized records grouped by audit trail type.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
            {formatAuditReviewNumber(visibleRecords.length)} shown
          </Badge>
          <Select value={activeType} onValueChange={setActiveType}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Audit Trail Types</SelectItem>
              {selectedTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatAuditReviewLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Audit Trail</TableHead>
            {columns.map((column) => (
              <TableHead key={column} className="font-semibold">
                {formatAuditReviewLabel(column)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRecords.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length + 1} className="py-8 text-center text-slate-500">
                Records appear after extraction.
              </TableCell>
            </TableRow>
          ) : (
            visibleRecords.slice(0, 100).map((record) => (
              <TableRow key={record.record_id}>
                <TableCell>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                    {formatAuditReviewLabel(record.audit_trail_type)}
                  </Badge>
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column} className="max-w-72 whitespace-normal text-slate-700">
                    <div className="break-words">{valueForColumn(record, column)}</div>
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}
