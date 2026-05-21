import React from "react";

import { AuthoredDocumentReviewActionRecord } from "../../../services/authored-document.service";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import {
  formatAuthoredDocumentActionType,
  formatAuthoredDocumentDate,
  formatAuthoredDocumentStatus,
  getAuthoredDocumentStatusBadgeClass,
} from "./authoredDocumentForm.shared";

interface AuthoredDocumentHistoryPanelProps {
  history: AuthoredDocumentReviewActionRecord[];
  loading: boolean;
}

export function AuthoredDocumentHistoryPanel({
  history,
  loading,
}: AuthoredDocumentHistoryPanelProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Workflow History</p>
        <p className="mt-1 text-xs text-slate-500">
          Review actions, comments, and status transitions are recorded here.
        </p>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-sm text-slate-500">Loading workflow history...</div>
      ) : history.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-500">No workflow actions recorded yet.</div>
      ) : (
        <ScrollArea className="max-h-72">
          <div className="space-y-0 px-4 py-2">
            {history.map((entry, index) => (
              <div
                key={entry.id}
                className={`relative pl-6 ${index !== history.length - 1 ? "pb-5" : "pb-2"} pt-2`}
              >
                <span className="absolute left-[5px] top-4 h-2.5 w-2.5 rounded-full bg-slate-400" />
                {index !== history.length - 1 ? (
                  <span className="absolute left-[9px] top-7 bottom-0 w-px bg-slate-200" />
                ) : null}

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatAuthoredDocumentActionType(entry.action_type)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.action_by?.trim() || "Unknown user"} - {formatAuthoredDocumentDate(entry.action_dt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <Badge
                        variant="outline"
                        className={getAuthoredDocumentStatusBadgeClass(entry.from_status)}
                      >
                        {formatAuthoredDocumentStatus(entry.from_status)}
                      </Badge>
                      <span>to</span>
                      <Badge
                        variant="outline"
                        className={getAuthoredDocumentStatusBadgeClass(entry.to_status)}
                      >
                        {formatAuthoredDocumentStatus(entry.to_status)}
                      </Badge>
                    </div>
                  </div>

                  {entry.comment_text?.trim() ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{entry.comment_text}</p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No comment provided.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
