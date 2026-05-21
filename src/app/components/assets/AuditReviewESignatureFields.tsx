import React from "react";

import { useAuth } from "../../auth/useAuth";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { cn } from "../ui/utils";

export const AUDIT_REVIEW_SIGNATURE_MEANING = "Electronic approval of the audit review report";

export interface AuditReviewESignatureFieldErrors {
  email?: string | null;
  password?: string | null;
  confirmed?: string | null;
  form?: string | null;
}

interface AuditReviewESignatureFieldsProps {
  email: string;
  password: string;
  confirmed: boolean;
  disabled?: boolean;
  errors?: AuditReviewESignatureFieldErrors;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmedChange: (value: boolean) => void;
}

const DEFAULT_E_SIGNATURE_ERROR = "Electronic signature validation failed. Check the highlighted fields.";

const responsePayload = (error: unknown): { message?: string; detail?: unknown; data?: { field?: string } } | undefined => {
  if (typeof error !== "object" || error === null || !("response" in error)) return undefined;
  const response = (error as { response?: { data?: { message?: string; detail?: unknown; data?: { field?: string } } } }).response;
  return response?.data;
};

const detailMessage = (detail: unknown): string | null => {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (!Array.isArray(detail)) return null;
  const first = detail.find((item) => typeof item === "object" && item !== null && "msg" in item);
  const message = first && typeof (first as { msg?: unknown }).msg === "string" ? (first as { msg: string }).msg : null;
  return message?.trim() || null;
};

const fieldFromValidationDetail = (detail: unknown): string | null => {
  if (!Array.isArray(detail)) return null;
  const item = detail.find((entry) => {
    if (typeof entry !== "object" || entry === null || !("loc" in entry)) return false;
    const loc = (entry as { loc?: unknown }).loc;
    return Array.isArray(loc) && loc.some((part) => String(part).includes("e_signature"));
  });
  const loc = item && typeof item === "object" && "loc" in item ? (item as { loc?: unknown }).loc : null;
  return Array.isArray(loc) ? loc.map(String).join(".") : null;
};

export const getAuditReviewESignatureFieldErrors = (error: unknown): AuditReviewESignatureFieldErrors => {
  const payload = responsePayload(error);
  const message = payload?.message || detailMessage(payload?.detail) || DEFAULT_E_SIGNATURE_ERROR;
  const field = payload?.data?.field || fieldFromValidationDetail(payload?.detail);

  if (field?.endsWith("user_email")) return { email: message };
  if (field?.endsWith("current_password")) return { password: message };
  if (field?.endsWith("confirmed")) return { confirmed: message };

  return { form: message };
};

export function AuditReviewESignatureFields({
  email,
  password,
  confirmed,
  disabled = false,
  errors,
  onEmailChange,
  onPasswordChange,
  onConfirmedChange,
}: AuditReviewESignatureFieldsProps) {
  const { user } = useAuth();
  const signerName = user?.full_name?.trim() || user?.email || "-";
  const signerEmail = user?.email || "";
  const roleLabel = user?.roles?.length ? user.roles.join(", ") : "-";

  return (
    <div className="space-y-3">
      {errors?.form ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errors.form}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3">
        <Input label="Signer" value={signerName} readOnly disabled={disabled} className="bg-slate-50" />
        <Input label="Role at signature" value={roleLabel} readOnly disabled={disabled} className="bg-slate-50" />
        <div className="space-y-1">
          <Input
            label="User email"
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder={signerEmail || "name@example.com"}
            autoComplete="username"
            disabled={disabled}
            required
            aria-invalid={Boolean(errors?.email)}
            className={cn(errors?.email ? "border-red-300 bg-red-50 focus-visible:border-red-500 focus-visible:ring-red-200" : null)}
          />
          {errors?.email ? <p className="text-xs font-medium text-red-600">{errors.email}</p> : null}
        </div>
        <div className="space-y-1">
          <Input
            label="Current password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            autoComplete="current-password"
            disabled={disabled}
            required
            aria-invalid={Boolean(errors?.password)}
            className={cn(errors?.password ? "border-red-300 bg-red-50 focus-visible:border-red-500 focus-visible:ring-red-200" : null)}
          />
          {errors?.password ? <p className="text-xs font-medium text-red-600">{errors.password}</p> : null}
        </div>
      </div>
      <div>
        <div className="text-sm font-medium text-slate-700">Signature meaning</div>
        <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {AUDIT_REVIEW_SIGNATURE_MEANING}
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(value) => onConfirmedChange(value === true)}
          disabled={disabled}
          aria-invalid={Boolean(errors?.confirmed)}
          className={cn("mt-0.5", errors?.confirmed ? "border-red-400" : null)}
        />
        <span>
          I confirm this electronic signature records my final QA approval of this audit review report.
          {errors?.confirmed ? <span className="mt-1 block text-xs font-medium text-red-600">{errors.confirmed}</span> : null}
        </span>
      </label>
    </div>
  );
}
