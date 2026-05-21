import { useEffect, useState } from "react";

import { PermissionGuard } from "../auth/PermissionGuard";
import { Button } from "../components/ui/button";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { GroupedPermissions, listPermissionsGrouped, setPermissionActive } from "../../services/rbac.service";

export function PermissionManagementPage() {
  const [modules, setModules] = useState<GroupedPermissions[]>([]);
  const [loading, setLoading] = useState(true);
  const header = getPageHeaderConfig("permission-management");

  const load = async () => {
    setLoading(true);
    try {
      setModules(await listPermissionsGrouped(true));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader breadcrumbs={header.breadcrumbs} sectionLabel={header.sectionLabel} title={header.title} subtitle={header.subtitle} />
      <div className={PAGE_CONTENT_CLASS}>
        {modules.map((module) => (
          <section key={module.module_name} className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">{module.module_name}</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {module.permissions.map((permission) => (
                <div key={permission.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium text-slate-900">{permission.permission_code}</div>
                    <div className="text-sm text-slate-500">{permission.permission_name}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={permission.is_active ? "text-sm text-emerald-700" : "text-sm text-slate-500"}>
                      {permission.is_active ? "Active" : "Inactive"}
                    </span>
                    <PermissionGuard permission="ROLE_ASSIGN_PERMISSION">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void setPermissionActive(permission.id, !permission.is_active).then(load)}
                      >
                        {permission.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </PermissionGuard>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        {modules.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-12 text-center text-slate-500">
            {loading ? "Loading permissions..." : "No permissions found"}
          </div>
        )}
      </div>
    </div>
  );
}
