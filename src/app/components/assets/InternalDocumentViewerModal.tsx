import React, { useEffect, useState } from "react";

import { api } from "../../../services/api";
import { Button } from "../ui/button";
import { Modal } from "../ui/Modal";

interface InternalDocumentViewerModalProps {
  open: boolean;
  title?: string;
  sourceUrl: string | null;
  onClose: () => void;
}

export function InternalDocumentViewerModal({
  open,
  title = "Document Viewer",
  sourceUrl,
  onClose,
}: InternalDocumentViewerModalProps) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sourceUrl) {
      setPreviewUrl("");
      setLoading(false);
      setLoadError(null);
      return;
    }

    let objectUrl = "";
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    api
      .get<Blob>("/document-viewer/preview", {
        params: { source_url: sourceUrl },
        responseType: "blob",
      })
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewUrl("");
          setLoadError("Unable to preview this document.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [open, sourceUrl]);

  const openOriginal = async () => {
    if (!sourceUrl) return;
    const response = await api.get<Blob>("/document-viewer/original", {
      params: { source_url: sourceUrl },
      responseType: "blob",
    });
    const objectUrl = URL.createObjectURL(response.data);
    window.open(objectUrl, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="full"
      footer={
        <>
          {sourceUrl ? (
            <Button type="button" variant="outline" onClick={() => void openOriginal()}>
              Open Original
            </Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="h-[78vh] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading document...
          </div>
        ) : loadError ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            {loadError}
          </div>
        ) : previewUrl ? (
          <iframe src={previewUrl} title={title} className="h-full w-full bg-white" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            No document selected.
          </div>
        )}
      </div>
    </Modal>
  );
}
