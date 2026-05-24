import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "../../auth/PermissionGuard";
import { LookupOption, getLookupOptionsByMasterCode } from "../../services/lookupValue.service";
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
import { ConfirmStrip, EmptyState, StatusBadge } from "../foundation";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Skeleton } from "../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Textarea } from "../ui/textarea";
import { cn } from "../ui/utils";
import { buildLookupLabelMap, getLookupLabel } from "./orgUiLabels";

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

interface OrgRoleAssignmentsPanelProps {
  orgId: string | null;
  orgName?: string | null;
  disabled?: boolean;
  actorName?: string | null;
  defaultUser?: string | null;
}

const EMPTY_FORM: AssignmentFormState = {
  role_id: "",
  person_name: "",
  person_email: "",
  employee_code: "",
  remarks: "",
  is_active: "true",
};

const roleTypeClasses: Record<string, string> = {
  BUSINESS: "border-blue-200 bg-blue-50 text-blue-700",
  COMPLIANCE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  OPERATIONS: "border-amber-200 bg-amber-50 text-amber-700",
  SECURITY: "border-rose-200 bg-rose-50 text-rose-700",
  TECHNOLOGY: "border-violet-200 bg-violet-50 text-violet-700",
};

const raciClasses: Record<string, string> = {
  RESPONSIBLE: "border-blue-200 bg-blue-50 text-blue-700",
  ACCOUNTABLE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  CONSULTED: "border-amber-200 bg-amber-50 text-amber-700",
  INFORMED: "border-slate-200 bg-slate-100 text-slate-700",
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

export function OrgRoleAssignmentsPanel({
  orgId,
  orgName,
  disabled = false,
  actorName,
  defaultUser,
}: OrgRoleAssignmentsPanelProps) {
  const auditActor = actorName ?? defaultUser ?? null;
  const [assignments, setAssignments] = useState<OrgEntityRoleAssignment[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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
    setShowForm(false);
    setEditingAssignment(null);
    setAssignmentToDelete(null);
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
    if (!formData.person_name.trim()) nextErrors.person_name = "Assigned person is required";
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
    ...(editingAssignment ? { modified_by: auditActor } : { created_by: auditActor }),
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!orgId || disabled || submitting) return;
    if (!validateForm()) return;

    setSubmitting(true);
    setError(null);

    try {
      if (editingAssignment) {
        await updateOrgRoleAssignment(editingAssignment.id, toPayload());
        toast.success("Governance role assignment updated");
      } else {
        await createOrgRoleAssignment(orgId, toPayload());
        toast.success("Governance role assignment created");
      }
      setShowForm(false);
      setEditingAssignment(null);
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
    setError(null);

    try {
      await deleteOrgRoleAssignment(assignmentToDelete.id, auditActor);
      toast.success("Governance role assignment removed");
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Governance Assignments</h3>
          <p className="mt-1 text-sm text-slate-500">
            {orgId
              ? `Business, compliance, and operations responsibilities for ${orgName ?? "the selected unit"}.`
              : "Select an organization unit to manage governance assignments."}
          </p>
        </div>
        <PermissionGuard permission="ORGANIZATION_UPDATE">
          <Button
            type="button"
            size="sm"
            onClick={openCreate}
            disabled={disabled || !orgId || rolesLoading || roleOptions.length === 0}
          >
            <Plus className="h-4 w-4" />
            Assign Role
          </Button>
        </PermissionGuard>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {!orgId ? (
        <EmptyState
          title="No organization selected"
          description="Select a unit from the hierarchy to manage its governance role assignments."
        />
      ) : null}

      {orgId && !rolesLoading && roleOptions.length === 0 ? (
        <EmptyState
          title="No active governance roles"
          description="Create reusable governance roles in the Role Library before assigning responsibilities."
        />
      ) : null}

      {showForm && orgId ? (
        <form className="rounded-md border border-slate-200 bg-white p-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex flex-col gap-1 border-b border-slate-200 pb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              {editingAssignment ? "Edit Governance Assignment" : "Assign Governance Role"}
            </h3>
            <p className="text-sm text-slate-500">
              This is an org governance responsibility, not a system RBAC role.
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FormField label="Governance Role" error={fieldErrors.role_id} className="md:col-span-2">
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={formData.role_id}
                onChange={(event) => setFormData((current) => ({ ...current, role_id: event.target.value }))}
              >
                <option value="">Select governance role</option>
                {roleOptions.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.role_name} ({resolveRoleRaciLabel(role.role_raci)})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Assigned Person" error={fieldErrors.person_name}>
              <Input
                value={formData.person_name}
                onChange={(event) => setFormData((current) => ({ ...current, person_name: event.target.value }))}
                placeholder="Anita Rao"
              />
            </FormField>

            <FormField label="Status">
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                value={formData.is_active}
                onChange={(event) => setFormData((current) => ({ ...current, is_active: event.target.value }))}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </FormField>

            <FormField label="Email">
              <Input
                type="email"
                value={formData.person_email}
                onChange={(event) => setFormData((current) => ({ ...current, person_email: event.target.value }))}
                placeholder="person@company.com"
              />
            </FormField>

            <FormField label="Employee Code">
              <Input
                value={formData.employee_code}
                onChange={(event) => setFormData((current) => ({ ...current, employee_code: event.target.value }))}
                placeholder="EMP-1024"
              />
            </FormField>

            <FormField label="Notes" className="md:col-span-2">
              <Textarea
                value={formData.remarks}
                onChange={(event) => setFormData((current) => ({ ...current, remarks: event.target.value }))}
                placeholder="Optional notes for this governance assignment"
                rows={4}
              />
            </FormField>
          </div>

          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowForm(false);
                setEditingAssignment(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Assignment"}
            </Button>
          </div>
        </form>
      ) : null}

      {assignmentToDelete ? (
        <ConfirmStrip
          tone="danger"
          title="Remove governance role assignment?"
          message={`This will deactivate the assignment${assignmentToDelete.person_name ? ` for ${assignmentToDelete.person_name}` : ""}.`}
          confirmLabel={submitting ? "Removing..." : "Remove"}
          onConfirm={() => void handleDelete()}
          onCancel={() => setAssignmentToDelete(null)}
          disabled={submitting}
        />
      ) : null}

      {orgId && loading ? (
        <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {orgId && !loading && assignments.length === 0 ? (
        <EmptyState
          title="No role assignments"
          description="No governance roles are assigned to this organization unit yet."
        />
      ) : null}

      {orgId && !loading && assignments.length > 0 ? (
        <Table containerClassName="max-h-[440px] rounded-md border border-slate-200">
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Assigned Person</TableHead>
              <TableHead>RACI</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="min-w-56">
                  <div className="font-medium text-slate-900">{assignment.role?.role_name ?? "Governance role"}</div>
                  <div className="mt-1 text-xs text-slate-500">{assignment.role?.ownership ?? "-"}</div>
                </TableCell>
                <TableCell className="min-w-56">
                  <div className="font-medium text-slate-800">{assignment.person_name || "-"}</div>
                  <div className="mt-1 text-xs text-slate-500">{assignment.person_email || assignment.employee_code || "-"}</div>
                </TableCell>
                <TableCell>
                  <GovernanceBadge
                    value={assignment.role?.role_raci}
                    label={assignment.role?.role_raci ? resolveRoleRaciLabel(assignment.role.role_raci) : ""}
                    palette={raciClasses}
                  />
                </TableCell>
                <TableCell>
                  <GovernanceBadge
                    value={assignment.role?.role_type}
                    label={assignment.role?.role_type ? resolveRoleTypeLabel(assignment.role.role_type) : ""}
                    palette={roleTypeClasses}
                  />
                </TableCell>
                <TableCell>
                  <StatusBadge status={assignment.is_active ? "active" : "inactive"} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <PermissionGuard permission="ORGANIZATION_UPDATE">
                      <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(assignment)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                    </PermissionGuard>
                    <PermissionGuard permission="ORGANIZATION_DELETE">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setAssignmentToDelete(assignment)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </PermissionGuard>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
