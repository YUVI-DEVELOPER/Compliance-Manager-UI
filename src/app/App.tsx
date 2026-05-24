import React, { useEffect, useState } from "react";

import { canAccessNavPage, DEFAULT_NAV_PAGE, getFirstAllowedPage } from "./auth/accessPolicy";
import type { NavPage } from "./auth/accessPolicy";
import { AccessDeniedPage } from "./auth/AccessDeniedPage";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";
import { AppShell } from "./components/layout/AppShell";
import { getPageHeaderConfig } from "./components/layout/pageHeaderConfig";
import { LoginPage } from "./pages/LoginPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { OrgStructurePage } from "./pages/OrgStructurePage";
import { PermissionManagementPage } from "./pages/PermissionManagementPage";
import { RoleManagementPage } from "./pages/RoleManagementPage";
import { SupplierPage } from "./pages/SupplierPage";
import { UserManagementPage } from "./pages/UserManagementPage";
import { LookupMasterPage } from "./pages/LookupMasterPage";
import { LookupValuesPage } from "./pages/LookupValuesPage";
import { PeriodicReviewPage } from "./pages/PeriodicReviewPage";
import { AssetGroupingPage } from "./pages/assets/AssetGroupingPage";
import { AssetInventoryReportingPage } from "./pages/assets/AssetInventoryReportingPage";
import { AssetListPage } from "./pages/assets/AssetListPage";
import { AssetReleasesPage } from "./pages/assets/AssetReleasesPage";
import { AssetSpecsPage } from "./pages/assets/AssetSpecsPage";
import { DocumentIntelligencePage } from "./pages/assets/DocumentIntelligencePage";
import { DocumentPortalPage } from "./pages/assets/DocumentPortalPage";
import { SupplierEvaluationsPage } from "./pages/assets/SupplierEvaluationsPage";
import { GraphHierarchyPage } from "./pages/graph/GraphHierarchyPage";
import { MODULE_NAVIGATION_EVENT } from "./utils/moduleNavigation";

function isNavPage(value: string): value is NavPage {
  return Boolean(getPageHeaderConfig(value as NavPage));
}

const ROUTE_TO_PAGE: Record<string, NavPage> = {
  "/": DEFAULT_NAV_PAGE,
  "/login": "login",
  "/org-structure": "org-structure",
  "/supplier": "supplier",
  "/suppliers": "supplier",
  "/asset": "asset",
  "/assets": "asset",
  "/asset-master": "asset",
  "/asset-grouping": "asset-grouping",
  "/asset-specs": "asset-specs",
  "/asset-releases": "asset-releases",
  "/supplier-evaluations": "supplier-evaluations",
  "/document-portal": "document-portal",
  "/asset-documents": "document-portal",
  "/document-intelligence": "document-intelligence",
  "/periodic-review": "periodic-review",
  "/asset-inventory-report": "reports",
  "/reports": "reports",
  "/infrastructure-graph": "infrastructure-graph",
  "/users": "user-management",
  "/user-management": "user-management",
  "/roles": "role-management",
  "/role-management": "role-management",
  "/permissions": "permission-management",
  "/permission-management": "permission-management",
  "/audit-log": "audit-log",
  "/lookup-master": "lookup-master",
  "/lookup-values": "lookup-values",
};

const PAGE_TO_ROUTE: Partial<Record<NavPage, string>> = {
  login: "/login",
  "org-structure": "/org-structure",
  supplier: "/supplier",
  asset: "/asset-master",
  "asset-grouping": "/asset-grouping",
  "asset-specs": "/asset-specs",
  "asset-releases": "/asset-releases",
  "supplier-evaluations": "/supplier-evaluations",
  "document-portal": "/document-portal",
  "document-intelligence": "/document-intelligence",
  "periodic-review": "/periodic-review",
  reports: "/asset-inventory-report",
  "infrastructure-graph": "/infrastructure-graph",
  "user-management": "/user-management",
  "role-management": "/role-management",
  "permission-management": "/permission-management",
  "audit-log": "/audit-log",
  "lookup-master": "/lookup-master",
  "lookup-values": "/lookup-values",
};

function pageFromLocation(): NavPage | null {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return ROUTE_TO_PAGE[path.toLowerCase()] ?? null;
}

function routeForPage(page: NavPage): string {
  return PAGE_TO_ROUTE[page] ?? "/";
}

function AppContent() {
  const { hasAnyPermission, hasRole, initializing, isAuthenticated } = useAuth();
  const [page, setPage] = useState<NavPage>(() => {
    const routePage = pageFromLocation();
    if (routePage) return routePage;
    const savedPage = localStorage.getItem("app_current_page");
    if (savedPage === "dashboard") return DEFAULT_NAV_PAGE;
    return savedPage ? (isNavPage(savedPage) ? savedPage : DEFAULT_NAV_PAGE) : "login";
  });

  useEffect(() => {
    const syncPageFromLocation = () => {
      const routePage = pageFromLocation();
      if (routePage) setPage(routePage);
    };

    window.addEventListener("popstate", syncPageFromLocation);
    window.addEventListener(MODULE_NAVIGATION_EVENT, syncPageFromLocation);
    return () => {
      window.removeEventListener("popstate", syncPageFromLocation);
      window.removeEventListener(MODULE_NAVIGATION_EVENT, syncPageFromLocation);
    };
  }, []);

  useEffect(() => {
    if (initializing) return;
    if (!isAuthenticated) {
      setPage("login");
      return;
    }
    if (page === "login" || !canAccessNavPage(page, hasAnyPermission, hasRole)) {
      setPage(getFirstAllowedPage(hasAnyPermission, hasRole));
    }
  }, [hasAnyPermission, hasRole, initializing, isAuthenticated, page]);

  useEffect(() => {
    localStorage.setItem("app_current_page", page);
  }, [page]);

  const navigate = (nextPage: NavPage) => {
    if (nextPage === "login" || canAccessNavPage(nextPage, hasAnyPermission, hasRole)) {
      setPage(nextPage);
      const nextRoute = routeForPage(nextPage);
      if (window.location.pathname !== nextRoute || window.location.search) {
        window.history.pushState({}, "", nextRoute);
      }
      return;
    }
    const fallbackPage = getFirstAllowedPage(hasAnyPermission, hasRole);
    setPage(fallbackPage);
    window.history.pushState({}, "", routeForPage(fallbackPage));
  };

  if (initializing) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">Loading workspace...</div>;
  }

  if (!isAuthenticated || page === "login") {
    if (isAuthenticated && getFirstAllowedPage(hasAnyPermission, hasRole) === "login") {
      return <AccessDeniedPage />;
    }
    return <LoginPage onLogin={(nextPage) => navigate(nextPage)} />;
  }

  if (!canAccessNavPage(page, hasAnyPermission, hasRole)) {
    return <AccessDeniedPage />;
  }

  const content = (
    <>
      {page === "user-management" && <UserManagementPage />}
      {page === "role-management" && <RoleManagementPage />}
      {page === "permission-management" && <PermissionManagementPage />}
      {page === "audit-log" && <AuditLogPage />}
      {page === "org-structure" && <OrgStructurePage />}
      {page === "supplier" && <SupplierPage />}
      {page === "asset" && <AssetListPage onNavigate={navigate} />}
      {page === "asset-grouping" && <AssetGroupingPage />}
      {page === "asset-specs" && <AssetSpecsPage onNavigate={navigate} />}
      {page === "asset-releases" && <AssetReleasesPage />}
      {page === "supplier-evaluations" && <SupplierEvaluationsPage />}
      {page === "periodic-review" && <PeriodicReviewPage onNavigate={navigate} />}
      {page === "document-portal" && <DocumentPortalPage />}
      {page === "document-intelligence" && <DocumentIntelligencePage />}
      {page === "lookup-master" && <LookupMasterPage onNavigate={navigate} />}
      {page === "lookup-values" && <LookupValuesPage onNavigate={navigate} />}
      {page === "reports" && <AssetInventoryReportingPage />}
      {page === "infrastructure-graph" && <GraphHierarchyPage />}
      {page === "data-entry" && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-2xl font-bold text-slate-700">Not ready</h2>
            <p className="text-slate-500">This page is under construction</p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <AppShell activePage={page} onNavigate={navigate}>
      {content}
    </AppShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
