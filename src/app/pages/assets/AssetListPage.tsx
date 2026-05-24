import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Pagination } from "../../components/ui/table";
import { CreateAssetModal } from "../../components/assets/CreateAssetModal";
import { EditAssetModal } from "../../components/assets/EditAssetModal";
import { AssetDetailDrawer, AssetDetailTab } from "../../components/assets/AssetDetailDrawer";
import { AssetTable } from "../../components/assets/AssetTable";
import { AssetRecord, CreateAssetPayload, createAsset, deleteAsset, getAssets, searchAssets } from "../../../services/asset.service";
import { getOrgTree, OrgNode } from "../../../services/org.service";
import { getSuppliers, SupplierRecord } from "../../../services/supplier.service";
import { LookupOption } from "../../services/lookupValue.service";
import {
  getAssetClassGlOptions,
  getAssetClasses,
  getAssetCategories,
  getAssetSubCategories,
  getAssetTypes,
  getAssetStatuses,
  getCurrencies,
  getDepreciationMethods,
  getCriticalities,
  getAssetNatures,
} from "../../services/lookupOption.service";
import {
  flattenOrgTreeOptions,
  buildOrgMap,
  filterAllowedAssetStatusOptions,
  getAssetStatusBadgeClass,
  getCriticalityBadgeClass,
} from "../../components/assets/assetForm.shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { CsvImportModal } from "../../components/importExport/CsvImportModal";
import { downloadCsv } from "../../components/importExport/csv";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { useAuth } from "../../auth/useAuth";

interface AssetListPageProps {
  onNavigate?: (page: string) => void;
}

const PAGE_SIZE = 10;
const DEFAULT_CREATED_BY = "admin";

export function AssetListPage({ onNavigate }: AssetListPageProps) {
  const { hasPermission } = useAuth();
  const canCreateAsset = hasPermission("ASSET_CREATE");
  const canUpdateAsset = hasPermission("ASSET_UPDATE");
  const canDeleteAsset = hasPermission("ASSET_DELETE");
  const canExportReport = hasPermission("REPORT_EXPORT");
  const header = getPageHeaderConfig("asset");
  // Data state
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

  // Loading states
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Modal/Drawer states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [detailDrawerInitialTab, setDetailDrawerInitialTab] = useState<AssetDetailTab>("overview");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<AssetRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Import/Export
  const [importOpen, setImportOpen] = useState(false);
  const [importInitialText, setImportInitialText] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  // Computed values
  const orgOptions = useMemo(() => flattenOrgTreeOptions(orgTree), [orgTree]);
  const orgMap = useMemo(() => buildOrgMap(orgTree), [orgTree]);
  const supplierMap = useMemo(
    () => new Map<string, string>(supplierList.map((s) => [s.supplier_id, s.supplier_name])),
    [supplierList]
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(assets.length / PAGE_SIZE)), [assets.length]);
  const paginatedAssets = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return assets.slice(start, start + PAGE_SIZE);
  }, [assets, page]);

  // Helper functions
  const findLookupLabel = (options: LookupOption[], code?: string | null): string => {
    if (!code) return "-";
    const found = options.find((item) => item.code === code);
    return found?.value || code;
  };

  const resolveLookupCode = (options: LookupOption[], input: string): string | null => {
    const normalized = input.trim().toLowerCase();
    if (!normalized) return null;
    const byCode = options.find((o) => o.code?.toLowerCase() === normalized);
    if (byCode) return byCode.code;
    const byValue = options.find((o) => o.value?.toLowerCase() === normalized);
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
    supplierList.forEach((s) => {
      if (s.supplier_id) map.set(s.supplier_id.toLowerCase(), s.supplier_id);
      if (s.supplier_name) map.set(s.supplier_name.toLowerCase(), s.supplier_id);
    });
    return map;
  }, [supplierList]);

  // Load initial data
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
      console.error("Failed to load dependency data:", error);
      toast.error("Failed to load form data");
    }
  }, []);

  // Load assets
  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const data = searchQuery.trim()
        ? await searchAssets(searchQuery.trim())
        : await getAssets();
      setAssets(data);
      setPage(1);
    } catch (error) {
      console.error("Failed to load assets:", error);
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Initial load
  useEffect(() => {
    Promise.all([loadDependencyData(), loadAssets()]);
  }, [loadDependencyData, loadAssets]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  // Handle create
  const handleCreated = async () => {
    await loadAssets();
    setCreateModalOpen(false);
  };

  // Handle edit
  const handleEdit = (asset: AssetRecord) => {
    if (!canUpdateAsset) return;
    setSelectedAssetId(asset.asset_uuid);
    setEditModalOpen(true);
  };

  const handleUpdated = async () => {
    await loadAssets();
    setEditModalOpen(false);
    setSelectedAssetId(null);
  };

  const openAssetDrawer = (asset: AssetRecord, initialTab: AssetDetailTab) => {
    setSelectedAssetId(asset.asset_uuid);
    setDetailDrawerInitialTab(initialTab);
    setDetailDrawerOpen(true);
  };

  // Handle view
  const handleView = (asset: AssetRecord) => {
    openAssetDrawer(asset, "overview");
  };

  const handleManageReleases = (asset: AssetRecord) => {
    openAssetDrawer(asset, "releases");
  };

  // Handle delete
  const handleDeleteClick = (asset: AssetRecord) => {
    if (!canDeleteAsset) return;
    setAssetToDelete(asset);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete || !canDeleteAsset) return;
    setDeleting(true);
    try {
      await deleteAsset(assetToDelete.asset_uuid);
      toast.success("Asset deleted successfully");
      await loadAssets();
    } catch (error) {
      console.error("Failed to delete asset:", error);
      toast.error("Failed to delete asset");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setAssetToDelete(null);
    }
  };

  // Format currency value
  const formatValue = (value?: number | null, currency?: string | null): string => {
    if (value === null || value === undefined) return "-";
    return currency ? `${currency} ${value.toLocaleString()}` : value.toLocaleString();
  };

  const handleExport = () => {
    if (!canExportReport) return;
    const headers = [
      "Asset ID",
      "Asset Name",
      "Asset Class",
      "Asset Type",
      "Asset Owner",
      "Organization",
      "Supplier",
      "Status",
      "Criticality",
      "Value",
    ];

    const rows = assets.map((asset) => {
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
        findLookupLabel(assetTypes, asset.asset_type),
        asset.asset_owner ?? "",
        orgName,
        supplierName,
        findLookupLabel(assetStatuses, asset.asset_status),
        findLookupLabel(criticalities, asset.criticality_class),
        formatValue(asset.asset_value, asset.asset_currency),
      ];
    });

    downloadCsv(`assets-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const parseCurrencyValue = (raw: string): number | undefined => {
    const normalized = raw.trim();
    if (!normalized) return undefined;
    const cleaned = normalized.replace(/[^0-9.\-]/g, "");
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : undefined;
  };

  const headerStats = buildPageHeaderStats(header.stats, {
    total: assets.length,
    visible: assets.length,
    "selected-org": "Enterprise scope",
  });

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={header.subtitle}
        search={header.searchPlaceholder ? {
          value: searchQuery,
          placeholder: header.searchPlaceholder,
          onChange: setSearchQuery,
          onClear: () => {
            setSearchQuery("");
            void loadAssets();
          },
          disabled: loading,
        } : undefined}
        stats={headerStats}
        primaryAction={header.primaryAction && canCreateAsset ? { ...header.primaryAction, onClick: () => setCreateModalOpen(true), disabled: loading } : undefined}
        secondaryActions={[
          {
            ...(header.secondaryActions?.[0] ?? { key: "asset-specs", label: "Asset Specs", variant: "secondary" }),
            onClick: () => onNavigate?.("asset-specs"),
            disabled: false,
          },
          ...(canCreateAsset ? [{
            ...(header.secondaryActions?.[1] ?? { key: "import", label: "Import", variant: "secondary" }),
            onClick: () => setImportOpen(true),
            disabled: loading,
          }] : []),
          ...(canExportReport ? [{
            ...(header.secondaryActions?.[2] ?? { key: "export", label: "Export", variant: "secondary" }),
            onClick: handleExport,
            disabled: assets.length === 0,
          }] : []),
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        {/* Table */}
        <div className="space-y-4">
          <AssetTable
            assets={paginatedAssets}
            loading={loading}
            searchQuery={searchQuery}
            orgTree={orgTree}
            suppliers={supplierList}
            assetClasses={assetClasses}
            assetTypes={assetTypes}
            assetStatuses={assetStatuses}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            canEdit={canUpdateAsset}
            canDelete={canDeleteAsset}
          />

          <div className="flex items-center justify-between px-2">
            <div className="text-sm text-slate-500">
              Total: <span className="font-medium text-slate-700">{assets.length}</span>
            </div>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {canCreateAsset ? <CreateAssetModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreated}
        orgTree={orgTree}
        supplierList={supplierList}
        assetClasses={assetClasses}
        assetCategories={assetCategories}
        assetSubCategories={assetSubCategories}
        assetTypes={assetTypes}
        assetStatuses={assetStatuses}
        currencies={currencies}
        criticalities={criticalities}
        assetNatures={assetNatures}
      /> : null}

      {/* Edit Modal */}
      {canUpdateAsset ? <EditAssetModal
        open={editModalOpen}
        assetId={selectedAssetId}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedAssetId(null);
        }}
        onUpdated={handleUpdated}
        orgTree={orgTree}
        supplierList={supplierList}
        assetClasses={assetClasses}
        assetCategories={assetCategories}
        assetSubCategories={assetSubCategories}
        assetTypes={assetTypes}
        assetStatuses={assetStatuses}
        currencies={currencies}
        criticalities={criticalities}
        assetNatures={assetNatures}
      /> : null}

      {/* Detail Drawer */}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{assetToDelete?.asset_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {canCreateAsset ? <CsvImportModal<CreateAssetPayload>
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
          const assetId = ((row["Asset ID"] ?? row["Asset Code"]) || "").trim();
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

          if (!assetId) errors.push("Asset ID is required");
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
              asset_id: assetId,
              asset_name: assetName,
              asset_description: assetDescription,
              short_description: shortDescription,
              asset_owner: assetOwner,
              asset_class: assetClass!,
              asset_category: assetCategory!,
              asset_sub_category: assetSubCategory!,
              criticality_class: criticality!,
              asset_nature: assetNature!,
              created_by: DEFAULT_CREATED_BY,
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
      /> : null}

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


