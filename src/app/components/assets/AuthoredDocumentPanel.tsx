import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileCheck2, FileText, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  AuthoredDocumentRecord,
  deleteAuthoredDocument,
  getAssetAuthoredDocuments,
  getReleaseAuthoredDocuments,
} from "../../../services/authored-document.service";
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
import { Badge } from "../ui/badge";
import { AuthoredDocumentEditorModal } from "./AuthoredDocumentEditorModal";
import { AuthoredDocumentTable } from "./AuthoredDocumentTable";
import {
  AUTHORED_DOCUMENT_STATUS_APPROVED,
  AuthoredDocumentContext,
  formatAuthoredDocumentDate,
  formatAuthoredDocumentStatus,
  getAuthoredDocumentStatusBadgeClass,
  mapAuthoredDocumentAxiosError,
} from "./authoredDocumentForm.shared";

interface AuthoredDocumentPanelProps {
  enabled: boolean;
  context: AuthoredDocumentContext;
  title?: string;
  emptyMessage?: string;
  variant?: "panel" | "dropdown";
}

export function AuthoredDocumentPanel({
  enabled,
  context,
  title = "Authored Documents",
  emptyMessage,
  variant = "panel",
}: AuthoredDocumentPanelProps) {
  const [documents, setDocuments] = useState<AuthoredDocumentRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<AuthoredDocumentRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [documentMenuOpen, setDocumentMenuOpen] = useState(false);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const documentMenuRef = useRef<HTMLDivElement | null>(null);

  const loadDocuments = useCallback(async () => {
    const targetId = context.type === "asset" ? context.assetId : context.releaseId;
    if (!targetId) return;

    setLoading(true);
    try {
      const data =
        context.type === "asset"
          ? await getAssetAuthoredDocuments(targetId)
          : await getReleaseAuthoredDocuments(targetId);
      setDocuments(data);
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
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
    setDocumentMenuOpen(false);
    setDocumentsOpen(false);
  }, [enabled]);

  const openCreate = useCallback(() => {
    setDocumentMenuOpen(false);
    setEditingDocumentId(null);
    setEditorOpen(true);
  }, []);

  const openEdit = (document: AuthoredDocumentRecord) => {
    setDocumentMenuOpen(false);
    setEditingDocumentId(document.authored_document_id);
    setEditorOpen(true);
  };

  useEffect(() => {
    if (!documentMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (documentMenuRef.current?.contains(event.target as Node)) return;
      setDocumentMenuOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [documentMenuOpen]);

  const dropdownDocuments = useMemo(
    () =>
      [...documents].sort((left, right) => {
        const leftDate = Date.parse(left.modified_dt || left.created_dt || "");
        const rightDate = Date.parse(right.modified_dt || right.created_dt || "");
        return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
      }),
    [documents],
  );

  const handleDelete = async () => {
    if (!documentToDelete) return;

    setDeleting(true);
    try {
      await deleteAuthoredDocument(documentToDelete.authored_document_id);
      toast.success("Authored document deleted successfully");
      await loadDocuments();
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const toggleDocumentMenu = () => {
    setDocumentMenuOpen((previous) => {
      const nextOpen = !previous;
      if (nextOpen) void loadDocuments();
      return nextOpen;
    });
  };

  const renderDocumentMenuItem = (document: AuthoredDocumentRecord, icon: React.ReactNode) => {
    const titleLabel = document.title?.trim() || "Untitled URS";
    const updatedAt = document.modified_dt || document.created_dt;

    return (
      <button
        key={document.authored_document_id}
        type="button"
        onClick={() => openEdit(document)}
        className="flex w-full items-start gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
      >
        {icon}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900" title={titleLabel}>
            {titleLabel}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={getAuthoredDocumentStatusBadgeClass(document.status)}>
              {formatAuthoredDocumentStatus(document.status)}
            </Badge>
            <span className="text-xs text-slate-500">{formatAuthoredDocumentDate(updatedAt)}</span>
          </div>
        </div>
      </button>
    );
  };

  const editorAndDialogs = (
    <>
      <AuthoredDocumentEditorModal
        open={enabled && editorOpen}
        context={context}
        authoredDocumentId={editingDocumentId}
        onClose={() => {
          setEditorOpen(false);
          setEditingDocumentId(null);
        }}
        onSaved={loadDocuments}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Authored Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.title}"? This action cannot be undone.
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

  if (variant === "dropdown") {
    return (
      <>
        <div ref={documentMenuRef} className="relative inline-flex shrink-0 items-center justify-end">
          <div className="inline-flex items-center">
            <Button
              type="button"
              size="sm"
              onClick={openCreate}
              disabled={!enabled}
              className="rounded-r-none"
            >
              <Plus className="size-4" />
              New URS Draft
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={toggleDocumentMenu}
              disabled={!enabled}
              className="rounded-l-none border-l border-blue-400 px-2"
              aria-expanded={documentMenuOpen}
              aria-label="View authored documents"
              title="View authored documents"
            >
              <ChevronDown className="size-4" />
              {documents.length > 0 ? (
                <span className="ml-0.5 rounded-sm bg-blue-500 px-1 text-[11px] leading-4 text-white">
                  {documents.length}
                </span>
              ) : null}
            </Button>
          </div>

          {documentMenuOpen ? (
            <div className="absolute right-0 top-full z-50 mt-2 max-h-[28rem] w-[28rem] overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Authored URS Draft Documents
              </p>
              {loading ? (
                <p className="px-3 py-3 text-sm text-slate-500">Loading authored documents...</p>
              ) : dropdownDocuments.length === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-500">No authored URS documents</p>
              ) : (
                dropdownDocuments.map((document) =>
                  renderDocumentMenuItem(
                    document,
                    document.status === AUTHORED_DOCUMENT_STATUS_APPROVED ? (
                      <FileCheck2 className="mt-0.5 size-4 text-emerald-600" />
                    ) : (
                      <FileText className="mt-0.5 size-4 text-slate-500" />
                    ),
                  ),
                )
              )}
            </div>
          ) : null}
        </div>
        {editorAndDialogs}
      </>
    );
  }

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
              <ChevronDown className={`size-4 transition-transform ${documentsOpen ? "rotate-180" : ""}`} />
              {documentsOpen ? "Hide Docs" : "View Docs"}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                {documents.length}
              </span>
            </Button>

            <Button type="button" size="sm" onClick={openCreate} disabled={!enabled}>
              <Plus className="size-4" />
              New URS Draft
            </Button>
          </div>
        </div>

        {documentsOpen ? (
          <>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 max-w-xs">
              <p className="text-xs text-slate-500">Authored Documents</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{documents.length}</p>
            </div>

            <AuthoredDocumentTable
              documents={documents}
              loading={loading}
              onOpen={openEdit}
              onDelete={(document) => {
                setDocumentToDelete(document);
                setDeleteDialogOpen(true);
              }}
              emptyMessage={emptyMessage}
            />
          </>
        ) : null}
      </div>
      {editorAndDialogs}
    </>
  );
}
