import React from "react";

import { AssetInventoryReportRow } from "../../../services/asset.service";
import { LookupOption } from "../../services/lookupValue.service";
import { getAssetStatusBadgeClass, getCriticalityBadgeClass } from "./assetForm.shared";
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
  loading: boolean;
  emptyMessage: string;
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

export function AssetInventoryReportTable({
  rows,
  loading,
  emptyMessage,
  assetClasses = [],
  assetCategories = [],
  assetTypes = [],
  assetStatuses = [],
  criticalities = [],
}: AssetInventoryReportTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="px-4 font-semibold">Asset ID</TableHead>
            <TableHead className="px-4 font-semibold">Asset Name</TableHead>
            <TableHead className="px-4 font-semibold">Class / Category / Type</TableHead>
            <TableHead className="px-4 font-semibold">Organization / Unit</TableHead>
            <TableHead className="px-4 font-semibold">Supplier</TableHead>
            <TableHead className="px-4 font-semibold">Owner</TableHead>
            <TableHead className="px-4 font-semibold">Lifecycle</TableHead>
            <TableHead className="px-4 font-semibold">Criticality</TableHead>
            <TableHead className="px-4 font-semibold">Identifiers</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="px-4 py-10 text-center text-slate-500">
                Running asset inventory report...
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="px-4 py-10 text-center text-slate-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.asset_uuid} className="hover:bg-slate-50">
                <TableCell className="px-4 align-top font-medium text-slate-900">
                  {row.asset_id || "-"}
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="space-y-1">
                    <div className="font-medium text-slate-900">{row.asset_name || "-"}</div>
                    <div className="text-xs text-slate-500">
                      {row.manufacturer || row.model
                        ? [row.manufacturer, row.model].filter(Boolean).join(" / ")
                        : "No manufacturer details"}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="space-y-1">
                    <div className="text-sm text-slate-900">
                      {findLookupLabel(assetClasses, row.asset_class)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {[
                        findLookupLabel(assetCategories, row.asset_category),
                        findLookupLabel(assetTypes, row.asset_type),
                      ]
                        .filter((value) => value && value !== "-")
                        .join(" / ") || "-"}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="space-y-1">
                    <div className="text-sm text-slate-900">{row.org_node_name || "-"}</div>
                    <div className="text-xs text-slate-500">{row.org_node_code || "No unit code"}</div>
                  </div>
                </TableCell>
                <TableCell className="px-4 align-top">{row.supplier_name || "-"}</TableCell>
                <TableCell className="px-4 align-top">{row.asset_owner || "-"}</TableCell>
                <TableCell className="px-4 align-top">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getAssetStatusBadgeClass(
                      row.lifecycle_state,
                    )}`}
                  >
                    {findLookupLabel(assetStatuses, row.lifecycle_state)}
                  </span>
                </TableCell>
                <TableCell className="px-4 align-top">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getCriticalityBadgeClass(
                      row.criticality_class,
                    )}`}
                  >
                    {findLookupLabel(criticalities, row.criticality_class)}
                  </span>
                </TableCell>
                <TableCell className="px-4 align-top">
                  <div className="space-y-1 text-xs text-slate-600">
                    <div>Serial: {row.serial_number || "-"}</div>
                    <div>Tag: {row.tag_number || "-"}</div>
                    <div>Legacy: {row.legacy_id || "-"}</div>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
