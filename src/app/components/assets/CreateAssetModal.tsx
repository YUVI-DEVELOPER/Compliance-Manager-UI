import React, { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Modal } from "../ui/Modal";
import { RestoreDraftDialog } from "../ui/RestoreDraftDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { clearDraft, isShallowDirtyTrimmed, loadDraft, saveDraft } from "../../utils/draftStorage";
import { LookupOption } from "../../services/lookupValue.service";
import { OrgNode } from "../../../services/org.service";
import { SupplierRecord } from "../../../services/supplier.service";
import { createAsset } from "../../../services/asset.service";
import { AssetMasterFormFields } from "./AssetMasterFormFields";
import {
  AssetFieldErrors,
  AssetFormState,
  EMPTY_ASSET_FORM,
  buildCreateAssetPayload,
  flattenOrgTreeOptions,
  validateAssetForm,
} from "./assetForm.shared";

interface CreateAssetModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
  defaultOrganization?: OrgNode | null;
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

const DEFAULT_CREATED_BY = "admin";

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

  if (status === 404) return { message: data?.message || "Asset dependency not found" };
  if (status === 409) return { message: data?.message || "Asset ID or serial number already exists" };
  return { message: data?.message || error.message || "Request failed" };
};

export function CreateAssetModal({
  open,
  onClose,
  onCreated,
  defaultOrganization,
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
}: CreateAssetModalProps) {
  const [formData, setFormData] = useState<AssetFormState>(EMPTY_ASSET_FORM);
  const [fieldErrors, setFieldErrors] = useState<AssetFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [restoreDraftOpen, setRestoreDraftOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<AssetFormState | null>(null);
  const restoreDraftOnce = useRef(false);

  const orgOptions = useMemo(() => flattenOrgTreeOptions(orgTree), [orgTree]);

  const draftKey = "draft_asset_create";
  const isDraftDirty = useMemo(() => isShallowDirtyTrimmed(formData, EMPTY_ASSET_FORM), [formData]);

  const resetState = () => {
    setFormData(EMPTY_ASSET_FORM);
    setFieldErrors({});
    setSubmitting(false);
  };

  const discardDraftAndClose = () => {
    if (submitting) return;
    clearDraft(draftKey);
    resetState();
    onClose();
  };

  const saveDraftAndClose = () => {
    if (submitting) return;
    if (isDraftDirty) {
      try {
        saveDraft(draftKey, formData);
      } catch {
        toast.error("Failed to save draft");
      }
    } else {
      clearDraft(draftKey);
    }
    resetState();
    onClose();
  };

  const saveDraftButton = () => {
    if (submitting) return;
    try {
      saveDraft(draftKey, formData);
      toast.message("Draft saved");
    } catch {
      toast.error("Failed to save draft");
    }
  };

  useEffect(() => {
    if (!open) {
      restoreDraftOnce.current = false;
      setRestoreDraftOpen(false);
      setPendingDraft(null);
      return;
    }
    if (restoreDraftOnce.current) return;
    restoreDraftOnce.current = true;

    resetState();
    const draft = loadDraft<AssetFormState>(draftKey);
    if (draft) {
      setPendingDraft(draft);
      setRestoreDraftOpen(true);
    }
  }, [open]);

  useEffect(() => {
    if (defaultOrganization) {
      setFormData((prev) => ({
        ...prev,
        org_node_id: defaultOrganization.id,
      }));
    }
  }, [defaultOrganization, open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const validationErrors = validateAssetForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      await createAsset(buildCreateAssetPayload(formData, DEFAULT_CREATED_BY));
      toast.success("Asset master record created successfully");
      clearDraft(draftKey);
      setFormData(EMPTY_ASSET_FORM);
      await onCreated();
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

  return (
    <Modal
      open={open}
      onClose={saveDraftAndClose}
      title="Create Asset Master"
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
              <Button type="button" variant="secondary" onClick={saveDraftButton} disabled={submitting}>
                Save Draft
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>Save current progress without submitting</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="submit" form="create-asset-form" disabled={submitting}>
                {submitting ? "Creating..." : "Create Asset Master"}
              </Button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>Create the asset master record</TooltipContent>
          </Tooltip>
        </>
      }
    >
      <form id="create-asset-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
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
          onChange={updateField}
        />
      </form>

      <RestoreDraftDialog
        open={restoreDraftOpen}
        onDiscard={() => {
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
