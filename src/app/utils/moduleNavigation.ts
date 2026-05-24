export const MODULE_NAVIGATION_EVENT = "compliance-manager:module-navigation";

type QueryValue = string | number | boolean | null | undefined;

function buildModulePath(pathname: string, query: Record<string, QueryValue> = {}): string {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function pushModulePath(path: string): string {
  if (typeof window === "undefined") return path;

  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath !== path) {
    window.history.pushState({}, "", path);
  }

  window.dispatchEvent(new Event(MODULE_NAVIGATION_EVENT));
  return path;
}

export function navigateToAssetReleases(assetId: string | number): string {
  return pushModulePath(buildModulePath("/asset-releases", { asset_id: assetId }));
}

export function navigateToAsset(assetIdOrUuid: string | number): string {
  return pushModulePath(buildModulePath("/asset-master", { asset_id: assetIdOrUuid }));
}

export function navigateToDocumentPortal(assetId: string | number, releaseId?: string | number, documentId?: string | number): string {
  return pushModulePath(buildModulePath("/document-portal", { asset_id: assetId, release_id: releaseId, document_id: documentId }));
}

export function navigateToSupplierEvaluations(assetId?: string | number, supplierId?: string | number): string {
  return pushModulePath(buildModulePath("/supplier-evaluations", { asset_id: assetId, supplier_id: supplierId }));
}

export function navigateToSupplier(supplierId: string | number): string {
  return pushModulePath(buildModulePath("/supplier", { supplier_id: supplierId }));
}

export function navigateToOrg(orgNodeId: string | number): string {
  return pushModulePath(buildModulePath("/org-structure", { org_node_id: orgNodeId }));
}

export function navigateToPeriodicReview(assetId?: string | number): string {
  return pushModulePath(buildModulePath("/periodic-review", { asset_id: assetId }));
}

export function navigateToDocumentIntelligence(assetId?: string | number, documentId?: string | number): string {
  return pushModulePath(buildModulePath("/document-intelligence", { asset_id: assetId, document_id: documentId }));
}

export function navigateToLookupValues(lookupId: string | number): string {
  return pushModulePath(buildModulePath("/lookup-values", { lookup_id: lookupId }));
}

