export type NavPage =
  | "login"
  | "user-management"
  | "role-management"
  | "permission-management"
  | "audit-log"
  | "org-structure"
  | "supplier"
  | "asset"
  | "asset-grouping"
  | "asset-specs"
  | "periodic-review"
  | "document-portal"
  | "lookup-master"
  | "lookup-values"
  | "data-entry"
  | "reports"
  | "infrastructure-graph";

export const DEFAULT_NAV_PAGE: NavPage = "asset";

export interface PageAccessRule {
  page: NavPage;
  requiredAnyPermissions: readonly string[];
  requiredAllPermissions?: readonly string[];
  requiredAnyRoles?: readonly string[];
}

// Page-level rules mirror the backend permission source of truth.
export const PAGE_ACCESS_RULES: Partial<Record<NavPage, PageAccessRule>> = {
  "org-structure": {
    page: "org-structure",
    requiredAnyPermissions: ["ORGANIZATION_VIEW"],
  },
  supplier: {
    page: "supplier",
    requiredAnyPermissions: ["SUPPLIER_VIEW"],
  },
  asset: {
    page: "asset",
    requiredAnyPermissions: ["ASSET_VIEW"],
  },
  "asset-grouping": {
    page: "asset-grouping",
    requiredAnyPermissions: ["ASSET_VIEW"],
  },
  "asset-specs": {
    page: "asset-specs",
    requiredAnyPermissions: ["ASSET_VIEW"],
  },
  "user-management": {
    page: "user-management",
    requiredAnyPermissions: ["USER_VIEW", "USER_CREATE", "USER_UPDATE", "USER_DELETE", "USER_ASSIGN_ROLE"],
  },
  "role-management": {
    page: "role-management",
    requiredAnyPermissions: ["ROLE_VIEW", "ROLE_CREATE", "ROLE_UPDATE", "ROLE_DELETE", "ROLE_ASSIGN_PERMISSION"],
  },
  "permission-management": {
    page: "permission-management",
    requiredAnyPermissions: ["ROLE_VIEW", "ROLE_ASSIGN_PERMISSION"],
  },
  "audit-log": {
    page: "audit-log",
    requiredAnyPermissions: ["AUDIT_LOG_VIEW"],
    requiredAnyRoles: ["ADMIN"],
  },
  "lookup-master": {
    page: "lookup-master",
    requiredAnyPermissions: ["LOOKUP_VIEW", "LOOKUP_MANAGE"],
  },
  "lookup-values": {
    page: "lookup-values",
    requiredAnyPermissions: ["LOOKUP_VIEW", "LOOKUP_MANAGE"],
  },
  "periodic-review": {
    page: "periodic-review",
    requiredAnyPermissions: ["SCHEDULE_VIEW", "AUDIT_REVIEW_VIEW"],
  },
  "document-portal": {
    page: "document-portal",
    requiredAnyPermissions: ["DOCUMENT_VIEW"],
  },
  reports: {
    page: "reports",
    requiredAnyPermissions: ["REPORT_EXPORT"],
    requiredAllPermissions: ["ASSET_VIEW"],
  },
  "infrastructure-graph": {
    page: "infrastructure-graph",
    requiredAnyPermissions: ["ORGANIZATION_VIEW", "ASSET_VIEW", "SUPPLIER_VIEW"],
  },
};

export const NAV_PAGE_ORDER: readonly NavPage[] = [
  "asset",
  "org-structure",
  "supplier",
  "asset-grouping",
  "asset-specs",
  "user-management",
  "role-management",
  "permission-management",
  "audit-log",
  "lookup-master",
  "lookup-values",
  "periodic-review",
  "document-portal",
  "reports",
  "infrastructure-graph",
];

type PermissionChecker = (codes: string[]) => boolean;
type RoleChecker = (code: string) => boolean;

export function canAccessRule(rule: PageAccessRule, hasAnyPermission: PermissionChecker, hasRole?: RoleChecker): boolean {
  const hasRequiredRole = Boolean(rule.requiredAnyRoles?.some((role) => hasRole?.(role)));
  if (!hasRequiredRole && !hasAnyPermission([...rule.requiredAnyPermissions])) return false;
  if (rule.requiredAllPermissions?.length && !rule.requiredAllPermissions.every((code) => hasAnyPermission([code]))) {
    return false;
  }
  return true;
}

export function canAccessNavPage(page: NavPage, hasAnyPermission: PermissionChecker, hasRole?: RoleChecker): boolean {
  if (page === "login") return true;
  const rule = PAGE_ACCESS_RULES[page];
  return rule ? canAccessRule(rule, hasAnyPermission, hasRole) : false;
}

export function getFirstAllowedPage(hasAnyPermission: PermissionChecker, hasRole?: RoleChecker): NavPage {
  return NAV_PAGE_ORDER.find((page) => canAccessNavPage(page, hasAnyPermission, hasRole)) ?? "login";
}
