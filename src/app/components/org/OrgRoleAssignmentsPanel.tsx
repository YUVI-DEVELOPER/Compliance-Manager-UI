import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Briefcase, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "../ui/Button";
import { Card, CardBody, CardHeader } from "../ui/Card";
import { Input, Textarea } from "../ui/Input";
import { ConfirmDialog, Modal } from "../ui/Modal";
import { Skeleton } from "../ui/skeleton";
import { LookupOption, getLookupOptionsByMasterCode } from "../../services/lookupValue.service";
import { buildLookupLabelMap, getLookupLabel } from "./orgUiLabels";
import {
  OrgEntityRoleAssignment,
  OrgEntityRoleAssignmentPayload,
  OrgRole,
  createOrgRoleAssignment,
  deleteOrgRoleAssignment,
  getOrgRoleAssignments,
  getOrgRoles,
  updateOrgRoleAssignment,
} from "../../../services/org-role.service";

interface AssignmentFormState {
  role_id: string;
  person_name: string;
  person_email: string;
  employee_code: string;
  remarks: string;
  is_active: string;
}

interface FieldErrors {
  [key: string]: string;
}

const EMPTY_FORM: AssignmentFormState = {
  role_id: "",
  person_name: "",
  person_email: "",
  employee_code: "",
  remarks: "",
  is_active: "true",
};

const roleTypeColors: Record<string, string> = {
  BUSINESS: "bg-blue-100 text-blue-700 border-blue-200",
  COMPLIANCE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  OPERATIONS: "bg-amber-100 text-amber-700 border-amber-200",
  SECURITY: "bg-rose-100 text-rose-700 border-rose-200",
  TECHNOLOGY: "bg-violet-100 text-violet-700 border-violet-200",
};

const raciColors: Record<string, string> = {
  RESPONSIBLE: "bg-blue-100 text-blue-700 border-blue-200",
  ACCOUNTABLE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CONSULTED: "bg-amber-100 text-amber-700 border-amber-200",
  INFORMED: "bg-slate-100 text-slate-700 border-slate-200",
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

const toFormState = (assignment?: OrgEntityRoleAssignment | null): AssignmentFormState =>
  assignment
    ? {
        role_id: assignment.role_id,
        person_name: assignment.person_name ?? "",
        person_email: assignment.person_email ?? "",
        employee_code: assignment.employee_code ?? "",
        remarks: assignment.remarks ?? "",
        is_active: assignment.is_active ? "true" : "false",
      }
    : { ...EMPTY_FORM };

const SummaryTile = ({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        {icon}
      </div>
    </div>
  </div>
);

interface OrgRoleAssignmentsPanelProps {
  orgId: string | null;
  orgName?: string | null;
  disabled?: boolean;
  defaultUser?: string;
}

export function OrgRoleAssignmentsPanel({
  orgId,
  orgName,
  disabled = false,
  defaultUser = "admin@validatenow",
}: OrgRoleAssignmentsPanelProps) {
  const [assignments, setAssignments] = useState<OrgEntityRoleAssignment[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<OrgEntityRoleAssignment | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] = useState<OrgEntityRoleAssignment | null>(null);
  const [formData, setFormData] = useState<AssignmentFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [roleRaciOptions, setRoleRaciOptions] = useState<LookupOption[]>([]);
  const [roleTypeOptions, setRoleTypeOptions] = useState<LookupOption[]>([]);

  const roleOptions = useMemo(
    () => roles.filter((role) => role.is_active && !role.is_deleted).sort((left, right) => left.role_name.localeCompare(right.role_name)),
    [roles],
  );
  const roleRaciLabelMap = useMemo(() => buildLookupLabelMap(roleRaciOptions), [roleRaciOptions]);
  const roleTypeLabelMap = useMemo(() => buildLookupLabelMap(roleTypeOptions), [roleTypeOptions]);
  const assignmentSummary = useMemo(() => ({
    total: assignments.length,
    active: assignments.filter((assignment) => assignment.is_active).length,
    uniqueRoles: new Set(assignments.map((assignment) => assignment.role_id)).size,
    staffed: assignments.filter((assignment) => Boolean(assignment.person_name?.trim())).length,
  }), [assignments]);
  const resolveRoleRaciLabel = useCallback((code: string) => getLookupLabel(code, roleRaciLabelMap), [roleRaciLabelMap]);
  const resolveRoleTypeLabel = useCallback((code: string) => getLookupLabel(code, roleTypeLabelMap), [roleTypeLabelMap]);

  const loadAssignments = useCallback(async () => {
    if (!orgId) {
      setAssignments([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getOrgRoleAssignments(orgId);
      setAssignments(data);
    } catch (loadError) {
      setError(extractMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const data = await getOrgRoles(true);
      setRoles(data);
    } catch (loadError) {
      setError(extractMessage(loadError));
    } finally {
      setRolesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (disabled) return;
    void loadRoles();
  }, [disabled, loadRoles]);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;

    void (async () => {
      try {
        const [raci, roleTypes] = await Promise.all([
          getLookupOptionsByMasterCode("ORG_ROLE_RACI"),
          getLookupOptionsByMasterCode("ORG_ROLE_TYPE"),
        ]);
        if (cancelled) return;
        setRoleRaciOptions(raci);
        setRoleTypeOptions(roleTypes);
      } catch (loadError) {
        if (!cancelled) setError(extractMessage(loadError));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;
    void loadAssignments();
  }, [disabled, loadAssignments]);

  const openCreate = (): void => {
    setEditingAssignment(null);
    setFieldErrors({});
    setFormData({ ...EMPTY_FORM, role_id: roleOptions[0]?.id ?? "" });
    setShowForm(true);
  };

  const openEdit = (assignment: OrgEntityRoleAssignment): void => {
    setEditingAssignment(assignment);
    setFieldErrors({});
    setFormData(toFormState(assignment));
    setShowForm(true);
  };

  const validateForm = (): boolean => {
    const nextErrors: FieldErrors = {};
    if (!formData.role_id) nextErrors.role_id = "Governance role is required";
    if (!formData.person_name.trim()) nextErrors.person_name = "Assigned leader is required";
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const toPayload = (): OrgEntityRoleAssignmentPayload => ({
    role_id: formData.role_id,
    person_name: formData.person_name.trim(),
    person_email: formData.person_email.trim() || null,
    employee_code: formData.employee_code.trim() || null,
    remarks: formData.remarks.trim() || null,
    is_active: formData.is_active === "true",
    ...(editingAssignment ? { modified_by: defaultUser } : { created_by: defaultUser }),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!orgId || disabled || submitting) return;
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (editingAssignment) {
        await updateOrgRoleAssignment(editingAssignment.id, toPayload());
        toast.success("Accountability assignment updated successfully");
      } else {
        await createOrgRoleAssignment(orgId, toPayload());
        toast.success("Accountability assignment created successfully");
      }
      setShowForm(false);
      await Promise.all([loadAssignments(), loadRoles()]);
    } catch (submitError) {
      const message = extractMessage(submitError);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!assignmentToDelete || submitting) return;

    setSubmitting(true);
    try {
      await deleteOrgRoleAssignment(assignmentToDelete.id, defaultUser);
      toast.success("Accountability assignment removed successfully");
      setShowDelete(false);
      setAssignmentToDelete(null);
      await Promise.all([loadAssignments(), loadRoles()]);
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
      <Card padding="none" className="min-h-[320px] border-slate-200 shadow-sm">
        <CardHeader
          className="shrink-0"
          title="Governance Coverage"
          description={
            orgId
              ? `${assignments.length} accountability assignment${assignments.length === 1 ? "" : "s"} for ${orgName ?? "the selected organization"}`
              : "Select an organization to manage accountability coverage"
          }
          action={
            <Button
              size="sm"
              type="button"
              disabled={disabled || !orgId || rolesLoading || roleOptions.length === 0}
              onClick={openCreate}
            >
              <Plus className="h-4 w-4" />
              Assign Governance Role
            </Button>
          }
        />
        <CardBody className="min-h-[220px] space-y-4 px-6 pb-6">
          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {!orgId && (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
              No organization selected.
            </div>
          )}
          {orgId && (
            <div className="grid gap-3 md:grid-cols-3">
              <SummaryTile
                label="Assignments"
                value={String(assignmentSummary.total)}
                hint="Total accountability assignments for this organization"
                icon={<ShieldCheck className="h-5 w-5" />}
              />
              <SummaryTile
                label="Active"
                value={String(assignmentSummary.active)}
                hint="Assignments currently in effect"
                icon={<Users className="h-5 w-5" />}
              />
              <SummaryTile
                label="Role Coverage"
                value={String(assignmentSummary.uniqueRoles)}
                hint="Distinct governance roles assigned here"
                icon={<Briefcase className="h-5 w-5" />}
              />
            </div>
          )}
          {orgId && loading && (
            <div className="min-h-[96px] rounded-2xl border border-slate-200 px-4 py-4">
              <div className="space-y-3">
                <Skeleton className="h-4 w-56 max-w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          )}
          {orgId && !loading && assignments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
              No accountability assignments have been recorded for this organization yet.
            </div>
          )}
          {orgId && !loading && assignments.length > 0 && (
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-slate-900">{assignment.role?.role_name ?? "Governance role"}</div>
                        {assignment.role?.role_raci && (
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getBadgeClass(assignment.role.role_raci, raciColors)}`}>
                            {resolveRoleRaciLabel(assignment.role.role_raci)}
                          </span>
                        )}
                        {assignment.role?.role_type && (
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${getBadgeClass(assignment.role.role_type, roleTypeColors)}`}>
                            {resolveRoleTypeLabel(assignment.role.role_type)}
                          </span>
                        )}
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${assignment.is_active ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
                          {assignment.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Assigned Leader</div>
                          <div className="mt-1 text-sm font-medium text-slate-800">{assignment.person_name}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Owning Function</div>
                          <div className="mt-1 text-sm font-medium text-slate-800">{assignment.role?.ownership ?? "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Work Email</div>
                          <div className="mt-1 text-sm font-medium text-slate-800">{assignment.person_email || "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Employee ID</div>
                          <div className="mt-1 text-sm font-medium text-slate-800">{assignment.employee_code || "-"}</div>
                        </div>
                      </div>
                      {assignment.remarks && <div className="mt-3 text-sm text-slate-600">{assignment.remarks}</div>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="secondary" size="sm" type="button" onClick={() => openEdit(assignment)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        type="button"
                        onClick={() => {
                          setAssignmentToDelete(assignment);
                          setShowDelete(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {orgId && !rolesLoading && roleOptions.length === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No active governance roles are available yet. Create them in the Governance Role Library first.
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={showForm}
        onClose={() => {
          if (!submitting) setShowForm(false);
        }}
        title={editingAssignment ? "Update Accountability Assignment" : "Assign Governance Role"}
        description={
          editingAssignment
            ? "Update the leadership assignment for this organization."
            : "Assign a governance role to this organization."
        }
        size="lg"
        footer={(
          <>
            <Button variant="ghost" type="button" disabled={submitting} onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" form="org-role-assignment-form" disabled={submitting}>
              {submitting ? "Saving..." : "Save Assignment"}
            </Button>
          </>
        )}
      >
        <form id="org-role-assignment-form" className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={(event) => void handleSubmit(event)}>
          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Governance Role</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={formData.role_id}
              onChange={(event) => setFormData((current) => ({ ...current, role_id: event.target.value }))}
            >
              <option value="">Select Governance Role</option>
              {roleOptions.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.role_name} ({resolveRoleRaciLabel(role.role_raci)})
                </option>
              ))}
            </select>
            {fieldErrors.role_id && <p className="text-xs text-red-600">{fieldErrors.role_id}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned Leader</label>
            <Input
              value={formData.person_name}
              onChange={(event) => setFormData((current) => ({ ...current, person_name: event.target.value }))}
              placeholder="e.g. Anita Rao"
            />
            {fieldErrors.person_name && <p className="text-xs text-red-600">{fieldErrors.person_name}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assignment Status</label>
            <select
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
              value={formData.is_active}
              onChange={(event) => setFormData((current) => ({ ...current, is_active: event.target.value }))}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Work Email</label>
            <Input
              type="email"
              value={formData.person_email}
              onChange={(event) => setFormData((current) => ({ ...current, person_email: event.target.value }))}
              placeholder="person@company.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Employee ID</label>
            <Input
              value={formData.employee_code}
              onChange={(event) => setFormData((current) => ({ ...current, employee_code: event.target.value }))}
              placeholder="e.g. EMP-1024"
            />
          </div>

          <div className="md:col-span-2 space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assignment Notes</label>
            <Textarea
              value={formData.remarks}
              onChange={(event) => setFormData((current) => ({ ...current, remarks: event.target.value }))}
              placeholder="Optional notes for this accountability assignment"
              rows={4}
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={showDelete}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!submitting) {
            setShowDelete(false);
            setAssignmentToDelete(null);
          }
        }}
        title="Remove accountability assignment?"
        message={`This will deactivate the assignment${assignmentToDelete?.person_name ? ` for ${assignmentToDelete.person_name}` : ""}.`}
        confirmLabel={submitting ? "Removing..." : "Remove Assignment"}
      />
    </>
  );
}
