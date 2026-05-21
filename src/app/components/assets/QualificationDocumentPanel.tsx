import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ReleaseRecord } from "../../../services/release.service";
import { SupplierRecord } from "../../../services/supplier.service";
import {
  deleteQualificationDocument,
  getAssetQualificationDocuments,
  getReleaseQualificationDocuments,
  QualificationDocumentRecord,
} from "../../../services/qualification-document.service";
import { LookupOption } from "../../services/lookupValue.service";
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
import { Button } from "../ui/button";
import { QualificationDocumentModal } from "./QualificationDocumentModal";
import { QualificationDocumentTable } from "./QualificationDocumentTable";
import { useAuth } from "../../auth/useAuth";
import {
  formatQualificationStatus,
  formatQualificationType,
  mapQualificationDocumentAxiosError,
  QualificationDocumentContext,
} from "./qualificationDocumentForm.shared";

interface QualificationDocumentPanelProps {
  enabled: boolean;
  context: QualificationDocumentContext;
  suppliers: SupplierRecord[];
  releaseOptions?: ReleaseRecord[];
  sourceSystemOptions?: LookupOption[];
  title?: string;
  emptyMessage?: string;
}

export function QualificationDocumentPanel({
  enabled,
  context,
  suppliers,
  releaseOptions = [],
  sourceSystemOptions = [],
  title = "Qualification Docs",
  emptyMessage = "No supplier qualification documents registered yet.",
}: QualificationDocumentPanelProps) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const canCreateDocument = hasAnyPermission(["DOCUMENT_UPLOAD", "DOCUMENT_LINK"]);
  const canUpdateDocument = hasPermission("DOCUMENT_UPDATE");
  const canDeleteDocument = hasPermission("DOCUMENT_DELETE");
  const [documents, setDocuments] = useState<QualificationDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<QualificationDocumentRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [documentsOpen, setDocumentsOpen] = useState(false);

  const loadDocuments = useCallback(async () => {
    const targetId = context.type === "asset" ? context.assetId : context.releaseId;
    if (!targetId) return;

    setLoading(true);
    try {
      const data =
        context.type === "asset"
          ? await getAssetQualificationDocuments(targetId)
          : await getReleaseQualificationDocuments(targetId);
      setDocuments(data);
    } catch (error) {
      const mapped = mapQualificationDocumentAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    void loadDocuments();
  }, [enabled, loadDocuments]);

  useEffect(() => {
    if (enabled) return;

    setEditorOpen(false);
    setEditingDocumentId(null);
    setDocumentToDelete(null);
    setDeleteDialogOpen(false);
    setDeleting(false);
    setTypeFilter("ALL");
    setStatusFilter("ALL");
    setDocumentsOpen(false);
  }, [enabled]);

  const filteredDocuments = useMemo(
    () =>
      documents.filter((document) => {
        if (typeFilter !== "ALL" && document.qualification_type !== typeFilter) return false;
        if (statusFilter !== "ALL" && document.status !== statusFilter) return false;
        return true;
      }),
    [documents, statusFilter, typeFilter],
  );

  const acceptedCount = useMemo(
    () => documents.filter((document) => document.status === "ACCEPTED").length,
    [documents],
  );
  const inReviewCount = useMemo(
    () => documents.filter((document) => document.status === "IN_REVIEW").length,
    [documents],
  );

  const handleDelete = async () => {
    if (!documentToDelete || !canDeleteDocument) return;

    setDeleting(true);
    try {
      await deleteQualificationDocument(documentToDelete.qualification_document_id);
      toast.success("Qualification document deleted successfully");
      await loadDocuments();
    } catch (error) {
      const mapped = mapQualificationDocumentAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  return (
    <>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">{title}</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={documentsOpen}
              onClick={() => setDocumentsOpen((previous) => !previous)}
              disabled={!enabled}
            >
              <svg
                className={`w-4 h-4 transition-transform ${documentsOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              {documentsOpen ? "Hide Docs" : "View Docs"}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                {documents.length}
              </span>
            </Button>

            {canCreateDocument ? <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditingDocumentId(null);
                setEditorOpen(true);
              }}
              disabled={!enabled}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Qualification Doc
            </Button> : null}
          </div>
        </div>

        {documentsOpen ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Total Docs</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{documents.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">Accepted</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{acceptedCount}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-xs text-slate-500">In Review</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{inReviewCount}</p>
              </div>
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <label className="text-xs text-slate-500">Filter Type</label>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="ALL">All types</option>
                  <option value="IQ">{formatQualificationType("IQ")}</option>
                  <option value="OQ">{formatQualificationType("OQ")}</option>
                  <option value="PQ">{formatQualificationType("PQ")}</option>
                </select>
              </div>
              <div className="space-y-1 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <label className="text-xs text-slate-500">Filter Status</label>
                <select
                  className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="ALL">All statuses</option>
                  <option value="SUBMITTED">{formatQualificationStatus("SUBMITTED")}</option>
                  <option value="IN_REVIEW">{formatQualificationStatus("IN_REVIEW")}</option>
                  <option value="NEEDS_CLARIFICATION">{formatQualificationStatus("NEEDS_CLARIFICATION")}</option>
                  <option value="ACCEPTED">{formatQualificationStatus("ACCEPTED")}</option>
                  <option value="REJECTED">{formatQualificationStatus("REJECTED")}</option>
                </select>
              </div>
            </div>

            <QualificationDocumentTable
              documents={filteredDocuments}
              loading={loading}
              onOpen={(document) => {
                if (!canUpdateDocument) return;
                setEditingDocumentId(document.qualification_document_id);
                setEditorOpen(true);
              }}
              onDelete={(document) => {
                if (!canDeleteDocument) return;
                setDocumentToDelete(document);
                setDeleteDialogOpen(true);
              }}
              canOpenRecord={canUpdateDocument}
              canDelete={canDeleteDocument}
              emptyMessage={emptyMessage}
            />
          </>
        ) : null}
      </div>

      {canCreateDocument || canUpdateDocument ? <QualificationDocumentModal
        open={enabled && editorOpen}
        context={context}
        suppliers={suppliers}
        releaseOptions={releaseOptions}
        sourceSystemOptions={sourceSystemOptions}
        qualificationDocumentId={editingDocumentId}
        onClose={() => {
          setEditorOpen(false);
          setEditingDocumentId(null);
        }}
        onSaved={loadDocuments}
      /> : null}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Qualification Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.document_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
