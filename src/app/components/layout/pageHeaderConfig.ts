import type { ReactNode } from "react";

import type { NavPage } from "../../auth/accessPolicy";

export type PageHeaderActionVariant = "default" | "secondary" | "ghost" | "destructive";

export type PageHeaderIconKey = "plus" | "refresh" | "import" | "export" | "back" | "fit" | "edit" | "remove";

export interface PageHeaderActionDefinition {
  key: string;
  label: string;
  variant?: PageHeaderActionVariant;
  icon?: PageHeaderIconKey;
}

export interface PageHeaderTabDefinition {
  key: string;
  label: string;
}

export interface PageHeaderBreadcrumbItem {
  label: string;
}

export interface PageHeaderStatDefinition {
  key: string;
  label: string;
  hint?: string;
  tone?: "blue" | "emerald" | "amber" | "violet" | "slate";
}

export interface PageHeaderPreset {
  page: NavPage;
  breadcrumbs: PageHeaderBreadcrumbItem[];
  sectionLabel?: string;
  title: string;
  subtitle: string;
  searchPlaceholder?: string;
  tabs?: PageHeaderTabDefinition[];
  primaryAction?: PageHeaderActionDefinition;
  secondaryActions?: PageHeaderActionDefinition[];
  stats?: PageHeaderStatDefinition[];
  searchEnabled?: boolean;
}

export interface PageHeaderStatValue extends PageHeaderStatDefinition {
  value: ReactNode;
}

const rootCrumb = { label: "Compliance Manager" } as const;

const withRoot = (...labels: string[]): PageHeaderBreadcrumbItem[] => [
  rootCrumb,
  ...labels.map((label) => ({ label })),
];

export const PAGE_HEADER_CONFIG: Record<NavPage, PageHeaderPreset> = {
  login: {
    page: "login",
    breadcrumbs: withRoot("Login"),
    title: "Login",
    subtitle: "Access the Compliance Manager workspace.",
    searchEnabled: false,
  },
  "user-management": {
    page: "user-management",
    breadcrumbs: withRoot("Security", "User Management"),
    sectionLabel: "Security",
    title: "User Management",
    subtitle: "Create users, manage account status, and assign roles.",
    searchEnabled: false,
  },
  "role-management": {
    page: "role-management",
    breadcrumbs: withRoot("Security", "Role Management"),
    sectionLabel: "Security",
    title: "Role Management",
    subtitle: "Create roles and assign permission sets.",
    searchEnabled: false,
  },
  "permission-management": {
    page: "permission-management",
    breadcrumbs: withRoot("Security", "Permissions"),
    sectionLabel: "Security",
    title: "Permissions",
    subtitle: "Review permissions grouped by module.",
    searchEnabled: false,
  },
  "org-structure": {
    page: "org-structure",
    breadcrumbs: withRoot("Org Structure"),
    sectionLabel: "Management",
    title: "Org Structure",
    subtitle: "Business structure, reporting lines, and governance ownership.",
    tabs: [
      { key: "organization-design", label: "Organization Design" },
      { key: "governance-role-library", label: "Governance Role Library" },
    ],
    primaryAction: { key: "add-reporting-unit", label: "Add Reporting Unit", variant: "default", icon: "plus" },
    secondaryActions: [{ key: "refresh", label: "Refresh", variant: "secondary", icon: "refresh" }],
    searchEnabled: false,
    stats: [
      { key: "organizations", label: "Organizations", hint: "Total mapped units", tone: "blue" },
      { key: "active-units", label: "Active Units", hint: "Operating organizations", tone: "emerald" },
      { key: "leaders", label: "Leaders", hint: "Units with child branches", tone: "violet" },
    ],
  },
  supplier: {
    page: "supplier",
    breadcrumbs: withRoot("Supplier Management"),
    sectionLabel: "Management",
    title: "Supplier Management",
    subtitle: "List, search, create, edit, and delete suppliers.",
    searchPlaceholder: "Search suppliers...",
    primaryAction: { key: "add-supplier", label: "Add Supplier", variant: "default", icon: "plus" },
    secondaryActions: [
      { key: "import", label: "Import", variant: "secondary", icon: "import" },
      { key: "export", label: "Export", variant: "secondary", icon: "export" },
      { key: "reload", label: "Reload", variant: "ghost", icon: "refresh" },
    ],
    searchEnabled: true,
    stats: [
      { key: "total", label: "Suppliers", hint: "Catalog records", tone: "blue" },
      { key: "filtered", label: "Visible", hint: "Current search results", tone: "emerald" },
    ],
  },
  asset: {
    page: "asset",
    breadcrumbs: withRoot("Asset Management"),
    sectionLabel: "Management",
    title: "Asset Master",
    subtitle: "Maintain enterprise asset records, classification, and release readiness.",
    searchPlaceholder: "Search by asset ID, name, owner, or tracking identifier...",
    primaryAction: { key: "create-asset", label: "Create Asset Master", variant: "default", icon: "plus" },
    secondaryActions: [
      { key: "import", label: "Import", variant: "secondary", icon: "import" },
      { key: "export", label: "Export", variant: "secondary", icon: "export" },
      { key: "asset-specs", label: "Asset Specs", variant: "secondary", icon: "edit" },
    ],
    searchEnabled: true,
    stats: [
      { key: "total", label: "Assets", hint: "Master records", tone: "blue" },
      { key: "visible", label: "Visible", hint: "Filtered rows", tone: "emerald" },
      { key: "selected-org", label: "Scope", hint: "Current organization filter", tone: "amber" },
    ],
  },
  "asset-grouping": {
    page: "asset-grouping",
    breadcrumbs: withRoot("Asset Management", "Asset Grouping"),
    sectionLabel: "Management",
    title: "Asset Grouping",
    subtitle: "Organize individual assets into systems and sub-systems to understand connected asset impact.",
    searchPlaceholder: "Search systems, sub-systems, codes, or descriptions...",
    primaryAction: { key: "new-system", label: "New System", variant: "default", icon: "plus" },
    secondaryActions: [
      { key: "new-sub-system", label: "New Sub-System", variant: "secondary", icon: "plus" },
      { key: "refresh", label: "Refresh", variant: "secondary", icon: "refresh" },
    ],
    searchEnabled: true,
    stats: [
      { key: "total", label: "Groups", hint: "Systems and sub-systems", tone: "blue" },
      { key: "systems", label: "Systems", hint: "Top-level impact groups", tone: "emerald" },
      { key: "sub-systems", label: "Sub-systems", hint: "Child technical groups", tone: "amber" },
    ],
  },
  "asset-specs": {
    page: "asset-specs",
    breadcrumbs: withRoot("Asset Management", "Asset Specs"),
    sectionLabel: "Configuration",
    title: "Asset Specs",
    subtitle: "Maintain reusable specification rows per asset sub-category.",
    searchPlaceholder: "Search grouping, parameter, or value...",
    primaryAction: { key: "new-spec", label: "New Spec", variant: "default", icon: "plus" },
    secondaryActions: [
      { key: "back", label: "Back to Assets", variant: "secondary", icon: "back" },
      { key: "refresh", label: "Refresh", variant: "secondary", icon: "refresh" },
    ],
    searchEnabled: true,
    stats: [
      { key: "specs", label: "Specs", hint: "All specification rows", tone: "blue" },
      { key: "filtered", label: "Filtered", hint: "Rows in current view", tone: "emerald" },
      { key: "subcategories", label: "Sub-categories", hint: "Distinct groups", tone: "amber" },
      { key: "inactive", label: "Inactive Visible", hint: "Current filter state", tone: "violet" },
    ],
  },
  "periodic-review": {
    page: "periodic-review",
    breadcrumbs: withRoot("Compliance", "Periodic Review"),
    sectionLabel: "Compliance",
    title: "Periodic Review",
    subtitle: "Run manual audit trail reviews for validated software assets.",
    searchEnabled: false,
  },
  "document-portal": {
    page: "document-portal",
    breadcrumbs: withRoot("Asset Management", "Document Portal"),
    sectionLabel: "Documentation",
    title: "Document Portal",
    subtitle: "View important asset documents, qualification evidence, and source mappings in one read-only catalog.",
    searchPlaceholder: "Search document, asset, release, supplier, source, or reference...",
    secondaryActions: [{ key: "refresh", label: "Refresh", variant: "secondary", icon: "refresh" }],
    searchEnabled: true,
    stats: [
      { key: "documents", label: "Documents", hint: "Important records", tone: "blue" },
      { key: "assets", label: "Assets", hint: "Mapped sources", tone: "emerald" },
      { key: "authored", label: "Authored", hint: "URS and FRS drafts", tone: "violet" },
      { key: "qualification", label: "Qualification", hint: "IQ, OQ, PQ evidence", tone: "amber" },
    ],
  },
  "lookup-master": {
    page: "lookup-master",
    breadcrumbs: withRoot("Lookup Master"),
    sectionLabel: "Configuration",
    title: "Lookup Master",
    subtitle: "Manage dropdown categories used across modules.",
    searchPlaceholder: "Search categories...",
    primaryAction: { key: "add-category", label: "Add Category", variant: "default", icon: "plus" },
    secondaryActions: [{ key: "export", label: "Export", variant: "secondary", icon: "export" }],
    searchEnabled: true,
    stats: [
      { key: "categories", label: "Categories", hint: "Configured masters", tone: "blue" },
      { key: "active", label: "Active", hint: "Available for use", tone: "emerald" },
      { key: "values", label: "Values", hint: "Across all categories", tone: "amber" },
      { key: "modified", label: "Modified", hint: "Updated this month", tone: "violet" },
    ],
  },
  "lookup-values": {
    page: "lookup-values",
    breadcrumbs: withRoot("Lookup Master", "Lookup Values"),
    sectionLabel: "Configuration",
    title: "Lookup Values",
    subtitle: "Configure dropdown values for each lookup category key.",
    searchPlaceholder: "Search by code or display name...",
    primaryAction: { key: "add-value", label: "Add Value", variant: "default", icon: "plus" },
    secondaryActions: [
      { key: "import", label: "Import", variant: "secondary", icon: "import" },
      { key: "export", label: "Export", variant: "secondary", icon: "export" },
      { key: "reorder", label: "Reorder Values", variant: "ghost", icon: "refresh" },
      { key: "back", label: "Back to Lookup Master", variant: "ghost", icon: "back" },
    ],
    searchEnabled: true,
    stats: [
      { key: "values", label: "Values", hint: "Rows in selected category", tone: "blue" },
      { key: "active", label: "Active", hint: "Currently enabled", tone: "emerald" },
      { key: "selected-key", label: "Selected Key", hint: "Current category", tone: "violet" },
    ],
  },
  "data-entry": {
    page: "data-entry",
    breadcrumbs: withRoot("Data Entry Form"),
    title: "Data Entry Form",
    subtitle: "Create and maintain structured input records.",
    searchEnabled: false,
  },
  reports: {
    page: "reports",
    breadcrumbs: withRoot("Asset Management", "Asset Inventory Reporting"),
    sectionLabel: "Reporting",
    title: "Asset Inventory Reporting",
    subtitle: "Run enterprise-wide or unit-level inventory reports using the current asset and organization structure data.",
    secondaryActions: [
      { key: "refresh", label: "Refresh", variant: "secondary", icon: "refresh" },
      { key: "export", label: "Export CSV", variant: "secondary", icon: "export" },
    ],
    searchEnabled: false,
  },
  "infrastructure-graph": {
    page: "infrastructure-graph",
    breadcrumbs: withRoot("Infrastructure Graph"),
    sectionLabel: "Analytics",
    title: "Infrastructure Graph",
    subtitle: "Explore organizations, assets, and suppliers in one connected view.",
    searchPlaceholder: "Search nodes, metadata, or identifiers...",
    primaryAction: { key: "fit-view", label: "Fit View", variant: "secondary", icon: "fit" },
    secondaryActions: [{ key: "refresh", label: "Refresh", variant: "secondary", icon: "refresh" }],
    searchEnabled: true,
  },
};

export const getPageHeaderConfig = (page: NavPage): PageHeaderPreset => PAGE_HEADER_CONFIG[page];

export const buildPageHeaderStats = (
  definitions: PageHeaderStatDefinition[] | undefined,
  values: Record<string, ReactNode>,
): PageHeaderStatValue[] => (definitions ?? []).map((definition) => ({
  ...definition,
  value: values[definition.key] ?? "-",
}));

