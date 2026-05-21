import React from "react";

import { Switch } from "../ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  DocumentAiAutofillUiState,
  formatAiAutofillConfidence,
  getAiAutofillConfidenceClass,
} from "./documentLinkForm.shared";

interface DocumentAiAutofillControlsProps {
  enabled: boolean;
  disabled?: boolean;
  state: DocumentAiAutofillUiState;
  onEnabledChange: (checked: boolean) => void;
}

export function DocumentAiAutofillControls({
  enabled,
  disabled = false,
  state,
  onEnabledChange,
}: DocumentAiAutofillControlsProps) {
  const statusText =
    state.status === "analyzing"
      ? "Analyzing document"
      : state.status === "complete"
        ? "Metadata ready for review"
        : state.status === "failed"
          ? "Review manually"
          : enabled
            ? "Upload a local file"
            : "Manual entry";

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">AI Autofill</p>
          <p className="text-xs text-slate-500">{statusText}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} disabled={disabled} aria-label="AI Autofill" />
      </div>

      {enabled && state.status === "analyzing" ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-blue-600" />
        </div>
      ) : null}

      {enabled && state.error ? <p className="mt-2 text-xs text-red-600">{state.error}</p> : null}

      {enabled && state.result?.warnings.length ? (
        <div className="mt-2 space-y-1">
          {state.result.warnings.slice(0, 3).map((warning) => (
            <p key={warning} className="text-xs text-amber-700">
              {warning}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface DocumentAiAutofillBadgeProps {
  confidence?: number | null;
  source?: string | null;
  visible?: boolean;
}

const getAiAutofillText = (confidence?: number | null, source?: string | null) =>
  `AI detected ${formatAiAutofillConfidence(confidence)}${source ? ` - ${source}` : ""}`;

export function DocumentAiAutofillBadge({ confidence, source, visible = true }: DocumentAiAutofillBadgeProps) {
  if (!visible) return null;

  return (
    <span
      className={`inline-flex h-6 items-center rounded-full border px-2 text-[11px] font-medium ${getAiAutofillConfidenceClass(
        confidence,
      )}`}
    >
      {getAiAutofillText(confidence, source)}
    </span>
  );
}

interface DocumentAiAutofillFieldHintProps {
  enabled: boolean;
  confidence?: number | null;
  source?: string | null;
  children: React.ReactElement;
}

export function DocumentAiAutofillFieldHint({
  enabled,
  confidence,
  source,
  children,
}: DocumentAiAutofillFieldHintProps) {
  if (!enabled) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent sideOffset={6} className="max-w-[220px] bg-slate-900 text-white">
        {getAiAutofillText(confidence, source)}
      </TooltipContent>
    </Tooltip>
  );
}
