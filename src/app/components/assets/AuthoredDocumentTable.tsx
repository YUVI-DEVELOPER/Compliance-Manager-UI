import React from "react";

import { AuthoredDocumentRecord } from "../../../services/authored-document.service";
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
  canDeleteAuthoredDocument,
  formatAuthoredDocumentDate,
  formatAuthoredDocumentGenerationMode,
  formatAuthoredDocumentPublishStatus,
  formatAuthoredDocumentStatus,
  getAuthoredDocumentPublishBadgeClass,
  getAuthoredDocumentGenerationBadgeClass,
  getAuthoredDocumentStatusBadgeClass,
} from "./authoredDocumentForm.shared";

interface AuthoredDocumentTableProps {
  documents: AuthoredDocumentRecord[];
  loading: boolean;
  onOpen: (document: AuthoredDocumentRecord) => void;
  onDelete: (document: AuthoredDocumentRecord) => void;
  emptyMessage?: string;
}

export function AuthoredDocumentTable({
  documents,
  loading,
  onOpen,
  onDelete,
  emptyMessage = "No authored documents created yet. Start with a URS draft.",
}: AuthoredDocumentTableProps) {
  return (
    <div className="border rounded-lg bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Title</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Publish</TableHead>
            <TableHead className="font-semibold">Reviewer</TableHead>
            <TableHead className="font-semibold">Approver</TableHead>
            <TableHead className="font-semibold">Updated</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                Loading authored documents...
              </TableCell>
            </TableRow>
          ) : documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            documents.map((document) => {
              const title = document.title?.trim() || "-";
              const templateLabel = document.template_name?.trim() || document.template_code?.trim() || "-";
              const updatedAt = document.modified_dt || document.created_dt;
              const reviewerName = document.reviewer_name?.trim() || "-";
              const approverName = document.approver_name?.trim() || "-";
              const canDelete = canDeleteAuthoredDocument(document.status);
              const generationLabel = formatAuthoredDocumentGenerationMode(
                document.generation_mode,
                document.generation_requested_mode,
              );

              return (
                <TableRow key={document.authored_document_id} className="hover:bg-slate-50">
                  <TableCell className="align-top whitespace-normal">
                    <div className="min-w-0 break-words font-medium leading-5 text-slate-900" title={title}>
                      {title}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 break-words">{document.document_type || "-"}</p>
                    <p className="mt-1 text-xs text-slate-500 break-words" title={templateLabel}>
                      Template: {templateLabel}
                    </p>
                    <Badge
                      variant="outline"
                      className={`mt-2 ${getAuthoredDocumentGenerationBadgeClass(document.generation_mode)}`}
                    >
                      {generationLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge
                      variant="outline"
                      className={getAuthoredDocumentStatusBadgeClass(document.status)}
                    >
                      {formatAuthoredDocumentStatus(document.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top whitespace-normal">
                    <Badge
                      variant="outline"
                      className={getAuthoredDocumentPublishBadgeClass(document.publish_status)}
                    >
                      {formatAuthoredDocumentPublishStatus(document.publish_status)}
                    </Badge>
                    {document.external_document_id ? (
                      <p
                        className="mt-2 max-w-[13rem] break-words text-xs text-slate-500"
                        title={document.external_document_id}
                      >
                        Ref: {document.external_document_id}
                      </p>
                    ) : null}
                    {document.publish_error_message ? (
                      <p
                        className="mt-2 max-w-[13rem] break-words text-xs text-rose-700"
                        title={document.publish_error_message}
                      >
                        {document.publish_error_message}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top text-slate-600 break-words whitespace-normal">{reviewerName}</TableCell>
                  <TableCell className="align-top text-slate-600 break-words whitespace-normal">{approverName}</TableCell>
                  <TableCell className="align-top" title={updatedAt ?? undefined}>
                    {formatAuthoredDocumentDate(updatedAt)}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpen(document)}
                        title="Open Draft"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Button>
                      {canDelete ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(document)}
                          title="Delete Draft"
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
  );
}
