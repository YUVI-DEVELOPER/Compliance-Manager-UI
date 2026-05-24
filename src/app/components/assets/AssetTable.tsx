import React from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
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
import { PermissionGuard } from "../../auth/PermissionGuard";
import { StatusBadge } from "../foundation";
import { buildOrgMap, getCriticalityBadgeClass } from "./assetForm.shared";

interface AssetTableProps {
  assets: AssetRecord[];
  loading: boolean;
  searchQuery?: string;
  orgTree?: OrgNode[];
  suppliers?: SupplierRecord[];
  assetClasses?: LookupOption[];
  assetCategories?: LookupOption[];
  assetSubCategories?: LookupOption[];
  assetTypes?: LookupOption[];
  assetStatuses?: LookupOption[];
  criticalities?: LookupOption[];
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
  assetCategories = [],
  assetSubCategories = [],
  assetTypes = [],
  assetStatuses = [],
  criticalities = [],
  canEdit = false,
  canDelete = false,
  onView,
  onEdit,
  onDelete,
}: AssetTableProps) {
  const orgMap = buildOrgMap(orgTree);
  const supplierMap = new Map<string, string>(suppliers.map((s) => [s.supplier_id, s.supplier_name]));

  const renderStatus = (status?: string | null) => {
    if (!status) return <span className="text-slate-400">-</span>;
    const label = findLookupLabel(assetStatuses, status);
    if (status === "ACTIVE") return <StatusBadge status="active" title={label} />;

    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <StatusBadge status="inactive" title={label} />
        {label !== "Inactive" ? <span className="text-xs text-slate-500">{label}</span> : null}
      </span>
    );
  };

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Asset ID</TableHead>
            <TableHead className="font-semibold">Asset Name</TableHead>
            <TableHead className="font-semibold">Asset Class</TableHead>
            <TableHead className="font-semibold">Category / Sub-category</TableHead>
            <TableHead className="font-semibold">Org Unit / Location</TableHead>
            <TableHead className="font-semibold">Supplier</TableHead>
            <TableHead className="font-semibold">Criticality</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                Loading asset master records...
              </TableCell>
            </TableRow>
          ) : assets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="py-8 text-center text-slate-500">
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
                <TableCell>
                  <div className="space-y-1">
                    <p className="text-sm text-slate-900">{findLookupLabel(assetCategories, asset.asset_category)}</p>
                    <p className="text-xs text-slate-500">{findLookupLabel(assetSubCategories, asset.asset_sub_category)}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {asset.org_node_name || (asset.org_node_id ? orgMap.get(asset.org_node_id)?.name : "-")}
                </TableCell>
                <TableCell>
                  {asset.supplier_name || (asset.supplier_id ? supplierMap.get(asset.supplier_id) : "-")}
                </TableCell>
                <TableCell>
                  {asset.criticality_class ? (
                    <Badge variant="outline" className={getCriticalityBadgeClass(asset.criticality_class)}>
                      {findLookupLabel(criticalities, asset.criticality_class)}
                    </Badge>
                  ) : "-"}
                </TableCell>
                <TableCell>
                  {renderStatus(asset.asset_status)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onView(asset)} title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <PermissionGuard permission="ASSET_UPDATE">
                      {canEdit ? (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(asset)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </PermissionGuard>
                    <PermissionGuard permission="ASSET_DELETE">
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(asset)}
                          title="Delete"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </PermissionGuard>
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
