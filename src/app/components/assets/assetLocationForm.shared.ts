import {
  AssetLocationRecord,
  CreateAssetLocationPayload,
  UpdateAssetLocationPayload,
} from "../../../services/asset-location.service";

export interface AssetLocationFormState {
  building_reference: string;
  floor_reference: string;
  local_reference: string;
  remarks: string;
}

export interface AssetLocationFieldErrors {
  [key: string]: string;
}

export const EMPTY_ASSET_LOCATION_FORM: AssetLocationFormState = {
  building_reference: "",
  floor_reference: "",
  local_reference: "",
  remarks: "",
};

const trim = (value: string): string => value.trim();

const optionalString = (value: string): string | null => {
  const normalized = trim(value);
  return normalized.length > 0 ? normalized : null;
};

const toComparablePayload = (form: AssetLocationFormState): Omit<CreateAssetLocationPayload, "created_by"> => ({
  building_reference: trim(form.building_reference),
  floor_reference: trim(form.floor_reference),
  local_reference: trim(form.local_reference),
  remarks: optionalString(form.remarks),
});

export const buildCreateAssetLocationPayload = (
  form: AssetLocationFormState,
  createdBy: string,
): CreateAssetLocationPayload => ({
  ...toComparablePayload(form),
  created_by: createdBy,
});

export const buildUpdateAssetLocationPayload = (
  initialForm: AssetLocationFormState,
  currentForm: AssetLocationFormState,
  modifiedBy: string,
): UpdateAssetLocationPayload => {
  const initial = toComparablePayload(initialForm);
  const current = toComparablePayload(currentForm);
  const payload: Partial<Omit<UpdateAssetLocationPayload, "modified_by">> = {};

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

export const assetLocationToForm = (location: AssetLocationRecord): AssetLocationFormState => ({
  building_reference: location.building_reference ?? "",
  floor_reference: location.floor_reference ?? "",
  local_reference: location.local_reference ?? "",
  remarks: location.remarks ?? "",
});

export const validateAssetLocationForm = (form: AssetLocationFormState): AssetLocationFieldErrors => {
  const errors: AssetLocationFieldErrors = {};

  if (!trim(form.building_reference)) errors.building_reference = "Building reference is required";
  if (!trim(form.floor_reference)) errors.floor_reference = "Floor reference is required";
  if (!trim(form.local_reference)) errors.local_reference = "Local reference is required";

  if (trim(form.building_reference).length > 100) {
    errors.building_reference = "Building reference must be 100 characters or fewer";
  }
  if (trim(form.floor_reference).length > 60) {
    errors.floor_reference = "Floor reference must be 60 characters or fewer";
  }
  if (trim(form.local_reference).length > 150) {
    errors.local_reference = "Local reference must be 150 characters or fewer";
  }
  if (trim(form.remarks).length > 500) {
    errors.remarks = "Remarks must be 500 characters or fewer";
  }

  return errors;
};
