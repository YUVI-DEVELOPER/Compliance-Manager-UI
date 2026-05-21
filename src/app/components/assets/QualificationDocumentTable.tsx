import React, { useState } from "react";

import { QualificationDocumentRecord } from "../../../services/qualification-document.service";
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
import {
  canDeleteQualificationDocument,
  formatQualificationDocumentDate,
  formatQualificationLinkedContext,
  formatQualificationStatus,
  formatQualificationType,
  getQualificationDocumentExternalLink,
  getQualificationStatusBadgeClass,
  getQualificationTypeBadgeClass,
} from "./qualificationDocumentForm.shared";
import { InternalDocumentViewerModal } from "./InternalDocumentViewerModal";

interface QualificationDocumentTableProps {
  documents: QualificationDocumentRecord[];
  loading: boolean;
  onOpen: (document: QualificationDocumentRecord) => void;
  onDelete: (document: QualificationDocumentRecord) => void;
  canOpenRecord?: boolean;
  canDelete?: boolean;
  emptyMessage?: string;
}

export function QualificationDocumentTable({
  documents,
  loading,
  onOpen,
  onDelete,
  canOpenRecord = true,
  canDelete: canDeleteDocuments = false,
  emptyMessage = "No supplier qualification documents registered yet.",
}: QualificationDocumentTableProps) {
  const [previewDocument, setPreviewDocument] = useState<QualificationDocumentRecord | null>(null);
  const previewUrl = previewDocument ? getQualificationDocumentExternalLink(previewDocument) : null;

  return (
    <>
      <div className="border rounded-lg bg-white">
        <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Document Name</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Supplier</TableHead>
            <TableHead className="font-semibold">Version</TableHead>
            <TableHead className="font-semibold">Submission Date</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Linked Context</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                Loading qualification documents...
              </TableCell>
            </TableRow>
          ) : documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            documents.map((document) => {
              const canDelete = canDeleteDocuments && canDeleteQualificationDocument(document.status);
              const safeExternalLink = getQualificationDocumentExternalLink(document);
              const documentName = document.document_name?.trim() || "-";
              const supplierName = document.supplier_name?.trim() || "-";

              return (
                <TableRow key={document.qualification_document_id} className="hover:bg-slate-50">
                  <TableCell className="align-top whitespace-normal">
                    <div className="min-w-0 break-words font-medium text-slate-900" title={documentName}>
                      {documentName}
                    </div>
                    {document.external_document_id ? (
                      <p
                        className="mt-1 max-w-[14rem] break-words text-xs text-slate-500"
                        title={document.external_document_id}
                      >
                        Ref: {document.external_document_id}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant="outline"
                      className={getQualificationTypeBadgeClass(document.qualification_type)}
                    >
                      {formatQualificationType(document.qualification_type)}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal break-words text-slate-700">
                    {supplierName}
                  </TableCell>
                  <TableCell className="align-top">{document.document_version?.trim() || "-"}</TableCell>
                  <TableCell className="align-top" title={document.submission_date ?? undefined}>
                    {formatQualificationDocumentDate(document.submission_date)}
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant="outline"
                      className={getQualificationStatusBadgeClass(document.status)}
                    >
                      {formatQualificationStatus(document.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal break-words text-slate-700">
                    {formatQualificationLinkedContext(document)}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <div className="flex items-center justify-end gap-1">
                      {safeExternalLink ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewDocument(document)}
                          title="Open Supplier Document"
                        >
                          Open
                        </Button>
                      ) : null}
                      {canOpenRecord ? <Button variant="ghost" size="sm" onClick={() => onOpen(document)} title="Open Record">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Button> : null}
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(document)}
                          title="Delete Record"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
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
      <InternalDocumentViewerModal
        open={Boolean(previewDocument)}
        title={previewDocument?.document_name || "Qualification Document"}
        sourceUrl={previewUrl}
        onClose={() => setPreviewDocument(null)}
      />
    </>
  );
}
