import React from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Database,
  Download,
  Eye,
  FileText,
  Loader2,
  PlusCircle,
  RefreshCw,
  Send,
} from "lucide-react";

import {
  AuditReviewJobDetail,
  AuditReviewReportDetail,
} from "../../../services/audit-review.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { useAuth } from "../../auth/useAuth";
import {
  formatAuditReviewDateTime,
  formatAuditReviewLabel,
  formatAuditReviewNumber,
  formatAuditReviewPeriod,
  getAuditReviewScoreLabel,
  getAuditReviewSelectedTypes,
  getAuditReviewJobStatusBadgeClass,
  getAuditReviewLastUpdated,
  getAuditReviewLifecycleStatus,
  getAuditReviewReportStatusBadgeClass,
  AuditReviewUiAction,
  AuditReviewUiActionKey,
  canUseAuditReviewAction,
} from "./auditReviewUi.shared";
import {
  formatAuditReviewRating,
  getAuditReviewRatingBadgeClass,
} from "./AuditReviewScoreCard";

interface AuditReviewHeroSummaryProps {
  job: AuditReviewJobDetail | null;
  report: AuditReviewReportDetail | null;
  primaryAction: AuditReviewUiAction;
  secondaryAction?: AuditReviewUiAction | null;
  onAction: (action: AuditReviewUiActionKey) => void;
}

const actionIcons: Record<AuditReviewUiActionKey, React.ComponentType<{ className?: string }>> = {
  run: PlusCircle,
  extract: Database,
  analyze: BarChart3,
  "generate-report": FileText,
  "open-report": Eye,
  "submit-review": Send,
  "review-decision": CheckCircle2,
  "download-pdf": Download,
  refresh: RefreshCw,
  none: ClipboardCheck,
};

const HeroMetric = ({
  label,
  value,
  badgeClass,
}: {
  label: string;
  value: React.ReactNode;
  badgeClass?: string;
}) => (
  <div className="min-w-0 rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
    {badgeClass ? (
      <Badge variant="outline" className={`mt-1 max-w-full ${badgeClass}`}>
        <span className="truncate">{value}</span>
      </Badge>
    ) : (
      <p className="mt-1 truncate text-sm font-semibold text-slate-900" title={typeof value === "string" ? value : undefined}>
        {value}
      </p>
    )}
  </div>
);

const getLifecycleBadgeClass = (
  lifecycle: string,
  report: AuditReviewReportDetail | null,
): string => {
  if (report?.status && lifecycle === report.status) return getAuditReviewReportStatusBadgeClass(report.status);
  return getAuditReviewJobStatusBadgeClass(lifecycle);
};

export function AuditReviewHeroSummary({
  job,
  report,
  primaryAction,
  secondaryAction,
  onAction,
}: AuditReviewHeroSummaryProps) {
  const { hasAnyPermission } = useAuth();
  const lifecycle = getAuditReviewLifecycleStatus(job, report);
  const PrimaryIcon = actionIcons[primaryAction.key];
  const SecondaryIcon = secondaryAction ? actionIcons[secondaryAction.key] : null;
  const selectedTypes = getAuditReviewSelectedTypes(job);
  const canUsePrimaryAction = canUseAuditReviewAction(primaryAction.key, hasAnyPermission);
  const canUseSecondaryAction = secondaryAction ? canUseAuditReviewAction(secondaryAction.key, hasAnyPermission) : false;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50/70 px-5 py-5">
        <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="flex min-w-0 gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700 shadow-sm sm:flex">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-normal text-slate-950">Audit Trail Reviews</h2>
                <Badge variant="outline" className={getLifecycleBadgeClass(lifecycle, report)}>
                  {lifecycle === "NO_JOB" ? "No Job" : formatAuditReviewLabel(lifecycle)}
                </Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
                Periodic compliance review of Veeva audit trail activity for this asset
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center 2xl:justify-end">
            {secondaryAction && canUseSecondaryAction ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onAction(secondaryAction.key)}
                disabled={secondaryAction.disabled || secondaryAction.loading}
                className="h-10"
              >
                {secondaryAction.loading && SecondaryIcon ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : SecondaryIcon ? (
                  <SecondaryIcon className="h-4 w-4" />
                ) : null}
                {secondaryAction.label}
              </Button>
            ) : null}
            {canUsePrimaryAction ? (
              <Button
                type="button"
                onClick={() => onAction(primaryAction.key)}
                disabled={primaryAction.disabled || primaryAction.loading || primaryAction.key === "none"}
                className="h-10"
              >
                {primaryAction.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PrimaryIcon className="h-4 w-4" />}
                {primaryAction.label}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
          <HeroMetric label="Latest Review Period" value={formatAuditReviewPeriod(job?.review_start_dt, job?.review_end_dt)} />
          <HeroMetric
            label="Lifecycle Status"
            value={lifecycle === "NO_JOB" ? "Not Started" : formatAuditReviewLabel(lifecycle)}
            badgeClass={getLifecycleBadgeClass(lifecycle, report)}
          />
          <HeroMetric label="Review Scope" value={formatAuditReviewLabel(job?.review_scope)} />
          <HeroMetric label="Audit Trails" value={selectedTypes.map(formatAuditReviewLabel).join(", ") || "-"} />
          <HeroMetric label="Records Reviewed" value={formatAuditReviewNumber(job?.record_count)} />
          <HeroMetric label={getAuditReviewScoreLabel(job)} value={job?.overall_score !== undefined && job?.overall_score !== null ? `${job.overall_score}/100` : "-"} />
          <HeroMetric
            label="Rating"
            value={formatAuditReviewRating(job?.rating)}
            badgeClass={getAuditReviewRatingBadgeClass(job?.rating)}
          />
          <HeroMetric label="Last Updated" value={formatAuditReviewDateTime(getAuditReviewLastUpdated(job, report))} />
        </div>
      </div>
    </section>
  );
}
