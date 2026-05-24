import React from "react";

import { type AssetInventoryReportRow } from "../../../services/asset.service";
import { type LookupOption } from "../../services/lookupValue.service";
import { StatusBadge } from "../foundation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface AssetInventoryReportTableProps {
  rows: AssetInventoryReportRow[];
  assetClasses?: LookupOption[];
  assetCategories?: LookupOption[];
  assetTypes?: LookupOption[];
  assetStatuses?: LookupOption[];
  criticalities?: LookupOption[];
}

const findLookupLabel = (options: LookupOption[], code?: string | null): string => {
  if (!code) return "-";
  const match = options.find((option) => option.code === code);
  return match?.value ?? code;
};

const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const statusKind = (code?: string | null, label?: string): "active" | "inactive" | "pending" | "error" => {
  const value = `${code ?? ""} ${label ?? ""}`.toLowerCase();
  if (value.includes("inactive") || value.includes("retired") || value.includes("decommission")) return "inactive";
  if (value.includes("active") || value.includes("commission") || value.includes("in service")) return "active";
  if (value.includes("failed") || value.includes("error")) return "error";
  return "pending";
};

const criticalityClassName = (code?: string | null, label?: string): string => {
  const value = `${code ?? ""} ${label ?? ""}`.toLowerCase();
  if (value.includes("critical")) return "border-red-200 bg-red-50 text-red-700";
  if (value.includes("high")) return "border-amber-200 bg-amber-50 text-amber-700";
  if (value.includes("low")) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
};

export function AssetInventoryReportTable({
  rows,
  assetClasses = [],
  assetCategories = [],
  assetTypes = [],
  assetStatuses = [],
  criticalities = [],
}: AssetInventoryReportTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <Table containerClassName="max-h-[62vh]">
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="px-4 font-semibold">Asset ID</TableHead>
            <TableHead className="px-4 font-semibold">Asset Name</TableHead>
            <TableHead className="px-4 font-semibold">Org Unit</TableHead>
            <TableHead className="px-4 font-semibold">Class</TableHead>
            <TableHead className="px-4 font-semibold">Category</TableHead>
            <TableHead className="px-4 font-semibold">Status</TableHead>
            <TableHead className="px-4 font-semibold">Owner</TableHead>
            <TableHead className="px-4 font-semibold">Supplier</TableHead>
            <TableHead className="px-4 font-semibold">Criticality</TableHead>
            <TableHead className="px-4 font-semibold">Key Dates</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const statusLabel = findLookupLabel(assetStatuses, row.lifecycle_state);
            const criticalityLabel = findLookupLabel(criticalities, row.criticality_class);

            return (
              <TableRow key={row.asset_uuid || row.asset_id} className="hover:bg-slate-50">
                <TableCell className="px-4 align-top font-mono text-xs font-semibold text-slate-800">
                  {row.asset_id || "-"}
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900">{row.asset_name || "-"}</div>
                    <div className="text-xs text-slate-500">
                      {[row.manufacturer, row.model].filter(Boolean).join(" / ") || "No manufacturer details"}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="space-y-1">
                    <div className="text-sm text-slate-900">{row.org_node_name || "-"}</div>
                    <div className="text-xs text-slate-500">{row.org_node_code || "No unit code"}</div>
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top">{findLookupLabel(assetClasses, row.asset_class)}</TableCell>
                <TableCell className="px-4 align-top">
                  <div className="space-y-1">
                    <div className="text-sm text-slate-900">{findLookupLabel(assetCategories, row.asset_category)}</div>
                    <div className="text-xs text-slate-500">{findLookupLabel(assetTypes, row.asset_type)}</div>
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={statusKind(row.lifecycle_state, statusLabel)} />
                    <span className="text-xs text-slate-500">{statusLabel}</span>
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top">{row.asset_owner || "-"}</TableCell>
                <TableCell className="px-4 align-top">{row.supplier_name || "-"}</TableCell>
                <TableCell className="px-4 align-top">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${criticalityClassName(row.criticality_class, criticalityLabel)}`}>
                    {criticalityLabel}
                  </span>
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="space-y-1 text-xs text-slate-600">
                    <div>Commission: {formatDate(row.asset_commission_dt)}</div>
                    <div>Purchase: {formatDate(row.asset_purchase_dt)}</div>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
