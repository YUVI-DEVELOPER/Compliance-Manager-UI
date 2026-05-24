import React from "react";
import { SupplierRecord } from "../../../services/supplier.service";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { LookupOption } from "../../services/lookupValue.service";
import {
  AssetFieldErrors,
  AssetFormState,
  OrgOption,
  getTagPreview,
} from "./assetForm.shared";

interface AssetMasterFormFieldsProps {
  formData: AssetFormState;
  fieldErrors: AssetFieldErrors;
  orgOptions: OrgOption[];
  supplierList: SupplierRecord[];
  assetClasses: LookupOption[];
  assetCategories: LookupOption[];
  assetSubCategories: LookupOption[];
  assetTypes: LookupOption[];
  assetStatuses: LookupOption[];
  criticalities: LookupOption[];
  assetNatures: LookupOption[];
  currencies: LookupOption[];
  assetSpecsLoading: boolean;
  assetSpecsError?: string | null;
  onChange: (key: keyof AssetFormState, value: string) => void;
  onAssetSpecValueChange: (assetSpecId: string, value: string) => void;
}

interface SelectFieldProps {
  label: string;
  value: string;
  placeholder: string;
  options: LookupOption[] | Array<{ code: string; value: string }>;
  error?: string;
  onChange: (value: string) => void;
}

const FieldError = ({ error }: { error?: string }) =>
  error ? <p className="text-xs text-red-600">{error}</p> : null;

const SectionTitle = ({ title }: { title: string }) => (
  <div>
    <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
  </div>
);

const SectionCard = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
    <SectionTitle title={title} />
    {children}
  </section>
);

const SelectField = ({ label, value, placeholder, options, error, onChange }: SelectFieldProps) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-slate-700">{label}</label>
    <select
      className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
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

export function AssetMasterFormFields({
  formData,
  fieldErrors,
  orgOptions,
  supplierList,
  assetClasses,
  assetCategories,
  assetSubCategories,
  assetTypes,
  assetStatuses,
  criticalities,
  assetNatures,
  currencies,
  assetSpecsLoading,
  assetSpecsError,
  onChange,
  onAssetSpecValueChange,
}: AssetMasterFormFieldsProps) {
  const tagPreview = getTagPreview(formData.tags_input);
  const assetSpecGroups = formData.asset_spec_values.reduce<Map<string, typeof formData.asset_spec_values>>((groups, item) => {
    const existing = groups.get(item.parameter_grouping) ?? [];
    existing.push(item);
    groups.set(item.parameter_grouping, existing);
    return groups;
  }, new Map());

  return (
    <div className="space-y-5">
      <SectionCard title="Asset Specifications">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SelectField
              label="Asset Sub-category"
              value={formData.asset_sub_category}
              placeholder="Select asset sub-category"
              options={assetSubCategories}
              error={fieldErrors.asset_sub_category}
              onChange={(value) => onChange("asset_sub_category", value)}
            />
          </div>

          {assetSpecsLoading ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              Loading asset specifications...
            </div>
          ) : assetSpecsError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {assetSpecsError}
            </div>
          ) : !formData.asset_sub_category ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              Select the asset sub-category first to load the associated asset specifications.
            </div>
          ) : formData.asset_spec_values.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              No active asset specifications are configured for this asset sub-category.
            </div>
          ) : (
            <div className="space-y-4">
              {Array.from(assetSpecGroups.entries()).map(([grouping, items]) => (
                <div key={grouping} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-900">{grouping}</h5>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.asset_spec_id} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 lg:grid-cols-[1.1fr_1.2fr_1fr]">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Parameter Name</p>
                          <p className="text-sm font-medium text-slate-900">{item.parameter_name}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
                          <p className="text-sm text-slate-700">{item.parameter_description?.trim() || "-"}</p>
                        </div>
                        <div className="space-y-1">
                          <Input
                            label="Value"
                            value={item.parameter_value}
                            onChange={(event) => onAssetSpecValueChange(item.asset_spec_id, event.target.value)}
                            maxLength={150}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Core Identification">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Organization</label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={formData.org_node_id}
              onChange={(event) => onChange("org_node_id", event.target.value)}
            >
              <option value="">Select organization</option>
              {orgOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <FieldError error={fieldErrors.org_node_id} />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Supplier</label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              value={formData.supplier_id}
              onChange={(event) => onChange("supplier_id", event.target.value)}
            >
              <option value="">Select supplier</option>
              {supplierList.map((supplier) => (
                <option key={supplier.supplier_id} value={supplier.supplier_id}>
                  {supplier.supplier_name}
                </option>
              ))}
            </select>
            <FieldError error={fieldErrors.supplier_id} />
          </div>

          <div className="space-y-1">
            <Input
              label="Asset ID"
              value={formData.asset_id}
              onChange={(event) => onChange("asset_id", event.target.value)}
              placeholder="Enterprise standardized ID"
              maxLength={20}
              required
            />
            <FieldError error={fieldErrors.asset_id} />
          </div>

          <div className="space-y-1">
            <Input
              label="Asset Name"
              value={formData.asset_name}
              onChange={(event) => onChange("asset_name", event.target.value)}
              placeholder="Business-recognized asset name"
              maxLength={100}
              required
            />
            <FieldError error={fieldErrors.asset_name} />
          </div>

          <div className="space-y-1">
            <Input
              label="Short Description"
              value={formData.short_description}
              onChange={(event) => onChange("short_description", event.target.value)}
              placeholder="Short enterprise label"
              maxLength={40}
              required
            />
            <FieldError error={fieldErrors.short_description} />
          </div>

          <div className="space-y-1">
            <Input
              label="Asset Owner"
              value={formData.asset_owner}
              onChange={(event) => onChange("asset_owner", event.target.value)}
              placeholder="Business owner or accountable lead"
              maxLength={150}
              required
            />
            <FieldError error={fieldErrors.asset_owner} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Classification">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SelectField
            label="Asset Class"
            value={formData.asset_class}
            placeholder="Select asset class"
            options={assetClasses}
            error={fieldErrors.asset_class}
            onChange={(value) => onChange("asset_class", value)}
          />

          <SelectField
            label="Asset Category"
            value={formData.asset_category}
            placeholder="Select asset category"
            options={assetCategories}
            error={fieldErrors.asset_category}
            onChange={(value) => onChange("asset_category", value)}
          />

          <SelectField
            label="Asset Type"
            value={formData.asset_type}
            placeholder="Select asset type"
            options={assetTypes}
            error={fieldErrors.asset_type}
            onChange={(value) => onChange("asset_type", value)}
          />

          <SelectField
            label="Criticality Class"
            value={formData.criticality_class}
            placeholder="Select criticality class"
            options={criticalities}
            error={fieldErrors.criticality_class}
            onChange={(value) => onChange("criticality_class", value)}
          />

          <SelectField
            label="Asset Nature"
            value={formData.asset_nature}
            placeholder="Select asset nature"
            options={assetNatures}
            error={fieldErrors.asset_nature}
            onChange={(value) => onChange("asset_nature", value)}
          />

          <SelectField
            label="Lifecycle Status"
            value={formData.asset_status}
            placeholder="Select lifecycle status"
            options={assetStatuses}
            error={fieldErrors.asset_status}
            onChange={(value) => onChange("asset_status", value)}
          />
        </div>
      </SectionCard>

      <SectionCard title="Ownership And Business Context">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Input
            label="Manufacturer"
            value={formData.manufacturer}
            onChange={(event) => onChange("manufacturer", event.target.value)}
            maxLength={200}
          />

          <Input
            label="Model"
            value={formData.model}
            onChange={(event) => onChange("model", event.target.value)}
            maxLength={100}
          />

          <Input
            label="Version"
            value={formData.asset_version}
            onChange={(event) => onChange("asset_version", event.target.value)}
            maxLength={25}
          />

          <Input
            label="Purchase Date"
            type="date"
            value={formData.asset_purchase_dt}
            onChange={(event) => onChange("asset_purchase_dt", event.target.value)}
          />

          <Input
            label="Commission Date"
            type="date"
            value={formData.asset_commission_dt}
            onChange={(event) => onChange("asset_commission_dt", event.target.value)}
          />

          <Input
            label="Purchase Reference"
            value={formData.asset_purchase_ref}
            onChange={(event) => onChange("asset_purchase_ref", event.target.value)}
            maxLength={50}
          />

          <Input
            label="Warranty (months)"
            type="number"
            min={0}
            value={formData.warranty_period}
            onChange={(event) => onChange("warranty_period", event.target.value)}
          />

          <div className="space-y-1">
            <Input
              label="Asset Value"
              type="number"
              min={0}
              step="0.01"
              value={formData.asset_value}
              onChange={(event) => onChange("asset_value", event.target.value)}
            />
            <FieldError error={fieldErrors.asset_value} />
          </div>

          <SelectField
            label="Currency"
            value={formData.asset_currency}
            placeholder="Select currency"
            options={currencies}
            error={fieldErrors.asset_currency}
            onChange={(value) => onChange("asset_currency", value)}
          />

          <Input
            label="Release Reference URL"
            value={formData.asset_release_url}
            onChange={(event) => onChange("asset_release_url", event.target.value)}
            maxLength={250}
          />
        </div>
      </SectionCard>

      <SectionCard title="Physical And Tracking Identifiers">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Input
            label="Legacy ID"
            value={formData.legacy_id}
            onChange={(event) => onChange("legacy_id", event.target.value)}
            maxLength={30}
          />

          <Input
            label="Serial Number"
            value={formData.serial_number}
            onChange={(event) => onChange("serial_number", event.target.value)}
            maxLength={50}
          />

          <Input
            label="Tag Number"
            value={formData.tag_number}
            onChange={(event) => onChange("tag_number", event.target.value)}
            maxLength={20}
          />

          <Input
            label="QR / Barcode"
            value={formData.qr_barcode}
            onChange={(event) => onChange("qr_barcode", event.target.value)}
            maxLength={50}
          />

          <Input
            label="RFID Tag"
            value={formData.rfid_tag}
            onChange={(event) => onChange("rfid_tag", event.target.value)}
            maxLength={30}
          />
        </div>
      </SectionCard>

      <SectionCard title="Description And Tags">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Asset Description</label>
            <Textarea
              rows={5}
              className="bg-white"
              value={formData.asset_description}
              onChange={(event) => onChange("asset_description", event.target.value)}
              placeholder="Describe the asset purpose, usage context, or regulated business role"
            />
            <FieldError error={fieldErrors.asset_description} />
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Input
                label="Tags"
                value={formData.tags_input}
                onChange={(event) => onChange("tags_input", event.target.value)}
                placeholder="Comma-separated tags"
              />
              <p className="text-xs text-slate-500">
                Example: gxp, validated, customer-facing
              </p>
            </div>

            <div className="rounded-lg border border-dashed border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">Tag Preview</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tagPreview.length > 0 ? (
                  tagPreview.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">No tags added yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
