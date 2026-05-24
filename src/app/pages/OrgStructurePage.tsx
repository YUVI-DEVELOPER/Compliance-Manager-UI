import React, { useState } from "react";
import { Toaster } from "sonner";

import { OrgHierarchyWorkspace } from "../components/org/OrgHierarchyWorkspace";
import { OrgRoleCatalogAdmin } from "../components/org/OrgRoleCatalogAdmin";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../components/layout/pageHeaderConfig";
import { useCurrentActor } from "../auth/useCurrentActor";

type OrgWorkspaceTab = "hierarchy" | "roleLibrary";

interface OrgHeaderControls {
  refresh: () => void;
  createRoot: () => void;
  refreshDisabled: boolean;
  createRootDisabled: boolean;
  showCreateRoot: boolean;
}

export function OrgStructurePage() {
  const currentActor = useCurrentActor();
  const header = getPageHeaderConfig("org-structure");
  const [activeTab, setActiveTab] = useState<OrgWorkspaceTab>("hierarchy");
  const [headerControls, setHeaderControls] = useState<OrgHeaderControls | null>(null);
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
  const headerStats = activeTab === "hierarchy" ? organizationHeaderStats : governanceHeaderStats;

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <Toaster position="top-right" richColors />

      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Org Structure"
        subtitle="Manage business hierarchy, ownership, and governance roles"
        stats={headerStats}
        primaryAction={undefined}
        secondaryActions={
          activeTab === "hierarchy" && header.secondaryActions?.length && headerControls
            ? [
                {
                  ...header.secondaryActions[0],
                  onClick: headerControls.refresh,
                  disabled: headerControls.refreshDisabled,
                },
              ]
            : []
        }
        tabs={[
          {
            key: "hierarchy-design",
            label: "Hierarchy Design",
            active: activeTab === "hierarchy",
            onClick: () => setActiveTab("hierarchy"),
          },
          {
            key: "role-library",
            label: "Role Library",
            active: activeTab === "roleLibrary",
            onClick: () => setActiveTab("roleLibrary"),
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        {activeTab === "hierarchy" ? (
          <OrgHierarchyWorkspace
            actorName={currentActor.auditName}
            actorId={currentActor.id}
            onSummaryChange={setSummary}
            onHeaderControlsChange={setHeaderControls}
          />
        ) : (
          <OrgRoleCatalogAdmin actorName={currentActor.auditName} onCatalogSummaryChange={setCatalogSummary} />
        )}
      </div>
    </div>
  );
}

