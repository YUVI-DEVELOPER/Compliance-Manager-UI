import React from "react";
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
import { ReleaseRecord } from "../../../services/release.service";
import {
  formatDocumentationMode,
  getDocumentationModeBadgeClass,
} from "./releaseForm.shared";

interface AssetReleaseTableProps {
  releases: ReleaseRecord[];
  loading: boolean;
  onEdit: (release: ReleaseRecord) => void;
  onDelete: (release: ReleaseRecord) => void;
  onView?: (release: ReleaseRecord) => void;
  onRegenerateAssessment?: (release: ReleaseRecord) => void;
  onDownloadAssessment?: (release: ReleaseRecord) => void;
  onDocuments?: (release: ReleaseRecord) => void;
}

const formatDate = (value?: string | null): string => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const getSystemConfigPreview = (value?: string | null): string => {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || "-";
};

export function AssetReleaseTable({
  releases,
  loading,
  onEdit,
  onDelete,
  onView,
  onRegenerateAssessment,
  onDownloadAssessment,
  onDocuments,
}: AssetReleaseTableProps) {
  return (
    <div className="border rounded-lg bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="font-semibold">Version</TableHead>
            <TableHead className="font-semibold">System Configuration Report</TableHead>
            <TableHead className="font-semibold">Created Date</TableHead>
            <TableHead className="font-semibold">End Date</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                Loading releases...
              </TableCell>
            </TableRow>
          ) : releases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                No releases found for this asset. Add the first release.
              </TableCell>
            </TableRow>
          ) : (
            releases.map((release) => {
              const systemConfigPreview = getSystemConfigPreview(release.system_config_report);

              return (
                <TableRow key={release.release_id} className="hover:bg-slate-50">
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium text-slate-900">{release.version || "-"}</p>
                      {release.documentation_mode ? (
                        <Badge
                          variant="outline"
                          className={getDocumentationModeBadgeClass(release.documentation_mode)}
                        >
                          {formatDocumentationMode(release.documentation_mode)}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-0">
                    <div
                      className="max-w-[14rem] overflow-hidden text-ellipsis whitespace-nowrap text-slate-600"
                      title={systemConfigPreview}
                    >
                      {systemConfigPreview}
                    </div>
                  </TableCell>
                  <TableCell title={release.created_dt ?? undefined}>
                    {formatDate(release.created_dt)}
                  </TableCell>
                  <TableCell title={release.end_dt ?? undefined}>
                    {formatDate(release.end_dt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onView ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(release)}
                          title="View Assessment"
                          aria-label="View Assessment"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Button>
                      ) : null}
                      {onRegenerateAssessment ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRegenerateAssessment(release)}
                          title="Regenerate Assessment"
                          aria-label="Regenerate Assessment"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0A8.003 8.003 0 015.03 15m14.389 0H15" />
                          </svg>
                        </Button>
                      ) : null}
                      {onDownloadAssessment ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDownloadAssessment(release)}
                          title="Download Assessment"
                          aria-label="Download Assessment"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l4-4m-4 4l-4-4m-4 8h16" />
                          </svg>
                        </Button>
                      ) : null}
                      {onDocuments ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDocuments(release)}
                          title="Manage Documents"
                          aria-label="Manage Documents"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6M7 4h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
                          </svg>
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(release)}
                        title="Edit Release"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(release)}
                        title="Delete Release"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </Button>
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
