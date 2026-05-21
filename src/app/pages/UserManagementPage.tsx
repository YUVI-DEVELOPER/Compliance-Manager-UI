import React, { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Save, UserCheck, UserPlus, UserX, X } from "lucide-react";
import { toast } from "sonner";

import { PermissionGuard } from "../auth/PermissionGuard";
import { useAuth } from "../auth/useAuth";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
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
  RoleRecord,
  setUserActive,
  setUserRoles,
  updateUser,
  UserRecord,
} from "../../services/rbac.service";

type UserFormCard = "create" | null;

interface CreateUserForm {
  full_name: string;
  email: string;
  country: string;
  country_code: string;
  phone_number: string;
  password: string;
  confirm_password: string;
  role_code: string;
}

interface InlineEditUserForm {
  full_name: string;
  email: string;
  phone_number: string;
  role_code: string;
}

type FieldErrors = Partial<Record<keyof CreateUserForm | keyof InlineEditUserForm, string>>;

function getInitialForm(): CreateUserForm {
  const country = getBrowserCountryDialCode();
  return {
    full_name: "",
    email: "",
    country: country?.name ?? "",
    country_code: country?.dialCode ?? "",
    phone_number: "",
    password: "",
    confirm_password: "",
    role_code: "",
  };
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function validateForm(form: CreateUserForm): {
  errors: FieldErrors;
  phone: string | null;
} {
  const errors: FieldErrors = {};
  const fullName = form.full_name.trim();
  const email = form.email.trim();
  const country = findCountryDialCode(form.country);
  const dialCodeCountry = findCountryDialCodeByDialCode(form.country_code);
  const selectedCountry = country ?? dialCodeCountry;
  const phoneRange = getPhoneNumberLengthRange(selectedCountry);
  const phoneDigits = digitsOnly(form.phone_number);

  if (!fullName) errors.full_name = "User name is required";
  if (!email) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address";
  }

  if (!form.country_code.trim()) {
    errors.country = "Select a country dial code";
  } else if (!selectedCountry) {
    errors.country = "Select a supported country dial code";
  }

  if (!phoneDigits) {
    errors.phone_number = "Phone number is required";
  } else if (phoneDigits.length < phoneRange.min || phoneDigits.length > phoneRange.max) {
    errors.phone_number =
      phoneRange.min === phoneRange.max
        ? `Enter ${phoneRange.min} digits for ${selectedCountry?.name ?? "this dial code"}`
        : `Enter ${phoneRange.min} to ${phoneRange.max} digits for ${selectedCountry?.name ?? "this dial code"}`;
  }

  if (!form.role_code) errors.role_code = "Select one role";

  if (!form.password) {
    errors.password = "Password is required";
  } else if (form.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (!form.confirm_password) {
    errors.confirm_password = "Confirm password is required";
  } else if (form.confirm_password !== form.password) {
    errors.confirm_password = "Passwords do not match";
  }

  return {
    errors,
    phone: selectedCountry && phoneDigits ? `${selectedCountry.dialCode} ${phoneDigits}` : null,
  };
}

function validateInlineEditForm(form: InlineEditUserForm, requireRole: boolean): {
  errors: FieldErrors;
  phone: string | null;
} {
  const errors: FieldErrors = {};
  const fullName = form.full_name.trim();
  const email = form.email.trim();
  const phone = form.phone_number.trim().replace(/\s+/g, " ");
  const phoneDigits = digitsOnly(form.phone_number);

  if (!fullName) errors.full_name = "User name is required";
  if (!email) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Enter a valid email address";
  }

  if (phone && (phoneDigits.length < 6 || phoneDigits.length > 15)) {
    errors.phone_number = "Enter 6 to 15 digits";
  }
  if (requireRole && !form.role_code) errors.role_code = "Select one role";

  return {
    errors,
    phone: phone || null,
  };
}

export function UserManagementPage() {
  const { hasPermission } = useAuth();
  const [formCard, setFormCard] = useState<UserFormCard>(null);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(() => getInitialForm());
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<InlineEditUserForm>(() => ({
    full_name: "",
    email: "",
    phone_number: "",
    role_code: "",
  }));
  const [dialCodeSearch, setDialCodeSearch] = useState(() => getInitialForm().country_code);
  const [dialCodeSuggestionsOpen, setDialCodeSuggestionsOpen] = useState(false);
  const [originalEditRoleCodes, setOriginalEditRoleCodes] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const header = getPageHeaderConfig("user-management");

  const load = async () => {
    setLoading(true);
    try {
      const [nextUsers, nextRoles] = await Promise.all([listUsers(true), listRoles(false)]);
      setUsers(nextUsers);
      setRoles(nextRoles);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const roleOptions = useMemo(() => roles.filter((role) => role.is_active), [roles]);
  const roleNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    roles.forEach((role) => map.set(role.role_code, role.role_name));
    return map;
  }, [roles]);

  const formatRoleCodes = (roleCodes: string[]) => (
    roleCodes.length > 0
      ? roleCodes.map((roleCode) => roleNameByCode.get(roleCode) ?? roleCode).join(", ")
      : "-"
  );

  const getRoleSelectOptions = (currentRoleCode: string) => {
    if (!currentRoleCode || roleOptions.some((role) => role.role_code === currentRoleCode)) return roleOptions;
    const currentRole = roles.find((role) => role.role_code === currentRoleCode);
    return currentRole ? [currentRole, ...roleOptions] : roleOptions;
  };
  const selectedCreateCountry = useMemo(
    () => findCountryDialCode(form.country) ?? findCountryDialCodeByDialCode(form.country_code),
    [form.country, form.country_code],
  );
  const dialCodeSuggestions = useMemo(
    () => searchCountryDialCodes(dialCodeSearch || form.country || form.country_code),
    [dialCodeSearch, form.country, form.country_code],
  );
  const createPhoneRange = useMemo(
    () => getPhoneNumberLengthRange(selectedCreateCountry),
    [selectedCreateCountry],
  );
  const createPhoneDigitCount = digitsOnly(form.phone_number).length;
  const createPhoneCounter = createPhoneDigitCount > 0
    ? ` (${createPhoneDigitCount}/${createPhoneRange.min === createPhoneRange.max ? createPhoneRange.max : `${createPhoneRange.min}-${createPhoneRange.max}`})`
    : "";
  const createPhoneHint = selectedCreateCountry
    ? `${selectedCreateCountry.name} (${selectedCreateCountry.dialCode}) - ${formatPhoneNumberLengthHint(selectedCreateCountry)}${createPhoneCounter}`
    : "Search country or dial code";

  const closeFormCard = () => {
    setFormCard(null);
    setEditUserId(null);
    setOriginalEditRoleCodes([]);
    setFieldErrors({});
  };

  useEffect(() => {
    if (!formCard) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) closeFormCard();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [formCard, saving]);

  const startCreate = () => {
    const initialForm = getInitialForm();
    setForm(initialForm);
    setDialCodeSearch(initialForm.country_code);
    setDialCodeSuggestionsOpen(false);
    setEditUserId(null);
    setFieldErrors({});
    setFormCard("create");
  };

  const selectDialCodeCountry = (country: CountryDialCode) => {
    const phoneRange = getPhoneNumberLengthRange(country);
    setForm((current) => ({
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

    const countryByDial = findCountryDialCodeByDialCode(value);
    const countryByName = findCountryDialCode(value);
    const exactCountry = countryByDial ?? countryByName;
    if (exactCountry) {
      const phoneRange = getPhoneNumberLengthRange(exactCountry);
      setForm((current) => ({
        ...current,
        country: exactCountry.name,
        country_code: exactCountry.dialCode,
        phone_number: digitsOnly(current.phone_number).slice(0, phoneRange.max),
      }));
      setFieldErrors((current) => ({ ...current, country: undefined, phone_number: undefined }));
      return;
    }

    setForm((current) => ({
      ...current,
      country: value,
      country_code: value.trim().startsWith("+") ? value.trim() : current.country_code,
    }));
    setFieldErrors((current) => ({ ...current, country: undefined }));
  };

  const updateField = (field: keyof CreateUserForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const updateCreatePhoneNumber = (value: string) => {
    const phoneDigits = digitsOnly(value).slice(0, createPhoneRange.max);
    setForm((current) => ({ ...current, phone_number: phoneDigits }));
    setFieldErrors((current) => ({ ...current, phone_number: undefined }));
  };

  const updateEditField = (field: keyof InlineEditUserForm, value: string) => {
    setEditForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const startEdit = (user: UserRecord) => {
    setEditUserId(user.id);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      phone_number: user.phone ?? "",
      role_code: user.roles[0] ?? "",
    });
    setOriginalEditRoleCodes(user.roles);
    setFieldErrors({});
    setFormCard(null);
  };

  const cancelEdit = () => {
    setEditUserId(null);
    setOriginalEditRoleCodes([]);
    setFieldErrors({});
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validation = validateForm(form);
    if (Object.keys(validation.errors).length > 0) {
      setFieldErrors(validation.errors);
      return;
    }

    setSaving(true);
    try {
      await createUser({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: validation.phone,
        role_codes: [form.role_code],
      });
      setForm(getInitialForm());
      setFieldErrors({});
      setFormCard(null);
      toast.success("User created");
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to create user");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!editUserId) return;

    const validation = validateInlineEditForm(editForm, hasPermission("USER_ASSIGN_ROLE"));
    if (Object.keys(validation.errors).length > 0) {
      setFieldErrors(validation.errors);
      return;
    }

    setSaving(true);
    try {
      await updateUser(editUserId, {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim(),
        phone: validation.phone,
      });
      const nextRoleCodes = editForm.role_code ? [editForm.role_code] : [];
      const roleCodesChanged =
        originalEditRoleCodes.length !== nextRoleCodes.length
        || originalEditRoleCodes.some((roleCode) => !nextRoleCodes.includes(roleCode));
      if (hasPermission("USER_ASSIGN_ROLE") && roleCodesChanged) {
        await setUserRoles(editUserId, nextRoleCodes);
      }
      setEditUserId(null);
      setOriginalEditRoleCodes([]);
      setFieldErrors({});
      toast.success("User updated");
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to update user");
    } finally {
      setSaving(false);
    }
  };

  const handleInlineEditKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!saving) cancelEdit();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!saving) void submitEdit();
    }
  };

  const inlineEditableInputClass =
    "h-9 border-blue-200 bg-white shadow-sm shadow-blue-100/50 hover:border-blue-400 hover:bg-blue-50/30 focus-visible:border-blue-500 focus-visible:ring-blue-200";
  const inlineEditableSelectClass =
    "h-9 w-full rounded-md border border-blue-200 bg-white px-3 text-sm text-slate-900 shadow-sm shadow-blue-100/50 outline-none transition-colors hover:border-blue-400 hover:bg-blue-50/30 focus:border-blue-500 focus:ring-2 focus:ring-blue-200";
  const renderActionTooltip = (label: string, trigger: React.ReactNode) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{trigger}</span>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader breadcrumbs={header.breadcrumbs} sectionLabel={header.sectionLabel} title={header.title} subtitle={header.subtitle} />
      <div className={PAGE_CONTENT_CLASS}>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <PermissionGuard permission="USER_CREATE">
            <Button type="button" onClick={startCreate}>
              <Plus className="h-4 w-4" />
              Create User
            </Button>
          </PermissionGuard>
        </div>

        {formCard === "create" && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/20 px-4 py-24 backdrop-blur-sm sm:px-6"
            onMouseDown={(event) => {
              if (!saving && event.target === event.currentTarget) closeFormCard();
            }}
          >
            <PermissionGuard permission="USER_CREATE">
            <form
              onSubmit={submit}
              className="w-full max-w-4xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl ring-1 ring-slate-900/5"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-user-title"
            >
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 id="create-user-title" className="text-base font-semibold text-slate-900">Create User</h2>
                </div>
                <Button type="button" variant="outline" onClick={closeFormCard}>
                  Close
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Input
                    label="User name"
                    value={form.full_name}
                    onChange={(event) => updateField("full_name", event.target.value)}
                    placeholder="Full name"
                    required
                    aria-invalid={Boolean(fieldErrors.full_name)}
                  />
                  {fieldErrors.full_name && <p className="mt-1 text-xs text-red-600">{fieldErrors.full_name}</p>}
                </div>

                <div>
                  <Input
                    label="Email"
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    placeholder="user@company.com"
                    required
                    aria-invalid={Boolean(fieldErrors.email)}
                  />
                  {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="create-user-dial-code">
                    Phone number
                  </label>
                  <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
                    <div className="relative">
                      <Input
                        id="create-user-dial-code"
                        inputMode="search"
                        value={dialCodeSearch}
                        onChange={(event) => updateDialCodeSearch(event.target.value)}
                        onFocus={() => setDialCodeSuggestionsOpen(true)}
                        onBlur={() => window.setTimeout(() => setDialCodeSuggestionsOpen(false), 120)}
                        placeholder="+91 or India"
                        aria-label="Search country dial code"
                        aria-invalid={Boolean(fieldErrors.country)}
                        className="h-10 border-blue-200 bg-white font-medium text-slate-900 shadow-sm shadow-blue-100/50 hover:border-blue-400 focus-visible:border-blue-500 focus-visible:ring-blue-200"
                      />
                      {dialCodeSuggestionsOpen && dialCodeSuggestions.length > 0 && (
                        <div className="absolute left-0 top-[calc(100%+6px)] z-50 max-h-56 w-72 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                          {dialCodeSuggestions.map((country) => (
                            <button
                              key={`${country.iso2}-${country.dialCode}`}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectDialCodeCountry(country);
                              }}
                            >
                              <span className="min-w-0 truncate font-medium text-slate-900">{country.name}</span>
                              <span className="shrink-0 text-slate-500">{country.dialCode}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <Input
                        inputMode="tel"
                        value={form.phone_number}
                        onChange={(event) => updateCreatePhoneNumber(event.target.value)}
                        placeholder="9876543210"
                        maxLength={createPhoneRange.max}
                        required
                        aria-label="Phone number"
                        aria-invalid={Boolean(fieldErrors.phone_number)}
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span className={selectedCreateCountry ? "text-slate-500" : "text-amber-600"}>{createPhoneHint}</span>
                    {(fieldErrors.country || fieldErrors.phone_number) && (
                      <span className="text-red-600">{fieldErrors.country || fieldErrors.phone_number}</span>
                    )}
                  </div>
                </div>

                <div>
                  <Input
                    label="Password"
                    type="password"
                    value={form.password}
                    onChange={(event) => updateField("password", event.target.value)}
                    placeholder="Temporary password"
                    required
                    aria-invalid={Boolean(fieldErrors.password)}
                  />
                  {fieldErrors.password && <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>}
                </div>

                <div>
                  <Input
                    label="Confirm password"
                    type="password"
                    value={form.confirm_password}
                    onChange={(event) => updateField("confirm_password", event.target.value)}
                    placeholder="Confirm password"
                    required
                    aria-invalid={Boolean(fieldErrors.confirm_password)}
                  />
                  {fieldErrors.confirm_password && <p className="mt-1 text-xs text-red-600">{fieldErrors.confirm_password}</p>}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="create-user-role">
                    Role
                  </label>
                  <select
                    id="create-user-role"
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    value={form.role_code}
                    onChange={(event) => updateField("role_code", event.target.value)}
                    required
                    aria-invalid={Boolean(fieldErrors.role_code)}
                  >
                    <option value="">Select role</option>
                    {roleOptions.map((role) => (
                      <option key={role.role_code} value={role.role_code}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.role_code && <p className="mt-1 text-xs text-red-600">{fieldErrors.role_code}</p>}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={saving} onClick={closeFormCard}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <UserPlus className="h-4 w-4" />
                  {saving ? "Creating..." : "Create User"}
                </Button>
              </div>
            </form>
            </PermissionGuard>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">User name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone number</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {users.map((user) => {
                  const isEditing = editUserId === user.id;
                  const editableRoleOptions = getRoleSelectOptions(editForm.role_code || user.roles[0] || "");
                  return (
                  <tr key={user.id} className={isEditing ? "bg-blue-50/40" : "hover:bg-slate-50/60"}>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="min-w-48">
                          <Input
                            value={editForm.full_name}
                            onChange={(event) => updateEditField("full_name", event.target.value)}
                            onKeyDown={handleInlineEditKeyDown}
                            aria-label="User name"
                            aria-invalid={Boolean(fieldErrors.full_name)}
                            className={`${inlineEditableInputClass} font-medium text-slate-900`}
                          />
                          {fieldErrors.full_name && <p className="mt-1 text-xs text-red-600">{fieldErrors.full_name}</p>}
                        </div>
                      ) : (
                        <div className="font-medium text-slate-900">{user.full_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {isEditing ? (
                        <div className="min-w-64">
                          <Input
                            type="email"
                            value={editForm.email}
                            onChange={(event) => updateEditField("email", event.target.value)}
                            onKeyDown={handleInlineEditKeyDown}
                            aria-label="Email"
                            aria-invalid={Boolean(fieldErrors.email)}
                            className={inlineEditableInputClass}
                          />
                          {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
                        </div>
                      ) : (
                        user.email
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {isEditing ? (
                        <div className="min-w-52">
                          <Input
                            inputMode="tel"
                            value={editForm.phone_number}
                            onChange={(event) => updateEditField("phone_number", event.target.value.replace(/[^\d+\s()-]/g, ""))}
                            onKeyDown={handleInlineEditKeyDown}
                            placeholder="+91 9876543210"
                            aria-label="Phone number"
                            aria-invalid={Boolean(fieldErrors.phone_number)}
                            className={inlineEditableInputClass}
                          />
                          {fieldErrors.phone_number && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone_number}</p>}
                        </div>
                      ) : (
                        user.phone || "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {isEditing && hasPermission("USER_ASSIGN_ROLE") ? (
                        <div className="min-w-56">
                          <select
                            className={inlineEditableSelectClass}
                            value={editForm.role_code}
                            onChange={(event) => updateEditField("role_code", event.target.value)}
                            onKeyDown={handleInlineEditKeyDown}
                            aria-label="Role"
                            aria-invalid={Boolean(fieldErrors.role_code)}
                          >
                            <option value="">Select role</option>
                            {editableRoleOptions.map((role) => (
                              <option key={role.role_code} value={role.role_code}>
                                {role.role_name}
                              </option>
                            ))}
                          </select>
                          {fieldErrors.role_code && <p className="mt-1 text-xs text-red-600">{fieldErrors.role_code}</p>}
                        </div>
                      ) : (
                        formatRoleCodes(user.roles)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${
                        user.is_active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}>
                        {user.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            {renderActionTooltip(
                              "Cancel changes",
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={saving}
                                onClick={cancelEdit}
                                aria-label="Cancel changes"
                              >
                                <X className="h-4 w-4" />
                              </Button>,
                            )}
                            {renderActionTooltip(
                              saving ? "Saving changes" : "Save changes",
                              <Button
                                type="button"
                                size="icon"
                                disabled={saving}
                                onClick={() => void submitEdit()}
                                aria-label={saving ? "Saving changes" : "Save changes"}
                              >
                                <Save className="h-4 w-4" />
                              </Button>,
                            )}
                          </>
                        ) : (
                          <>
                            <PermissionGuard anyOf={["USER_UPDATE", "USER_DELETE"]}>
                              {renderActionTooltip(
                                user.is_active ? "Deactivate user" : "Activate user",
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  disabled={loading || Boolean(editUserId)}
                                  onClick={() => void setUserActive(user.id, !user.is_active).then(load)}
                                  aria-label={user.is_active ? "Deactivate user" : "Activate user"}
                                >
                                  {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                </Button>,
                              )}
                            </PermissionGuard>
                            <PermissionGuard permission="USER_UPDATE">
                              {renderActionTooltip(
                                "Edit user",
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  disabled={loading || Boolean(editUserId)}
                                  onClick={() => startEdit(user)}
                                  aria-label="Edit user"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>,
                              )}
                            </PermissionGuard>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={6}>
                      {loading ? "Loading users..." : "No users found"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
