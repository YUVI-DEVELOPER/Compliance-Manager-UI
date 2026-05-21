import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Drawer } from "../ui/Modal";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { getAssetById, AssetRecord } from "../../../services/asset.service";
import {
  AssetFinanceRecord,
  deleteAssetFinance,
  getAssetFinance,
} from "../../../services/asset-finance.service";
import {
  AssetLocationRecord,
  deleteAssetLocation,
  getAssetLocation,
} from "../../../services/asset-location.service";
import {
  deleteDocumentLink,
  DocumentLinkRecord,
  getAssetDocuments,
  reprocessDocumentVectorization,
} from "../../../services/document-link.service";
import {
  deleteRelease,
  downloadImpactAssessment,
  getReleasesByAssetId,
  regenerateImpactAssessment,
  ReleaseRecord,
} from "../../../services/release.service";
import { OrgNode } from "../../../services/org.service";
import { SupplierRecord } from "../../../services/supplier.service";
import { LookupOption } from "../../services/lookupValue.service";
import {
  buildOrgMap,
  getAssetStatusBadgeClass,
  getCriticalityBadgeClass,
} from "./assetForm.shared";
import { AuthoredDocumentPanel } from "./AuthoredDocumentPanel";
import { AssetDocumentTable } from "./AssetDocumentTable";
import { AssetDocumentHubPanel } from "./AssetDocumentHubPanel";
import { AssetRagInsightsPanel } from "./AssetRagInsightsPanel";
import { AssetFinanceModal } from "./AssetFinanceModal";
import { AssetLifecycleTimeline } from "./AssetLifecycleTimeline";
import { AssetLocationModal } from "./AssetLocationModal";
import { AssetReleaseTable } from "./AssetReleaseTable";
import { CreateDocumentLinkModal } from "./CreateDocumentLinkModal";
import { CreateReleaseModal } from "./CreateReleaseModal";
import { EditDocumentLinkModal } from "./EditDocumentLinkModal";
import { EditReleaseModal } from "./EditReleaseModal";
import { QualificationDocumentPanel } from "./QualificationDocumentPanel";
import { SupplierEvaluationPanel } from "./SupplierEvaluationPanel";
import {
  DocumentLinkContext,
  isDocumentVectorizationActive,
  mapDocumentLinkAxiosError,
  useOmsSourceSystemOptions,
} from "./documentLinkForm.shared";
import { ReleaseAssessmentModal } from "./ReleaseAssessmentModal";
import { ReleaseDocumentsModal } from "./ReleaseDocumentsModal";
import { mapReleaseAxiosError } from "./releaseForm.shared";
import { useAuth } from "../../auth/useAuth";

export type AssetDetailTab =
  | "overview"
  | "location"
  | "finance"
  | "releases"
  | "supplier-evaluation"
  | "document-hub"
  | "rag-insights"
  | "documents";

interface AssetDetailDrawerProps {
  open: boolean;
  assetId: string | null;
  onClose: () => void;
  orgTree: OrgNode[];
  suppliers: SupplierRecord[];
  assetClasses: LookupOption[];
  assetCategories: LookupOption[];
  assetSubCategories: LookupOption[];
  assetTypes: LookupOption[];
  assetStatuses: LookupOption[];
  currencies: LookupOption[];
  depreciationMethods: LookupOption[];
  assetClassGlOptions: LookupOption[];
  criticalities: LookupOption[];
  assetNatures: LookupOption[];
  initialTab?: AssetDetailTab;
}

const mapAxiosErrorMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Unexpected error occurred";
  }
  const status = error.response?.status;
  const data = error.response?.data as { message?: string; detail?: unknown } | undefined;
  const detailMessage = typeof data?.detail === "string" ? data.detail : undefined;
  if (status === 404) return detailMessage || data?.message || "Asset not found";
  return detailMessage || data?.message || error.message || "Failed to load asset detail";
};

const findLookupLabel = (options: LookupOption[], code?: string | null): string => {
  if (!code) return "-";
  const found = options.find((item) => item.code === code);
  return found?.value || code;
};

const formatValue = (value?: string | number | null): string => {
  if (value === undefined || value === null || String(value).trim() === "") return "-";
  return String(value);
};

const formatCurrencyValue = (value?: number | null, currency?: string | null): string => {
  if (value === undefined || value === null) return "-";
  return currency ? `${currency} ${value.toLocaleString()}` : value.toLocaleString();
};

const formatPercentValue = (value?: number | null): string => {
  if (value === undefined || value === null) return "-";
  return `${value.toFixed(2)}%`;
};

const formatDate = (value?: string | null): string => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const getReleaseSortValue = (release: ReleaseRecord): number => {
  const value = release.created_dt ?? release.modified_dt ?? release.end_dt;
  if (!value) return 0;

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const InfoField = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className="text-sm font-medium text-slate-900">{value}</p>
  </div>
);

export function AssetDetailDrawer({
  open,
  assetId,
  onClose,
  orgTree,
  suppliers,
  assetClasses,
  assetCategories,
  assetSubCategories,
  assetTypes,
  assetStatuses,
  currencies,
  depreciationMethods,
  assetClassGlOptions,
  criticalities,
  assetNatures,
  initialTab = "overview",
}: AssetDetailDrawerProps) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const canCreateDocument = hasAnyPermission(["DOCUMENT_LINK", "DOCUMENT_UPLOAD"]);
  const canUpdateDocument = hasPermission("DOCUMENT_UPDATE");
  const canDeleteDocument = hasPermission("DOCUMENT_DELETE");
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AssetDetailTab>(initialTab);
  const [finance, setFinance] = useState<AssetFinanceRecord | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeModalOpen, setFinanceModalOpen] = useState(false);
  const [deleteFinanceDialogOpen, setDeleteFinanceDialogOpen] = useState(false);
  const [deletingFinance, setDeletingFinance] = useState(false);
  const [location, setLocation] = useState<AssetLocationRecord | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [deleteLocationDialogOpen, setDeleteLocationDialogOpen] = useState(false);
  const [deletingLocation, setDeletingLocation] = useState(false);
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [createReleaseOpen, setCreateReleaseOpen] = useState(false);
  const [editReleaseId, setEditReleaseId] = useState<string | null>(null);
  const [releaseToDelete, setReleaseToDelete] = useState<ReleaseRecord | null>(null);
  const [deleteReleaseDialogOpen, setDeleteReleaseDialogOpen] = useState(false);
  const [deletingRelease, setDeletingRelease] = useState(false);
  const [documents, setDocuments] = useState<DocumentLinkRecord[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [createDocumentOpen, setCreateDocumentOpen] = useState(false);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [linkedDocumentsOpen, setLinkedDocumentsOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentLinkRecord | null>(null);
  const [deleteDocumentDialogOpen, setDeleteDocumentDialogOpen] = useState(false);
  const [deletingDocument, setDeletingDocument] = useState(false);
  const [releaseDocumentsTarget, setReleaseDocumentsTarget] = useState<ReleaseRecord | null>(null);
  const [assessmentReleaseId, setAssessmentReleaseId] = useState<string | null>(null);
  const [assessmentReloadToken, setAssessmentReloadToken] = useState(0);
  const { options: sourceSystemOptions } = useOmsSourceSystemOptions(
    open && (activeTab === "documents" || activeTab === "document-hub" || activeTab === "rag-insights" || activeTab === "supplier-evaluation" || Boolean(releaseDocumentsTarget)),
  );

  useEffect(() => {
    if (!open) {
      setActiveTab(initialTab);
      setFinance(null);
      setFinanceLoading(false);
      setFinanceModalOpen(false);
      setDeleteFinanceDialogOpen(false);
      setLocation(null);
      setLocationLoading(false);
      setLocationModalOpen(false);
      setDeleteLocationDialogOpen(false);
      setCreateReleaseOpen(false);
      setEditReleaseId(null);
      setReleaseToDelete(null);
      setDeleteReleaseDialogOpen(false);
      setCreateDocumentOpen(false);
      setEditDocumentId(null);
      setLinkedDocumentsOpen(false);
      setDocumentToDelete(null);
      setDeleteDocumentDialogOpen(false);
      setReleaseDocumentsTarget(null);
      setAssessmentReleaseId(null);
      setAssessmentReloadToken(0);
      return;
    }

    setActiveTab(initialTab);
  }, [open, assetId, initialTab]);

  useEffect(() => {
    if (!open || !assetId) {
      setAsset(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setAsset(null);
    setLoading(true);

    const run = async () => {
      try {
        const detail = await getAssetById(assetId);
        if (!cancelled) setAsset(detail);
      } catch (error) {
        if (!cancelled) {
          toast.error(mapAxiosErrorMessage(error));
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, assetId, onClose]);

  const loadReleases = useCallback(async () => {
    if (!assetId) return;

    setReleasesLoading(true);
    try {
      const data = await getReleasesByAssetId(assetId);
      setReleases(data);
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setReleasesLoading(false);
    }
  }, [assetId]);

  const loadFinance = useCallback(async () => {
    if (!assetId) return;

    setFinanceLoading(true);
    try {
      const data = await getAssetFinance(assetId);
      setFinance(data);
    } catch (error) {
      const mapped = mapAxiosErrorMessage(error);
      toast.error(mapped);
    } finally {
      setFinanceLoading(false);
    }
  }, [assetId]);

  const loadLocation = useCallback(async () => {
    if (!assetId) return;

    setLocationLoading(true);
    try {
      const data = await getAssetLocation(assetId);
      setLocation(data);
    } catch (error) {
      const mapped = mapAxiosErrorMessage(error);
      toast.error(mapped);
    } finally {
      setLocationLoading(false);
    }
  }, [assetId]);

  const loadDocuments = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!assetId) return;

    if (!options.silent) {
      setDocumentsLoading(true);
    }
    try {
      const data = await getAssetDocuments(assetId);
      setDocuments(data);
    } catch (error) {
      if (options.silent) {
        console.error("Failed to refresh document vectorization status:", error);
      } else {
        const mapped = mapDocumentLinkAxiosError(error);
        toast.error(mapped.message);
      }
    } finally {
      if (!options.silent) {
        setDocumentsLoading(false);
      }
    }
  }, [assetId]);

  useEffect(() => {
    if (!open || !assetId) {
      setReleases([]);
      setReleasesLoading(false);
      return;
    }

    if (activeTab !== "releases" && activeTab !== "documents") return;
    void loadReleases();
  }, [activeTab, assetId, loadReleases, open]);

  useEffect(() => {
    if (!open || !assetId) {
      setFinance(null);
      setFinanceLoading(false);
      return;
    }

    if (activeTab !== "finance") return;
    void loadFinance();
  }, [activeTab, assetId, loadFinance, open]);

  useEffect(() => {
    if (!open || !assetId) {
      setLocation(null);
      setLocationLoading(false);
      return;
    }

    if (activeTab !== "overview" && activeTab !== "location") return;
    void loadLocation();
  }, [activeTab, assetId, loadLocation, open]);

  useEffect(() => {
    if (!open || !assetId) {
      setDocuments([]);
      setDocumentsLoading(false);
      return;
    }

    if (activeTab !== "documents") return;
    void loadDocuments();
  }, [activeTab, assetId, loadDocuments, open]);

  const hasActiveDocumentVectorization = useMemo(
    () => documents.some(isDocumentVectorizationActive),
    [documents],
  );

  useEffect(() => {
    if (!open || !assetId || activeTab !== "documents" || !hasActiveDocumentVectorization) return;

    const intervalId = window.setInterval(() => {
      void loadDocuments({ silent: true });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [activeTab, assetId, hasActiveDocumentVectorization, loadDocuments, open]);

  const orgMap = useMemo(() => buildOrgMap(orgTree), [orgTree]);
  const supplierMap = useMemo(
    () => new Map<string, string>(suppliers.map((item) => [item.supplier_id, item.supplier_name])),
    [suppliers],
  );
  const sortedReleases = useMemo(
    () => [...releases].sort((left, right) => getReleaseSortValue(right) - getReleaseSortValue(left)),
    [releases],
  );
  const latestRelease = sortedReleases[0] ?? null;
  const assessmentRelease = useMemo(
    () => sortedReleases.find((release) => release.release_id === assessmentReleaseId) ?? null,
    [assessmentReleaseId, sortedReleases],
  );
  const assetDocumentContext: DocumentLinkContext = useMemo(
    () => ({
      type: "asset",
      assetId,
      assetName: asset?.asset_name ?? null,
      assetCode: asset?.asset_id ?? null,
      assetVersion: asset?.asset_version ?? null,
    }),
    [asset?.asset_id, asset?.asset_name, asset?.asset_version, assetId],
  );
  const assetAuthoredDocumentContext = useMemo(
    () => ({
      type: "asset" as const,
      assetId,
      assetName: asset?.asset_name ?? null,
      assetCode: asset?.asset_id ?? null,
      assetVersion: asset?.asset_version ?? null,
    }),
    [asset?.asset_id, asset?.asset_name, asset?.asset_version, assetId],
  );
  const assetQualificationDocumentContext = useMemo(
    () => ({
      type: "asset" as const,
      assetId,
      assetName: asset?.asset_name ?? null,
      assetCode: asset?.asset_id ?? null,
      assetVersion: asset?.asset_version ?? null,
    }),
    [asset?.asset_id, asset?.asset_name, asset?.asset_version, assetId],
  );

  const organization = asset?.org_node_name || (asset?.org_node_id ? orgMap.get(asset.org_node_id)?.name : undefined) || "-";
  const supplier = asset?.supplier_name || (asset?.supplier_id ? supplierMap.get(asset.supplier_id) : undefined) || "-";
  const tagList = asset?.tags ?? [];
  const locationForAsset = location?.asset_uuid === assetId ? location : null;
  const financeSupplier =
    finance?.supplier_name || (finance?.supplier_id ? supplierMap.get(finance.supplier_id) : undefined) || "-";
  const releaseDisabledReason =
    asset && !asset.can_create_release
      ? `Release creation is unavailable because ${findLookupLabel(assetClasses, asset.asset_class)} is not configured for upgrade-managed releases.`
      : null;

  const handleDeleteReleaseClick = (release: ReleaseRecord) => {
    setReleaseToDelete(release);
    setDeleteReleaseDialogOpen(true);
  };

  const handleDeleteDocumentClick = (document: DocumentLinkRecord) => {
    if (!canDeleteDocument) return;
    setDocumentToDelete(document);
    setDeleteDocumentDialogOpen(true);
  };

  const handleDeleteFinanceClick = () => {
    setDeleteFinanceDialogOpen(true);
  };

  const handleDeleteLocationClick = () => {
    setDeleteLocationDialogOpen(true);
  };

  const handleViewAssessment = (release: ReleaseRecord) => {
    setAssessmentReleaseId(release.release_id);
  };

  const handleConfirmDeleteRelease = async () => {
    if (!releaseToDelete) return;

    setDeletingRelease(true);
    try {
      await deleteRelease(releaseToDelete.release_id);
      toast.success("Release deleted successfully");
      await loadReleases();
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeletingRelease(false);
      setDeleteReleaseDialogOpen(false);
      setReleaseToDelete(null);
    }
  };

  const handleConfirmDeleteDocument = async () => {
    if (!documentToDelete || !canDeleteDocument) return;

    setDeletingDocument(true);
    try {
      await deleteDocumentLink(documentToDelete.document_link_id);
      toast.success("Document link deleted successfully");
      await loadDocuments();
    } catch (error) {
      const mapped = mapDocumentLinkAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeletingDocument(false);
      setDeleteDocumentDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleReprocessDocument = async (document: DocumentLinkRecord) => {
    try {
      await reprocessDocumentVectorization(document.document_link_id);
      toast.success("Document vectorization queued");
      await loadDocuments({ silent: true });
    } catch (error) {
      const mapped = mapDocumentLinkAxiosError(error);
      toast.error(mapped.message);
    }
  };

  const handleConfirmDeleteFinance = async () => {
    if (!assetId) return;

    setDeletingFinance(true);
    try {
      await deleteAssetFinance(assetId);
      toast.success("Asset finance deleted successfully");
      setFinance(null);
      setDeleteFinanceDialogOpen(false);
    } catch (error) {
      toast.error(mapAxiosErrorMessage(error));
    } finally {
      setDeletingFinance(false);
      setDeleteFinanceDialogOpen(false);
    }
  };

  const handleConfirmDeleteLocation = async () => {
    if (!assetId) return;

    setDeletingLocation(true);
    try {
      await deleteAssetLocation(assetId);
      toast.success("Asset location deleted successfully");
      setLocation(null);
      setDeleteLocationDialogOpen(false);
    } catch (error) {
      toast.error(mapAxiosErrorMessage(error));
    } finally {
      setDeletingLocation(false);
      setDeleteLocationDialogOpen(false);
    }
  };

  const handleRegenerateAssessment = async (release: ReleaseRecord) => {
    try {
      await regenerateImpactAssessment(release.release_id);
      toast.success("Impact assessment regenerated successfully");
      if (assessmentReleaseId === release.release_id) {
        setAssessmentReloadToken((previous) => previous + 1);
      }
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    }
  };

  const handleDownloadAssessment = async (release: ReleaseRecord) => {
    try {
      const fileName = await downloadImpactAssessment(release.release_id);
      toast.success(fileName ? `Impact assessment downloaded: ${fileName}` : "Impact assessment downloaded");
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    }
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title="Asset Master Detail"
        width="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] lg:w-[calc(100vw-15rem)]"
      >
        <div className="p-5">
          {loading ? (
            <p className="text-sm text-slate-600">Loading asset details...</p>
          ) : !asset ? (
            <p className="text-sm text-slate-600">No asset selected.</p>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as AssetDetailTab)}
              className="gap-4"
            >
              <TabsList className="h-auto flex-wrap justify-start bg-slate-100">
                <TabsTrigger value="overview" className="px-4">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="location" className="px-4">
                  Location
                </TabsTrigger>
                <TabsTrigger value="finance" className="px-4">
                  Finance
                </TabsTrigger>
                <TabsTrigger value="releases" className="px-4">
                  Releases
                </TabsTrigger>
                <TabsTrigger value="supplier-evaluation" className="px-4">
                  Supplier Eval
                </TabsTrigger>
                <TabsTrigger value="document-hub" className="px-4">
                  Document Hub
                </TabsTrigger>
                <TabsTrigger value="rag-insights" className="px-4">
                  RAG Insights
                </TabsTrigger>
                <TabsTrigger value="documents" className="px-4">
                  Documents
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Asset ID</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{formatValue(asset.asset_id)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Asset Class</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {findLookupLabel(assetClasses, asset.asset_class)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {asset.can_create_release ? "Release-enabled" : "Release not enabled"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Lifecycle Status</p>
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getAssetStatusBadgeClass(
                          asset.asset_status,
                        )}`}
                      >
                        {findLookupLabel(assetStatuses, asset.asset_status)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Criticality {findLookupLabel(criticalities, asset.criticality_class)}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Core Identity</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoField label="Asset Name" value={formatValue(asset.asset_name)} />
                    <InfoField label="Short Description" value={formatValue(asset.short_description)} />
                    <InfoField label="Organization" value={organization} />
                    <InfoField label="Supplier" value={supplier} />
                    <InfoField label="Asset Owner" value={formatValue(asset.asset_owner)} />
                    <InfoField label="Record UUID" value={formatValue(asset.asset_uuid)} />
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">Physical Location</h4>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setActiveTab("location")}
                    >
                      {locationForAsset ? "Manage Location" : "Add Location"}
                    </Button>
                  </div>

                  {locationLoading && !locationForAsset ? (
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                      Loading asset location...
                    </div>
                  ) : !locationForAsset ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
                      <h4 className="text-sm font-semibold text-slate-900">No physical location recorded</h4>
                      <p className="mt-2 text-sm text-slate-500">
                        Add building, floor, and local reference details so teams can locate this asset precisely within the site.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <InfoField label="Site / Entity" value={organization} />
                        <InfoField label="Building" value={formatValue(locationForAsset.building_reference)} />
                        <InfoField label="Floor / Level" value={formatValue(locationForAsset.floor_reference)} />
                        <InfoField label="Local Reference" value={formatValue(locationForAsset.local_reference)} />
                      </div>

                      {locationForAsset.remarks ? (
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Location Remarks</p>
                          <p className="mt-2 text-sm text-slate-800">{locationForAsset.remarks}</p>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Classification</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoField label="Asset Class" value={findLookupLabel(assetClasses, asset.asset_class)} />
                    <InfoField label="Asset Category" value={findLookupLabel(assetCategories, asset.asset_category)} />
                    <InfoField
                      label="Asset Sub-category"
                      value={findLookupLabel(assetSubCategories, asset.asset_sub_category)}
                    />
                    <InfoField label="Asset Type" value={findLookupLabel(assetTypes, asset.asset_type)} />
                    <div className="space-y-1 rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Criticality</p>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getCriticalityBadgeClass(
                          asset.criticality_class,
                        )}`}
                      >
                        {findLookupLabel(criticalities, asset.criticality_class)}
                      </span>
                    </div>
                    <InfoField label="Asset Nature" value={findLookupLabel(assetNatures, asset.asset_nature)} />
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Tracking Identifiers</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoField label="Legacy ID" value={formatValue(asset.legacy_id)} />
                    <InfoField label="Serial Number" value={formatValue(asset.serial_number)} />
                    <InfoField label="Tag Number" value={formatValue(asset.tag_number)} />
                    <InfoField label="QR / Barcode" value={formatValue(asset.qr_barcode)} />
                    <InfoField label="RFID Tag" value={formatValue(asset.rfid_tag)} />
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Description And Tags</h4>
                  </div>
                  <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-sm text-slate-800">{formatValue(asset.asset_description)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Tags</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tagList.length > 0 ? (
                        tagList.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">No tags recorded</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Commercial And Lifecycle</h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoField label="Manufacturer" value={formatValue(asset.manufacturer)} />
                    <InfoField label="Model" value={formatValue(asset.model)} />
                    <InfoField label="Version" value={formatValue(asset.asset_version)} />
                    <InfoField label="Asset Value" value={formatCurrencyValue(asset.asset_value, asset.asset_currency)} />
                    <InfoField label="Purchase Date" value={formatDate(asset.asset_purchase_dt)} />
                    <InfoField label="Commission Date" value={formatDate(asset.asset_commission_dt)} />
                    <InfoField label="Purchase Reference" value={formatValue(asset.asset_purchase_ref)} />
                    <InfoField
                      label="Warranty"
                      value={asset.warranty_period ? `${asset.warranty_period} months` : "-"}
                    />
                    <InfoField label="Release Reference URL" value={formatValue(asset.asset_release_url)} />
                  </div>
                </div>

                <AssetLifecycleTimeline asset={asset} assetStatuses={assetStatuses} />
              </TabsContent>

              <TabsContent value="location" className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-500">Asset Name</p>
                        <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_name)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Asset ID</p>
                        <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_id)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Site / Entity</p>
                        <p className="text-sm font-medium text-slate-900">{organization}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Location Record</p>
                        <p className="text-sm font-medium text-slate-900">{locationForAsset ? "Configured" : "Not yet added"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={() => setLocationModalOpen(true)} disabled={!assetId}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={locationForAsset ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 4v16m8-8H4"}
                          />
                        </svg>
                        {locationForAsset ? "Edit Location" : "Add Location"}
                      </Button>
                      {locationForAsset ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleDeleteLocationClick}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {locationLoading && !locationForAsset ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                    Loading asset location details...
                  </div>
                ) : !locationForAsset ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
                    <h4 className="text-sm font-semibold text-slate-900">No location record linked</h4>
                    <p className="mt-2 text-sm text-slate-500">
                      Add building, floor, and local reference details to show exactly where this asset sits inside its site.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs text-slate-500">Building</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{formatValue(locationForAsset.building_reference)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs text-slate-500">Floor / Level</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{formatValue(locationForAsset.floor_reference)}</p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs text-slate-500">Local Reference</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{formatValue(locationForAsset.local_reference)}</p>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Placement Context</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <InfoField label="Site / Entity" value={organization} />
                        <InfoField label="Asset" value={formatValue(asset.asset_name)} />
                        <InfoField label="Building Reference" value={formatValue(locationForAsset.building_reference)} />
                        <InfoField label="Floor / Level" value={formatValue(locationForAsset.floor_reference)} />
                        <InfoField label="Local Reference" value={formatValue(locationForAsset.local_reference)} />
                        <InfoField
                          label="Last Updated"
                          value={formatDate(locationForAsset.modified_dt ?? locationForAsset.created_dt)}
                        />
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Remarks</h4>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <p className="text-sm text-slate-800">
                          {locationForAsset.remarks?.trim() ? locationForAsset.remarks : "No location remarks recorded."}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="finance" className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-500">Asset Name</p>
                        <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_name)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Asset ID</p>
                        <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_id)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Organization</p>
                        <p className="text-sm font-medium text-slate-900">{organization}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Finance Record</p>
                        <p className="text-sm font-medium text-slate-900">{finance ? "Configured" : "Not yet added"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button type="button" size="sm" onClick={() => setFinanceModalOpen(true)} disabled={!assetId}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d={finance ? "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" : "M12 4v16m8-8H4"}
                          />
                        </svg>
                        {finance ? "Edit Finance" : "Add Finance"}
                      </Button>
                      {finance ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={handleDeleteFinanceClick}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {financeLoading ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
                    Loading asset finance details...
                  </div>
                ) : !finance ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
                    <h4 className="text-sm font-semibold text-slate-900">No finance record linked</h4>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs text-slate-500">Acquisition Cost</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatCurrencyValue(finance.acquisition_cost, finance.currency_code)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs text-slate-500">Book Value</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">
                          {formatCurrencyValue(finance.book_value, finance.currency_code)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                        <p className="text-xs text-slate-500">Finance Supplier</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{financeSupplier}</p>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Procurement / Source</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <InfoField label="Acquisition Date" value={formatDate(finance.acquisition_dt)} />
                        <InfoField label="Supplier" value={financeSupplier} />
                        <InfoField label="Purchase Order No" value={formatValue(finance.purchase_order_no)} />
                        <InfoField label="Invoice Reference" value={formatValue(finance.invoice_ref)} />
                        <InfoField label="Make" value={formatValue(finance.make)} />
                        <InfoField label="Model" value={formatValue(finance.model)} />
                        <InfoField label="Manufacturer" value={formatValue(finance.manufacturer)} />
                        <InfoField label="OEM Release URL" value={formatValue(finance.oem_release_url)} />
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Capitalization / Cost</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <InfoField label="Capitalization Date" value={formatDate(finance.capitalization_date)} />
                        <InfoField label="Currency" value={findLookupLabel(currencies, finance.currency_code)} />
                        <InfoField label="Acquisition Cost" value={formatCurrencyValue(finance.acquisition_cost, finance.currency_code)} />
                        <InfoField label="Accumulated Depreciation" value={formatCurrencyValue(finance.accumulated_depreciation, finance.currency_code)} />
                        <InfoField label="Book Value" value={formatCurrencyValue(finance.book_value, finance.currency_code)} />
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Valuation / Insurance</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <InfoField label="Replacement Value" value={formatCurrencyValue(finance.replacement_value, finance.currency_code)} />
                        <InfoField label="Insured Value" value={formatCurrencyValue(finance.insured_value, finance.currency_code)} />
                        <InfoField label="Salvage Value" value={formatCurrencyValue(finance.salvage_value, finance.currency_code)} />
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Depreciation</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <InfoField label="Depreciation Method" value={findLookupLabel(depreciationMethods, finance.depreciation_method)} />
                        <InfoField label="Useful Life" value={`${finance.useful_life_years} years`} />
                        <InfoField label="Depreciation Rate" value={formatPercentValue(finance.depreciation_rate_pct)} />
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">Accounting / Project Codes</h4>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <InfoField label="Cost Center" value={formatValue(finance.cost_center)} />
                        <InfoField label="GL Account Capex" value={formatValue(finance.gl_account_capex)} />
                        <InfoField label="Asset Class GL" value={findLookupLabel(assetClassGlOptions, finance.asset_class_gl)} />
                        <InfoField label="WBS Element" value={formatValue(finance.wbs_element)} />
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="releases" className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs text-slate-500">Asset Name</p>
                        <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_name)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Asset ID</p>
                        <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_id)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Asset Class</p>
                        <p className="text-sm font-medium text-slate-900">
                          {findLookupLabel(assetClasses, asset.asset_class)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Current Version</p>
                        <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_version)}</p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setCreateReleaseOpen(true)}
                      disabled={!assetId || !asset.can_create_release}
                      title={releaseDisabledReason ?? "Create release"}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Create Release
                    </Button>
                  </div>

                  {releaseDisabledReason ? (
                    <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {releaseDisabledReason}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs text-slate-500">Total Releases</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{sortedReleases.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs text-slate-500">Latest Version</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{latestRelease?.version || "-"}</p>
                    {latestRelease?.created_dt ? (
                      <p className="mt-1 text-xs text-slate-500">Created {formatDate(latestRelease.created_dt)}</p>
                    ) : null}
                  </div>
                </div>

                <AssetReleaseTable
                  releases={sortedReleases}
                  loading={releasesLoading}
                  onView={handleViewAssessment}
                  onRegenerateAssessment={handleRegenerateAssessment}
                  onDownloadAssessment={handleDownloadAssessment}
                  onEdit={(release) => setEditReleaseId(release.release_id)}
                  onDelete={handleDeleteReleaseClick}
                  onDocuments={(release) => setReleaseDocumentsTarget(release)}
                />
              </TabsContent>

              <TabsContent value="supplier-evaluation" className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-slate-500">Asset Name</p>
                      <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_name)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Asset ID</p>
                      <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_id)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Workflow</p>
                      <p className="text-sm font-medium text-slate-900">Supplier response and selection</p>
                    </div>
                  </div>
                </div>

                <SupplierEvaluationPanel
                  enabled={open && activeTab === "supplier-evaluation"}
                  assetId={assetId}
                  assetName={asset?.asset_name ?? null}
                  assetCode={asset?.asset_id ?? null}
                  suppliers={suppliers}
                  releases={sortedReleases}
                  sourceSystemOptions={sourceSystemOptions}
                />
              </TabsContent>

              <TabsContent value="document-hub" className="space-y-4">
                <AssetDocumentHubPanel
                  enabled={open && activeTab === "document-hub"}
                  asset={asset}
                  sourceSystemOptions={sourceSystemOptions}
                />
              </TabsContent>

              <TabsContent value="rag-insights" className="space-y-4">
                <AssetRagInsightsPanel
                  enabled={open && activeTab === "rag-insights"}
                  assetId={assetId}
                  assetName={asset.asset_name}
                  assetCode={asset.asset_id}
                  assetVersion={asset.asset_version}
                  sourceSystemOptions={sourceSystemOptions}
                />
              </TabsContent>

              <TabsContent value="documents" className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs text-slate-500">Asset Name</p>
                        <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_name)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Asset ID</p>
                        <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_id)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Asset Version</p>
                        <p className="text-sm font-medium text-slate-900">{formatValue(asset.asset_version)}</p>
                      </div>
                    </div>

                    <AuthoredDocumentPanel
                      enabled={open && activeTab === "documents"}
                      context={assetAuthoredDocumentContext}
                      variant="dropdown"
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Linked Documents : {documents.length}</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-expanded={linkedDocumentsOpen}
                        onClick={() => setLinkedDocumentsOpen((previous) => !previous)}
                        disabled={!assetId}
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${linkedDocumentsOpen ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                        {linkedDocumentsOpen ? "Hide Docs" : "View Docs"}
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                          {documents.length}
                        </span>
                      </Button>

                      {canCreateDocument ? <Button type="button" size="sm" onClick={() => setCreateDocumentOpen(true)} disabled={!assetId}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                        Add Document
                      </Button> : null}
                    </div>
                  </div>

                  {linkedDocumentsOpen ? (
                    <>
                      <AssetDocumentTable
                        documents={documents}
                        loading={documentsLoading}
                        onEdit={(document) => setEditDocumentId(document.document_link_id)}
                        onDelete={handleDeleteDocumentClick}
                        onReprocess={(document) => void handleReprocessDocument(document)}
                        canUpdate={canUpdateDocument}
                        canDelete={canDeleteDocument}
                        sourceSystemOptions={sourceSystemOptions}
                      />
                    </>
                  ) : null}
                </div>

                <QualificationDocumentPanel
                  enabled={open && activeTab === "documents"}
                  context={assetQualificationDocumentContext}
                  suppliers={suppliers}
                  releaseOptions={sortedReleases}
                  sourceSystemOptions={sourceSystemOptions}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </Drawer>

      <AssetFinanceModal
        open={open && financeModalOpen}
        assetId={assetId}
        assetName={asset?.asset_name}
        assetCode={asset?.asset_id}
        finance={finance}
        suppliers={suppliers}
        currencies={currencies}
        depreciationMethods={depreciationMethods}
        assetClassGlOptions={assetClassGlOptions}
        onClose={() => setFinanceModalOpen(false)}
        onSaved={async () => {
          await loadFinance();
          setFinanceModalOpen(false);
        }}
      />

      <AssetLocationModal
        open={open && locationModalOpen}
        assetId={assetId}
        assetName={asset?.asset_name}
        assetCode={asset?.asset_id}
        organization={organization}
        location={locationForAsset}
        onClose={() => setLocationModalOpen(false)}
        onSaved={async () => {
          await loadLocation();
          setLocationModalOpen(false);
        }}
      />

      <CreateReleaseModal
        open={createReleaseOpen}
        assetId={assetId}
        assetName={asset?.asset_name}
        onClose={() => setCreateReleaseOpen(false)}
        onCreated={async () => {
          await loadReleases();
          setCreateReleaseOpen(false);
        }}
      />

      <EditReleaseModal
        open={Boolean(editReleaseId)}
        releaseId={editReleaseId}
        onClose={() => setEditReleaseId(null)}
        onUpdated={async () => {
          await loadReleases();
          setEditReleaseId(null);
        }}
      />

      {canCreateDocument ? <CreateDocumentLinkModal
        open={open && createDocumentOpen}
        context={assetDocumentContext}
        sourceSystemOptions={sourceSystemOptions}
        onClose={() => setCreateDocumentOpen(false)}
        onCreated={async () => {
          await loadDocuments();
          setCreateDocumentOpen(false);
        }}
      /> : null}

      {canUpdateDocument ? <EditDocumentLinkModal
        open={open && Boolean(editDocumentId)}
        documentLinkId={editDocumentId}
        context={assetDocumentContext}
        sourceSystemOptions={sourceSystemOptions}
        onClose={() => setEditDocumentId(null)}
        onUpdated={async () => {
          await loadDocuments();
          setEditDocumentId(null);
        }}
      /> : null}

      <ReleaseDocumentsModal
        open={open && Boolean(releaseDocumentsTarget)}
        release={releaseDocumentsTarget}
        assetName={asset?.asset_name}
        assetCode={asset?.asset_id}
        suppliers={suppliers}
        sourceSystemOptions={sourceSystemOptions}
        onClose={() => setReleaseDocumentsTarget(null)}
      />

      <ReleaseAssessmentModal
        open={open && Boolean(assessmentRelease)}
        release={assessmentRelease}
        assetName={asset?.asset_name}
        reloadToken={assessmentReloadToken}
        onClose={() => setAssessmentReleaseId(null)}
      />

      <AlertDialog open={deleteReleaseDialogOpen} onOpenChange={setDeleteReleaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Release</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete release "{releaseToDelete?.version}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRelease}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteRelease();
              }}
              disabled={deletingRelease}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingRelease ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteFinanceDialogOpen} onOpenChange={setDeleteFinanceDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset Finance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the finance and valuation record for this asset? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingFinance}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteFinance();
              }}
              disabled={deletingFinance}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingFinance ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteLocationDialogOpen} onOpenChange={setDeleteLocationDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the physical location record for this asset? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLocation}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteLocation();
              }}
              disabled={deletingLocation}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingLocation ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteDocumentDialogOpen} onOpenChange={setDeleteDocumentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Link</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete document "{documentToDelete?.document_name}" from this asset?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDocument}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleConfirmDeleteDocument();
              }}
              disabled={deletingDocument}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingDocument ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}




