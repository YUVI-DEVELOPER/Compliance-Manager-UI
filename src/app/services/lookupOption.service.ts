import { LookupOption } from "./lookupValue.service";

const getLookupOptions = async (masterCode: string): Promise<LookupOption[]> => {
  const { getLookupOptionsByMasterCode } = await import("./lookupValue.service");
  return getLookupOptionsByMasterCode(masterCode);
};

export async function getAssetClasses(): Promise<LookupOption[]> {
  return getLookupOptions("ASSET_CLASS");
}

export async function getAssetCategories(): Promise<LookupOption[]> {
  return getLookupOptions("ASSET_CATEGORY");
}

export async function getAssetSubCategories(): Promise<LookupOption[]> {
  return getLookupOptions("ASSET_SUB_CATEGORY");
}

export async function getAssetTypes(): Promise<LookupOption[]> {
  return getLookupOptions("ASSET_TYPE");
}

export async function getAssetStatuses(): Promise<LookupOption[]> {
  return getLookupOptions("ASSET_STATUS");
}

export async function getCurrencies(): Promise<LookupOption[]> {
  return getLookupOptions("CURRENCY");
}

export async function getDepreciationMethods(): Promise<LookupOption[]> {
  return getLookupOptions("DEPRECIATION_METHOD");
}

export async function getAssetClassGlOptions(): Promise<LookupOption[]> {
  return getLookupOptions("ASSET_CLASS_GL");
}

export async function getCriticalities(): Promise<LookupOption[]> {
  return getLookupOptions("CRITICALITY_CLASS");
}

export async function getAssetNatures(): Promise<LookupOption[]> {
  return getLookupOptions("ASSET_NATURE");
}
