import React, { FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { LookupOption } from "../../services/lookupValue.service";
import { SupplierRecord } from "../../../services/supplier.service";
import {
  AssetFinanceRecord,
  createAssetFinance,
  updateAssetFinance,
} from "../../../services/asset-finance.service";
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

interface AssetFinanceModalProps {
  open: boolean;
  assetId: string | null;
  assetName?: string | null;
  assetCode?: string | null;
  finance: AssetFinanceRecord | null;
  suppliers: SupplierRecord[];
  currencies: LookupOption[];
  depreciationMethods: LookupOption[];
  assetClassGlOptions: LookupOption[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const DEFAULT_CREATED_BY = "admin";
const DEFAULT_MODIFIED_BY = "admin";

const FieldError = ({ error }: { error?: string }) => (
  error ? <p className="text-xs text-red-600">{error}</p> : null
);

const SectionCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
    <div>
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
    </div>
    {children}
  </section>
);

const SelectField = ({
  label,
  value,
  options,
  placeholder,
  error,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ code: string; value: string }>;
  placeholder: string;
  error?: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-slate-700">{label}</label>
    <select
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.code} value={option.code}>
          {option.value}
        </option>
      ))}
    </select>
    <FieldError error={error} />
  </div>
);

const mapAxiosError = (error: unknown): { message: string; fieldErrors?: AssetFinanceFieldErrors } => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : "Unexpected error occurred" };
  }

  const status = error.response?.status;
  const data = error.response?.data as { message?: string; detail?: unknown } | undefined;

  if (status === 400 || status === 422) {
    const fieldErrors: AssetFinanceFieldErrors = {};
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
      message: (typeof data?.detail === "string" && data.detail) || data?.message || "Asset finance record not found",
    };
  }
  if (status === 409) {
    return {
      message: (typeof data?.detail === "string" && data.detail) || data?.message || "Asset finance already exists for this asset",
    };
  }
  return {
    message: (typeof data?.detail === "string" && data.detail) || data?.message || error.message || "Request failed",
  };
};

export function AssetFinanceModal({
  open,
  assetId,
  assetName,
  assetCode,
  finance,
  suppliers,
  currencies,
  depreciationMethods,
  assetClassGlOptions,
  onClose,
  onSaved,
}: AssetFinanceModalProps) {
  const [formData, setFormData] = useState<AssetFinanceFormState>(EMPTY_ASSET_FINANCE_FORM);
  const [initialFormData, setInitialFormData] = useState<AssetFinanceFormState>(EMPTY_ASSET_FINANCE_FORM);
  const [fieldErrors, setFieldErrors] = useState<AssetFinanceFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const isEditMode = Boolean(finance);
  const computedBookValue = useMemo(() => calculateBookValue(formData), [formData]);
  const autoDepreciationRate = useMemo(() => calculateAutoDepreciationRate(formData), [formData]);

  useEffect(() => {
    if (!open) {
      setFieldErrors({});
      setSubmitting(false);
      return;
    }

    const nextForm = finance ? assetFinanceToForm(finance) : EMPTY_ASSET_FINANCE_FORM;
    setFormData(nextForm);
    setInitialFormData(nextForm);
    setFieldErrors({});
  }, [finance, open]);

  const updateField = (key: keyof AssetFinanceFormState, value: string) => {
    setFormData((previous) => ({ ...previous, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!assetId || submitting) return;

    const validationErrors = validateAssetFinanceForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      if (isEditMode) {
        const payload = buildUpdateAssetFinancePayload(initialFormData, formData, DEFAULT_MODIFIED_BY);
        if (Object.keys(payload).length === 1) {
          toast.message("No finance changes to save");
          setSubmitting(false);
          return;
        }
        await updateAssetFinance(assetId, payload);
        toast.success("Asset finance updated successfully");
      } else {
        await createAssetFinance(assetId, buildCreateAssetFinancePayload(formData, DEFAULT_CREATED_BY));
        toast.success("Asset finance created successfully");
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
      title={isEditMode ? "Edit Asset Finance" : "Add Asset Finance"}
      description={`Finance and valuation details for ${assetName || "selected asset"}${assetCode ? ` (${assetCode})` : ""}.`}
      size="xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="asset-finance-form" disabled={submitting || !assetId}>
            {submitting ? (isEditMode ? "Saving..." : "Creating...") : (isEditMode ? "Save Finance" : "Create Finance")}
          </Button>
        </>
      }
    >
      <form id="asset-finance-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Book Value</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {computedBookValue === null ? "-" : computedBookValue.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Rate Basis</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {formData.depreciation_rate_pct.trim()
                ? `${Number(formData.depreciation_rate_pct).toFixed(2)}% manual`
                : autoDepreciationRate !== null
                  ? `${autoDepreciationRate.toFixed(2)}% auto`
                  : "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Supplier</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {suppliers.find((supplier) => supplier.supplier_id === formData.supplier_id)?.supplier_name || "-"}
            </p>
          </div>
        </div>

        <SectionCard
          title="Procurement / Source"
          description="Capture how the asset was acquired and where the source record came from."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1">
              <Input
                label="Acquisition Date"
                type="date"
                value={formData.acquisition_dt}
                onChange={(event) => updateField("acquisition_dt", event.target.value)}
                required
              />
              <FieldError error={fieldErrors.acquisition_dt} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Supplier</label>
              <select
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={formData.supplier_id}
                onChange={(event) => updateField("supplier_id", event.target.value)}
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.supplier_id} value={supplier.supplier_id}>
                    {supplier.supplier_name}
                  </option>
                ))}
              </select>
              <FieldError error={fieldErrors.supplier_id} />
            </div>

            <div className="space-y-1">
              <Input
                label="Purchase Order No"
                value={formData.purchase_order_no}
                onChange={(event) => updateField("purchase_order_no", event.target.value)}
                maxLength={20}
              />
              <FieldError error={fieldErrors.purchase_order_no} />
            </div>

            <div className="space-y-1">
              <Input
                label="Invoice Reference"
                value={formData.invoice_ref}
                onChange={(event) => updateField("invoice_ref", event.target.value)}
                maxLength={20}
              />
              <FieldError error={fieldErrors.invoice_ref} />
            </div>

            <div className="space-y-1">
              <Input
                label="Make"
                value={formData.make}
                onChange={(event) => updateField("make", event.target.value)}
                maxLength={50}
              />
              <FieldError error={fieldErrors.make} />
            </div>

            <div className="space-y-1">
              <Input
                label="Model"
                value={formData.model}
                onChange={(event) => updateField("model", event.target.value)}
                maxLength={50}
              />
              <FieldError error={fieldErrors.model} />
            </div>

            <div className="space-y-1">
              <Input
                label="Manufacturer"
                value={formData.manufacturer}
                onChange={(event) => updateField("manufacturer", event.target.value)}
                maxLength={100}
              />
              <FieldError error={fieldErrors.manufacturer} />
            </div>

            <div className="space-y-1 md:col-span-2 xl:col-span-2">
              <Input
                label="OEM Release URL"
                value={formData.oem_release_url}
                onChange={(event) => updateField("oem_release_url", event.target.value)}
                placeholder="https://..."
              />
              <FieldError error={fieldErrors.oem_release_url} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Capitalization / Cost"
          description="Track core capitalization timing and the system-maintained book value formula."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1">
              <Input
                label="Capitalization Date"
                type="date"
                value={formData.capitalization_date}
                onChange={(event) => updateField("capitalization_date", event.target.value)}
                required
              />
              <FieldError error={fieldErrors.capitalization_date} />
            </div>

            <div className="space-y-1">
              <Input
                label="Acquisition Cost"
                type="number"
                min={0}
                step="0.01"
                value={formData.acquisition_cost}
                onChange={(event) => updateField("acquisition_cost", event.target.value)}
                required
              />
              <FieldError error={fieldErrors.acquisition_cost} />
            </div>

            <SelectField
              label="Currency"
              value={formData.currency_code}
              options={currencies}
              placeholder="Select currency"
              error={fieldErrors.currency_code}
              onChange={(value) => updateField("currency_code", value)}
            />

            <div className="space-y-1">
              <Input
                label="Accumulated Depreciation"
                type="number"
                min={0}
                step="0.01"
                value={formData.accumulated_depreciation}
                onChange={(event) => updateField("accumulated_depreciation", event.target.value)}
                required
              />
              <FieldError error={fieldErrors.accumulated_depreciation} />
            </div>

            <Input
              label="Book Value"
              value={computedBookValue === null ? "" : computedBookValue.toFixed(2)}
              readOnly
              disabled
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Valuation / Insurance"
          description="Optional replacement, insured, and salvage values used by finance and risk teams."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1">
              <Input
                label="Replacement Value"
                type="number"
                min={0}
                step="0.01"
                value={formData.replacement_value}
                onChange={(event) => updateField("replacement_value", event.target.value)}
              />
              <FieldError error={fieldErrors.replacement_value} />
            </div>

            <div className="space-y-1">
              <Input
                label="Insured Value"
                type="number"
                min={0}
                step="0.01"
                value={formData.insured_value}
                onChange={(event) => updateField("insured_value", event.target.value)}
              />
              <FieldError error={fieldErrors.insured_value} />
            </div>

            <div className="space-y-1">
              <Input
                label="Salvage Value"
                type="number"
                min={0}
                step="0.01"
                value={formData.salvage_value}
                onChange={(event) => updateField("salvage_value", event.target.value)}
              />
              <FieldError error={fieldErrors.salvage_value} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Depreciation"
          description="Use lookup-backed depreciation methods and allow a manual rate override when needed."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              label="Depreciation Method"
              value={formData.depreciation_method}
              options={depreciationMethods}
              placeholder="Select depreciation method"
              error={fieldErrors.depreciation_method}
              onChange={(value) => updateField("depreciation_method", value)}
            />

            <div className="space-y-1">
              <Input
                label="Useful Life (Years)"
                type="number"
                min={1}
                max={99}
                value={formData.useful_life_years}
                onChange={(event) => updateField("useful_life_years", event.target.value)}
                required
              />
              <FieldError error={fieldErrors.useful_life_years} />
            </div>

            <div className="space-y-1">
              <Input
                label="Depreciation Rate %"
                type="number"
                min={0}
                step="0.01"
                value={formData.depreciation_rate_pct}
                onChange={(event) => updateField("depreciation_rate_pct", event.target.value)}
                placeholder={autoDepreciationRate === null ? "" : autoDepreciationRate.toFixed(2)}
              />
              <p className="text-xs text-slate-500">
                {autoDepreciationRate === null
                  ? "Rate auto-calculates when useful life is entered."
                  : `Leave blank to use ${autoDepreciationRate.toFixed(2)}% based on useful life.`}
              </p>
              <FieldError error={fieldErrors.depreciation_rate_pct} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Accounting / Project Codes"
          description="Record finance and project references without mixing them into the asset master identity."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-1">
              <Input
                label="Cost Center"
                value={formData.cost_center}
                onChange={(event) => updateField("cost_center", event.target.value)}
                maxLength={15}
              />
              <FieldError error={fieldErrors.cost_center} />
            </div>

            <div className="space-y-1">
              <Input
                label="GL Account Capex"
                value={formData.gl_account_capex}
                onChange={(event) => updateField("gl_account_capex", event.target.value)}
                maxLength={15}
              />
              <FieldError error={fieldErrors.gl_account_capex} />
            </div>

            <SelectField
              label="Asset Class GL"
              value={formData.asset_class_gl}
              options={assetClassGlOptions}
              placeholder="Select GL asset class"
              error={fieldErrors.asset_class_gl}
              onChange={(value) => updateField("asset_class_gl", value)}
            />

            <div className="space-y-1">
              <Input
                label="WBS Element"
                value={formData.wbs_element}
                onChange={(event) => updateField("wbs_element", event.target.value)}
                maxLength={20}
              />
              <FieldError error={fieldErrors.wbs_element} />
            </div>
          </div>
        </SectionCard>
      </form>
    </Modal>
  );
}
