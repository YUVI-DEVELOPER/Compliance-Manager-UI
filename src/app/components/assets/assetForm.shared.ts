import { OrgNode } from "../../../services/org.service";
import { AssetRecord, CreateAssetPayload, UpdateAssetPayload } from "../../../services/asset.service";
import { LookupOption } from "../../services/lookupValue.service";

export interface AssetFormState {
  org_node_id: string;
  supplier_id: string;
  asset_id: string;
  asset_name: string;
  short_description: string;
  asset_owner: string;
  asset_class: string;
  asset_category: string;
  asset_sub_category: string;
  asset_type: string;
  criticality_class: string;
  asset_nature: string;
  asset_status: string;
  legacy_id: string;
  serial_number: string;
  tag_number: string;
  qr_barcode: string;
  rfid_tag: string;
  manufacturer: string;
  model: string;
  asset_version: string;
  asset_description: string;
  tags_input: string;
  asset_purchase_dt: string;
  asset_commission_dt: string;
  asset_purchase_ref: string;
  warranty_period: string;
  asset_value: string;
  asset_currency: string;
  asset_release_url: string;
}

export interface AssetFieldErrors {
  [key: string]: string;
}

export interface OrgOption {
  id: string;
  label: string;
}

export const EMPTY_ASSET_FORM: AssetFormState = {
  org_node_id: "",
  supplier_id: "",
  asset_id: "",
  asset_name: "",
  short_description: "",
  asset_owner: "",
  asset_class: "",
  asset_category: "",
  asset_sub_category: "",
  asset_type: "",
  criticality_class: "",
  asset_nature: "",
  asset_status: "",
  legacy_id: "",
  serial_number: "",
  tag_number: "",
  qr_barcode: "",
  rfid_tag: "",
  manufacturer: "",
  model: "",
  asset_version: "",
  asset_description: "",
  tags_input: "",
  asset_purchase_dt: "",
  asset_commission_dt: "",
  asset_purchase_ref: "",
  warranty_period: "",
  asset_value: "",
  asset_currency: "",
  asset_release_url: "",
};

export const ALLOWED_ASSET_STATUS_CODES = [
  "ACTIVE",
  "RETIRED",
  "DECOMMISSIONED",
  "DISPOSED",
  "ARCHIVED",
] as const;

const allowedAssetStatusSet = new Set<string>(ALLOWED_ASSET_STATUS_CODES);

const trim = (value: string): string => value.trim();

const optionalString = (value: string): string | null => {
  const normalized = trim(value);
  return normalized.length ? normalized : null;
};

const optionalNumber = (value: string): number | null => {
  const normalized = trim(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const optionalInteger = (value: string): number | null => {
  const normalized = trim(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseTagsInput = (value: string): string[] | null => {
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length === 0) return null;

  const uniqueItems: string[] = [];
  const seen = new Set<string>();
  items.forEach((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    uniqueItems.push(item);
  });
  return uniqueItems;
};

type ComparableAssetPayload = Omit<CreateAssetPayload, "created_by">;
type UpdateComparableAsset = Omit<UpdateAssetPayload, "modified_by">;

const toComparablePayload = (form: AssetFormState): ComparableAssetPayload => ({
  org_node_id: trim(form.org_node_id),
  supplier_id: optionalString(form.supplier_id),
  asset_id: trim(form.asset_id),
  asset_name: trim(form.asset_name),
  asset_description: trim(form.asset_description),
  short_description: trim(form.short_description),
  asset_owner: trim(form.asset_owner),
  asset_class: trim(form.asset_class),
  asset_category: trim(form.asset_category),
  asset_sub_category: trim(form.asset_sub_category),
  criticality_class: trim(form.criticality_class),
  asset_nature: trim(form.asset_nature),
  asset_type: optionalString(form.asset_type),
  asset_status: optionalString(form.asset_status),
  legacy_id: optionalString(form.legacy_id),
  qr_barcode: optionalString(form.qr_barcode),
  rfid_tag: optionalString(form.rfid_tag),
  serial_number: optionalString(form.serial_number),
  tags: parseTagsInput(form.tags_input),
  tag_number: optionalString(form.tag_number),
  manufacturer: optionalString(form.manufacturer),
  model: optionalString(form.model),
  asset_version: optionalString(form.asset_version),
  asset_commission_dt: optionalString(form.asset_commission_dt),
  asset_purchase_dt: optionalString(form.asset_purchase_dt),
  asset_purchase_ref: optionalString(form.asset_purchase_ref),
  warranty_period: optionalInteger(form.warranty_period),
  asset_value: optionalNumber(form.asset_value),
  asset_currency: optionalString(form.asset_currency),
  asset_release_url: optionalString(form.asset_release_url),
});

const toComparableUpdatePayload = (form: AssetFormState): UpdateComparableAsset => toComparablePayload(form);

export const buildCreateAssetPayload = (form: AssetFormState, createdBy: string): CreateAssetPayload => ({
  ...toComparablePayload(form),
  created_by: createdBy,
});

export const buildUpdateAssetPayload = (
  initialForm: AssetFormState,
  currentForm: AssetFormState,
  modifiedBy: string,
): UpdateAssetPayload => {
  const initial = toComparableUpdatePayload(initialForm);
  const current = toComparableUpdatePayload(currentForm);
  const payload: Partial<UpdateComparableAsset> = {};

  (Object.keys(current) as Array<keyof UpdateComparableAsset>).forEach((key) => {
    const currentValue = current[key];
    const initialValue = initial[key];

    const hasChanged = Array.isArray(currentValue) || Array.isArray(initialValue)
      ? JSON.stringify(currentValue ?? null) !== JSON.stringify(initialValue ?? null)
      : currentValue !== initialValue;

    if (hasChanged) {
      payload[key] = currentValue;
    }
  });

  return {
    ...payload,
    modified_by: modifiedBy,
  };
};

export const assetToForm = (asset: AssetRecord): AssetFormState => ({
  org_node_id: String(asset.org_node_id ?? ""),
  supplier_id: String(asset.supplier_id ?? ""),
  asset_id: String(asset.asset_id ?? ""),
  asset_name: String(asset.asset_name ?? ""),
  short_description: String(asset.short_description ?? ""),
  asset_owner: String(asset.asset_owner ?? ""),
  asset_class: String(asset.asset_class ?? ""),
  asset_category: String(asset.asset_category ?? ""),
  asset_sub_category: String(asset.asset_sub_category ?? ""),
  asset_type: String(asset.asset_type ?? ""),
  criticality_class: String(asset.criticality_class ?? asset.asset_criticality ?? ""),
  asset_nature: String(asset.asset_nature ?? ""),
  asset_status: String(asset.asset_status ?? ""),
  legacy_id: String(asset.legacy_id ?? ""),
  serial_number: String(asset.serial_number ?? asset.asset_serial_no ?? ""),
  tag_number: String(asset.tag_number ?? ""),
  qr_barcode: String(asset.qr_barcode ?? ""),
  rfid_tag: String(asset.rfid_tag ?? ""),
  manufacturer: String(asset.manufacturer ?? ""),
  model: String(asset.model ?? ""),
  asset_version: String(asset.asset_version ?? ""),
  asset_description: String(asset.asset_description ?? ""),
  tags_input: Array.isArray(asset.tags) ? asset.tags.join(", ") : "",
  asset_purchase_dt: String(asset.asset_purchase_dt ?? ""),
  asset_commission_dt: String(asset.asset_commission_dt ?? ""),
  asset_purchase_ref: String(asset.asset_purchase_ref ?? ""),
  warranty_period:
    asset.warranty_period === null || asset.warranty_period === undefined ? "" : String(asset.warranty_period),
  asset_value: asset.asset_value === null || asset.asset_value === undefined ? "" : String(asset.asset_value),
  asset_currency: String(asset.asset_currency ?? ""),
  asset_release_url: String(asset.asset_release_url ?? ""),
});

export const validateAssetForm = (form: AssetFormState): AssetFieldErrors => {
  const errors: AssetFieldErrors = {};

  if (!trim(form.org_node_id)) errors.org_node_id = "Organization is required";
  if (!trim(form.asset_id)) errors.asset_id = "Asset ID is required";
  if (!trim(form.asset_name)) errors.asset_name = "Asset name is required";
  if (!trim(form.short_description)) errors.short_description = "Short description is required";
  if (!trim(form.asset_owner)) errors.asset_owner = "Asset owner is required";
  if (!trim(form.asset_class)) errors.asset_class = "Asset class is required";
  if (!trim(form.asset_category)) errors.asset_category = "Asset category is required";
  if (!trim(form.asset_sub_category)) errors.asset_sub_category = "Sub-category is required";
  if (!trim(form.criticality_class)) errors.criticality_class = "Criticality class is required";
  if (!trim(form.asset_nature)) errors.asset_nature = "Asset nature is required";
  if (!trim(form.asset_description)) errors.asset_description = "Description is required";

  if (trim(form.asset_id).length > 20) errors.asset_id = "Asset ID must be 20 characters or fewer";
  if (trim(form.short_description).length > 40) {
    errors.short_description = "Short description must be 40 characters or fewer";
  }

  if (!trim(form.asset_value) && trim(form.asset_currency)) {
    errors.asset_value = "Asset value is required when currency is selected";
  }
  if (trim(form.asset_value) && !trim(form.asset_currency)) {
    errors.asset_currency = "Currency is required when asset value is entered";
  }

  return errors;
};

export const getTagPreview = (value: string): string[] => parseTagsInput(value) ?? [];

export const filterAllowedAssetStatusOptions = (options: LookupOption[]): LookupOption[] =>
  options.filter((option) => allowedAssetStatusSet.has(option.code));

export const getAssetStatusBadgeClass = (status?: string | null): string => {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800";
    case "RETIRED":
      return "bg-gray-100 text-gray-800";
    case "DECOMMISSIONED":
      return "bg-amber-100 text-amber-800";
    case "DISPOSED":
      return "bg-red-100 text-red-800";
    case "ARCHIVED":
      return "bg-slate-200 text-slate-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
};

export const getCriticalityBadgeClass = (criticality?: string | null): string => {
  switch (criticality) {
    case "A":
      return "bg-red-100 text-red-800";
    case "B":
      return "bg-amber-100 text-amber-800";
    case "C":
      return "bg-sky-100 text-sky-800";
    case "D":
      return "bg-emerald-100 text-emerald-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
};

export const flattenOrgTreeOptions = (nodes: OrgNode[], level = 0): OrgOption[] => {
  const list: OrgOption[] = [];
  nodes.forEach((node) => {
    const prefix = level > 0 ? `${"  ".repeat(level)}- ` : "";
    list.push({ id: node.id, label: `${prefix}${node.name}` });
    list.push(...flattenOrgTreeOptions(node.children ?? [], level + 1));
  });
  return list;
};

export const buildOrgMap = (nodes: OrgNode[]): Map<string, OrgNode> => {
  const map = new Map<string, OrgNode>();
  const stack = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    map.set(current.id, current);
    (current.children ?? []).forEach((child) => stack.push(child));
  }
  return map;
};
