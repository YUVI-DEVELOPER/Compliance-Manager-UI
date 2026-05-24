import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Edit3, Plus, Power, Save, Trash2, X } from "lucide-react";

import { PermissionGuard } from "../auth/PermissionGuard";
import type { NavPage } from "../auth/accessPolicy";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/button";
import { SearchInput } from "../components/ui/input";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { ConfirmStrip, EmptyState, FilterBar, SearchableCombobox, StatusBadge } from "../components/foundation";
import { downloadCsv } from "../components/importExport/csv";
import { navigateToLookupValues } from "../utils/moduleNavigation";
import { type LookupMaster, getAllMasters } from "../services/lookupMaster.service";
import {
  type LookupValue,
  type LookupValuePayload,
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

type EditingRow = { type: "add" } | { type: "edit"; valueId: number } | null;
type PendingAction =
  | { type: "delete"; value: LookupValue }
  | { type: "status"; value: LookupValue; nextActive: boolean };

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

const lookupIdFromQuery = (): number | null => {
  if (typeof window === "undefined") return null;

  const rawLookupId = new URLSearchParams(window.location.search).get("lookup_id");
  if (!rawLookupId) return null;

  const parsedLookupId = Number(rawLookupId);
  return Number.isFinite(parsedLookupId) ? parsedLookupId : null;
};

const getErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: unknown; message?: string } } }).response;
    const detail = response?.data?.detail;

    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const message = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (typeof item === "object" && item !== null && "msg" in item) {
            return String((item as { msg?: unknown }).msg);
          }
          return "";
        })
        .filter(Boolean)
        .join(" ");
      if (message) return message;
    }
    if (response?.data?.message) return response.data.message;
  }

  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
};

const getNextSortOrder = (values: LookupValue[]): string => {
  if (values.length === 0) return "1";

  const currentMax = values.reduce((max, value) => Math.max(max, value.sort), 0);
  return String(currentMax + 1);
};

const makeValuePayload = (
  selectedMasterId: number | null,
  data: ValueFormState,
): { payload: LookupValuePayload | null; error: string | null } => {
  if (selectedMasterId === null) {
    return { payload: null, error: "Select a lookup category first." };
  }

  const code = finalizeLookupCode(data.code);
  const display = data.display.trim();
  const sort = Number(data.sort);

  if (!code) return { payload: null, error: "Value code is required." };
  if (!display) return { payload: null, error: "Display name is required." };
  if (!Number.isFinite(sort)) return { payload: null, error: "Sort order must be a valid number." };

  return {
    payload: {
      master_id: selectedMasterId,
      code,
      display,
      sort,
      active: data.active,
    },
    error: null,
  };
};

export function LookupValuesPage({ onNavigate }: LookupValuesPageProps) {
  const { hasPermission } = useAuth();
  const canManageLookup = hasPermission("LOOKUP_MANAGE");
  const canExportReport = hasPermission("REPORT_EXPORT");
  const header = getPageHeaderConfig("lookup-values");

  const [masters, setMasters] = useState<LookupMaster[]>([]);
  const [allValues, setAllValues] = useState<LookupValue[]>([]);
  const [selectedMasterId, setSelectedMasterId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [editingRow, setEditingRow] = useState<EditingRow>(null);
  const [formData, setFormData] = useState<ValueFormState>(EMPTY_VALUE_FORM);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const selectedMaster = useMemo(
    () => masters.find((master) => master.id === selectedMasterId) ?? null,
    [masters, selectedMasterId],
  );

  const valuesForMaster = useMemo(() => {
    if (selectedMasterId === null) return [];

    return allValues
      .filter((value) => value.masterId === selectedMasterId)
      .sort((first, second) => first.sort - second.sort || first.code.localeCompare(second.code));
  }, [allValues, selectedMasterId]);

  const filteredValues = useMemo(() => {
    const query = search.toLowerCase().trim();

    return valuesForMaster.filter((value) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && value.active) ||
        (statusFilter === "inactive" && !value.active);
      if (!matchesStatus) return false;
      if (!query) return true;

      const statusText = value.active ? "active" : "inactive";
      return [value.code, value.display, statusText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [search, statusFilter, valuesForMaster]);

  const masterOptions = useMemo(
    () =>
      masters.map((master) => ({
        value: String(master.id),
        label: master.key,
        description: `${master.description || `${master.valueCount} values`} (${master.active ? "Active" : "Inactive"})`,
      })),
    [masters],
  );

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
        const requestedLookupId = lookupIdFromQuery();
        if (requestedLookupId !== null && masterData.some((master) => master.id === requestedLookupId)) {
          return requestedLookupId;
        }

        if (previousId !== null && masterData.some((master) => master.id === previousId)) {
          return previousId;
        }

        return null;
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setMasters([]);
      setAllValues([]);
      setSelectedMasterId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const clearRowState = (): void => {
    setEditingRow(null);
    setFormData(EMPTY_VALUE_FORM);
    setFormError(null);
    setPendingAction(null);
  };

  const handleMasterChange = (value: string | null): void => {
    const nextMasterId = value ? Number(value) : null;
    if (nextMasterId !== null && !Number.isFinite(nextMasterId)) return;

    setSelectedMasterId(nextMasterId);
    setSearch("");
    setStatusFilter("all");
    clearRowState();

    if (nextMasterId !== null) {
      navigateToLookupValues(nextMasterId);
    } else if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/lookup-values");
    }
  };

  const openAddRow = (): void => {
    if (!canManageLookup || selectedMasterId === null) return;

    setPendingAction(null);
    setEditingRow({ type: "add" });
    setFormData({
      ...EMPTY_VALUE_FORM,
      sort: getNextSortOrder(valuesForMaster),
      active: selectedMaster?.active ?? true,
    });
    setFormError(null);
  };

  const openEditRow = (value: LookupValue): void => {
    if (!canManageLookup) return;

    setPendingAction(null);
    setEditingRow({ type: "edit", valueId: value.id });
    setFormData({
      code: value.code,
      display: value.display,
      sort: String(value.sort),
      active: value.active,
    });
    setFormError(null);
  };

  const handleSaveRow = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canManageLookup || !editingRow) return;

    const { payload, error: validationError } = makeValuePayload(selectedMasterId, formData);
    if (!payload) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setError(null);

    try {
      if (editingRow.type === "add") {
        await createValue(payload);
      } else {
        await updateValue(editingRow.valueId, payload);
      }

      clearRowState();
      await loadData();
    } catch (saveError) {
      setFormError(getErrorMessage(saveError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmPendingAction = async (): Promise<void> => {
    if (!pendingAction || !canManageLookup) return;

    setIsConfirming(true);
    setError(null);

    try {
      if (pendingAction.type === "delete") {
        await deleteValue(pendingAction.value.id);
      } else {
        await updateLookupValueStatus(pendingAction.value.id, pendingAction.nextActive);
      }

      setPendingAction(null);
      await loadData();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setIsConfirming(false);
    }
  };

  const handleExport = (): void => {
    if (!canExportReport || valuesForMaster.length === 0 || !selectedMaster) return;

    const headers = ["Sort", "Lookup Key", "Code", "Display Name", "Active"];
    const rows = valuesForMaster.map((value) => [
      String(value.sort),
      selectedMaster.key,
      value.code,
      value.display,
      value.active ? "Yes" : "No",
    ]);

    downloadCsv(`lookup-values-${selectedMaster.key}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  // TODO: Add bulk reorder endpoint for smoother drag-drop reorder.
  const handleBackToMaster = (): void => {
    onNavigate?.("lookup-master");
  };

  const hasActiveFilters = Boolean(search.trim() || statusFilter !== "all");
  const canAddValue = canManageLookup && selectedMasterId !== null;

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Lookup Values"
        subtitle={selectedMaster ? `Managing values for ${selectedMaster.key}` : "Select a lookup category to manage values."}
        stats={headerStats}
        backAction={{
          key: "lookup-master",
          label: "Lookup Master",
          icon: "back",
          variant: "secondary",
          onClick: handleBackToMaster,
        }}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <button
            type="button"
            onClick={handleBackToMaster}
            className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Lookup Master
          </button>
          <span className="text-slate-300">/</span>
          <span className="font-mono font-semibold text-slate-900">{selectedMaster?.key ?? "Select category"}</span>
          <span className="text-slate-300">/</span>
          <span>{valuesForMaster.length} values</span>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <FilterBar
          activeFilters={[
            ...(search.trim() ? [{ key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }] : []),
            ...(statusFilter !== "all" ? [{ key: "status", label: `Status: ${statusFilter}`, onRemove: () => setStatusFilter("all") }] : []),
          ]}
          onClearAll={hasActiveFilters ? () => {
            setSearch("");
            setStatusFilter("all");
          } : undefined}
        >
          <SearchableCombobox
            label="Lookup Category"
            options={masterOptions}
            value={selectedMasterId === null ? null : String(selectedMasterId)}
            onChange={handleMasterChange}
            placeholder="Select category..."
            emptyText="No lookup categories found"
            disabled={loading}
            clearable={false}
            className="min-w-64 flex-1"
          />
          <div className="min-w-64 flex-1">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search value code, display name, or status..."
              className="h-10"
              disabled={loading || selectedMasterId === null}
            />
          </div>
          <label className="flex min-w-44 flex-col gap-1.5 text-sm font-medium text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition-[color,box-shadow] focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
              disabled={loading || selectedMasterId === null}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <PermissionGuard permission="LOOKUP_MANAGE">
              <Button type="button" onClick={openAddRow} disabled={!canAddValue || editingRow !== null || loading}>
                <Plus className="h-4 w-4" />
                Add Value
              </Button>
            </PermissionGuard>
            {canExportReport ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleExport}
                disabled={valuesForMaster.length === 0 || selectedMasterId === null}
              >
                Export Current Category
              </Button>
            ) : null}
          </div>
        </FilterBar>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            Loading lookup values...
          </div>
        ) : !selectedMaster ? (
          <EmptyState
            title="Select a lookup category"
            description="Choose a Lookup Master category to view and manage its dropdown values."
          />
        ) : filteredValues.length === 0 && editingRow?.type !== "add" ? (
          <EmptyState
            title="No lookup values found."
            description="Add a value or adjust the search and status filters."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[90px_minmax(150px,1.1fr)_minmax(220px,2fr)_120px_260px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
              <div>Sort</div>
              <div>Value Code</div>
              <div>Display Name</div>
              <div>Status</div>
              <div className="text-right">Actions</div>
            </div>

            <div className="divide-y divide-slate-100">
              {editingRow?.type === "add" ? (
                <EditableValueRow
                  formData={formData}
                  formError={formError}
                  isSubmitting={isSubmitting}
                  mode="add"
                  onCancel={clearRowState}
                  onChange={setFormData}
                  onSubmit={handleSaveRow}
                />
              ) : null}

              {filteredValues.map((value) => {
                const pendingForRow = pendingAction?.value.id === value.id ? pendingAction : null;
                const isEditing = editingRow?.type === "edit" && editingRow.valueId === value.id;

                if (isEditing) {
                  return (
                    <EditableValueRow
                      key={value.id}
                      formData={formData}
                      formError={formError}
                      isSubmitting={isSubmitting}
                      mode="edit"
                      onCancel={clearRowState}
                      onChange={setFormData}
                      onSubmit={handleSaveRow}
                    />
                  );
                }

                return (
                  <div key={value.id}>
                    <div className="grid gap-3 px-4 py-4 lg:grid-cols-[90px_minmax(150px,1.1fr)_minmax(220px,2fr)_120px_260px] lg:items-center lg:gap-4">
                      <div>
                        <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-slate-100 px-2 text-xs font-semibold text-slate-600">
                          {value.sort}
                        </span>
                      </div>
                      <div className="font-mono text-sm font-semibold text-slate-900">{value.code}</div>
                      <div className="text-sm text-slate-700">{value.display}</div>
                      <div>
                        <StatusBadge status={value.active ? "active" : "inactive"} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <PermissionGuard permission="LOOKUP_MANAGE">
                          <Button type="button" variant="ghost" size="sm" onClick={() => openEditRow(value)} disabled={editingRow !== null}>
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="LOOKUP_MANAGE">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={editingRow !== null || !selectedMaster.active}
                            onClick={() => setPendingAction({ type: "status", value, nextActive: !value.active })}
                          >
                            <Power className="h-4 w-4" />
                            {value.active ? "Deactivate" : "Activate"}
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="LOOKUP_MANAGE">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={editingRow !== null}
                            onClick={() => setPendingAction({ type: "delete", value })}
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
                              ? `Delete ${value.code}?`
                              : `${pendingForRow.nextActive ? "Activate" : "Deactivate"} ${value.code}?`
                          }
                          message={
                            pendingForRow.type === "delete"
                              ? `This value will be removed from ${selectedMaster.key}.`
                              : pendingForRow.nextActive
                                ? "This value will become available in dropdowns."
                                : "This value will be hidden from active dropdown choices."
                          }
                          confirmLabel={isConfirming ? "Working..." : pendingForRow.type === "delete" ? "Delete" : "Confirm"}
                          onConfirm={() => void confirmPendingAction()}
                          onCancel={() => {
                            if (!isConfirming) setPendingAction(null);
                          }}
                          disabled={isConfirming}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && selectedMaster ? (
          <div className="text-xs text-slate-500">
            Showing {filteredValues.length} of {valuesForMaster.length} values for {selectedMaster.key}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface EditableValueRowProps {
  formData: ValueFormState;
  formError: string | null;
  isSubmitting: boolean;
  mode: "add" | "edit";
  onCancel: () => void;
  onChange: React.Dispatch<React.SetStateAction<ValueFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function EditableValueRow({
  formData,
  formError,
  isSubmitting,
  mode,
  onCancel,
  onChange,
  onSubmit,
}: EditableValueRowProps) {
  return (
    <form className="bg-blue-50/40 px-4 py-4" onSubmit={onSubmit}>
      <div className="grid gap-3 lg:grid-cols-[90px_minmax(150px,1.1fr)_minmax(220px,2fr)_120px_260px] lg:items-start lg:gap-4">
        <input
          type="number"
          min={0}
          value={formData.sort}
          disabled={isSubmitting}
          onChange={(event) => onChange((previous) => ({ ...previous, sort: event.target.value }))}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          aria-label="Sort order"
        />
        <input
          type="text"
          value={formData.code}
          disabled={isSubmitting}
          onChange={(event) => onChange((previous) => ({ ...previous, code: normalizeLookupCodeInput(event.target.value) }))}
          placeholder="VALUE_CODE"
          className="h-9 rounded-md border border-slate-300 bg-white px-3 font-mono text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          aria-label="Value code"
        />
        <input
          type="text"
          value={formData.display}
          disabled={isSubmitting}
          onChange={(event) => onChange((previous) => ({ ...previous, display: event.target.value }))}
          placeholder="Display name"
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          aria-label="Display name"
        />
        <label className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={formData.active}
            disabled={isSubmitting}
            onChange={(event) => onChange((previous) => ({ ...previous, active: event.target.checked }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          Active
        </label>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            <Save className="h-4 w-4" />
            {isSubmitting ? "Saving..." : mode === "add" ? "Save Value" : "Save"}
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
