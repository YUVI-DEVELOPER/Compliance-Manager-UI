import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Power, RefreshCw, Save, Trash2, X } from "lucide-react";
import { toast, Toaster } from "sonner";

import { PermissionGuard } from "../../auth/PermissionGuard";
import type { NavPage } from "../../auth/accessPolicy";
import { useAuth } from "../../auth/useAuth";
import { useCurrentActor } from "../../auth/useCurrentActor";
import { Button } from "../../components/ui/button";
import { SearchInput } from "../../components/ui/input";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { ConfirmStrip, EmptyState, FilterBar, StatusBadge } from "../../components/foundation";
import { type LookupValue, getLookupValuesByMasterCode } from "../../services/lookupValue.service";
import {
  type AssetSpecRecord,
  type CreateAssetSpecPayload,
  type UpdateAssetSpecPayload,
  createAssetSpec,
  deleteAssetSpec,
  getAssetSpecs,
  updateAssetSpec,
} from "../../../services/asset-spec.service";

interface AssetSpecsPageProps {
  onNavigate?: (page: NavPage) => void;
}

interface AssetSpecFormState {
  parameter_grouping: string;
  parameter_name: string;
  parameter_value: string;
  guidelines: string;
  is_active: boolean;
}

type EditingRow = { type: "add" } | { type: "edit"; specId: string } | null;
type PendingAction =
  | { type: "delete"; spec: AssetSpecRecord }
  | { type: "status"; spec: AssetSpecRecord; nextActive: boolean };

const EMPTY_FORM: AssetSpecFormState = {
  parameter_grouping: "",
  parameter_name: "",
  parameter_value: "",
  guidelines: "",
  is_active: true,
};

const errorMessage = (value: unknown) => (value instanceof Error ? value.message : "Something went wrong. Please try again.");
const subCategoryText = (value: LookupValue) => [value.code, value.display].filter(Boolean).join(" ").toLowerCase();

const makePayload = (
  selectedSubCategoryId: string,
  data: AssetSpecFormState,
  actorName: string,
  mode: "create" | "edit",
): { payload: CreateAssetSpecPayload | UpdateAssetSpecPayload | null; error: string | null } => {
  const subCategoryId = Number(selectedSubCategoryId);
  const grouping = data.parameter_grouping.trim();
  const name = data.parameter_name.trim();
  const value = data.parameter_value.trim();
  const guidelines = data.guidelines.trim();

  if (!Number.isFinite(subCategoryId) || subCategoryId <= 0) {
    return { payload: null, error: "Select a sub-category before saving a specification." };
  }
  if (!grouping) return { payload: null, error: "Parameter grouping is required." };
  if (!name) return { payload: null, error: "Parameter name is required." };
  if (!value) return { payload: null, error: "Parameter value is required." };

  if (mode === "create") {
    return {
      payload: {
        asset_sub_category_id: subCategoryId,
        parameter_grouping: grouping,
        parameter_name: name,
        parameter_value: value,
        guidelines: guidelines || undefined,
        is_active: data.is_active,
        created_by: actorName,
      },
      error: null,
    };
  }

  return {
    payload: {
      asset_sub_category_id: subCategoryId,
      parameter_grouping: grouping,
      parameter_name: name,
      parameter_value: value,
      guidelines: guidelines || undefined,
      is_active: data.is_active,
      modified_by: actorName,
    },
    error: null,
  };
};

export function AssetSpecsPage({ onNavigate }: AssetSpecsPageProps) {
  const { hasPermission } = useAuth();
  const currentActor = useCurrentActor();
  const header = getPageHeaderConfig("asset-specs");
  const canCreateSpec = hasPermission("ASSET_CREATE");
  const canUpdateSpec = hasPermission("ASSET_UPDATE");
  const canDeleteSpec = hasPermission("ASSET_DELETE");
  const actorName = currentActor.auditName ?? currentActor.displayName;

  const [subCategories, setSubCategories] = useState<LookupValue[]>([]);
  const [specs, setSpecs] = useState<AssetSpecRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [subCategoriesLoading, setSubCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leftSearch, setLeftSearch] = useState("");
  const [specSearch, setSpecSearch] = useState("");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingRow, setEditingRow] = useState<EditingRow>(null);
  const [formData, setFormData] = useState<AssetSpecFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const subCategoryById = useMemo(() => new Map(subCategories.map((value) => [value.id, value])), [subCategories]);
  const selectedSubCategory = selectedSubCategoryId ? subCategoryById.get(Number(selectedSubCategoryId)) ?? null : null;

  const loadSubCategories = useCallback(async () => {
    setSubCategoriesLoading(true);
    try {
      setSubCategories(await getLookupValuesByMasterCode("ASSET_SUB_CATEGORY"));
    } catch (loadError) {
      toast.error("Failed to load asset sub-categories");
      setSubCategories([]);
    } finally {
      setSubCategoriesLoading(false);
    }
  }, []);

  const loadSpecs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSpecs(await getAssetSpecs({ include_inactive: includeInactive }));
    } catch (loadError) {
      setError(errorMessage(loadError));
      setSpecs([]);
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => { void loadSubCategories(); }, [loadSubCategories]);
  useEffect(() => { void loadSpecs(); }, [loadSpecs]);

  const specCountBySubCategory = useMemo(() => {
    const counts = new Map<number, number>();
    specs.forEach((spec) => {
      counts.set(spec.asset_sub_category_id, (counts.get(spec.asset_sub_category_id) ?? 0) + 1);
    });
    return counts;
  }, [specs]);

  const filteredSubCategories = useMemo(() => {
    const query = leftSearch.trim().toLowerCase();
    if (!query) return subCategories;
    return subCategories.filter((subCategory) => subCategoryText(subCategory).includes(query));
  }, [leftSearch, subCategories]);

  const selectedSpecs = useMemo(() => {
    if (!selectedSubCategoryId) return [];
    const selectedId = Number(selectedSubCategoryId);
    return specs
      .filter((spec) => spec.asset_sub_category_id === selectedId)
      .sort((first, second) => first.parameter_seq - second.parameter_seq || first.parameter_name.localeCompare(second.parameter_name));
  }, [selectedSubCategoryId, specs]);

  const filteredSpecs = useMemo(() => {
    const query = specSearch.trim().toLowerCase();
    if (!query) return selectedSpecs;

    return selectedSpecs.filter((spec) => {
      const statusText = spec.is_active ? "active" : "inactive";
      return [
        spec.parameter_seq,
        spec.parameter_grouping,
        spec.parameter_name,
        spec.parameter_value,
        spec.guidelines ?? "",
        statusText,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [selectedSpecs, specSearch]);

  const headerStats = buildPageHeaderStats(header.stats, {
    specs: specs.length,
    filtered: selectedSubCategory ? filteredSpecs.length : specs.length,
    subcategories: subCategories.length,
    inactive: includeInactive ? "Yes" : "No",
  });

  const clearRowState = (): void => {
    setEditingRow(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setPendingAction(null);
  };

  const handleSelectSubCategory = (subCategoryId: number): void => {
    setSelectedSubCategoryId(String(subCategoryId));
    setSpecSearch("");
    clearRowState();
  };

  const openAddRow = (): void => {
    if (!canCreateSpec || !selectedSubCategoryId) return;
    setEditingRow({ type: "add" });
    setFormData(EMPTY_FORM);
    setFormError(null);
    setPendingAction(null);
  };

  const openEditRow = (spec: AssetSpecRecord): void => {
    if (!canUpdateSpec) return;
    setEditingRow({ type: "edit", specId: spec.asset_spec_id });
    setFormData({
      parameter_grouping: spec.parameter_grouping,
      parameter_name: spec.parameter_name,
      parameter_value: spec.parameter_value,
      guidelines: spec.guidelines ?? "",
      is_active: spec.is_active,
    });
    setFormError(null);
    setPendingAction(null);
  };

  const handleSaveRow = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!editingRow) return;

    const mode = editingRow.type === "add" ? "create" : "edit";
    const { payload, error: validationError } = makePayload(selectedSubCategoryId, formData, actorName, mode);
    if (!payload) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      if (editingRow.type === "add") {
        await createAssetSpec(payload as CreateAssetSpecPayload);
        toast.success("Asset spec created successfully");
      } else {
        await updateAssetSpec(editingRow.specId, payload as UpdateAssetSpecPayload);
        toast.success("Asset spec updated successfully");
      }
      clearRowState();
      await loadSpecs();
    } catch (saveError) {
      setFormError(errorMessage(saveError));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmPendingAction = async (): Promise<void> => {
    if (!pendingAction) return;
    setSubmitting(true);
    try {
      if (pendingAction.type === "delete") {
        await deleteAssetSpec(pendingAction.spec.asset_spec_id, actorName);
        toast.success("Asset spec deactivated successfully");
      } else {
        await updateAssetSpec(pendingAction.spec.asset_spec_id, {
          is_active: pendingAction.nextActive,
          modified_by: actorName,
        });
        toast.success(pendingAction.nextActive ? "Asset spec activated" : "Asset spec deactivated");
      }
      setPendingAction(null);
      await loadSpecs();
    } catch (actionError) {
      toast.error(errorMessage(actionError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Asset Specs"
        subtitle="Manage reusable specification fields by asset sub-category"
        stats={headerStats}
        backAction={header.secondaryActions?.[0] ? { ...header.secondaryActions[0], onClick: () => onNavigate?.("asset") } : undefined}
        secondaryActions={[
          {
            ...(header.secondaryActions?.[1] ?? { key: "refresh", label: "Refresh", variant: "secondary" }),
            onClick: () => void loadSpecs(),
            disabled: loading,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid min-h-[560px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Asset Sub-categories</div>
              <div className="mt-1 text-xs text-slate-500">{subCategories.length} available categories</div>
              <div className="mt-3">
                <SearchInput
                  value={leftSearch}
                  onChange={(event) => setLeftSearch(event.target.value)}
                  onClear={() => setLeftSearch("")}
                  placeholder="Search sub-categories..."
                  disabled={subCategoriesLoading}
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {subCategoriesLoading ? (
                <div className="px-3 py-8 text-center text-sm text-slate-500">Loading sub-categories...</div>
              ) : filteredSubCategories.length === 0 ? (
                <EmptyState title="No sub-categories found" description="Try another search term." className="min-h-48 border-0 bg-transparent" />
              ) : (
                <div className="space-y-1">
                  {filteredSubCategories.map((subCategory) => {
                    const selected = selectedSubCategoryId === String(subCategory.id);
                    const specCount = specCountBySubCategory.get(subCategory.id) ?? 0;
                    return (
                      <button
                        key={subCategory.id}
                        type="button"
                        onClick={() => handleSelectSubCategory(subCategory.id)}
                        className={[
                          "w-full rounded-md border px-3 py-3 text-left transition-colors",
                          selected ? "border-blue-200 bg-blue-50 text-blue-900" : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-sm font-semibold">{subCategory.code}</div>
                            <div className="mt-1 truncate text-sm text-slate-600">{subCategory.display || subCategory.code}</div>
                            <div className="mt-1 text-xs text-slate-400">Asset sub-category</div>
                          </div>
                          <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                            {specCount}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className="min-w-0">
            {!selectedSubCategory ? (
              <EmptyState title="Select a sub-category to view or add specs." description="Choose an asset sub-category from the left panel." className="h-full min-h-[420px]" />
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Specs</div>
                      <h2 className="mt-1 text-xl font-semibold text-slate-900">Specs - {selectedSubCategory.code}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {selectedSpecs.length} specs configured for {selectedSubCategory.display || selectedSubCategory.code}
                      </p>
                    </div>
                    <PermissionGuard permission="ASSET_CREATE">
                      <Button type="button" onClick={openAddRow} disabled={!canCreateSpec || editingRow !== null || loading}>
                        <Plus className="h-4 w-4" />
                        Add Spec
                      </Button>
                    </PermissionGuard>
                  </div>
                </div>

                <FilterBar
                  activeFilters={[
                    ...(specSearch.trim() ? [{ key: "search", label: `Search: ${specSearch.trim()}`, onRemove: () => setSpecSearch("") }] : []),
                    ...(includeInactive ? [{ key: "inactive", label: "Including inactive", onRemove: () => setIncludeInactive(false) }] : []),
                  ]}
                  onClearAll={specSearch.trim() || includeInactive ? () => {
                    setSpecSearch("");
                    setIncludeInactive(false);
                  } : undefined}
                >
                  <div className="min-w-64 flex-1">
                    <SearchInput
                      value={specSearch}
                      onChange={(event) => setSpecSearch(event.target.value)}
                      onClear={() => setSpecSearch("")}
                      placeholder="Search specs by grouping, name, value, or status..."
                      disabled={loading}
                      className="h-10"
                    />
                  </div>
                  <label className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={includeInactive}
                      onChange={(event) => setIncludeInactive(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Include inactive
                  </label>
                  <Button type="button" variant="outline" onClick={() => void loadSpecs()} disabled={loading}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                  </Button>
                </FilterBar>

                {loading ? (
                  <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">Loading asset specs...</div>
                ) : filteredSpecs.length === 0 && editingRow?.type !== "add" ? (
                  <EmptyState title="No specs match this sub-category." description="Add a reusable specification row or adjust the search filters." />
                ) : (
                  <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    <div className="hidden grid-cols-[70px_minmax(150px,1fr)_minmax(170px,1fr)_minmax(180px,1.2fr)_minmax(180px,1.2fr)_100px_260px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:grid">
                      <div>Seq</div>
                      <div>Grouping</div>
                      <div>Spec Name</div>
                      <div>Value</div>
                      <div>Guidelines</div>
                      <div>Status</div>
                      <div className="text-right">Actions</div>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {editingRow?.type === "add" ? (
                        <EditableSpecRow
                          formData={formData}
                          formError={formError}
                          isSubmitting={submitting}
                          mode="add"
                          onCancel={clearRowState}
                          onChange={setFormData}
                          onSubmit={handleSaveRow}
                        />
                      ) : null}

                      {filteredSpecs.map((spec) => {
                        const isEditing = editingRow?.type === "edit" && editingRow.specId === spec.asset_spec_id;
                        const pendingForRow = pendingAction?.spec.asset_spec_id === spec.asset_spec_id ? pendingAction : null;

                        if (isEditing) {
                          return (
                            <EditableSpecRow
                              key={spec.asset_spec_id}
                              formData={formData}
                              formError={formError}
                              isSubmitting={submitting}
                              mode="edit"
                              onCancel={clearRowState}
                              onChange={setFormData}
                              onSubmit={handleSaveRow}
                            />
                          );
                        }

                        return (
                          <div key={spec.asset_spec_id}>
                            <div className="grid gap-3 px-4 py-4 xl:grid-cols-[70px_minmax(150px,1fr)_minmax(170px,1fr)_minmax(180px,1.2fr)_minmax(180px,1.2fr)_100px_260px] xl:items-center xl:gap-4">
                              <div className="font-mono text-xs font-semibold text-slate-500">{spec.parameter_seq}</div>
                              <div className="text-sm font-medium text-slate-800">{spec.parameter_grouping}</div>
                              <div className="text-sm font-semibold text-slate-900">{spec.parameter_name}</div>
                              <div className="text-sm text-slate-700">{spec.parameter_value}</div>
                              <div className="text-sm text-slate-500">{spec.guidelines || "-"}</div>
                              <div><StatusBadge status={spec.is_active ? "active" : "inactive"} /></div>
                              <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                                <PermissionGuard permission="ASSET_UPDATE">
                                  <Button type="button" variant="ghost" size="sm" onClick={() => openEditRow(spec)} disabled={!canUpdateSpec || editingRow !== null}>
                                    <Edit3 className="h-4 w-4" />
                                    Edit
                                  </Button>
                                </PermissionGuard>
                                <PermissionGuard permission="ASSET_UPDATE">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={!canUpdateSpec || editingRow !== null}
                                    onClick={() => setPendingAction({ type: "status", spec, nextActive: !spec.is_active })}
                                  >
                                    <Power className="h-4 w-4" />
                                    {spec.is_active ? "Deactivate" : "Activate"}
                                  </Button>
                                </PermissionGuard>
                                <PermissionGuard permission="ASSET_DELETE">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                    disabled={!canDeleteSpec || editingRow !== null}
                                    onClick={() => setPendingAction({ type: "delete", spec })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </Button>
                                </PermissionGuard>
                              </div>
                            </div>

                            {pendingForRow ? (
                              <div className="px-4 pb-4">
                                <ConfirmStrip
                                  tone={pendingForRow.type === "delete" ? "danger" : "warning"}
                                  title={
                                    pendingForRow.type === "delete"
                                      ? `Delete ${spec.parameter_name}?`
                                      : `${pendingForRow.nextActive ? "Activate" : "Deactivate"} ${spec.parameter_name}?`
                                  }
                                  message={
                                    pendingForRow.type === "delete"
                                      ? "The existing delete API will remove or deactivate this spec row."
                                      : pendingForRow.nextActive
                                        ? "This spec will be available for asset sub-category forms."
                                        : "This spec will be hidden from active asset sub-category forms."
                                  }
                                  confirmLabel={submitting ? "Working..." : pendingForRow.type === "delete" ? "Delete" : "Confirm"}
                                  onConfirm={() => void confirmPendingAction()}
                                  onCancel={() => {
                                    if (!submitting) setPendingAction(null);
                                  }}
                                  disabled={submitting}
                                />
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}

interface EditableSpecRowProps {
  formData: AssetSpecFormState;
  formError: string | null;
  isSubmitting: boolean;
  mode: "add" | "edit";
  onCancel: () => void;
  onChange: React.Dispatch<React.SetStateAction<AssetSpecFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function EditableSpecRow({
  formData,
  formError,
  isSubmitting,
  mode,
  onCancel,
  onChange,
  onSubmit,
}: EditableSpecRowProps) {
  return (
    <form className="bg-blue-50/40 px-4 py-4" onSubmit={onSubmit}>
      <div className="grid gap-3 xl:grid-cols-[70px_minmax(150px,1fr)_minmax(170px,1fr)_minmax(180px,1.2fr)_minmax(180px,1.2fr)_100px_260px] xl:items-start xl:gap-4">
        <div className="flex h-9 items-center rounded-md bg-slate-100 px-2 font-mono text-xs font-semibold text-slate-500">Auto</div>
        <input
          value={formData.parameter_grouping}
          disabled={isSubmitting}
          maxLength={50}
          placeholder="Technical"
          onChange={(event) => onChange((previous) => ({ ...previous, parameter_grouping: event.target.value }))}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          aria-label="Parameter grouping"
        />
        <input
          value={formData.parameter_name}
          disabled={isSubmitting}
          maxLength={50}
          placeholder="CPU"
          onChange={(event) => onChange((previous) => ({ ...previous, parameter_name: event.target.value }))}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          aria-label="Parameter name"
        />
        <input
          value={formData.parameter_value}
          disabled={isSubmitting}
          maxLength={150}
          placeholder="8 core"
          onChange={(event) => onChange((previous) => ({ ...previous, parameter_value: event.target.value }))}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          aria-label="Parameter value"
        />
        <input
          value={formData.guidelines}
          disabled={isSubmitting}
          maxLength={150}
          placeholder="Optional guidance"
          onChange={(event) => onChange((previous) => ({ ...previous, guidelines: event.target.value }))}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          aria-label="Guidelines"
        />
        <label className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={formData.is_active}
            disabled={isSubmitting}
            onChange={(event) => onChange((previous) => ({ ...previous, is_active: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          Active
        </label>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            <Save className="h-4 w-4" />
            {isSubmitting ? "Saving..." : mode === "add" ? "Save Spec" : "Save"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </div>
      {formError ? <div className="mt-2 text-sm text-red-600">{formError}</div> : null}
    </form>
  );
}
