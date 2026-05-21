import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Modal } from "../ui/Modal";
import {
  getImpactAssessment,
  ReleaseImpactAssessmentRecord,
  ReleaseRecord,
} from "../../../services/release.service";
import {
  formatDocumentationMode,
  formatReleaseDateTime,
  getAssessmentDiffSummary,
  getDocumentationModeBadgeClass,
  getImpactLevelBadgeClass,
  mapReleaseAxiosError,
} from "./releaseForm.shared";

interface ReleaseAssessmentModalProps {
  open: boolean;
  release: ReleaseRecord | null;
  assetName?: string | null;
  reloadToken?: number;
  onClose: () => void;
}

const formatValue = (value?: string | null): string => {
  if (!value || !value.trim()) return "-";
  return value;
};

const asNumber = (value: unknown): number | null => {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const asStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
};

const formatLineRange = (value: unknown): string => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "-";

  const start = "start" in value && typeof value.start === "number" ? value.start : null;
  const end = "end" in value && typeof value.end === "number" ? value.end : null;
  if (start === null || end === null) return "-";
  if (start === end) return String(start);
  return `${start}-${end}`;
};

export function ReleaseAssessmentModal({
  open,
  release,
  assetName,
  reloadToken = 0,
  onClose,
}: ReleaseAssessmentModalProps) {
  const [assessment, setAssessment] = useState<ReleaseImpactAssessmentRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const releaseId = release?.release_id ?? null;

  useEffect(() => {
    if (!open || !releaseId) {
      setAssessment(null);
      setLoading(false);
      setEmptyMessage(null);
      setErrorMessage(null);
      return;
    }

    let cancelled = false;
    setAssessment(null);
    setLoading(true);
    setEmptyMessage(null);
    setErrorMessage(null);

    const run = async () => {
      try {
        const data = await getImpactAssessment(releaseId);
        if (cancelled) return;
        setAssessment(data);
      } catch (error) {
        if (cancelled) return;

        const mapped = mapReleaseAxiosError(error);
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        const isMissingAssessment =
          status === 404 && mapped.message.toLowerCase().includes("impact assessment");

        if (isMissingAssessment) {
          setEmptyMessage("No impact assessment is available for this release yet.");
          return;
        }

        toast.error(mapped.message);
        setErrorMessage(mapped.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, releaseId, reloadToken]);

  const diffSummary = useMemo(() => getAssessmentDiffSummary(assessment), [assessment]);
  const matchedKeywords = asStringArray(diffSummary?.matched_keywords);
  const topChanges = Array.isArray(diffSummary?.changes)
    ? diffSummary.changes.slice(0, 3).filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    : [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Release Impact Assessment"
      description="Read-only comparison report for the selected release."
      size="xl"
      footer={
        <Button type="button" variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      {loading ? (
        <div className="text-sm text-slate-600">Loading impact assessment...</div>
      ) : emptyMessage ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-800">No Assessment Available</p>
          <p className="mt-2 text-sm text-slate-500">{emptyMessage}</p>
        </div>
      ) : errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-red-800">Assessment Unavailable</p>
          <p className="mt-2 text-sm text-red-700">{errorMessage}</p>
        </div>
      ) : !assessment || !release ? (
        <div className="text-sm text-slate-600">No release selected.</div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Asset Name</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(assetName || release.asset_name)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Release Version</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(release.version)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Documentation Mode</p>
                <Badge
                  variant="outline"
                  className={`mt-1 ${getDocumentationModeBadgeClass(release.documentation_mode)}`}
                >
                  {formatDocumentationMode(release.documentation_mode)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-slate-500">Impact Level</p>
                <Badge
                  variant="outline"
                  className={`mt-1 ${getImpactLevelBadgeClass(assessment.impact_level)}`}
                >
                  {assessment.impact_level || "Not Rated"}
                </Badge>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-slate-500">Generated Date</p>
                <p className="text-sm font-medium text-slate-900">{formatReleaseDateTime(assessment.generated_dt)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Report Title</p>
                <p className="text-sm font-medium text-slate-900">{formatValue(assessment.report_title)}</p>
              </div>
            </div>
          </div>

          {diffSummary ? (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Diff Summary</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">Comparison Type</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {formatValue(typeof diffSummary.comparison_type === "string" ? diffSummary.comparison_type : null)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">Similarity Ratio</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {asNumber(diffSummary.similarity_ratio)?.toFixed(4) ?? "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">Changed Segments</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {asNumber(diffSummary.changed_segments) ?? "-"}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">Changed Lines</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {asNumber(diffSummary.total_changed_lines) ?? "-"}
                  </p>
                </div>
              </div>

              {matchedKeywords.length > 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">Validation-Impact Keywords</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {matchedKeywords.map((keyword) => (
                      <Badge
                        key={keyword}
                        variant="outline"
                        className="border-slate-200 bg-slate-50 text-slate-700"
                      >
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              {topChanges.length > 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <p className="text-xs text-slate-500">Change Preview</p>
                  <div className="mt-3 space-y-2">
                    {topChanges.map((change, index) => (
                      <div key={`${index}-${String(change.change_type ?? "change")}`} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span className="font-medium text-slate-800">
                            {typeof change.change_type === "string" ? change.change_type.toUpperCase() : "CHANGE"}
                          </span>
                          <span>Prev: {formatLineRange(change.previous_line_range)}</span>
                          <span>Current: {formatLineRange(change.current_line_range)}</span>
                        </div>
                        {asStringArray(change.matched_keywords).length > 0 ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Keywords: {asStringArray(change.matched_keywords).join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Report Content</h4>
            <div className="max-h-[26rem] overflow-y-auto rounded-lg border border-slate-200 bg-white px-4 py-4">
              <div className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {assessment.report_content}
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
