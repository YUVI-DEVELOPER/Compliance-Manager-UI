import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, ListChecks, Loader2, ShieldCheck } from "lucide-react";

import {
  AuditReviewJobCreatePayload,
  AuditReviewMetadata,
  AuditReviewScope,
  getAuditReviewMetadata,
} from "../../../services/audit-review.service";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

interface AuditReviewRunDialogProps {
  open: boolean;
  assetName?: string | null;
  assetCode?: string | null;
  defaultRequestedBy?: string | null;
  creating: boolean;
  onClose: () => void;
  onCreate: (payload: AuditReviewJobCreatePayload) => Promise<void>;
}

interface FormState {
  reviewStart: string;
  reviewEnd: string;
  reviewScope: AuditReviewScope;
  selectedAuditTrailTypes: string[];
  veevaInstanceName: string;
  veevaAppName: string;
}

const fallbackMetadata: AuditReviewMetadata = {
  supported_audit_trail_types: [
    { code: "login_audit_trail", label: "Login Audit Trail" },
    { code: "document_audit_trail", label: "Document Audit Trail" },
    { code: "object_audit_trail", label: "Object Audit Trail" },
    { code: "system_audit_trail", label: "System Audit Trail" },
    { code: "domain_audit_trail", label: "Domain Audit Trail" },
  ],
  review_scopes: [
    { code: "LOGIN_ONLY", label: "Login Only", score_label: "Login Audit Trail Score", audit_trail_types: ["login_audit_trail"] },
    { code: "DOCUMENT_ONLY", label: "Document Only", score_label: "Document Audit Trail Score", audit_trail_types: ["document_audit_trail"] },
    { code: "OBJECT_ONLY", label: "Object Only", score_label: "Object Audit Trail Score", audit_trail_types: ["object_audit_trail"] },
    { code: "SYSTEM_ONLY", label: "System Only", score_label: "System Audit Trail Score", audit_trail_types: ["system_audit_trail"] },
    { code: "DOMAIN_ONLY", label: "Domain Only", score_label: "Domain Audit Trail Score", audit_trail_types: ["domain_audit_trail"] },
    { code: "FULL_GXP", label: "Full GxP", score_label: "Full GxP Audit Trail Score", audit_trail_types: ["login_audit_trail", "document_audit_trail", "object_audit_trail", "system_audit_trail", "domain_audit_trail"] },
    { code: "CUSTOM", label: "Custom", score_label: "Custom Audit Trail Review Score", audit_trail_types: [] },
  ],
  full_gxp_audit_trail_types: ["login_audit_trail", "document_audit_trail", "object_audit_trail", "system_audit_trail", "domain_audit_trail"],
  checkpoint_metadata: [],
  checkpoint_applicability_matrix: {},
  parameter_card_metadata: [],
  veeva_audit_lookback_days: 30,
  veeva_audit_calendar_boundary_grace_days: 0,
  veeva_audit_extraction_chunk_days: 14,
};

const toDatetimeLocalValue = (date: Date): string => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const VEEVA_AUDIT_INGESTION_LAG_MS = 6 * 60 * 60 * 1000;

const metadataLookbackDays = (metadata: AuditReviewMetadata): number =>
  Number.isFinite(metadata.veeva_audit_lookback_days) && Number(metadata.veeva_audit_lookback_days) > 0
    ? Number(metadata.veeva_audit_lookback_days)
    : 30;

const metadataCalendarBoundaryGraceDays = (metadata: AuditReviewMetadata): number =>
  Number.isFinite(metadata.veeva_audit_calendar_boundary_grace_days) &&
  Number(metadata.veeva_audit_calendar_boundary_grace_days) > 0
    ? Number(metadata.veeva_audit_calendar_boundary_grace_days)
    : 0;

const oldestSupportedReviewStart = (metadata: AuditReviewMetadata, reference = new Date()): Date => {
  const lookbackDays = metadataLookbackDays(metadata) + metadataCalendarBoundaryGraceDays(metadata);
  return new Date(reference.getTime() - lookbackDays * MS_PER_DAY);
};

const buildDefaultReviewWindow = (metadata: AuditReviewMetadata = fallbackMetadata): Pick<FormState, "reviewStart" | "reviewEnd"> => {
  const now = new Date();
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 0, 0);

  if (now.getTime() - end.getTime() < VEEVA_AUDIT_INGESTION_LAG_MS) {
    end.setDate(end.getDate() - 1);
  }

  const start = new Date(end.getFullYear(), end.getMonth(), 1, 0, 0, 0, 0);
  const oldestStart = oldestSupportedReviewStart(metadata);
  if (start < oldestStart) {
    start.setTime(oldestStart.getTime());
  }

  return {
    reviewStart: toDatetimeLocalValue(start),
    reviewEnd: toDatetimeLocalValue(end),
  };
};

const buildDefaultState = (metadata: AuditReviewMetadata = fallbackMetadata): FormState => {
  const reviewWindow = buildDefaultReviewWindow(metadata);

  return {
    reviewStart: reviewWindow.reviewStart,
    reviewEnd: reviewWindow.reviewEnd,
    reviewScope: "LOGIN_ONLY",
    selectedAuditTrailTypes: ["login_audit_trail"],
    veevaInstanceName: "Veeva Quality Vault",
    veevaAppName: "QualityDocs",
  };
};

const toUtcIso = (value: string): string => new Date(value).toISOString();

const reviewWindowValidationMessage = (
  metadata: AuditReviewMetadata,
  reviewStart: string,
  reviewEnd: string,
): string | null => {
  if (!reviewStart || !reviewEnd) return null;
  const startDate = new Date(reviewStart);
  const endDate = new Date(reviewEnd);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;
  if (endDate <= startDate) return "Review end must be after the start date.";
  const oldestStart = oldestSupportedReviewStart(metadata);
  if (startDate < oldestStart) {
    const oldestLabel = oldestStart.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return `Veeva audit extraction supports the last ${metadataLookbackDays(metadata)} day(s). Choose a start on or after ${oldestLabel}.`;
  }
  return null;
};

export function AuditReviewRunDialog({
  open,
  assetName,
  assetCode,
  creating,
  onClose,
  onCreate,
}: AuditReviewRunDialogProps) {
  const defaultState = useMemo(() => buildDefaultState(fallbackMetadata), []);
  const [form, setForm] = useState<FormState>(defaultState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [metadata, setMetadata] = useState<AuditReviewMetadata>(fallbackMetadata);

  useEffect(() => {
    if (!open) return;
    setForm(buildDefaultState(metadata));
    setErrors({});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getAuditReviewMetadata()
      .then((nextMetadata) => {
        if (!cancelled) {
          setMetadata(nextMetadata);
          setForm((previous) => ({ ...previous, ...buildDefaultReviewWindow(nextMetadata) }));
        }
      })
      .catch(() => {
        if (!cancelled) setMetadata(fallbackMetadata);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const selectedScope = metadata.review_scopes.find((scope) => scope.code === form.reviewScope);
  const fixedScopeTypes = selectedScope?.audit_trail_types ?? [];
  const effectiveSelectedTypes =
    form.reviewScope === "CUSTOM"
      ? form.selectedAuditTrailTypes
      : fixedScopeTypes.length
        ? fixedScopeTypes
        : ["login_audit_trail"];
  const activeReviewWindowError = reviewWindowValidationMessage(metadata, form.reviewStart, form.reviewEnd);

  const updateScope = (value: AuditReviewScope) => {
    const scope = metadata.review_scopes.find((item) => item.code === value);
    setForm((previous) => ({
      ...previous,
      reviewScope: value,
      selectedAuditTrailTypes:
        value === "CUSTOM"
          ? previous.selectedAuditTrailTypes.length
            ? previous.selectedAuditTrailTypes
            : ["login_audit_trail"]
          : scope?.audit_trail_types.length
            ? scope.audit_trail_types
            : ["login_audit_trail"],
    }));
    setErrors((previous) => ({ ...previous, reviewScope: undefined, selectedAuditTrailTypes: undefined }));
  };

  const toggleAuditType = (auditTrailType: string, checked: boolean) => {
    setForm((previous) => {
      const nextTypes = checked
        ? Array.from(new Set([...previous.selectedAuditTrailTypes, auditTrailType]))
        : previous.selectedAuditTrailTypes.filter((item) => item !== auditTrailType);
      return { ...previous, selectedAuditTrailTypes: nextTypes };
    });
    setErrors((previous) => ({ ...previous, selectedAuditTrailTypes: undefined }));
  };

  const validate = (): boolean => {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    const startDate = form.reviewStart ? new Date(form.reviewStart) : null;
    const endDate = form.reviewEnd ? new Date(form.reviewEnd) : null;
    const windowError = activeReviewWindowError;

    if (!form.reviewStart) nextErrors.reviewStart = "Review start date is required.";
    if (!form.reviewEnd) nextErrors.reviewEnd = "Review end date is required.";
    if (!form.reviewScope.trim()) nextErrors.reviewScope = "Review scope is required.";
    if (effectiveSelectedTypes.length === 0) nextErrors.selectedAuditTrailTypes = "Select at least one audit trail type.";
    if (startDate && Number.isNaN(startDate.getTime())) nextErrors.reviewStart = "Enter a valid start date.";
    if (endDate && Number.isNaN(endDate.getTime())) nextErrors.reviewEnd = "Enter a valid end date.";
    if (startDate && endDate && endDate <= startDate) {
      nextErrors.reviewEnd = "Review end must be after the start date.";
    }
    if (windowError && !nextErrors.reviewStart && !nextErrors.reviewEnd) {
      nextErrors.reviewStart = windowError;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    await onCreate({
      review_start_dt: toUtcIso(form.reviewStart),
      review_end_dt: toUtcIso(form.reviewEnd),
      audit_trail_type: effectiveSelectedTypes[0] ?? "login_audit_trail",
      review_scope: form.reviewScope,
      selected_audit_trail_types: effectiveSelectedTypes,
      veeva_instance_name: form.veevaInstanceName.trim() || null,
      veeva_app_name: form.veevaAppName.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen && !creating ? onClose() : undefined)}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-slate-200 bg-slate-50 px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-slate-950">Run Audit Review</DialogTitle>
              <DialogDescription className="mt-1 block text-sm leading-5 text-slate-600">
                Create a periodic Veeva audit trail review job for {assetName || assetCode || "this asset"}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-5">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Asset</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{assetName || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Asset ID</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{assetCode || "-"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Default Source</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Veeva Quality Vault</p>
              </div>
            </div>
            {activeReviewWindowError ? <p className="text-sm text-red-600">{activeReviewWindowError}</p> : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Input
                  label="Review start"
                  type="datetime-local"
                  value={form.reviewStart}
                  onChange={(event) => updateField("reviewStart", event.target.value)}
                  iconLeft={<CalendarDays className="h-4 w-4" />}
                  aria-invalid={Boolean(errors.reviewStart)}
                  disabled={creating}
                />
                {errors.reviewStart ? <p className="mt-1 text-xs text-red-600">{errors.reviewStart}</p> : null}
              </div>
              <div>
                <Input
                  label="Review end"
                  type="datetime-local"
                  value={form.reviewEnd}
                  onChange={(event) => updateField("reviewEnd", event.target.value)}
                  iconLeft={<CalendarDays className="h-4 w-4" />}
                  aria-invalid={Boolean(errors.reviewEnd)}
                  disabled={creating}
                />
                {errors.reviewEnd ? <p className="mt-1 text-xs text-red-600">{errors.reviewEnd}</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Review scope</label>
                <Select value={form.reviewScope} onValueChange={(value) => updateScope(value as AuditReviewScope)} disabled={creating}>
                  <SelectTrigger aria-invalid={Boolean(errors.reviewScope)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {metadata.review_scopes.map((scope) => (
                      <SelectItem key={scope.code} value={scope.code}>
                        {scope.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.reviewScope ? <p className="mt-1 text-xs text-red-600">{errors.reviewScope}</p> : null}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-medium text-slate-800">Selected audit trail types</p>
              </div>
              {form.reviewScope === "CUSTOM" ? (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {metadata.supported_audit_trail_types.map((type) => (
                    <label key={type.code} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                      <Checkbox
                        checked={form.selectedAuditTrailTypes.includes(type.code)}
                        onCheckedChange={(checked) => toggleAuditType(type.code, checked === true)}
                        disabled={creating}
                      />
                      <span>{type.label}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {effectiveSelectedTypes.map((type) => (
                    <span key={type} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      {metadata.supported_audit_trail_types.find((item) => item.code === type)?.label ?? type}
                    </span>
                  ))}
                </div>
              )}
              {errors.selectedAuditTrailTypes ? <p className="mt-2 text-xs text-red-600">{errors.selectedAuditTrailTypes}</p> : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Veeva instance name"
                value={form.veevaInstanceName}
                onChange={(event) => updateField("veevaInstanceName", event.target.value)}
                disabled={creating}
              />
              <Input
                label="Veeva app name"
                value={form.veevaAppName}
                onChange={(event) => updateField("veevaAppName", event.target.value)}
                disabled={creating}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 bg-slate-50 px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || Boolean(activeReviewWindowError)}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {creating ? "Creating..." : "Create Review Job"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
