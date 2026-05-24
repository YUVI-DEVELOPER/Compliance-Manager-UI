import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, KeyRound, Lock, Pencil, Plus, RefreshCw, Save, UserCheck, UserPlus, UserX } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "../auth/PermissionGuard";
import { useAuth } from "../auth/useAuth";
import { ConfirmStrip, EmptyState, FilterBar, RightPanel, StatusBadge, type ActiveFilter } from "../components/foundation";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input, SearchInput } from "../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { cn } from "../components/ui/utils";
import type { CountryDialCode } from "../utils/countryDialCodes";
import {
  findCountryDialCode,
  findCountryDialCodeByDialCode,
  formatPhoneNumberLengthHint,
  getBrowserCountryDialCode,
  getPhoneNumberLengthRange,
  searchCountryDialCodes,
} from "../utils/countryDialCodes";
import {
  createUser,
  listRoles,
  listUsers,
  resetUserPassword,
  RoleRecord,
  setUserActive,
  setUserRoles,
  updateUser,
  UserRecord,
} from "../../services/rbac.service";

type PanelMode = "create" | "view" | "edit";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "LOCKED";

interface CreateUserForm {
  full_name: string;
  email: string;
  designation: string;
  department: string;
  country: string;
  country_code: string;
  phone_number: string;
  password: string;
  confirm_password: string;
  role_code: string;
}

interface EditUserForm {
  full_name: string;
  email: string;
  designation: string;
  department: string;
  phone_number: string;
  is_locked: boolean;
  role_code: string;
}

interface ResetPasswordForm {
  new_password: string;
  confirm_password: string;
}

type FieldErrors = Partial<Record<keyof CreateUserForm | keyof EditUserForm | keyof ResetPasswordForm, string>>;

interface StatusAction {
  user: UserRecord;
  nextActive: boolean;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function getInitialCreateForm(): CreateUserForm {
  const country = getBrowserCountryDialCode();
  return {
    full_name: "",
    email: "",
    designation: "",
    department: "",
    country: country?.name ?? "",
    country_code: country?.dialCode ?? "",
    phone_number: "",
    password: "",
    confirm_password: "",
    role_code: "",
  };
}

const emptyResetForm: ResetPasswordForm = {
  new_password: "",
  confirm_password: "",
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatValue = (value?: string | null): string => {
  const text = (value ?? "").trim();
  return text || "-";
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const validateEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const userSearchText = (user: UserRecord, roleNameByCode: Map<string, string>): string =>
  [
    user.full_name,
    user.email,
    user.phone,
    user.designation,
    user.department,
    user.is_active ? "active" : "inactive",
    user.is_locked ? "locked" : "unlocked",
    ...user.roles,
    ...user.roles.map((roleCode) => roleNameByCode.get(roleCode)),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const roleLabel = (roleCode: string, roleNameByCode: Map<string, string>): string => roleNameByCode.get(roleCode) ?? roleCode;

const sameRoles = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((role) => rightSet.has(role));
};

function UserStatusBadge({ user }: { user: UserRecord }) {
  if (user.is_locked) return <StatusBadge status="pending">Locked</StatusBadge>;
  return <StatusBadge status={user.is_active ? "active" : "inactive"}>{user.is_active ? "Active" : "Inactive"}</StatusBadge>;
}

function FieldBlock({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className={cn("mt-1 break-words text-sm font-medium text-slate-900", mono ? "font-mono text-xs" : null)}>{value}</div>
    </div>
  );
}

function RoleChips({ roles, roleNameByCode }: { roles: string[]; roleNameByCode: Map<string, string> }) {
  if (!roles.length) return <span className="text-sm text-slate-500">No role assigned</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((roleCode) => (
        <Badge key={roleCode} variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          {roleLabel(roleCode, roleNameByCode)}
        </Badge>
      ))}
    </div>
  );
}

function validateCreateForm(form: CreateUserForm): { errors: FieldErrors; phone: string | null } {
  const errors: FieldErrors = {};
  const fullName = form.full_name.trim();
  const email = normalizeEmail(form.email);
  const country = findCountryDialCode(form.country);
  const dialCodeCountry = findCountryDialCodeByDialCode(form.country_code);
  const selectedCountry = country ?? dialCodeCountry;
  const phoneDigits = digitsOnly(form.phone_number);
  const phoneRange = getPhoneNumberLengthRange(selectedCountry);

  if (!fullName) errors.full_name = "Full name is required";
  if (!email) errors.email = "Email is required";
  else if (!validateEmail(email)) errors.email = "Enter a valid email address";
  if (!form.password) errors.password = "Temporary password is required";
  else if (form.password.length < 8) errors.password = "Password must be at least 8 characters";
  if (!form.confirm_password) errors.confirm_password = "Confirm password is required";
  else if (form.password !== form.confirm_password) errors.confirm_password = "Passwords do not match";
  if (!form.role_code) errors.role_code = "Select one role";

  if (phoneDigits || form.country_code.trim()) {
    if (!selectedCountry) errors.country = "Select a supported country dial code";
    if (phoneDigits && (phoneDigits.length < phoneRange.min || phoneDigits.length > phoneRange.max)) {
      errors.phone_number =
        phoneRange.min === phoneRange.max
          ? `Enter ${phoneRange.min} digits for ${selectedCountry?.name ?? "this dial code"}`
          : `Enter ${phoneRange.min} to ${phoneRange.max} digits for ${selectedCountry?.name ?? "this dial code"}`;
    }
  }

  return {
    errors,
    phone: selectedCountry && phoneDigits ? `${selectedCountry.dialCode} ${phoneDigits}` : null,
  };
}

function validateEditForm(form: EditUserForm, requireRole: boolean): { errors: FieldErrors; phone: string | null } {
  const errors: FieldErrors = {};
  const fullName = form.full_name.trim();
  const email = normalizeEmail(form.email);
  const phone = form.phone_number.trim().replace(/\s+/g, " ");
  const phoneDigits = digitsOnly(form.phone_number);

  if (!fullName) errors.full_name = "Full name is required";
  if (!email) errors.email = "Email is required";
  else if (!validateEmail(email)) errors.email = "Enter a valid email address";
  if (phone && (phoneDigits.length < 6 || phoneDigits.length > 15)) errors.phone_number = "Enter 6 to 15 digits";
  if (requireRole && !form.role_code) errors.role_code = "Select one role";

  return {
    errors,
    phone: phone || null,
  };
}

function validateResetForm(form: ResetPasswordForm): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.new_password) errors.new_password = "New password is required";
  else if (form.new_password.length < 8) errors.new_password = "Password must be at least 8 characters";
  if (!form.confirm_password) errors.confirm_password = "Confirm password is required";
  else if (form.new_password !== form.confirm_password) errors.confirm_password = "Passwords do not match";
  return errors;
}

export function UserManagementPage() {
  const { hasPermission } = useAuth();
  const header = getPageHeaderConfig("user-management");

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const [panelMode, setPanelMode] = useState<PanelMode | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateUserForm>(() => getInitialCreateForm());
  const [editForm, setEditForm] = useState<EditUserForm>({
    full_name: "",
    email: "",
    designation: "",
    department: "",
    phone_number: "",
    is_locked: false,
    role_code: "",
  });
  const [resetForm, setResetForm] = useState<ResetPasswordForm>(emptyResetForm);
  const [resetOpen, setResetOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [originalEditRoleCodes, setOriginalEditRoleCodes] = useState<string[]>([]);
  const [dialCodeSearch, setDialCodeSearch] = useState(() => getInitialCreateForm().country_code);
  const [dialCodeSuggestionsOpen, setDialCodeSuggestionsOpen] = useState(false);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextUsers, nextRoles] = await Promise.all([listUsers(true), listRoles(true)]);
      setUsers(nextUsers);
      setRoles(nextRoles);
      setSelectedUserId((current) => {
        if (current && nextUsers.some((user) => user.id === current)) return current;
        return nextUsers[0]?.id ?? null;
      });
    } catch (loadError: any) {
      const message = loadError?.response?.data?.detail || "Failed to load users";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roleOptions = useMemo(() => roles.filter((role) => role.is_active), [roles]);
  const roleNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((role) => map.set(role.role_code, role.role_name));
    return map;
  }, [roles]);

  const activeFilters: ActiveFilter[] = useMemo(() => {
    const filters: ActiveFilter[] = [];
    if (search.trim()) filters.push({ key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") });
    if (statusFilter !== "ALL") {
      filters.push({
        key: "status",
        label: `Status: ${statusFilter === "ACTIVE" ? "Active" : statusFilter === "INACTIVE" ? "Inactive" : "Locked"}`,
        onRemove: () => setStatusFilter("ALL"),
      });
    }
    if (roleFilter !== "ALL") {
      filters.push({ key: "role", label: `Role: ${roleLabel(roleFilter, roleNameByCode)}`, onRemove: () => setRoleFilter("ALL") });
    }
    return filters;
  }, [roleFilter, roleNameByCode, search, statusFilter]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      if (query && !userSearchText(user, roleNameByCode).includes(query)) return false;
      if (statusFilter === "ACTIVE" && (!user.is_active || user.is_locked)) return false;
      if (statusFilter === "INACTIVE" && user.is_active) return false;
      if (statusFilter === "LOCKED" && !user.is_locked) return false;
      if (roleFilter !== "ALL" && !user.roles.includes(roleFilter)) return false;
      return true;
    });
  }, [roleFilter, roleNameByCode, search, statusFilter, users]);

  const selectedCreateCountry = useMemo(
    () => findCountryDialCode(createForm.country) ?? findCountryDialCodeByDialCode(createForm.country_code),
    [createForm.country, createForm.country_code],
  );
  const dialCodeSuggestions = useMemo(
    () => searchCountryDialCodes(dialCodeSearch || createForm.country || createForm.country_code),
    [createForm.country, createForm.country_code, dialCodeSearch],
  );
  const createPhoneRange = useMemo(() => getPhoneNumberLengthRange(selectedCreateCountry), [selectedCreateCountry]);
  const createPhoneDigitCount = digitsOnly(createForm.phone_number).length;
  const createPhoneCounter = createPhoneDigitCount > 0
    ? ` (${createPhoneDigitCount}/${createPhoneRange.min === createPhoneRange.max ? createPhoneRange.max : `${createPhoneRange.min}-${createPhoneRange.max}`})`
    : "";
  const createPhoneHint = selectedCreateCountry
    ? `${selectedCreateCountry.name} (${selectedCreateCountry.dialCode}) - ${formatPhoneNumberLengthHint(selectedCreateCountry)}${createPhoneCounter}`
    : "Search country or dial code";

  const getRoleSelectOptions = (currentRoleCode: string) => {
    if (!currentRoleCode || roleOptions.some((role) => role.role_code === currentRoleCode)) return roleOptions;
    const currentRole = roles.find((role) => role.role_code === currentRoleCode);
    return currentRole ? [currentRole, ...roleOptions] : roleOptions;
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setRoleFilter("ALL");
  };

  const clearPanelState = () => {
    setFieldErrors({});
    setResetForm(emptyResetForm);
    setResetOpen(false);
    setStatusAction(null);
    setDialCodeSuggestionsOpen(false);
  };

  const closePanel = () => {
    setPanelMode(null);
    clearPanelState();
  };

  const seedEditForm = (user: UserRecord) => {
    setSelectedUserId(user.id);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      designation: user.designation ?? "",
      department: user.department ?? "",
      phone_number: user.phone ?? "",
      is_locked: user.is_locked,
      role_code: user.roles[0] ?? "",
    });
    setOriginalEditRoleCodes(user.roles);
    clearPanelState();
  };

  const openCreate = () => {
    const nextForm = getInitialCreateForm();
    setCreateForm(nextForm);
    setDialCodeSearch(nextForm.country_code);
    setSelectedUserId(null);
    clearPanelState();
    setPanelMode("create");
  };

  const openUserPanel = (user: UserRecord, mode: Exclude<PanelMode, "create">) => {
    seedEditForm(user);
    setPanelMode(mode);
  };

  const selectDialCodeCountry = (country: CountryDialCode) => {
    const phoneRange = getPhoneNumberLengthRange(country);
    setCreateForm((current) => ({
      ...current,
      country: country.name,
      country_code: country.dialCode,
      phone_number: digitsOnly(current.phone_number).slice(0, phoneRange.max),
    }));
    setDialCodeSearch(country.dialCode);
    setDialCodeSuggestionsOpen(false);
    setFieldErrors((current) => ({ ...current, country: undefined, phone_number: undefined }));
  };

  const updateDialCodeSearch = (value: string) => {
    setDialCodeSearch(value);
    setDialCodeSuggestionsOpen(true);
    const exactCountry = findCountryDialCodeByDialCode(value) ?? findCountryDialCode(value);
    if (exactCountry) {
      const phoneRange = getPhoneNumberLengthRange(exactCountry);
      setCreateForm((current) => ({
        ...current,
        country: exactCountry.name,
        country_code: exactCountry.dialCode,
        phone_number: digitsOnly(current.phone_number).slice(0, phoneRange.max),
      }));
      setFieldErrors((current) => ({ ...current, country: undefined, phone_number: undefined }));
      return;
    }
    setCreateForm((current) => ({
      ...current,
      country: value,
      country_code: value.trim().startsWith("+") ? value.trim() : current.country_code,
    }));
  };

  const updateCreateField = (field: keyof CreateUserForm, value: string) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateEditField = <K extends keyof EditUserForm>(field: K, value: EditUserForm[K]) => {
    setEditForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateCreatePhoneNumber = (value: string) => {
    const phoneDigits = digitsOnly(value).slice(0, createPhoneRange.max);
    setCreateForm((current) => ({ ...current, phone_number: phoneDigits }));
    setFieldErrors((current) => ({ ...current, phone_number: undefined }));
  };

  const createNewUser = async () => {
    const validation = validateCreateForm(createForm);
    if (Object.keys(validation.errors).length > 0) {
      setFieldErrors(validation.errors);
      return;
    }
    setSaving(true);
    try {
      const created = await createUser({
        full_name: createForm.full_name.trim(),
        email: normalizeEmail(createForm.email),
        password: createForm.password,
        designation: createForm.designation.trim() || null,
        department: createForm.department.trim() || null,
        phone: validation.phone,
        role_codes: createForm.role_code ? [createForm.role_code] : [],
      });
      toast.success("User created");
      await load();
      seedEditForm(created);
      setPanelMode("view");
      setCreateForm(getInitialCreateForm());
    } catch (createError: any) {
      toast.error(createError?.response?.data?.detail || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const saveUser = async () => {
    if (!selectedUser) return;
    const validation = validateEditForm(editForm, hasPermission("USER_ASSIGN_ROLE"));
    if (Object.keys(validation.errors).length > 0) {
      setFieldErrors(validation.errors);
      return;
    }
    setSaving(true);
    try {
      let updated = await updateUser(selectedUser.id, {
        full_name: editForm.full_name.trim(),
        email: normalizeEmail(editForm.email),
        designation: editForm.designation.trim() || null,
        department: editForm.department.trim() || null,
        phone: validation.phone,
        is_locked: editForm.is_locked,
      });
      const nextRoleCodes = editForm.role_code ? [editForm.role_code] : [];
      if (hasPermission("USER_ASSIGN_ROLE") && !sameRoles(originalEditRoleCodes, nextRoleCodes)) {
        updated = await setUserRoles(selectedUser.id, nextRoleCodes);
      }
      toast.success("User updated");
      await load();
      seedEditForm(updated);
      setPanelMode("view");
    } catch (updateError: any) {
      toast.error(updateError?.response?.data?.detail || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const applyStatusAction = async () => {
    if (!statusAction) return;
    setSaving(true);
    try {
      const updated = await setUserActive(statusAction.user.id, statusAction.nextActive);
      toast.success(statusAction.nextActive ? "User activated" : "User deactivated");
      await load();
      seedEditForm(updated);
      setStatusAction(null);
      if (!panelMode) setPanelMode("view");
    } catch (statusError: any) {
      toast.error(statusError?.response?.data?.detail || "Failed to update user status");
    } finally {
      setSaving(false);
    }
  };

  const submitPasswordReset = async () => {
    if (!selectedUser) return;
    const errors = validateResetForm(resetForm);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    try {
      const updated = await resetUserPassword(selectedUser.id, resetForm.new_password);
      toast.success("Password reset");
      await load();
      seedEditForm(updated);
      setResetForm(emptyResetForm);
      setResetOpen(false);
    } catch (resetError: any) {
      toast.error(resetError?.response?.data?.detail || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  const panelTitle =
    panelMode === "create"
      ? "Add User"
      : selectedUser
        ? selectedUser.full_name
        : "User Detail";

  const panelDescription =
    panelMode === "create"
      ? "Create an application user account"
      : panelMode === "edit"
        ? "Edit user profile and role assignment"
        : selectedUser
          ? `${selectedUser.email} | ${selectedUser.roles.length ? "Role assigned" : "No role assigned"}`
          : undefined;

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="User Management"
        subtitle="Manage application users, account status, and assigned roles"
        primaryAction={hasPermission("USER_CREATE") ? { key: "add-user", label: "Add User", variant: "default", icon: "plus", onClick: openCreate } : undefined}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <FilterBar activeFilters={activeFilters} onClearAll={activeFilters.length ? clearFilters : undefined} className="shadow-sm">
          <div className="w-full min-w-64 flex-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
            <SearchInput
              value={search}
              placeholder="Search by name, email, phone, or role"
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              className="h-9 bg-white"
            />
          </div>
          <label className="flex w-full flex-col gap-1.5 sm:w-40">
            <span className="text-sm font-medium text-slate-700">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="LOCKED">Locked</option>
            </select>
          </label>
          <label className="flex w-full flex-col gap-1.5 sm:w-56">
            <span className="text-sm font-medium text-slate-700">Role</span>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
            >
              <option value="ALL">All roles</option>
              {roles.map((role) => (
                <option key={role.role_code} value={role.role_code}>
                  {role.role_name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="button" variant="secondary" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : null)} />
              Refresh
            </Button>
            <PermissionGuard permission="USER_CREATE">
              <Button type="button" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Add User
              </Button>
            </PermissionGuard>
          </div>
        </FilterBar>

        {statusAction && !panelMode ? (
          <ConfirmStrip
            title={statusAction.nextActive ? "Activate user?" : "Deactivate user?"}
            message={`This will ${statusAction.nextActive ? "activate" : "deactivate"} ${statusAction.user.full_name}.`}
            confirmLabel={statusAction.nextActive ? "Activate" : "Deactivate"}
            onConfirm={() => void applyStatusAction()}
            onCancel={() => setStatusAction(null)}
            disabled={saving}
            tone={statusAction.nextActive ? "warning" : "danger"}
          />
        ) : null}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Application Users</h2>
              <p className="mt-1 text-xs text-slate-500">{filteredUsers.length} of {users.length} users shown.</p>
            </div>
            {loading && users.length > 0 ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Refreshing
              </div>
            ) : null}
          </div>

          {loading && users.length === 0 ? (
            <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">Loading users...</div>
          ) : error && users.length === 0 ? (
            <EmptyState
              title="Unable to load users"
              description={error}
              icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
              action={<Button type="button" variant="secondary" onClick={() => void load()}>Try Again</Button>}
              className="m-4 min-h-72 bg-white"
            />
          ) : filteredUsers.length === 0 ? (
            <EmptyState
              title={users.length === 0 ? "No users found" : "No users match the filters"}
              description={users.length === 0 ? "Add the first application user to begin assigning roles." : "Adjust search, status, or role filters."}
              className="m-4 min-h-72 bg-white"
            />
          ) : (
            <Table containerClassName="max-h-[62vh]">
              <TableHeader className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <TableRow>
                  <TableHead className="min-w-60 px-4">Name</TableHead>
                  <TableHead className="min-w-64 px-4">Email</TableHead>
                  <TableHead className="min-w-32 px-4">Status</TableHead>
                  <TableHead className="min-w-56 px-4">Roles</TableHead>
                  <TableHead className="min-w-44 px-4">Created</TableHead>
                  <TableHead className="min-w-44 px-4">Last Login</TableHead>
                  <TableHead className="min-w-72 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id} className="cursor-pointer hover:bg-blue-50/40" onClick={() => openUserPanel(user, "view")}>
                    <TableCell className="px-4">
                      <div className="font-semibold text-slate-900">{user.full_name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{user.designation || user.department || user.phone || "-"}</div>
                    </TableCell>
                    <TableCell className="px-4 text-slate-700">{user.email}</TableCell>
                    <TableCell className="px-4"><UserStatusBadge user={user} /></TableCell>
                    <TableCell className="px-4"><RoleChips roles={user.roles} roleNameByCode={roleNameByCode} /></TableCell>
                    <TableCell className="px-4 text-slate-600">{formatDateTime(user.created_at)}</TableCell>
                    <TableCell className="px-4 text-slate-600">{formatDateTime(user.last_login_at)}</TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-wrap justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                        <PermissionGuard permission="USER_UPDATE">
                          <Button type="button" variant="ghost" size="sm" onClick={() => openUserPanel(user, "edit")}>
                            View/Edit
                          </Button>
                        </PermissionGuard>
                        {user.is_active ? (
                          <PermissionGuard permission="USER_DELETE">
                            <Button type="button" variant="outline" size="sm" onClick={() => setStatusAction({ user, nextActive: false })}>
                              <UserX className="h-4 w-4" />
                              Deactivate
                            </Button>
                          </PermissionGuard>
                        ) : (
                          <PermissionGuard permission="USER_UPDATE">
                            <Button type="button" variant="outline" size="sm" onClick={() => setStatusAction({ user, nextActive: true })}>
                              <UserCheck className="h-4 w-4" />
                              Activate
                            </Button>
                          </PermissionGuard>
                        )}
                        <PermissionGuard permission="USER_UPDATE">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              seedEditForm(user);
                              setPanelMode("view");
                              setResetOpen(true);
                            }}
                          >
                            <KeyRound className="h-4 w-4" />
                            Reset Password
                          </Button>
                        </PermissionGuard>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <RightPanel
        open={Boolean(panelMode)}
        onClose={closePanel}
        title={panelTitle}
        description={panelDescription}
        widthClassName="max-w-2xl"
        footer={
          panelMode === "create" ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={closePanel} disabled={saving}>Cancel</Button>
              <PermissionGuard permission="USER_CREATE">
                <Button type="button" onClick={() => void createNewUser()} disabled={saving}>
                  <UserPlus className="h-4 w-4" />
                  Add User
                </Button>
              </PermissionGuard>
            </div>
          ) : panelMode === "edit" ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => selectedUser && openUserPanel(selectedUser, "view")} disabled={saving}>Cancel</Button>
              <PermissionGuard anyOf={["USER_UPDATE", "USER_ASSIGN_ROLE"]}>
                <Button type="button" onClick={() => void saveUser()} disabled={saving}>
                  <Save className="h-4 w-4" />
                  Save User
                </Button>
              </PermissionGuard>
            </div>
          ) : null
        }
      >
        <div className="space-y-4">
          {statusAction && panelMode ? (
            <ConfirmStrip
              title={statusAction.nextActive ? "Activate user?" : "Deactivate user?"}
              message={`This will ${statusAction.nextActive ? "activate" : "deactivate"} ${statusAction.user.full_name}.`}
              confirmLabel={statusAction.nextActive ? "Activate" : "Deactivate"}
              onConfirm={() => void applyStatusAction()}
              onCancel={() => setStatusAction(null)}
              disabled={saving}
              tone={statusAction.nextActive ? "warning" : "danger"}
            />
          ) : null}

          {panelMode === "create" ? (
            <CreateUserPanel
              form={createForm}
              fieldErrors={fieldErrors}
              roleOptions={roleOptions}
              dialCodeSearch={dialCodeSearch}
              dialCodeSuggestions={dialCodeSuggestions}
              dialCodeSuggestionsOpen={dialCodeSuggestionsOpen}
              createPhoneRange={createPhoneRange}
              createPhoneHint={createPhoneHint}
              onChange={updateCreateField}
              onPhoneChange={updateCreatePhoneNumber}
              onDialCodeSearch={updateDialCodeSearch}
              onDialCodeFocus={() => setDialCodeSuggestionsOpen(true)}
              onDialCodeBlur={() => window.setTimeout(() => setDialCodeSuggestionsOpen(false), 120)}
              onSelectDialCode={selectDialCodeCountry}
            />
          ) : selectedUser && panelMode === "view" ? (
            <UserDetailPanel
              user={selectedUser}
              roleNameByCode={roleNameByCode}
              resetOpen={resetOpen}
              resetForm={resetForm}
              fieldErrors={fieldErrors}
              saving={saving}
              onEdit={() => openUserPanel(selectedUser, "edit")}
              onStatusChange={(nextActive) => setStatusAction({ user: selectedUser, nextActive })}
              onOpenReset={() => {
                setResetOpen(true);
                setResetForm(emptyResetForm);
                setFieldErrors({});
              }}
              onCancelReset={() => {
                setResetOpen(false);
                setResetForm(emptyResetForm);
                setFieldErrors({});
              }}
              onResetFormChange={setResetForm}
              onSubmitReset={() => void submitPasswordReset()}
            />
          ) : selectedUser && panelMode === "edit" ? (
            <EditUserPanel
              user={selectedUser}
              form={editForm}
              fieldErrors={fieldErrors}
              roleOptions={getRoleSelectOptions(editForm.role_code || selectedUser.roles[0] || "")}
              canAssignRole={hasPermission("USER_ASSIGN_ROLE")}
              onChange={updateEditField}
            />
          ) : (
            <EmptyState title="No user selected" description="Select a user row to view account details." />
          )}
        </div>
      </RightPanel>
    </div>
  );
}

function CreateUserPanel({
  form,
  fieldErrors,
  roleOptions,
  dialCodeSearch,
  dialCodeSuggestions,
  dialCodeSuggestionsOpen,
  createPhoneRange,
  createPhoneHint,
  onChange,
  onPhoneChange,
  onDialCodeSearch,
  onDialCodeFocus,
  onDialCodeBlur,
  onSelectDialCode,
}: {
  form: CreateUserForm;
  fieldErrors: FieldErrors;
  roleOptions: RoleRecord[];
  dialCodeSearch: string;
  dialCodeSuggestions: CountryDialCode[];
  dialCodeSuggestionsOpen: boolean;
  createPhoneRange: { min: number; max: number };
  createPhoneHint: string;
  onChange: (field: keyof CreateUserForm, value: string) => void;
  onPhoneChange: (value: string) => void;
  onDialCodeSearch: (value: string) => void;
  onDialCodeFocus: () => void;
  onDialCodeBlur: () => void;
  onSelectDialCode: (country: CountryDialCode) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Full Name" value={form.full_name} onChange={(event) => onChange("full_name", event.target.value)} aria-invalid={Boolean(fieldErrors.full_name)} required />
        <Input label="Email" type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} aria-invalid={Boolean(fieldErrors.email)} required />
        <Input label="Designation" value={form.designation} onChange={(event) => onChange("designation", event.target.value)} />
        <Input label="Department" value={form.department} onChange={(event) => onChange("department", event.target.value)} />
      </div>
      <InlineError error={fieldErrors.full_name || fieldErrors.email} />

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone Number</label>
        <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
          <div className="relative">
            <Input
              inputMode="search"
              value={dialCodeSearch}
              onChange={(event) => onDialCodeSearch(event.target.value)}
              onFocus={onDialCodeFocus}
              onBlur={onDialCodeBlur}
              placeholder="+91"
              aria-label="Search country dial code"
              aria-invalid={Boolean(fieldErrors.country)}
            />
            {dialCodeSuggestionsOpen && dialCodeSuggestions.length > 0 ? (
              <div className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-56 w-72 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                {dialCodeSuggestions.map((country) => (
                  <button
                    key={`${country.iso2}-${country.dialCode}`}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onSelectDialCode(country);
                    }}
                  >
                    <span className="truncate font-medium text-slate-900">{country.name}</span>
                    <span className="shrink-0 text-slate-500">{country.dialCode}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Input
            inputMode="tel"
            value={form.phone_number}
            onChange={(event) => onPhoneChange(event.target.value)}
            maxLength={createPhoneRange.max}
            placeholder="9876543210"
            aria-label="Phone number"
            aria-invalid={Boolean(fieldErrors.phone_number)}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">{createPhoneHint}</p>
        <InlineError error={fieldErrors.country || fieldErrors.phone_number} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Temporary Password" type="password" value={form.password} onChange={(event) => onChange("password", event.target.value)} aria-invalid={Boolean(fieldErrors.password)} required />
        <Input label="Confirm Password" type="password" value={form.confirm_password} onChange={(event) => onChange("confirm_password", event.target.value)} aria-invalid={Boolean(fieldErrors.confirm_password)} required />
      </div>
      <InlineError error={fieldErrors.password || fieldErrors.confirm_password} />

      <RoleSelect
        label="Role"
        value={form.role_code}
        roleOptions={roleOptions}
        onChange={(value) => onChange("role_code", value)}
        error={fieldErrors.role_code}
      />
      {/* TODO: Enable multi-role selection if the backend removes the current max_length=1 role assignment limit. */}
      <p className="text-xs text-slate-500">Backend currently accepts one role per user; multi-role UI can be enabled if that limit changes.</p>
    </div>
  );
}

function EditUserPanel({
  user,
  form,
  fieldErrors,
  roleOptions,
  canAssignRole,
  onChange,
}: {
  user: UserRecord;
  form: EditUserForm;
  fieldErrors: FieldErrors;
  roleOptions: RoleRecord[];
  canAssignRole: boolean;
  onChange: <K extends keyof EditUserForm>(field: K, value: EditUserForm[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Full Name" value={form.full_name} onChange={(event) => onChange("full_name", event.target.value)} aria-invalid={Boolean(fieldErrors.full_name)} required />
        <Input label="Email" type="email" value={form.email} onChange={(event) => onChange("email", event.target.value)} aria-invalid={Boolean(fieldErrors.email)} required />
        <Input label="Designation" value={form.designation} onChange={(event) => onChange("designation", event.target.value)} />
        <Input label="Department" value={form.department} onChange={(event) => onChange("department", event.target.value)} />
        <Input label="Phone" value={form.phone_number} onChange={(event) => onChange("phone_number", event.target.value.replace(/[^\d+\s()-]/g, ""))} aria-invalid={Boolean(fieldErrors.phone_number)} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700">Account Lock</span>
          <span className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm">
            <input type="checkbox" checked={form.is_locked} onChange={(event) => onChange("is_locked", event.target.checked)} />
            Locked
          </span>
        </label>
      </div>
      <InlineError error={fieldErrors.full_name || fieldErrors.email || fieldErrors.phone_number} />

      {canAssignRole ? (
        <>
          <RoleSelect label="Role" value={form.role_code} roleOptions={roleOptions} onChange={(value) => onChange("role_code", value)} error={fieldErrors.role_code} />
          <p className="text-xs text-slate-500">Backend currently accepts one role per user; this selector preserves that behavior.</p>
        </>
      ) : (
        <FieldBlock label="Role Assignment" value={<RoleChips roles={user.roles} roleNameByCode={new Map(roleOptions.map((role) => [role.role_code, role.role_name]))} />} />
      )}
    </div>
  );
}

function UserDetailPanel({
  user,
  roleNameByCode,
  resetOpen,
  resetForm,
  fieldErrors,
  saving,
  onEdit,
  onStatusChange,
  onOpenReset,
  onCancelReset,
  onResetFormChange,
  onSubmitReset,
}: {
  user: UserRecord;
  roleNameByCode: Map<string, string>;
  resetOpen: boolean;
  resetForm: ResetPasswordForm;
  fieldErrors: FieldErrors;
  saving: boolean;
  onEdit: () => void;
  onStatusChange: (nextActive: boolean) => void;
  onOpenReset: () => void;
  onCancelReset: () => void;
  onResetFormChange: (form: ResetPasswordForm) => void;
  onSubmitReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">
          <UserCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <UserStatusBadge user={user} />
            {user.is_locked ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700"><Lock className="h-3 w-3" /> Locked</Badge> : null}
          </div>
          <h2 className="mt-2 text-base font-semibold text-slate-900">{user.full_name}</h2>
          <p className="mt-1 break-all text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Profile</h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <FieldBlock label="Full Name" value={user.full_name} />
          <FieldBlock label="Email" value={user.email} />
          <FieldBlock label="Phone" value={formatValue(user.phone)} />
          <FieldBlock label="Designation" value={formatValue(user.designation)} />
          <FieldBlock label="Department" value={formatValue(user.department)} />
          <FieldBlock label="Status" value={<UserStatusBadge user={user} />} />
          <FieldBlock label="Created" value={formatDateTime(user.created_at)} />
          <FieldBlock label="Last Login" value={formatDateTime(user.last_login_at)} />
          <FieldBlock label="Password Changed" value={formatDateTime(user.password_changed_at)} />
          <FieldBlock label="Failed Logins" value={user.failed_login_count ?? 0} />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Assigned Role</h3>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <RoleChips roles={user.roles} roleNameByCode={roleNameByCode} />
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <PermissionGuard permission="USER_UPDATE">
          <Button type="button" variant="secondary" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        </PermissionGuard>
        {user.is_active ? (
          <PermissionGuard permission="USER_DELETE">
            <Button type="button" variant="outline" onClick={() => onStatusChange(false)}>
              <UserX className="h-4 w-4" />
              Deactivate
            </Button>
          </PermissionGuard>
        ) : (
          <PermissionGuard permission="USER_UPDATE">
            <Button type="button" variant="outline" onClick={() => onStatusChange(true)}>
              <UserCheck className="h-4 w-4" />
              Activate
            </Button>
          </PermissionGuard>
        )}
        <PermissionGuard permission="USER_UPDATE">
          <Button type="button" variant="outline" onClick={onOpenReset}>
            <KeyRound className="h-4 w-4" />
            Reset Password
          </Button>
        </PermissionGuard>
      </div>

      {resetOpen ? (
        <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div>
            <h3 className="text-sm font-semibold text-amber-950">Reset Password</h3>
            <p className="mt-1 text-xs text-amber-800">Enter a new temporary password for this user.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label="New Password"
              type="password"
              value={resetForm.new_password}
              onChange={(event) => onResetFormChange({ ...resetForm, new_password: event.target.value })}
              aria-invalid={Boolean(fieldErrors.new_password)}
            />
            <Input
              label="Confirm Password"
              type="password"
              value={resetForm.confirm_password}
              onChange={(event) => onResetFormChange({ ...resetForm, confirm_password: event.target.value })}
              aria-invalid={Boolean(fieldErrors.confirm_password)}
            />
          </div>
          <InlineError error={fieldErrors.new_password || fieldErrors.confirm_password} />
          <ConfirmStrip
            title="Reset this user's password?"
            message="The user will need the new temporary password to sign in."
            confirmLabel="Reset Password"
            onConfirm={onSubmitReset}
            onCancel={onCancelReset}
            disabled={saving}
            tone="warning"
          />
        </section>
      ) : null}
    </div>
  );
}

function RoleSelect({
  label,
  value,
  roleOptions,
  onChange,
  error,
}: {
  label: string;
  value: string;
  roleOptions: RoleRecord[];
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/50"
        aria-invalid={Boolean(error)}
      >
        <option value="">Select role</option>
        {roleOptions.map((role) => (
          <option key={role.role_code} value={role.role_code}>
            {role.role_name}
          </option>
        ))}
      </select>
      <InlineError error={error} />
    </label>
  );
}

function InlineError({ error }: { error?: string }) {
  return error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null;
}
