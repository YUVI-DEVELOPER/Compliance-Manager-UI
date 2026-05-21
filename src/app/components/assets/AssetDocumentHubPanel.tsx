import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  AuthoredDocumentRecord,
  getAssetAuthoredDocuments,
  getReleaseAuthoredDocuments,
} from "../../../services/authored-document.service";
import { AssetRecord } from "../../../services/asset.service";
import {
  DocumentLinkRecord,
  getAssetDocuments,
  getReleaseDocuments,
} from "../../../services/document-link.service";
import {
  getAssetQualificationDocuments,
  getReleaseQualificationDocuments,
  QualificationDocumentRecord,
} from "../../../services/qualification-document.service";
import { getReleasesByAssetId, ReleaseRecord } from "../../../services/release.service";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import {
  formatAuthoredDocumentDate,
  formatAuthoredDocumentPublishStatus,
  formatAuthoredDocumentStatus,
  getAuthoredDocumentExternalLink,
  getAuthoredDocumentPublishBadgeClass,
  getAuthoredDocumentStatusBadgeClass,
} from "./authoredDocumentForm.shared";
import {
  formatDocumentLinkDate,
  formatDocumentLinkType,
  formatDocumentSourceSystem,
  formatVectorizationStatus,
  getSafeDocumentAccessUrl,
  getVectorizationStatusBadgeClass,
} from "./documentLinkForm.shared";
import {
  formatQualificationDocumentDate,
  formatQualificationStatus,
  formatQualificationType,
  getQualificationDocumentExternalLink,
  getQualificationStatusBadgeClass,
  getQualificationTypeBadgeClass,
} from "./qualificationDocumentForm.shared";

type AssetHubDocumentKind = "AUTHORED" | "QUALIFICATION" | "LINKED";

interface AssetHubDocumentRow {
  id: string;
  kind: AssetHubDocumentKind;
  documentType: string;
  title: string;
  status: string;
  publishStatus?: string | null;
  version?: string | null;
  sourceSystem?: string | null;
  externalDocumentId?: string | null;
  sourceReference?: string | null;
  updatedAt?: string | null;
  accessUrl?: string | null;
  vectorizationStatus?: string | null;
  vectorizationError?: string | null;
  assetCode: string;
  assetName: string;
  assetVersion?: string | null;
  supplierName?: string | null;
  releaseVersion?: string | null;
  sourceContext: string;
  authoredDocument?: AuthoredDocumentRecord;
}

interface AssetDocumentHubPanelProps {
  enabled: boolean;
  asset: AssetRecord;
  sourceSystemOptions?: LookupOption[];
}

const IMPORTANT_DOCUMENT_TYPES = new Set(["URS", "FRS", "SOP", "TRAINING_CONTENT", "IQ", "OQ", "PQ", "DQ", "RTM"]);
const IMPORTANT_TEXT_PATTERNS = [
  "URS",
  "FRS",
  "SOP",
  "TRAINING CONTENT",
  "IQ",
  "OQ",
  "PQ",
  "DQ",
  "RTM",
  "REQUIREMENT",
  "REQUIREMENTS",
  "TRACEABILITY",
  "VALIDATION",
  "QUALIFICATION",
  "FUNCTIONAL SPEC",
  "DESIGN QUALIFICATION",
  "VALIDATION PLAN",
  "VALIDATION REPORT",
];

const normalize = (value?: string | null): string => (value ?? "").trim();

const formatFallback = (value?: string | null): string => normalize(value) || "-";

const formatDocumentTypeLabel = (value?: string | null): string => {
  const next = normalize(value);
  if (!next) return "-";

  return next
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      return IMPORTANT_DOCUMENT_TYPES.has(upper) ? upper : upper.charAt(0) + upper.slice(1).toLowerCase();
    })
    .join(" ");
};

const textMatchesImportantDocument = (values: Array<string | null | undefined>): boolean => {
  const text = values.map((value) => normalize(value).toUpperCase()).filter(Boolean).join(" ");
  if (!text) return false;

  return IMPORTANT_TEXT_PATTERNS.some((pattern) => {
    if (pattern.length <= 3) {
      return new RegExp(`(^|[^A-Z0-9])${pattern}([^A-Z0-9]|$)`).test(text);
    }
    return text.includes(pattern);
  });
};

const compareRows = (left: AssetHubDocumentRow, right: AssetHubDocumentRow): number => {
  const leftDate = Date.parse(left.updatedAt ?? "");
  const rightDate = Date.parse(right.updatedAt ?? "");
  const leftValue = Number.isNaN(leftDate) ? 0 : leftDate;
  const rightValue = Number.isNaN(rightDate) ? 0 : rightDate;
  return rightValue - leftValue || left.title.localeCompare(right.title);
};

const getKindLabel = (kind: AssetHubDocumentKind): string => {
  if (kind === "AUTHORED") return "Authored";
  if (kind === "QUALIFICATION") return "Qualification";
  return "Linked";
};

const getKindBadgeClass = (kind: AssetHubDocumentKind): string => {
  if (kind === "AUTHORED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (kind === "QUALIFICATION") return "border-cyan-200 bg-cyan-50 text-cyan-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
};

const getStatusBadgeClass = (row: AssetHubDocumentRow): string => {
  if (row.kind === "AUTHORED") return getAuthoredDocumentStatusBadgeClass(row.status);
  if (row.kind === "QUALIFICATION") return getQualificationStatusBadgeClass(row.status);
  if (row.vectorizationStatus) return getVectorizationStatusBadgeClass(row.vectorizationStatus);
  return "border-slate-200 bg-white text-slate-700";
};

const getStatusLabel = (row: AssetHubDocumentRow): string => {
  if (row.kind === "AUTHORED") return formatAuthoredDocumentStatus(row.status);
  if (row.kind === "QUALIFICATION") return formatQualificationStatus(row.status);
  if (row.vectorizationStatus) return formatVectorizationStatus(row.vectorizationStatus);
  return formatFallback(row.status);
};

const getTypeBadgeClass = (row: AssetHubDocumentRow): string => {
  if (row.kind === "QUALIFICATION") return getQualificationTypeBadgeClass(row.documentType);
  if (IMPORTANT_DOCUMENT_TYPES.has(row.documentType.toUpperCase())) return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-slate-200 bg-slate-100 text-slate-700";
};

const formatRowDate = (row: AssetHubDocumentRow): string => {
  if (row.kind === "AUTHORED") return formatAuthoredDocumentDate(row.updatedAt);
  if (row.kind === "QUALIFICATION") return formatQualificationDocumentDate(row.updatedAt);
  return formatDocumentLinkDate(row.updatedAt);
};

const getSourceSystemLabel = (row: AssetHubDocumentRow, sourceSystemOptions: LookupOption[]): string => {
  if (row.kind === "AUTHORED") {
    return row.sourceSystem ? formatDocumentSourceSystem(row.sourceSystem, sourceSystemOptions) : "ValidateNow";
  }
  return formatDocumentSourceSystem(row.sourceSystem, sourceSystemOptions);
};

const mapAuthoredDocument = (
  document: AuthoredDocumentRecord,
  asset: AssetRecord,
  release?: ReleaseRecord,
): AssetHubDocumentRow | null => {
  if (!textMatchesImportantDocument([document.document_type, document.title, document.template_name, document.external_document_name])) {
    return null;
  }

  return {
    id: `authored-${document.authored_document_id}`,
    kind: "AUTHORED",
    documentType: document.document_type || "Authored",
    title: document.title || document.external_document_name || "Untitled authored document",
    status: document.status || "-",
    publishStatus: document.publish_status,
    version: document.external_document_version,
    sourceSystem: document.external_system,
    externalDocumentId: document.external_document_id,
    sourceReference: document.external_source_reference,
    updatedAt: document.modified_dt || document.created_dt || document.published_at,
    accessUrl: getAuthoredDocumentExternalLink(document),
    assetCode: asset.asset_id || document.asset_code || "-",
    assetName: asset.asset_name || document.asset_name || "Unnamed asset",
    assetVersion: asset.asset_version,
    releaseVersion: release?.version || document.release_version,
    sourceContext: release ? "Release-authored workflow" : "Asset-authored workflow",
    authoredDocument: document,
  };
};

const mapQualificationDocument = (
  document: QualificationDocumentRecord,
  asset: AssetRecord,
  release?: ReleaseRecord,
): AssetHubDocumentRow => ({
  id: `qualification-${document.qualification_document_id}`,
  kind: "QUALIFICATION",
  documentType: document.qualification_type || "Qualification",
  title: document.document_name || "Untitled qualification document",
  status: document.status || "-",
  version: document.document_version,
  sourceSystem: document.source_system,
  externalDocumentId: document.external_document_id,
  sourceReference: document.source_reference,
  updatedAt: document.modified_dt || document.submission_date || document.created_dt,
  accessUrl: getQualificationDocumentExternalLink(document),
  assetCode: asset.asset_id || document.asset_code || "-",
  assetName: asset.asset_name || document.asset_name || "Unnamed asset",
  assetVersion: asset.asset_version,
  supplierName: document.supplier_name,
  releaseVersion: release?.version || document.release_version,
  sourceContext: release || document.release_id ? "Release qualification evidence" : "Asset qualification evidence",
});

const mapLinkedDocument = (
  document: DocumentLinkRecord,
  asset: AssetRecord,
  release?: ReleaseRecord,
): AssetHubDocumentRow | null => {
  if (!textMatchesImportantDocument([document.document_type, document.document_name, document.external_document_id, document.source_reference, document.notes])) {
    return null;
  }

  return {
    id: `linked-${document.document_link_id}`,
    kind: "LINKED",
    documentType: document.document_type || "Linked Reference",
    title: document.document_name || "Untitled linked document",
    status: "Linked",
    version: document.document_version,
    sourceSystem: document.source_system,
    externalDocumentId: document.external_document_id,
    sourceReference: document.source_reference,
    updatedAt: document.modified_dt || document.upload_dt || document.created_dt,
    accessUrl: getSafeDocumentAccessUrl(document.access_url),
    vectorizationStatus: document.vectorization_status,
    vectorizationError: document.vectorization_job?.error_message,
    assetCode: asset.asset_id || "-",
    assetName: asset.asset_name || "Unnamed asset",
    assetVersion: asset.asset_version,
    releaseVersion: release?.version,
    sourceContext: release ? "Release linked reference" : "Asset linked reference",
  };
};

async function loadAssetHubRows(asset: AssetRecord): Promise<AssetHubDocumentRow[]> {
  const rows: AssetHubDocumentRow[] = [];
  const [authoredResult, qualificationResult, linkedResult, releasesResult] = await Promise.allSettled([
    getAssetAuthoredDocuments(asset.asset_uuid),
    getAssetQualificationDocuments(asset.asset_uuid),
    getAssetDocuments(asset.asset_uuid),
    getReleasesByAssetId(asset.asset_uuid),
  ]);

  if (authoredResult.status === "fulfilled") {
    authoredResult.value.forEach((document) => {
      const row = mapAuthoredDocument(document, asset);
      if (row) rows.push(row);
    });
  }
  if (qualificationResult.status === "fulfilled") {
    qualificationResult.value.forEach((document) => rows.push(mapQualificationDocument(document, asset)));
  }
  if (linkedResult.status === "fulfilled") {
    linkedResult.value.forEach((document) => {
      const row = mapLinkedDocument(document, asset);
      if (row) rows.push(row);
    });
  }

  if (releasesResult.status !== "fulfilled") return rows.sort(compareRows);

  const releaseRows = await Promise.all(
    releasesResult.value.map(async (release) => {
      const scopedRows: AssetHubDocumentRow[] = [];
      const [authored, qualification, linked] = await Promise.allSettled([
        getReleaseAuthoredDocuments(release.release_id),
        getReleaseQualificationDocuments(release.release_id),
        getReleaseDocuments(release.release_id),
      ]);

      if (authored.status === "fulfilled") {
        authored.value.forEach((document) => {
          const row = mapAuthoredDocument(document, asset, release);
          if (row) scopedRows.push(row);
        });
      }
      if (qualification.status === "fulfilled") {
        qualification.value.forEach((document) => scopedRows.push(mapQualificationDocument(document, asset, release)));
      }
      if (linked.status === "fulfilled") {
        linked.value.forEach((document) => {
          const row = mapLinkedDocument(document, asset, release);
          if (row) scopedRows.push(row);
        });
      }

      return scopedRows;
    }),
  );

  return rows.concat(releaseRows.flat()).sort(compareRows);
}

export function AssetDocumentHubPanel({ enabled, asset, sourceSystemOptions = [] }: AssetDocumentHubPanelProps) {
  const [rows, setRows] = useState<AssetHubDocumentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [selectedDocument, setSelectedDocument] = useState<AuthoredDocumentRecord | null>(null);

  const loadRows = useCallback(async () => {
    if (!enabled || !asset.asset_uuid) return;

    setLoading(true);
    try {
      setRows(await loadAssetHubRows(asset));
    } catch (error) {
      console.error("Failed to load asset document hub:", error);
      toast.error("Failed to load asset document hub");
    } finally {
      setLoading(false);
    }
  }, [asset, enabled]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void loadRows();
  }, [enabled, loadRows]);

  const documentTypes = useMemo(
    () => Array.from(new Set(rows.map((row) => row.documentType).filter(Boolean))).sort(),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesType = typeFilter === "ALL" || row.documentType === typeFilter;
      const matchesKind = kindFilter === "ALL" || row.kind === kindFilter;
      if (!matchesType || !matchesKind) return false;
      if (!query) return true;

      return [
        row.title,
        row.documentType,
        row.releaseVersion,
        row.supplierName,
        row.sourceSystem,
        row.externalDocumentId,
        row.sourceReference,
        row.sourceContext,
      ]
        .map((value) => normalize(value).toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [kindFilter, rows, search, typeFilter]);

  const authoredViewerDescription = selectedDocument
    ? [
        selectedDocument.document_type,
        selectedDocument.asset_name || selectedDocument.asset_code || asset.asset_name || asset.asset_id,
        selectedDocument.release_version ? `Release ${selectedDocument.release_version}` : null,
      ].filter(Boolean).join(" | ")
    : "";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Asset Name</p>
              <p className="text-sm font-medium text-slate-900">{formatFallback(asset.asset_name)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Asset ID</p>
              <p className="text-sm font-medium text-slate-900">{formatFallback(asset.asset_id)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Important Docs</p>
              <p className="text-sm font-medium text-slate-900">{rows.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Evidence Docs</p>
              <p className="text-sm font-medium text-slate-900">{rows.filter((row) => row.kind === "QUALIFICATION").length}</p>
            </div>
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={() => void loadRows()} disabled={loading}>
            {loading ? "Loading" : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-end lg:justify-between">
        <label className="flex-1 space-y-1 text-xs font-medium text-slate-600">
          <span>Search This Asset</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search document, release, supplier, source, or reference..."
            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            disabled={loading}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Document Type</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-9 min-w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            disabled={loading}
          >
            <option value="ALL">All types</option>
            {documentTypes.map((type) => (
              <option key={type} value={type}>{formatDocumentTypeLabel(type)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>Source</span>
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
            className="h-9 min-w-36 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
            disabled={loading}
          >
            <option value="ALL">All sources</option>
            <option value="AUTHORED">Authored</option>
            <option value="QUALIFICATION">Qualification</option>
            <option value="LINKED">Linked</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="min-w-[17rem] font-semibold">Document</TableHead>
              <TableHead className="font-semibold">Type</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="min-w-[13rem] font-semibold">Mapping</TableHead>
              <TableHead className="font-semibold">Updated</TableHead>
              <TableHead className="font-semibold text-right">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                  Loading asset document hub...
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                  No important documents match this asset view.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.id} className="hover:bg-slate-50">
                  <TableCell className="align-top">
                    <div className="max-w-[22rem] break-words font-medium leading-5 text-slate-900" title={row.title}>
                      {row.title}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={getKindBadgeClass(row.kind)}>{getKindLabel(row.kind)}</Badge>
                      {row.releaseVersion ? <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Release {row.releaseVersion}</Badge> : null}
                      {row.publishStatus ? (
                        <Badge variant="outline" className={getAuthoredDocumentPublishBadgeClass(row.publishStatus)}>
                          {formatAuthoredDocumentPublishStatus(row.publishStatus)}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className={getTypeBadgeClass(row)}>
                      {row.kind === "QUALIFICATION" ? formatQualificationType(row.documentType) : row.kind === "LINKED" ? formatDocumentLinkType(row.documentType) : formatDocumentTypeLabel(row.documentType)}
                    </Badge>
                    {row.version ? <p className="mt-2 text-xs text-slate-500">Version {row.version}</p> : null}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className={getStatusBadgeClass(row)} title={row.vectorizationError ?? undefined}>
                      {getStatusLabel(row)}
                    </Badge>
                    {row.vectorizationError ? (
                      <p className="mt-2 max-w-[12rem] truncate text-xs text-red-600" title={row.vectorizationError}>
                        {row.vectorizationError}
                      </p>
                    ) : null}
                    {row.supplierName ? <p className="mt-2 text-xs text-slate-500">{row.supplierName}</p> : null}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="text-sm text-slate-700">{row.sourceContext}</div>
                    <p className="mt-1 text-xs text-slate-500">{getSourceSystemLabel(row, sourceSystemOptions)}</p>
                    {row.externalDocumentId ? (
                      <p className="mt-1 max-w-[14rem] break-words text-xs text-slate-500">Ref: {row.externalDocumentId}</p>
                    ) : null}
                    {row.sourceReference ? (
                      <p className="mt-1 max-w-[14rem] break-words text-xs text-slate-500">{row.sourceReference}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top" title={row.updatedAt ?? undefined}>
                    {formatRowDate(row)}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <div className="flex items-center justify-end gap-1">
                      {row.authoredDocument ? (
                        <Button variant="ghost" size="sm" onClick={() => setSelectedDocument(row.authoredDocument ?? null)}>
                          Preview
                        </Button>
                      ) : null}
                      {row.accessUrl ? (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={row.accessUrl} target="_blank" rel="noopener noreferrer">Open</a>
                        </Button>
                      ) : null}
                      {!row.authoredDocument && !row.accessUrl ? <span className="text-sm text-slate-400">-</span> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selectedDocument)} onOpenChange={(open) => !open && setSelectedDocument(null)}>
        <DialogContent className="max-h-[86vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <DialogTitle>{selectedDocument?.title || "Document Preview"}</DialogTitle>
            <DialogDescription>{authoredViewerDescription}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[68vh] overflow-y-auto px-5 py-4">
            <pre className="whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800">
              {selectedDocument?.content || "No authored content is available for this document."}
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
