import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardBody, CardFooter } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Toggle } from "../components/ui/Input";
import { Checkbox } from "../components/ui/checkbox";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import type { NavPage } from "../auth/accessPolicy";
import { useAuth } from "../auth/useAuth";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { downloadCsv } from "../components/importExport/csv";
import { LookupMaster, getAllMasters } from "../services/lookupMaster.service";
import {
  LookupValue,
  LookupValuePayload,
  createValue,
  deleteValue,
  getAllValues,
  updateLookupValueStatus,
  updateValue,
} from "../services/lookupValue.service";

interface LookupValuesPageProps {
  onNavigate?: (page: NavPage) => void;
}

interface ValueFormState {
  code: string;
  display: string;
  sort: string;
  active: boolean;
}

const EMPTY_VALUE_FORM: ValueFormState = {
  code: "",
  display: "",
  sort: "1",
  active: true,
};

const normalizeLookupCodeInput = (value: string): string =>
  value
    .trimStart()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 50);

const finalizeLookupCode = (value: string): string => normalizeLookupCodeInput(value).replace(/^_+|_+$/g, "");

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: unknown; message?: string } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item === "object" && item !== null && "msg" in item) {
            return String((item as { msg?: unknown }).msg);
          }
          return "";
        })
        .filter(Boolean)
        .join(" ");
    }
    if (response?.data?.message) {
      return response.data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
};

const getNextSortOrder = (values: LookupValue[]): string => {
  if (values.length === 0) {
    return "1";
  }

  const currentMax = values.reduce((max, value) => Math.max(max, value.sort), 0);
  return String(currentMax + 1);
};

export function LookupValuesPage({ onNavigate }: LookupValuesPageProps) {
  const { hasPermission } = useAuth();
  const canManageLookup = hasPermission("LOOKUP_MANAGE");
  const canExportReport = hasPermission("REPORT_EXPORT");
  const header = getPageHeaderConfig("lookup-values");
  const [masters, setMasters] = useState<LookupMaster[]>([]);
  const [allValues, setAllValues] = useState<LookupValue[]>([]);

  const [selectedMasterId, setSelectedMasterId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [formData, setFormData] = useState<ValueFormState>(EMPTY_VALUE_FORM);
  const [quickFormData, setQuickFormData] = useState<ValueFormState>(EMPTY_VALUE_FORM);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [quickFormError, setQuickFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isQuickSubmitting, setIsQuickSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedMaster = useMemo(
    () => masters.find((master) => master.id === selectedMasterId) ?? null,
    [masters, selectedMasterId],
  );

  const valuesForMaster = useMemo(() => {
    if (selectedMasterId === null) {
      return [];
    }

    return allValues.filter((value) => value.masterId === selectedMasterId);
  }, [allValues, selectedMasterId]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) {
      return valuesForMaster;
    }

    return valuesForMaster.filter(
      (value) =>
        value.code.toLowerCase().includes(query) ||
        value.display.toLowerCase().includes(query),
    );
  }, [search, valuesForMaster]);

  const selected = useMemo(
    () => valuesForMaster.find((value) => value.id === selectedId) ?? null,
    [selectedId, valuesForMaster],
  );

  const masterKeyById = useMemo(() => {
    const map = new Map<number, string>();
    masters.forEach((master) => {
      map.set(master.id, master.key);
    });
    return map;
  }, [masters]);

  const headerStats = buildPageHeaderStats(header.stats, {
    values: valuesForMaster.length,
    active: valuesForMaster.filter((value) => value.active).length,
    "selected-key": selectedMaster?.key ?? "-",
  });

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const [masterData, valueData] = await Promise.all([getAllMasters(), getAllValues()]);
      setMasters(masterData);
      setAllValues(valueData);

      setSelectedMasterId((previousId) => {
        if (masterData.length === 0) {
          return null;
        }

        if (previousId !== null && masterData.some((master) => master.id === previousId)) {
          return previousId;
        }

        return masterData[0].id;
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setMasters([]);
      setAllValues([]);
      setSelectedMasterId(null);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    setSelectedId((previousId) => {
      if (valuesForMaster.length === 0) {
        return null;
      }

      if (previousId !== null && valuesForMaster.some((value) => value.id === previousId)) {
        return previousId;
      }

      return valuesForMaster[0].id;
    });
  }, [valuesForMaster]);

  useEffect(() => {
    setQuickFormData((previous) => ({
      ...previous,
      sort: getNextSortOrder(valuesForMaster),
    }));
  }, [valuesForMaster]);

  const buildPayload = (data: ValueFormState): LookupValuePayload | null => {
    if (selectedMasterId === null) {
      setFormError("Select a lookup category first.");
      return null;
    }

    const code = finalizeLookupCode(data.code);
    const display = data.display.trim();
    const sort = Number(data.sort);

    if (!code) {
      setFormError("Code is required.");
      return null;
    }

    if (!display) {
      setFormError("Display name is required.");
      return null;
    }

    if (!Number.isFinite(sort)) {
      setFormError("Sort order must be a valid number.");
      return null;
    }

    return {
      master_id: selectedMasterId,
      code,
      display,
      sort,
      active: data.active,
    };
  };

  const openAddModal = (): void => {
    if (!canManageLookup) return;
    setFormMode("add");
    setFormError(null);
    setFormData({
      ...EMPTY_VALUE_FORM,
      sort: getNextSortOrder(valuesForMaster),
    });
    setShowForm(true);
  };

  const openEditModal = (value: LookupValue): void => {
    if (!canManageLookup) return;
    setFormMode("edit");
    setFormError(null);
    setFormData({
      code: value.code,
      display: value.display,
      sort: String(value.sort),
      active: value.active,
    });
    setShowForm(true);
  };

  const handleModalSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canManageLookup) return;

    const payload = buildPayload(formData);
    if (!payload) {
      return;
    }

    if (formMode === "edit" && selectedId === null) {
      setFormError("Select a value to edit.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    setError(null);

    try {
      if (formMode === "add") {
        await createValue(payload);
        console.log("Lookup value created successfully");
      } else {
        if (selectedId !== null) {
          await updateValue(selectedId, payload);
          console.log("Lookup value updated successfully");
        }
      }

      setShowForm(false);
      setFormData(EMPTY_VALUE_FORM);
      await loadData();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canManageLookup) return;

    if (selectedMasterId === null) {
      setQuickFormError("Select a lookup category first.");
      return;
    }

    const code = finalizeLookupCode(quickFormData.code);
    const display = quickFormData.display.trim();
    const sort = Number(quickFormData.sort);

    if (!code) {
      setQuickFormError("Code is required.");
      return;
    }

    if (!display) {
      setQuickFormError("Display name is required.");
      return;
    }

    if (!Number.isFinite(sort)) {
      setQuickFormError("Sort order must be a valid number.");
      return;
    }

    setQuickFormError(null);
    setIsQuickSubmitting(true);
    setError(null);

    try {
      // Lookup value status always depends on the master category
      await createValue({
        master_id: selectedMasterId,
        code,
        display,
        sort,
        active: selectedMaster?.active ?? true,
      });
      console.log("Lookup value created successfully");
      setQuickFormData({
        ...EMPTY_VALUE_FORM,
        sort: getNextSortOrder(valuesForMaster),
      });
      await loadData();
    } catch (submitError) {
      setQuickFormError(getErrorMessage(submitError));
    } finally {
      setIsQuickSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (selectedId === null) {
      return;
    }
    if (!canManageLookup) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteValue(selectedId);
      console.log("Lookup value deleted successfully");
      setShowDelete(false);
      await loadData();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = (): void => {
    if (!canExportReport) return;
    if (valuesForMaster.length === 0 || selectedMasterId === null) {
      return;
    }

    const headers = ["Sort", "Lookup Key", "Code", "Display Name", "Active"];
    const rows = valuesForMaster.map((value) => [
      String(value.sort),
      masterKeyById.get(value.masterId) ?? "-",
      value.code,
      value.display,
      value.active ? "Yes" : "No",
    ]);

    downloadCsv(`lookup-values-${selectedMaster?.key ?? "values"}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={selectedMaster ? `${selectedMaster.description || "Selected lookup category"} - ${selectedMaster.key}` : header.subtitle}
        search={header.searchPlaceholder ? {
          value: search,
          placeholder: header.searchPlaceholder,
          onChange: setSearch,
          onClear: () => setSearch(""),
          disabled: loading,
        } : undefined}
        stats={headerStats}
        primaryAction={header.primaryAction && canManageLookup ? { ...header.primaryAction, onClick: openAddModal, disabled: selectedMasterId === null } : undefined}
        secondaryActions={[
          ...(canManageLookup ? [{
            ...(header.secondaryActions?.[0] ?? { key: "import", label: "Import", variant: "secondary" }),
            onClick: () => undefined,
            disabled: true,
          }] : []),
          ...(canExportReport ? [{
            ...(header.secondaryActions?.[1] ?? { key: "export", label: "Export", variant: "secondary" }),
            onClick: handleExport,
            disabled: valuesForMaster.length === 0,
          }] : []),
          ...(canManageLookup ? [{
            ...(header.secondaryActions?.[2] ?? { key: "reorder", label: "Reorder Values", variant: "ghost" }),
            onClick: () => undefined,
            disabled: selectedMasterId === null || valuesForMaster.length === 0,
          }] : []),
          {
            ...(header.secondaryActions?.[3] ?? { key: "back", label: "Back to Lookup Master", variant: "ghost" }),
            onClick: () => onNavigate?.("lookup-master"),
            disabled: false,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <Card className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0">Filter by Key:</span>
              <div className="flex gap-1 flex-wrap">
                {masters.map((master) => (
                  <button
                    key={master.id}
                    type="button"
                    onClick={() => {
                      setSelectedMasterId(master.id);
                      setSelectedId(null);
                      setSearch("");
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${
                      master.id === selectedMasterId
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {master.key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-mono text-base font-bold text-blue-700">
              {selectedMaster?.key ?? "-"}
            </div>
            <div>
              <div className="text-sm font-medium text-slate-700">{selectedMaster?.description || "Select a lookup category"}</div>
              <div className="text-xs text-slate-400">
                {valuesForMaster.length} total values - {valuesForMaster.filter((value) => value.active).length} active
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8">
            <Card padding="none">
            <CardHeader
              title={`Values: ${selectedMaster?.key ?? "-"}`}
              description={loading ? "Loading..." : `${filtered.length} results`}
            />
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
{["Sort", "Lookup Key", "Code", "Display Name", "Status", "Actions"].map((header) => (
                      <th key={header} className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide text-left">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && (
                    <tr>
<td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        Loading values...
                      </td>
                    </tr>
                  )}

                  {!loading && filtered.length === 0 && (
                    <tr>
<td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                        No values found for the selected lookup category.
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    filtered.map((value) => (
                      <tr
                        key={value.id}
                        className={`cursor-pointer transition-colors group ${
                          value.id === selectedId ? "bg-blue-50/70 border-l-2 border-l-blue-500" : "hover:bg-slate-50"
                        }`}
                        onClick={() => setSelectedId(value.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center w-6 h-6 rounded bg-slate-100 text-slate-500 text-xs font-medium">
                            {value.sort}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {masterKeyById.get(value.masterId) ?? "-"}
                          </span>
</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                            {value.code}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{value.display}</td>
                        <td className="px-4 py-3">
                          {canManageLookup ? <Checkbox
                            checked={value.active}
                            disabled={!selectedMaster?.active}
                            onCheckedChange={(val) => {
                              const newActive = Boolean(val);
                              setAllValues((prev) =>
                                prev.map((v) =>
                                  v.id === value.id ? { ...v, active: newActive } : v
                                )
                              );
                              updateLookupValueStatus(value.id, newActive);
                            }}
                          /> : <Checkbox checked={value.active} disabled={true} />}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                            {canManageLookup ? <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              title="View"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedId(value.id);
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
                                setSelectedId(value.id);
                                openEditModal(value);
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
                                setSelectedId(value.id);
                                setShowDelete(true);
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
            <CardHeader title="Value Detail" />
            <CardBody>
              {selected ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Selected Value</div>
                    <div className="mt-1 font-mono text-xl font-bold text-blue-700">{selected.code}</div>
                  </div>
                  {[
                    { label: "Lookup Key", value: masterKeyById.get(selected.masterId) ?? "-", mono: true },
                    { label: "Display Name", value: selected.display, mono: false },
                    { label: "Sort Order", value: String(selected.sort), mono: false },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
                      <div className={`mt-1 text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</div>
                    </div>
                  ))}
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Active</div>
                    <div className="mt-1">
                      {canManageLookup ? <Checkbox
                        checked={selected.active}
                        disabled={!selectedMaster?.active}
                        onCheckedChange={(value) => {
                          const newActive = Boolean(value);
                          setAllValues((prev) =>
                            prev.map((val) =>
                              val.id === selected.id ? { ...val, active: newActive } : val
                            )
                          );
                          updateLookupValueStatus(selected.id, newActive);
                        }}
                      /> : <Checkbox checked={selected.active} disabled={true} />}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-slate-400 py-4">No value selected.</div>
              )}
            </CardBody>
{selected && canManageLookup && (
              <CardFooter className="gap-2">
                <Button variant="secondary" size="sm" className="w-full" type="button" onClick={() => openEditModal(selected)}>
                  Edit Value
                </Button>
              </CardFooter>
            )}
          </Card>

            {canManageLookup ? <Card padding="none">
            <CardHeader title="Quick Add Value" />
            <CardBody className="px-4 pb-4">
              <form className="space-y-3" onSubmit={(event) => void handleQuickAddSubmit(event)}>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
                  <span className="text-xs text-blue-600 font-semibold">Lookup Key:</span>
                  <span className="font-mono text-xs font-bold text-blue-700">{selectedMaster?.key ?? "-"}</span>
                  {selectedMaster && (
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="text-xs text-blue-500">Status:</span>
                      <Checkbox
                        checked={selectedMaster.active}
                        disabled={true}
                        className="h-3.5 w-3.5"
                      />
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</label>
                  <Input
                    placeholder="e.g. CORP"
                    value={quickFormData.code}
                    onChange={(event) =>
                      setQuickFormData((previous) => ({
                        ...previous,
                        code: normalizeLookupCodeInput(event.target.value),
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Display Name</label>
                  <Input
                    placeholder="e.g. Corporate"
                    value={quickFormData.display}
                    onChange={(event) =>
                      setQuickFormData((previous) => ({
                        ...previous,
                        display: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sort Order</label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={quickFormData.sort}
                    onChange={(event) =>
                      setQuickFormData((previous) => ({
                        ...previous,
                        sort: event.target.value,
                      }))
                    }
                  />
                </div>

                {quickFormError && <p className="text-xs text-red-600">{quickFormError}</p>}

                <Button size="sm" className="w-full" type="submit" disabled={selectedMasterId === null || isQuickSubmitting}>
                  {isQuickSubmitting ? "Adding..." : "Add Value"}
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
        title={formMode === "add" ? `Add Value to ${selectedMaster?.key ?? "Lookup"}` : `Edit: ${selected?.code ?? "Value"}`}
        description={`Configuring values for lookup key: ${selectedMaster?.key ?? "-"}`}
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
            <Button type="submit" form="lookup-value-form" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Value"}
            </Button>
          </>
        }
      >
        <form id="lookup-value-form" className="space-y-4" onSubmit={(event) => void handleModalSubmit(event)}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500">Lookup Key (read-only):</span>
            <span className="font-mono text-xs font-bold text-slate-700">{selectedMaster?.key ?? "-"}</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</label>
            <Input
              placeholder="e.g. CORP"
              required
              value={formData.code}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  code: normalizeLookupCodeInput(event.target.value),
                }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Display Name</label>
            <Input
              placeholder="e.g. Corporate"
              required
              value={formData.display}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  display: event.target.value,
                }))
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sort Order</label>
            <Input
              type="number"
              placeholder="1"
              value={formData.sort}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  sort: event.target.value,
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
        title="Delete this value?"
        message={
          selected
            ? `"${selected.code} - ${selected.display}" will be removed from ${selectedMaster?.key ?? "this category"}.`
            : "Selected value will be removed from this category."
        }
        confirmLabel={isDeleting ? "Deleting..." : "Delete Value"}
      />
    </div>
  );
}

