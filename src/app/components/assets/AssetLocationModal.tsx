import React, { FormEvent, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  AssetLocationRecord,
  createAssetLocation,
  updateAssetLocation,
} from "../../../services/asset-location.service";
import {
  AssetLocationFieldErrors,
  AssetLocationFormState,
  EMPTY_ASSET_LOCATION_FORM,
  assetLocationToForm,
  buildCreateAssetLocationPayload,
  buildUpdateAssetLocationPayload,
  validateAssetLocationForm,
} from "./assetLocationForm.shared";

interface AssetLocationModalProps {
  open: boolean;
  assetId: string | null;
  assetName?: string | null;
  assetCode?: string | null;
  organization?: string | null;
  location: AssetLocationRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const DEFAULT_CREATED_BY = "admin";
const DEFAULT_MODIFIED_BY = "admin";

const FieldError = ({ error }: { error?: string }) => (
  error ? <p className="text-xs text-red-600">{error}</p> : null
);

const mapAxiosError = (error: unknown): { message: string; fieldErrors?: AssetLocationFieldErrors } => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : "Unexpected error occurred" };
  }

  const status = error.response?.status;
  const data = error.response?.data as { message?: string; detail?: unknown } | undefined;

  if (status === 400 || status === 422) {
    const fieldErrors: AssetLocationFieldErrors = {};
    if (Array.isArray(data?.detail)) {
      data.detail.forEach((item) => {
        if (typeof item === "object" && item !== null) {
          const loc = (item as { loc?: unknown }).loc;
          const msg = (item as { msg?: string }).msg;
          const field = Array.isArray(loc) && loc.length > 0 ? String(loc[loc.length - 1]) : "form";
          fieldErrors[field] = msg ?? "Invalid value";
        }
      });
    }

    return {
      message:
        (typeof data?.detail === "string" && data.detail) ||
        data?.message ||
        "Validation failed",
      fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
    };
  }

  if (status === 404) {
    return {
      message: (typeof data?.detail === "string" && data.detail) || data?.message || "Asset location record not found",
    };
  }
  if (status === 409) {
    return {
      message: (typeof data?.detail === "string" && data.detail) || data?.message || "Asset location already exists for this asset",
    };
  }
  return {
    message: (typeof data?.detail === "string" && data.detail) || data?.message || error.message || "Request failed",
  };
};

export function AssetLocationModal({
  open,
  assetId,
  assetName,
  assetCode,
  organization,
  location,
  onClose,
  onSaved,
}: AssetLocationModalProps) {
  const [formData, setFormData] = useState<AssetLocationFormState>(EMPTY_ASSET_LOCATION_FORM);
  const [initialFormData, setInitialFormData] = useState<AssetLocationFormState>(EMPTY_ASSET_LOCATION_FORM);
  const [fieldErrors, setFieldErrors] = useState<AssetLocationFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const isEditMode = Boolean(location);

  useEffect(() => {
    if (!open) {
      setFieldErrors({});
      setSubmitting(false);
      return;
    }

    const nextForm = location ? assetLocationToForm(location) : EMPTY_ASSET_LOCATION_FORM;
    setFormData(nextForm);
    setInitialFormData(nextForm);
    setFieldErrors({});
  }, [location, open]);

  const updateField = (key: keyof AssetLocationFormState, value: string) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!assetId || submitting) return;

    const validationErrors = validateAssetLocationForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      if (isEditMode) {
        const payload = buildUpdateAssetLocationPayload(initialFormData, formData, DEFAULT_MODIFIED_BY);
        if (Object.keys(payload).length === 1) {
          toast.message("No location changes to save");
          setSubmitting(false);
          return;
        }
        await updateAssetLocation(assetId, payload);
        toast.success("Asset location updated successfully");
      } else {
        await createAssetLocation(assetId, buildCreateAssetLocationPayload(formData, DEFAULT_CREATED_BY));
        toast.success("Asset location created successfully");
      }

      await onSaved();
      onClose();
    } catch (error) {
      const mapped = mapAxiosError(error);
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
      title={isEditMode ? "Edit Asset Location" : "Add Asset Location"}
      description={`Physical in-site placement details for ${assetName || "selected asset"}${assetCode ? ` (${assetCode})` : ""}.`}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="asset-location-form" disabled={submitting || !assetId}>
            {submitting ? (isEditMode ? "Saving..." : "Creating...") : (isEditMode ? "Save Location" : "Create Location")}
          </Button>
        </>
      }
    >
      <form id="asset-location-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Site / Entity Context</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{organization || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Asset</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{assetName || "-"}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Location Record</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{isEditMode ? "Configured" : "Not yet added"}</p>
          </div>
        </div>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Physical Placement</h4>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Input
                label="Building Reference"
                value={formData.building_reference}
                onChange={(event) => updateField("building_reference", event.target.value)}
                placeholder="Utility Block A"
                maxLength={100}
                required
              />
              <FieldError error={fieldErrors.building_reference} />
            </div>

            <div className="space-y-1">
              <Input
                label="Floor / Level"
                value={formData.floor_reference}
                onChange={(event) => updateField("floor_reference", event.target.value)}
                placeholder="Ground Floor"
                maxLength={60}
                required
              />
              <FieldError error={fieldErrors.floor_reference} />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Input
                label="Local Reference"
                value={formData.local_reference}
                onChange={(event) => updateField("local_reference", event.target.value)}
                placeholder="Boiler Room Bay 3"
                maxLength={150}
                required
              />
              <FieldError error={fieldErrors.local_reference} />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="asset-location-remarks">
                Location Remarks
              </label>
              <Textarea
                id="asset-location-remarks"
                value={formData.remarks}
                onChange={(event) => updateField("remarks", event.target.value)}
                placeholder="Optional notes about access, aisle, enclosure, or nearby landmarks."
                maxLength={500}
                rows={4}
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Optional context for plant or site teams.</span>
                <span>{formData.remarks.length}/500</span>
              </div>
              <FieldError error={fieldErrors.remarks} />
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
}
