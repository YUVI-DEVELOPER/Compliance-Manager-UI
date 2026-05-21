import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Input, Textarea } from "../ui/Input";
import { ConfirmDialog, Modal } from "../ui/Modal";
import { LookupOption, getLookupOptionsByMasterCode } from "../../services/lookupValue.service";
import { buildLookupLabelMap, getLookupLabel } from "./orgUiLabels";
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

const raciColors: Record<string, string> = {
  RESPONSIBLE: "bg-blue-100 text-blue-700 border-blue-200",
  ACCOUNTABLE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CONSULTED: "bg-amber-100 text-amber-700 border-amber-200",
  INFORMED: "bg-slate-100 text-slate-700 border-slate-200",
};

const roleTypeColors: Record<string, string> = {
  BUSINESS: "bg-blue-100 text-blue-700 border-blue-200",
  COMPLIANCE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  OPERATIONS: "bg-amber-100 text-amber-700 border-amber-200",
  SECURITY: "bg-rose-100 text-rose-700 border-rose-200",
  TECHNOLOGY: "bg-violet-100 text-violet-700 border-violet-200",
};

const getBadgeClass = (code: string, palette: Record<string, string>): string =>
  palette[code.toUpperCase()] || "bg-slate-100 text-slate-700 border-slate-200";

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

interface OrgRoleCatalogAdminProps {
  disabled?: boolean;
  defaultUser?: string;
  onCatalogSummaryChange?: (summary: {
    totalRoles: number;
    activeRoles: number;
    activeAssignments: number;
    standardActivities: number;
  }) => void;
}

export function OrgRoleCatalogAdmin({
  disabled = false,
  defaultUser = "admin@validatenow",
  onCatalogSummaryChange,
}: OrgRoleCatalogAdminProps) {
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<OrgRoleDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showRoleDelete, setShowRoleDelete] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);
  const [showActionDelete, setShowActionDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingRole, setEditingRole] = useState<OrgRole | null>(null);
  const [editingAction, setEditingAction] = useState<OrgRoleAction | null>(null);
  const [actionToDelete, setActionToDelete] = useState<OrgRoleAction | null>(null);
  const [roleForm, setRoleForm] = useState<RoleFormState>(EMPTY_ROLE_FORM);
  const [actionForm, setActionForm] = useState<ActionFormState>(EMPTY_ACTION_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [roleRaciOptions, setRoleRaciOptions] = useState<LookupOption[]>([]);
  const [roleTypeOptions, setRoleTypeOptions] = useState<LookupOption[]>([]);
  const [actionTypeOptions, setActionTypeOptions] = useState<LookupOption[]>([]);

  const loadRoles = useCallback(async (preferredRoleId?: string | null) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrgRoles();
      setRoles(data);
      const targetRoleId = preferredRoleId ?? selectedRoleId ?? data[0]?.id ?? null;
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
  const roleRaciLabelMap = useMemo(() => buildLookupLabelMap(roleRaciOptions), [roleRaciOptions]);
  const roleTypeLabelMap = useMemo(() => buildLookupLabelMap(roleTypeOptions), [roleTypeOptions]);
  const actionTypeLabelMap = useMemo(() => buildLookupLabelMap(actionTypeOptions), [actionTypeOptions]);
  const catalogSummary = useMemo(() => ({
    totalRoles: roles.length,
    activeRoles: roles.filter((role) => role.is_active && !role.is_deleted).length,
    activeAssignments: roles.reduce((sum, role) => sum + role.active_assignment_count, 0),
    standardActivities: roles.reduce((sum, role) => sum + role.action_count, 0),
  }), [roles]);

  useEffect(() => {
    onCatalogSummaryChange?.(catalogSummary);
  }, [catalogSummary, onCatalogSummaryChange]);
  const resolveRoleRaciLabel = useCallback((code: string) => getLookupLabel(code, roleRaciLabelMap), [roleRaciLabelMap]);
  const resolveRoleTypeLabel = useCallback((code: string) => getLookupLabel(code, roleTypeLabelMap), [roleTypeLabelMap]);
  const resolveActionTypeLabel = useCallback((code: string) => getLookupLabel(code, actionTypeLabelMap), [actionTypeLabelMap]);

  const openCreateRole = (): void => {
    setEditingRole(null);
    setFieldErrors({});
    setRoleForm({
      ...EMPTY_ROLE_FORM,
      role_raci: roleRaciOptions[0]?.code ?? "",
      role_type: roleTypeOptions[0]?.code ?? "",
    });
    setShowRoleForm(true);
  };

  const openEditRole = (): void => {
    if (!selectedRole) return;
    setEditingRole(selectedRole);
    setFieldErrors({});
    setRoleForm(toRoleForm(selectedRole));
    setShowRoleForm(true);
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
    setShowActionForm(true);
  };

  const openEditAction = (action: OrgRoleAction): void => {
    setEditingAction(action);
    setFieldErrors({});
    setActionForm(toActionForm(action));
    setShowActionForm(true);
  };

  const validateRoleForm = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!roleForm.role_name.trim()) nextErrors.role_name = "Role name is required";
    if (!roleForm.role_raci) nextErrors.role_raci = "Responsibility model is required";
    if (!roleForm.ownership.trim()) nextErrors.ownership = "Owning function is required";
    if (!roleForm.role_type) nextErrors.role_type = "Role family is required";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateActionForm = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!actionForm.seq.trim() || Number.isNaN(Number(actionForm.seq)) || Number(actionForm.seq) < 1) {
      nextErrors.seq = "Sequence must be a positive number";
    }
    if (!actionForm.action_type) nextErrors.action_type = "Activity category is required";
    if (!actionForm.action.trim()) nextErrors.action = "Activity description is required";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRoleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (disabled || submitting) return;
    if (!validateRoleForm()) return;

    setSubmitting(true);
    const payload: OrgRolePayload = {
      role_name: roleForm.role_name.trim(),
      role_raci: roleForm.role_raci,
      ownership: roleForm.ownership.trim(),
      role_type: roleForm.role_type,
      is_active: roleForm.is_active === "true",
      ...(editingRole ? { modified_by: defaultUser } : { created_by: defaultUser }),
    };

    try {
      const saved = editingRole
        ? await updateOrgRole(editingRole.id, payload)
        : await createOrgRole(payload);
      toast.success(editingRole ? "Governance role updated successfully" : "Governance role created successfully");
      setShowRoleForm(false);
      await loadRoles(saved.id);
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
    const payload: OrgRoleActionPayload = {
      seq: Number(actionForm.seq),
      action_type: actionForm.action_type,
      action: actionForm.action.trim(),
      ...(editingAction ? { modified_by: defaultUser } : { created_by: defaultUser }),
    };

    try {
      if (editingAction) {
        await updateOrgRoleAction(editingAction.id, payload);
        toast.success("Governance activity updated successfully");
      } else {
        await createOrgRoleAction(selectedRole.id, payload);
        toast.success("Governance activity created successfully");
      }
      setShowActionForm(false);
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
    if (!selectedRole || submitting) return;

    setSubmitting(true);
    try {
      await deleteOrgRole(selectedRole.id, defaultUser);
      toast.success("Governance role removed successfully");
      setShowRoleDelete(false);
      setSelectedRole(null);
      setSelectedRoleId(null);
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
    try {
      await deleteOrgRoleAction(actionToDelete.id);
      toast.success("Governance activity removed successfully");
      setShowActionDelete(false);
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

  return (
    <>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card padding="none" className="border-slate-200 shadow-sm">
          <CardHeader
            title="Governance Role Library"
            description={`${roles.length} governance role${roles.length === 1 ? "" : "s"} configured for reuse`}
            action={(
              <Button size="sm" type="button" disabled={disabled} onClick={openCreateRole}>
                <Plus className="h-4 w-4" />
                Add Governance Role
              </Button>
            )}
          />
          <CardBody className="space-y-3 px-6 pb-6">
            {loading && <div className="text-sm text-slate-500">Loading governance roles...</div>}
            {!loading && sortedRoles.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                No governance roles have been configured yet.
              </div>
            )}
            {!loading && sortedRoles.length > 0 && sortedRoles.map((role) => {
              const isSelected = selectedRoleId === role.id;

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${isSelected ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{role.role_name}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getBadgeClass(role.role_raci, raciColors)}`}>
                        {resolveRoleRaciLabel(role.role_raci)}
                      </span>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getBadgeClass(role.role_type, roleTypeColors)}`}>
                        {resolveRoleTypeLabel(role.role_type)}
                      </span>
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${role.is_active ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
                        {role.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-slate-700">{role.ownership}</div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>{role.action_count} standard activit{role.action_count === 1 ? "y" : "ies"}</span>
                      <span>{role.active_assignment_count} active assignment{role.active_assignment_count === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardBody>
        </Card>

        <Card padding="none" className="border-slate-200 shadow-sm">
          <CardHeader
            title={selectedRole?.role_name ?? "Select a Governance Role"}
            description={
              selectedRole
                ? `${resolveRoleTypeLabel(selectedRole.role_type)} • ${selectedRole.ownership}`
                : "Choose a governance role to review its business purpose and standard activities."
            }
            action={selectedRole ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" type="button" onClick={openEditRole}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="secondary" size="sm" type="button" onClick={openCreateAction}>
                  <Plus className="h-4 w-4" />
                  Add Activity
                </Button>
                <Button variant="destructive" size="sm" type="button" onClick={() => setShowRoleDelete(true)}>
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            ) : undefined}
          />
          <CardBody className="space-y-5 px-6 pb-6">
            {detailLoading && <div className="text-sm text-slate-500">Loading governance role details...</div>}
            {!detailLoading && !selectedRole && (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                No governance role selected.
              </div>
            )}
            {!detailLoading && selectedRole && (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Owning Function</div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">{selectedRole.ownership}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Active Assignments</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedRole.active_assignment_count}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Standard Activities</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedRole.actions.length}</div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    { label: "Role Name", value: selectedRole.role_name },
                    { label: "Responsibility Model", value: resolveRoleRaciLabel(selectedRole.role_raci), palette: raciColors, code: selectedRole.role_raci },
                    { label: "Role Family", value: resolveRoleTypeLabel(selectedRole.role_type), palette: roleTypeColors, code: selectedRole.role_type },
                    { label: "Owning Function", value: selectedRole.ownership },
                    { label: "Availability", value: selectedRole.is_active ? "Active" : "Inactive" },
                    { label: "Active Assignments", value: String(selectedRole.active_assignment_count) },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                      {item.palette && item.code ? (
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getBadgeClass(item.code, item.palette)}`}>
                          {item.value}
                        </span>
                      ) : (
                        <div className="text-sm font-medium text-slate-800">{item.value}</div>
                      )}
                    </div>
                  ))}
                </div>

                <div>
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-slate-900">Standard Activities</h3>
                  </div>
                  {selectedRole.actions.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                      No standard activities have been defined for this role yet.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedRole.actions.map((action) => (
                        <div key={action.id} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex min-w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                                  {action.seq}
                                </span>
                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                                  {resolveActionTypeLabel(action.action_type)}
                                </span>
                              </div>
                              <div className="mt-3 text-sm leading-6 text-slate-800">{action.action}</div>
                            </div>
                            <div className="flex shrink-0 gap-2">
                              <Button variant="secondary" size="sm" type="button" onClick={() => openEditAction(action)}>
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                type="button"
                                onClick={() => {
                                  setActionToDelete(action);
                                  setShowActionDelete(true);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={showRoleForm}
        onClose={() => {
          if (!submitting) setShowRoleForm(false);
        }}
        title={editingRole ? "Update Governance Role" : "Create Governance Role"}
        description={
          editingRole
            ? "Update the reusable role definition and its business ownership details."
            : "Add a reusable governance role that can be assigned across the enterprise structure."
        }
        size="lg"
        footer={(
          <>
            <Button variant="ghost" type="button" disabled={submitting} onClick={() => setShowRoleForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="org-role-form" disabled={submitting}>
              {submitting ? "Saving..." : "Save Governance Role"}
            </Button>
          </>
        )}
      >
        <form id="org-role-form" className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={(event) => void handleRoleSubmit(event)}>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role Name</label>
            <Input
              value={roleForm.role_name}
              onChange={(event) => setRoleForm((current) => ({ ...current, role_name: event.target.value }))}
              placeholder="e.g. Site Compliance Owner"
            />
            {fieldErrors.role_name && <p className="text-xs text-red-600">{fieldErrors.role_name}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Responsibility Model</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={roleForm.role_raci}
              onChange={(event) => setRoleForm((current) => ({ ...current, role_raci: event.target.value }))}
            >
              <option value="">Select Responsibility Model</option>
              {roleRaciOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.value}
                </option>
              ))}
            </select>
            {fieldErrors.role_raci && <p className="text-xs text-red-600">{fieldErrors.role_raci}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role Family</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={roleForm.role_type}
              onChange={(event) => setRoleForm((current) => ({ ...current, role_type: event.target.value }))}
            >
              <option value="">Select Role Family</option>
              {roleTypeOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.value}
                </option>
              ))}
            </select>
            {fieldErrors.role_type && <p className="text-xs text-red-600">{fieldErrors.role_type}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Owning Function</label>
            <Input
              value={roleForm.ownership}
              onChange={(event) => setRoleForm((current) => ({ ...current, ownership: event.target.value }))}
              placeholder="e.g. Plant Quality Leadership"
            />
            {fieldErrors.ownership && <p className="text-xs text-red-600">{fieldErrors.ownership}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Availability</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={roleForm.is_active}
              onChange={(event) => setRoleForm((current) => ({ ...current, is_active: event.target.value }))}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </form>
      </Modal>

      <Modal
        open={showActionForm}
        onClose={() => {
          if (!submitting) setShowActionForm(false);
        }}
        title={editingAction ? "Update Governance Activity" : "Add Governance Activity"}
        description={
          editingAction
            ? "Update the business activity or its sequence in the role playbook."
            : "Add a standard governance activity for the selected role."
        }
        size="lg"
        footer={(
          <>
            <Button variant="ghost" type="button" disabled={submitting} onClick={() => setShowActionForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="org-role-action-form" disabled={submitting}>
              {submitting ? "Saving..." : "Save Activity"}
            </Button>
          </>
        )}
      >
        <form id="org-role-action-form" className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={(event) => void handleActionSubmit(event)}>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sequence</label>
            <Input
              value={actionForm.seq}
              onChange={(event) => setActionForm((current) => ({ ...current, seq: event.target.value }))}
              placeholder="1"
            />
            {fieldErrors.seq && <p className="text-xs text-red-600">{fieldErrors.seq}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Activity Category</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={actionForm.action_type}
              onChange={(event) => setActionForm((current) => ({ ...current, action_type: event.target.value }))}
            >
              <option value="">Select Activity Category</option>
              {actionTypeOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.value}
                </option>
              ))}
            </select>
            {fieldErrors.action_type && <p className="text-xs text-red-600">{fieldErrors.action_type}</p>}
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Business Activity</label>
            <Textarea
              value={actionForm.action}
              onChange={(event) => setActionForm((current) => ({ ...current, action: event.target.value }))}
              rows={4}
              placeholder="e.g. Review validation evidence before release approval"
            />
            {fieldErrors.action && <p className="text-xs text-red-600">{fieldErrors.action}</p>}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={showRoleDelete}
        onConfirm={() => void handleDeleteRole()}
        onCancel={() => {
          if (!submitting) setShowRoleDelete(false);
        }}
        title="Remove governance role?"
        message={`"${selectedRole?.role_name ?? "Selected role"}" will be soft deleted if it has no active assignments.`}
        confirmLabel={submitting ? "Removing..." : "Remove Role"}
      />

      <ConfirmDialog
        open={showActionDelete}
        onConfirm={() => void handleDeleteAction()}
        onCancel={() => {
          if (!submitting) {
            setShowActionDelete(false);
            setActionToDelete(null);
          }
        }}
        title="Remove governance activity?"
        message="This activity will be removed from the selected role playbook."
        confirmLabel={submitting ? "Removing..." : "Remove Activity"}
      />
    </>
  );
}
