import React, { useState } from "react";
import { Toaster } from "sonner";

import { OrgHierarchyWorkspace } from "../components/org/OrgHierarchyWorkspace";
import { OrgRoleCatalogAdmin } from "../components/org/OrgRoleCatalogAdmin";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../components/layout/pageHeaderConfig";

type OrgWorkspaceTab = "structure" | "roleCatalog";

const DEFAULT_USER = "admin@validatenow";

interface OrgHeaderControls {
  refresh: () => void;
  createRoot: () => void;
  refreshDisabled: boolean;
  createRootDisabled: boolean;
  showCreateRoot: boolean;
}

export function OrgStructurePage() {
  const header = getPageHeaderConfig("org-structure");
  const [activeTab, setActiveTab] = useState<OrgWorkspaceTab>("structure");
  const [headerControls, setHeaderControls] = useState<OrgHeaderControls | null>(null);
  const [orgSearch, setOrgSearch] = useState("");
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    leaders: 0,
    topLevel: 0,
  });
  const [catalogSummary, setCatalogSummary] = useState({
    totalRoles: 0,
    activeRoles: 0,
    activeAssignments: 0,
    standardActivities: 0,
  });

  const organizationHeaderStats = buildPageHeaderStats(header.stats, {
    organizations: summary.total,
    "active-units": summary.active,
    leaders: summary.leaders,
  });
  const governanceHeaderStats = [
    {
      key: "roles",
      label: "Roles",
      value: catalogSummary.totalRoles,
      hint: "Reusable governance roles",
      tone: "blue" as const,
    },
    {
      key: "active-roles",
      label: "Active Roles",
      value: catalogSummary.activeRoles,
      hint: "Available for assignment",
      tone: "emerald" as const,
    },
    {
      key: "assignments",
      label: "Assignments",
      value: catalogSummary.activeAssignments,
      hint: "Active enterprise links",
      tone: "amber" as const,
    },
    {
      key: "activities",
      label: "Activities",
      value: catalogSummary.standardActivities,
      hint: "Standard playbook items",
      tone: "violet" as const,
    },
  ];
  const headerStats = activeTab === "structure" ? organizationHeaderStats : governanceHeaderStats;

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <Toaster position="top-right" richColors />

      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={header.subtitle}
        stats={headerStats}
        search={
          activeTab === "structure"
            ? {
                value: orgSearch,
                placeholder: "Search organizations, organization codes, or business types",
                onChange: setOrgSearch,
                onClear: () => setOrgSearch(""),
                disabled: !headerControls,
              }
            : undefined
        }
        primaryAction={
          activeTab === "structure" && header.primaryAction && headerControls?.showCreateRoot
            ? {
                ...header.primaryAction,
                onClick: headerControls.createRoot,
                disabled: headerControls.createRootDisabled,
              }
            : undefined
        }
        secondaryActions={
          activeTab === "structure" && header.secondaryActions?.length && headerControls
            ? [
                {
                  ...header.secondaryActions[0],
                  onClick: headerControls.refresh,
                  disabled: headerControls.refreshDisabled,
                },
              ]
            : []
        }
        tabs={(header.tabs ?? []).map((tab) => ({
          ...tab,
          active: tab.key === "organization-design" ? activeTab === "structure" : activeTab === "roleCatalog",
          onClick: () => setActiveTab(tab.key === "organization-design" ? "structure" : "roleCatalog"),
        }))}
      />

      <div className={PAGE_CONTENT_CLASS}>
        {activeTab === "structure" ? (
          <OrgHierarchyWorkspace
            defaultUser={DEFAULT_USER}
            onSummaryChange={setSummary}
            onHeaderControlsChange={setHeaderControls}
            searchInput={orgSearch}
            onSearchInputChange={setOrgSearch}
            showSearchCard={false}
          />
        ) : (
          <OrgRoleCatalogAdmin defaultUser={DEFAULT_USER} onCatalogSummaryChange={setCatalogSummary} />
        )}
      </div>
    </div>
  );
}

