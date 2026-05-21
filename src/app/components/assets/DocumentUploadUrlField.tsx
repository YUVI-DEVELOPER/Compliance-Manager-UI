import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { uploadDocumentFile, UploadedDocumentFileRecord } from "../../../services/file-upload.service";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface DocumentUploadUrlFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  uploadCategory: string;
  onUploaded?: (file: UploadedDocumentFileRecord) => void;
}

const DOCUMENT_ACCEPT_TYPES = [
  ".csv",
  ".doc",
  ".docm",
  ".docx",
  ".jpeg",
  ".jpg",
  ".json",
  ".md",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".rtf",
  ".txt",
  ".xls",
  ".xlsm",
  ".xlsx",
  ".xml",
].join(",");

const getSafeUrl = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const getUploadErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: unknown; message?: string } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (typeof response?.data?.message === "string" && response.data.message.trim()) return response.data.message;
  }

  return error instanceof Error ? error.message : "File upload failed";
};

export function DocumentUploadUrlField({
  label,
  value,
  onChange,
  disabled = false,
  error,
  uploadCategory,
  onUploaded,
}: DocumentUploadUrlFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const safeUrl = useMemo(() => getSafeUrl(value), [value]);

  const handleSelectFile = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";

    if (!selectedFile) return;

    setUploading(true);
    try {
      const uploaded = await uploadDocumentFile(selectedFile, uploadCategory);
      onChange(uploaded.access_url);
      setUploadedFileName(uploaded.original_file_name);
      onUploaded?.(uploaded);
      toast.success(`Uploaded ${uploaded.original_file_name}`);
    } catch (uploadError) {
      toast.error(getUploadErrorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Input
        label={label}
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || uploading}
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={DOCUMENT_ACCEPT_TYPES}
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
          disabled={disabled || uploading}
        />
        <Button type="button" variant="outline" size="sm" onClick={handleSelectFile} disabled={disabled || uploading}>
          {uploading ? "Uploading..." : "Upload Local File"}
        </Button>
        {safeUrl ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={safeUrl} target="_blank" rel="noopener noreferrer">
              Open File
            </a>
          </Button>
        ) : null}
        {uploadedFileName ? (
          <span className="text-xs text-slate-500 break-all">Uploaded: {uploadedFileName}</span>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
