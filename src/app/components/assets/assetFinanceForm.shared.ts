import {
  AssetFinanceRecord,
  CreateAssetFinancePayload,
  UpdateAssetFinancePayload,
} from "../../../services/asset-finance.service";

export interface AssetFinanceFormState {
  acquisition_dt: string;
  purchase_order_no: string;
  invoice_ref: string;
  supplier_id: string;
  make: string;
  model: string;
  manufacturer: string;
  oem_release_url: string;
  capitalization_date: string;
  acquisition_cost: string;
  currency_code: string;
  replacement_value: string;
  insured_value: string;
  salvage_value: string;
  depreciation_method: string;
  useful_life_years: string;
  depreciation_rate_pct: string;
  accumulated_depreciation: string;
  cost_center: string;
  gl_account_capex: string;
  asset_class_gl: string;
  wbs_element: string;
}

export interface AssetFinanceFieldErrors {
  [key: string]: string;
}

export const EMPTY_ASSET_FINANCE_FORM: AssetFinanceFormState = {
  acquisition_dt: "",
  purchase_order_no: "",
  invoice_ref: "",
  supplier_id: "",
  make: "",
  model: "",
  manufacturer: "",
  oem_release_url: "",
  capitalization_date: "",
  acquisition_cost: "",
  currency_code: "",
  replacement_value: "",
  insured_value: "",
  salvage_value: "",
  depreciation_method: "",
  useful_life_years: "",
  depreciation_rate_pct: "",
  accumulated_depreciation: "",
  cost_center: "",
  gl_account_capex: "",
  asset_class_gl: "",
  wbs_element: "",
};

const trim = (value: string): string => value.trim();

const optionalString = (value: string): string | null => {
  const normalized = trim(value);
  return normalized.length > 0 ? normalized : null;
};

const optionalNumber = (value: string): number | null => {
  const normalized = trim(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const requiredNumber = (value: string): number => Number(trim(value));

const requiredInteger = (value: string): number => Number.parseInt(trim(value), 10);

const requiredIntegerSafe = (value: string): number | null => {
  const normalized = trim(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const roundToTwo = (value: number): number => Math.round(value * 100) / 100;

export const calculateBookValue = (form: AssetFinanceFormState): number | null => {
  const acquisitionCost = optionalNumber(form.acquisition_cost);
  const accumulatedDepreciation = optionalNumber(form.accumulated_depreciation);
  if (acquisitionCost === null || accumulatedDepreciation === null) return null;
  return roundToTwo(acquisitionCost - accumulatedDepreciation);
};

export const calculateAutoDepreciationRate = (form: AssetFinanceFormState): number | null => {
  const usefulLifeYears = requiredIntegerSafe(form.useful_life_years);
  if (usefulLifeYears === null || usefulLifeYears < 1) return null;
  return roundToTwo(100 / usefulLifeYears);
};

const toComparablePayload = (form: AssetFinanceFormState): Omit<CreateAssetFinancePayload, "created_by"> => ({
  acquisition_dt: trim(form.acquisition_dt),
  purchase_order_no: optionalString(form.purchase_order_no),
  invoice_ref: optionalString(form.invoice_ref),
  supplier_id: trim(form.supplier_id),
  make: optionalString(form.make),
  model: optionalString(form.model),
  manufacturer: optionalString(form.manufacturer),
  oem_release_url: optionalString(form.oem_release_url),
  capitalization_date: trim(form.capitalization_date),
  acquisition_cost: requiredNumber(form.acquisition_cost),
  currency_code: trim(form.currency_code),
  replacement_value: optionalNumber(form.replacement_value),
  insured_value: optionalNumber(form.insured_value),
  salvage_value: optionalNumber(form.salvage_value),
  depreciation_method: trim(form.depreciation_method),
  useful_life_years: requiredInteger(form.useful_life_years),
  depreciation_rate_pct: optionalNumber(form.depreciation_rate_pct),
  accumulated_depreciation: requiredNumber(form.accumulated_depreciation),
  cost_center: optionalString(form.cost_center),
  gl_account_capex: optionalString(form.gl_account_capex),
  asset_class_gl: optionalString(form.asset_class_gl),
  wbs_element: optionalString(form.wbs_element),
});

export const buildCreateAssetFinancePayload = (
  form: AssetFinanceFormState,
  createdBy: string,
): CreateAssetFinancePayload => ({
  ...toComparablePayload(form),
  created_by: createdBy,
});

export const buildUpdateAssetFinancePayload = (
  initialForm: AssetFinanceFormState,
  currentForm: AssetFinanceFormState,
  modifiedBy: string,
): UpdateAssetFinancePayload => {
  const initial = toComparablePayload(initialForm);
  const current = toComparablePayload(currentForm);
  const payload: Partial<Omit<UpdateAssetFinancePayload, "modified_by">> = {};

  (Object.keys(current) as Array<keyof typeof current>).forEach((key) => {
    if (current[key] !== initial[key]) {
      payload[key] = current[key];
    }
  });

  return {
    ...payload,
    modified_by: modifiedBy,
  };
};

export const assetFinanceToForm = (finance: AssetFinanceRecord): AssetFinanceFormState => ({
  acquisition_dt: finance.acquisition_dt ?? "",
  purchase_order_no: finance.purchase_order_no ?? "",
  invoice_ref: finance.invoice_ref ?? "",
  supplier_id: finance.supplier_id ?? "",
  make: finance.make ?? "",
  model: finance.model ?? "",
  manufacturer: finance.manufacturer ?? "",
  oem_release_url: finance.oem_release_url ?? "",
  capitalization_date: finance.capitalization_date ?? "",
  acquisition_cost: String(finance.acquisition_cost ?? ""),
  currency_code: finance.currency_code ?? "",
  replacement_value:
    finance.replacement_value === null || finance.replacement_value === undefined
      ? ""
      : String(finance.replacement_value),
  insured_value:
    finance.insured_value === null || finance.insured_value === undefined ? "" : String(finance.insured_value),
  salvage_value:
    finance.salvage_value === null || finance.salvage_value === undefined ? "" : String(finance.salvage_value),
  depreciation_method: finance.depreciation_method ?? "",
  useful_life_years: String(finance.useful_life_years ?? ""),
  depreciation_rate_pct:
    finance.depreciation_rate_pct === null || finance.depreciation_rate_pct === undefined
      ? ""
      : String(finance.depreciation_rate_pct),
  accumulated_depreciation: String(finance.accumulated_depreciation ?? ""),
  cost_center: finance.cost_center ?? "",
  gl_account_capex: finance.gl_account_capex ?? "",
  asset_class_gl: finance.asset_class_gl ?? "",
  wbs_element: finance.wbs_element ?? "",
});

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isFutureDate = (value: string): boolean => {
  if (!value) return false;
  return value > new Date().toISOString().slice(0, 10);
};

export const validateAssetFinanceForm = (form: AssetFinanceFormState): AssetFinanceFieldErrors => {
  const errors: AssetFinanceFieldErrors = {};

  if (!trim(form.acquisition_dt)) errors.acquisition_dt = "Acquisition date is required";
  if (!trim(form.supplier_id)) errors.supplier_id = "Supplier is required";
  if (!trim(form.capitalization_date)) errors.capitalization_date = "Capitalization date is required";
  if (!trim(form.acquisition_cost)) errors.acquisition_cost = "Acquisition cost is required";
  if (!trim(form.currency_code)) errors.currency_code = "Currency is required";
  if (!trim(form.depreciation_method)) errors.depreciation_method = "Depreciation method is required";
  if (!trim(form.useful_life_years)) errors.useful_life_years = "Useful life is required";
  if (!trim(form.accumulated_depreciation)) errors.accumulated_depreciation = "Accumulated depreciation is required";

  if (isFutureDate(form.acquisition_dt)) {
    errors.acquisition_dt = "Acquisition date cannot be later than today";
  }
  if (trim(form.acquisition_dt) && trim(form.capitalization_date) && form.capitalization_date < form.acquisition_dt) {
    errors.capitalization_date = "Capitalization date cannot be earlier than acquisition date";
  }

  const acquisitionCost = optionalNumber(form.acquisition_cost);
  const accumulatedDepreciation = optionalNumber(form.accumulated_depreciation);
  const usefulLifeYears = requiredIntegerSafe(form.useful_life_years);

  if (trim(form.acquisition_cost) && (acquisitionCost === null || acquisitionCost <= 0)) {
    errors.acquisition_cost = "Acquisition cost must be greater than 0";
  }
  if (trim(form.accumulated_depreciation) && (accumulatedDepreciation === null || accumulatedDepreciation < 0)) {
    errors.accumulated_depreciation = "Accumulated depreciation must be 0 or greater";
  }
  if (acquisitionCost !== null && accumulatedDepreciation !== null && accumulatedDepreciation > acquisitionCost) {
    errors.accumulated_depreciation = "Accumulated depreciation cannot exceed acquisition cost";
  }
  if (trim(form.useful_life_years) && (usefulLifeYears === null || usefulLifeYears < 1 || usefulLifeYears > 99)) {
    errors.useful_life_years = "Useful life must be between 1 and 99 years";
  }

  if (trim(form.depreciation_rate_pct)) {
    const rate = optionalNumber(form.depreciation_rate_pct);
    if (rate === null || rate < 0) {
      errors.depreciation_rate_pct = "Depreciation rate must be 0 or greater";
    }
  }

  (["replacement_value", "insured_value", "salvage_value"] as Array<keyof AssetFinanceFormState>).forEach((field) => {
    const raw = trim(form[field]);
    if (!raw) return;
    const parsed = optionalNumber(form[field]);
    if (parsed === null || parsed < 0) {
      errors[field] = "Value must be 0 or greater";
    }
  });

  if (trim(form.oem_release_url) && !isHttpUrl(trim(form.oem_release_url))) {
    errors.oem_release_url = "OEM release URL must be a valid http or https URL";
  }

  if (trim(form.purchase_order_no).length > 20) errors.purchase_order_no = "Purchase order number must be 20 characters or fewer";
  if (trim(form.invoice_ref).length > 20) errors.invoice_ref = "Invoice reference must be 20 characters or fewer";
  if (trim(form.make).length > 50) errors.make = "Make must be 50 characters or fewer";
  if (trim(form.model).length > 50) errors.model = "Model must be 50 characters or fewer";
  if (trim(form.manufacturer).length > 100) errors.manufacturer = "Manufacturer must be 100 characters or fewer";
  if (trim(form.cost_center).length > 15) errors.cost_center = "Cost center must be 15 characters or fewer";
  if (trim(form.gl_account_capex).length > 15) errors.gl_account_capex = "GL account must be 15 characters or fewer";
  if (trim(form.wbs_element).length > 20) errors.wbs_element = "WBS element must be 20 characters or fewer";

  return errors;
};
