import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Modal } from "../ui/Modal";
import { RestoreDraftDialog } from "../ui/RestoreDraftDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { clearDraft, isShallowDirtyTrimmed, loadDraft, saveDraft } from "../../utils/draftStorage";
import { LookupOption, LookupValue, getLookupValuesByMasterCode } from "../../services/lookupValue.service";
import { OrgNode } from "../../../services/org.service";
import { SupplierRecord } from "../../../services/supplier.service";
import { getAssetById, updateAsset } from "../../../services/asset.service";
import { getAssetSpecs } from "../../../services/asset-spec.service";
import { AssetMasterFormFields } from "./AssetMasterFormFields";
import {
  AssetFieldErrors,
  AssetFormState,
  EMPTY_ASSET_FORM,
  assetToForm,
  buildUpdateAssetPayload,
  flattenOrgTreeOptions,
  mergeAssetSpecValues,
  resolveAssetSubCategoryId,
  validateAssetForm,
} from "./assetForm.shared";

interface EditAssetModalProps {
  open: boolean;
  assetId: string | null;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
  orgTree: OrgNode[];
  supplierList: SupplierRecord[];
  assetClasses: LookupOption[];
  assetCategories: LookupOption[];
  assetSubCategories: LookupOption[];
  assetTypes: LookupOption[];
  assetStatuses: LookupOption[];
  currencies: LookupOption[];
  criticalities: LookupOption[];
  assetNatures: LookupOption[];
}

const DEFAULT_MODIFIED_BY = "admin";

const mapAxiosError = (error: unknown): { message: string; fieldErrors?: AssetFieldErrors } => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : "Unexpected error occurred" };
  }

  const status = error.response?.status;
  const data = error.response?.data as { message?: string; detail?: unknown } | undefined;

  if (status === 400 || status === 422) {
    const fieldErrors: AssetFieldErrors = {};
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
      message: data?.message || "Validation failed",
      fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
    };
  }

  if (status === 404) return { message: data?.message || "Asset not found" };
  if (status === 409) return { message: data?.message || "Asset ID or serial number already exists" };
  return { message: data?.message || error.message || "Request failed" };
};

export function EditAssetModal({
  open,
  assetId,
  onClose,
  onUpdated,
  orgTree,
  supplierList,
  assetClasses,
  assetCategories,
  assetSubCategories,
  assetTypes,
  assetStatuses,
  currencies,
  criticalities,
  assetNatures,
}: EditAssetModalProps) {
  const [formData, setFormData] = useState<AssetFormState>(EMPTY_ASSET_FORM);
  const [initialFormData, setInitialFormData] = useState<AssetFormState>(EMPTY_ASSET_FORM);
  const [fieldErrors, setFieldErrors] = useState<AssetFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [restoreDraftOpen, setRestoreDraftOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<AssetFormState | null>(null);
  const [subCategoryLookupValues, setSubCategoryLookupValues] = useState<LookupValue[]>([]);
  const [assetSpecsLoading, setAssetSpecsLoading] = useState(false);
  const [assetSpecsError, setAssetSpecsError] = useState<string | null>(null);
  const restoreDraftKey = useRef<string | null>(null);

  const orgOptions = useMemo(() => flattenOrgTreeOptions(orgTree), [orgTree]);
  const draftKey = useMemo(() => (assetId ? `draft_asset_edit_${assetId}` : null), [assetId]);

  const isDraftDirty = useMemo(() => isShallowDirtyTrimmed(formData, initialFormData), [formData, initialFormData]);

  useEffect(() => {
    if (!open || !assetId) return;

    let cancelled = false;
    setLoading(true);
    setFieldErrors({});

    const run = async () => {
      try {
        const detail = await getAssetById(assetId);
        if (cancelled) return;
        const nextForm = assetToForm(detail);
        setFormData(nextForm);
        setInitialFormData(nextForm);
      } catch (error) {
        if (cancelled) return;
        const mapped = mapAxiosError(error);
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
  }, [open, assetId, onClose]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const run = async () => {
      try {
        const values = await getLookupValuesByMasterCode("ASSET_SUB_CATEGORY");
        if (!cancelled) {
          setSubCategoryLookupValues(values);
          setAssetSpecsError(null);
        }
      } catch {
        if (!cancelled) {
          setSubCategoryLookupValues([]);
          setAssetSpecsError("Failed to load asset sub-category specifications.");
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const resetState = useCallback(() => {
    setFieldErrors({});
    setSubmitting(false);
    setRestoreDraftOpen(false);
    setPendingDraft(null);
    restoreDraftKey.current = null;
  }, []);

  useEffect(() => {
    if (open) return;
    resetState();
  }, [open, resetState]);

  const discardDraftAndClose = () => {
    if (submitting) return;
    setFieldErrors({});
    if (draftKey) clearDraft(draftKey);
    onClose();
  };

  const saveDraftAndClose = () => {
    if (submitting) return;
    if (draftKey) {
      if (isDraftDirty) {
        try {
          saveDraft(draftKey, formData);
        } catch {
          toast.error("Failed to save draft");
        }
      } else {
        clearDraft(draftKey);
      }
    }
    onClose();
  };

  const saveDraftButton = () => {
    if (submitting) return;
    if (!draftKey) return;
    try {
      saveDraft(draftKey, formData);
      toast.message("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!draftKey) return;
    if (loading) return;
    if (restoreDraftKey.current === draftKey) return;

    restoreDraftKey.current = draftKey;
    const draft = loadDraft<AssetFormState>(draftKey);
    if (draft) {
      setPendingDraft(draft);
      setRestoreDraftOpen(true);
    }
  }, [draftKey, loading, open]);

  useEffect(() => {
    if (!open) return;
    if (loading) return;

    if (!formData.asset_sub_category) {
      setAssetSpecsLoading(false);
      setAssetSpecsError(null);
      setFormData((previous) => (
        previous.asset_spec_values.length === 0
          ? previous
          : { ...previous, asset_spec_values: [] }
      ));
      return;
    }

    if (subCategoryLookupValues.length === 0) {
      return;
    }

    const subCategoryId = resolveAssetSubCategoryId(subCategoryLookupValues, formData.asset_sub_category);
    if (!subCategoryId) {
      setAssetSpecsLoading(false);
      setAssetSpecsError(null);
      setFormData((previous) => (
        previous.asset_spec_values.length === 0
          ? previous
          : { ...previous, asset_spec_values: [] }
      ));
      return;
    }

    let cancelled = false;
    setAssetSpecsLoading(true);
    setAssetSpecsError(null);

    const run = async () => {
      try {
        const specs = await getAssetSpecs({ asset_sub_category_id: subCategoryId });
        if (cancelled) return;
        setFormData((previous) => ({
          ...previous,
          asset_spec_values: mergeAssetSpecValues(
            specs,
            previous.asset_sub_category === initialFormData.asset_sub_category
              ? initialFormData.asset_spec_values
              : previous.asset_spec_values,
          ),
        }));
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load asset specifications";
        setAssetSpecsError(message);
        setFormData((previous) => ({ ...previous, asset_spec_values: [] }));
      } finally {
        if (!cancelled) {
          setAssetSpecsLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [formData.asset_sub_category, initialFormData.asset_spec_values, initialFormData.asset_sub_category, loading, open, subCategoryLookupValues]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!assetId || submitting) return;

    const validationErrors = validateAssetForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    const payload = buildUpdateAssetPayload(initialFormData, formData, DEFAULT_MODIFIED_BY);
    if (Object.keys(payload).length === 1 && payload.modified_by) {
      toast.message("No changes to save");
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      await updateAsset(assetId, payload);
      toast.success("Asset master record updated successfully");
      if (draftKey) clearDraft(draftKey);
      await onUpdated();
      onClose();
    } catch (error) {
      const mapped = mapAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (key: keyof AssetFormState, value: string) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const updateAssetSpecValue = (assetSpecId: string, value: string) => {
    setFormData((previous) => ({
      ...previous,
      asset_spec_values: previous.asset_spec_values.map((item) => (
        item.asset_spec_id === assetSpecId ? { ...item, parameter_value: value } : item
      )),
    }));
  };

  return (
    <Modal
      open={open}
      onClose={saveDraftAndClose}
      title="Edit Asset Master"
      size="xl"
      closeButtonTooltip="Close and save progress as draft"
      footer={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="ghost" onClick={discardDraftAndClose} disabled={submitting}>
                Cancel
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>Discard changes and close the form</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" variant="secondary" onClick={saveDraftButton} disabled={submitting || !draftKey}>
                Save Draft
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>Save current progress without submitting</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="submit" form="edit-asset-form" disabled={loading || submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>Save the updated asset master record</TooltipContent>
          </Tooltip>
        </>
      }
    >
      {loading ? (
        <div className="text-sm text-slate-600">Loading asset master...</div>
      ) : (
        <form id="edit-asset-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
          <AssetMasterFormFields
            formData={formData}
            fieldErrors={fieldErrors}
            orgOptions={orgOptions}
            supplierList={supplierList}
            assetClasses={assetClasses}
            assetCategories={assetCategories}
            assetSubCategories={assetSubCategories}
            assetTypes={assetTypes}
            assetStatuses={assetStatuses}
            currencies={currencies}
            criticalities={criticalities}
            assetNatures={assetNatures}
            assetSpecsLoading={assetSpecsLoading}
            assetSpecsError={assetSpecsError}
            onChange={updateField}
            onAssetSpecValueChange={updateAssetSpecValue}
          />
        </form>
      )}

      <RestoreDraftDialog
        open={restoreDraftOpen}
        onDiscard={() => {
          if (!draftKey) return;
          clearDraft(draftKey);
          setPendingDraft(null);
          setRestoreDraftOpen(false);
        }}
        onRestore={() => {
          if (pendingDraft) setFormData(pendingDraft);
          setRestoreDraftOpen(false);
        }}
      />
    </Modal>
  );
}
