import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "../../auth/PermissionGuard";
import { LookupOption, getLookupOptionsByMasterCode } from "../../services/lookupValue.service";
import {
  OrgRole,
  OrgRoleAction,
  OrgRoleActionPayload,
  OrgRoleDetail,
  OrgRolePayload,
  createOrgRole,
  createOrgRoleAction,
  deleteOrgRole,
  deleteOrgRoleAction,
  getOrgRoleById,
  getOrgRoles,
  updateOrgRole,
  updateOrgRoleAction,
} from "../../../services/org-role.service";
import { ConfirmStrip, EmptyState, StatusBadge } from "../foundation";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input, SearchInput } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";
import { buildLookupLabelMap, getLookupLabel } from "./orgUiLabels";

interface RoleFormState {
  role_name: string;
  role_raci: string;
  ownership: string;
  role_type: string;
  is_active: string;
}

interface ActionFormState {
  seq: string;
  action_type: string;
  action: string;
}

interface FieldErrors {
  [key: string]: string;
}

interface OrgRoleCatalogAdminProps {
  disabled?: boolean;
  actorName?: string | null;
  defaultUser?: string | null;
  onCatalogSummaryChange?: (summary: {
    totalRoles: number;
    activeRoles: number;
    activeAssignments: number;
    standardActivities: number;
  }) => void;
}

type EditorMode = "detail" | "roleForm" | "actionForm";

const EMPTY_ROLE_FORM: RoleFormState = {
  role_name: "",
  role_raci: "",
  ownership: "",
  role_type: "",
  is_active: "true",
};

const EMPTY_ACTION_FORM: ActionFormState = {
  seq: "",
  action_type: "",
  action: "",
};

const raciClasses: Record<string, string> = {
  RESPONSIBLE: "border-blue-200 bg-blue-50 text-blue-700",
  ACCOUNTABLE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CONSULTED: "border-amber-200 bg-amber-50 text-amber-700",
  INFORMED: "border-slate-200 bg-slate-100 text-slate-700",
};

const roleTypeClasses: Record<string, string> = {
  BUSINESS: "border-blue-200 bg-blue-50 text-blue-700",
  COMPLIANCE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OPERATIONS: "border-amber-200 bg-amber-50 text-amber-700",
  SECURITY: "border-rose-200 bg-rose-50 text-rose-700",
  TECHNOLOGY: "border-violet-200 bg-violet-50 text-violet-700",
};

const extractMessage = (error: unknown): string => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : "Unexpected error occurred";
  }

  const data = error.response?.data as { message?: string; detail?: unknown } | undefined;
  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  return error.message || "Request failed";
};

const toRoleForm = (role?: OrgRole | OrgRoleDetail | null): RoleFormState =>
  role
    ? {
        role_name: role.role_name ?? "",
        role_raci: role.role_raci ?? "",
        ownership: role.ownership ?? "",
        role_type: role.role_type ?? "",
        is_active: role.is_active ? "true" : "false",
      }
    : { ...EMPTY_ROLE_FORM };

const toActionForm = (action?: OrgRoleAction | null): ActionFormState =>
  action
    ? {
        seq: String(action.seq),
        action_type: action.action_type ?? "",
        action: action.action ?? "",
      }
    : { ...EMPTY_ACTION_FORM };

const GovernanceBadge = ({
  value,
  label,
  palette,
}: {
  value?: string | null;
  label: string;
  palette: Record<string, string>;
}) => {
  if (!value) return null;

  return (
    <Badge variant="outline" className={cn("uppercase", palette[value.toUpperCase()] ?? "border-slate-200 bg-slate-100 text-slate-700")}>
      {label}
    </Badge>
  );
};

function FormField({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function OrgRoleCatalogAdmin({
  disabled = false,
  actorName,
  defaultUser,
  onCatalogSummaryChange,
}: OrgRoleCatalogAdminProps) {
  const auditActor = actorName ?? defaultUser ?? null;
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<OrgRoleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("detail");
  const [editingRole, setEditingRole] = useState<OrgRole | OrgRoleDetail | null>(null);
  const [editingAction, setEditingAction] = useState<OrgRoleAction | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<OrgRoleDetail | null>(null);
  const [actionToDelete, setActionToDelete] = useState<OrgRoleAction | null>(null);
  const [roleForm, setRoleForm] = useState<RoleFormState>(EMPTY_ROLE_FORM);
  const [actionForm, setActionForm] = useState<ActionFormState>(EMPTY_ACTION_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [searchInput, setSearchInput] = useState("");
  const [roleRaciOptions, setRoleRaciOptions] = useState<LookupOption[]>([]);
  const [roleTypeOptions, setRoleTypeOptions] = useState<LookupOption[]>([]);
  const [actionTypeOptions, setActionTypeOptions] = useState<LookupOption[]>([]);

  const loadRoles = useCallback(async (preferredRoleId?: string | null) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getOrgRoles();
      setRoles(data);
      const candidateRoleId = preferredRoleId ?? selectedRoleId ?? null;
      const targetRoleId = candidateRoleId && data.some((role) => role.id === candidateRoleId)
        ? candidateRoleId
        : data[0]?.id ?? null;
      setSelectedRoleId(targetRoleId);
    } catch (loadError) {
      setError(extractMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  const loadSelectedRole = useCallback(async () => {
    if (!selectedRoleId) {
      setSelectedRole(null);
      return;
    }

    setDetailLoading(true);
    try {
      const detail = await getOrgRoleById(selectedRoleId);
      setSelectedRole(detail);
    } catch (loadError) {
      setError(extractMessage(loadError));
    } finally {
      setDetailLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    if (disabled) return;
    void loadRoles(null);
  }, [disabled, loadRoles]);

  useEffect(() => {
    if (disabled) return;
    void loadSelectedRole();
  }, [disabled, loadSelectedRole]);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const [raci, roleTypes, actionTypes] = await Promise.all([
          getLookupOptionsByMasterCode("ORG_ROLE_RACI"),
          getLookupOptionsByMasterCode("ORG_ROLE_TYPE"),
          getLookupOptionsByMasterCode("ORG_ROLE_ACTION_TYPE"),
        ]);
        if (cancelled) return;
        setRoleRaciOptions(raci);
        setRoleTypeOptions(roleTypes);
        setActionTypeOptions(actionTypes);
      } catch (loadError) {
        if (!cancelled) setError(extractMessage(loadError));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [disabled]);

  const sortedRoles = useMemo(
    () => [...roles].sort((left, right) => left.role_name.localeCompare(right.role_name)),
    [roles],
  );
  const filteredRoles = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    if (!query) return sortedRoles;
    return sortedRoles.filter((role) =>
      [role.role_name, role.role_type, role.role_raci, role.ownership]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [searchInput, sortedRoles]);
  const roleRaciLabelMap = useMemo(() => buildLookupLabelMap(roleRaciOptions), [roleRaciOptions]);
  const roleTypeLabelMap = useMemo(() => buildLookupLabelMap(roleTypeOptions), [roleTypeOptions]);
  const actionTypeLabelMap = useMemo(() => buildLookupLabelMap(actionTypeOptions), [actionTypeOptions]);
  const catalogSummary = useMemo(() => ({
    totalRoles: roles.length,
    activeRoles: roles.filter((role) => role.is_active && !role.is_deleted).length,
    activeAssignments: roles.reduce((sum, role) => sum + role.active_assignment_count, 0),
    standardActivities: roles.reduce((sum, role) => sum + role.action_count, 0),
  }), [roles]);
  const resolveRoleRaciLabel = useCallback((code: string) => getLookupLabel(code, roleRaciLabelMap), [roleRaciLabelMap]);
  const resolveRoleTypeLabel = useCallback((code: string) => getLookupLabel(code, roleTypeLabelMap), [roleTypeLabelMap]);
  const resolveActionTypeLabel = useCallback((code: string) => getLookupLabel(code, actionTypeLabelMap), [actionTypeLabelMap]);

  useEffect(() => {
    onCatalogSummaryChange?.(catalogSummary);
  }, [catalogSummary, onCatalogSummaryChange]);

  const selectRole = (roleId: string): void => {
    setSelectedRoleId(roleId);
    setEditorMode("detail");
    setFieldErrors({});
    setRoleToDelete(null);
    setActionToDelete(null);
  };

  const openCreateRole = (): void => {
    setEditingRole(null);
    setFieldErrors({});
    setRoleForm({
      ...EMPTY_ROLE_FORM,
      role_raci: roleRaciOptions[0]?.code ?? "",
      role_type: roleTypeOptions[0]?.code ?? "",
    });
    setEditorMode("roleForm");
  };

  const openEditRole = (): void => {
    if (!selectedRole) return;
    setEditingRole(selectedRole);
    setFieldErrors({});
    setRoleForm(toRoleForm(selectedRole));
    setEditorMode("roleForm");
  };

  const openCreateAction = (): void => {
    if (!selectedRole) return;
    const nextSeq = Math.max(0, ...(selectedRole.actions ?? []).map((action) => action.seq)) + 1;
    setEditingAction(null);
    setFieldErrors({});
    setActionForm({
      seq: String(nextSeq),
      action_type: actionTypeOptions[0]?.code ?? "",
      action: "",
    });
    setEditorMode("actionForm");
  };

  const openEditAction = (action: OrgRoleAction): void => {
    setEditingAction(action);
    setFieldErrors({});
    setActionForm(toActionForm(action));
    setEditorMode("actionForm");
  };

  const validateRoleForm = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!roleForm.role_name.trim()) nextErrors.role_name = "Role name is required";
    if (!roleForm.role_raci) nextErrors.role_raci = "RACI category is required";
    if (!roleForm.ownership.trim()) nextErrors.ownership = "Owning function is required";
    if (!roleForm.role_type) nextErrors.role_type = "Role category is required";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateActionForm = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!actionForm.seq.trim() || Number.isNaN(Number(actionForm.seq)) || Number(actionForm.seq) < 1) {
      nextErrors.seq = "Sequence must be a positive number";
    }
    if (!actionForm.action_type) nextErrors.action_type = "Activity category is required";
    if (!actionForm.action.trim()) nextErrors.action = "Activity summary is required";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRoleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (disabled || submitting) return;
    if (!validateRoleForm()) return;

    setSubmitting(true);
    setError(null);

    const payload: OrgRolePayload = {
      role_name: roleForm.role_name.trim(),
      role_raci: roleForm.role_raci,
      ownership: roleForm.ownership.trim(),
      role_type: roleForm.role_type,
      is_active: roleForm.is_active === "true",
      ...(editingRole ? { modified_by: auditActor } : { created_by: auditActor }),
    };

    try {
      const saved = editingRole
        ? await updateOrgRole(editingRole.id, payload)
        : await createOrgRole(payload);
      toast.success(editingRole ? "Governance role updated" : "Governance role created");
      setEditorMode("detail");
      setEditingRole(null);
      await loadRoles(saved.id);
      setSelectedRole(await getOrgRoleById(saved.id));
    } catch (submitError) {
      const message = extractMessage(submitError);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleActionSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedRole || disabled || submitting) return;
    if (!validateActionForm()) return;

    setSubmitting(true);
    setError(null);

    const payload: OrgRoleActionPayload = {
      seq: Number(actionForm.seq),
      action_type: actionForm.action_type,
      action: actionForm.action.trim(),
      ...(editingAction ? { modified_by: auditActor } : { created_by: auditActor }),
    };

    try {
      if (editingAction) {
        await updateOrgRoleAction(editingAction.id, payload);
        toast.success("Governance activity updated");
      } else {
        await createOrgRoleAction(selectedRole.id, payload);
        toast.success("Governance activity created");
      }
      setEditorMode("detail");
      setEditingAction(null);
      await Promise.all([loadRoles(selectedRole.id), loadSelectedRole()]);
    } catch (submitError) {
      const message = extractMessage(submitError);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRole = async (): Promise<void> => {
    if (!roleToDelete || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await deleteOrgRole(roleToDelete.id, auditActor);
      toast.success("Governance role removed");
      setRoleToDelete(null);
      setSelectedRole(null);
      setSelectedRoleId(null);
      setEditorMode("detail");
      await loadRoles(null);
    } catch (deleteError) {
      const message = extractMessage(deleteError);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAction = async (): Promise<void> => {
    if (!actionToDelete || !selectedRole || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await deleteOrgRoleAction(actionToDelete.id);
      toast.success("Governance activity removed");
      setActionToDelete(null);
      await Promise.all([loadRoles(selectedRole.id), loadSelectedRole()]);
    } catch (deleteError) {
      const message = extractMessage(deleteError);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderRoleForm = () => (
    <form className="space-y-4" onSubmit={(event) => void handleRoleSubmit(event)}>
      <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {editingRole ? "Edit Governance Role" : "Create Governance Role"}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Reusable org responsibility catalog. This is separate from system RBAC roles.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField label="Role Name" error={fieldErrors.role_name} className="md:col-span-2">
            <Input
              value={roleForm.role_name}
              onChange={(event) => setRoleForm((current) => ({ ...current, role_name: event.target.value }))}
              placeholder="Site Compliance Owner"
            />
          </FormField>
          <FormField label="Role Category" error={fieldErrors.role_type}>
            <select
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={roleForm.role_type}
              onChange={(event) => setRoleForm((current) => ({ ...current, role_type: event.target.value }))}
            >
              <option value="">Select category</option>
              {roleTypeOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.value}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="RACI Category" error={fieldErrors.role_raci}>
            <select
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={roleForm.role_raci}
              onChange={(event) => setRoleForm((current) => ({ ...current, role_raci: event.target.value }))}
            >
              <option value="">Select RACI</option>
              {roleRaciOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.value}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Owning Function" error={fieldErrors.ownership}>
            <Input
              value={roleForm.ownership}
              onChange={(event) => setRoleForm((current) => ({ ...current, ownership: event.target.value }))}
              placeholder="Plant Quality Leadership"
            />
          </FormField>
          <FormField label="Status">
            <select
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={roleForm.is_active}
              onChange={(event) => setRoleForm((current) => ({ ...current, is_active: event.target.value }))}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </FormField>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={() => setEditorMode("detail")} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save Governance Role"}
        </Button>
      </div>
    </form>
  );

  const renderActionForm = () => (
    <form className="space-y-4" onSubmit={(event) => void handleActionSubmit(event)}>
      <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {editingAction ? "Edit Governance Activity" : "Add Governance Activity"}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Activities describe expected business responsibilities for this governance role.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FormField label="Sequence" error={fieldErrors.seq}>
            <Input
              value={actionForm.seq}
              onChange={(event) => setActionForm((current) => ({ ...current, seq: event.target.value }))}
              placeholder="1"
            />
          </FormField>
          <FormField label="Activity Category" error={fieldErrors.action_type}>
            <select
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
              value={actionForm.action_type}
              onChange={(event) => setActionForm((current) => ({ ...current, action_type: event.target.value }))}
            >
              <option value="">Select activity category</option>
              {actionTypeOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.value}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Activity Summary" error={fieldErrors.action} className="md:col-span-2">
            <Textarea
              value={actionForm.action}
              onChange={(event) => setActionForm((current) => ({ ...current, action: event.target.value }))}
              rows={4}
              placeholder="Review validation evidence before release approval"
            />
          </FormField>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={() => setEditorMode("detail")} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save Activity"}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="grid min-h-[620px] gap-4 xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Governance Role Library</h2>
              <p className="mt-1 text-sm text-slate-500">Reusable org roles for business ownership, compliance, and operations.</p>
            </div>
            <PermissionGuard permission="ORGANIZATION_CREATE">
              <Button type="button" size="sm" onClick={openCreateRole} disabled={disabled}>
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </PermissionGuard>
          </div>
          <div className="mt-4">
            <SearchInput
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onClear={() => setSearchInput("")}
              placeholder="Search roles, category, RACI, or owner"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="space-y-3 p-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="rounded-md border border-slate-200 bg-white px-3 py-3">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="mt-3 h-3 w-32" />
                  <Skeleton className="mt-3 h-3 w-full" />
                </div>
              ))}
            </div>
          ) : sortedRoles.length === 0 ? (
            <EmptyState
              title="No role library items"
              description="Create governance roles that can be assigned to organization units."
              action={(
                <PermissionGuard permission="ORGANIZATION_CREATE">
                  <Button type="button" onClick={openCreateRole} disabled={disabled}>
                    <Plus className="h-4 w-4" />
                    Create Role
                  </Button>
                </PermissionGuard>
              )}
              className="min-h-[360px]"
            />
          ) : filteredRoles.length === 0 ? (
            <EmptyState title="No search results" description="Try a different role name, category, RACI, or owner." className="min-h-[360px]" />
          ) : (
            <div className="space-y-2">
              {filteredRoles.map((role) => {
                const isSelected = selectedRoleId === role.id;

                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => selectRole(role.id)}
                    className={cn(
                      "w-full rounded-md border px-3 py-3 text-left transition-colors",
                      isSelected
                        ? "border-blue-300 bg-blue-50 shadow-sm ring-1 ring-blue-100"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{role.role_name}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <GovernanceBadge value={role.role_type} label={resolveRoleTypeLabel(role.role_type)} palette={roleTypeClasses} />
                          <GovernanceBadge value={role.role_raci} label={resolveRoleRaciLabel(role.role_raci)} palette={raciClasses} />
                          <StatusBadge status={role.is_active ? "active" : "inactive"} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-slate-600">{role.ownership}</div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{role.action_count} activit{role.action_count === 1 ? "y" : "ies"}</span>
                      <span>{role.active_assignment_count} active assignment{role.active_assignment_count === 1 ? "" : "s"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Org Governance Role Catalog
              </div>
              <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">
                {editorMode === "roleForm"
                  ? editingRole ? "Edit Governance Role" : "Create Governance Role"
                  : editorMode === "actionForm"
                    ? editingAction ? "Edit Governance Activity" : "Add Governance Activity"
                    : selectedRole?.role_name ?? "Select a Governance Role"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Governance roles describe business and compliance responsibilities. They do not grant system access.
              </p>
            </div>

            {selectedRole && editorMode === "detail" ? (
              <div className="flex flex-wrap gap-2">
                <PermissionGuard permission="ORGANIZATION_UPDATE">
                  <Button type="button" variant="secondary" size="sm" onClick={openEditRole} disabled={disabled}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </PermissionGuard>
                <PermissionGuard permission="ORGANIZATION_UPDATE">
                  <Button type="button" variant="secondary" size="sm" onClick={openCreateAction} disabled={disabled}>
                    <Plus className="h-4 w-4" />
                    Add Activity
                  </Button>
                </PermissionGuard>
                <PermissionGuard permission="ORGANIZATION_DELETE">
                  <Button type="button" variant="destructive" size="sm" onClick={() => setRoleToDelete(selectedRole)} disabled={disabled}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </PermissionGuard>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          {roleToDelete ? (
            <ConfirmStrip
              tone="danger"
              title="Remove governance role?"
              message={`"${roleToDelete.role_name}" will be soft deleted if it has no active assignments.`}
              confirmLabel={submitting ? "Removing..." : "Remove Role"}
              onConfirm={() => void handleDeleteRole()}
              onCancel={() => setRoleToDelete(null)}
              disabled={submitting}
            />
          ) : null}

          {actionToDelete ? (
            <ConfirmStrip
              tone="danger"
              title="Remove governance activity?"
              message="This activity will be removed from the selected role playbook."
              confirmLabel={submitting ? "Removing..." : "Remove Activity"}
              onConfirm={() => void handleDeleteAction()}
              onCancel={() => setActionToDelete(null)}
              disabled={submitting}
            />
          ) : null}

          {editorMode === "roleForm" ? renderRoleForm() : null}
          {editorMode === "actionForm" ? renderActionForm() : null}

          {editorMode === "detail" && detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : null}

          {editorMode === "detail" && !detailLoading && !selectedRole ? (
            <EmptyState
              title="No governance role selected"
              description="Choose a role from the library to view its category, RACI model, activities, and availability."
            />
          ) : null}

          {editorMode === "detail" && !detailLoading && selectedRole ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricBox label="Role Category" value={<GovernanceBadge value={selectedRole.role_type} label={resolveRoleTypeLabel(selectedRole.role_type)} palette={roleTypeClasses} />} />
                <MetricBox label="Active Assignments" value={selectedRole.active_assignment_count} />
                <MetricBox label="Activities" value={selectedRole.actions.length} />
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <MetricBox label="Role Name" value={selectedRole.role_name} />
                <MetricBox label="RACI Category" value={<GovernanceBadge value={selectedRole.role_raci} label={resolveRoleRaciLabel(selectedRole.role_raci)} palette={raciClasses} />} />
                <MetricBox label="Owning Function" value={selectedRole.ownership} />
                <MetricBox label="Status" value={<StatusBadge status={selectedRole.is_active ? "active" : "inactive"} />} />
                <MetricBox label="Assignment Count" value={selectedRole.active_assignment_count} />
                <MetricBox label="Catalog Type" value="Org governance role" />
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-slate-600 shadow-sm">
                    <ListChecks className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Activities Summary</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedRole.actions.length
                        ? `${selectedRole.actions.length} reusable activit${selectedRole.actions.length === 1 ? "y" : "ies"} define the expected governance playbook.`
                        : "No activities have been defined for this governance role yet."}
                    </p>
                  </div>
                </div>
              </div>

              {selectedRole.actions.length === 0 ? (
                <EmptyState
                  title="No activities"
                  description="Add activities to describe the reusable governance responsibilities for this role."
                  action={(
                    <PermissionGuard permission="ORGANIZATION_UPDATE">
                      <Button type="button" onClick={openCreateAction} disabled={disabled}>
                        <Plus className="h-4 w-4" />
                        Add Activity
                      </Button>
                    </PermissionGuard>
                  )}
                />
              ) : (
                <div className="space-y-3">
                  {selectedRole.actions.map((action) => (
                    <div key={action.id} className="rounded-md border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                              {action.seq}
                            </Badge>
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                              {resolveActionTypeLabel(action.action_type)}
                            </Badge>
                          </div>
                          <div className="mt-3 text-sm leading-6 text-slate-800">{action.action}</div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <PermissionGuard permission="ORGANIZATION_UPDATE">
                            <Button type="button" variant="secondary" size="sm" onClick={() => openEditAction(action)}>
                              Edit
                            </Button>
                          </PermissionGuard>
                          <PermissionGuard permission="ORGANIZATION_DELETE">
                            <Button type="button" variant="destructive" size="sm" onClick={() => setActionToDelete(action)}>
                              Remove
                            </Button>
                          </PermissionGuard>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
