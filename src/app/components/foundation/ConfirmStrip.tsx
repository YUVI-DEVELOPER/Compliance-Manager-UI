import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "../ui/button";
import { cn } from "../ui/utils";

interface ConfirmStripProps {
  title: React.ReactNode;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  tone?: "warning" | "danger" | "neutral";
  className?: string;
}

const toneClasses = {
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-900",
  neutral: "border-slate-200 bg-slate-50 text-slate-900",
};

export function ConfirmStrip({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  disabled = false,
  tone = "warning",
  className,
}: ConfirmStripProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-md border px-3 py-2", toneClasses[tone], className)}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <div className="min-w-48 flex-1">
        <div className="text-sm font-semibold">{title}</div>
        {message ? <div className="mt-0.5 text-xs opacity-80">{message}</div> : null}
      </div>
      <div className="flex items-center gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={disabled}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button type="button" variant={tone === "danger" ? "destructive" : "default"} size="sm" onClick={onConfirm} disabled={disabled}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

