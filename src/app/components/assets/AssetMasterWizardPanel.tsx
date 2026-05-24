import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { AssetRecord, createAsset, getAssetById, updateAsset } from "../../../services/asset.service";
import {
  AssetFinanceRecord,
  createAssetFinance,
  getAssetFinance,
  updateAssetFinance,
} from "../../../services/asset-finance.service";
import {
  AssetLocationRecord,
  createAssetLocation,
  getAssetLocation,
  updateAssetLocation,
} from "../../../services/asset-location.service";
import { getAssetSpecs } from "../../../services/asset-spec.service";
import { OrgNode } from "../../../services/org.service";
import { SupplierRecord } from "../../../services/supplier.service";
import { useCurrentActor } from "../../auth/useCurrentActor";
import { LookupOption, LookupValue, getLookupValuesByMasterCode } from "../../services/lookupValue.service";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { RightPanel, SearchableCombobox, WorkflowStepper, type WorkflowStep } from "../foundation";
import {
  AssetFieldErrors,
  AssetFormState,
  EMPTY_ASSET_FORM,
  assetToForm,
  buildCreateAssetPayload,
  buildUpdateAssetPayload,
  flattenOrgTreeOptions,
  mergeAssetSpecValues,
  resolveAssetSubCategoryId,
  validateAssetForm,
} from "./assetForm.shared";
import {
  AssetLocationFieldErrors,
  AssetLocationFormState,
  EMPTY_ASSET_LOCATION_FORM,
  assetLocationToForm,
  buildCreateAssetLocationPayload,
  buildUpdateAssetLocationPayload,
  validateAssetLocationForm,
} from "./assetLocationForm.shared";
import {
  AssetFinanceFieldErrors,
  AssetFinanceFormState,
  EMPTY_ASSET_FINANCE_FORM,
  assetFinanceToForm,
  buildCreateAssetFinancePayload,
  buildUpdateAssetFinancePayload,
  calculateAutoDepreciationRate,
  calculateBookValue,
  validateAssetFinanceForm,
} from "./assetFinanceForm.shared";

type WizardMode = "create" | "edit";
type WizardStepKey = "identity" | "classification" | "location-finance";

interface AssetMasterWizardPanelProps {
  open: boolean;
  mode: WizardMode;
  assetId: string | null;
  onClose: () => void;
  onSaved: (asset: AssetRecord) => Promise<void> | void;
  orgTree: OrgNode[];
  supplierList: SupplierRecord[];
  assetClasses: LookupOption[];
  assetCategories: LookupOption[];
  assetSubCategories: LookupOption[];
  assetTypes: LookupOption[];
  assetStatuses: LookupOption[];
  currencies: LookupOption[];
  depreciationMethods: LookupOption[];
  assetClassGlOptions: LookupOption[];
  criticalities: LookupOption[];
  assetNatures: LookupOption[];
}

const WIZARD_STEPS: Array<{ key: WizardStepKey; label: string; description: string }> = [
  { key: "identity", label: "Identity", description: "Core identity and asset classification" },
  { key: "classification", label: "Classification", description: "Ownership, supplier, org, and lifecycle" },
  { key: "location-finance", label: "Location & Finance", description: "Placement, purchase, and valuation data" },
];

const cloneAssetForm = (form: AssetFormState = EMPTY_ASSET_FORM): AssetFormState => ({
  ...form,
  asset_spec_values: [...form.asset_spec_values],
});

const cloneLocationForm = (form: AssetLocationFormState = EMPTY_ASSET_LOCATION_FORM): AssetLocationFormState => ({ ...form });
const cloneFinanceForm = (form: AssetFinanceFormState = EMPTY_ASSET_FINANCE_FORM): AssetFinanceFormState => ({ ...form });

const formatError = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const FieldError = ({ error }: { error?: string }) => (error ? <p className="text-xs text-red-600">{error}</p> : null);

const SectionCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-4 rounded-md border border-slate-200 bg-slate-50/60 p-4">
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
    </div>
    {children}
  </section>
);

const SelectField = ({
  label,
  value,
  placeholder,
  options,
  error,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: LookupOption[] | Array<{ code: string; value: string }>;
  error?: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-slate-700">{label}</label>
    <select
      className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((item) => (
        <option key={item.code} value={item.code}>
          {item.value}
        </option>
      ))}
    </select>
    <FieldError error={error} />
  </div>
);

const hasAnyValue = (values: object): boolean =>
  Object.values(values).some((value) => String(value ?? "").trim().length > 0);

const changedAssetPayloadCount = (payload: ReturnType<typeof buildUpdateAssetPayload>): number =>
  Object.keys(payload).filter((key) => key !== "modified_by").length;

const changedLocationPayloadCount = (payload: ReturnType<typeof buildUpdateAssetLocationPayload>): number =>
  Object.keys(payload).filter((key) => key !== "modified_by").length;

const changedFinancePayloadCount = (payload: ReturnType<typeof buildUpdateAssetFinancePayload>): number =>
  Object.keys(payload).filter((key) => key !== "modified_by").length;

export function AssetMasterWizardPanel({
  open,
  mode,
  assetId,
  onClose,
  onSaved,
  orgTree,
  supplierList,
  assetClasses,
  assetCategories,
  assetSubCategories,
  assetTypes,
  assetStatuses,
  currencies,
  depreciationMethods,
  assetClassGlOptions,
  criticalities,
  assetNatures,
}: AssetMasterWizardPanelProps) {
  const currentActor = useCurrentActor();
  const actorName = currentActor.auditName ?? currentActor.displayName;
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<AssetFormState>(() => cloneAssetForm());
  const [initialFormData, setInitialFormData] = useState<AssetFormState>(() => cloneAssetForm());
  const [fieldErrors, setFieldErrors] = useState<AssetFieldErrors>({});
  const [locationForm, setLocationForm] = useState<AssetLocationFormState>(() => cloneLocationForm());
  const [initialLocationForm, setInitialLocationForm] = useState<AssetLocationFormState>(() => cloneLocationForm());
  const [locationErrors, setLocationErrors] = useState<AssetLocationFieldErrors>({});
  const [existingLocation, setExistingLocation] = useState<AssetLocationRecord | null>(null);
  const [financeForm, setFinanceForm] = useState<AssetFinanceFormState>(() => cloneFinanceForm());
  const [initialFinanceForm, setInitialFinanceForm] = useState<AssetFinanceFormState>(() => cloneFinanceForm());
  const [financeErrors, setFinanceErrors] = useState<AssetFinanceFieldErrors>({});
  const [existingFinance, setExistingFinance] = useState<AssetFinanceRecord | null>(null);
  const [subCategoryLookupValues, setSubCategoryLookupValues] = useState<LookupValue[]>([]);
  const [assetSpecsLoading, setAssetSpecsLoading] = useState(false);
  const [assetSpecsError, setAssetSpecsError] = useState<string | null>(null);

  const isEditMode = mode === "edit";
  const currentStep = WIZARD_STEPS[stepIndex];
  const orgOptions = useMemo(() => flattenOrgTreeOptions(orgTree), [orgTree]);
  const orgComboboxOptions = useMemo(
    () => orgOptions.map((item) => ({ value: item.id, label: item.label.replace(/^\s*-\s*/, ""), description: item.id })),
    [orgOptions],
  );
  const supplierOptions = useMemo(
    () => supplierList.map((supplier) => ({
      value: supplier.supplier_id,
      label: supplier.supplier_name,
      description: supplier.supplier_id,
    })),
    [supplierList],
  );
  const computedBookValue = useMemo(() => calculateBookValue(financeForm), [financeForm]);
  const autoDepreciationRate = useMemo(() => calculateAutoDepreciationRate(financeForm), [financeForm]);
  const assetSpecGroups = useMemo(() => {
    return formData.asset_spec_values.reduce<Map<string, typeof formData.asset_spec_values>>((groups, item) => {
      const list = groups.get(item.parameter_grouping) ?? [];
      list.push(item);
      groups.set(item.parameter_grouping, list);
      return groups;
    }, new Map());
  }, [formData.asset_spec_values]);

  const workflowSteps: WorkflowStep[] = WIZARD_STEPS.map((step, index) => ({
    key: step.key,
    label: step.label,
    description: step.description,
    status: index < stepIndex ? "complete" : index === stepIndex ? "active" : "pending",
  }));

  const resetForms = useCallback(() => {
    const emptyAsset = cloneAssetForm();
    const emptyLocation = cloneLocationForm();
    const emptyFinance = cloneFinanceForm();
    setStepIndex(0);
    setFormData(emptyAsset);
    setInitialFormData(emptyAsset);
    setFieldErrors({});
    setLocationForm(emptyLocation);
    setInitialLocationForm(emptyLocation);
    setLocationErrors({});
    setExistingLocation(null);
    setFinanceForm(emptyFinance);
    setInitialFinanceForm(emptyFinance);
    setFinanceErrors({});
    setExistingFinance(null);
    setAssetSpecsError(null);
    setAssetSpecsLoading(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForms();
      setLoading(false);
      setSubmitting(false);
      return;
    }

    if (!isEditMode) {
      resetForms();
      return;
    }

    if (!assetId) return;

    let cancelled = false;
    setLoading(true);
    setFieldErrors({});
    setLocationErrors({});
    setFinanceErrors({});

    const run = async () => {
      try {
        const [asset, location, finance] = await Promise.all([
          getAssetById(assetId),
          getAssetLocation(assetId).catch(() => null),
          getAssetFinance(assetId).catch(() => null),
        ]);
        if (cancelled) return;

        const nextAssetForm = assetToForm(asset);
        const nextLocationForm = location ? assetLocationToForm(location) : cloneLocationForm();
        const nextFinanceForm = finance ? assetFinanceToForm(finance) : cloneFinanceForm();

        setFormData(nextAssetForm);
        setInitialFormData(nextAssetForm);
        setExistingLocation(location);
        setLocationForm(nextLocationForm);
        setInitialLocationForm(nextLocationForm);
        setExistingFinance(finance);
        setFinanceForm(nextFinanceForm);
        setInitialFinanceForm(nextFinanceForm);
      } catch (error) {
        if (!cancelled) {
          toast.error(formatError(error, "Failed to load asset master record"));
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [assetId, isEditMode, onClose, open, resetForms]);

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

  useEffect(() => {
    if (!open || loading) return;

    if (!formData.asset_sub_category) {
      setAssetSpecsLoading(false);
      setAssetSpecsError(null);
      setFormData((previous) =>
        previous.asset_spec_values.length === 0 ? previous : { ...previous, asset_spec_values: [] },
      );
      return;
    }

    if (subCategoryLookupValues.length === 0) return;

    const subCategoryId = resolveAssetSubCategoryId(subCategoryLookupValues, formData.asset_sub_category);
    if (!subCategoryId) {
      setAssetSpecsLoading(false);
      setAssetSpecsError(null);
      setFormData((previous) =>
        previous.asset_spec_values.length === 0 ? previous : { ...previous, asset_spec_values: [] },
      );
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
            isEditMode && previous.asset_sub_category === initialFormData.asset_sub_category
              ? initialFormData.asset_spec_values
              : previous.asset_spec_values,
          ),
        }));
      } catch (error) {
        if (cancelled) return;
        setAssetSpecsError(formatError(error, "Failed to load asset specifications"));
        setFormData((previous) => ({ ...previous, asset_spec_values: [] }));
      } finally {
        if (!cancelled) setAssetSpecsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    formData.asset_sub_category,
    initialFormData.asset_spec_values,
    initialFormData.asset_sub_category,
    isEditMode,
    loading,
    open,
    subCategoryLookupValues,
  ]);

  const updateAssetField = (key: keyof AssetFormState, value: string) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const updateLocationField = (key: keyof AssetLocationFormState, value: string) => {
    setLocationForm((previous) => ({ ...previous, [key]: value }));
  };

  const updateFinanceField = (key: keyof AssetFinanceFormState, value: string) => {
    setFinanceForm((previous) => ({ ...previous, [key]: value }));
  };

  const updateAssetSpecValue = (assetSpecId: string, value: string) => {
    setFormData((previous) => ({
      ...previous,
      asset_spec_values: previous.asset_spec_values.map((item) =>
        item.asset_spec_id === assetSpecId ? { ...item, parameter_value: value } : item,
      ),
    }));
  };

  const validateStep = (index: number): boolean => {
    const errors = validateAssetForm(formData);
    const stepKeys: Record<WizardStepKey, Array<keyof AssetFormState>> = {
      identity: [
        "asset_id",
        "asset_name",
        "short_description",
        "asset_description",
        "asset_class",
        "asset_category",
        "asset_sub_category",
      ],
      classification: ["org_node_id", "asset_owner", "criticality_class", "asset_nature"],
      "location-finance": ["asset_value", "asset_currency"],
    };

    const nextErrors: AssetFieldErrors = {};
    stepKeys[WIZARD_STEPS[index].key].forEach((key) => {
      if (errors[key]) nextErrors[key] = errors[key];
    });
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(stepIndex)) return;
    setStepIndex((current) => Math.min(current + 1, WIZARD_STEPS.length - 1));
  };

  const saveLocation = async (targetAssetId: string, warnings: string[]) => {
    const shouldSave = existingLocation !== null || hasAnyValue(locationForm);
    if (!shouldSave) return;

    try {
      if (existingLocation) {
        const payload = buildUpdateAssetLocationPayload(initialLocationForm, locationForm, actorName);
        if (changedLocationPayloadCount(payload) > 0) {
          await updateAssetLocation(targetAssetId, payload);
        }
      } else {
        await createAssetLocation(targetAssetId, buildCreateAssetLocationPayload(locationForm, actorName));
      }
    } catch (error) {
      warnings.push(`Location was not saved: ${formatError(error, "location request failed")}`);
    }
  };

  const saveFinance = async (targetAssetId: string, warnings: string[]) => {
    const shouldSave = existingFinance !== null || hasAnyValue(financeForm);
    if (!shouldSave) return;

    try {
      if (existingFinance) {
        const payload = buildUpdateAssetFinancePayload(initialFinanceForm, financeForm, actorName);
        if (changedFinancePayloadCount(payload) > 0) {
          await updateAssetFinance(targetAssetId, payload);
        }
      } else {
        await createAssetFinance(targetAssetId, buildCreateAssetFinancePayload(financeForm, actorName));
      }
    } catch (error) {
      warnings.push(`Finance was not saved: ${formatError(error, "finance request failed")}`);
    }
  };

  const validateRelatedForms = (): boolean => {
    const shouldValidateLocation = existingLocation !== null || hasAnyValue(locationForm);
    const shouldValidateFinance = existingFinance !== null || hasAnyValue(financeForm);
    const nextLocationErrors = shouldValidateLocation ? validateAssetLocationForm(locationForm) : {};
    const nextFinanceErrors = shouldValidateFinance ? validateAssetFinanceForm(financeForm) : {};

    setLocationErrors(nextLocationErrors);
    setFinanceErrors(nextFinanceErrors);

    const hasErrors = Object.keys(nextLocationErrors).length > 0 || Object.keys(nextFinanceErrors).length > 0;
    if (hasErrors) setStepIndex(2);
    return !hasErrors;
  };

  const handleSave = async () => {
    if (submitting) return;

    const coreErrors = validateAssetForm(formData);
    setFieldErrors(coreErrors);
    if (Object.keys(coreErrors).length > 0) {
      const firstStepWithError = WIZARD_STEPS.findIndex((step) => {
        if (step.key === "identity") {
          return [
            "asset_id",
            "asset_name",
            "short_description",
            "asset_description",
            "asset_class",
            "asset_category",
            "asset_sub_category",
          ].some((key) => coreErrors[key]);
        }
        if (step.key === "classification") {
          return ["org_node_id", "asset_owner", "criticality_class", "asset_nature"].some((key) => coreErrors[key]);
        }
        return true;
      });
      setStepIndex(Math.max(0, firstStepWithError));
      return;
    }

    if (!validateRelatedForms()) return;

    setSubmitting(true);
    const warnings: string[] = [];
    try {
      let savedAsset: AssetRecord;
      if (isEditMode && assetId) {
        const payload = buildUpdateAssetPayload(initialFormData, formData, actorName);
        savedAsset = changedAssetPayloadCount(payload) > 0 ? await updateAsset(assetId, payload) : await getAssetById(assetId);
      } else {
        savedAsset = await createAsset(buildCreateAssetPayload(formData, actorName));
      }

      const targetAssetId = savedAsset.asset_uuid || assetId;
      if (targetAssetId) {
        await saveLocation(targetAssetId, warnings);
        await saveFinance(targetAssetId, warnings);
      }

      if (warnings.length > 0) {
        toast.warning(`Asset saved with follow-up needed. ${warnings.join(" ")}`);
      } else {
        toast.success(isEditMode ? "Asset master record updated successfully" : "Asset master record created successfully");
      }
      await onSaved(savedAsset);
      onClose();
    } catch (error) {
      toast.error(formatError(error, isEditMode ? "Failed to update asset" : "Failed to create asset"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (stepIndex < WIZARD_STEPS.length - 1) {
      handleNext();
    } else {
      void handleSave();
    }
  };

  const handleClose = () => {
    if (!submitting) onClose();
  };

  const renderIdentityStep = () => (
    <div className="space-y-4">
      <SectionCard title="Basic Info">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Input
              label="Asset ID"
              value={formData.asset_id}
              onChange={(event) => updateAssetField("asset_id", event.target.value)}
              maxLength={20}
              required
            />
            <FieldError error={fieldErrors.asset_id} />
          </div>
          <div className="space-y-1">
            <Input
              label="Asset Name"
              value={formData.asset_name}
              onChange={(event) => updateAssetField("asset_name", event.target.value)}
              maxLength={100}
              required
            />
            <FieldError error={fieldErrors.asset_name} />
          </div>
          <div className="space-y-1">
            <Input
              label="Short Description"
              value={formData.short_description}
              onChange={(event) => updateAssetField("short_description", event.target.value)}
              maxLength={40}
              required
            />
            <FieldError error={fieldErrors.short_description} />
          </div>
          <div className="space-y-1">
            <Input
              label="Serial Number"
              value={formData.serial_number}
              onChange={(event) => updateAssetField("serial_number", event.target.value)}
              maxLength={50}
            />
            <FieldError error={fieldErrors.serial_number} />
          </div>
          <SelectField
            label="Asset Class"
            value={formData.asset_class}
            placeholder="Select asset class"
            options={assetClasses}
            error={fieldErrors.asset_class}
            onChange={(value) => updateAssetField("asset_class", value)}
          />
          <SelectField
            label="Asset Category"
            value={formData.asset_category}
            placeholder="Select asset category"
            options={assetCategories}
            error={fieldErrors.asset_category}
            onChange={(value) => updateAssetField("asset_category", value)}
          />
          <SelectField
            label="Asset Sub-category"
            value={formData.asset_sub_category}
            placeholder="Select asset sub-category"
            options={assetSubCategories}
            error={fieldErrors.asset_sub_category}
            onChange={(value) => updateAssetField("asset_sub_category", value)}
          />
          <SelectField
            label="Asset Type"
            value={formData.asset_type}
            placeholder="Select asset type"
            options={assetTypes}
            error={fieldErrors.asset_type}
            onChange={(value) => updateAssetField("asset_type", value)}
          />
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Description</label>
            <Textarea
              rows={4}
              value={formData.asset_description}
              onChange={(event) => updateAssetField("asset_description", event.target.value)}
              placeholder="Describe the asset purpose, usage context, or regulated business role"
            />
            <FieldError error={fieldErrors.asset_description} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Specification Values" description="Values remain part of the core Asset Master payload.">
        {assetSpecsLoading ? (
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            Loading asset specifications...
          </div>
        ) : assetSpecsError ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{assetSpecsError}</span>
          </div>
        ) : !formData.asset_sub_category ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
            Select a sub-category to load configured specification fields.
          </div>
        ) : formData.asset_spec_values.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
            No active specification fields are configured for this sub-category.
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(assetSpecGroups.entries()).map(([grouping, items]) => (
              <div key={grouping} className="rounded-md border border-slate-200 bg-white p-3">
                <h4 className="text-sm font-semibold text-slate-900">{grouping}</h4>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  {items.map((item) => (
                    <div key={item.asset_spec_id} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.2fr]">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{item.parameter_name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{item.parameter_description || "-"}</p>
                      </div>
                      <Input
                        label="Value"
                        value={item.parameter_value}
                        onChange={(event) => updateAssetSpecValue(item.asset_spec_id, event.target.value)}
                        maxLength={150}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );

  const renderClassificationStep = () => (
    <div className="space-y-4">
      <SectionCard title="Classification">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <SearchableCombobox
              label="Org Unit"
              value={formData.org_node_id || null}
              options={orgComboboxOptions}
              placeholder="Select org unit"
              emptyText="No org units found"
              onChange={(value) => updateAssetField("org_node_id", value ?? "")}
            />
            <FieldError error={fieldErrors.org_node_id} />
          </div>
          <SearchableCombobox
            label="Supplier"
            value={formData.supplier_id || null}
            options={supplierOptions}
            placeholder="Select supplier"
            emptyText="No suppliers found"
            onChange={(value) => updateAssetField("supplier_id", value ?? "")}
          />
          <SelectField
            label="Criticality"
            value={formData.criticality_class}
            placeholder="Select criticality"
            options={criticalities}
            error={fieldErrors.criticality_class}
            onChange={(value) => updateAssetField("criticality_class", value)}
          />
          <SelectField
            label="Asset Nature"
            value={formData.asset_nature}
            placeholder="Select asset nature"
            options={assetNatures}
            error={fieldErrors.asset_nature}
            onChange={(value) => updateAssetField("asset_nature", value)}
          />
          <SelectField
            label="Status"
            value={formData.asset_status}
            placeholder="Select status"
            options={assetStatuses}
            error={fieldErrors.asset_status}
            onChange={(value) => updateAssetField("asset_status", value)}
          />
          <div className="space-y-1">
            <Input
              label="Owner"
              value={formData.asset_owner}
              onChange={(event) => updateAssetField("asset_owner", event.target.value)}
              maxLength={150}
              required
            />
            <FieldError error={fieldErrors.asset_owner} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Manufacturer And Tracking">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Manufacturer" value={formData.manufacturer} onChange={(event) => updateAssetField("manufacturer", event.target.value)} maxLength={200} />
          <Input label="Model" value={formData.model} onChange={(event) => updateAssetField("model", event.target.value)} maxLength={100} />
          <Input label="Version" value={formData.asset_version} onChange={(event) => updateAssetField("asset_version", event.target.value)} maxLength={25} />
          <Input label="Legacy ID" value={formData.legacy_id} onChange={(event) => updateAssetField("legacy_id", event.target.value)} maxLength={30} />
          <Input label="Tag Number" value={formData.tag_number} onChange={(event) => updateAssetField("tag_number", event.target.value)} maxLength={20} />
          <Input label="QR / Barcode" value={formData.qr_barcode} onChange={(event) => updateAssetField("qr_barcode", event.target.value)} maxLength={50} />
          <Input label="RFID Tag" value={formData.rfid_tag} onChange={(event) => updateAssetField("rfid_tag", event.target.value)} maxLength={30} />
          <Input label="Tags" value={formData.tags_input} onChange={(event) => updateAssetField("tags_input", event.target.value)} placeholder="Comma-separated tags" />
        </div>
      </SectionCard>
    </div>
  );

  const renderLocationFinanceStep = () => (
    <div className="space-y-4">
      <SectionCard title="Address / Location" description="These fields save through the existing asset location API when populated.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Input label="Building Reference" value={locationForm.building_reference} onChange={(event) => updateLocationField("building_reference", event.target.value)} maxLength={100} />
            <FieldError error={locationErrors.building_reference} />
          </div>
          <div className="space-y-1">
            <Input label="Floor / Level" value={locationForm.floor_reference} onChange={(event) => updateLocationField("floor_reference", event.target.value)} maxLength={60} />
            <FieldError error={locationErrors.floor_reference} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Input label="Local Reference" value={locationForm.local_reference} onChange={(event) => updateLocationField("local_reference", event.target.value)} maxLength={150} />
            <FieldError error={locationErrors.local_reference} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Location Remarks</label>
            <Textarea rows={3} value={locationForm.remarks} onChange={(event) => updateLocationField("remarks", event.target.value)} maxLength={500} />
            <FieldError error={locationErrors.remarks} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Asset Purchase Summary">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Purchase Date" type="date" value={formData.asset_purchase_dt} onChange={(event) => updateAssetField("asset_purchase_dt", event.target.value)} />
          <Input label="Commission Date" type="date" value={formData.asset_commission_dt} onChange={(event) => updateAssetField("asset_commission_dt", event.target.value)} />
          <Input label="Purchase Reference" value={formData.asset_purchase_ref} onChange={(event) => updateAssetField("asset_purchase_ref", event.target.value)} maxLength={50} />
          <Input label="Warranty (months)" type="number" min={0} value={formData.warranty_period} onChange={(event) => updateAssetField("warranty_period", event.target.value)} />
          <div className="space-y-1">
            <Input label="Asset Value" type="number" min={0} step="0.01" value={formData.asset_value} onChange={(event) => updateAssetField("asset_value", event.target.value)} />
            <FieldError error={fieldErrors.asset_value} />
          </div>
          <SelectField label="Currency" value={formData.asset_currency} placeholder="Select currency" options={currencies} error={fieldErrors.asset_currency} onChange={(value) => updateAssetField("asset_currency", value)} />
          <div className="space-y-1 md:col-span-2">
            <Input label="Release Reference URL" value={formData.asset_release_url} onChange={(event) => updateAssetField("asset_release_url", event.target.value)} maxLength={250} />
            <FieldError error={fieldErrors.asset_release_url} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Finance Record" description="Optional finance record saved after the core asset using the current finance API.">
        <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-white p-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Book Value</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{computedBookValue === null ? "-" : computedBookValue.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Depreciation Rate</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {financeForm.depreciation_rate_pct.trim()
                ? `${Number(financeForm.depreciation_rate_pct).toFixed(2)}%`
                : autoDepreciationRate === null
                  ? "-"
                  : `${autoDepreciationRate.toFixed(2)}% auto`}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Record State</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-slate-900">
              {existingFinance ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : null}
              {existingFinance ? "Configured" : "Optional"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Input label="Acquisition Date" type="date" value={financeForm.acquisition_dt} onChange={(event) => updateFinanceField("acquisition_dt", event.target.value)} />
            <FieldError error={financeErrors.acquisition_dt} />
          </div>
          <div className="space-y-1">
            <SearchableCombobox
              label="Finance Supplier"
              value={financeForm.supplier_id || null}
              options={supplierOptions}
              placeholder="Select supplier"
              emptyText="No suppliers found"
              onChange={(value) => updateFinanceField("supplier_id", value ?? "")}
            />
            <FieldError error={financeErrors.supplier_id} />
          </div>
          <Input label="Purchase Order No" value={financeForm.purchase_order_no} onChange={(event) => updateFinanceField("purchase_order_no", event.target.value)} maxLength={20} />
          <Input label="Invoice Reference" value={financeForm.invoice_ref} onChange={(event) => updateFinanceField("invoice_ref", event.target.value)} maxLength={20} />
          <Input label="Make" value={financeForm.make} onChange={(event) => updateFinanceField("make", event.target.value)} maxLength={50} />
          <Input label="Model" value={financeForm.model} onChange={(event) => updateFinanceField("model", event.target.value)} maxLength={50} />
          <Input label="Manufacturer" value={financeForm.manufacturer} onChange={(event) => updateFinanceField("manufacturer", event.target.value)} maxLength={100} />
          <Input label="OEM Release URL" value={financeForm.oem_release_url} onChange={(event) => updateFinanceField("oem_release_url", event.target.value)} maxLength={250} />
          <div className="space-y-1">
            <Input label="Capitalization Date" type="date" value={financeForm.capitalization_date} onChange={(event) => updateFinanceField("capitalization_date", event.target.value)} />
            <FieldError error={financeErrors.capitalization_date} />
          </div>
          <div className="space-y-1">
            <Input label="Acquisition Cost" type="number" min={0} step="0.01" value={financeForm.acquisition_cost} onChange={(event) => updateFinanceField("acquisition_cost", event.target.value)} />
            <FieldError error={financeErrors.acquisition_cost} />
          </div>
          <SelectField label="Finance Currency" value={financeForm.currency_code} placeholder="Select currency" options={currencies} error={financeErrors.currency_code} onChange={(value) => updateFinanceField("currency_code", value)} />
          <SelectField label="Depreciation Method" value={financeForm.depreciation_method} placeholder="Select method" options={depreciationMethods} error={financeErrors.depreciation_method} onChange={(value) => updateFinanceField("depreciation_method", value)} />
          <div className="space-y-1">
            <Input label="Useful Life (years)" type="number" min={1} max={99} value={financeForm.useful_life_years} onChange={(event) => updateFinanceField("useful_life_years", event.target.value)} />
            <FieldError error={financeErrors.useful_life_years} />
          </div>
          <Input label="Depreciation Rate %" type="number" min={0} step="0.01" value={financeForm.depreciation_rate_pct} onChange={(event) => updateFinanceField("depreciation_rate_pct", event.target.value)} />
          <div className="space-y-1">
            <Input label="Accumulated Depreciation" type="number" min={0} step="0.01" value={financeForm.accumulated_depreciation} onChange={(event) => updateFinanceField("accumulated_depreciation", event.target.value)} />
            <FieldError error={financeErrors.accumulated_depreciation} />
          </div>
          <Input label="Replacement Value" type="number" min={0} step="0.01" value={financeForm.replacement_value} onChange={(event) => updateFinanceField("replacement_value", event.target.value)} />
          <Input label="Insured Value" type="number" min={0} step="0.01" value={financeForm.insured_value} onChange={(event) => updateFinanceField("insured_value", event.target.value)} />
          <Input label="Salvage Value" type="number" min={0} step="0.01" value={financeForm.salvage_value} onChange={(event) => updateFinanceField("salvage_value", event.target.value)} />
          <Input label="Cost Center" value={financeForm.cost_center} onChange={(event) => updateFinanceField("cost_center", event.target.value)} maxLength={15} />
          <Input label="GL Account Capex" value={financeForm.gl_account_capex} onChange={(event) => updateFinanceField("gl_account_capex", event.target.value)} maxLength={15} />
          <SelectField label="Asset Class GL" value={financeForm.asset_class_gl} placeholder="Select GL class" options={assetClassGlOptions} error={financeErrors.asset_class_gl} onChange={(value) => updateFinanceField("asset_class_gl", value)} />
          <Input label="WBS Element" value={financeForm.wbs_element} onChange={(event) => updateFinanceField("wbs_element", event.target.value)} maxLength={20} />
        </div>
      </SectionCard>
    </div>
  );

  return (
    <RightPanel
      open={open}
      title={isEditMode ? "Edit Asset" : "Create Asset"}
      description="Core asset master data only. Workflow modules remain available from References."
      onClose={handleClose}
      widthClassName="max-w-5xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
              disabled={submitting || stepIndex === 0}
            >
              Back
            </Button>
            <Button type="submit" form="asset-master-wizard-form" disabled={submitting || loading}>
              {submitting
                ? "Saving..."
                : stepIndex === WIZARD_STEPS.length - 1
                  ? isEditMode
                    ? "Save Asset"
                    : "Create Asset"
                  : "Next"}
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
          Loading asset master data...
        </div>
      ) : (
        <form id="asset-master-wizard-form" className="grid grid-cols-1 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)]" onSubmit={handleSubmit}>
          <aside className="rounded-md border border-slate-200 bg-white p-3">
            <WorkflowStepper
              steps={workflowSteps}
              currentStep={currentStep.key}
              onStepClick={(step) => {
                const nextIndex = WIZARD_STEPS.findIndex((item) => item.key === step.key);
                if (nextIndex >= 0) setStepIndex(nextIndex);
              }}
            />
          </aside>
          <div className="min-w-0">
            {currentStep.key === "identity" ? renderIdentityStep() : null}
            {currentStep.key === "classification" ? renderClassificationStep() : null}
            {currentStep.key === "location-finance" ? renderLocationFinanceStep() : null}
          </div>
        </form>
      )}
    </RightPanel>
  );
}
