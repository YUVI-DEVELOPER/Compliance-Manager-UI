import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";

import {
  AssetInventoryReportQuery,
  AssetInventoryReportResult,
  AssetInventoryReportRow,
  AssetReportScope,
  getAssetInventoryReport,
} from "../../../services/asset.service";
import { getOrgTree, OrgNode } from "../../../services/org.service";
import { LookupOption } from "../../services/lookupValue.service";
import {
  getAssetCategories,
  getAssetClasses,
  getAssetStatuses,
  getAssetTypes,
  getCriticalities,
} from "../../services/lookupOption.service";
import {
  filterAllowedAssetStatusOptions,
  flattenOrgTreeOptions,
} from "../../components/assets/assetForm.shared";
import { AssetInventoryReportTable } from "../../components/assets/AssetInventoryReportTable";
import { downloadCsv } from "../../components/importExport/csv";
import { CommonPageHeader } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Pagination } from "../../components/ui/table";

interface ReportFilterState {
  scope: AssetReportScope;
  org_id: string;
  q: string;
  lifecycle_state: string;
  asset_class: string;
  asset_category: string;
}

const PAGE_SIZE = 15;

const DEFAULT_FILTERS: ReportFilterState = {
  scope: "enterprise",
  org_id: "",
  q: "",
  lifecycle_state: "",
  asset_class: "",
  asset_category: "",
};

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-input-background px-3 py-1 text-sm text-slate-900 outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const findLookupLabel = (options: LookupOption[], code?: string | null): string => {
  if (!code) return "-";
  const match = options.find((option) => option.code === code);
  return match?.value ?? code;
};

const buildQuery = (filters: ReportFilterState): AssetInventoryReportQuery => ({
  scope: filters.scope,
  ...(filters.scope === "unit" && filters.org_id ? { org_id: filters.org_id } : {}),
  ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
  ...(filters.lifecycle_state ? { lifecycle_state: filters.lifecycle_state } : {}),
  ...(filters.asset_class ? { asset_class: filters.asset_class } : {}),
  ...(filters.asset_category ? { asset_category: filters.asset_category } : {}),
});

const toFilenameSegment = (value?: string | null): string =>
  (value ?? "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "report";

export function AssetInventoryReportingPage() {
  const header = getPageHeaderConfig("reports");
  const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
  const [assetClasses, setAssetClasses] = useState<LookupOption[]>([]);
  const [assetCategories, setAssetCategories] = useState<LookupOption[]>([]);
  const [assetTypes, setAssetTypes] = useState<LookupOption[]>([]);
  const [assetStatuses, setAssetStatuses] = useState<LookupOption[]>([]);
  const [criticalities, setCriticalities] = useState<LookupOption[]>([]);
  const [draftFilters, setDraftFilters] = useState<ReportFilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilterState>(DEFAULT_FILTERS);
  const [report, setReport] = useState<AssetInventoryReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [dependenciesLoading, setDependenciesLoading] = useState(true);
  const [page, setPage] = useState(1);

  const orgOptions = useMemo(() => flattenOrgTreeOptions(orgTree), [orgTree]);

  const loadDependencies = useCallback(async () => {
    setDependenciesLoading(true);
    try {
      const [orgs, classes, categories, types, statuses, crits] = await Promise.all([
        getOrgTree(),
        getAssetClasses(),
        getAssetCategories(),
        getAssetTypes(),
        getAssetStatuses(),
        getCriticalities(),
      ]);
      setOrgTree(orgs);
      setAssetClasses(classes);
      setAssetCategories(categories);
      setAssetTypes(types);
      setAssetStatuses(filterAllowedAssetStatusOptions(statuses));
      setCriticalities(crits);
    } catch (error) {
      console.error("Failed to load report dependencies:", error);
      toast.error("Failed to load reporting filters");
    } finally {
      setDependenciesLoading(false);
    }
  }, []);

  const runReport = useCallback(async (filters: ReportFilterState) => {
    if (filters.scope === "unit" && !filters.org_id) {
      toast.error("Select an organization unit to run a unit-level report");
      return;
    }

    setLoading(true);
    try {
      const data = await getAssetInventoryReport(buildQuery(filters));
      setReport(data);
      setAppliedFilters(filters);
      setPage(1);
    } catch (error) {
      console.error("Failed to run asset inventory report:", error);
      toast.error("Failed to run asset inventory report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadDependencies(), runReport(DEFAULT_FILTERS)]);
  }, [loadDependencies, runReport]);

  const totalRows = report?.items.length ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRows / PAGE_SIZE)), [totalRows]);
  const paginatedRows = useMemo(() => {
    const rows = report?.items ?? [];
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [page, report?.items]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const scopeSummary = report?.scope === "unit"
    ? `${report.org_name ?? "Selected unit"}${report?.includes_descendants ? " and descendants" : ""}`
    : "All visible organizations";

  const headerStats = buildPageHeaderStats(header.stats, {
    rows: report?.total ?? 0,
    scope: report?.scope === "unit" ? "Unit" : "Enterprise",
    unit: scopeSummary,
  });

  const handleRunReport = () => {
    void runReport(draftFilters);
  };

  const handleResetFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    void runReport(DEFAULT_FILTERS);
  };

  const handleRefresh = () => {
    void runReport(appliedFilters);
  };

  const handleExport = () => {
    if (!report || report.items.length === 0) return;

    const headers = [
      "Asset ID",
      "Asset Name",
      "Asset Class",
      "Asset Category",
      "Asset Type",
      "Organization Unit",
      "Unit Code",
      "Supplier",
      "Owner",
      "Lifecycle State",
      "Criticality",
      "Serial Number",
      "Tag Number",
      "Legacy ID",
      "Manufacturer",
      "Model",
    ];

    const rows = report.items.map((item: AssetInventoryReportRow) => [
      item.asset_id ?? "",
      item.asset_name ?? "",
      findLookupLabel(assetClasses, item.asset_class),
      findLookupLabel(assetCategories, item.asset_category),
      findLookupLabel(assetTypes, item.asset_type),
      item.org_node_name ?? "",
      item.org_node_code ?? "",
      item.supplier_name ?? "",
      item.asset_owner ?? "",
      findLookupLabel(assetStatuses, item.lifecycle_state),
      findLookupLabel(criticalities, item.criticality_class),
      item.serial_number ?? "",
      item.tag_number ?? "",
      item.legacy_id ?? "",
      item.manufacturer ?? "",
      item.model ?? "",
    ]);

    const scopeSegment = report.scope === "unit" ? toFilenameSegment(report.org_name ?? "unit") : "enterprise";
    downloadCsv(
      `asset-inventory-report-${scopeSegment}-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    );
  };

  const emptyMessage = appliedFilters.scope === "unit"
    ? "No assets matched the selected unit scope and report filters."
    : "No assets matched the current inventory report filters.";

  return (
    <div className="space-y-4">
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={header.subtitle}
        stats={headerStats}
        secondaryActions={[
          {
            ...(header.secondaryActions?.[0] ?? { key: "refresh", label: "Refresh", variant: "secondary" }),
            onClick: handleRefresh,
            disabled: loading,
          },
          {
            ...(header.secondaryActions?.[1] ?? { key: "export", label: "Export CSV", variant: "secondary" }),
            onClick: handleExport,
            disabled: !report || report.items.length === 0 || loading,
          },
        ]}
      />

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Report Controls</h2>
          <p className="mt-1 text-sm text-slate-500">
            Run the inventory report at enterprise level or for a selected reporting unit. Unit scope includes the selected
            organization and its descendants.
          </p>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Reporting Scope</label>
              <select
                value={draftFilters.scope}
                onChange={(event) => {
                  const nextScope = event.target.value as AssetReportScope;
                  setDraftFilters((current) => ({
                    ...current,
                    scope: nextScope,
                    org_id: nextScope === "enterprise" ? "" : current.org_id,
                  }));
                }}
                className={selectClassName}
                disabled={dependenciesLoading || loading}
              >
                <option value="enterprise">Enterprise</option>
                <option value="unit">Unit</option>
              </select>
            </div>

            {draftFilters.scope === "unit" && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Organization Unit</label>
                <select
                  value={draftFilters.org_id}
                  onChange={(event) => setDraftFilters((current) => ({ ...current, org_id: event.target.value }))}
                  className={selectClassName}
                  disabled={dependenciesLoading || loading}
                >
                  <option value="">Select unit</option>
                  {orgOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <Input
              label="Search"
              placeholder="Asset ID, name, owner, supplier, or unit"
              value={draftFilters.q}
              onChange={(event) => setDraftFilters((current) => ({ ...current, q: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleRunReport();
                }
              }}
              disabled={loading}
            />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Lifecycle State</label>
              <select
                value={draftFilters.lifecycle_state}
                onChange={(event) => setDraftFilters((current) => ({ ...current, lifecycle_state: event.target.value }))}
                className={selectClassName}
                disabled={dependenciesLoading || loading}
              >
                <option value="">All lifecycle states</option>
                {assetStatuses.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.value}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Asset Class</label>
              <select
                value={draftFilters.asset_class}
                onChange={(event) => setDraftFilters((current) => ({ ...current, asset_class: event.target.value }))}
                className={selectClassName}
                disabled={dependenciesLoading || loading}
              >
                <option value="">All asset classes</option>
                {assetClasses.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.value}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Asset Category</label>
              <select
                value={draftFilters.asset_category}
                onChange={(event) => setDraftFilters((current) => ({ ...current, asset_category: event.target.value }))}
                className={selectClassName}
                disabled={dependenciesLoading || loading}
              >
                <option value="">All asset categories</option>
                {assetCategories.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="text-sm text-slate-500">
              Current applied scope: <span className="font-medium text-slate-700">{scopeSummary}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleResetFilters} disabled={loading}>
                Reset
              </Button>
              <Button onClick={handleRunReport} disabled={loading || dependenciesLoading}>
                {loading ? "Running..." : "Run Report"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-col gap-3 px-1 xl:flex-row xl:items-center xl:justify-between">
          <div className="text-sm text-slate-600">
            Showing <span className="font-medium text-slate-900">{report?.total ?? 0}</span> asset inventory rows for{" "}
            <span className="font-medium text-slate-900">{scopeSummary}</span>.
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </div>

        <AssetInventoryReportTable
          rows={paginatedRows}
          loading={loading}
          emptyMessage={emptyMessage}
          assetClasses={assetClasses}
          assetCategories={assetCategories}
          assetTypes={assetTypes}
          assetStatuses={assetStatuses}
          criticalities={criticalities}
        />
      </section>

      <Toaster position="top-right" richColors />
    </div>
  );
}

