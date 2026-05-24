import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Download, Edit3, Eye, Plus, RefreshCw, Save, Trash2, Upload, X } from "lucide-react";
import { toast, Toaster } from "sonner";

import { PermissionGuard } from "../auth/PermissionGuard";
import { useAuth } from "../auth/useAuth";
import { useCurrentActor } from "../auth/useCurrentActor";
import { ConfirmStrip, EmptyState, FilterBar, RightPanel, StatusBadge } from "../components/foundation";
import { CsvImportModal } from "../components/importExport/CsvImportModal";
import { downloadCsv } from "../components/importExport/csv";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { Button } from "../components/ui/button";
import { Input, SearchInput } from "../components/ui/input";
import {
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { clearDraft, isShallowDirtyTrimmed, loadDraft, saveDraft } from "../utils/draftStorage";
import { navigateToSupplierEvaluations } from "../utils/moduleNavigation";
import { type LookupOption, getLookupOptionsByMasterCode } from "../services/lookupValue.service";
import {
  type CreateSupplierPayload,
  type SupplierRecord,
  type UpdateSupplierPayload,
  createSupplier,
  deleteSupplier,
  exportAllSuppliers,
  getSupplierById,
  getSuppliers,
  searchSuppliers,
  updateSupplier,
} from "../../services/supplier.service";

type SupplierFormMode = "create" | "edit";
type PanelMode = SupplierFormMode | "view" | null;

const SUPPLIER_FORM_FIELDS = [
  "supplier_name",
  "supplier_type",
  "supplier_add1",
  "supplier_add2",
  "supplier_city",
  "supplier_pincode",
  "supplier_state",
  "supplier_country",
  "contact_name",
  "contact_email",
  "contact_phone",
] as const;

type SupplierFormKey = (typeof SUPPLIER_FORM_FIELDS)[number];
type SupplierFormState = Record<SupplierFormKey, string>;
type FieldErrors = Partial<Record<SupplierFormKey | "form", string>>;

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 350;

const EMPTY_FORM: SupplierFormState = {
  supplier_name: "",
  supplier_type: "",
  supplier_add1: "",
  supplier_add2: "",
  supplier_city: "",
  supplier_pincode: "",
  supplier_state: "",
  supplier_country: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
};

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-input-background px-3 py-2 text-sm text-slate-900 outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const recordToForm = (record: SupplierRecord): SupplierFormState => ({
  supplier_name: record.supplier_name ?? "",
  supplier_type: record.supplier_type ?? "",
  supplier_add1: record.supplier_add1 ?? "",
  supplier_add2: record.supplier_add2 ?? "",
  supplier_city: record.supplier_city ?? "",
  supplier_pincode: record.supplier_pincode ?? "",
  supplier_state: record.supplier_state ?? "",
  supplier_country: record.supplier_country ?? "",
  contact_name: record.contact_name ?? "",
  contact_email: record.contact_email ?? "",
  contact_phone: record.contact_phone ?? "",
});

const mapAxiosError = (error: unknown): { message: string; fieldErrors?: FieldErrors; status?: number } => {
  if (!axios.isAxiosError(error)) {
    return { message: error instanceof Error ? error.message : "Unexpected error occurred" };
  }

  const status = error.response?.status;
  const data = error.response?.data as { message?: string; detail?: unknown } | undefined;

  if (status === 400 || status === 422) {
    const fieldErrors: FieldErrors = {};
    if (Array.isArray(data?.detail)) {
      data.detail.forEach((item) => {
        if (typeof item === "object" && item !== null) {
          const loc = (item as { loc?: unknown }).loc;
          const msg = (item as { msg?: string }).msg;
          const field = Array.isArray(loc) && loc.length > 0 ? String(loc[loc.length - 1]) : "form";
          fieldErrors[field as SupplierFormKey | "form"] = msg ?? "Invalid value";
        }
      });
    }
    return {
      message: data?.message || (status === 422 ? "Field validation failed" : "Validation failed"),
      fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
      status,
    };
  }

  if (status === 404) return { message: data?.message || "Supplier not found", status };
  if (status === 409) return { message: data?.message || "Duplicate supplier name", status };
  return { message: data?.message || error.message || "Request failed", status };
};

const normalizeOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const optionalCsv = (value: string | undefined): string | undefined => {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : undefined;
};

const buildCreatePayload = (form: SupplierFormState, actorId: string): CreateSupplierPayload => ({
  supplier_name: form.supplier_name.trim(),
  created_by: actorId,
  supplier_type: normalizeOptional(form.supplier_type),
  supplier_add1: normalizeOptional(form.supplier_add1),
  supplier_add2: normalizeOptional(form.supplier_add2),
  supplier_city: normalizeOptional(form.supplier_city),
  supplier_pincode: normalizeOptional(form.supplier_pincode),
  supplier_state: normalizeOptional(form.supplier_state),
  supplier_country: normalizeOptional(form.supplier_country),
  contact_name: normalizeOptional(form.contact_name),
  contact_email: normalizeOptional(form.contact_email),
  contact_phone: normalizeOptional(form.contact_phone),
});

const buildUpdatePayload = (initial: SupplierFormState, current: SupplierFormState, actorId: string): UpdateSupplierPayload => {
  const payload: UpdateSupplierPayload = {};
  const mutablePayload = payload as Partial<Record<SupplierFormKey, string>>;

  SUPPLIER_FORM_FIELDS.forEach((key) => {
    const initialValue = initial[key].trim();
    const currentValue = current[key].trim();
    if (initialValue !== currentValue) {
      const normalized = normalizeOptional(current[key]);
      if (normalized !== undefined) {
        mutablePayload[key] = normalized;
      }
    }
  });

  if (Object.keys(payload).length > 0) {
    payload.modified_by = actorId;
  }

  return payload;
};

const formatValue = (value?: string | null): string => {
  const text = String(value ?? "").trim();
  return text || "-";
};

const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const supplierCode = (supplier: SupplierRecord): string => supplier.supplier_id;

const shortSupplierCode = (supplier: SupplierRecord): string => {
  const code = supplierCode(supplier);
  return code.length > 12 ? `${code.slice(0, 8)}...` : code;
};

const findLookupLabel = (options: LookupOption[], code?: string | null): string => {
  if (!code) return "-";
  const match = options.find((option) => option.code === code);
  return match?.value ?? code;
};

const supplierSearchText = (supplier: SupplierRecord, supplierTypes: LookupOption[]): string =>
  [
    supplier.supplier_id,
    supplier.supplier_name,
    supplier.supplier_type,
    findLookupLabel(supplierTypes, supplier.supplier_type),
    supplier.contact_name,
    supplier.contact_email,
    supplier.contact_phone,
    supplier.supplier_city,
    supplier.supplier_state,
    supplier.supplier_country,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export function SupplierPage() {
  const { hasPermission } = useAuth();
  const currentActor = useCurrentActor();
  const canCreateSupplier = hasPermission("SUPPLIER_CREATE");
  const canUpdateSupplier = hasPermission("SUPPLIER_UPDATE");
  const canDeleteSupplier = hasPermission("SUPPLIER_DELETE");
  const canExportReport = hasPermission("REPORT_EXPORT");
  const header = getPageHeaderConfig("supplier");

  const [search, setSearch] = useState("");
  const [supplierTypeFilter, setSupplierTypeFilter] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [page, setPage] = useState(1);

  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formData, setFormData] = useState<SupplierFormState>(EMPTY_FORM);
  const [initialFormData, setInitialFormData] = useState<SupplierFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SupplierRecord | null>(null);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [supplierTypeOptions, setSupplierTypeOptions] = useState<LookupOption[]>([]);
  const [countryOptions, setCountryOptions] = useState<LookupOption[]>([]);

  const [pendingDraft, setPendingDraft] = useState<SupplierFormState | null>(null);
  const restoreDraftKey = useRef<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importInitialText, setImportInitialText] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const requestSeq = useRef(0);
  const didInitSearch = useRef(false);
  const lookupSeq = useRef(0);

  const currentActorId = currentActor.id ?? currentActor.auditName ?? currentActor.displayName;

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return suppliers.filter((supplier) => {
      if (supplierTypeFilter && supplier.supplier_type !== supplierTypeFilter) return false;
      if (query && !supplierSearchText(supplier, supplierTypeOptions).includes(query)) return false;
      return true;
    });
  }, [search, supplierTypeFilter, supplierTypeOptions, suppliers]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE)), [filteredSuppliers.length]);
  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSuppliers.slice(start, start + PAGE_SIZE);
  }, [filteredSuppliers, page]);

  const activeDraftKey = useMemo(() => {
    if (panelMode === "create") return "draft_supplier_create";
    if (panelMode === "edit") return selectedSupplierId ? `draft_supplier_edit_${selectedSupplierId}` : null;
    return null;
  }, [panelMode, selectedSupplierId]);

  const draftBaseline = useMemo(() => (panelMode === "create" ? EMPTY_FORM : initialFormData), [initialFormData, panelMode]);
  const isDraftDirty = useMemo(() => isShallowDirtyTrimmed(formData, draftBaseline), [draftBaseline, formData]);

  const saveCurrentDraft = useCallback(
    (options?: { force?: boolean; toasts?: boolean }) => {
      if (!activeDraftKey) return;
      const force = options?.force ?? false;
      const showToast = options?.toasts ?? false;

      if (!force && !isDraftDirty) {
        clearDraft(activeDraftKey);
        return;
      }

      try {
        saveDraft(activeDraftKey, formData);
        if (showToast) toast.message("Draft saved");
      } catch {
        toast.error("Failed to save draft");
      }
    },
    [activeDraftKey, formData, isDraftDirty],
  );

  const discardCurrentDraft = useCallback(() => {
    if (!activeDraftKey) return;
    clearDraft(activeDraftKey);
  }, [activeDraftKey]);

  const closePanel = useCallback(() => {
    setPanelMode(null);
    setSelectedSupplierId(null);
    setSelectedSupplier(null);
    setPendingDelete(null);
    setPendingDraft(null);
    setFieldErrors({});
    setFormData(EMPTY_FORM);
    setInitialFormData(EMPTY_FORM);
    restoreDraftKey.current = null;
  }, []);

  const handlePanelClose = useCallback(() => {
    if (submitting) return;
    if (panelMode === "create" || panelMode === "edit") {
      saveCurrentDraft();
    }
    closePanel();
  }, [closePanel, panelMode, saveCurrentDraft, submitting]);

  const reloadSuppliers = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoadingList(true);
    try {
      const list = await getSuppliers();
      if (seq !== requestSeq.current) return;
      setSuppliers(list);
      setPage(1);
    } catch (error) {
      const mapped = mapAxiosError(error);
      toast.error(mapped.message);
    } finally {
      if (seq === requestSeq.current) setLoadingList(false);
    }
  }, []);

  const runSearch = useCallback(async (query: string) => {
    const seq = ++requestSeq.current;
    setLoadingList(true);
    try {
      const list = await searchSuppliers(query);
      if (seq !== requestSeq.current) return;
      setSuppliers(list);
      setPage(1);
    } catch (error) {
      const mapped = mapAxiosError(error);
      toast.error(mapped.message);
    } finally {
      if (seq === requestSeq.current) setLoadingList(false);
    }
  }, []);

  const loadLookups = useCallback(async () => {
    const seq = ++lookupSeq.current;
    setLookupLoading(true);
    setLookupError(false);
    try {
      const [supplierTypes, countries] = await Promise.all([
        getLookupOptionsByMasterCode("SUPPLIER_TYPE"),
        getLookupOptionsByMasterCode("COUNTRY"),
      ]);
      if (seq !== lookupSeq.current) return;
      setSupplierTypeOptions(supplierTypes);
      setCountryOptions(countries);
    } catch {
      if (seq !== lookupSeq.current) return;
      setLookupError(true);
      toast.error("Failed to load dropdown values");
    } finally {
      if (seq === lookupSeq.current) setLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadSuppliers();
    void loadLookups();
  }, [loadLookups, reloadSuppliers]);

  useEffect(() => {
    if (!didInitSearch.current) {
      didInitSearch.current = true;
      return;
    }

    const trimmed = search.trim();
    const handle = window.setTimeout(() => {
      if (!trimmed) {
        void reloadSuppliers();
        return;
      }
      void runSearch(trimmed);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [reloadSuppliers, runSearch, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (panelMode !== "create" && panelMode !== "edit") {
      restoreDraftKey.current = null;
      setPendingDraft(null);
      return;
    }

    if (!activeDraftKey) return;
    if (detailLoading) return;
    if (restoreDraftKey.current === activeDraftKey) return;

    restoreDraftKey.current = activeDraftKey;
    const draft = loadDraft<SupplierFormState>(activeDraftKey);
    if (draft) {
      setPendingDraft(draft);
    }
  }, [activeDraftKey, detailLoading, panelMode]);

  const fetchSupplierDetail = async (supplierId: string): Promise<SupplierRecord | null> => {
    setDetailLoading(true);
    try {
      const detail = await getSupplierById(supplierId);
      setSelectedSupplier(detail);
      return detail;
    } catch (error) {
      const mapped = mapAxiosError(error);
      toast.error(mapped.message);
      return null;
    } finally {
      setDetailLoading(false);
    }
  };

  const openCreate = () => {
    if (!canCreateSupplier) return;
    setFieldErrors({});
    setPendingDelete(null);
    setSelectedSupplierId(null);
    setSelectedSupplier(null);
    setFormData(EMPTY_FORM);
    setInitialFormData(EMPTY_FORM);
    setPanelMode("create");
  };

  const openView = async (supplierId: string) => {
    const listRecord = suppliers.find((supplier) => supplier.supplier_id === supplierId) ?? null;
    setFieldErrors({});
    setPendingDelete(null);
    setSelectedSupplierId(supplierId);
    setSelectedSupplier(listRecord);
    setPanelMode("view");
    await fetchSupplierDetail(supplierId);
  };

  const openEdit = async (supplierId: string) => {
    if (!canUpdateSupplier) return;
    const listRecord = suppliers.find((supplier) => supplier.supplier_id === supplierId) ?? null;
    setFieldErrors({});
    setPendingDelete(null);
    setSelectedSupplierId(supplierId);
    setSelectedSupplier(listRecord);
    setPanelMode("edit");
    const detail = await fetchSupplierDetail(supplierId);
    if (!detail) {
      closePanel();
      return;
    }
    const nextForm = recordToForm(detail);
    setFormData(nextForm);
    setInitialFormData(nextForm);
  };

  const switchToEdit = () => {
    if (!selectedSupplier || !canUpdateSupplier) return;
    setFieldErrors({});
    setPendingDelete(null);
    const nextForm = recordToForm(selectedSupplier);
    setFormData(nextForm);
    setInitialFormData(nextForm);
    setPanelMode("edit");
  };

  const handleCancelForm = () => {
    if (submitting) return;
    discardCurrentDraft();
    setPendingDraft(null);
    setFieldErrors({});
    if (panelMode === "edit" && selectedSupplier) {
      setFormData(recordToForm(selectedSupplier));
      setInitialFormData(recordToForm(selectedSupplier));
      setPanelMode("view");
      return;
    }
    closePanel();
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (lookupError) return;
    if (panelMode !== "create" && panelMode !== "edit") return;

    setFieldErrors({});

    if (!formData.supplier_name.trim()) {
      setFieldErrors({ supplier_name: "Supplier name is required" });
      return;
    }

    setSubmitting(true);
    try {
      if (panelMode === "create") {
        const created = await createSupplier(buildCreatePayload(formData, currentActorId));
        toast.success("Supplier created successfully");
        if (activeDraftKey) clearDraft(activeDraftKey);
        setSelectedSupplier(created);
        closePanel();
      } else {
        if (!selectedSupplierId) {
          toast.error("Missing supplier id");
          return;
        }
        const payload = buildUpdatePayload(initialFormData, formData, currentActorId);
        if (Object.keys(payload).length === 0) {
          toast.message("No changes to save");
          if (activeDraftKey) clearDraft(activeDraftKey);
          setPendingDraft(null);
          setPanelMode("view");
        } else {
          const updated = await updateSupplier(selectedSupplierId, payload);
          toast.success("Supplier updated successfully");
          if (activeDraftKey) clearDraft(activeDraftKey);
          setPendingDraft(null);
          setSelectedSupplier(updated);
          setInitialFormData(recordToForm(updated));
          setFormData(recordToForm(updated));
          setPanelMode("view");
        }
      }

      await reloadSuppliers();
    } catch (error) {
      const mapped = mapAxiosError(error);
      if (mapped.fieldErrors) setFieldErrors(mapped.fieldErrors);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  const requestDelete = (supplier: SupplierRecord) => {
    if (!canDeleteSupplier) return;
    setSelectedSupplierId(supplier.supplier_id);
    setSelectedSupplier(supplier);
    setPanelMode("view");
    setPendingDelete(supplier);
  };

  const confirmDelete = async () => {
    const target = pendingDelete ?? selectedSupplier;
    if (!target || submitting) return;
    setSubmitting(true);
    try {
      await deleteSupplier(target.supplier_id);
      setSuppliers((previous) => previous.filter((item) => item.supplier_id !== target.supplier_id));
      toast.success("Supplier deleted successfully");
      closePanel();
    } catch (error) {
      const mapped = mapAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setSupplierTypeFilter("");
    void reloadSuppliers();
  };

  const handleExport = async () => {
    if (!canExportReport) return;
    try {
      const allSuppliers = await exportAllSuppliers();

      if (!allSuppliers || allSuppliers.length === 0) {
        toast.error("No suppliers to export");
        return;
      }

      const firstRecord = allSuppliers[0];
      const headers = Object.keys(firstRecord);
      const rows = allSuppliers.map((supplier) =>
        headers.map((key) => {
          const value = (supplier as unknown as Record<string, unknown>)[key];
          return value === null || value === undefined ? "" : String(value);
        }),
      );

      downloadCsv(`suppliers-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      toast.success(`Exported ${allSuppliers.length} suppliers`);
    } catch (error) {
      const mapped = mapAxiosError(error);
      toast.error(mapped.message);
    }
  };

  const renderFieldError = (key: SupplierFormKey) =>
    fieldErrors[key] ? <p className="text-xs text-red-600">{fieldErrors[key]}</p> : null;

  const headerStats = buildPageHeaderStats(header.stats, {
    total: suppliers.length,
    filtered: filteredSuppliers.length,
  });

  const activeFilters = [
    ...(search.trim()
      ? [{ key: "search", label: `Search: ${search.trim()}`, onRemove: () => {
          setSearch("");
          void reloadSuppliers();
        } }]
      : []),
    ...(supplierTypeFilter
      ? [{ key: "type", label: `Type: ${findLookupLabel(supplierTypeOptions, supplierTypeFilter)}`, onRemove: () => setSupplierTypeFilter("") }]
      : []),
  ];

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Supplier Management"
        subtitle="Manage supplier master data, contacts, addresses, and evaluation history"
        stats={headerStats}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <PermissionGuard permission="SUPPLIER_CREATE">
              <Button type="button" variant="secondary" size="sm" onClick={() => setImportOpen(true)} disabled={loadingList}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </PermissionGuard>
            <PermissionGuard permission="REPORT_EXPORT">
              <Button type="button" variant="secondary" size="sm" onClick={() => void handleExport()} disabled={loadingList || suppliers.length === 0}>
                <Download className="h-4 w-4" />
                Export All CSV
              </Button>
            </PermissionGuard>
            <Button type="button" variant="ghost" size="sm" onClick={() => void reloadSuppliers()} disabled={loadingList}>
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
            <PermissionGuard permission="SUPPLIER_CREATE">
              <Button type="button" size="sm" onClick={openCreate} disabled={loadingList}>
                <Plus className="h-4 w-4" />
                Add Supplier
              </Button>
            </PermissionGuard>
          </div>
        }
      />

      <div className={PAGE_CONTENT_CLASS}>
        <FilterBar
          activeFilters={activeFilters}
          onClearAll={activeFilters.length ? handleClearFilters : undefined}
        >
          <div className="min-w-72 flex-1">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => {
                setSearch("");
                void reloadSuppliers();
              }}
              placeholder="Search by name, code, contact, email, or type..."
              disabled={loadingList}
              className="h-10"
            />
          </div>
          <div className="w-full sm:w-64">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier Type</label>
            <select
              value={supplierTypeFilter}
              onChange={(event) => {
                setSupplierTypeFilter(event.target.value);
                setPage(1);
              }}
              className={selectClassName}
              disabled={lookupLoading}
            >
              <option value="">All supplier types</option>
              {supplierTypeOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.value}
                </option>
              ))}
            </select>
          </div>
        </FilterBar>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Supplier Directory</h2>
              <p className="mt-1 text-xs text-slate-500">
                {filteredSuppliers.length} suppliers visible from {suppliers.length} loaded records.
              </p>
            </div>
            {filteredSuppliers.length > 0 ? (
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            ) : null}
          </div>

          {loadingList ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">Loading suppliers...</div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No suppliers found"
                description={search.trim() || supplierTypeFilter ? "Adjust the filters to find supplier records." : "Create a supplier to start building the supplier master."}
              />
            </div>
          ) : (
            <Table containerClassName="max-h-[62vh]">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="px-4 font-semibold">Supplier Code</TableHead>
                  <TableHead className="px-4 font-semibold">Supplier Name</TableHead>
                  <TableHead className="px-4 font-semibold">Type</TableHead>
                  <TableHead className="px-4 font-semibold">Contact</TableHead>
                  <TableHead className="px-4 font-semibold">Location</TableHead>
                  <TableHead className="px-4 font-semibold">Status</TableHead>
                  <TableHead className="px-4 text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSuppliers.map((supplier) => (
                  <TableRow key={supplier.supplier_id} className="hover:bg-slate-50">
                    <TableCell className="px-4 align-top">
                      <span className="font-mono text-xs font-semibold text-slate-700" title={supplierCode(supplier)}>
                        {shortSupplierCode(supplier)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 align-top">
                      <div className="font-medium text-slate-900">{supplier.supplier_name}</div>
                      <div className="mt-1 text-xs text-slate-500">Enrolled {formatDate(supplier.enrolled_dt)}</div>
                    </TableCell>
                    <TableCell className="px-4 align-top">{findLookupLabel(supplierTypeOptions, supplier.supplier_type)}</TableCell>
                    <TableCell className="px-4 align-top">
                      <div className="space-y-1">
                        <div className="text-sm text-slate-900">{formatValue(supplier.contact_name)}</div>
                        <div className="font-mono text-xs text-slate-500">{formatValue(supplier.contact_email)}</div>
                        <div className="text-xs text-slate-500">{formatValue(supplier.contact_phone)}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 align-top">
                      <div className="space-y-1">
                        <div className="text-sm text-slate-900">{formatValue(supplier.supplier_city)}</div>
                        <div className="text-xs text-slate-500">
                          {[supplier.supplier_state, findLookupLabel(countryOptions, supplier.supplier_country)]
                            .filter((value) => value && value !== "-")
                            .join(", ") || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 align-top">
                      <StatusBadge status="active" />
                    </TableCell>
                    <TableCell className="px-4 align-top text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => void openView(supplier.supplier_id)}>
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                        <PermissionGuard permission="SUPPLIER_UPDATE">
                          <Button type="button" variant="ghost" size="sm" onClick={() => void openEdit(supplier.supplier_id)} disabled={!canUpdateSupplier}>
                            <Edit3 className="h-4 w-4" />
                            Edit
                          </Button>
                        </PermissionGuard>
                        <PermissionGuard permission="SUPPLIER_DELETE">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => requestDelete(supplier)}
                            disabled={!canDeleteSupplier}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </PermissionGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      <SupplierPanel
        canDeleteSupplier={canDeleteSupplier}
        canUpdateSupplier={canUpdateSupplier}
        countryOptions={countryOptions}
        detailLoading={detailLoading}
        fieldErrors={fieldErrors}
        formData={formData}
        lookupError={lookupError}
        lookupLoading={lookupLoading}
        mode={panelMode}
        pendingDelete={pendingDelete}
        pendingDraft={pendingDraft}
        renderFieldError={renderFieldError}
        selectedSupplier={selectedSupplier}
        setFormData={setFormData}
        submitting={submitting}
        supplierTypeOptions={supplierTypeOptions}
        onCancelForm={handleCancelForm}
        onCancelDelete={() => setPendingDelete(null)}
        onClose={handlePanelClose}
        onConfirmDelete={() => void confirmDelete()}
        onDiscardDraft={() => {
          if (activeDraftKey) clearDraft(activeDraftKey);
          setPendingDraft(null);
        }}
        onRequestDelete={() => selectedSupplier && setPendingDelete(selectedSupplier)}
        onRestoreDraft={() => {
          if (pendingDraft) setFormData(pendingDraft);
          setPendingDraft(null);
        }}
        onSaveDraft={() => saveCurrentDraft({ force: true, toasts: true })}
        onSubmit={handleSubmit}
        onSwitchToEdit={switchToEdit}
      />

      <CsvImportModal<CreateSupplierPayload>
        open={importOpen}
        onClose={() => {
          if (submitting) return;
          setImportOpen(false);
          setImportInitialText(null);
        }}
        title="Import Suppliers"
        description="Upload a CSV file to create suppliers. Each row becomes one create request."
        expectedColumns={[
          { label: "Supplier Name", required: true },
          { label: "Type" },
          { label: "City" },
          { label: "State" },
          { label: "Contact Name" },
          { label: "Contact Email" },
          { label: "Contact Phone" },
        ]}
        initialCsvText={importInitialText ?? undefined}
        onPickFile={() => importFileRef.current?.click()}
        parseRow={(row) => {
          const supplierName = (row["Supplier Name"] ?? "").trim();
          if (!supplierName) {
            return { errors: ["Supplier Name is required"] };
          }

          return {
            errors: [],
            payload: {
              supplier_name: supplierName,
              created_by: currentActorId,
              supplier_type: optionalCsv(row["Type"]),
              supplier_city: optionalCsv(row["City"]),
              supplier_state: optionalCsv(row["State"]),
              contact_name: optionalCsv(row["Contact Name"]),
              contact_email: optionalCsv(row["Contact Email"]),
              contact_phone: optionalCsv(row["Contact Phone"]),
            },
          };
        }}
        onSubmitRow={async (payload) => {
          await createSupplier(payload);
        }}
        onAfterSubmit={reloadSuppliers}
      />

      <input
        ref={importFileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          try {
            const text = await file.text();
            setImportInitialText(text);
            setImportOpen(true);
          } catch {
            toast.error("Failed to read CSV file");
          }
        }}
      />

      <Toaster position="top-right" richColors />
    </div>
  );
}

interface SupplierPanelProps {
  canDeleteSupplier: boolean;
  canUpdateSupplier: boolean;
  countryOptions: LookupOption[];
  detailLoading: boolean;
  fieldErrors: FieldErrors;
  formData: SupplierFormState;
  lookupError: boolean;
  lookupLoading: boolean;
  mode: PanelMode;
  pendingDelete: SupplierRecord | null;
  pendingDraft: SupplierFormState | null;
  renderFieldError: (key: SupplierFormKey) => React.ReactNode;
  selectedSupplier: SupplierRecord | null;
  setFormData: React.Dispatch<React.SetStateAction<SupplierFormState>>;
  submitting: boolean;
  supplierTypeOptions: LookupOption[];
  onCancelForm: () => void;
  onCancelDelete: () => void;
  onClose: () => void;
  onConfirmDelete: () => void;
  onDiscardDraft: () => void;
  onRequestDelete: () => void;
  onRestoreDraft: () => void;
  onSaveDraft: () => void;
  onSubmit: (event: FormEvent) => void;
  onSwitchToEdit: () => void;
}

function SupplierPanel({
  canDeleteSupplier,
  canUpdateSupplier,
  countryOptions,
  detailLoading,
  fieldErrors,
  formData,
  lookupError,
  lookupLoading,
  mode,
  pendingDelete,
  pendingDraft,
  renderFieldError,
  selectedSupplier,
  setFormData,
  submitting,
  supplierTypeOptions,
  onCancelForm,
  onCancelDelete,
  onClose,
  onConfirmDelete,
  onDiscardDraft,
  onRequestDelete,
  onRestoreDraft,
  onSaveDraft,
  onSubmit,
  onSwitchToEdit,
}: SupplierPanelProps) {
  const isFormMode = mode === "create" || mode === "edit";
  const title = mode === "create" ? "Add Supplier" : mode === "edit" ? "Edit Supplier" : "Supplier details";
  const description = mode === "create"
    ? "Create supplier master data, contact, and address details."
    : mode === "edit"
      ? "Update supplier profile, contact, and address details."
      : "Review supplier master data and related evaluation navigation.";

  return (
    <RightPanel
      open={mode !== null}
      title={title}
      description={description}
      onClose={onClose}
      widthClassName="max-w-3xl"
      footer={
        isFormMode ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancelForm} disabled={submitting}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="button" variant="secondary" onClick={onSaveDraft} disabled={submitting}>
              Save Draft
            </Button>
            <Button type="submit" form="supplier-form" loading={submitting} disabled={detailLoading || lookupLoading || lookupError}>
              <Save className="h-4 w-4" />
              {mode === "create" ? "Create Supplier" : "Save Changes"}
            </Button>
          </div>
        ) : selectedSupplier ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigateToSupplierEvaluations(undefined, selectedSupplier.supplier_id)}>
              View Supplier Evaluations
            </Button>
            <PermissionGuard permission="SUPPLIER_UPDATE">
              <Button type="button" onClick={onSwitchToEdit} disabled={!canUpdateSupplier || detailLoading}>
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
            </PermissionGuard>
          </div>
        ) : null
      }
    >
      {detailLoading ? (
        <div className="py-10 text-center text-sm text-slate-500">Loading supplier...</div>
      ) : isFormMode ? (
        <SupplierForm
          fieldErrors={fieldErrors}
          formData={formData}
          lookupError={lookupError}
          lookupLoading={lookupLoading}
          mode={mode}
          countryOptions={countryOptions}
          supplierTypeOptions={supplierTypeOptions}
          renderFieldError={renderFieldError}
          setFormData={setFormData}
          onDiscardDraft={onDiscardDraft}
          onRestoreDraft={onRestoreDraft}
          onSubmit={onSubmit}
          pendingDraft={pendingDraft}
        />
      ) : selectedSupplier ? (
        <SupplierDetail
          canDeleteSupplier={canDeleteSupplier}
          countryOptions={countryOptions}
          pendingDelete={pendingDelete}
          selectedSupplier={selectedSupplier}
          submitting={submitting}
          supplierTypeOptions={supplierTypeOptions}
          onCancelDelete={onCancelDelete}
          onConfirmDelete={onConfirmDelete}
          onRequestDelete={onRequestDelete}
        />
      ) : (
        <EmptyState title="No supplier selected" description="Choose a supplier row to view details." />
      )}
    </RightPanel>
  );
}

interface SupplierFormProps {
  countryOptions: LookupOption[];
  fieldErrors: FieldErrors;
  formData: SupplierFormState;
  lookupError: boolean;
  lookupLoading: boolean;
  mode: SupplierFormMode;
  pendingDraft: SupplierFormState | null;
  renderFieldError: (key: SupplierFormKey) => React.ReactNode;
  setFormData: React.Dispatch<React.SetStateAction<SupplierFormState>>;
  supplierTypeOptions: LookupOption[];
  onDiscardDraft: () => void;
  onRestoreDraft: () => void;
  onSubmit: (event: FormEvent) => void;
}

function SupplierForm({
  countryOptions,
  fieldErrors,
  formData,
  lookupError,
  lookupLoading,
  mode,
  pendingDraft,
  renderFieldError,
  setFormData,
  supplierTypeOptions,
  onDiscardDraft,
  onRestoreDraft,
  onSubmit,
}: SupplierFormProps) {
  return (
    <form id="supplier-form" className="space-y-5" onSubmit={onSubmit}>
      {pendingDraft ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="min-w-48 flex-1">
            <div className="font-semibold">You have an unsaved supplier draft. Restore it?</div>
            <div className="text-xs opacity-80">Restoring replaces the current form values.</div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onDiscardDraft}>
            Discard
          </Button>
          <Button type="button" size="sm" onClick={onRestoreDraft}>
            Restore
          </Button>
        </div>
      ) : null}

      {lookupError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Dropdown values could not be loaded. Try reopening the panel.
        </div>
      ) : null}

      <PanelSection title="Profile">
        <div className="grid gap-4 md:grid-cols-2">
          <ReadOnlyField label="Supplier Code" value={mode === "create" ? "Generated after save" : "System generated"} />
          <div className="space-y-1">
            <Input
              label="Supplier Name"
              value={formData.supplier_name}
              onChange={(event) => setFormData((previous) => ({ ...previous, supplier_name: event.target.value }))}
              required
            />
            {renderFieldError("supplier_name")}
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">Supplier Type / Classification</label>
            <select
              className={selectClassName}
              value={formData.supplier_type}
              onChange={(event) => setFormData((previous) => ({ ...previous, supplier_type: event.target.value }))}
              disabled={lookupLoading || lookupError}
            >
              <option value="">Select supplier type</option>
              {supplierTypeOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.value}
                </option>
              ))}
            </select>
            {renderFieldError("supplier_type")}
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Contact">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Input
              label="Contact Person"
              value={formData.contact_name}
              onChange={(event) => setFormData((previous) => ({ ...previous, contact_name: event.target.value }))}
            />
            {renderFieldError("contact_name")}
          </div>
          <div className="space-y-1">
            <Input
              label="Email"
              type="email"
              value={formData.contact_email}
              onChange={(event) => setFormData((previous) => ({ ...previous, contact_email: event.target.value }))}
            />
            {renderFieldError("contact_email")}
          </div>
          <div className="space-y-1">
            <Input
              label="Phone"
              value={formData.contact_phone}
              onChange={(event) => setFormData((previous) => ({ ...previous, contact_phone: event.target.value }))}
            />
            {renderFieldError("contact_phone")}
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Address">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <Input
              label="Address Line 1"
              value={formData.supplier_add1}
              onChange={(event) => setFormData((previous) => ({ ...previous, supplier_add1: event.target.value }))}
            />
            {renderFieldError("supplier_add1")}
          </div>
          <div className="space-y-1 md:col-span-2">
            <Input
              label="Address Line 2"
              value={formData.supplier_add2}
              onChange={(event) => setFormData((previous) => ({ ...previous, supplier_add2: event.target.value }))}
            />
            {renderFieldError("supplier_add2")}
          </div>
          <div className="space-y-1">
            <Input
              label="City"
              value={formData.supplier_city}
              onChange={(event) => setFormData((previous) => ({ ...previous, supplier_city: event.target.value }))}
            />
            {renderFieldError("supplier_city")}
          </div>
          <div className="space-y-1">
            <Input
              label="State"
              value={formData.supplier_state}
              onChange={(event) => setFormData((previous) => ({ ...previous, supplier_state: event.target.value }))}
            />
            {renderFieldError("supplier_state")}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Country</label>
            <select
              className={selectClassName}
              value={formData.supplier_country}
              onChange={(event) => setFormData((previous) => ({ ...previous, supplier_country: event.target.value }))}
              disabled={lookupLoading || lookupError}
            >
              <option value="">Select country</option>
              {countryOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.value}
                </option>
              ))}
            </select>
            {renderFieldError("supplier_country")}
          </div>
          <div className="space-y-1">
            <Input
              label="Postal Code"
              value={formData.supplier_pincode}
              onChange={(event) => setFormData((previous) => ({ ...previous, supplier_pincode: event.target.value }))}
            />
            {renderFieldError("supplier_pincode")}
          </div>
        </div>
      </PanelSection>

      {fieldErrors.form ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{fieldErrors.form}</div> : null}
    </form>
  );
}

interface SupplierDetailProps {
  canDeleteSupplier: boolean;
  countryOptions: LookupOption[];
  pendingDelete: SupplierRecord | null;
  selectedSupplier: SupplierRecord;
  submitting: boolean;
  supplierTypeOptions: LookupOption[];
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onRequestDelete: () => void;
}

function SupplierDetail({
  canDeleteSupplier,
  countryOptions,
  pendingDelete,
  selectedSupplier,
  submitting,
  supplierTypeOptions,
  onCancelDelete,
  onConfirmDelete,
  onRequestDelete,
}: SupplierDetailProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="font-mono text-xs font-semibold text-slate-500">{supplierCode(selectedSupplier)}</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{selectedSupplier.supplier_name}</h3>
            <p className="mt-1 text-sm text-slate-500">{findLookupLabel(supplierTypeOptions, selectedSupplier.supplier_type)}</p>
          </div>
          <StatusBadge status="active" />
        </div>
      </div>

      {pendingDelete ? (
        <ConfirmStrip
          tone="danger"
          title={`Delete ${selectedSupplier.supplier_name}?`}
          message="This uses the existing supplier delete API and cannot be undone from this page."
          confirmLabel={submitting ? "Deleting..." : "Delete Supplier"}
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
          disabled={submitting}
        />
      ) : null}

      <PanelSection title="Profile">
        <DetailGrid
          items={[
            ["Supplier Code", supplierCode(selectedSupplier)],
            ["Supplier Name", selectedSupplier.supplier_name],
            ["Supplier Type", findLookupLabel(supplierTypeOptions, selectedSupplier.supplier_type)],
            ["Status", "Active"],
            ["Enrolled Date", formatDate(selectedSupplier.enrolled_dt)],
            ["Created By", selectedSupplier.created_by ?? "-"],
            ["Modified By", selectedSupplier.modified_by ?? "-"],
          ]}
        />
      </PanelSection>

      <PanelSection title="Contact">
        <DetailGrid
          items={[
            ["Contact Person", selectedSupplier.contact_name ?? "-"],
            ["Email", selectedSupplier.contact_email ?? "-"],
            ["Phone", selectedSupplier.contact_phone ?? "-"],
          ]}
        />
      </PanelSection>

      <PanelSection title="Address">
        <DetailGrid
          items={[
            ["Address Line 1", selectedSupplier.supplier_add1 ?? "-"],
            ["Address Line 2", selectedSupplier.supplier_add2 ?? "-"],
            ["City", selectedSupplier.supplier_city ?? "-"],
            ["State", selectedSupplier.supplier_state ?? "-"],
            ["Country", findLookupLabel(countryOptions, selectedSupplier.supplier_country)],
            ["Postal Code", selectedSupplier.supplier_pincode ?? "-"],
          ]}
        />
      </PanelSection>

      <PanelSection title="Evaluations">
        <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">Evaluation history is managed in Supplier Evaluations.</p>
          <Button type="button" variant="secondary" onClick={() => navigateToSupplierEvaluations(undefined, selectedSupplier.supplier_id)}>
            View Supplier Evaluations
          </Button>
        </div>
      </PanelSection>

      <PermissionGuard permission="SUPPLIER_DELETE">
        <div className="border-t border-slate-200 pt-4">
          <Button
            type="button"
            variant="destructive"
            onClick={onRequestDelete}
            disabled={!canDeleteSupplier || submitting}
          >
            <Trash2 className="h-4 w-4" />
            Delete Supplier
          </Button>
        </div>
      </PermissionGuard>
    </div>
  );
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailGrid({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-1 break-words text-sm font-medium text-slate-900">{value || "-"}</div>
        </div>
      ))}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-slate-700">{label}</div>
      <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
        {value}
      </div>
    </div>
  );
}
