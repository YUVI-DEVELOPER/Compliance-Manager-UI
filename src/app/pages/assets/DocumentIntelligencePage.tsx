import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileJson, ListTree, RefreshCw, RotateCw, Workflow } from "lucide-react";
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
  getVectorizationStatusBadgeClass,
  loadOmsSourceSystemOptions,
} from "../../components/assets/documentLinkForm.shared";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { LookupOption } from "../../services/lookupValue.service";

interface IntelligenceAssetRow {
  asset: AssetRecord;
  summary: AssetVectorizationSummary;
  documents: AssetVectorizationDocument[];
}

interface IntelligenceDocumentRow {
  asset: AssetRecord;
  document: AssetVectorizationDocument;
}

const ACTIVE_STATUSES = new Set(["PENDING", "QUEUED", "PROCESSING"]);

const normalize = (value?: string | null): string => (value ?? "").trim();
const normalizeStatus = (value?: string | null): string => normalize(value).toUpperCase();

const getInitialAssetFilter = (): string => {
  if (typeof window === "undefined") return "ALL";
  return new URLSearchParams(window.location.search).get("asset_id") || "ALL";
};

const updateAssetQueryParam = (assetId: string) => {
  const url = new URL(window.location.href);
  url.pathname = "/document-intelligence";
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

export function DocumentIntelligencePage() {
  const header = getPageHeaderConfig("document-intelligence");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [assetRows, setAssetRows] = useState<IntelligenceAssetRow[]>([]);
  const [sourceSystemOptions, setSourceSystemOptions] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState(getInitialAssetFilter);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [selectedDocument, setSelectedDocument] = useState<AssetVectorizationDocument | null>(null);
  const [detailTab, setDetailTab] = useState<RagDetailTab>("chunks");
  const [refreshingDocumentId, setRefreshingDocumentId] = useState<string | null>(null);
  const [reprocessingDocumentId, setReprocessingDocumentId] = useState<string | null>(null);

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
      setSelectedDocument((previous) => {
        if (!previous) return null;
        const refreshed = nextRows.flatMap((row) => row.documents).find((document) => document.document_link_id === previous.document_link_id);
        return refreshed ?? previous;
      });
      if (scopedAsset && scopedAsset.asset_uuid !== assetFilter) {
        setAssetFilter(scopedAsset.asset_uuid);
        updateAssetQueryParam(scopedAsset.asset_uuid);
      }
    } catch (error) {
      console.error("Failed to load document intelligence:", error);
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

  const typeOptions = useMemo(
    () => Array.from(new Set(allDocumentRows.map((row) => normalize(row.document.document_type)).filter(Boolean))).sort(),
    [allDocumentRows],
  );
  const sourceOptions = useMemo(
    () => Array.from(new Set(allDocumentRows.map((row) => normalize(row.document.source_system) || "UNKNOWN"))).sort(),
    [allDocumentRows],
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(allDocumentRows.map((row) => normalizeStatus(row.document.vectorization_status) || "UNKNOWN"))).sort(),
    [allDocumentRows],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return allDocumentRows.filter(({ asset, document }) => {
      const status = normalizeStatus(document.vectorization_status) || "UNKNOWN";
      const source = normalize(document.source_system) || "UNKNOWN";
      const documentType = normalize(document.document_type);
      if (statusFilter !== "ALL" && status !== statusFilter) return false;
      if (typeFilter !== "ALL" && documentType !== typeFilter) return false;
      if (sourceFilter !== "ALL" && source !== sourceFilter) return false;
      if (!query) return true;

      return [
        document.document_name,
        document.document_type,
        document.source_system,
        document.external_document_id,
        document.source_reference,
        document.source_context,
        document.current_stage,
        document.last_error,
        asset.asset_id,
        asset.asset_name,
      ]
        .map((value) => normalize(value).toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [allDocumentRows, search, sourceFilter, statusFilter, typeFilter]);

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

  const aggregateSummary = useMemo(
    () =>
      assetRows.reduce(
        (total, row) => ({
          linked: total.linked + row.summary.total_linked_documents,
          tracked: total.tracked + row.summary.tracked_document_count,
          chunks: total.chunks + row.summary.total_chunk_count,
        }),
        { linked: 0, tracked: 0, chunks: 0 },
      ),
    [assetRows],
  );

  const headerStats = buildPageHeaderStats(header.stats, {
    documents: filteredRows.length,
    completed: filteredRows.filter((row) => normalizeStatus(row.document.vectorization_status) === "COMPLETED").length,
    active: filteredRows.filter((row) => ACTIVE_STATUSES.has(normalizeStatus(row.document.vectorization_status))).length,
    failed: filteredRows.filter((row) => normalizeStatus(row.document.vectorization_status) === "FAILED").length,
  });

  const handleAssetFilterChange = (value: string) => {
    setAssetFilter(value);
    updateAssetQueryParam(value);
  };

  const openDetail = (document: AssetVectorizationDocument, tab: RagDetailTab) => {
    setSelectedDocument(document);
    setDetailTab(tab);
  };

  const handleRefreshDocument = async (document: AssetVectorizationDocument) => {
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
    setReprocessingDocumentId(document.document_link_id);
    try {
      await reprocessDocumentVectorization(document.document_link_id);
      toast.success("Document vectorization queued");
      await loadPage({ silent: true });
    } catch (error) {
      console.error("Failed to reprocess vectorization:", error);
      toast.error("Failed to reprocess vectorization");
    } finally {
      setReprocessingDocumentId(null);
    }
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
          placeholder: header.searchPlaceholder || "Search document intelligence...",
          onChange: setSearch,
          onClear: () => setSearch(""),
          disabled: loading,
        }}
        stats={headerStats}
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
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Linked Documents</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{aggregateSummary.linked}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Tracked Documents</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{aggregateSummary.tracked}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-xs text-slate-500">Chunks</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{aggregateSummary.chunks}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Vectorization Work Queue</p>
              <p className="mt-1 text-xs text-slate-500">Chunks, JSON, process timeline, refresh, retry, and status are managed here by Asset ID.</p>
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
                  className="h-9 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  disabled={loading}
                >
                  <option value="ALL">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{formatVectorizationStatus(status)}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span>Type</span>
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="h-9 min-w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  disabled={loading}
                >
                  <option value="ALL">All types</option>
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>{formatDocumentLinkType(type)}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span>Source</span>
                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  className="h-9 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  disabled={loading}
                >
                  <option value="ALL">All sources</option>
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>{formatDocumentSourceSystem(source === "UNKNOWN" ? null : source, sourceSystemOptions)}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-white">
                  <TableHead className="min-w-[15rem] font-semibold">Asset</TableHead>
                  <TableHead className="min-w-[17rem] font-semibold">Document</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Source</TableHead>
                  <TableHead className="font-semibold">File</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Chunks</TableHead>
                  <TableHead className="font-semibold">Requested</TableHead>
                  <TableHead className="font-semibold">Completed</TableHead>
                  <TableHead className="min-w-[12rem] font-semibold">Last Error</TableHead>
                  <TableHead className="min-w-[18rem] font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-slate-500">
                      Loading document intelligence...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="py-10 text-center text-slate-500">
                      No vectorization records match the current view.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map(({ asset, document }) => {
                    const extension = document.extension || document.original_file_name?.split(".").pop() || "-";
                    const isRefreshing = refreshingDocumentId === document.document_link_id;
                    const isReprocessing = reprocessingDocumentId === document.document_link_id;

                    return (
                      <TableRow key={document.document_link_id} className="hover:bg-slate-50">
                        <TableCell className="align-top">
                          <div className="font-medium text-slate-900">{asset.asset_name || "-"}</div>
                          <p className="mt-1 text-xs text-slate-500">{asset.asset_id || asset.asset_uuid}</p>
                          {selectedAsset?.asset_uuid === asset.asset_uuid ? (
                            <Badge variant="outline" className="mt-2 border-blue-200 bg-blue-50 text-blue-700">Filtered</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="max-w-[22rem] break-words font-medium leading-5 text-slate-900">
                            {formatValue(document.document_name)}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{formatValue(document.source_context)}</p>
                          {document.release_version ? (
                            <Badge variant="outline" className="mt-2 border-blue-200 bg-blue-50 text-blue-700">
                              Release {document.release_version}
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                            {formatDocumentLinkType(document.document_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                            {formatDocumentSourceSystem(document.source_system, sourceSystemOptions)}
                          </Badge>
                          <p className="mt-2 max-w-[10rem] truncate text-xs text-slate-500" title={document.external_document_id ?? undefined}>
                            {formatValue(document.external_document_id)}
                          </p>
                        </TableCell>
                        <TableCell className="align-top">
                          <p className="text-sm text-slate-700">{String(extension).toUpperCase()}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatFileSize(document.file_size)}</p>
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant="outline" className={getVectorizationStatusBadgeClass(document.vectorization_status)} title={document.current_stage ?? undefined}>
                            {formatVectorizationStatus(document.vectorization_status)}
                          </Badge>
                          {document.current_stage ? (
                            <p className="mt-2 text-xs text-slate-500">{formatVectorizationStatus(document.current_stage)}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-top">{document.chunk_count ?? "-"}</TableCell>
                        <TableCell className="align-top" title={document.requested_at ?? undefined}>
                          {formatDocumentLinkDate(document.requested_at)}
                        </TableCell>
                        <TableCell className="align-top" title={document.completed_at ?? undefined}>
                          {formatDocumentLinkDate(document.completed_at)}
                        </TableCell>
                        <TableCell className="align-top">
                          {document.last_error ? (
                            <p className="max-w-[14rem] truncate text-xs text-red-600" title={document.last_error}>
                              {document.last_error}
                            </p>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => openDetail(document, "chunks")}>
                              <ListTree className="size-4" />
                              Chunks
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => openDetail(document, "report")}>
                              <FileJson className="size-4" />
                              JSON
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => openDetail(document, "process")}>
                              <Workflow className="size-4" />
                              Process
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => void handleRefreshDocument(document)}
                              disabled={isRefreshing}
                              title="Refresh Status"
                            >
                              <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
                            </Button>
                            {document.can_reprocess ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void handleReprocessDocument(document)}
                                disabled={isReprocessing}
                                title="Retry Vectorization"
                              >
                                <RotateCw className={`size-4 ${isReprocessing ? "animate-spin" : ""}`} />
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

      <Dialog open={Boolean(selectedDocument)} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <DialogTitle>{selectedDocument?.document_name || "Document Intelligence"}</DialogTitle>
            <DialogDescription>
              {[
                selectedDocument ? formatDocumentLinkType(selectedDocument.document_type) : null,
                selectedDocument?.source_context,
                selectedDocument?.vectorization_status ? formatVectorizationStatus(selectedDocument.vectorization_status) : null,
              ].filter(Boolean).join(" | ")}
            </DialogDescription>
          </DialogHeader>

          {selectedDocument ? (
            <Tabs value={detailTab} onValueChange={(value) => setDetailTab(value as RagDetailTab)} className="max-h-[78vh] overflow-hidden px-5 py-4">
              <TabsList className="grid h-auto w-full max-w-2xl grid-cols-3 bg-slate-100">
                <TabsTrigger value="chunks" className="px-4">Chunks</TabsTrigger>
                <TabsTrigger value="report" className="px-4">JSON Report</TabsTrigger>
                <TabsTrigger value="process" className="px-4">RAG Process</TabsTrigger>
              </TabsList>
              <div className="mt-4 max-h-[68vh] overflow-y-auto pr-1">
                <TabsContent value="chunks">
                  <DocumentChunkViewer document={selectedDocument} />
                </TabsContent>
                <TabsContent value="report">
                  <DocumentJsonReportViewer document={selectedDocument} />
                </TabsContent>
                <TabsContent value="process">
                  <DocumentRagProcessTimeline document={selectedDocument} />
                </TabsContent>
              </div>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>

      <Toaster position="top-right" richColors />
    </div>
  );
}
