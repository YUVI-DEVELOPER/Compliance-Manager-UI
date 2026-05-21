import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardBody, CardFooter } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Textarea, Toggle } from "../components/ui/Input";
import { Checkbox } from "../components/ui/checkbox";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import type { NavPage } from "../auth/accessPolicy";
import { useAuth } from "../auth/useAuth";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { downloadCsv } from "../components/importExport/csv";
import {
  LookupMaster,
  LookupMasterPayload,
  createMaster,
  deleteMaster,
  getAllMasters,
  updateMaster,
  updateMasterWithCascade,
} from "../services/lookupMaster.service";

interface LookupMasterPageProps {
  onNavigate?: (page: NavPage) => void;
}

interface MasterFormState {
  key: string;
  description: string;
  active: boolean;
}

const EMPTY_MASTER_FORM: MasterFormState = {
  key: "",
  description: "",
  active: true,
};

const formatDate = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
};

const buildMasterPayload = (data: MasterFormState): LookupMasterPayload => ({
  key: data.key.trim().toUpperCase(),
  description: data.description.trim(),
  active: data.active,
});

export function LookupMasterPage({ onNavigate }: LookupMasterPageProps) {
  const { hasPermission } = useAuth();
  const canManageLookup = hasPermission("LOOKUP_MANAGE");
  const canExportReport = hasPermission("REPORT_EXPORT");
  const header = getPageHeaderConfig("lookup-master");
  const [masters, setMasters] = useState<LookupMaster[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formData, setFormData] = useState<MasterFormState>(EMPTY_MASTER_FORM);
  const [quickFormData, setQuickFormData] = useState<MasterFormState>(EMPTY_MASTER_FORM);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [quickFormError, setQuickFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selected = useMemo(
    () => masters.find((master) => master.id === selectedId) ?? null,
    [masters, selectedId],
  );

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) {
      return masters;
    }

    return masters.filter(
      (master) =>
        master.key.toLowerCase().includes(query) ||
        master.description.toLowerCase().includes(query),
    );
  }, [masters, search]);

  const stats = useMemo(() => {
    const totalCategories = masters.length;
    const activeCategories = masters.filter((master) => master.active).length;
    const totalValues = masters.reduce((sum, master) => sum + master.valueCount, 0);

    const now = new Date();
    const modifiedThisMonth = masters.filter((master) => {
      if (!master.updatedAt) {
        return false;
      }

      const updated = new Date(master.updatedAt);
      return (
        !Number.isNaN(updated.getTime()) &&
        updated.getMonth() === now.getMonth() &&
        updated.getFullYear() === now.getFullYear()
      );
    }).length;

    return {
      totalCategories,
      activeCategories,
      totalValues,
      modifiedThisMonth,
    };
  }, [masters]);

  const headerStats = buildPageHeaderStats(header.stats, {
    categories: stats.totalCategories,
    active: stats.activeCategories,
    values: stats.totalValues,
    modified: stats.modifiedThisMonth,
  });

  const loadMasters = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAllMasters();
      setMasters(data);
      setSelectedId((previousId) => {
        if (data.length === 0) {
          return null;
        }

        if (previousId !== null && data.some((master) => master.id === previousId)) {
          return previousId;
        }

        return data[0].id;
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setMasters([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters]);

  const openAddModal = (): void => {
    if (!canManageLookup) return;
    setFormMode("add");
    setFormError(null);
    setFormData(EMPTY_MASTER_FORM);
    setShowForm(true);
  };

  const openEditModal = (master: LookupMaster): void => {
    if (!canManageLookup) return;
    setFormMode("edit");
    setFormError(null);
    setFormData({
      key: master.key,
      description: master.description,
      active: master.active,
    });
    setShowForm(true);
  };

  const handleModalSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canManageLookup) return;

    const payload = buildMasterPayload(formData);
    if (!payload.key) {
      setFormError("Lookup key is required.");
      return;
    }

    if (formMode === "edit" && selectedId === null) {
      setFormError("Select a category to edit.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    setError(null);

    try {
      if (formMode === "add") {
        await createMaster(payload);
        console.log("Lookup master created successfully");
      } else {
        await updateMaster(selectedId as number, payload);
        console.log("Lookup master updated successfully");
      }

      setShowForm(false);
      setFormData(EMPTY_MASTER_FORM);
      await loadMasters();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canManageLookup) return;

    const payload = buildMasterPayload(quickFormData);
    if (!payload.key) {
      setQuickFormError("Lookup key is required.");
      return;
    }

    setQuickFormError(null);
    setIsQuickSubmitting(true);
    setError(null);

    try {
      await createMaster(payload);
      console.log("Lookup master created successfully");
      setQuickFormData(EMPTY_MASTER_FORM);
      await loadMasters();
    } catch (submitError) {
      setQuickFormError(getErrorMessage(submitError));
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const openDeleteDialog = (id: number): void => {
    if (!canManageLookup) return;
    setSelectedId(id);
    setShowDelete(true);
  };

  const handleExport = (): void => {
    if (!canExportReport) return;
    if (masters.length === 0) {
      return;
    }

    const headers = ["Lookup Key", "Description", "Active", "Value Count", "Created", "Modified"];
    const rows = masters.map((master) => [
      master.key,
      master.description || "",
      master.active ? "Yes" : "No",
      String(master.valueCount),
      formatDate(master.createdAt),
      formatDate(master.updatedAt),
    ]);

    downloadCsv(`lookup-masters-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const handleDelete = async (): Promise<void> => {
    if (selectedId === null) {
      return;
    }
    if (!canManageLookup) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteMaster(selectedId);
      console.log("Lookup master deleted successfully");
      setShowDelete(false);
      await loadMasters();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  };

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
        primaryAction={header.primaryAction && canManageLookup ? { ...header.primaryAction, onClick: openAddModal, disabled: false } : undefined}
        secondaryActions={[
          ...(canExportReport ? [{
            ...(header.secondaryActions?.[0] ?? { key: "export", label: "Export", variant: "secondary" }),
            onClick: handleExport,
            disabled: masters.length === 0,
          }] : []),
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <Card padding="none">
            <CardHeader
              title="Lookup Categories"
              description="Browse category keys, descriptions, and active status."
            />
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {["Lookup Key", "Description", "Values", "Status", "Modified", "Actions"].map((header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        Loading categories...
                      </td>
                    </tr>
                  )}

                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        No lookup categories found.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filtered.map((master) => (
                      <tr
                        key={master.id}
                        className={`cursor-pointer transition-colors group ${
                          master.id === selectedId
                            ? "bg-blue-50/70 border-l-2 border-l-blue-500"
                            : "hover:bg-slate-50"
                        }`}
                        onClick={() => setSelectedId(master.id)}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {master.key}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs">
                          <span className="truncate block text-xs">{master.description || "-"}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center w-8 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                            {master.valueCount}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={master.active}
                            disabled={true}
                            className="cursor-default"
                          />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{formatDate(master.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                            {canManageLookup ? <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              title="Click to view the Values"
                              onClick={(event) => {
                                event.stopPropagation();
                                onNavigate?.("lookup-values");
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Button> : null}
                            {canManageLookup ? <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              title="Edit"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedId(master.id);
                                openEditModal(master);
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </Button> : null}
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              title="Delete"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDeleteDialog(master.id);
                              }}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            </Card>
          </div>

          <div className="col-span-4 flex flex-col gap-4">
            <Card padding="none">
            <CardHeader title="Category Detail" />
            <CardBody>
              {selected ? (
                <>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected Category</div>
                        <div className="mt-1 font-mono text-lg font-bold text-slate-900">{selected.key}</div>
                        <div className="mt-1 text-sm text-slate-600">{selected.description || "No description provided."}</div>
                      </div>
                      <div className="mt-1">
                        <Checkbox
                          checked={selected.active}
                          disabled={true}
                          className="cursor-default"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Values</div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{selected.valueCount}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Status</div>
                        <div className="mt-1">
                          {canManageLookup ? <Checkbox
                            checked={selected.active}
                            onCheckedChange={async (value) => {
                              const newActive = Boolean(value);
                              setMasters((prev) =>
                                prev.map((master) =>
                                  master.id === selected.id ? { ...master, active: newActive } : master
                                )
                              );
                              await updateMasterWithCascade(selected.id, {
                                key: selected.key,
                                description: selected.description,
                                active: newActive,
                              });
                              await loadMasters();
                            }}
                          /> : (
                            <Checkbox checked={selected.active} disabled={true} className="cursor-default" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Created</div>
                      <div className="mt-1 text-sm text-slate-700">{formatDate(selected.createdAt)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Last Modified</div>
                      <div className="mt-1 text-sm text-slate-700">{formatDate(selected.updatedAt)}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center text-sm text-slate-400 py-6">No category selected.</div>
              )}
            </CardBody>
            {selected && (
              <CardFooter>
                <div className="flex gap-3 mt-4">
                  {canManageLookup ? <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                    type="button"
                    onClick={() => openEditModal(selected)}
                  >
                    Edit Category
                  </Button> : null}
                  <Button
                    size="sm"
                    className="flex-1"
                    type="button"
                    onClick={() => onNavigate?.("lookup-values")}
                  >
                    View Values
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>

            {canManageLookup ? <Card padding="none">
            <CardHeader title="Quick Add Category" />
            <CardBody className="px-4 pb-4">
              <form className="space-y-3" onSubmit={(event) => void handleQuickAddSubmit(event)}>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lookup Key</label>
                  <Input
                    placeholder="e.g. ORG_TYPE"
                    value={quickFormData.key}
                    onChange={(event) =>
                      setQuickFormData((previous) => ({
                        ...previous,
                        key: event.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-slate-400">Uppercase, underscore-separated</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
                  <Textarea
                    placeholder="Describe the purpose of this lookup category..."
                    rows={2}
                    value={quickFormData.description}
                    onChange={(event) =>
                      setQuickFormData((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Active by default</span>
                  <Toggle
                    size="sm"
                    pressed={quickFormData.active}
                    onPressedChange={(pressed) =>
                      setQuickFormData((previous) => ({
                        ...previous,
                        active: pressed,
                      }))
                    }
                  />
                </div>
                {quickFormError && <p className="text-xs text-red-600">{quickFormError}</p>}
                <Button size="sm" className="w-full" type="submit" disabled={isQuickSubmitting}>
                  {isQuickSubmitting ? "Creating..." : "Create Category"}
                </Button>
              </form>
            </CardBody>
            </Card> : null}
          </div>
        </div>
      </div>

      <Modal
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setFormError(null);
        }}
        title={formMode === "add" ? "Add Lookup Category" : `Edit: ${selected?.key ?? "Category"}`}
        description="Configure this lookup category key and description."
        footer={
          <>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" form="lookup-master-form" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Category"}
            </Button>
          </>
        }
      >
        <form id="lookup-master-form" className="space-y-4" onSubmit={(event) => void handleModalSubmit(event)}>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lookup Key</label>
            <Input
              placeholder="e.g. ORG_TYPE"
              required
              value={formData.key}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  key: event.target.value,
                }))
              }
            />
            <p className="text-xs text-slate-400">Uppercase letters and underscores only</p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
            <Textarea
              placeholder="Describe this lookup category..."
              rows={3}
              value={formData.description}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Active</span>
            <Toggle
              pressed={formData.active}
              onPressedChange={(pressed) =>
                setFormData((previous) => ({
                  ...previous,
                  active: pressed,
                }))
              }
            />
          </div>

          {formError && <p className="text-xs text-red-600">{formError}</p>}
        </form>
      </Modal>

      <ConfirmDialog
        open={showDelete}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!isDeleting) {
            setShowDelete(false);
          }
        }}
        title="Delete this category?"
        message={
          selected
            ? `"${selected.key}" will be removed from lookup masters.`
            : "Selected category will be removed from lookup masters."
        }
        confirmLabel={isDeleting ? "Deleting..." : "Delete Category"}
      />
    </div>
  );
}

