import { useEffect, useMemo, useState } from "react";
import { BookOpen, Info, Layers, ShieldCheck } from "lucide-react";

import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { EmptyState, FilterBar, StatusBadge } from "../components/foundation";
import { SearchInput } from "../components/ui/input";
import type { GroupedPermissions, PermissionRecord } from "../../services/rbac.service";
import { listPermissionsGrouped } from "../../services/rbac.service";

interface PermissionModule {
  moduleName: string;
  permissions: PermissionRecord[];
}

const MODULE_LABELS: Record<string, string> = {
  ASSET: "Asset",
  DOCUMENT: "Document",
  SUPPLIER: "Supplier",
  ORG: "Organization",
  ORGANIZATION: "Organization",
  USER: "User",
  ROLE: "Role",
  REPORT: "Report",
  AUDIT: "Audit",
  LOOKUP: "Lookup",
  SYSTEM: "System",
};

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function moduleNameFromPermission(permission: PermissionRecord, fallbackModule?: string): string {
  const explicitModule = permission.module_name || fallbackModule;
  if (explicitModule?.trim()) return titleCase(explicitModule.trim());

  const prefix = permission.permission_code.split("_")[0]?.toUpperCase();
  return MODULE_LABELS[prefix] ?? titleCase(prefix || "System");
}

function normalizeModules(groups: GroupedPermissions[]): PermissionModule[] {
  const moduleMap = new Map<string, PermissionRecord[]>();

  groups.forEach((group) => {
    group.permissions.forEach((permission) => {
      const moduleName = moduleNameFromPermission(permission, group.module_name);
      moduleMap.set(moduleName, [...(moduleMap.get(moduleName) ?? []), permission]);
    });
  });

  return Array.from(moduleMap.entries())
    .map(([moduleName, permissions]) => ({
      moduleName,
      permissions: [...permissions].sort((first, second) => first.permission_code.localeCompare(second.permission_code)),
    }))
    .sort((first, second) => first.moduleName.localeCompare(second.moduleName));
}

function permissionMatches(permission: PermissionRecord, moduleName: string, searchTerm: string): boolean {
  if (!searchTerm) return true;

  const searchableText = [
    moduleName,
    permission.permission_code,
    permission.permission_name,
    permission.description,
    permission.action_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(searchTerm);
}

export function PermissionManagementPage() {
  const [modules, setModules] = useState<GroupedPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedModule, setSelectedModule] = useState("all");
  const header = getPageHeaderConfig("permission-management");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setModules(await listPermissionsGrouped(true));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const normalizedModules = useMemo(() => normalizeModules(modules), [modules]);
  const moduleOptions = useMemo(() => normalizedModules.map((module) => module.moduleName), [normalizedModules]);
  const totalPermissions = useMemo(
    () => normalizedModules.reduce((total, module) => total + module.permissions.length, 0),
    [normalizedModules],
  );
  const activePermissions = useMemo(
    () => normalizedModules.reduce((total, module) => total + module.permissions.filter((permission) => permission.is_active).length, 0),
    [normalizedModules],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredModules = useMemo(
    () =>
      normalizedModules
        .filter((module) => selectedModule === "all" || module.moduleName === selectedModule)
        .map((module) => ({
          ...module,
          permissions: module.permissions.filter((permission) => permissionMatches(permission, module.moduleName, normalizedSearch)),
        }))
        .filter((module) => module.permissions.length > 0),
    [normalizedModules, normalizedSearch, selectedModule],
  );
  const filteredPermissionCount = useMemo(
    () => filteredModules.reduce((total, module) => total + module.permissions.length, 0),
    [filteredModules],
  );
  const hasActiveFilters = Boolean(normalizedSearch || selectedModule !== "all");

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Permissions"
        subtitle="System permission catalog grouped by module"
        stats={[
          { key: "modules", label: "Modules", value: moduleOptions.length, tone: "blue" },
          { key: "permissions", label: "Permissions", value: totalPermissions, tone: "emerald" },
          { key: "active", label: "Active", value: activePermissions, tone: "violet" },
        ]}
      />
      <div className={PAGE_CONTENT_CLASS}>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <div className="flex gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Permissions are system-defined. Use Role Management to assign permissions to roles.</p>
          </div>
        </div>

        <FilterBar
          activeFilters={[
            ...(search.trim() ? [{ key: "search", label: `Search: ${search.trim()}`, onRemove: () => setSearch("") }] : []),
            ...(selectedModule !== "all" ? [{ key: "module", label: `Module: ${selectedModule}`, onRemove: () => setSelectedModule("all") }] : []),
          ]}
          onClearAll={hasActiveFilters ? () => {
            setSearch("");
            setSelectedModule("all");
          } : undefined}
        >
          <div className="min-w-64 flex-1">
            <SearchInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
              placeholder="Search code, name, description, or module..."
              className="h-10"
            />
          </div>
          <label className="flex min-w-56 flex-col gap-1.5 text-sm font-medium text-slate-700">
            Module
            <select
              value={selectedModule}
              onChange={(event) => setSelectedModule(event.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition-[color,box-shadow] focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All modules</option>
              {moduleOptions.map((moduleName) => (
                <option key={moduleName} value={moduleName}>
                  {moduleName}
                </option>
              ))}
            </select>
          </label>
        </FilterBar>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            Loading permissions...
          </div>
        ) : error ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Error loading permissions"
            description={error}
          />
        ) : filteredModules.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {filteredModules.map((module) => (
              <section key={module.moduleName} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-slate-900">{module.moduleName}</h2>
                        <p className="text-xs text-slate-500">System-defined module permission set</p>
                      </div>
                    </div>
                    <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {module.permissions.length} permissions
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {module.permissions.map((permission) => (
                    <div key={permission.id} className="px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-800">
                              {permission.permission_code}
                            </span>
                            {permission.is_system_permission ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500">
                                <BookOpen className="h-3 w-3" />
                                System
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-2 text-sm font-medium text-slate-900">
                            {permission.permission_name || permission.action_name || permission.permission_code}
                          </div>
                          {permission.description ? (
                            <p className="mt-1 text-sm leading-6 text-slate-500">{permission.description}</p>
                          ) : null}
                        </div>
                        <StatusBadge status={permission.is_active ? "active" : "inactive"} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title={totalPermissions === 0 ? "No permissions found" : "No permissions match"}
            description={
              totalPermissions === 0
                ? "The permission catalog did not return any system permissions."
                : "Adjust the search text or module filter to see matching permissions."
            }
          />
        )}
        {!loading && !error && filteredModules.length > 0 ? (
          <div className="text-xs text-slate-500">
            Showing {filteredPermissionCount} of {totalPermissions} permissions
          </div>
        ) : null}
      </div>
    </div>
  );
}
