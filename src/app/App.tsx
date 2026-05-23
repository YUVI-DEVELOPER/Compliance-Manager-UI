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
import { AssetSpecsPage } from "./pages/assets/AssetSpecsPage";
import { DocumentPortalPage } from "./pages/assets/DocumentPortalPage";
import { GraphHierarchyPage } from "./pages/graph/GraphHierarchyPage";

function isNavPage(value: string): value is NavPage {
  return Boolean(getPageHeaderConfig(value as NavPage));
}

function AppContent() {
  const { hasAnyPermission, hasRole, initializing, isAuthenticated } = useAuth();
  const [page, setPage] = useState<NavPage>(() => {
    const savedPage = localStorage.getItem("app_current_page");
    if (savedPage === "dashboard") return DEFAULT_NAV_PAGE;
    return savedPage ? (isNavPage(savedPage) ? savedPage : DEFAULT_NAV_PAGE) : "login";
  });

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
      return;
    }
    setPage(getFirstAllowedPage(hasAnyPermission, hasRole));
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
      {page === "asset" && <AssetListPage />}
      {page === "asset-grouping" && <AssetGroupingPage />}
      {page === "asset-specs" && <AssetSpecsPage onNavigate={navigate} />}
      {page === "periodic-review" && <PeriodicReviewPage onNavigate={navigate} />}
      {page === "document-portal" && <DocumentPortalPage />}
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
