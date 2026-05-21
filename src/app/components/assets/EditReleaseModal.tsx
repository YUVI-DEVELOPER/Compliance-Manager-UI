import React, { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Modal } from "../ui/Modal";
import { getReleaseById, ReleaseRecord, updateRelease } from "../../../services/release.service";
import {
  buildUpdateReleasePayload,
  DOCUMENTATION_MODE_MANUAL,
  DOCUMENTATION_MODE_ONLINE_FETCH,
  EMPTY_RELEASE_FORM,
  formatDocumentationMode,
  formatReleaseDateTime,
  mapReleaseAxiosError,
  ReleaseFieldErrors,
  ReleaseFormState,
  releaseToForm,
  renderReleaseFieldError,
  validateReleaseForm,
} from "./releaseForm.shared";

interface EditReleaseModalProps {
  open: boolean;
  releaseId: string | null;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
}

const DEFAULT_MODIFIED_BY = "admin";

export function EditReleaseModal({
  open,
  releaseId,
  onClose,
  onUpdated,
}: EditReleaseModalProps) {
  const [release, setRelease] = useState<ReleaseRecord | null>(null);
  const [formData, setFormData] = useState<ReleaseFormState>(EMPTY_RELEASE_FORM);
  const [initialFormData, setInitialFormData] = useState<ReleaseFormState>(EMPTY_RELEASE_FORM);
  const [fieldErrors, setFieldErrors] = useState<ReleaseFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !releaseId) return;

    let cancelled = false;
    setLoading(true);
    setFieldErrors({});

    const run = async () => {
      try {
        const detail = await getReleaseById(releaseId);
        if (cancelled) return;

        const nextForm = releaseToForm(detail);
        setRelease(detail);
        setFormData(nextForm);
        setInitialFormData(nextForm);
      } catch (error) {
        if (cancelled) return;
        const mapped = mapReleaseAxiosError(error);
        toast.error(mapped.message);
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, releaseId, onClose]);

  useEffect(() => {
    if (open) return;

    setRelease(null);
    setFormData(EMPTY_RELEASE_FORM);
    setInitialFormData(EMPTY_RELEASE_FORM);
    setFieldErrors({});
    setLoading(false);
    setSubmitting(false);
  }, [open]);

  const updateField = <K extends keyof ReleaseFormState>(key: K, value: ReleaseFormState[K]) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!releaseId || submitting) return;

    const validationErrors = validateReleaseForm(formData, { createdDt: release?.created_dt });
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    const payload = buildUpdateReleasePayload(initialFormData, formData, DEFAULT_MODIFIED_BY);
    if (Object.keys(payload).length === 1 && payload.modified_by) {
      toast.message("No changes to save");
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      await updateRelease(releaseId, payload);
      toast.success("Release updated successfully");
      await onUpdated();
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
      title="Edit Release"
      description="Only modified fields are sent to the backend."
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="edit-release-form" disabled={loading || submitting || !releaseId}>
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="text-sm text-slate-600">Loading release...</div>
      ) : (
        <form id="edit-release-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          {renderReleaseFieldError(fieldErrors, "form")}

          <section className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-800">Release Info</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Input
                  label="Version"
                  value={formData.version}
                  onChange={(event) => updateField("version", event.target.value)}
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
                  placeholder="Paste or update the release documentation used for impact assessment"
                />
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
                {release?.documentation_fetched_at ? (
                  <p className="text-xs text-slate-500">
                    Last fetched {formatReleaseDateTime(release.documentation_fetched_at)}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Updating the source URL lets the backend fetch the latest release documentation again.
                  </p>
                )}
                {renderReleaseFieldError(fieldErrors, "documentation_source_url")}
              </div>
            )}
          </section>
        </form>
      )}
    </Modal>
  );
}
