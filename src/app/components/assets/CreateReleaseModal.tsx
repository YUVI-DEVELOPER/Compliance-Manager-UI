import React, { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Modal } from "../ui/Modal";
import { createRelease } from "../../../services/release.service";
import { useCurrentActor } from "../../auth/useCurrentActor";
import {
  buildCreateReleasePayload,
  DOCUMENTATION_MODE_MANUAL,
  DOCUMENTATION_MODE_ONLINE_FETCH,
  EMPTY_RELEASE_FORM,
  ENVIRONMENT_OPTIONS,
  EXPECTED_IMPACT_OPTIONS,
  formatDocumentationMode,
  formatReleaseEnum,
  mapReleaseAxiosError,
  RELEASE_TYPE_OPTIONS,
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

export function CreateReleaseModal({
  open,
  assetId,
  assetName,
  onClose,
  onCreated,
}: CreateReleaseModalProps) {
  const currentActor = useCurrentActor();
  const actorName = currentActor.auditName ?? currentActor.displayName;
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
      await createRelease(assetId, buildCreateReleasePayload(formData, actorName));
      toast.success("Release created and validation package initialized. Next step: Impact Assessment.");
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
            {submitting ? "Creating..." : "Create Release & Continue"}
          </Button>
        </>
      }
    >
      <form id="create-release-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        {renderReleaseFieldError(fieldErrors, "form")}

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-800">Release Details</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Input
                label="Release Name"
                value={formData.release_name}
                onChange={(event) => updateField("release_name", event.target.value)}
                required
              />
              {renderReleaseFieldError(fieldErrors, "release_name")}
            </div>

            <div className="space-y-1">
              <Input
                label="Previous Version"
                value={formData.previous_version}
                onChange={(event) => updateField("previous_version", event.target.value)}
                required
              />
              {renderReleaseFieldError(fieldErrors, "previous_version")}
            </div>

            <div className="space-y-1">
              <Input
                label="New Version"
                value={formData.version}
                onChange={(event) => updateField("version", event.target.value)}
                required
              />
              {renderReleaseFieldError(fieldErrors, "version")}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Release Type</label>
              <select
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                value={formData.release_type}
                onChange={(event) => updateField("release_type", event.target.value)}
                required
              >
                <option value="">Select release type</option>
                {RELEASE_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{formatReleaseEnum(option)}</option>
                ))}
              </select>
              {renderReleaseFieldError(fieldErrors, "release_type")}
            </div>

            <div className="space-y-1">
              <Input
                label="Planned Implementation Date"
                type="date"
                value={formData.planned_implementation_date}
                onChange={(event) => updateField("planned_implementation_date", event.target.value)}
                required
              />
              {renderReleaseFieldError(fieldErrors, "planned_implementation_date")}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Environment</label>
              <select
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
                value={formData.environment}
                onChange={(event) => updateField("environment", event.target.value)}
                required
              >
                <option value="">Select environment</option>
                {ENVIRONMENT_OPTIONS.map((option) => (
                  <option key={option} value={option}>{formatReleaseEnum(option)}</option>
                ))}
              </select>
              {renderReleaseFieldError(fieldErrors, "environment")}
            </div>

            <div className="space-y-1 col-span-2">
              <Input
                label="Vendor"
                value={formData.vendor_name}
                onChange={(event) => updateField("vendor_name", event.target.value)}
              />
              {renderReleaseFieldError(fieldErrors, "vendor_name")}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-800">Release Documentation</h4>
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

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-800">Business Justification</h4>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Release Description</label>
            <Textarea
              rows={4}
              value={formData.release_description}
              onChange={(event) => updateField("release_description", event.target.value)}
            />
            {renderReleaseFieldError(fieldErrors, "release_description")}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Business Reason</label>
            <Textarea
              rows={4}
              value={formData.business_reason}
              onChange={(event) => updateField("business_reason", event.target.value)}
            />
            {renderReleaseFieldError(fieldErrors, "business_reason")}
          </div>
          <div className="space-y-1">
            <Input
              label="Change Control No."
              value={formData.change_control_no}
              onChange={(event) => updateField("change_control_no", event.target.value)}
            />
            {renderReleaseFieldError(fieldErrors, "change_control_no")}
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-800">Initial Compliance Classification</h4>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Expected Validated Functionality Impact</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
              value={formData.expected_validated_functionality_impact}
              onChange={(event) => updateField("expected_validated_functionality_impact", event.target.value)}
              required
            >
              <option value="">Select impact</option>
              {EXPECTED_IMPACT_OPTIONS.map((option) => (
                <option key={option} value={option}>{formatReleaseEnum(option)}</option>
              ))}
            </select>
            {renderReleaseFieldError(fieldErrors, "expected_validated_functionality_impact")}
          </div>
        </section>
      </form>
    </Modal>
  );
}
