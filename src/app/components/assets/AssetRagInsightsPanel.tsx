import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Copy, FileJson, ListTree, RefreshCw, RotateCw, Search, Workflow } from "lucide-react";
import { toast } from "sonner";

import {
  AssetVectorizationDocument,
  AssetVectorizationSummary,
  DocumentRagProcess,
  DocumentRagProcessStage,
  DocumentVectorizationChunk,
  DocumentVectorizationChunkList,
  DocumentVectorizationReport,
  getAssetVectorizationDocuments,
  getAssetVectorizationSummary,
  getDocumentRagProcess,
  getDocumentVectorizationChunks,
  getDocumentVectorizationReport,
  refreshDocumentVectorization,
} from "../../../services/document-vectorization.service";
import { reprocessDocumentVectorization } from "../../../services/document-link.service";
import { LookupOption } from "../../services/lookupValue.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  formatDocumentLinkDate,
  formatDocumentLinkType,
  formatDocumentSourceSystem,
  formatVectorizationStatus,
  getVectorizationStatusBadgeClass,
} from "./documentLinkForm.shared";

type RagDetailTab = "chunks" | "report" | "process";

interface AssetRagInsightsPanelProps {
  enabled: boolean;
  assetId: string | null;
  assetName?: string | null;
  assetCode?: string | null;
  assetVersion?: string | null;
  sourceSystemOptions?: LookupOption[];
}

const ACTIVE_STATUSES = new Set(["PENDING", "QUEUED", "PROCESSING"]);

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

const normalizeStatus = (value?: string | null): string => (value ?? "").toUpperCase();

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

const getStageBadgeClass = (status?: string | null): string => {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "completed") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (normalized === "in_progress") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "skipped") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-slate-200 bg-white text-slate-600";
};

const formatStageStatus = (status?: string | null): string => {
  if (!status) return "Pending";
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const copyText = async (text: string, successMessage: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Copy failed");
  }
};

function AssetRagSummaryCards({ summary, loading }: { summary: AssetVectorizationSummary; loading: boolean }) {
  const cards = [
    { label: "Linked Documents", value: summary.total_linked_documents },
    { label: "Vectorized", value: summary.total_vectorized_documents },
    { label: "Pending / Queued", value: summary.pending_or_queued_count },
    { label: "Processing", value: summary.processing_count },
    { label: "Completed", value: summary.completed_count },
    { label: "Failed", value: summary.failed_count },
    { label: "Unsupported", value: summary.unsupported_count },
    { label: "Chunks", value: summary.total_chunk_count },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">{card.label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{loading ? "..." : card.value}</p>
        </div>
      ))}
    </div>
  );
}

function VectorizedDocumentsTable({
  documents,
  loading,
  refreshingDocumentId,
  reprocessingDocumentId,
  sourceSystemOptions,
  onOpenDetail,
  onRefreshDocument,
  onReprocessDocument,
}: {
  documents: AssetVectorizationDocument[];
  loading: boolean;
  refreshingDocumentId: string | null;
  reprocessingDocumentId: string | null;
  sourceSystemOptions: LookupOption[];
  onOpenDetail: (document: AssetVectorizationDocument, tab: RagDetailTab) => void;
  onRefreshDocument: (document: AssetVectorizationDocument) => void;
  onReprocessDocument: (document: AssetVectorizationDocument) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="min-w-[16rem] font-semibold">Document</TableHead>
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
              <TableCell colSpan={10} className="py-8 text-center text-slate-500">
                Loading RAG insights...
              </TableCell>
            </TableRow>
          ) : documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="py-8 text-center text-slate-500">
                No linked documents have vectorization tracking for this asset yet.
              </TableCell>
            </TableRow>
          ) : (
            documents.map((document) => {
              const status = document.vectorization_status;
              const extension = document.extension || document.original_file_name?.split(".").pop() || "-";
              const isRefreshing = refreshingDocumentId === document.document_link_id;
              const isReprocessing = reprocessingDocumentId === document.document_link_id;

              return (
                <TableRow key={document.document_link_id} className="hover:bg-slate-50">
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
                    <Badge variant="outline" className={getVectorizationStatusBadgeClass(status)} title={document.current_stage ?? undefined}>
                      {formatVectorizationStatus(status)}
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
                      <Button type="button" variant="ghost" size="sm" onClick={() => onOpenDetail(document, "chunks")}>
                        <ListTree className="size-4" />
                        Chunks
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => onOpenDetail(document, "report")}>
                        <FileJson className="size-4" />
                        JSON
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => onOpenDetail(document, "process")}>
                        <Workflow className="size-4" />
                        Process
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRefreshDocument(document)}
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
                          onClick={() => onReprocessDocument(document)}
                          disabled={isReprocessing}
                          title="Reprocess"
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
  );
}

function DocumentChunkViewer({ document }: { document: AssetVectorizationDocument }) {
  const [chunkData, setChunkData] = useState<DocumentVectorizationChunkList | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const limit = 25;

  const loadChunks = useCallback(async () => {
    setLoading(true);
    try {
      setChunkData(await getDocumentVectorizationChunks(document.document_link_id, { limit, offset, search: query || undefined }));
    } catch (error) {
      console.error("Failed to load document chunks:", error);
      toast.error("Failed to load document chunks");
    } finally {
      setLoading(false);
    }
  }, [document.document_link_id, offset, query]);

  useEffect(() => {
    setOffset(0);
    setSearchText("");
    setQuery("");
    setExpandedChunks(new Set());
  }, [document.document_link_id]);

  useEffect(() => {
    void loadChunks();
  }, [loadChunks]);

  const total = chunkData?.total ?? 0;
  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setOffset(0);
    setQuery(searchText.trim());
  };

  const toggleExpanded = (chunkId: string) => {
    setExpandedChunks((previous) => {
      const next = new Set(previous);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center">
        <label className="flex-1">
          <input
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search chunks"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <Button type="submit" size="sm" disabled={loading}>
          <Search className="size-4" />
          Search
        </Button>
      </form>

      {chunkData?.retrieval_error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {chunkData.retrieval_error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {loading ? "Loading chunks..." : `${total} chunk${total === 1 ? "" : "s"} found`}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={loading || offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>
            Previous
          </Button>
          <span className="text-xs text-slate-500">Page {page} of {pageCount}</span>
          <Button type="button" variant="outline" size="sm" disabled={loading || offset + limit >= total} onClick={() => setOffset(offset + limit)}>
            Next
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
            Loading chunk list...
          </div>
        ) : !chunkData || chunkData.chunks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
            No chunks are available for this document view.
          </div>
        ) : (
          chunkData.chunks.map((chunk: DocumentVectorizationChunk) => {
            const expanded = expandedChunks.has(chunk.chunk_id);
            return (
              <div key={chunk.chunk_id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                        {chunk.chunk_id}
                      </Badge>
                      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                        Page {chunk.page ?? "-"}
                      </Badge>
                      {chunk.category ? (
                        <Badge variant="outline" className="border-cyan-200 bg-cyan-50 text-cyan-700">
                          {chunk.category}
                        </Badge>
                      ) : null}
                      {chunk.duplicate !== null ? (
                        <Badge variant="outline" className={chunk.duplicate ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>
                          {chunk.duplicate ? "Duplicate" : "Unique"}
                        </Badge>
                      ) : null}
                      {chunk.match_percentage !== null ? (
                        <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                          {chunk.match_percentage}% match
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium text-slate-900">{formatValue(chunk.section_name)}</p>
                    <p className="text-xs text-slate-500">{formatValue(chunk.section_path)}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>{chunk.word_count} words</span>
                    <span>{chunk.chunk_length} chars</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => void copyText(chunk.text, "Chunk text copied")}>
                      <Copy className="size-4" />
                      Copy
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => toggleExpanded(chunk.chunk_id)}>
                      {expanded ? "Collapse" : "Expand"}
                    </Button>
                  </div>
                </div>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                  {expanded ? chunk.text : chunk.preview_text}
                </pre>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function DocumentJsonReportViewer({ document }: { document: AssetVectorizationDocument }) {
  const [report, setReport] = useState<DocumentVectorizationReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReport(null);
    setLoading(true);

    const run = async () => {
      try {
        const data = await getDocumentVectorizationReport(document.document_link_id);
        if (!cancelled) setReport(data);
      } catch (error) {
        console.error("Failed to load vectorization report:", error);
        if (!cancelled) toast.error("Failed to load JSON report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [document.document_link_id]);

  const jsonText = useMemo(() => JSON.stringify(report?.report ?? {}, null, 2), [report]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {loading ? "Loading JSON report..." : report ? "Metadata report" : "No metadata report available."}
        </p>
        <Button type="button" variant="outline" size="sm" disabled={!report} onClick={() => void copyText(jsonText, "JSON report copied")}>
          <Copy className="size-4" />
          Copy
        </Button>
      </div>
      <pre className="max-h-[58vh] overflow-auto rounded-lg border border-slate-200 bg-slate-950 p-4 text-xs leading-5 text-slate-100">
        {loading ? "Loading..." : report ? jsonText : "{}"}
      </pre>
    </div>
  );
}

function formatProcessTimestamp(stage: DocumentRagProcessStage): string {
  return formatDocumentLinkDate(stage.completed_at || stage.started_at || stage.timestamp);
}

function DocumentRagProcessTimeline({ document }: { document: AssetVectorizationDocument }) {
  const [process, setProcess] = useState<DocumentRagProcess | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProcess(null);
    setLoading(true);

    const run = async () => {
      try {
        const data = await getDocumentRagProcess(document.document_link_id);
        if (!cancelled) setProcess(data);
      } catch (error) {
        console.error("Failed to load RAG process:", error);
        if (!cancelled) toast.error("Failed to load RAG process");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [document.document_link_id]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
        Loading RAG process...
      </div>
    );
  }

  if (!process) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
        No RAG process detail is available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={getVectorizationStatusBadgeClass(process.status)}>
            {formatVectorizationStatus(process.status)}
          </Badge>
          {process.current_stage ? (
            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
              {formatVectorizationStatus(process.current_stage)}
            </Badge>
          ) : null}
        </div>
        {process.error_message ? (
          <p className="mt-2 text-sm text-red-600">{process.error_message}</p>
        ) : null}
      </div>

      <div className="space-y-3">
        {process.stages.map((stage) => (
          <div key={stage.key} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-semibold text-slate-900">{stage.label}</h4>
                  <Badge variant="outline" className={getStageBadgeClass(stage.status)}>
                    {formatStageStatus(stage.status)}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-slate-500">{formatProcessTimestamp(stage)}</p>
            </div>
            {stage.details && Object.keys(stage.details).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(stage.details)
                  .filter(([, value]) => value !== undefined && value !== null && value !== "")
                  .slice(0, 3)
                  .map(([key, value]) => (
                    <span key={key} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      {key}: {String(value)}
                    </span>
                  ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

    </div>
  );
}

export function AssetRagInsightsPanel({
  enabled,
  assetId,
  assetName,
  assetCode,
  assetVersion,
  sourceSystemOptions = [],
}: AssetRagInsightsPanelProps) {
  const [summary, setSummary] = useState<AssetVectorizationSummary>(() => emptySummary(assetId ?? ""));
  const [documents, setDocuments] = useState<AssetVectorizationDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<AssetVectorizationDocument | null>(null);
  const [detailTab, setDetailTab] = useState<RagDetailTab>("chunks");
  const [refreshingDocumentId, setRefreshingDocumentId] = useState<string | null>(null);
  const [reprocessingDocumentId, setReprocessingDocumentId] = useState<string | null>(null);

  const loadInsights = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!enabled || !assetId) return;

    if (!options.silent) setLoading(true);
    try {
      const [summaryData, documentData] = await Promise.all([
        getAssetVectorizationSummary(assetId),
        getAssetVectorizationDocuments(assetId),
      ]);
      setSummary(summaryData);
      setDocuments(documentData);
      setSelectedDocument((previous) => {
        if (!previous) return null;
        return documentData.find((item) => item.document_link_id === previous.document_link_id) ?? previous;
      });
    } catch (error) {
      console.error("Failed to load asset RAG insights:", error);
      if (!options.silent) toast.error("Failed to load RAG insights");
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [assetId, enabled]);

  useEffect(() => {
    if (!enabled || !assetId) {
      setDocuments([]);
      setSummary(emptySummary(assetId ?? ""));
      setLoading(false);
      setSelectedDocument(null);
      return;
    }

    void loadInsights();
  }, [assetId, enabled, loadInsights]);

  const hasActiveJobs = useMemo(
    () => documents.some((document) => ACTIVE_STATUSES.has(normalizeStatus(document.vectorization_status))),
    [documents],
  );

  useEffect(() => {
    if (!enabled || !assetId || !hasActiveJobs) return;

    const intervalId = window.setInterval(() => {
      void loadInsights({ silent: true });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [assetId, enabled, hasActiveJobs, loadInsights]);

  const handleOpenDetail = (document: AssetVectorizationDocument, tab: RagDetailTab) => {
    setSelectedDocument(document);
    setDetailTab(tab);
  };

  const handleRefreshDocument = async (document: AssetVectorizationDocument) => {
    setRefreshingDocumentId(document.document_link_id);
    try {
      const refreshed = await refreshDocumentVectorization(document.document_link_id);
      setDocuments((previous) =>
        previous.map((item) => (item.document_link_id === refreshed.document_link_id ? refreshed : item)),
      );
      setSelectedDocument((previous) => previous?.document_link_id === refreshed.document_link_id ? refreshed : previous);
      await loadInsights({ silent: true });
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
      await loadInsights({ silent: true });
    } catch (error) {
      console.error("Failed to reprocess vectorization:", error);
      toast.error("Failed to reprocess vectorization");
    } finally {
      setReprocessingDocumentId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">RAG Insights</h3>
          <p className="text-sm text-slate-500">{formatValue(assetName)} | {formatValue(assetCode)} | {formatValue(assetVersion)}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void loadInsights()} disabled={loading || !assetId}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <AssetRagSummaryCards summary={summary} loading={loading} />

      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <h4 className="text-sm font-semibold text-slate-900">Vectorized Documents</h4>
        <VectorizedDocumentsTable
          documents={documents}
          loading={loading}
          refreshingDocumentId={refreshingDocumentId}
          reprocessingDocumentId={reprocessingDocumentId}
          sourceSystemOptions={sourceSystemOptions}
          onOpenDetail={handleOpenDetail}
          onRefreshDocument={(document) => void handleRefreshDocument(document)}
          onReprocessDocument={(document) => void handleReprocessDocument(document)}
        />
      </div>

      <Dialog open={Boolean(selectedDocument)} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-2rem)] overflow-hidden p-0 sm:max-w-6xl">
          <DialogHeader className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <DialogTitle>{selectedDocument?.document_name || "Document RAG Insights"}</DialogTitle>
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
                <TabsTrigger value="chunks" className="px-4">
                  Chunks
                </TabsTrigger>
                <TabsTrigger value="report" className="px-4">
                  JSON Report
                </TabsTrigger>
                <TabsTrigger value="process" className="px-4">
                  RAG Process
                </TabsTrigger>
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
    </div>
  );
}
