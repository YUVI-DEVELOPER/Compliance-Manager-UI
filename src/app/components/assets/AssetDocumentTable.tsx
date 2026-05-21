import React, { useState } from "react";
import { ExternalLink, Pencil, RotateCw, Trash2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { DocumentLinkRecord } from "../../../services/document-link.service";
import { LookupOption } from "../../services/lookupValue.service";
import {
  formatDocumentLinkDate,
  formatDocumentLinkType,
  formatDocumentSourceSystem,
  formatVectorizationStatus,
  getSafeDocumentAccessUrl,
  getVectorizationStatusBadgeClass,
} from "./documentLinkForm.shared";
import { InternalDocumentViewerModal } from "./InternalDocumentViewerModal";

interface AssetDocumentTableProps {
  documents: DocumentLinkRecord[];
  loading: boolean;
  onEdit: (document: DocumentLinkRecord) => void;
  onDelete: (document: DocumentLinkRecord) => void;
  onReprocess?: (document: DocumentLinkRecord) => void;
  canUpdate?: boolean;
  canDelete?: boolean;
  sourceSystemOptions?: LookupOption[];
  emptyMessage?: string;
}

export function AssetDocumentTable({
  documents,
  loading,
  onEdit,
  onDelete,
  onReprocess,
  canUpdate = false,
  canDelete = false,
  sourceSystemOptions = [],
  emptyMessage = "No documents linked for this asset. Add the first validated document.",
}: AssetDocumentTableProps) {
  const [previewDocument, setPreviewDocument] = useState<DocumentLinkRecord | null>(null);
  const previewUrl = previewDocument ? getSafeDocumentAccessUrl(previewDocument.access_url) : null;

  return (
    <>
      <div className="border rounded-lg bg-white">
        <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Document Name</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Version</TableHead>
            <TableHead className="font-semibold">Source System</TableHead>
            <TableHead className="font-semibold">External Document ID</TableHead>
            <TableHead className="font-semibold">Upload Date</TableHead>
            <TableHead className="font-semibold">Vectorization</TableHead>
            <TableHead className="font-semibold">Access</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                Loading documents...
              </TableCell>
            </TableRow>
          ) : documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            documents.map((document) => {
              const safeAccessUrl = getSafeDocumentAccessUrl(document.access_url);
              const documentName = document.document_name?.trim() || "-";
              const externalDocumentId = document.external_document_id?.trim() || "-";
              const documentTypeLabel = formatDocumentLinkType(document.document_type);
              const sourceSystemLabel = formatDocumentSourceSystem(document.source_system, sourceSystemOptions);
              const vectorizationJob = document.vectorization_job;
              const vectorizationLabel = formatVectorizationStatus(document.vectorization_status);
              const vectorizationTitle = vectorizationJob?.error_message || vectorizationLabel;

              return (
                <TableRow key={document.document_link_id} className="hover:bg-slate-50">
                  <TableCell className="max-w-0">
                    <div
                      className="max-w-[16rem] overflow-hidden text-ellipsis whitespace-nowrap font-medium text-slate-900"
                      title={documentName}
                    >
                      {documentName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-indigo-200 bg-indigo-50 text-indigo-700"
                      title={documentTypeLabel}
                    >
                      {documentTypeLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>{document.document_version || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-slate-200 bg-slate-50 text-slate-700"
                      title={sourceSystemLabel}
                    >
                      {sourceSystemLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-0">
                    <div
                      className="max-w-[12rem] overflow-hidden text-ellipsis whitespace-nowrap text-slate-600"
                      title={externalDocumentId}
                    >
                      {externalDocumentId}
                    </div>
                  </TableCell>
                  <TableCell title={document.upload_dt ?? undefined}>
                    {formatDocumentLinkDate(document.upload_dt)}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge
                        variant="outline"
                        className={getVectorizationStatusBadgeClass(document.vectorization_status)}
                        title={vectorizationTitle}
                      >
                        {vectorizationLabel}
                      </Badge>
                      {vectorizationJob?.chunk_count ? (
                        <span className="text-xs text-slate-500">{vectorizationJob.chunk_count} chunks</span>
                      ) : null}
                      {vectorizationJob?.requested_at ? (
                        <span className="text-xs text-slate-500">
                          Requested {formatDocumentLinkDate(vectorizationJob.requested_at)}
                        </span>
                      ) : null}
                      {vectorizationJob?.completed_at ? (
                        <span className="text-xs text-slate-500">
                          Completed {formatDocumentLinkDate(vectorizationJob.completed_at)}
                        </span>
                      ) : null}
                      {vectorizationJob?.error_message ? (
                        <span className="max-w-[14rem] truncate text-xs text-red-600" title={vectorizationJob.error_message}>
                          {vectorizationJob.error_message}
                        </span>
                      ) : null}
                      {canUpdate && vectorizationJob?.can_reprocess && onReprocess ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onReprocess(document)}
                          title="Reprocess Vectorization"
                          className="h-7 px-2 text-xs"
                        >
                          <RotateCw className="size-3.5" />
                          Reprocess
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {safeAccessUrl ? (
                      <Button variant="ghost" size="sm" onClick={() => setPreviewDocument(document)} title="Open Document">
                        <ExternalLink className="size-4" />
                        Open
                      </Button>
                    ) : (
                      <span className="text-sm text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {canUpdate ? <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(document)}
                        title="Edit Document"
                      >
                        <Pencil className="size-4" />
                      </Button> : null}
                      {canDelete ? <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(document)}
                        title="Delete Document"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="size-4" />
                      </Button> : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
        </Table>
      </div>
      <InternalDocumentViewerModal
        open={Boolean(previewDocument)}
        title={previewDocument?.document_name || "Linked Document"}
        sourceUrl={previewUrl}
        onClose={() => setPreviewDocument(null)}
      />
    </>
  );
}
