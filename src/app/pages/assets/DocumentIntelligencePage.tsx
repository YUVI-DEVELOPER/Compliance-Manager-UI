import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, Eye, FileJson, ListTree, RefreshCw, RotateCw, Search, Workflow } from "lucide-react";
import { toast, Toaster } from "sonner";

import { AssetRecord, getAssets } from "../../../services/asset.service";
import { reprocessDocumentVectorization } from "../../../services/document-link.service";
import {
  AssetVectorizationDocument,
  AssetVectorizationSummary,
  getAssetVectorizationDocuments,
  getAssetVectorizationSummary,
  refreshDocumentVectorization,
} from "../../../services/document-vectorization.service";
import { useAuth } from "../../auth/useAuth";
import {
  DocumentChunkViewer,
  DocumentJsonReportViewer,
  DocumentRagProcessTimeline,
  RagDetailTab,
} from "../../components/assets/AssetRagInsightsPanel";
import {
  formatDocumentLinkDate,
  formatDocumentLinkType,
  formatDocumentSourceSystem,
  formatVectorizationStatus,
  loadOmsSourceSystemOptions,
} from "../../components/assets/documentLinkForm.shared";
import { ConfirmStrip, EmptyState, FilterBar, RightPanel, SearchableCombobox, StatusBadge } from "../../components/foundation";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { LookupOption } from "../../services/lookupValue.service";
import { navigateToDocumentPortal } from "../../utils/moduleNavigation";

interface IntelligenceAssetRow {
  asset: AssetRecord;
  summary: AssetVectorizationSummary;
  documents: AssetVectorizationDocument[];
}

interface IntelligenceDocumentRow {
  asset: AssetRecord;
  document: AssetVectorizationDocument;
}

type StatusTab = "ALL" | "PROCESSING" | "COMPLETED" | "FAILED";
type DetailTab = "overview" | RagDetailTab;

const ACTIVE_STATUSES = new Set(["PENDING", "QUEUED", "PROCESSING", "IN_PROGRESS", "RUNNING", "NEW"]);
const COMPLETED_STATUSES = new Set(["COMPLETED", "VECTORIZED", "SUCCESS", "SUCCEEDED"]);
const FAILED_STATUSES = new Set(["FAILED", "ERROR"]);
const INACTIVE_STATUSES = new Set(["ARCHIVED", "INACTIVE", "NOT_SUPPORTED_FOR_VECTORIZATION", "UNSUPPORTED"]);
const STATUS_TABS: Array<{ value: StatusTab; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PROCESSING", label: "Processing" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
];

const normalize = (value?: string | null): string => (value ?? "").trim();
const normalizeStatus = (value?: string | null): string => normalize(value).toUpperCase();

const getInitialQuery = (): { assetId: string; documentId: string | null } => {
  if (typeof window === "undefined") return { assetId: "ALL", documentId: null };
  const params = new URLSearchParams(window.location.search);
  return {
    assetId: params.get("asset_id") || "ALL",
    documentId: params.get("document_id"),
  };
};

const updateDocumentIntelligenceQuery = (assetId: string | null, documentId?: string | null) => {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.pathname = "/document-intelligence";

  if (assetId && assetId !== "ALL") {
    url.searchParams.set("asset_id", assetId);
  } else {
    url.searchParams.delete("asset_id");
  }

  if (documentId) {
    url.searchParams.set("document_id", documentId);
  } else {
    url.searchParams.delete("document_id");
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
};

const findAssetByToken = (assets: AssetRecord[], token?: string | null): AssetRecord | null => {
  if (!token || token === "ALL") return null;
  return assets.find((asset) => asset.asset_uuid === token || asset.asset_id === token || asset.asset_code === token) ?? null;
};

const assetLabel = (asset: AssetRecord | null): string =>
  asset?.asset_name || asset?.asset_id || asset?.asset_code || asset?.asset_uuid || "Unknown asset";

const emptySummary = (assetId: string): AssetVectorizationSummary => ({
  asset_id: assetId,
  total_linked_documents: 0,
  tracked_document_count: 0,
  total_vectorized_documents: 0,
  pending_or_queued_count: 0,
  processing_count: 0,
  completed_count: 0,
  failed_count: 0,
  unsupported_count: 0,
  total_chunk_count: 0,
  last_requested_at: null,
  last_completed_at: null,
});

const formatValue = (value?: string | number | null): string => {
  if (value === undefined || value === null || String(value).trim() === "") return "-";
  return String(value);
};

const formatFileSize = (value?: number | null): string => {
  if (!value) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const compareDocuments = (left: IntelligenceDocumentRow, right: IntelligenceDocumentRow): number => {
  const leftDate = Date.parse(left.document.requested_at || left.document.modified_dt || left.document.created_dt || "");
  const rightDate = Date.parse(right.document.requested_at || right.document.modified_dt || right.document.created_dt || "");
  return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
};

const statusCategory = (status?: string | null): StatusTab | "PENDING" | "INACTIVE" => {
  const normalized = normalizeStatus(status);
  if (COMPLETED_STATUSES.has(normalized)) return "COMPLETED";
  if (FAILED_STATUSES.has(normalized)) return "FAILED";
  if (INACTIVE_STATUSES.has(normalized)) return "INACTIVE";
  if (ACTIVE_STATUSES.has(normalized)) return normalized === "PENDING" || normalized === "NEW" || normalized === "QUEUED" ? "PENDING" : "PROCESSING";
  return "PENDING";
};

function VectorizationStatusBadge({ status, title }: { status?: string | null; title?: string | null }) {
  const category = statusCategory(status);
  const badgeStatus =
    category === "COMPLETED"
      ? "active"
      : category === "FAILED"
        ? "error"
        : category === "INACTIVE"
          ? "inactive"
          : "pending";
  const className =
    category === "COMPLETED"
      ? "border-green-200 bg-green-50 text-green-700"
      : category === "FAILED"
        ? "border-red-200 bg-red-50 text-red-700"
        : category === "PROCESSING"
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : category === "INACTIVE"
            ? "border-slate-200 bg-slate-100 text-slate-600"
            : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <StatusBadge status={badgeStatus} className={className} title={title ?? undefined}>
      {formatVectorizationStatus(status)}
    </StatusBadge>
  );
}

const statusMatchesTab = (status: string | null, tab: StatusTab): boolean => {
  if (tab === "ALL") return true;
  const category = statusCategory(status);
  if (tab === "PROCESSING") return category === "PROCESSING" || category === "PENDING";
  return category === tab;
};

const documentMatchesId = (document: AssetVectorizationDocument, documentId?: string | null): boolean => {
  if (!documentId) return false;
  return [
    document.document_link_id,
    document.vectorization_job?.rag_document_id,
    document.vectorization_job?.id,
    document.external_document_id,
  ].some((value) => value === documentId);
};

const lastProcessedAt = (document: AssetVectorizationDocument): string | null =>
  document.completed_at || document.vectorization_job?.completed_at || document.started_at || document.modified_dt || document.requested_at || null;

const timelineRows = (document: AssetVectorizationDocument): Array<[string, string | null | undefined]> => {
  const job = document.vectorization_job;
  return [
    ["Requested", document.requested_at || job?.requested_at],
    ["Queued", document.queued_at || job?.queued_at],
    ["Queue started", job?.queue_started_at],
    ["Processing started", document.started_at || job?.started_at],
    ["Chunking started", job?.chunking_started_at],
    ["Chunking completed", job?.chunking_completed_at],
    ["Embedding started", job?.embedding_started_at],
    ["Embedding completed", job?.embedding_completed_at],
    ["Vector write started", job?.weaviate_write_started_at],
    ["Vector write completed", job?.weaviate_write_completed_at],
    ["Completed", document.completed_at || job?.completed_at],
  ];
};

function SummaryCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number;
  status: "active" | "inactive" | "pending" | "error";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <StatusBadge status={status} />
      </div>
      <div className="mt-3 text-3xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function MetadataGrid({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
          <div className="mt-1 break-words text-sm font-semibold text-slate-900">{value || "-"}</div>
        </div>
      ))}
    </div>
  );
}

export function DocumentIntelligencePage() {
  const header = getPageHeaderConfig("document-intelligence");
  const { hasPermission } = useAuth();
  const canViewDocuments = hasPermission("DOCUMENT_VIEW");
  const canReprocessDocuments = hasPermission("DOCUMENT_UPDATE");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetRows, setAssetRows] = useState<IntelligenceAssetRow[]>([]);
  const [sourceSystemOptions, setSourceSystemOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState(() => getInitialQuery().assetId);
  const [statusFilter, setStatusFilter] = useState<StatusTab>("ALL");
  const [selectedDocument, setSelectedDocument] = useState<AssetVectorizationDocument | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [refreshingDocumentId, setRefreshingDocumentId] = useState<string | null>(null);
  const [reprocessingDocumentId, setReprocessingDocumentId] = useState<string | null>(null);
  const [pendingReprocessDocument, setPendingReprocessDocument] = useState<AssetVectorizationDocument | null>(null);
  const initialQueryRef = useRef(getInitialQuery());
  const queryDocumentHandledRef = useRef(false);

  const selectedAsset = useMemo(() => findAssetByToken(assets, assetFilter), [assetFilter, assets]);

  const loadPage = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    try {
      const [assetData, sourceOptions] = await Promise.all([getAssets(), loadOmsSourceSystemOptions()]);
      const scopedAsset = findAssetByToken(assetData, assetFilter);
      const assetsToLoad = scopedAsset ? [scopedAsset] : assetData;
      const result = await Promise.allSettled(
        assetsToLoad.map(async (asset) => {
          const [summaryResult, documentsResult] = await Promise.allSettled([
            getAssetVectorizationSummary(asset.asset_uuid),
            getAssetVectorizationDocuments(asset.asset_uuid),
          ]);

          return {
            asset,
            summary: summaryResult.status === "fulfilled" ? summaryResult.value : emptySummary(asset.asset_uuid),
            documents: documentsResult.status === "fulfilled" ? documentsResult.value : [],
          };
        }),
      );

      const nextRows = result.flatMap((item) => (item.status === "fulfilled" ? [item.value] : []));
      setAssets(assetData);
      setSourceSystemOptions(sourceOptions);
      setAssetRows(nextRows);
      setLoadError(null);
      setSelectedDocument((previous) => {
        if (!previous) return null;
        const refreshed = nextRows.flatMap((row) => row.documents).find((document) => document.document_link_id === previous.document_link_id);
        return refreshed ?? previous;
      });
      if (scopedAsset && scopedAsset.asset_uuid !== assetFilter) {
        setAssetFilter(scopedAsset.asset_uuid);
        updateDocumentIntelligenceQuery(scopedAsset.asset_uuid, initialQueryRef.current.documentId);
      }
    } catch (error) {
      console.error("Failed to load document intelligence:", error);
      setLoadError("Failed to load document intelligence.");
      toast.error("Failed to load document intelligence");
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [assetFilter]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const allDocumentRows = useMemo(
    () => assetRows.flatMap((row) => row.documents.map((document) => ({ asset: row.asset, document }))).sort(compareDocuments),
    [assetRows],
  );

  useEffect(() => {
    if (queryDocumentHandledRef.current || loading || allDocumentRows.length === 0) return;
    const documentId = initialQueryRef.current.documentId;
    if (!documentId) {
      queryDocumentHandledRef.current = true;
      return;
    }
    if (!canViewDocuments) {
      queryDocumentHandledRef.current = true;
      return;
    }

    const match = allDocumentRows.find((row) => documentMatchesId(row.document, documentId));
    if (match) {
      setSelectedDocument(match.document);
      setDetailTab("overview");
      if (match.asset.asset_uuid !== assetFilter) {
        setAssetFilter(match.asset.asset_uuid);
        updateDocumentIntelligenceQuery(match.asset.asset_uuid, documentId);
      }
    }
    queryDocumentHandledRef.current = true;
  }, [allDocumentRows, assetFilter, canViewDocuments, loading]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allDocumentRows.filter(({ asset, document }) => {
      if (!statusMatchesTab(document.vectorization_status, statusFilter)) return false;
      if (!query) return true;

      return [
        document.document_name,
        document.document_type,
        document.source_system,
        document.external_document_id,
        document.document_version,
        document.source_reference,
        document.source_context,
        document.current_stage,
        document.last_error,
        asset.asset_id,
        asset.asset_name,
        asset.asset_code,
      ]
        .map((value) => normalize(value).toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [allDocumentRows, search, statusFilter]);

  const hasActiveJobs = useMemo(
    () => allDocumentRows.some((row) => ACTIVE_STATUSES.has(normalizeStatus(row.document.vectorization_status))),
    [allDocumentRows],
  );

  useEffect(() => {
    if (!hasActiveJobs) return;

    const intervalId = window.setInterval(() => {
      void loadPage({ silent: true });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [hasActiveJobs, loadPage]);

  const summary = useMemo(() => {
    const total = allDocumentRows.length;
    const processing = allDocumentRows.filter((row) => statusMatchesTab(row.document.vectorization_status, "PROCESSING")).length;
    const completed = allDocumentRows.filter((row) => statusMatchesTab(row.document.vectorization_status, "COMPLETED")).length;
    const failed = allDocumentRows.filter((row) => statusMatchesTab(row.document.vectorization_status, "FAILED")).length;
    return { total, processing, completed, failed };
  }, [allDocumentRows]);

  const assetOptions = useMemo(
    () =>
      assets.map((asset) => ({
        value: asset.asset_uuid,
        label: assetLabel(asset),
        description: [asset.asset_id, asset.asset_code, asset.asset_status].filter(Boolean).join(" / "),
      })),
    [assets],
  );

  const selectedDocumentRow = useMemo(
    () => allDocumentRows.find((row) => row.document.document_link_id === selectedDocument?.document_link_id) ?? null,
    [allDocumentRows, selectedDocument?.document_link_id],
  );

  const activeFilters = [
    ...(search.trim()
      ? [{
          key: "search",
          label: `Search: ${search.trim()}`,
          onRemove: () => setSearch(""),
        }]
      : []),
    ...(selectedAsset
      ? [{
          key: "asset",
          label: `Asset: ${assetLabel(selectedAsset)}`,
          onRemove: () => {
            setAssetFilter("ALL");
            updateDocumentIntelligenceQuery("ALL", null);
          },
        }]
      : []),
    ...(statusFilter !== "ALL"
      ? [{
          key: "status",
          label: `Status: ${STATUS_TABS.find((tab) => tab.value === statusFilter)?.label ?? statusFilter}`,
          onRemove: () => setStatusFilter("ALL"),
        }]
      : []),
  ];

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setAssetFilter("ALL");
    updateDocumentIntelligenceQuery("ALL", null);
  };

  const handleAssetFilterChange = (value: string | null) => {
    const nextAsset = value || "ALL";
    setAssetFilter(nextAsset);
    updateDocumentIntelligenceQuery(nextAsset, null);
  };

  const openDetail = (row: IntelligenceDocumentRow, tab: DetailTab = "overview") => {
    if (!canViewDocuments) return;
    setSelectedDocument(row.document);
    setDetailTab(tab);
    updateDocumentIntelligenceQuery(row.asset.asset_uuid, row.document.document_link_id);
  };

  const closeDetail = () => {
    setSelectedDocument(null);
    setPendingReprocessDocument(null);
    updateDocumentIntelligenceQuery(assetFilter, null);
  };

  const handleViewInDocumentPortal = (row: IntelligenceDocumentRow | null) => {
    if (!row || !canViewDocuments) return;
    navigateToDocumentPortal(row.asset.asset_uuid, row.document.release_id ?? undefined, row.document.document_link_id);
  };

  const handleRefreshDocument = async (document: AssetVectorizationDocument) => {
    if (!canViewDocuments) return;
    setRefreshingDocumentId(document.document_link_id);
    try {
      const refreshed = await refreshDocumentVectorization(document.document_link_id);
      setAssetRows((previous) =>
        previous.map((row) => ({
          ...row,
          documents: row.documents.map((item) => (item.document_link_id === refreshed.document_link_id ? refreshed : item)),
        })),
      );
      setSelectedDocument((previous) => previous?.document_link_id === refreshed.document_link_id ? refreshed : previous);
      await loadPage({ silent: true });
      toast.success("Vectorization status refreshed");
    } catch (error) {
      console.error("Failed to refresh vectorization status:", error);
      toast.error("Failed to refresh vectorization status");
    } finally {
      setRefreshingDocumentId(null);
    }
  };

  const handleReprocessDocument = async (document: AssetVectorizationDocument) => {
    if (!canReprocessDocuments || !document.can_reprocess) return;
    setReprocessingDocumentId(document.document_link_id);
    try {
      await reprocessDocumentVectorization(document.document_link_id);
      toast.success("Document vectorization queued");
      setPendingReprocessDocument(null);
      await loadPage({ silent: true });
    } catch (error) {
      console.error("Failed to reprocess vectorization:", error);
      toast.error("Failed to reprocess vectorization");
    } finally {
      setReprocessingDocumentId(null);
    }
  };

  const selectedMetadata = selectedDocument && selectedDocumentRow
    ? [
        ["Document name", formatValue(selectedDocument.document_name)],
        ["Document type", formatDocumentLinkType(selectedDocument.document_type)],
        ["Linked asset", assetLabel(selectedDocumentRow.asset)],
        ["Asset ID", selectedDocumentRow.asset.asset_id || selectedDocumentRow.asset.asset_uuid],
        ["Release", selectedDocument.release_version || selectedDocument.release_id || "-"],
        ["External document ID", formatValue(selectedDocument.external_document_id)],
        ["Document version", formatValue(selectedDocument.document_version)],
        ["Source system", formatDocumentSourceSystem(selectedDocument.source_system, sourceSystemOptions)],
        ["Source context", formatValue(selectedDocument.source_context)],
        ["Original file", formatValue(selectedDocument.original_file_name)],
        ["File size", formatFileSize(selectedDocument.file_size)],
        ["Collection", formatValue(selectedDocument.collection_name || selectedDocument.vectorization_job?.weaviate_collection)],
        ["RAG document ID", formatValue(selectedDocument.vectorization_job?.rag_document_id)],
        ["Last processed", formatDocumentLinkDate(lastProcessedAt(selectedDocument))],
      ] as Array<[string, React.ReactNode]>
    : [];

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Document Intelligence"
        subtitle="Monitor document vectorization, chunk extraction, and RAG processing status"
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

      <main className={PAGE_CONTENT_CLASS}>
        <FilterBar activeFilters={activeFilters} onClearAll={activeFilters.length ? clearFilters : undefined} className="sticky top-0 z-20 shadow-sm">
          <label className="flex min-w-72 flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span>Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search document name, type, asset, or external ID..."
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-9 py-1 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                disabled={loading}
              />
            </div>
          </label>
          <SearchableCombobox
            label="Asset"
            options={assetOptions}
            value={selectedAsset?.asset_uuid ?? null}
            onChange={(value) => handleAssetFilterChange(value)}
            placeholder="All assets"
            emptyText="No assets found"
            disabled={loading}
            className="min-w-72"
          />
          <div className="flex min-w-[24rem] flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span>Status</span>
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusTab)}>
              <TabsList className="h-9 rounded-md bg-slate-100 p-1">
                {STATUS_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="h-7 rounded px-3 text-xs">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </FilterBar>

        {selectedAsset ? (
          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
            Viewing intelligence for {assetLabel(selectedAsset)}
          </div>
        ) : null}

        {loadError ? (
          <EmptyState title="Unable to load document intelligence" description={loadError} />
        ) : null}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total documents" value={summary.total} status="inactive" />
          <SummaryCard label="Processing" value={summary.processing} status="pending" />
          <SummaryCard label="Completed" value={summary.completed} status="active" />
          <SummaryCard label="Failed" value={summary.failed} status="error" />
        </section>

        {summary.failed > 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{summary.failed} document{summary.failed === 1 ? "" : "s"} need attention.</span>
          </div>
        ) : null}

        {pendingReprocessDocument && !selectedDocument ? (
          <ConfirmStrip
            title="Reprocess this document?"
            message="This queues the existing single-document vectorization workflow."
            confirmLabel="Reprocess"
            cancelLabel="Cancel"
            tone="warning"
            disabled={reprocessingDocumentId === pendingReprocessDocument.document_link_id}
            onConfirm={() => void handleReprocessDocument(pendingReprocessDocument)}
            onCancel={() => setPendingReprocessDocument(null)}
          />
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Vectorization Work Queue</h2>
              <p className="mt-1 text-sm text-slate-500">Status, chunk counts, RAG metadata, and retry actions for linked documents.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadPage()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[1180px]">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Document</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Linked asset</TableHead>
                  <TableHead className="font-semibold">External ID / Version</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Chunks</TableHead>
                  <TableHead className="font-semibold">Last processed</TableHead>
                  <TableHead className="font-semibold">Error summary</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-10 text-center text-slate-500">
                      Loading document intelligence...
                    </TableCell>
                  </TableRow>
                ) : allDocumentRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState
                        title="No documents available"
                        description="Linked documents with vectorization tracking will appear here."
                        className="my-4"
                      />
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <EmptyState
                        title="No search results"
                        description="Adjust search, asset, or status filters to see matching documents."
                        className="my-4"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((row) => {
                    const { asset, document } = row;
                    const isReprocessing = reprocessingDocumentId === document.document_link_id;

                    return (
                      <TableRow key={document.document_link_id} className={statusCategory(document.vectorization_status) === "FAILED" ? "bg-red-50/30 hover:bg-red-50" : "hover:bg-slate-50"}>
                        <TableCell className="align-top">
                          <div className="max-w-[22rem] break-words font-medium leading-5 text-slate-900">
                            {formatValue(document.document_name)}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{formatValue(document.original_file_name || document.source_context)}</p>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                            {formatDocumentLinkType(document.document_type)}
                          </Badge>
                          <p className="mt-2 text-xs text-slate-500">{formatDocumentSourceSystem(document.source_system, sourceSystemOptions)}</p>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="font-medium text-slate-900">{assetLabel(asset)}</div>
                          <p className="mt-1 text-xs text-slate-500">{asset.asset_id || asset.asset_uuid}</p>
                          {document.release_version ? (
                            <Badge variant="outline" className="mt-2 border-blue-200 bg-blue-50 text-blue-700">
                              Release {document.release_version}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="text-sm font-medium text-slate-900">{formatValue(document.external_document_id)}</div>
                          <p className="mt-1 text-xs text-slate-500">Version {formatValue(document.document_version)}</p>
                        </TableCell>
                        <TableCell className="align-top">
                          <VectorizationStatusBadge status={document.vectorization_status} title={document.current_stage} />
                          {document.current_stage ? (
                            <p className="mt-2 text-xs text-slate-500">{formatVectorizationStatus(document.current_stage)}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top">{document.chunk_count ?? "-"}</TableCell>
                        <TableCell className="align-top" title={lastProcessedAt(document) ?? undefined}>
                          {formatDocumentLinkDate(lastProcessedAt(document))}
                        </TableCell>
                        <TableCell className="align-top">
                          {document.last_error ? (
                            <p className="max-w-[16rem] truncate text-xs text-red-600" title={document.last_error}>
                              {document.last_error}
                            </p>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {canViewDocuments ? (
                              <Button type="button" size="sm" variant="outline" onClick={() => openDetail(row)}>
                                <Eye className="h-4 w-4" />
                                View Details
                              </Button>
                            ) : null}
                            {document.can_reprocess && canReprocessDocuments ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setPendingReprocessDocument(document)}
                                disabled={isReprocessing}
                              >
                                <RotateCw className={`h-4 w-4 ${isReprocessing ? "animate-spin" : ""}`} />
                                Reprocess
                              </Button>
                            ) : null}
                            {canViewDocuments ? (
                              <Button type="button" size="sm" variant="ghost" onClick={() => handleViewInDocumentPortal(row)}>
                                <ExternalLink className="h-4 w-4" />
                                Portal
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
      </main>

      <RightPanel
        open={Boolean(selectedDocument)}
        title={selectedDocument?.document_name || "Document Intelligence"}
        description={[
          selectedDocument ? formatDocumentLinkType(selectedDocument.document_type) : null,
          selectedDocument?.external_document_id,
          selectedDocument?.vectorization_status ? formatVectorizationStatus(selectedDocument.vectorization_status) : null,
        ].filter(Boolean).join(" / ")}
        onClose={closeDetail}
        widthClassName="max-w-5xl"
      >
        {selectedDocument && selectedDocumentRow ? (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <VectorizationStatusBadge status={selectedDocument.vectorization_status} title={selectedDocument.current_stage} />
                {selectedDocument.current_stage ? (
                  <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                    {formatVectorizationStatus(selectedDocument.current_stage)}
                  </Badge>
                ) : null}
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                  {selectedDocument.chunk_count ?? 0} chunks
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleRefreshDocument(selectedDocument)}
                  disabled={refreshingDocumentId === selectedDocument.document_link_id}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshingDocumentId === selectedDocument.document_link_id ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                {selectedDocument.can_reprocess && canReprocessDocuments ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setPendingReprocessDocument(selectedDocument)}
                    disabled={reprocessingDocumentId === selectedDocument.document_link_id}
                  >
                    <RotateCw className={`h-4 w-4 ${reprocessingDocumentId === selectedDocument.document_link_id ? "animate-spin" : ""}`} />
                    Reprocess
                  </Button>
                ) : null}
                {canViewDocuments ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => handleViewInDocumentPortal(selectedDocumentRow)}>
                    <ExternalLink className="h-4 w-4" />
                    View in Document Portal
                  </Button>
                ) : null}
              </div>
            </div>

            {pendingReprocessDocument?.document_link_id === selectedDocument.document_link_id ? (
              <ConfirmStrip
                title="Reprocess this document?"
                message="This queues the existing single-document vectorization workflow."
                confirmLabel="Reprocess"
                cancelLabel="Cancel"
                tone="warning"
                disabled={reprocessingDocumentId === selectedDocument.document_link_id}
                onConfirm={() => void handleReprocessDocument(selectedDocument)}
                onCancel={() => setPendingReprocessDocument(null)}
              />
            ) : null}

            {selectedDocument.last_error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {selectedDocument.last_error}
              </div>
            ) : null}

            <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as DetailTab)}>
              <TabsList className="h-auto rounded-md bg-slate-100 p-1">
                <TabsTrigger value="overview" className="rounded px-3 py-2 text-xs">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="chunks" className="rounded px-3 py-2 text-xs">
                  <ListTree className="h-4 w-4" />
                  Chunks
                </TabsTrigger>
                <TabsTrigger value="report" className="rounded px-3 py-2 text-xs">
                  <FileJson className="h-4 w-4" />
                  JSON
                </TabsTrigger>
                <TabsTrigger value="process" className="rounded px-3 py-2 text-xs">
                  <Workflow className="h-4 w-4" />
                  Logs
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {detailTab === "overview" ? (
              <div className="space-y-5">
                <MetadataGrid items={selectedMetadata} />
                <div className="rounded-md border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Processing Timeline</div>
                  <div className="grid grid-cols-1 gap-2 p-3 md:grid-cols-2">
                    {timelineRows(selectedDocument).map(([label, value]) => (
                      <div key={label} className="rounded-md bg-slate-50 px-3 py-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
                        <div className="mt-1 text-sm font-medium text-slate-900">{formatDocumentLinkDate(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {selectedDocument.vectorization_job?.metadata_json && Object.keys(selectedDocument.vectorization_job.metadata_json).length > 0 ? (
                  <div className="rounded-md border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Processing Metadata</div>
                    <pre className="max-h-72 overflow-auto bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                      {JSON.stringify(selectedDocument.vectorization_job.metadata_json, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <EmptyState title="No processing metadata" description="Metadata appears here when the vectorization job returns structured JSON." />
                )}
                {selectedDocument.vectorization_job?.process_log_json?.length ? (
                  <div className="rounded-md border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-3 py-2 text-sm font-semibold text-slate-900">Recent Process Logs</div>
                    <pre className="max-h-72 overflow-auto bg-slate-950 p-3 text-xs leading-5 text-slate-100">
                      {JSON.stringify(selectedDocument.vectorization_job.process_log_json.slice(0, 20), null, 2)}
                    </pre>
                  </div>
                ) : (
                  <EmptyState title="No process logs" description="Detailed logs are loaded from the RAG Process tab when available." />
                )}
              </div>
            ) : null}
            {detailTab === "chunks" ? <DocumentChunkViewer document={selectedDocument} /> : null}
            {detailTab === "report" ? <DocumentJsonReportViewer document={selectedDocument} /> : null}
            {detailTab === "process" ? <DocumentRagProcessTimeline document={selectedDocument} /> : null}
          </div>
        ) : null}
      </RightPanel>

      {/* TODO: Bulk retry requires backend support. */}
      <Toaster position="top-right" richColors />
    </div>
  );
}
