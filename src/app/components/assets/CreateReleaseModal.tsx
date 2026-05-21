import React, { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Modal } from "../ui/Modal";
import { createRelease } from "../../../services/release.service";
import {
  buildCreateReleasePayload,
  DOCUMENTATION_MODE_MANUAL,
  DOCUMENTATION_MODE_ONLINE_FETCH,
  EMPTY_RELEASE_FORM,
  formatDocumentationMode,
  mapReleaseAxiosError,
  ReleaseFieldErrors,
  ReleaseFormState,
  renderReleaseFieldError,
  validateReleaseForm,
} from "./releaseForm.shared";

interface CreateReleaseModalProps {
  open: boolean;
  assetId: string | null;
  assetName?: string | null;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}

const DEFAULT_CREATED_BY = "admin";

export function CreateReleaseModal({
  open,
  assetId,
  assetName,
  onClose,
  onCreated,
}: CreateReleaseModalProps) {
  const [formData, setFormData] = useState<ReleaseFormState>(EMPTY_RELEASE_FORM);
  const [fieldErrors, setFieldErrors] = useState<ReleaseFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormData(EMPTY_RELEASE_FORM);
      setFieldErrors({});
      setSubmitting(false);
      return;
    }

    setFormData(EMPTY_RELEASE_FORM);
    setFieldErrors({});
  }, [open, assetId]);

  const updateField = <K extends keyof ReleaseFormState>(key: K, value: ReleaseFormState[K]) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!assetId || submitting) return;

    const validationErrors = validateReleaseForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      await createRelease(assetId, buildCreateReleasePayload(formData, DEFAULT_CREATED_BY));
      toast.success("Release created and impact assessment generated.");
      await onCreated();
      onClose();
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Release"
      description={
        assetName
          ? `Enter release details and documentation for ${assetName}.`
          : "Enter release details and documentation for the selected asset."
      }
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-release-form" disabled={submitting || !assetId}>
            {submitting ? "Creating..." : "Create Release"}
          </Button>
        </>
      }
    >
      <form id="create-release-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        {renderReleaseFieldError(fieldErrors, "form")}

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-800">Release Info</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Input
                label="Version"
                value={formData.version}
                onChange={(event) => updateField("version", event.target.value)}
                required
              />
              {renderReleaseFieldError(fieldErrors, "version")}
            </div>

            <div className="space-y-1">
              <Input
                label="End Date"
                type="date"
                value={formData.end_dt}
                onChange={(event) => updateField("end_dt", event.target.value)}
              />
              {renderReleaseFieldError(fieldErrors, "end_dt")}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Documentation Mode</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
              value={formData.documentation_mode}
              onChange={(event) => updateField("documentation_mode", event.target.value)}
            >
              <option value={DOCUMENTATION_MODE_MANUAL}>
                {formatDocumentationMode(DOCUMENTATION_MODE_MANUAL)}
              </option>
              <option value={DOCUMENTATION_MODE_ONLINE_FETCH}>
                {formatDocumentationMode(DOCUMENTATION_MODE_ONLINE_FETCH)}
              </option>
            </select>
            {renderReleaseFieldError(fieldErrors, "documentation_mode")}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">System Configuration Report</label>
            <Textarea
              rows={5}
              value={formData.system_config_report}
              onChange={(event) => updateField("system_config_report", event.target.value)}
              placeholder="Add system configuration details"
            />
            {renderReleaseFieldError(fieldErrors, "system_config_report")}
          </div>

          {formData.documentation_mode === DOCUMENTATION_MODE_MANUAL ? (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Documentation Text</label>
              <Textarea
                rows={8}
                value={formData.documentation_text}
                onChange={(event) => updateField("documentation_text", event.target.value)}
                placeholder="Paste or enter the release documentation used for impact assessment"
              />
              <p className="text-xs text-slate-500">
                Manual mode stores the entered documentation directly on the release.
              </p>
              {renderReleaseFieldError(fieldErrors, "documentation_text")}
            </div>
          ) : (
            <div className="space-y-1">
              <Input
                label="Documentation Source URL"
                type="url"
                value={formData.documentation_source_url}
                onChange={(event) => updateField("documentation_source_url", event.target.value)}
                placeholder="https://example.com/release-notes"
              />
              <p className="text-xs text-slate-500">
                Online fetch mode loads and normalizes documentation from the provided URL during release creation.
              </p>
              {renderReleaseFieldError(fieldErrors, "documentation_source_url")}
            </div>
          )}
        </section>
      </form>
    </Modal>
  );
}
