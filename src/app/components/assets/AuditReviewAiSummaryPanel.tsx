import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AlertTriangle, Brain, Clock, Loader2, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AuditReviewAiSummaryResponse,
  AuditReviewReportDetail,
  clearAuditReviewAiSummary,
  generateAuditReviewAiSummary,
  getAuditReviewAiSummary,
} from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Switch } from "../ui/switch";

interface AuditReviewAiSummaryPanelProps {
  report: AuditReviewReportDetail;
  defaultActor?: string | null;
}

const SUMMARY_STYLES = [
  { value: "executive", label: "Executive" },
  { value: "reviewer", label: "Reviewer" },
  { value: "stakeholder", label: "Stakeholder" },
  { value: "brief", label: "Brief" },
];

const formatDateTime = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatLabel = (value?: string | null): string => {
  if (!value) return "-";
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase();
      return upper.length <= 4 ? upper : upper.charAt(0) + upper.slice(1).toLowerCase();
    })
    .join(" ");
};

const getAiStatusBadgeClass = (status?: string | null): string => {
  if (status === "GENERATED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "GENERATING") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "FAILED") return "border-red-200 bg-red-50 text-red-700";
  return "border-slate-200 bg-white text-slate-700";
};

const mapAiSummaryError = (error: unknown): { message: string; summary?: AuditReviewAiSummaryResponse } => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string; data?: unknown } | undefined;
    const summary = data?.data && typeof data.data === "object" ? data.data as AuditReviewAiSummaryResponse : undefined;
    return {
      message: data?.message || error.message || "AI summary generation failed.",
      summary,
    };
  }

  return {
    message: error instanceof Error ? error.message : "AI summary generation failed.",
  };
};

const MarkdownPreview = ({ markdown }: { markdown: string }) => {
  const blocks = useMemo(() => markdown.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean), [markdown]);

  if (blocks.length === 0) {
    return <p className="text-sm text-slate-500">No AI summary has been generated.</p>;
  }

  return (
    <div className="space-y-4">
      {blocks.map((block, index) => {
        if (block.startsWith("# ")) {
          return (
            <h1 key={index} className="text-xl font-semibold leading-tight text-slate-950">
              {block.replace(/^#\s+/, "")}
            </h1>
          );
        }
        if (block.startsWith("## ")) {
          return (
            <h2 key={index} className="border-b border-slate-200 pb-2 text-base font-semibold text-slate-900">
              {block.replace(/^##\s+/, "")}
            </h2>
          );
        }
        if (block.split("\n").every((line) => line.trim().startsWith("- "))) {
          return (
            <ul key={index} className="space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {block.split("\n").map((line, itemIndex) => (
                <li key={itemIndex} className="list-disc">
                  {line.replace(/^-\s+/, "")}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {block}
          </p>
        );
      })}
    </div>
  );
};

export function AuditReviewAiSummaryPanel({ report }: AuditReviewAiSummaryPanelProps) {
  const [summary, setSummary] = useState<AuditReviewAiSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryStyle, setSummaryStyle] = useState("executive");
  const [includeCapa, setIncludeCapa] = useState(true);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditReviewAiSummary(report.report_id);
      setSummary(data);
    } catch (loadError) {
      const mapped = mapAiSummaryError(loadError);
      setError(mapped.message);
      if (mapped.summary) setSummary(mapped.summary);
    } finally {
      setLoading(false);
    }
  }, [report.report_id]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await generateAuditReviewAiSummary(report.report_id, {
        summary_style: summaryStyle,
        include_capa_recommendations: includeCapa,
      });
      setSummary(data);
      toast.success("AI-assisted summary generated");
    } catch (generateError) {
      const mapped = mapAiSummaryError(generateError);
      setError(mapped.message);
      if (mapped.summary) setSummary(mapped.summary);
      toast.error(mapped.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleClear = async () => {
    const confirmed = window.confirm("Clear the stored AI-assisted summary for this report?");
    if (!confirmed) return;

    setClearing(true);
    setError(null);
    try {
      const data = await clearAuditReviewAiSummary(report.report_id);
      setSummary(data);
      toast.success("AI-assisted summary cleared");
    } catch (clearError) {
      const mapped = mapAiSummaryError(clearError);
      setError(mapped.message);
      if (mapped.summary) setSummary(mapped.summary);
      toast.error(mapped.message);
    } finally {
      setClearing(false);
    }
  };

  const status = summary?.status || "NOT_REQUESTED";
  const hasGeneratedSummary = Boolean(summary?.ai_summary_markdown && status === "GENERATED");
  const hasStoredAiState = Boolean(
    summary && (hasGeneratedSummary || status === "FAILED" || summary.ai_summary_json || summary.error_message),
  );
  const buttonLabel = hasGeneratedSummary ? "Regenerate AI Summary" : "Generate AI Summary";
  const actionBusy = loading || generating || clearing;

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="AI-assisted audit review summary">
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50 text-cyan-700">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">AI-Assisted Summary</h3>
              <Badge variant="outline" className={getAiStatusBadgeClass(status)}>
                {formatLabel(status)}
              </Badge>
            </div>
            <p className="mt-1 text-xs font-medium text-amber-700">
              AI-generated narrative. Deterministic checks and QA review remain authoritative.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={handleGenerate} disabled={actionBusy}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {buttonLabel}
          </Button>
          {hasStoredAiState ? (
            <Button type="button" size="sm" variant="outline" onClick={handleClear} disabled={actionBusy}>
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Clear
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void loadSummary()} disabled={actionBusy}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[12rem_12rem_minmax(0,1fr)]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Style</label>
            <Select value={summaryStyle} onValueChange={setSummaryStyle} disabled={actionBusy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUMMARY_STYLES.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">CAPA wording</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-800">{includeCapa ? "Included" : "Excluded"}</span>
              <Switch checked={includeCapa} onCheckedChange={setIncludeCapa} disabled={actionBusy} />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Generated</p>
            <p className="mt-1 whitespace-nowrap text-sm font-medium text-slate-900">{formatDateTime(summary?.generated_dt)}</p>
          </div>
        </div>

        {summary?.model_name || summary?.generated_by ? (
          <div className="flex flex-wrap gap-2 text-xs text-slate-600">
            {summary.generated_by ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                <Clock className="h-3.5 w-3.5" />
                Generated by {summary.generated_by}
              </span>
            ) : null}
            {summary.model_name ? (
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                Model {summary.model_name}
              </span>
            ) : null}
          </div>
        ) : null}

        {error || summary?.error_message ? (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>{error || summary?.error_message}</span>
          </div>
        ) : null}

        {loading && !summary ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            Loading AI-assisted summary...
          </div>
        ) : hasGeneratedSummary ? (
          <div className="max-h-[30rem] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-5">
            <MarkdownPreview markdown={summary?.ai_summary_markdown || ""} />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            AI-assisted summary has not been generated for this report.
          </div>
        )}
      </div>
    </section>
  );
}
