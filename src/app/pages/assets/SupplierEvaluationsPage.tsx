import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast, Toaster } from "sonner";

import { AssetRecord, getAssets } from "../../../services/asset.service";
import { getSuppliers, SupplierRecord } from "../../../services/supplier.service";
import {
  getSupplierEvaluationRequirements,
  getSupplierEvaluations,
  SupplierEvaluationRecord,
} from "../../../services/supplier-evaluation.service";
import { PermissionGuard } from "../../auth/PermissionGuard";
import { useAuth } from "../../auth/useAuth";
import { SupplierEvaluationSetupPanel } from "../../components/assets/SupplierEvaluationSetupPanel";
import { SupplierEvaluationWorkspace } from "../../components/assets/SupplierEvaluationWorkspace";
import {
  formatEvaluationDate,
  formatSupplierEvaluationStatus,
  getSupplierEvaluationStatusBadgeClass,
  mapSupplierEvaluationAxiosError,
} from "../../components/assets/supplierEvaluationForm.shared";
import { loadOmsSourceSystemOptions } from "../../components/assets/documentLinkForm.shared";
import { EmptyState, FilterBar, SearchableCombobox, StatusBadge } from "../../components/foundation";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { SearchInput } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { LookupOption } from "../../services/lookupValue.service";

type StatusFilter = "ALL" | "DRAFT" | "OPEN_FOR_RESPONSE" | "LOCKED" | "CLOSED";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN_FOR_RESPONSE", label: "Open for Response" },
  { value: "LOCKED", label: "Locked" },
  { value: "CLOSED", label: "Closed" },
];

const normalize = (value?: string | null): string => (value ?? "").trim();

const getInitialAssetFilter = (): string => {
  if (typeof window === "undefined") return "ALL";
  return new URLSearchParams(window.location.search).get("asset_id") || "ALL";
};

const getInitialWorkspaceEvaluationId = (): string | null => {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("evaluation_id");
};

const updateSupplierEvaluationQuery = (assetId: string, evaluationId?: string | null) => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.pathname = "/supplier-evaluations";
  if (assetId === "ALL") {
    url.searchParams.delete("asset_id");
  } else {
    url.searchParams.set("asset_id", assetId);
  }
  if (evaluationId) {
    url.searchParams.set("evaluation_id", evaluationId);
  } else {
    url.searchParams.delete("evaluation_id");
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

function EvaluationStatusBadge({ status }: { status?: string | null }) {
  const kind = status === "CLOSED" ? "inactive" : status === "LOCKED" || status === "DRAFT" ? "pending" : "active";
  return (
    <span className="inline-flex items-center gap-2">
      <StatusBadge status={kind} title={formatSupplierEvaluationStatus(status)} />
      <Badge variant="outline" className={getSupplierEvaluationStatusBadgeClass(status)}>
        {formatSupplierEvaluationStatus(status)}
      </Badge>
    </span>
  );
}

export function SupplierEvaluationsPage() {
  const header = getPageHeaderConfig("supplier-evaluations");
  const { hasPermission } = useAuth();
  const canCreateEvaluation = hasPermission("ASSET_CREATE");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [sourceSystemOptions, setSourceSystemOptions] = useState<LookupOption[]>([]);
  const [evaluations, setEvaluations] = useState<SupplierEvaluationRecord[]>([]);
  const [requirementCounts, setRequirementCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState(getInitialAssetFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [setupPanelMode, setSetupPanelMode] = useState<"create" | "edit" | null>(null);
  const [editingEvaluation, setEditingEvaluation] = useState<SupplierEvaluationRecord | null>(null);
  const [workspaceEvaluationId, setWorkspaceEvaluationId] = useState<string | null>(getInitialWorkspaceEvaluationId);

  const selectedAsset = useMemo(() => findAssetByToken(assets, assetFilter), [assetFilter, assets]);
  const assetByUuid = useMemo(() => new Map(assets.map((asset) => [asset.asset_uuid, asset])), [assets]);

  const loadRequirementCounts = useCallback(async (rows: SupplierEvaluationRecord[]) => {
    const results = await Promise.allSettled(
      rows.map(async (evaluation) => ({
        id: evaluation.evaluation_id,
        count: (await getSupplierEvaluationRequirements(evaluation.evaluation_id)).length,
      })),
    );
    const nextCounts: Record<string, number> = {};
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        nextCounts[result.value.id] = result.value.count;
      }
    });
    setRequirementCounts(nextCounts);
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
      const sortedData = [...data].sort((left, right) => getEvaluationSortValue(right) - getEvaluationSortValue(left));

      setAssets(assetData);
      setSuppliers(supplierData);
      setSourceSystemOptions(sourceOptions);
      setEvaluations(sortedData);
      if (scopedAsset && scopedAsset.asset_uuid !== assetFilter) {
        setAssetFilter(scopedAsset.asset_uuid);
        updateSupplierEvaluationQuery(scopedAsset.asset_uuid, workspaceEvaluationId);
      }
      void loadRequirementCounts(sortedData);
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setLoading(false);
    }
  }, [assetFilter, loadRequirementCounts, workspaceEvaluationId]);

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
        asset?.supplier_name,
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

  const assetOptions = useMemo(
    () =>
      assets.map((asset) => ({
        value: asset.asset_uuid,
        label: `${asset.asset_id} | ${asset.asset_name || "Unnamed asset"}`,
        description: [asset.asset_class, asset.asset_category, asset.supplier_name].filter(Boolean).join(" | "),
      })),
    [assets],
  );

  const activeFilters = useMemo(() => {
    const filters = [];
    if (search.trim()) {
      filters.push({
        key: "search",
        label: `Search: ${search.trim()}`,
        onRemove: () => setSearch(""),
      });
    }
    if (selectedAsset) {
      filters.push({
        key: "asset",
        label: `Asset: ${selectedAsset.asset_id}`,
        onRemove: () => handleAssetFilterChange("ALL"),
      });
    }
    if (statusFilter !== "ALL") {
      filters.push({
        key: "status",
        label: `Status: ${formatSupplierEvaluationStatus(statusFilter)}`,
        onRemove: () => setStatusFilter("ALL"),
      });
    }
    return filters;
  }, [search, selectedAsset, statusFilter]);

  const handleAssetFilterChange = (value: string) => {
    setAssetFilter(value);
    updateSupplierEvaluationQuery(value, workspaceEvaluationId);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    handleAssetFilterChange("ALL");
  };

  const openCreate = () => {
    setEditingEvaluation(null);
    setSetupPanelMode("create");
  };

  const openEdit = (evaluation: SupplierEvaluationRecord) => {
    setEditingEvaluation(evaluation);
    setSetupPanelMode("edit");
  };

  const openWorkspace = (evaluationId: string) => {
    setWorkspaceEvaluationId(evaluationId);
    updateSupplierEvaluationQuery(assetFilter, evaluationId);
  };

  const closeWorkspace = () => {
    setWorkspaceEvaluationId(null);
    updateSupplierEvaluationQuery(assetFilter, null);
  };

  if (workspaceEvaluationId) {
    return (
      <div className={PAGE_LAYOUT_SHELL_CLASS}>
        <div className={PAGE_CONTENT_CLASS}>
          <SupplierEvaluationWorkspace
            evaluationId={workspaceEvaluationId}
            suppliers={suppliers}
            sourceSystemOptions={sourceSystemOptions}
            onBack={closeWorkspace}
            onChanged={loadPage}
          />
        </div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel="Operations"
        title="Supplier Evaluations"
        subtitle="Manage supplier requirement responses, evidence, scoring, and closure"
        stats={headerStats}
        rightSlot={
          <PermissionGuard permission="ASSET_CREATE">
            <Button type="button" size="sm" onClick={openCreate} disabled={loading || !canCreateEvaluation}>
              <Plus className="h-4 w-4" />
              New Evaluation
            </Button>
          </PermissionGuard>
        }
        secondaryActions={[
          {
            key: "refresh",
            label: loading ? "Loading" : "Refresh",
            icon: "refresh",
            variant: "secondary",
            onClick: () => void loadPage(),
            disabled: loading,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <FilterBar activeFilters={activeFilters} onClearAll={clearFilters}>
          <div className="min-w-64 flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search by evaluation title, asset, release, supplier..."
              disabled={loading}
            />
          </div>
          <SearchableCombobox
            label="Asset"
            options={assetOptions}
            value={selectedAsset?.asset_uuid ?? null}
            onChange={(value) => handleAssetFilterChange(value ?? "ALL")}
            placeholder="All assets"
            emptyText="No assets found"
            disabled={loading}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <div className="flex flex-wrap gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
              {STATUS_FILTERS.map((status) => (
                <button
                  key={status.value}
                  type="button"
                  className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                    statusFilter === status.value
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-600 hover:bg-white"
                  }`}
                  onClick={() => setStatusFilter(status.value)}
                  disabled={loading}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>
        </FilterBar>

        {selectedAsset ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
            Viewing supplier evaluations for {selectedAsset.asset_name || selectedAsset.asset_id}
          </div>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Supplier Evaluation Register</h2>
              <p className="mt-1 text-xs text-slate-500">
                Track supplier requirement response, evidence, AI scoring, lock, and closure state outside Asset Master.
              </p>
            </div>
            <PermissionGuard permission="ASSET_CREATE">
              <Button type="button" variant="outline" size="sm" onClick={openCreate} disabled={loading}>
                <Plus className="h-4 w-4" />
                New Evaluation
              </Button>
            </PermissionGuard>
          </div>

          <Table className="min-w-[76rem]" containerClassName="max-h-none overflow-x-auto overflow-y-visible">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="min-w-[17rem] font-semibold">Evaluation Title</TableHead>
                <TableHead className="min-w-[15rem] font-semibold">Asset</TableHead>
                <TableHead className="min-w-[10rem] font-semibold">Release</TableHead>
                <TableHead className="min-w-[14rem] font-semibold">Supplier</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Requirements</TableHead>
                <TableHead className="font-semibold">Completion</TableHead>
                <TableHead className="font-semibold">Last Updated</TableHead>
                <TableHead className="min-w-[13rem] font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-slate-500">
                    Loading supplier evaluations...
                  </TableCell>
                </TableRow>
              ) : filteredEvaluations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="p-4">
                    <EmptyState
                      title={evaluations.length === 0 ? "No supplier evaluations" : "No supplier evaluation results"}
                      description={
                        evaluations.length === 0
                          ? "Create a supplier evaluation to begin response capture."
                          : "Adjust search, asset, or status filters."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvaluations.map((evaluation) => {
                  const asset = assetByUuid.get(evaluation.asset_uuid);
                  const requirementCount = requirementCounts[evaluation.evaluation_id];
                  return (
                    <TableRow key={evaluation.evaluation_id} className="hover:bg-slate-50">
                      <TableCell className="align-top whitespace-normal">
                        <div className="font-medium text-slate-900">{evaluation.evaluation_name || "-"}</div>
                        <p className="mt-1 text-xs text-slate-500">ID: {evaluation.evaluation_id}</p>
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <div className="font-medium text-slate-900">
                          {asset?.asset_name || evaluation.asset_name || "-"}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {asset?.asset_id || evaluation.asset_code || evaluation.asset_uuid}
                        </p>
                      </TableCell>
                      <TableCell className="align-top text-slate-700">
                        {evaluation.urs_release_version ? `Release ${evaluation.urs_release_version}` : "-"}
                      </TableCell>
                      <TableCell className="align-top whitespace-normal text-slate-700">
                        {asset?.supplier_name || "See workspace"}
                      </TableCell>
                      <TableCell className="align-top">
                        <EvaluationStatusBadge status={evaluation.status} />
                      </TableCell>
                      <TableCell className="align-top text-slate-700">{requirementCount ?? "-"}</TableCell>
                      <TableCell className="align-top text-slate-700">
                        {evaluation.submitted_response_count} / {evaluation.response_count}
                      </TableCell>
                      <TableCell className="align-top text-slate-600">
                        {formatEvaluationDate(evaluation.modified_dt || evaluation.created_dt)}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button type="button" variant="ghost" size="sm" onClick={() => openWorkspace(evaluation.evaluation_id)}>
                            Open Workspace
                          </Button>
                          {evaluation.status === "DRAFT" || evaluation.status === "OPEN_FOR_RESPONSE" ? (
                            <PermissionGuard permission="ASSET_UPDATE">
                              <Button type="button" variant="outline" size="sm" onClick={() => openEdit(evaluation)}>
                                Edit Setup
                              </Button>
                            </PermissionGuard>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </section>
      </div>

      <SupplierEvaluationSetupPanel
        open={Boolean(setupPanelMode)}
        mode={setupPanelMode ?? "create"}
        evaluation={editingEvaluation}
        initialAssetId={selectedAsset?.asset_uuid ?? null}
        assets={assets}
        suppliers={suppliers}
        onClose={() => {
          setSetupPanelMode(null);
          setEditingEvaluation(null);
        }}
        onSaved={async () => {
          await loadPage();
        }}
      />

      <Toaster position="top-right" richColors />
    </div>
  );
}
