import React, { useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

/* ─── Modal ─── */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnBackdrop?: boolean;
  closeButtonTooltip?: string;
}

const sizeStyles = {
  sm:   "max-w-sm",
  md:   "max-w-lg",
  lg:   "max-w-2xl",
  xl:   "max-w-4xl",
  full: "max-w-7xl mx-4",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  closeOnBackdrop = true,
  closeButtonTooltip,
}: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={() => closeOnBackdrop && onClose()}
      />
      {/* Dialog */}
      <div
        className={`relative bg-white rounded-2xl shadow-xl w-full ${sizeStyles[size]} flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            </div>
            {closeButtonTooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={onClose}
                    className="ml-4 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0 mt-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </TooltipTrigger>
                <TooltipContent sideOffset={6}>{closeButtonTooltip}</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={onClose}
                className="ml-4 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0 mt-0.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Drawer (side panel) ─── */
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "right" | "left";
  width?: string;
}

export function Drawer({
  open, onClose, title, description, children, footer, side = "right", width = "w-[42rem] max-w-[96vw]",
}: DrawerProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && open) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      {/* Panel */}
      <div
        className={`absolute inset-y-0 ${side === "right" ? "right-0 border-l" : "left-0 border-r"} ${width} bg-white shadow-xl flex flex-col border-slate-200`}
        style={{ transition: "transform 200ms ease" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          </div>
          <button
            onClick={onClose}
            className="ml-3 w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0 flex items-center gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Confirm Dialog ─── */
interface ConfirmProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  variant?: "danger" | "warning" | "primary";
}

export function ConfirmDialog({
  open, onConfirm, onCancel, title = "Are you sure?",
  message = "This action cannot be undone.",
  confirmLabel = "Confirm", variant = "danger",
}: ConfirmProps) {
  const variantBtnStyles = {
    danger:  "bg-red-600 hover:bg-red-700 border-red-600",
    warning: "bg-amber-600 hover:bg-amber-700 border-amber-600",
    primary: "bg-blue-600 hover:bg-blue-700 border-blue-600",
  };

  return (
    <Modal open={open} onClose={onCancel} size="sm" closeOnBackdrop={false}>
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${variant === "danger" ? "bg-red-50" : variant === "warning" ? "bg-amber-50" : "bg-blue-50"}`}>
          <svg className={`w-6 h-6 ${variant === "danger" ? "text-red-500" : variant === "warning" ? "text-amber-500" : "text-blue-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{message}</p>
        </div>
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={onCancel}
            className="flex-1 h-9 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 h-9 rounded-lg border text-white text-sm font-medium transition-colors ${variantBtnStyles[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
