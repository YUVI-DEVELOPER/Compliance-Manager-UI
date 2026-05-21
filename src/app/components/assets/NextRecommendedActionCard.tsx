import React from "react";
import {
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  Eye,
  FileText,
  Loader2,
  PlayCircle,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";

import { Button } from "../ui/button";
import { useAuth } from "../../auth/useAuth";
import {
  AuditReviewUiAction,
  AuditReviewUiActionKey,
  canUseAuditReviewAction,
} from "./auditReviewUi.shared";

interface NextRecommendedActionCardProps {
  action: AuditReviewUiAction;
  onAction: (action: AuditReviewUiActionKey) => void;
}

const actionIcons: Record<AuditReviewUiActionKey, React.ComponentType<{ className?: string }>> = {
  run: PlayCircle,
  extract: Database,
  analyze: BarChart3,
  "generate-report": FileText,
  "open-report": Eye,
  "submit-review": Send,
  "review-decision": CheckCircle2,
  "download-pdf": Download,
  refresh: RefreshCw,
  none: Sparkles,
};

export function NextRecommendedActionCard({
  action,
  onAction,
}: NextRecommendedActionCardProps) {
  const { hasAnyPermission } = useAuth();
  const ActionIcon = actionIcons[action.key];
  const canRunAction = canUseAuditReviewAction(action.key, hasAnyPermission);

  if (!canRunAction) return null;

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm" aria-label="Next recommended audit review action">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-700">
            <ActionIcon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Next Recommended Action</p>
            <h3 className="mt-1 text-base font-semibold text-slate-950">{action.label}</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{action.description}</p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => onAction(action.key)}
          disabled={action.disabled || action.loading || action.key === "none"}
          className="self-start lg:self-center"
        >
          {action.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActionIcon className="h-4 w-4" />}
          {action.label}
        </Button>
      </div>
    </section>
  );
}
