import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, ExternalLink, Power, Trash2 } from "lucide-react";

import { PermissionGuard } from "../auth/PermissionGuard";
import type { NavPage } from "../auth/accessPolicy";
import { useAuth } from "../auth/useAuth";
import { Button } from "../components/ui/button";
import { Input, SearchInput, Textarea } from "../components/ui/input";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { ConfirmStrip, EmptyState, FilterBar, RightPanel, StatusBadge } from "../components/foundation";
import { downloadCsv } from "../components/importExport/csv";
import { navigateToLookupValues } from "../utils/moduleNavigation";
import {
  type LookupMaster,
  type LookupMasterPayload,
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

type MasterFormMode = "add" | "edit";
type PendingAction =
  | { type: "delete"; master: LookupMaster }
  | { type: "status"; master: LookupMaster; nextActive: boolean };

const EMPTY_MASTER_FORM: MasterFormState = {
  key: "",
  description: "",
  active: true,
};

const normalizeLookupKeyInput = (value: string): string =>
  value
    .trimStart()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);

const finalizeLookupKey = (value: string): string => normalizeLookupKeyInput(value).replace(/^_+|_+$/g, "");

const formatDate = (value: string | null): string => {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
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

const buildMasterPayload = (data: MasterFormState): LookupMasterPayload => ({
  key: finalizeLookupKey(data.key),
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [panelOpen, setPanelOpen] = useState(false);
  const [formMode, setFormMode] = useState<MasterFormMode>("add");
  const [editingMaster, setEditingMaster] = useState<LookupMaster | null>(null);
  const [formData, setFormData] = useState<MasterFormState>(EMPTY_MASTER_FORM);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();

    return masters.filter((master) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && master.active) ||
        (statusFilter === "inactive" && !master.active);
      if (!matchesStatus) return false;

      if (!query) return true;

      const statusText = master.active ? "active" : "inactive";
      return [master.key, master.description, statusText]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [masters, search, statusFilter]);

  const stats = useMemo(() => {
    const totalCategories = masters.length;
    const activeCategories = masters.filter((master) => master.active).length;
    const totalValues = masters.reduce((sum, master) => sum + master.valueCount, 0);
    const now = new Date();
    const modifiedThisMonth = masters.filter((master) => {
      if (!master.updatedAt) return false;

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
      setMasters(await getAllMasters());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setMasters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters]);

  const openAddPanel = (): void => {
    if (!canManageLookup) return;
    setFormMode("add");
    setEditingMaster(null);
    setFormData(EMPTY_MASTER_FORM);
    setFormError(null);
    setPanelOpen(true);
  };

  const openEditPanel = (master: LookupMaster): void => {
    if (!canManageLookup) return;
    setFormMode("edit");
    setEditingMaster(master);
    setFormData({
      key: master.key,
      description: master.description,
      active: master.active,
    });
    setFormError(null);
    setPanelOpen(true);
  };

  const resetPanel = (): void => {
    setPanelOpen(false);
    setEditingMaster(null);
    setFormError(null);
    setFormData(EMPTY_MASTER_FORM);
  };

  const closePanel = (): void => {
    if (isSubmitting) return;
    resetPanel();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!canManageLookup) return;

    const payload = buildMasterPayload(formData);
    if (!payload.key) {
      setFormError("Category code is required.");
      return;
    }

    if (formMode === "edit" && !editingMaster) {
      setFormError("Select a category to edit.");
      return;
    }

    setFormError(null);
    setError(null);
    setIsSubmitting(true);

    try {
      if (formMode === "add") {
        await createMaster(payload);
      } else if (editingMaster) {
        await updateMaster(editingMaster.id, payload);
      }

      resetPanel();
      await loadMasters();
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExport = (): void => {
    if (masters.length === 0) return;

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

  const handleManageValues = (master: LookupMaster): void => {
    if (typeof window === "undefined") {
      onNavigate?.("lookup-values");
      return;
    }
    navigateToLookupValues(master.id);
  };

  const confirmPendingAction = async (): Promise<void> => {
    if (!pendingAction) return;
    if (!canManageLookup) return;

    setIsConfirming(true);
    setError(null);

    try {
      if (pendingAction.type === "delete") {
        await deleteMaster(pendingAction.master.id);
      } else {
        await updateMasterWithCascade(pendingAction.master.id, {
          key: pendingAction.master.key,
          description: pendingAction.master.description,
          active: pendingAction.nextActive,
        });
      }

      setPendingAction(null);
      await loadMasters();
    } catch (actionError) {
      setError(getErrorMessage(actionError));
    } finally {
      setIsConfirming(false);
    }
  };

  const hasActiveFilters = Boolean(search.trim() || statusFilter !== "all");

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Lookup Master"
        subtitle="Manage dropdown categories used across Compliance Manager"
        stats={headerStats}
        primaryAction={
          header.primaryAction && canManageLookup
            ? {
                ...header.primaryAction,
                label: "Add Category",
                onClick: openAddPanel,
                disabled: loading,
              }
            : undefined
        }
        secondaryActions={[
          ...(canExportReport
            ? [
                {
                  ...(header.secondaryActions?.[0] ?? { key: "export", label: "Export", variant: "secondary" as const }),
                  onClick: handleExport,
                  disabled: masters.length === 0,
                },
              ]
            : []),
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
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
          <div className="min-w-64 flex-1">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search category code, description, or status..."
              className="h-10"
              disabled={loading}
            />
          </div>
          <label className="flex min-w-48 flex-col gap-1.5 text-sm font-medium text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition-[color,box-shadow] focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              disabled={loading}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </FilterBar>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            Loading lookup categories...
          </div>
        ) : error && masters.length === 0 ? (
          <EmptyState
            title="Error loading lookup categories"
            description={error}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No lookup categories found."
            description="Adjust the search or status filter to see matching lookup categories."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[minmax(180px,1.2fr)_minmax(220px,2fr)_110px_110px_150px_280px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 lg:grid">
              <div>Category Code</div>
              <div>Description</div>
              <div>Values</div>
              <div>Status</div>
              <div>Metadata</div>
              <div className="text-right">Actions</div>
            </div>

            <div className="divide-y divide-slate-100">
              {filtered.map((master) => {
                const pendingForRow = pendingAction?.master.id === master.id ? pendingAction : null;
                return (
                  <div key={master.id}>
                    <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(180px,1.2fr)_minmax(220px,2fr)_110px_110px_150px_280px] lg:items-center lg:gap-4">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-semibold text-slate-900">{master.key}</div>
                        <div className="mt-1 text-xs text-slate-500 lg:hidden">
                          Created {formatDate(master.createdAt)} | Updated {formatDate(master.updatedAt)}
                        </div>
                      </div>

                      <div className="min-w-0 text-sm text-slate-600">
                        {master.description || <span className="text-slate-400">No description</span>}
                      </div>

                      <div>
                        <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {master.valueCount} values
                        </span>
                      </div>

                      <div>
                        <StatusBadge status={master.active ? "active" : "inactive"} />
                      </div>

                      <div className="hidden text-xs text-slate-500 lg:block">
                        <div>Created {formatDate(master.createdAt)}</div>
                        <div className="mt-1">Updated {formatDate(master.updatedAt)}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleManageValues(master)}>
                          <ExternalLink className="h-4 w-4" />
                          Manage Values
                        </Button>

                        <PermissionGuard permission="LOOKUP_MANAGE">
                          <Button type="button" variant="ghost" size="sm" onClick={() => openEditPanel(master)}>
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </Button>
                        </PermissionGuard>

                        <PermissionGuard permission="LOOKUP_MANAGE">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setPendingAction({ type: "status", master, nextActive: !master.active })}
                          >
                            <Power className="h-4 w-4" />
                            {master.active ? "Deactivate" : "Activate"}
                          </Button>
                        </PermissionGuard>

                        <PermissionGuard permission="LOOKUP_MANAGE">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setPendingAction({ type: "delete", master })}
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
                              ? `Delete ${master.key}?`
                              : `${pendingForRow.nextActive ? "Activate" : "Deactivate"} ${master.key}?`
                          }
                          message={
                            pendingForRow.type === "delete"
                              ? "This category will be removed from lookup masters."
                              : pendingForRow.nextActive
                                ? "The category will be available for use."
                                : "The category will be disabled and existing values may be deactivated."
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

        {!loading && filtered.length > 0 ? (
          <div className="text-xs text-slate-500">
            Showing {filtered.length} of {masters.length} lookup categories
          </div>
        ) : null}
      </div>

      <RightPanel
        open={panelOpen}
        title={formMode === "add" ? "Add Lookup Category" : "Edit Lookup Category"}
        description={formMode === "add" ? "Create a system dropdown category." : editingMaster?.key}
        onClose={closePanel}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closePanel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="lookup-master-form" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Category"}
            </Button>
          </div>
        }
      >
        <form id="lookup-master-form" className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <Input
            label="Category Code"
            placeholder="ORG_TYPE"
            required
            value={formData.key}
            disabled={formMode === "edit" || isSubmitting}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                key: normalizeLookupKeyInput(event.target.value),
              }))
            }
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700" htmlFor="lookup-master-description">
              Display Name / Description
            </label>
            <Textarea
              id="lookup-master-description"
              rows={4}
              placeholder="Describe the purpose of this lookup category..."
              value={formData.description}
              disabled={isSubmitting}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  description: event.target.value,
                }))
              }
            />
          </div>

          <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Active
            <input
              type="checkbox"
              checked={formData.active}
              disabled={isSubmitting}
              onChange={(event) =>
                setFormData((previous) => ({
                  ...previous,
                  active: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
          </label>

          {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        </form>
      </RightPanel>
    </div>
  );
}
