import React from "react";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { AssetRecord } from "../../../services/asset.service";
import { LookupOption } from "../../services/lookupValue.service";
import { OrgNode } from "../../../services/org.service";
import { SupplierRecord } from "../../../services/supplier.service";
import { buildOrgMap, getAssetStatusBadgeClass } from "./assetForm.shared";

interface AssetTableProps {
  assets: AssetRecord[];
  loading: boolean;
  searchQuery?: string;
  orgTree?: OrgNode[];
  suppliers?: SupplierRecord[];
  assetClasses?: LookupOption[];
  assetTypes?: LookupOption[];
  assetStatuses?: LookupOption[];
  canEdit?: boolean;
  canDelete?: boolean;
  onView: (asset: AssetRecord) => void;
  onEdit: (asset: AssetRecord) => void;
  onDelete: (asset: AssetRecord) => void;
}

const findLookupLabel = (options: LookupOption[], code?: string | null): string => {
  if (!code) return "-";
  const found = options.find((item) => item.code === code);
  return found?.value || code;
};

export function AssetTable({
  assets,
  loading,
  searchQuery = "",
  orgTree = [],
  suppliers = [],
  assetClasses = [],
  assetTypes = [],
  assetStatuses = [],
  canEdit = false,
  canDelete = false,
  onView,
  onEdit,
  onDelete,
}: AssetTableProps) {
  const orgMap = buildOrgMap(orgTree);
  const supplierMap = new Map<string, string>(suppliers.map((s) => [s.supplier_id, s.supplier_name]));

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Asset ID</TableHead>
            <TableHead className="font-semibold">Asset Name</TableHead>
            <TableHead className="font-semibold">Class / Type</TableHead>
            <TableHead className="font-semibold">Owner</TableHead>
            <TableHead className="font-semibold">Organization</TableHead>
            <TableHead className="font-semibold">Supplier</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                Loading asset master records...
              </TableCell>
            </TableRow>
          ) : assets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                {searchQuery.trim()
                  ? "No assets found matching your search."
                  : "No asset master records found yet."}
              </TableCell>
            </TableRow>
          ) : (
            assets.map((asset) => (
              <TableRow key={asset.asset_uuid} className="hover:bg-slate-50">
                <TableCell className="font-medium text-slate-900">{asset.asset_id || "-"}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{asset.asset_name || "-"}</p>
                    <p className="text-xs text-slate-500">{asset.short_description || "-"}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-900">{findLookupLabel(assetClasses, asset.asset_class)}</p>
                    <p className="text-xs text-slate-500">{findLookupLabel(assetTypes, asset.asset_type)}</p>
                  </div>
                </TableCell>
                <TableCell>{asset.asset_owner || "-"}</TableCell>
                <TableCell>
                  {asset.org_node_name || (asset.org_node_id ? orgMap.get(asset.org_node_id)?.name : "-")}
                </TableCell>
                <TableCell>
                  {asset.supplier_name || (asset.supplier_id ? supplierMap.get(asset.supplier_id) : "-")}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${getAssetStatusBadgeClass(
                      asset.asset_status,
                    )}`}
                  >
                    {findLookupLabel(assetStatuses, asset.asset_status)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onView(asset)} title="View">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </Button>
                    {canEdit ? <Button variant="ghost" size="sm" onClick={() => onEdit(asset)} title="Edit">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </Button> : null}
                    {canDelete ? <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(asset)}
                      title="Delete"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </Button> : null}
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
