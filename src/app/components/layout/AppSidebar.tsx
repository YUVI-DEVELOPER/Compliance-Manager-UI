import React, { useState } from "react";
import { BarChart3, Building2, FileText, GitBranch, KeyRound, LogOut, Settings, ShieldCheck, Users } from "lucide-react";

import { canAccessRule, PAGE_ACCESS_RULES } from "../../auth/accessPolicy";
import type { NavPage } from "../../auth/accessPolicy";
import { useAuth } from "../../auth/useAuth";

export type { NavPage } from "../../auth/accessPolicy";
export { canAccessNavPage, DEFAULT_NAV_PAGE, getFirstAllowedPage } from "../../auth/accessPolicy";

interface NavItem {
  key: NavPage;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const iconClass = "h-4.5 w-4.5";

const navItems: NavItem[] = [
  { key: "org-structure", label: "Org Structure", group: "Management", icon: <Building2 className={iconClass} /> },
  { key: "supplier", label: "Supplier", group: "Management", icon: <Users className={iconClass} /> },
  { key: "asset-specs", label: "Asset Specs", group: "Management", icon: <FileText className={iconClass} /> },
  { key: "asset", label: "Asset", group: "Management", icon: <Settings className={iconClass} /> },
  { key: "asset-grouping", label: "Asset Grouping", group: "Management", icon: <GitBranch className={iconClass} /> },
  { key: "user-management", label: "User Management", group: "Configuration", icon: <Users className={iconClass} /> },
  { key: "role-management", label: "Role Management", group: "Configuration", icon: <ShieldCheck className={iconClass} /> },
  { key: "permission-management", label: "Permissions", group: "Configuration", icon: <KeyRound className={iconClass} /> },
  { key: "lookup-master", label: "Lookup Master", group: "Configuration", icon: <Settings className={iconClass} /> },
  { key: "lookup-values", label: "Lookup Values", group: "Configuration", icon: <KeyRound className={iconClass} /> },
  { key: "periodic-review", label: "Periodic Review", group: "Analytics", icon: <ShieldCheck className={iconClass} /> },
  { key: "document-portal", label: "Document Portal", group: "Analytics", icon: <FileText className={iconClass} /> },
  { key: "reports", label: "Asset Inventory Report", group: "Analytics", icon: <BarChart3 className={iconClass} /> },
  { key: "infrastructure-graph", label: "Infrastructure Graph", group: "Analytics", icon: <GitBranch className={iconClass} /> },
];

const groups = ["Management", "Configuration", "Analytics"];

interface AppSidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
}

export function AppSidebar({ activePage, onNavigate }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { hasAnyPermission, logout, user } = useAuth();
  const visibleNavItems = navItems.filter((item) => {
    const rule = PAGE_ACCESS_RULES[item.key];
    return rule ? canAccessRule(rule, hasAnyPermission) : false;
  });
  const initials = (user?.full_name || user?.email || "U")
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";

  return (
    <aside
      className="flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-200 shrink-0"
      style={{ width: collapsed ? "64px" : "240px" }}
    >
      <div className="h-16 flex items-center px-4 border-b border-slate-800 shrink-0 gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 shadow-sm">
          <ShieldCheck className="h-4.5 w-4.5 text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-white font-bold text-sm leading-tight tracking-wide">Compliance Manager</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={`ml-auto w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors ${collapsed ? "mx-auto ml-auto" : ""}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {collapsed
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            }
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {groups.map((group) => {
          const groupItems = visibleNavItems.filter((item) => item.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group} className="mb-1">
              {!collapsed && (
                <div className="px-4 py-1.5">
                  <span className="text-slate-600 text-xs font-semibold uppercase tracking-widest">{group}</span>
                </div>
              )}
              {collapsed && <div className="my-1 border-t border-slate-800/70 mx-3" />}
              {groupItems.map((item) => {
                const isActive = activePage === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => onNavigate(item.key)}
                    title={collapsed ? item.label : undefined}
                    className={[
                      "w-full flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-all duration-150 text-left relative group my-0.5",
                      isActive ? "bg-blue-600/15 text-blue-400" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                      collapsed ? "justify-center" : "",
                    ].join(" ")}
                    style={{ width: "calc(100% - 8px)" }}
                  >
                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r" />}
                    <span className={`shrink-0 ${isActive ? "text-blue-400" : ""}`}>{item.icon}</span>
                    {!collapsed && <span className="text-sm font-medium flex-1 truncate">{item.label}</span>}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                        {item.label}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 py-3 space-y-0.5 px-1">
        <button
          type="button"
          onClick={() => void logout()}
          className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-800 ${collapsed ? "justify-center" : ""}`}
          title={collapsed ? "Logout" : undefined}
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">{initials}</div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-slate-200 text-sm font-medium truncate">{user?.full_name || "User"}</div>
              <div className="text-slate-500 text-xs truncate">{user?.roles?.[0] || "Authenticated"}</div>
            </div>
          )}
          {!collapsed && <LogOut className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
        </button>
      </div>
    </aside>
  );
}
