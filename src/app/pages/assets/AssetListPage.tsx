import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { toast, Toaster } from "sonner";

import { AssetRecord, CreateAssetPayload, createAsset, deleteAsset, getAssets, searchAssets } from "../../../services/asset.service";
import { getOrgTree, OrgNode } from "../../../services/org.service";
import { getSuppliers, SupplierRecord } from "../../../services/supplier.service";
import { AssetDetailDrawer, AssetDetailTab } from "../../components/assets/AssetDetailDrawer";
import { AssetMasterWizardPanel } from "../../components/assets/AssetMasterWizardPanel";
import { AssetTable } from "../../components/assets/AssetTable";
import {
  buildOrgMap,
  filterAllowedAssetStatusOptions,
  flattenOrgTreeOptions,
} from "../../components/assets/assetForm.shared";
import { ConfirmStrip, EmptyState, FilterBar, SearchableCombobox, type ActiveFilter } from "../../components/foundation";
import { CsvImportModal } from "../../components/importExport/CsvImportModal";
import { downloadCsv } from "../../components/importExport/csv";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Pagination } from "../../components/ui/table";
import { PermissionGuard } from "../../auth/PermissionGuard";
import { useAuth } from "../../auth/useAuth";
import { useCurrentActor } from "../../auth/useCurrentActor";
import type { NavPage } from "../../auth/accessPolicy";
import {
  getAssetClassGlOptions,
  getAssetClasses,
  getAssetCategories,
  getAssetNatures,
  getAssetStatuses,
  getAssetSubCategories,
  getAssetTypes,
  getCriticalities,
  getCurrencies,
  getDepreciationMethods,
} from "../../services/lookupOption.service";
import { LookupOption } from "../../services/lookupValue.service";

interface AssetListPageProps {
  onNavigate?: (page: NavPage) => void;
}

type AssetPanelMode = "create" | "edit";

const PAGE_SIZE = 10;

const findLookupLabel = (options: LookupOption[], code?: string | null): string => {
  if (!code) return "-";
  const found = options.find((item) => item.code === code);
  return found?.value || code;
};

const toComboboxOptions = (options: LookupOption[]) =>
  options.map((option) => ({ value: option.code, label: option.value, description: option.code }));

const formatValue = (value?: number | null, currency?: string | null): string => {
  if (value === null || value === undefined) return "-";
  return currency ? `${currency} ${value.toLocaleString()}` : value.toLocaleString();
};

const parseCurrencyValue = (raw: string): number | undefined => {
  const normalized = raw.trim();
  if (!normalized) return undefined;
  const cleaned = normalized.replace(/[^0-9.\-]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
};

export function AssetListPage(_props: AssetListPageProps) {
  const header = getPageHeaderConfig("asset");
  const { hasPermission } = useAuth();
  const currentActor = useCurrentActor();
  const actorName = currentActor.auditName ?? currentActor.displayName;
  const canCreateAsset = hasPermission("ASSET_CREATE");
  const canUpdateAsset = hasPermission("ASSET_UPDATE");
  const canDeleteAsset = hasPermission("ASSET_DELETE");
  const canExportReport = hasPermission("REPORT_EXPORT");

  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [orgTree, setOrgTree] = useState<OrgNode[]>([]);
  const [supplierList, setSupplierList] = useState<SupplierRecord[]>([]);
  const [assetClasses, setAssetClasses] = useState<LookupOption[]>([]);
  const [assetCategories, setAssetCategories] = useState<LookupOption[]>([]);
  const [assetSubCategories, setAssetSubCategories] = useState<LookupOption[]>([]);
  const [assetTypes, setAssetTypes] = useState<LookupOption[]>([]);
  const [assetStatuses, setAssetStatuses] = useState<LookupOption[]>([]);
  const [currencies, setCurrencies] = useState<LookupOption[]>([]);
  const [depreciationMethods, setDepreciationMethods] = useState<LookupOption[]>([]);
  const [assetClassGlOptions, setAssetClassGlOptions] = useState<LookupOption[]>([]);
  const [criticalities, setCriticalities] = useState<LookupOption[]>([]);
  const [assetNatures, setAssetNatures] = useState<LookupOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [orgFilter, setOrgFilter] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [assetPanelOpen, setAssetPanelOpen] = useState(false);
  const [assetPanelMode, setAssetPanelMode] = useState<AssetPanelMode>("create");
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [detailDrawerInitialTab, setDetailDrawerInitialTab] = useState<AssetDetailTab>("overview");
  const [assetToDelete, setAssetToDelete] = useState<AssetRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [importInitialText, setImportInitialText] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const orgOptions = useMemo(() => flattenOrgTreeOptions(orgTree), [orgTree]);
  const orgMap = useMemo(() => buildOrgMap(orgTree), [orgTree]);
  const supplierMap = useMemo(
    () => new Map<string, string>(supplierList.map((supplier) => [supplier.supplier_id, supplier.supplier_name])),
    [supplierList],
  );
  const orgComboboxOptions = useMemo(
    () => orgOptions.map((item) => ({ value: item.id, label: item.label.replace(/^\s*-\s*/, ""), description: item.id })),
    [orgOptions],
  );

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const filters: ActiveFilter[] = [];
    if (searchQuery.trim()) {
      filters.push({ key: "search", label: `Search: ${searchQuery.trim()}`, onRemove: () => setSearchQuery("") });
    }
    if (orgFilter) {
      filters.push({
        key: "org",
        label: `Org: ${orgMap.get(orgFilter)?.name ?? orgFilter}`,
        onRemove: () => setOrgFilter(null),
      });
    }
    if (classFilter) {
      filters.push({
        key: "class",
        label: `Class: ${findLookupLabel(assetClasses, classFilter)}`,
        onRemove: () => setClassFilter(null),
      });
    }
    if (categoryFilter) {
      filters.push({
        key: "category",
        label: `Category: ${findLookupLabel(assetCategories, categoryFilter)}`,
        onRemove: () => setCategoryFilter(null),
      });
    }
    if (typeFilter) {
      filters.push({
        key: "type",
        label: `Type: ${findLookupLabel(assetTypes, typeFilter)}`,
        onRemove: () => setTypeFilter(null),
      });
    }
    if (statusFilter) {
      filters.push({
        key: "status",
        label: `Status: ${findLookupLabel(assetStatuses, statusFilter)}`,
        onRemove: () => setStatusFilter(null),
      });
    }
    return filters;
  }, [
    assetCategories,
    assetClasses,
    assetStatuses,
    assetTypes,
    categoryFilter,
    classFilter,
    orgFilter,
    orgMap,
    searchQuery,
    statusFilter,
    typeFilter,
  ]);

  const clearFilters = () => {
    setSearchQuery("");
    setOrgFilter(null);
    setClassFilter(null);
    setCategoryFilter(null);
    setTypeFilter(null);
    setStatusFilter(null);
  };

  const loadDependencyData = useCallback(async () => {
    try {
      const [
        orgs,
        suppliers,
        classes,
        categories,
        subCategories,
        types,
        statuses,
        currs,
        financeMethods,
        assetClassGlValues,
        crits,
        natures,
      ] = await Promise.all([
        getOrgTree(),
        getSuppliers(),
        getAssetClasses(),
        getAssetCategories(),
        getAssetSubCategories(),
        getAssetTypes(),
        getAssetStatuses(),
        getCurrencies(),
        getDepreciationMethods(),
        getAssetClassGlOptions(),
        getCriticalities(),
        getAssetNatures(),
      ]);
      setOrgTree(orgs);
      setSupplierList(suppliers);
      setAssetClasses(classes);
      setAssetCategories(categories);
      setAssetSubCategories(subCategories);
      setAssetTypes(types);
      setAssetStatuses(filterAllowedAssetStatusOptions(statuses));
      setCurrencies(currs);
      setDepreciationMethods(financeMethods);
      setAssetClassGlOptions(assetClassGlValues);
      setCriticalities(crits);
      setAssetNatures(natures);
    } catch (error) {
      console.error("Failed to load Asset Master dependency data:", error);
      toast.error("Failed to load Asset Master lookup data");
    }
  }, []);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const query = debouncedSearch.trim();
      const data = query ? await searchAssets(query) : await getAssets();
      setAssets(data);
      setPage(1);
    } catch (error) {
      console.error("Failed to load assets:", error);
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void loadDependencyData();
  }, [loadDependencyData]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const visibleAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (orgFilter && asset.org_node_id !== orgFilter) return false;
      if (classFilter && asset.asset_class !== classFilter) return false;
      if (categoryFilter && asset.asset_category !== categoryFilter) return false;
      if (typeFilter && asset.asset_type !== typeFilter) return false;
      if (statusFilter && asset.asset_status !== statusFilter) return false;
      return true;
    });
  }, [assets, categoryFilter, classFilter, orgFilter, statusFilter, typeFilter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(visibleAssets.length / PAGE_SIZE)), [visibleAssets.length]);
  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return visibleAssets.slice(start, start + PAGE_SIZE);
  }, [page, visibleAssets]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const resolveLookupCode = (options: LookupOption[], input: string): string | null => {
    const normalized = input.trim().toLowerCase();
    if (!normalized) return null;
    const byCode = options.find((option) => option.code?.toLowerCase() === normalized);
    if (byCode) return byCode.code;
    const byValue = options.find((option) => option.value?.toLowerCase() === normalized);
    return byValue?.code ?? null;
  };

  const orgIdByInput = useMemo(() => {
    const map = new Map<string, string>();
    const stack = [...orgTree];
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      map.set(node.id.toLowerCase(), node.id);
      map.set(node.name.toLowerCase(), node.id);
      (node.children ?? []).forEach((child) => stack.push(child));
    }
    return map;
  }, [orgTree]);

  const supplierIdByInput = useMemo(() => {
    const map = new Map<string, string>();
    supplierList.forEach((supplier) => {
      if (supplier.supplier_id) map.set(supplier.supplier_id.toLowerCase(), supplier.supplier_id);
      if (supplier.supplier_name) map.set(supplier.supplier_name.toLowerCase(), supplier.supplier_id);
    });
    return map;
  }, [supplierList]);

  const openCreatePanel = () => {
    if (!canCreateAsset) return;
    setAssetPanelMode("create");
    setSelectedAssetId(null);
    setDetailDrawerOpen(false);
    setAssetPanelOpen(true);
  };

  const openEditPanel = (asset: AssetRecord) => {
    if (!canUpdateAsset) return;
    setSelectedAssetId(asset.asset_uuid);
    setAssetPanelMode("edit");
    setDetailDrawerOpen(false);
    setAssetPanelOpen(true);
  };

  const handleWizardSaved = async () => {
    await loadAssets();
    setAssetPanelOpen(false);
  };

  const openAssetDrawer = (asset: AssetRecord, initialTab: AssetDetailTab) => {
    setSelectedAssetId(asset.asset_uuid);
    setDetailDrawerInitialTab(initialTab);
    setDetailDrawerOpen(true);
  };

  const handleDeleteClick = (asset: AssetRecord) => {
    if (!canDeleteAsset) return;
    setAssetToDelete(asset);
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete || !canDeleteAsset) return;
    setDeleting(true);
    try {
      await deleteAsset(assetToDelete.asset_uuid);
      toast.success("Asset deleted successfully");
      if (selectedAssetId === assetToDelete.asset_uuid) {
        setDetailDrawerOpen(false);
        setSelectedAssetId(null);
      }
      setAssetToDelete(null);
      await loadAssets();
    } catch (error) {
      console.error("Failed to delete asset:", error);
      toast.error("Failed to delete asset");
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = () => {
    if (!canExportReport) return;
    const headers = [
      "Asset ID",
      "Asset Name",
      "Asset Class",
      "Asset Category",
      "Asset Sub Category",
      "Asset Type",
      "Organization",
      "Supplier",
      "Criticality",
      "Status",
      "Serial Number",
      "Asset Value",
    ];

    const rows = visibleAssets.map((asset) => {
      const orgName = asset.org_node_id
        ? (orgMap.get(asset.org_node_id)?.name ?? asset.org_node_name ?? "-")
        : (asset.org_node_name ?? "-");
      const supplierName = asset.supplier_id
        ? (supplierMap.get(asset.supplier_id) ?? asset.supplier_name ?? "-")
        : (asset.supplier_name ?? "-");

      return [
        asset.asset_id ?? "",
        asset.asset_name ?? "",
        findLookupLabel(assetClasses, asset.asset_class),
        findLookupLabel(assetCategories, asset.asset_category),
        findLookupLabel(assetSubCategories, asset.asset_sub_category),
        findLookupLabel(assetTypes, asset.asset_type),
        orgName,
        supplierName,
        findLookupLabel(criticalities, asset.criticality_class),
        findLookupLabel(assetStatuses, asset.asset_status),
        asset.serial_number ?? "",
        formatValue(asset.asset_value, asset.asset_currency),
      ];
    });

    const scope = activeFilters.length > 0 ? "filtered" : "all";
    downloadCsv(`assets-${scope}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const headerStats = buildPageHeaderStats(header.stats, {
    total: assets.length,
    visible: visibleAssets.length,
    "selected-org": orgFilter ? orgMap.get(orgFilter)?.name ?? "Org scope" : "Enterprise scope",
  });

  const exportLabel = activeFilters.length > 0 ? "Export Filtered" : "Export All";

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Asset Master"
        subtitle="Manage core asset master data and references"
        stats={headerStats}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <PermissionGuard permission="ASSET_CREATE">
              <Button type="button" size="sm" onClick={openCreatePanel} disabled={loading}>
                <Plus className="h-4 w-4" />
                Create Asset
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="ASSET_CREATE">
              <Button type="button" variant="secondary" size="sm" onClick={() => setImportOpen(true)} disabled={loading}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="REPORT_EXPORT">
              <Button type="button" variant="secondary" size="sm" onClick={handleExport} disabled={visibleAssets.length === 0}>
                <Download className="h-4 w-4" />
                {exportLabel}
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <div className={PAGE_CONTENT_CLASS}>
        <FilterBar activeFilters={activeFilters} onClearAll={activeFilters.length ? clearFilters : undefined}>
          <Input
            label="Search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Asset ID, name, or serial number"
            wrapperClassName="min-w-64 flex-1"
          />
          <SearchableCombobox
            label="Org Scope"
            value={orgFilter}
            options={orgComboboxOptions}
            placeholder="All org units"
            emptyText="No org units found"
            onChange={setOrgFilter}
          />
          <SearchableCombobox
            label="Asset Class"
            value={classFilter}
            options={toComboboxOptions(assetClasses)}
            placeholder="All classes"
            emptyText="No classes found"
            onChange={setClassFilter}
          />
          <SearchableCombobox
            label="Category"
            value={categoryFilter}
            options={toComboboxOptions(assetCategories)}
            placeholder="All categories"
            emptyText="No categories found"
            onChange={setCategoryFilter}
          />
          <SearchableCombobox
            label="Asset Type"
            value={typeFilter}
            options={toComboboxOptions(assetTypes)}
            placeholder="All types"
            emptyText="No asset types found"
            onChange={setTypeFilter}
          />
          <SearchableCombobox
            label="Status"
            value={statusFilter}
            options={toComboboxOptions(assetStatuses)}
            placeholder="All statuses"
            emptyText="No statuses found"
            onChange={setStatusFilter}
          />
        </FilterBar>

        {assetToDelete ? (
          <ConfirmStrip
            tone="danger"
            title="Delete asset?"
            message={`This will delete "${assetToDelete.asset_name || assetToDelete.asset_id}".`}
            confirmLabel={deleting ? "Deleting..." : "Delete"}
            onConfirm={() => void handleConfirmDelete()}
            onCancel={() => setAssetToDelete(null)}
            disabled={deleting}
          />
        ) : null}

        {!loading && visibleAssets.length === 0 ? (
          <EmptyState
            title={assets.length === 0 ? "No assets found" : "No assets match the current filters"}
            description={
              activeFilters.length > 0
                ? "Clear filters or adjust the search to view asset master records."
                : "Create an asset to start building the core master-data register."
            }
            action={
              canCreateAsset && assets.length === 0 ? (
                <PermissionGuard permission="ASSET_CREATE">
                  <Button type="button" onClick={openCreatePanel}>
                    <Plus className="h-4 w-4" />
                    Create Asset
                  </Button>
                </PermissionGuard>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            <AssetTable
              assets={paginatedAssets}
              loading={loading}
              searchQuery={debouncedSearch}
              orgTree={orgTree}
              suppliers={supplierList}
              assetClasses={assetClasses}
              assetCategories={assetCategories}
              assetSubCategories={assetSubCategories}
              assetTypes={assetTypes}
              assetStatuses={assetStatuses}
              criticalities={criticalities}
              onView={(asset) => openAssetDrawer(asset, "overview")}
              onEdit={openEditPanel}
              onDelete={handleDeleteClick}
              canEdit={canUpdateAsset}
              canDelete={canDeleteAsset}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 px-2">
              <div className="text-sm text-slate-500">
                Showing <span className="font-medium text-slate-700">{paginatedAssets.length}</span> of{" "}
                <span className="font-medium text-slate-700">{visibleAssets.length}</span> visible assets
              </div>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </div>
        )}
      </div>

      <AssetMasterWizardPanel
        open={assetPanelOpen}
        mode={assetPanelMode}
        assetId={assetPanelMode === "edit" ? selectedAssetId : null}
        onClose={() => setAssetPanelOpen(false)}
        onSaved={handleWizardSaved}
        orgTree={orgTree}
        supplierList={supplierList}
        assetClasses={assetClasses}
        assetCategories={assetCategories}
        assetSubCategories={assetSubCategories}
        assetTypes={assetTypes}
        assetStatuses={assetStatuses}
        currencies={currencies}
        depreciationMethods={depreciationMethods}
        assetClassGlOptions={assetClassGlOptions}
        criticalities={criticalities}
        assetNatures={assetNatures}
      />

      <AssetDetailDrawer
        open={detailDrawerOpen}
        assetId={selectedAssetId}
        initialTab={detailDrawerInitialTab}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedAssetId(null);
          setDetailDrawerInitialTab("overview");
        }}
        orgTree={orgTree}
        suppliers={supplierList}
        assetClasses={assetClasses}
        assetCategories={assetCategories}
        assetSubCategories={assetSubCategories}
        assetTypes={assetTypes}
        assetStatuses={assetStatuses}
        currencies={currencies}
        depreciationMethods={depreciationMethods}
        assetClassGlOptions={assetClassGlOptions}
        criticalities={criticalities}
        assetNatures={assetNatures}
      />

      {/* TODO: Move CSV import into a RightPanel flow; the modal is preserved here to avoid changing import behavior in Phase 2D. */}
      {canCreateAsset ? (
        <CsvImportModal<CreateAssetPayload>
          open={importOpen}
          onClose={() => {
            setImportOpen(false);
            setImportInitialText(null);
          }}
          title="Import Assets"
          description="Upload a CSV file to create asset master records. Each row becomes one create request."
          expectedColumns={[
            { label: "Asset ID", required: true },
            { label: "Asset Name", required: true },
            { label: "Short Description", required: true },
            { label: "Asset Class", required: true },
            { label: "Asset Category", required: true },
            { label: "Asset Sub Category", required: true },
            { label: "Asset Nature", required: true },
            { label: "Asset Owner", required: true },
            { label: "Description", required: true },
            { label: "Asset Type" },
            { label: "Organization", required: true },
            { label: "Supplier" },
            { label: "Status" },
            { label: "Criticality Class", required: true },
            { label: "Value" },
          ]}
          initialCsvText={importInitialText ?? undefined}
          onPickFile={() => importFileRef.current?.click()}
          parseRow={(row) => {
            const errors: string[] = [];
            const assetIdValue = ((row["Asset ID"] ?? row["Asset Code"]) || "").trim();
            const assetName = (row["Asset Name"] ?? "").trim();
            const shortDescription = (row["Short Description"] ?? "").trim();
            const assetClassInput = (row["Asset Class"] ?? "").trim();
            const assetCategoryInput = (row["Asset Category"] ?? "").trim();
            const assetSubCategoryInput = (row["Asset Sub Category"] ?? "").trim();
            const assetNatureInput = (row["Asset Nature"] ?? "").trim();
            const assetOwner = (row["Asset Owner"] ?? "").trim();
            const assetDescription = (row["Description"] ?? "").trim();
            const assetTypeInput = (row["Asset Type"] ?? "").trim();
            const orgInput = (row["Organization"] ?? "").trim();
            const supplierInput = (row["Supplier"] ?? "").trim();
            const statusInput = (row["Status"] ?? "").trim();
            const criticalityInput = ((row["Criticality Class"] ?? row["Criticality"]) || "").trim();
            const valueInput = (row["Value"] ?? "").trim();

            if (!assetIdValue) errors.push("Asset ID is required");
            if (!assetName) errors.push("Asset Name is required");
            if (!shortDescription) errors.push("Short Description is required");
            if (!assetClassInput) errors.push("Asset Class is required");
            if (!assetCategoryInput) errors.push("Asset Category is required");
            if (!assetSubCategoryInput) errors.push("Asset Sub Category is required");
            if (!assetNatureInput) errors.push("Asset Nature is required");
            if (!assetOwner) errors.push("Asset Owner is required");
            if (!assetDescription) errors.push("Description is required");
            if (!orgInput) errors.push("Organization is required");
            if (!criticalityInput) errors.push("Criticality Class is required");

            const orgNodeId = orgInput ? orgIdByInput.get(orgInput.toLowerCase()) : undefined;
            if (orgInput && !orgNodeId) errors.push(`Unknown Organization: "${orgInput}"`);

            const supplierId = supplierInput ? supplierIdByInput.get(supplierInput.toLowerCase()) : undefined;
            if (supplierInput && !supplierId) errors.push(`Unknown Supplier: "${supplierInput}"`);

            const assetClass = assetClassInput ? resolveLookupCode(assetClasses, assetClassInput) : null;
            if (assetClassInput && !assetClass) errors.push(`Unknown Asset Class: "${assetClassInput}"`);

            const assetCategory = assetCategoryInput ? resolveLookupCode(assetCategories, assetCategoryInput) : null;
            if (assetCategoryInput && !assetCategory) errors.push(`Unknown Asset Category: "${assetCategoryInput}"`);

            const assetSubCategory = assetSubCategoryInput
              ? resolveLookupCode(assetSubCategories, assetSubCategoryInput)
              : null;
            if (assetSubCategoryInput && !assetSubCategory) {
              errors.push(`Unknown Asset Sub Category: "${assetSubCategoryInput}"`);
            }

            const assetNature = assetNatureInput ? resolveLookupCode(assetNatures, assetNatureInput) : null;
            if (assetNatureInput && !assetNature) errors.push(`Unknown Asset Nature: "${assetNatureInput}"`);

            const assetType = assetTypeInput ? resolveLookupCode(assetTypes, assetTypeInput) : null;
            if (assetTypeInput && !assetType) errors.push(`Unknown Asset Type: "${assetTypeInput}"`);

            const status = statusInput ? resolveLookupCode(assetStatuses, statusInput) : null;
            if (statusInput && !status) errors.push(`Unknown Status: "${statusInput}"`);

            const criticality = criticalityInput ? resolveLookupCode(criticalities, criticalityInput) : null;
            if (criticalityInput && !criticality) errors.push(`Unknown Criticality: "${criticalityInput}"`);

            const parsedValue = parseCurrencyValue(valueInput);
            if (valueInput && parsedValue === undefined) errors.push(`Invalid Value: "${valueInput}"`);

            if (errors.length) return { errors };

            return {
              errors,
              payload: {
                org_node_id: orgNodeId!,
                asset_id: assetIdValue,
                asset_name: assetName,
                asset_description: assetDescription,
                short_description: shortDescription,
                asset_owner: assetOwner,
                asset_class: assetClass!,
                asset_category: assetCategory!,
                asset_sub_category: assetSubCategory!,
                criticality_class: criticality!,
                asset_nature: assetNature!,
                created_by: actorName,
                ...(assetType ? { asset_type: assetType } : null),
                ...(status ? { asset_status: status } : null),
                ...(supplierId ? { supplier_id: supplierId } : null),
                ...(parsedValue !== undefined ? { asset_value: parsedValue } : null),
              },
            };
          }}
          onSubmitRow={async (payload) => {
            await createAsset(payload);
          }}
          onAfterSubmit={loadAssets}
        />
      ) : null}

      <input
        ref={importFileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            const text = await file.text();
            setImportInitialText(text);
            setImportOpen(true);
          } catch {
            toast.error("Failed to read CSV file");
          }
        }}
      />

      <Toaster position="top-right" richColors />
    </div>
  );
}
