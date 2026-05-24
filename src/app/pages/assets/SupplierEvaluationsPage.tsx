import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";

import { AssetRecord, getAssets } from "../../../services/asset.service";
import { getReleasesByAssetId, ReleaseRecord } from "../../../services/release.service";
import { getSuppliers, SupplierRecord } from "../../../services/supplier.service";
import {
  getSupplierEvaluations,
  SupplierEvaluationRecord,
} from "../../../services/supplier-evaluation.service";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { SupplierEvaluationEditorModal } from "../../components/assets/SupplierEvaluationEditorModal";
import { SupplierEvaluationWorkspaceModal } from "../../components/assets/SupplierEvaluationWorkspaceModal";
import {
  canEditEvaluation,
  formatEvaluationDate,
  formatSupplierEvaluationStatus,
  getSupplierEvaluationStatusBadgeClass,
  mapSupplierEvaluationAxiosError,
} from "../../components/assets/supplierEvaluationForm.shared";
import { loadOmsSourceSystemOptions } from "../../components/assets/documentLinkForm.shared";
import { LookupOption } from "../../services/lookupValue.service";

const normalize = (value?: string | null): string => (value ?? "").trim();

const getInitialAssetFilter = (): string => {
  if (typeof window === "undefined") return "ALL";
  return new URLSearchParams(window.location.search).get("asset_id") || "ALL";
};

const updateAssetQueryParam = (assetId: string) => {
  const url = new URL(window.location.href);
  url.pathname = "/supplier-evaluations";
  if (assetId === "ALL") {
    url.searchParams.delete("asset_id");
  } else {
    url.searchParams.set("asset_id", assetId);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
};

const findAssetByToken = (assets: AssetRecord[], token: string): AssetRecord | null => {
  if (!token || token === "ALL") return null;
  return assets.find((asset) => asset.asset_uuid === token || asset.asset_id === token) ?? null;
};

const getEvaluationSortValue = (evaluation: SupplierEvaluationRecord): number => {
  const parsed = Date.parse(evaluation.modified_dt || evaluation.created_dt || evaluation.opened_at || "");
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function SupplierEvaluationsPage() {
  const header = getPageHeaderConfig("supplier-evaluations");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [sourceSystemOptions, setSourceSystemOptions] = useState<LookupOption[]>([]);
  const [evaluations, setEvaluations] = useState<SupplierEvaluationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState(getInitialAssetFilter);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<SupplierEvaluationRecord | null>(null);
  const [editorAsset, setEditorAsset] = useState<AssetRecord | null>(null);
  const [editorReleases, setEditorReleases] = useState<ReleaseRecord[]>([]);
  const [workspaceEvaluationId, setWorkspaceEvaluationId] = useState<string | null>(null);

  const selectedAsset = useMemo(() => findAssetByToken(assets, assetFilter), [assetFilter, assets]);
  const assetByUuid = useMemo(() => new Map(assets.map((asset) => [asset.asset_uuid, asset])), [assets]);

  const loadEditorReleases = useCallback(async (asset: AssetRecord | null) => {
    if (!asset?.asset_uuid) {
      setEditorReleases([]);
      return;
    }

    try {
      setEditorReleases(await getReleasesByAssetId(asset.asset_uuid));
    } catch (error) {
      console.error("Failed to load releases for supplier evaluation editor:", error);
      toast.error("Failed to load release options");
      setEditorReleases([]);
    }
  }, []);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const [assetData, supplierData, sourceOptions] = await Promise.all([
        getAssets(),
        getSuppliers(),
        loadOmsSourceSystemOptions(),
      ]);
      const scopedAsset = findAssetByToken(assetData, assetFilter);
      const data = await getSupplierEvaluations(scopedAsset ? { asset_uuid: scopedAsset.asset_uuid } : {});

      setAssets(assetData);
      setSuppliers(supplierData);
      setSourceSystemOptions(sourceOptions);
      setEvaluations([...data].sort((left, right) => getEvaluationSortValue(right) - getEvaluationSortValue(left)));
      if (scopedAsset && scopedAsset.asset_uuid !== assetFilter) {
        setAssetFilter(scopedAsset.asset_uuid);
        updateAssetQueryParam(scopedAsset.asset_uuid);
      }
    } catch (error) {
      console.error("Failed to load supplier evaluations:", error);
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setLoading(false);
    }
  }, [assetFilter]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const filteredEvaluations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return evaluations.filter((evaluation) => {
      if (statusFilter !== "ALL" && evaluation.status !== statusFilter) return false;
      if (!query) return true;
      const asset = assetByUuid.get(evaluation.asset_uuid);

      return [
        evaluation.evaluation_name,
        evaluation.status,
        evaluation.urs_title,
        evaluation.urs_release_version,
        evaluation.asset_code,
        evaluation.asset_name,
        asset?.asset_id,
        asset?.asset_name,
      ]
        .map((value) => normalize(value).toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [assetByUuid, evaluations, search, statusFilter]);

  const headerStats = buildPageHeaderStats(header.stats, {
    evaluations: filteredEvaluations.length,
    draft: filteredEvaluations.filter((evaluation) => evaluation.status === "DRAFT").length,
    open: filteredEvaluations.filter((evaluation) => evaluation.status === "OPEN_FOR_RESPONSE").length,
    locked: filteredEvaluations.filter((evaluation) => evaluation.status === "LOCKED" || evaluation.status === "CLOSED").length,
  });

  const handleAssetFilterChange = (value: string) => {
    setAssetFilter(value);
    updateAssetQueryParam(value);
  };

  const openCreate = async () => {
    if (!selectedAsset) return;
    setEditingEvaluation(null);
    setEditorAsset(selectedAsset);
    await loadEditorReleases(selectedAsset);
    setEditorOpen(true);
  };

  const openEdit = async (evaluation: SupplierEvaluationRecord) => {
    const asset = assetByUuid.get(evaluation.asset_uuid) ?? null;
    setEditingEvaluation(evaluation);
    setEditorAsset(asset);
    await loadEditorReleases(asset);
    setEditorOpen(true);
  };

  const handleSaved = async () => {
    await loadPage();
    setEditorOpen(false);
    setEditingEvaluation(null);
  };

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={header.subtitle}
        search={{
          value: search,
          placeholder: header.searchPlaceholder || "Search supplier evaluations...",
          onChange: setSearch,
          onClear: () => setSearch(""),
          disabled: loading,
        }}
        stats={headerStats}
        primaryAction={{
          ...(header.primaryAction ?? { key: "new-evaluation", label: "New Evaluation", icon: "plus" }),
          onClick: () => void openCreate(),
          disabled: loading || !selectedAsset,
        }}
        secondaryActions={[
          {
            ...(header.secondaryActions?.[0] ?? { key: "refresh", label: "Refresh", icon: "refresh", variant: "secondary" }),
            label: loading ? "Loading" : "Refresh",
            onClick: () => void loadPage(),
            disabled: loading,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Supplier Evaluation Workflows</p>
              <p className="mt-1 text-xs text-slate-500">Create, edit, score, lock, and close evaluations by Asset ID.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span>Asset</span>
                <select
                  value={assetFilter}
                  onChange={(event) => handleAssetFilterChange(event.target.value)}
                  className="h-9 min-w-52 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  disabled={loading}
                >
                  <option value="ALL">All assets</option>
                  {assets.map((asset) => (
                    <option key={asset.asset_uuid} value={asset.asset_uuid}>
                      {asset.asset_id} | {asset.asset_name || "Unnamed asset"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-9 min-w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  disabled={loading}
                >
                  <option value="ALL">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="OPEN_FOR_RESPONSE">Open for Response</option>
                  <option value="LOCKED">Locked</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </label>
            </div>
          </div>

          {!selectedAsset ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              Select an asset to create a new evaluation. Existing evaluations remain visible in the table.
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-white">
                  <TableHead className="min-w-[16rem] font-semibold">Evaluation</TableHead>
                  <TableHead className="min-w-[15rem] font-semibold">Asset</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="min-w-[18rem] font-semibold">URS</TableHead>
                  <TableHead className="font-semibold">Suppliers</TableHead>
                  <TableHead className="font-semibold">Submitted</TableHead>
                  <TableHead className="font-semibold">Updated</TableHead>
                  <TableHead className="min-w-[12rem] font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                      Loading supplier evaluations...
                    </TableCell>
                  </TableRow>
                ) : filteredEvaluations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-slate-500">
                      No supplier evaluations match the current view.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvaluations.map((evaluation) => {
                    const asset = assetByUuid.get(evaluation.asset_uuid);
                    return (
                      <TableRow key={evaluation.evaluation_id} className="hover:bg-slate-50">
                        <TableCell className="align-top">
                          <div className="font-medium text-slate-900">{evaluation.evaluation_name || "-"}</div>
                          <p className="mt-1 text-xs text-slate-500">ID: {evaluation.evaluation_id}</p>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="font-medium text-slate-900">{asset?.asset_name || evaluation.asset_name || "-"}</div>
                          <p className="mt-1 text-xs text-slate-500">{asset?.asset_id || evaluation.asset_code || evaluation.asset_uuid}</p>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className={getSupplierEvaluationStatusBadgeClass(evaluation.status)}>
                            {formatSupplierEvaluationStatus(evaluation.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="max-w-[22rem] break-words font-medium leading-5 text-slate-900">
                            {evaluation.urs_title || "-"}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {evaluation.urs_release_version ? `Release ${evaluation.urs_release_version}` : "Asset-level URS"}
                          </p>
                        </TableCell>
                        <TableCell className="align-top text-slate-700">{evaluation.response_count}</TableCell>
                        <TableCell className="align-top text-slate-700">
                          {evaluation.submitted_response_count} / {evaluation.response_count}
                        </TableCell>
                        <TableCell className="align-top text-slate-600">
                          {formatEvaluationDate(evaluation.modified_dt || evaluation.created_dt)}
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="ghost" size="sm" onClick={() => setWorkspaceEvaluationId(evaluation.evaluation_id)}>
                              Workspace
                            </Button>
                            {canEditEvaluation(evaluation.status) ? (
                              <Button type="button" variant="outline" size="sm" onClick={() => void openEdit(evaluation)}>
                                Edit
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <SupplierEvaluationEditorModal
        open={editorOpen}
        assetId={editorAsset?.asset_uuid ?? selectedAsset?.asset_uuid ?? null}
        assetName={editorAsset?.asset_name ?? selectedAsset?.asset_name ?? null}
        assetCode={editorAsset?.asset_id ?? selectedAsset?.asset_id ?? null}
        suppliers={suppliers}
        releases={editorReleases}
        evaluation={editingEvaluation}
        onClose={() => {
          setEditorOpen(false);
          setEditingEvaluation(null);
        }}
        onSaved={handleSaved}
      />

      <SupplierEvaluationWorkspaceModal
        open={Boolean(workspaceEvaluationId)}
        evaluationId={workspaceEvaluationId}
        suppliers={suppliers}
        sourceSystemOptions={sourceSystemOptions}
        onClose={() => setWorkspaceEvaluationId(null)}
        onChanged={loadPage}
      />

      <Toaster position="top-right" richColors />
    </div>
  );
}
