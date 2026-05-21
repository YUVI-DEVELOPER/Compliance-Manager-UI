import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";

import { Button } from "../../components/ui/button";
import { Input, Toggle } from "../../components/ui/input";
import { Modal, ConfirmDialog } from "../../components/ui/Modal";
import { Card, CardBody, CardFooter, CardHeader } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import type { NavPage } from "../../auth/accessPolicy";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { LookupValue, getLookupValuesByMasterCode } from "../../services/lookupValue.service";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import {
  AssetSpecRecord,
  CreateAssetSpecPayload,
  createAssetSpec,
  deleteAssetSpec,
  UpdateAssetSpecPayload,
  updateAssetSpec,
  getAssetSpecs,
} from "../../../services/asset-spec.service";

interface AssetSpecsPageProps {
  onNavigate?: (page: NavPage) => void;
}

interface AssetSpecFormState {
  asset_sub_category_id: string;
  parameter_grouping: string;
  parameter_name: string;
  parameter_value: string;
  guidelines: string;
  is_active: boolean;
}

const DEFAULT_CREATED_BY = "admin";
const EMPTY_FORM: AssetSpecFormState = {
  asset_sub_category_id: "",
  parameter_grouping: "",
  parameter_name: "",
  parameter_value: "",
  guidelines: "",
  is_active: true,
};

const errorMessage = (value: unknown) => (value instanceof Error ? value.message : "Something went wrong. Please try again.");
const labelForSubCategory = (value: LookupValue) => `${value.code} - ${value.display?.trim() || value.code}`;
const groupName = (value: string) => value.trim() || "Ungrouped";

const groupVisibleSpecs = (specs: AssetSpecRecord[], subCategoryById: Map<number, LookupValue>) => {
  const bySubCategory = new Map<number, AssetSpecRecord[]>();
  specs.forEach((spec) => {
    const current = bySubCategory.get(spec.asset_sub_category_id) ?? [];
    current.push(spec);
    bySubCategory.set(spec.asset_sub_category_id, current);
  });

  return Array.from(bySubCategory.entries())
    .map(([subCategoryId, rows]) => {
      const subCategory = subCategoryById.get(subCategoryId);
      const groups = new Map<string, AssetSpecRecord[]>();
      rows.slice().sort((a, b) => a.parameter_seq - b.parameter_seq).forEach((spec) => {
        const key = groupName(spec.parameter_grouping);
        const current = groups.get(key) ?? [];
        current.push(spec);
        groups.set(key, current);
      });

      return {
        subCategoryId,
        subCategoryLabel: subCategory ? labelForSubCategory(subCategory) : rows[0]?.asset_sub_category_name ?? `Sub-category ${subCategoryId}`,
        subCategoryCode: subCategory?.code ?? rows[0]?.asset_sub_category_code ?? "-",
        groups: Array.from(groups.entries())
          .map(([grouping, items]) => ({ grouping, items: items.slice().sort((a, b) => a.parameter_seq - b.parameter_seq) }))
          .sort((a, b) => a.grouping.localeCompare(b.grouping)),
      };
    })
    .sort((a, b) => a.subCategoryLabel.localeCompare(b.subCategoryLabel));
};

export function AssetSpecsPage({ onNavigate }: AssetSpecsPageProps) {
  const header = getPageHeaderConfig("asset-specs");
  const [subCategories, setSubCategories] = useState<LookupValue[]>([]);
  const [specs, setSpecs] = useState<AssetSpecRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [subCategoriesLoading, setSubCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [selectedSpecId, setSelectedSpecId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formData, setFormData] = useState<AssetSpecFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [specToDelete, setSpecToDelete] = useState<AssetSpecRecord | null>(null);

  const subCategoryById = useMemo(() => new Map(subCategories.map((value) => [value.id, value])), [subCategories]);
  const selectedSubCategoryLookup = selectedSubCategoryId ? subCategoryById.get(Number(selectedSubCategoryId)) ?? null : null;

  const loadSubCategories = useCallback(async () => {
    setSubCategoriesLoading(true);
    try {
      setSubCategories(await getLookupValuesByMasterCode("ASSET_SUB_CATEGORY"));
    } catch (loadError) {
      console.error("Failed to load asset sub-categories:", loadError);
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
      setSpecs(
        await getAssetSpecs({
          asset_sub_category_id: selectedSubCategoryId ? Number(selectedSubCategoryId) : null,
          include_inactive: includeInactive,
        }),
      );
    } catch (loadError) {
      setError(errorMessage(loadError));
      setSpecs([]);
    } finally {
      setLoading(false);
    }
  }, [includeInactive, selectedSubCategoryId]);

  useEffect(() => { void loadSubCategories(); }, [loadSubCategories]);
  useEffect(() => { void loadSpecs(); }, [loadSpecs]);

  const filteredSpecs = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return specs;
    return specs.filter((spec) => {
      const subCategory = subCategoryById.get(spec.asset_sub_category_id);
      return [
        subCategory ? labelForSubCategory(subCategory) : spec.asset_sub_category_name ?? "",
        spec.asset_sub_category_code ?? "",
        spec.parameter_grouping,
        spec.parameter_name,
        spec.parameter_value,
        spec.guidelines ?? "",
        String(spec.parameter_seq),
      ].join(" ").toLowerCase().includes(query);
    });
  }, [search, specs, subCategoryById]);

  const groupedSpecs = useMemo(() => groupVisibleSpecs(filteredSpecs, subCategoryById), [filteredSpecs, subCategoryById]);
  const selectedSpec = useMemo(() => specs.find((spec) => spec.asset_spec_id === selectedSpecId) ?? null, [specs, selectedSpecId]);

  useEffect(() => {
    if (filteredSpecs.length === 0) {
      setSelectedSpecId(null);
      return;
    }
    setSelectedSpecId((previous) => (previous && filteredSpecs.some((spec) => spec.asset_spec_id === previous) ? previous : filteredSpecs[0].asset_spec_id));
  }, [filteredSpecs]);

  const openCreate = () => {
    setFormMode("create");
    setFormError(null);
    setFormData({ ...EMPTY_FORM, asset_sub_category_id: selectedSubCategoryId });
    setFormOpen(true);
  };

  const openEdit = (spec: AssetSpecRecord) => {
    setFormMode("edit");
    setFormError(null);
    setSelectedSpecId(spec.asset_spec_id);
    setFormData({
      asset_sub_category_id: String(spec.asset_sub_category_id),
      parameter_grouping: spec.parameter_grouping,
      parameter_name: spec.parameter_name,
      parameter_value: spec.parameter_value,
      guidelines: spec.guidelines ?? "",
      is_active: spec.is_active,
    });
    setFormOpen(true);
  };
  const buildPayload = (): CreateAssetSpecPayload | UpdateAssetSpecPayload | null => {
    const subCategoryId = Number(formData.asset_sub_category_id);
    const grouping = formData.parameter_grouping.trim();
    const name = formData.parameter_name.trim();
    const value = formData.parameter_value.trim();
    const guidelines = formData.guidelines.trim();

    if (!Number.isFinite(subCategoryId) || subCategoryId <= 0) return setFormError("Asset sub-category is required."), null;
    if (!grouping) return setFormError("Parameter grouping is required."), null;
    if (!name) return setFormError("Parameter name is required."), null;
    if (!value) return setFormError("Parameter value is required."), null;

    if (formMode === "create") {
      return {
        asset_sub_category_id: subCategoryId,
        parameter_grouping: grouping,
        parameter_name: name,
        parameter_value: value,
        guidelines: guidelines || undefined,
        is_active: formData.is_active,
        created_by: DEFAULT_CREATED_BY,
      };
    }

    if (!selectedSpecId) return setFormError("Select a specification to edit."), null;
    return {
      asset_sub_category_id: subCategoryId,
      parameter_grouping: grouping,
      parameter_name: name,
      parameter_value: value,
      guidelines: guidelines || undefined,
      is_active: formData.is_active,
      modified_by: DEFAULT_CREATED_BY,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    setFormError(null);
    try {
      if (formMode === "create") {
        await createAssetSpec(payload as CreateAssetSpecPayload);
        toast.success("Asset spec created successfully");
      } else {
        await updateAssetSpec(selectedSpecId!, payload as UpdateAssetSpecPayload);
        toast.success("Asset spec updated successfully");
      }
      setFormOpen(false);
      setFormData(EMPTY_FORM);
      await loadSpecs();
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!specToDelete) return;
    setSubmitting(true);
    try {
      await deleteAssetSpec(specToDelete.asset_spec_id, DEFAULT_CREATED_BY);
      toast.success("Asset spec deactivated successfully");
      setDeleteOpen(false);
      setSpecToDelete(null);
      await loadSpecs();
    } catch (deleteError) {
      toast.error(errorMessage(deleteError));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedSpecSubCategory = selectedSpec ? (subCategoryById.get(selectedSpec.asset_sub_category_id) ?? null) : null;
  const detailRows = selectedSpec
    ? [
        ["Grouping", selectedSpec.parameter_grouping],
        ["Value", selectedSpec.parameter_value],
        ["Guidelines", selectedSpec.guidelines ?? "-"],
        ["Sub-category", selectedSubCategoryLookup ? labelForSubCategory(selectedSubCategoryLookup) : selectedSpec.asset_sub_category_name ?? "-"],
        ["Created By", selectedSpec.created_by ?? "-"],
        ["Modified By", selectedSpec.modified_by ?? "-"],
      ]
    : [];

  const headerStats = buildPageHeaderStats(header.stats, {
    specs: specs.length,
    filtered: filteredSpecs.length,
    subcategories: new Set(specs.map((spec) => spec.asset_sub_category_id)).size,
    inactive: includeInactive ? "Yes" : "No",
  });

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={header.subtitle}
        search={header.searchPlaceholder ? {
          value: search,
          placeholder: header.searchPlaceholder,
          onChange: setSearch,
          onClear: () => setSearch(""),
          disabled: loading,
        } : undefined}
        stats={headerStats}
        primaryAction={header.primaryAction ? { ...header.primaryAction, onClick: openCreate, disabled: subCategoriesLoading } : undefined}
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
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <Card className="shadow-sm">
          <CardBody className="pt-5">
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Filter by Sub-category</label>
                <Select value={selectedSubCategoryId || "all"} onValueChange={(value) => setSelectedSubCategoryId(value === "all" ? "" : value)} disabled={subCategoriesLoading}>
                  <SelectTrigger><SelectValue placeholder={subCategoriesLoading ? "Loading sub-categories..." : "All sub-categories"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sub-categories</SelectItem>
                    {subCategories.map((value) => <SelectItem key={value.id} value={String(value.id)}>{labelForSubCategory(value)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Include inactive</div>
                    <div className="text-xs text-slate-400">Show deactivated rows</div>
                  </div>
                  <Toggle pressed={includeInactive} onPressedChange={(pressed) => setIncludeInactive(Boolean(pressed))} />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 xl:col-span-8 space-y-4">
            {loading && <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">Loading asset specs...</div>}

            {!loading && groupedSpecs.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
                <h3 className="text-base font-semibold text-slate-800">No asset specs found</h3>
                <p className="mt-1 text-sm text-slate-500">Try clearing the filters or create the first specification row.</p>
                <div className="mt-4"><Button type="button" onClick={openCreate}>Create Spec</Button></div>
              </div>
            )}

            {!loading && groupedSpecs.map((subCategoryGroup) => (
              <Card key={subCategoryGroup.subCategoryId} className="shadow-sm" padding="none">
                <CardHeader title={subCategoryGroup.subCategoryLabel} description={`${subCategoryGroup.subCategoryCode} • ${subCategoryGroup.groups.reduce((count, group) => count + group.items.length, 0)} rows`} />
                <CardBody className="space-y-4 pb-6">
                  {subCategoryGroup.groups.map((section) => (
                    <div key={section.grouping} className="rounded-xl border border-slate-200 bg-slate-50/60">
                      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{section.grouping}</div>
                          <div className="text-xs text-slate-500">{section.items.length} specification rows</div>
                        </div>
                        <div className="text-xs font-mono text-slate-400">Grouped display</div>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-white/80 hover:bg-white">
                            <TableHead className="w-20">Seq</TableHead>
                            <TableHead>Parameter</TableHead>
                            <TableHead>Value</TableHead>
                            <TableHead>Guidelines</TableHead>
                            <TableHead className="w-24">Status</TableHead>
                            <TableHead className="w-40 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {section.items.map((spec) => (
                            <TableRow key={spec.asset_spec_id} className={`cursor-pointer ${spec.asset_spec_id === selectedSpecId ? "bg-blue-50/80" : spec.is_active ? "" : "bg-slate-100/70 text-slate-400"}`} onClick={() => setSelectedSpecId(spec.asset_spec_id)}>
                              <TableCell className="font-mono text-xs font-semibold text-slate-600">{spec.parameter_seq}</TableCell>
                              <TableCell>
                                <div className="space-y-1"><div className="font-medium text-slate-800">{spec.parameter_name}</div><div className="text-xs text-slate-500">{spec.asset_sub_category_code ?? spec.asset_sub_category_name ?? "-"}</div></div>
                              </TableCell>
                              <TableCell className="max-w-[280px] whitespace-normal text-slate-700">{spec.parameter_value}</TableCell>
                              <TableCell className="max-w-[240px] whitespace-normal text-slate-500">{spec.guidelines ?? "-"}</TableCell>
                              <TableCell><span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${spec.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{spec.is_active ? "Active" : "Inactive"}</span></TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="sm" type="button" onClick={(event) => { event.stopPropagation(); setSelectedSpecId(spec.asset_spec_id); }}>View</Button>
                                  <Button variant="ghost" size="sm" type="button" onClick={(event) => { event.stopPropagation(); openEdit(spec); }}>Edit</Button>
                                  <Button variant="ghost" size="sm" type="button" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={(event) => { event.stopPropagation(); setSpecToDelete(spec); setDeleteOpen(true); }}>Delete</Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="col-span-12 xl:col-span-4 space-y-4">
            <Card className="shadow-sm" padding="none">
              <CardHeader title="Specification Detail" description="Select a row to view or edit" />
              <CardBody>
                {selectedSpec ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Selected Spec</div>
                          <div className="mt-1 text-base font-semibold text-slate-900">{selectedSpec.parameter_name}</div>
                          <div className="mt-1 text-xs text-slate-500">{selectedSpecSubCategory ? labelForSubCategory(selectedSpecSubCategory) : selectedSpec.asset_sub_category_name ?? selectedSpec.asset_sub_category_code ?? "-"}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Seq</div>
                          <div className="mt-1 text-lg font-semibold text-slate-900">{selectedSpec.parameter_seq}</div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selectedSpec.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{selectedSpec.is_active ? "Active" : "Inactive"}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {detailRows.map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
                          <div className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : <div className="py-6 text-center text-sm text-slate-400">No specification selected</div>}
              </CardBody>
              {selectedSpec && (
                <CardFooter className="gap-2 border-t border-slate-100 bg-slate-50/60">
                  <Button variant="secondary" size="sm" className="flex-1" type="button" onClick={() => openEdit(selectedSpec)}>Edit Spec</Button>
                  <Button variant="destructive" size="sm" className="flex-1" type="button" onClick={() => { setSpecToDelete(selectedSpec); setDeleteOpen(true); }}>Delete</Button>
                </CardFooter>
              )}
            </Card>

            <Card className="shadow-sm" padding="none">
              <CardHeader title="Sub-category Summary" />
              <CardBody className="space-y-2">
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">Sub-categories loaded: <span className="font-semibold">{subCategories.length}</span></div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">Filtered specs: <span className="font-semibold">{filteredSpecs.length}</span></div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>

      <Modal open={formOpen} onClose={() => { setFormOpen(false); setFormError(null); }} size="lg" title={formMode === "create" ? "Create Asset Spec" : "Edit Asset Spec"} description="Maintain reusable technical and functional specifications per asset sub-category." footer={<><Button variant="ghost" type="button" onClick={() => setFormOpen(false)} disabled={submitting}>Cancel</Button><Button type="submit" form="asset-spec-form" disabled={submitting}>{submitting ? "Saving..." : "Save Spec"}</Button></>}>
        <form id="asset-spec-form" className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Asset Sub-category</label>
              <Select value={formData.asset_sub_category_id || undefined} onValueChange={(value) => setFormData((previous) => ({ ...previous, asset_sub_category_id: value }))} disabled={subCategoriesLoading}>
                <SelectTrigger><SelectValue placeholder={subCategoriesLoading ? "Loading sub-categories..." : "Select a sub-category"} /></SelectTrigger>
                <SelectContent>{subCategories.map((value) => <SelectItem key={value.id} value={String(value.id)}>{labelForSubCategory(value)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Parameter Grouping</label><Input value={formData.parameter_grouping} maxLength={50} placeholder="Technical / Functional / Safety" onChange={(event) => setFormData((previous) => ({ ...previous, parameter_grouping: event.target.value }))} /></div>
            <div className="space-y-2"><label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Parameter Name</label><Input value={formData.parameter_name} maxLength={50} placeholder="OS, Battery, Menu, Voltage" onChange={(event) => setFormData((previous) => ({ ...previous, parameter_name: event.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Parameter Value</label><Input value={formData.parameter_value} maxLength={150} placeholder="Windows 11, 4500 mAh, 220 V" onChange={(event) => setFormData((previous) => ({ ...previous, parameter_value: event.target.value }))} /></div>
            <div className="space-y-2 md:col-span-2"><label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Guidelines</label><Input value={formData.guidelines} maxLength={150} placeholder="Optional guidance for maintaining this row" onChange={(event) => setFormData((previous) => ({ ...previous, guidelines: event.target.value }))} /></div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div className="flex items-center justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active</div><div className="text-xs text-slate-400">Inactive rows stay in history but are hidden by default.</div></div><Toggle pressed={formData.is_active} onPressedChange={(pressed) => setFormData((previous) => ({ ...previous, is_active: Boolean(pressed) }))} /></div></div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">Parameter sequence is generated automatically by the system when the row is created.</div>
          {formError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>}
        </form>
      </Modal>

      <ConfirmDialog open={deleteOpen} onConfirm={() => void confirmDelete()} onCancel={() => { if (!submitting) { setDeleteOpen(false); setSpecToDelete(null); } }} title="Deactivate this specification?" message={specToDelete ? `${specToDelete.parameter_name} will be marked inactive for ${specToDelete.parameter_grouping}.` : "This specification will be marked inactive."} confirmLabel={submitting ? "Deactivating..." : "Deactivate"} />
      <Toaster position="top-right" richColors />
    </div>
  );
}


