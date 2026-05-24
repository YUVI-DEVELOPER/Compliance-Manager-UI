import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Play, RefreshCw, RotateCcw, SlidersHorizontal } from "lucide-react";
import { toast, Toaster } from "sonner";

import { PermissionGuard } from "../../auth/PermissionGuard";
import {
  type AssetInventoryReportQuery,
  type AssetInventoryReportResult,
  type AssetInventoryReportRow,
  type AssetReportScope,
  getAssetInventoryReport,
} from "../../../services/asset.service";
import { getOrgTree, type OrgNode } from "../../../services/org.service";
import { type LookupOption } from "../../services/lookupValue.service";
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
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { EmptyState } from "../../components/foundation";
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
  asset_type: string;
  criticality_class: string;
}

const PAGE_SIZE = 15;

const DEFAULT_FILTERS: ReportFilterState = {
  scope: "enterprise",
  org_id: "",
  q: "",
  lifecycle_state: "",
  asset_class: "",
  asset_category: "",
  asset_type: "",
  criticality_class: "",
};

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm text-slate-900 outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

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

const isInactiveAsset = (row: AssetInventoryReportRow, statusOptions: LookupOption[]): boolean => {
  const label = findLookupLabel(statusOptions, row.lifecycle_state);
  const value = `${row.lifecycle_state ?? ""} ${label}`.toLowerCase();
  return value.includes("inactive") || value.includes("retired") || value.includes("decommission");
};

const isActiveAsset = (row: AssetInventoryReportRow, statusOptions: LookupOption[]): boolean => {
  if (isInactiveAsset(row, statusOptions)) return false;
  const label = findLookupLabel(statusOptions, row.lifecycle_state);
  const value = `${row.lifecycle_state ?? ""} ${label}`.toLowerCase();
  return value.includes("active") || value.includes("commission") || value.includes("in service");
};

const isCriticalAsset = (row: AssetInventoryReportRow, criticalities: LookupOption[]): boolean => {
  const label = findLookupLabel(criticalities, row.criticality_class);
  return `${row.criticality_class ?? ""} ${label}`.toLowerCase().includes("critical");
};

const applyClientFilters = (rows: AssetInventoryReportRow[], filters: ReportFilterState): AssetInventoryReportRow[] =>
  rows.filter((row) => {
    if (filters.asset_type && row.asset_type !== filters.asset_type) return false;
    if (filters.criticality_class && row.criticality_class !== filters.criticality_class) return false;
    return true;
  });

const hasDraftChanges = (draft: ReportFilterState, applied: ReportFilterState): boolean =>
  Object.keys(DEFAULT_FILTERS).some((key) => draft[key as keyof ReportFilterState] !== applied[key as keyof ReportFilterState]);

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
  const [reportError, setReportError] = useState<string | null>(null);
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
    setReportError(null);
    try {
      const data = await getAssetInventoryReport(buildQuery(filters));
      setReport(data);
      setAppliedFilters(filters);
      setPage(1);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to run asset inventory report";
      setReportError(message);
      setReport(null);
      toast.error("Failed to run asset inventory report");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadDependencies(), runReport(DEFAULT_FILTERS)]);
  }, [loadDependencies, runReport]);

  const visibleRows = useMemo(
    () => applyClientFilters(report?.items ?? [], appliedFilters),
    [appliedFilters, report?.items],
  );

  const totalRows = visibleRows.length;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRows / PAGE_SIZE)), [totalRows]);
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [page, visibleRows]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const scopeSummary = report?.scope === "unit"
    ? `${report.org_name ?? "Selected unit"}${report.includes_descendants ? " and descendants" : ""}`
    : "All visible organizations";

  const activeCount = useMemo(
    () => visibleRows.filter((row) => isActiveAsset(row, assetStatuses)).length,
    [assetStatuses, visibleRows],
  );
  const inactiveCount = useMemo(
    () => visibleRows.filter((row) => isInactiveAsset(row, assetStatuses)).length,
    [assetStatuses, visibleRows],
  );
  const criticalCount = useMemo(
    () => visibleRows.filter((row) => isCriticalAsset(row, criticalities)).length,
    [criticalities, visibleRows],
  );

  const appliedFilterLabels = useMemo(() => {
    const labels: string[] = [];
    labels.push(appliedFilters.scope === "unit" ? `Unit: ${scopeSummary}` : "Enterprise");
    if (appliedFilters.q.trim()) labels.push(`Search: ${appliedFilters.q.trim()}`);
    if (appliedFilters.lifecycle_state) labels.push(`Status: ${findLookupLabel(assetStatuses, appliedFilters.lifecycle_state)}`);
    if (appliedFilters.asset_class) labels.push(`Class: ${findLookupLabel(assetClasses, appliedFilters.asset_class)}`);
    if (appliedFilters.asset_category) labels.push(`Category: ${findLookupLabel(assetCategories, appliedFilters.asset_category)}`);
    if (appliedFilters.asset_type) labels.push(`Type: ${findLookupLabel(assetTypes, appliedFilters.asset_type)}`);
    if (appliedFilters.criticality_class) labels.push(`Criticality: ${findLookupLabel(criticalities, appliedFilters.criticality_class)}`);
    return labels;
  }, [appliedFilters, assetCategories, assetClasses, assetStatuses, assetTypes, criticalities, scopeSummary]);

  const handleRunReport = () => {
    void runReport(draftFilters);
  };

  const handleClearFilters = () => {
    setDraftFilters(DEFAULT_FILTERS);
    void runReport(DEFAULT_FILTERS);
  };

  const handleRefresh = () => {
    void runReport(appliedFilters);
  };

  const handleExport = () => {
    if (!report || visibleRows.length === 0) return;

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
      "Commission Date",
      "Purchase Date",
    ];

    const rows = visibleRows.map((item: AssetInventoryReportRow) => [
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
      item.asset_commission_dt ?? "",
      item.asset_purchase_dt ?? "",
    ]);

    const scopeSegment = report.scope === "unit" ? toFilenameSegment(report.org_name ?? "unit") : "enterprise";
    downloadCsv(
      `asset-inventory-report-${scopeSegment}-${new Date().toISOString().slice(0, 10)}.csv`,
      headers,
      rows,
    );
  };

  const emptyMessage = appliedFilters.scope === "unit"
    ? "No assets found for the selected organization scope and filters."
    : "No assets found for the selected report filters.";

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Asset Inventory Report"
        subtitle="Generate asset inventory reports by organization, class, category, status, and date range"
        secondaryActions={[
          {
            ...(header.secondaryActions?.[0] ?? { key: "refresh", label: "Refresh", variant: "secondary" }),
            onClick: handleRefresh,
            disabled: loading,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="self-start rounded-lg border border-slate-200 bg-white shadow-sm xl:sticky xl:top-4">
            <div className="border-b border-slate-200 px-4 py-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-semibold text-slate-900">Report Filters</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">Choose the scope and asset attributes, then run the report.</p>
            </div>

            <div className="space-y-4 p-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Org Scope</label>
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
                  <option value="unit">Organization Unit</option>
                </select>
              </div>

              {draftFilters.scope === "unit" ? (
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
              ) : null}

              <Input
                label="Asset Search"
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
                className="h-10"
              />

              <FilterSelect
                label="Asset Status"
                value={draftFilters.lifecycle_state}
                onChange={(value) => setDraftFilters((current) => ({ ...current, lifecycle_state: value }))}
                disabled={dependenciesLoading || loading}
                options={assetStatuses}
                emptyLabel="All statuses"
              />

              <FilterSelect
                label="Asset Class"
                value={draftFilters.asset_class}
                onChange={(value) => setDraftFilters((current) => ({ ...current, asset_class: value }))}
                disabled={dependenciesLoading || loading}
                options={assetClasses}
                emptyLabel="All classes"
              />

              <FilterSelect
                label="Asset Category"
                value={draftFilters.asset_category}
                onChange={(value) => setDraftFilters((current) => ({ ...current, asset_category: value }))}
                disabled={dependenciesLoading || loading}
                options={assetCategories}
                emptyLabel="All categories"
              />

              <FilterSelect
                label="Asset Type"
                value={draftFilters.asset_type}
                onChange={(value) => setDraftFilters((current) => ({ ...current, asset_type: value }))}
                disabled={dependenciesLoading || loading}
                options={assetTypes}
                emptyLabel="All types"
              />

              <FilterSelect
                label="Criticality"
                value={draftFilters.criticality_class}
                onChange={(value) => setDraftFilters((current) => ({ ...current, criticality_class: value }))}
                disabled={dependenciesLoading || loading}
                options={criticalities}
                emptyLabel="All criticalities"
              />
            </div>

            <div className="border-t border-slate-200 p-4">
              <div className="grid gap-2">
                <Button type="button" onClick={handleRunReport} disabled={loading || dependenciesLoading} fullWidth>
                  <Play className="h-4 w-4" />
                  {loading ? "Running..." : "Run Report"}
                </Button>
                <Button type="button" variant="outline" onClick={handleClearFilters} disabled={loading} fullWidth>
                  <RotateCcw className="h-4 w-4" />
                  Clear Filters
                </Button>
              </div>
            </div>
          </aside>

          <section className="min-w-0 space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Live Report</div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">{scopeSummary}</h2>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {appliedFilterLabels.map((label) => (
                      <span key={label} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">
                        {label}
                      </span>
                    ))}
                    {hasDraftChanges(draftFilters, appliedFilters) ? (
                      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        Unsaved filter changes
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" onClick={handleRefresh} disabled={loading}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                  <PermissionGuard permission="REPORT_EXPORT">
                    <Button type="button" onClick={handleExport} disabled={!report || visibleRows.length === 0 || loading}>
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </PermissionGuard>
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
                <KpiCard label="Total assets" value={report?.total ?? 0} />
                <KpiCard label="Active assets" value={activeCount} />
                <KpiCard label="Inactive assets" value={inactiveCount} />
                <KpiCard label="Critical assets" value={criticalCount} />
                <KpiCard label="Filtered count" value={visibleRows.length} />
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-900">{visibleRows.length}</span> current report rows.
                  <span className="ml-2 text-xs text-slate-500">Exports current report data.</span>
                </div>
                {visibleRows.length > 0 ? (
                  <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                ) : null}
              </div>

              <div className="p-4">
                {loading ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-500">
                    Running asset inventory report...
                  </div>
                ) : reportError ? (
                  <EmptyState
                    title="Error loading report"
                    description={reportError}
                    action={<Button type="button" onClick={handleRunReport}>Run Report</Button>}
                  />
                ) : !report ? (
                  <EmptyState
                    title="No report generated yet"
                    description="Run the report to load asset inventory rows."
                    action={<Button type="button" onClick={handleRunReport}>Run Report</Button>}
                  />
                ) : visibleRows.length === 0 ? (
                  <EmptyState title={emptyMessage} description="Adjust the filters and run the report again." />
                ) : (
                  <AssetInventoryReportTable
                    rows={paginatedRows}
                    assetClasses={assetClasses}
                    assetCategories={assetCategories}
                    assetTypes={assetTypes}
                    assetStatuses={assetStatuses}
                    criticalities={criticalities}
                  />
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: LookupOption[];
  emptyLabel: string;
}

function FilterSelect({ label, value, onChange, disabled = false, options, emptyLabel }: FilterSelectProps) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
        disabled={disabled}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.value}
          </option>
        ))}
      </select>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
