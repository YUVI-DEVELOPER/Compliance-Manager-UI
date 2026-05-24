import * as React from "react";
import { X } from "lucide-react";

import { Button } from "../ui/button";
import { cn } from "../ui/utils";

interface RightPanelProps {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  className?: string;
  widthClassName?: string;
}

export function RightPanel({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  className,
  widthClassName,
}: RightPanelProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close panel" onClick={onClose} />
      <section
        className={cn(
          "relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl",
          widthClassName,
          className,
        )}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-900">{title}</h2>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="shrink-0 border-t border-slate-200 px-5 py-4">{footer}</footer> : null}
      </section>
    </div>
  );
}

