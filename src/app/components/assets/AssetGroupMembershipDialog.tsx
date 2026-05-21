import React, { useEffect, useMemo, useState } from "react";

import type { AssetRecord } from "../../../services/asset.service";
import { getAssets, searchAssets } from "../../../services/asset.service";
import type { AssetGroupRecord } from "../../../services/assetGrouping.service";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { SearchInput } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

interface AssetGroupMembershipDialogProps {
  open: boolean;
  group: AssetGroupRecord | null;
  existingAssetIds: Set<string>;
  saving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (assetUuids: string[]) => Promise<void> | void;
}

export function AssetGroupMembershipDialog({
  open,
  group,
  existingAssetIds,
  saving = false,
  onOpenChange,
  onSubmit,
}: AssetGroupMembershipDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<AssetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setResults([]);
      setSelectedIds(new Set());
      return;
    }

    const timer = window.setTimeout(() => {
      const loadAssets = async () => {
        setLoading(true);
        try {
          const nextResults = searchQuery.trim() ? await searchAssets(searchQuery.trim()) : await getAssets();
          setResults(nextResults);
        } finally {
          setLoading(false);
        }
      };

      void loadAssets();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, searchQuery]);

  const visibleResults = useMemo(
    () => results.filter((asset) => asset.asset_uuid && !existingAssetIds.has(asset.asset_uuid)),
    [existingAssetIds, results],
  );

  const toggleSelection = (assetUuid: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(assetUuid)) {
        next.delete(assetUuid);
      } else {
        next.add(assetUuid);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    const assetUuids = Array.from(selectedIds);
    if (assetUuids.length === 0) {
      return;
    }
    await onSubmit(assetUuids);
    setSelectedIds(new Set());
    setSearchQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-5xl max-h-[85vh] min-w-0 overflow-hidden">
        <DialogHeader className="pr-8">
          <DialogTitle>Add Assets to Group</DialogTitle>
          <DialogDescription>
            Assign one or more asset master records to {group?.group_name ?? "the selected group"}.
          </DialogDescription>
        </DialogHeader>

        <div className="min-w-0 space-y-4 overflow-hidden">
          <div className="min-w-0 space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Search Assets</label>
            <SearchInput
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onClear={() => setSearchQuery("")}
              placeholder="Search by asset ID, name, owner, or tracking identifier..."
              disabled={saving}
            />
          </div>

          <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200">
            <div className="max-h-[26rem] overflow-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-16 px-4">Select</TableHead>
                    <TableHead className="w-[18rem] px-4">Asset</TableHead>
                    <TableHead className="w-[14rem] px-4">Class / Type</TableHead>
                    <TableHead className="w-[14rem] px-4">Organization</TableHead>
                    <TableHead className="w-[8rem] px-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        Loading available assets...
                      </TableCell>
                    </TableRow>
                  ) : visibleResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                        No unassigned assets matched the current search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleResults.map((asset) => (
                      <TableRow key={asset.asset_uuid} className="hover:bg-slate-50">
                        <TableCell className="px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(asset.asset_uuid)}
                            onChange={() => toggleSelection(asset.asset_uuid)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </TableCell>
                        <TableCell className="max-w-[18rem] px-4">
                          <div className="space-y-1">
                            <div className="truncate font-medium text-slate-900">{asset.asset_name || "-"}</div>
                            <div className="truncate text-xs text-slate-500">{asset.asset_id || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[14rem] whitespace-normal px-4 text-sm text-slate-600">
                          {[asset.asset_class, asset.asset_type].filter(Boolean).join(" / ") || "-"}
                        </TableCell>
                        <TableCell className="max-w-[14rem] truncate px-4 text-sm text-slate-600">
                          {asset.org_node_name || "-"}
                        </TableCell>
                        <TableCell className="px-4 text-sm text-slate-600">{asset.asset_status || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-slate-200 pt-4 sm:items-center">
          <div className="mr-auto text-sm text-slate-500">
            {selectedIds.size} asset{selectedIds.size === 1 ? "" : "s"} selected
          </div>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} disabled={saving || selectedIds.size === 0}>
            {saving ? "Adding..." : "Add Selected Assets"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
