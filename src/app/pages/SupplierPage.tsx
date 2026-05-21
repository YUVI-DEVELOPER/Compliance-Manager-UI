import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast, Toaster } from "sonner";
import { Card, CardBody, CardFooter } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { ConfirmDialog, Modal } from "../components/ui/Modal";
import { RestoreDraftDialog } from "../components/ui/RestoreDraftDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import { clearDraft, isShallowDirtyTrimmed, loadDraft, saveDraft } from "../utils/draftStorage";
import {
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/Table";
import {
  CreateSupplierPayload,
  SupplierRecord,
  UpdateSupplierPayload,
  createSupplier,
  deleteSupplier,
  exportAllSuppliers,
  getSupplierById,
  getSuppliers,
  searchSuppliers,
  updateSupplier,
} from "../../services/supplier.service";
import { LookupOption, getLookupOptionsByMasterCode } from "../services/lookupValue.service";
import { CsvImportModal } from "../components/importExport/CsvImportModal";
import { downloadCsv } from "../components/importExport/csv";
import { SupplierDetailDrawer } from "../components/suppliers/SupplierDetailDrawer";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { useAuth } from "../auth/useAuth";

interface FieldErrors {
  [key: string]: string;
}

interface SupplierFormState {
  supplier_name: string;
  supplier_type: string;
  supplier_add1: string;
  supplier_add2: string;
  supplier_city: string;
  supplier_pincode: string;
  supplier_state: string;
  supplier_country: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  [key: string]: string;
}

type SupplierFormMode = "add" | "edit";

const CURRENT_USER_ID = "00000000-0000-0000-0000-000000000001";
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
          fieldErrors[field] = msg ?? "Invalid value";
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

const buildCreatePayload = (form: SupplierFormState): CreateSupplierPayload => ({
  supplier_name: form.supplier_name.trim(),
  created_by: CURRENT_USER_ID,
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

const buildUpdatePayload = (initial: SupplierFormState, current: SupplierFormState): UpdateSupplierPayload => {
  const payload: UpdateSupplierPayload = {};
  const keys = Object.keys(current) as (keyof SupplierFormState)[];

  keys.forEach((key) => {
    const initialValue = initial[key].trim();
    const currentValue = current[key].trim();
    if (initialValue !== currentValue) {
      const normalized = normalizeOptional(current[key]);
      if (normalized !== undefined) {
        payload[key as keyof UpdateSupplierPayload] = normalized;
      }
    }
  });

  if (Object.keys(payload).length > 0) {
    payload.modified_by = CURRENT_USER_ID;
  }

  return payload;
};

export function SupplierPage() {
  const { hasPermission } = useAuth();
  const canCreateSupplier = hasPermission("SUPPLIER_CREATE");
  const canUpdateSupplier = hasPermission("SUPPLIER_UPDATE");
  const canDeleteSupplier = hasPermission("SUPPLIER_DELETE");
  const canExportReport = hasPermission("REPORT_EXPORT");
  const header = getPageHeaderConfig("supplier");
  const [search, setSearch] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<SupplierFormMode>("add");
  const [formLoading, setFormLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [supplierTypeOptions, setSupplierTypeOptions] = useState<LookupOption[]>([]);
  const [countryOptions, setCountryOptions] = useState<LookupOption[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formData, setFormData] = useState<SupplierFormState>(EMPTY_FORM);
  const [initialFormData, setInitialFormData] = useState<SupplierFormState>(EMPTY_FORM);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [restoreDraftOpen, setRestoreDraftOpen] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<SupplierFormState | null>(null);
  const restoreDraftKey = useRef<string | null>(null);

const [showDelete, setShowDelete] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupplierRecord | null>(null);

  const [showSupplierDetail, setShowSupplierDetail] = useState(false);
  const [detailSupplierId, setDetailSupplierId] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importInitialText, setImportInitialText] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  const requestSeq = useRef(0);
  const didInitSearch = useRef(false);
  const lookupSeq = useRef(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(suppliers.length / PAGE_SIZE)), [suppliers.length]);
  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return suppliers.slice(start, start + PAGE_SIZE);
  }, [page, suppliers]);

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

  useEffect(() => {
    void reloadSuppliers();
  }, [reloadSuppliers]);

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
    if (!showForm) return;

    const seq = ++lookupSeq.current;
    setLookupLoading(true);
    setLookupError(false);
    setSupplierTypeOptions([]);
    setCountryOptions([]);

    const run = async () => {
      try {
        if (seq !== lookupSeq.current) return;
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
    };

    void run();
  }, [showForm]);

  const activeDraftKey = useMemo(() => {
    if (formMode === "add") return "draft_supplier_create";
    return selectedSupplierId ? `draft_supplier_edit_${selectedSupplierId}` : null;
  }, [formMode, selectedSupplierId]);

  const draftBaseline = useMemo(() => (formMode === "add" ? EMPTY_FORM : initialFormData), [formMode, initialFormData]);

  const isDraftDirty = useMemo(
    () => isShallowDirtyTrimmed(formData, draftBaseline),
    [draftBaseline, formData],
  );

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

  const handleRequestClose = useCallback(() => {
    if (submitting) return;
    saveCurrentDraft();
    setShowForm(false);
  }, [saveCurrentDraft, submitting]);

  const handleCancel = useCallback(() => {
    if (submitting) return;
    discardCurrentDraft();
    setShowForm(false);
  }, [discardCurrentDraft, submitting]);

  useEffect(() => {
    if (!showForm) {
      restoreDraftKey.current = null;
      setRestoreDraftOpen(false);
      setPendingDraft(null);
      return;
    }

    if (!activeDraftKey) return;
    if (formMode === "edit" && formLoading) return;
    if (restoreDraftKey.current === activeDraftKey) return;

    restoreDraftKey.current = activeDraftKey;
    const draft = loadDraft<SupplierFormState>(activeDraftKey);
    if (draft) {
      setPendingDraft(draft);
      setRestoreDraftOpen(true);
    }
  }, [activeDraftKey, formLoading, formMode, showForm]);

  const openCreate = () => {
    if (!canCreateSupplier) return;
    setFieldErrors({});
    setFormMode("add");
    setSelectedSupplierId(null);
    setFormData(EMPTY_FORM);
    setInitialFormData(EMPTY_FORM);
    setShowForm(true);
  };

const openEdit = async (supplierId: string) => {
    if (!canUpdateSupplier) return;
    setFieldErrors({});
    setFormMode("edit");
    setSelectedSupplierId(supplierId);
    setShowForm(true);
    setFormLoading(true);
    try {
      const record = await getSupplierById(supplierId);
      const nextForm = recordToForm(record);
      setFormData(nextForm);
      setInitialFormData(nextForm);
    } catch (error) {
      const mapped = mapAxiosError(error);
      toast.error(mapped.message);
      setShowForm(false);
    } finally {
      setFormLoading(false);
    }
  };

  const openView = (supplierId: string) => {
    setDetailSupplierId(supplierId);
    setShowSupplierDetail(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (lookupError) return;

    setFieldErrors({});

    if (!formData.supplier_name.trim()) {
      setFieldErrors({ supplier_name: "Supplier name is required" });
      return;
    }

    setSubmitting(true);
    try {
      if (formMode === "add") {
        await createSupplier(buildCreatePayload(formData));
        toast.success("Supplier created successfully");
      } else {
        if (!selectedSupplierId) {
          toast.error("Missing supplier id");
          return;
        }
        const payload = buildUpdatePayload(initialFormData, formData);
        if (Object.keys(payload).length === 0) {
          toast.message("No changes to save");
        } else {
          await updateSupplier(selectedSupplierId, payload);
          toast.success("Supplier updated successfully");
        }
      }

      if (activeDraftKey) clearDraft(activeDraftKey);
      setShowForm(false);
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
    setDeleteTarget(supplier);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (submitting) return;
    setSubmitting(true);
    try {
      await deleteSupplier(deleteTarget.supplier_id);
      setSuppliers((previous) => previous.filter((item) => item.supplier_id !== deleteTarget.supplier_id));
      toast.success("Supplier deleted successfully");
      setShowDelete(false);
      setDeleteTarget(null);
    } catch (error) {
      const mapped = mapAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderError = (key: keyof SupplierFormState) =>
    fieldErrors[key] ? <p className="text-xs text-red-600">{fieldErrors[key]}</p> : null;

  const optionalCsv = (value: string | undefined): string | undefined => {
    const trimmed = (value ?? "").trim();
    return trimmed.length ? trimmed : undefined;
  };

  const handleExport = async () => {
    if (!canExportReport) return;
    try {
      // Fetch ALL supplier data from the export endpoint
      const allSuppliers = await exportAllSuppliers();

      if (!allSuppliers || allSuppliers.length === 0) {
        toast.error("No suppliers to export");
        return;
      }

      // Get all keys from the first object to use as headers
      const firstRecord = allSuppliers[0];
      const headers = Object.keys(firstRecord);

      // Extract all values for each record
      const rows = allSuppliers.map((supplier) =>
        headers.map((key) => {
          const value = (supplier as unknown as Record<string, unknown>)[key];
          return value === null || value === undefined ? "" : String(value);
        })
      );

      downloadCsv(`suppliers-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      toast.success(`Exported ${allSuppliers.length} suppliers`);
    } catch (error) {
      const mapped = mapAxiosError(error);
      toast.error(mapped.message);
    }
  };

  const headerStats = buildPageHeaderStats(header.stats, {
    total: suppliers.length,
    filtered: suppliers.length,
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
          disabled: loadingList,
        } : undefined}
        stats={headerStats}
        primaryAction={header.primaryAction && canCreateSupplier ? { ...header.primaryAction, onClick: openCreate, disabled: loadingList } : undefined}
        secondaryActions={[
          ...(canCreateSupplier ? [{
            ...(header.secondaryActions?.[0] ?? { key: "import", label: "Import", variant: "secondary" }),
            onClick: () => setImportOpen(true),
            disabled: loadingList,
          }] : []),
          ...(canExportReport ? [{
            ...(header.secondaryActions?.[1] ?? { key: "export", label: "Export", variant: "secondary" }),
            onClick: () => void handleExport(),
            disabled: loadingList || suppliers.length === 0,
          }] : []),
          {
            ...(header.secondaryActions?.[2] ?? { key: "reload", label: "Reload", variant: "ghost" }),
            onClick: () => void reloadSuppliers(),
            disabled: loadingList,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <Card>
          <CardBody className="space-y-4 pt-6">
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supplier Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Contact Name</TableHead>
                    <TableHead>Contact Email</TableHead>
                    <TableHead>Contact Phone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSuppliers.map((supplier) => (
                    <TableRow key={supplier.supplier_id}>
                      <TableCell className="font-medium text-slate-900">{supplier.supplier_name}</TableCell>
                      <TableCell>{supplier.supplier_type ?? "-"}</TableCell>
                      <TableCell>{supplier.supplier_city ?? "-"}</TableCell>
                      <TableCell>{supplier.supplier_state ?? "-"}</TableCell>
                      <TableCell>{supplier.contact_name ?? "-"}</TableCell>
                      <TableCell className="font-mono text-xs">{supplier.contact_email ?? "-"}</TableCell>
                      <TableCell>{supplier.contact_phone ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openView(supplier.supplier_id)}
                            title="View"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </Button>
                          {canUpdateSupplier ? <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void openEdit(supplier.supplier_id)}
                            title="Edit"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </Button> : null}
                          {canDeleteSupplier ? <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => requestDelete(supplier)}
                            title="Delete"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </Button> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}

                  {!loadingList && paginatedSuppliers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-slate-500 py-8">
                        {search.trim() ? "No suppliers found for this search." : "No suppliers found."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardBody>

          <CardFooter className="justify-between">
            <div className="text-sm text-slate-500">
              Total: <span className="font-medium text-slate-700">{suppliers.length}</span>
            </div>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </CardFooter>
        </Card>
      </div>

      <Modal
        open={showForm}
        onClose={handleRequestClose}
        title={formMode === "add" ? "Create Supplier" : "Edit Supplier"}
        description={formMode === "add" ? "Enter supplier details." : "Update supplier details (only changed fields are sent)."}
        size="lg"
        closeButtonTooltip="Close and save progress as draft"
        footer={
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button type="button" variant="ghost" disabled={submitting} onClick={handleCancel}>
                  Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Discard changes and close the form</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={() => saveCurrentDraft({ force: true, toasts: true })}
                >
                  Save Draft
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Save current progress without submitting</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                  form="supplier-form"
                  loading={submitting}
                  disabled={formLoading || submitting || lookupLoading || lookupError}
                >
                  {formMode === "add" ? "Create" : "Save"}
                </Button>
              </TooltipTrigger>
              <TooltipContent sideOffset={6}>Create record and save to database</TooltipContent>
            </Tooltip>
          </>
        }
      >
        {formLoading ? (
          <div className="text-sm text-slate-600">Loading supplier...</div>
        ) : (
          <form id="supplier-form" className="grid grid-cols-2 gap-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-1">
              <Input
                label="Supplier Name"
                value={formData.supplier_name}
                onChange={(event) => setFormData((previous) => ({ ...previous, supplier_name: event.target.value }))}
                required
              />
              {renderError("supplier_name")}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Supplier Type</label>
              <select
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background disabled:opacity-50 disabled:cursor-not-allowed"
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
              {renderError("supplier_type")}
            </div>

            <div className="col-span-2 space-y-1">
              <Input
                label="Address Line 1"
                value={formData.supplier_add1}
                onChange={(event) => setFormData((previous) => ({ ...previous, supplier_add1: event.target.value }))}
              />
              {renderError("supplier_add1")}
            </div>

            <div className="col-span-2 space-y-1">
              <Input
                label="Address Line 2"
                value={formData.supplier_add2}
                onChange={(event) => setFormData((previous) => ({ ...previous, supplier_add2: event.target.value }))}
              />
              {renderError("supplier_add2")}
            </div>

            <div className="space-y-1">
              <Input
                label="City"
                value={formData.supplier_city}
                onChange={(event) => setFormData((previous) => ({ ...previous, supplier_city: event.target.value }))}
              />
              {renderError("supplier_city")}
            </div>

            <div className="space-y-1">
              <Input
                label="Pincode"
                value={formData.supplier_pincode}
                onChange={(event) => setFormData((previous) => ({ ...previous, supplier_pincode: event.target.value }))}
              />
              {renderError("supplier_pincode")}
            </div>

            <div className="space-y-1">
              <Input
                label="State"
                value={formData.supplier_state}
                onChange={(event) => setFormData((previous) => ({ ...previous, supplier_state: event.target.value }))}
              />
              {renderError("supplier_state")}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700">Country</label>
              <select
                className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background disabled:opacity-50 disabled:cursor-not-allowed"
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
              {renderError("supplier_country")}
            </div>

            <div className="space-y-1">
              <Input
                label="Contact Name"
                value={formData.contact_name}
                onChange={(event) => setFormData((previous) => ({ ...previous, contact_name: event.target.value }))}
              />
              {renderError("contact_name")}
            </div>

            <div className="space-y-1">
              <Input
                label="Contact Email"
                type="email"
                value={formData.contact_email}
                onChange={(event) => setFormData((previous) => ({ ...previous, contact_email: event.target.value }))}
              />
              {renderError("contact_email")}
            </div>

            <div className="space-y-1">
              <Input
                label="Contact Phone"
                value={formData.contact_phone}
                onChange={(event) => setFormData((previous) => ({ ...previous, contact_phone: event.target.value }))}
              />
              {renderError("contact_phone")}
            </div>
          </form>
        )}
      </Modal>

      <RestoreDraftDialog
        open={restoreDraftOpen}
        onDiscard={() => {
          if (!activeDraftKey) return;
          clearDraft(activeDraftKey);
          setPendingDraft(null);
          setRestoreDraftOpen(false);
        }}
        onRestore={() => {
          if (pendingDraft) setFormData(pendingDraft);
          setRestoreDraftOpen(false);
        }}
      />

      <ConfirmDialog
        open={showDelete}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!submitting) setShowDelete(false);
        }}
        title="Delete this supplier?"
        message={`"${deleteTarget?.supplier_name ?? "Selected supplier"}" will be permanently removed.`}
        confirmLabel={submitting ? "Deleting..." : "Delete Supplier"}
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
        parseRow={(row, rowNumber) => {
          const supplierName = (row["Supplier Name"] ?? "").trim();
          if (!supplierName) {
            return { errors: ["Supplier Name is required"] };
          }

          return {
            errors: [],
            payload: {
              supplier_name: supplierName,
              created_by: CURRENT_USER_ID,
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

      <SupplierDetailDrawer
        open={showSupplierDetail}
        supplierId={detailSupplierId}
        onClose={() => {
          setShowSupplierDetail(false);
          setDetailSupplierId(null);
        }}
      />
    </div>
  );
}
