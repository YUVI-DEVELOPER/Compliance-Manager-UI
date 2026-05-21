import React from "react";
import { Modal } from "./Modal";
import { Button } from "./button";

interface RestoreDraftDialogProps {
  open: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

export function RestoreDraftDialog({ open, onRestore, onDiscard }: RestoreDraftDialogProps) {
  return (
    <Modal open={open} onClose={onDiscard} closeOnBackdrop={false} size="sm">
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-blue-50">
          <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Restore unsaved draft?</h3>
          <p className="text-sm text-slate-500 mt-1">A locally saved draft was found for this form.</p>
        </div>
        <div className="flex items-center gap-2 w-full">
          <Button type="button" variant="outline" className="flex-1" onClick={onDiscard}>
            Discard
          </Button>
          <Button type="button" className="flex-1" onClick={onRestore}>
            Restore
          </Button>
        </div>
      </div>
    </Modal>
  );
}

