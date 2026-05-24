import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileCheck2,
  FilePlus2,
  FileText,
  Library,
  Link2,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import { toast, Toaster } from "sonner";

import {
  AuthoredDocumentRecord,
  deleteAuthoredDocument,
  DocumentTemplateRecord,
  getAssetAuthoredDocuments,
  getDocumentTemplates,
  getReleaseAuthoredDocuments,
} from "../../../services/authored-document.service";
import { AssetRecord, getAssets } from "../../../services/asset.service";
import {
  deleteDocumentLink,
  DocumentLinkRecord,
  getAssetDocuments,
  getReleaseDocuments,
  reprocessDocumentVectorization,
} from "../../../services/document-link.service";
import {
  deleteQualificationDocument,
  getAssetQualificationDocuments,
  getReleaseQualificationDocuments,
  QualificationDocumentRecord,
} from "../../../services/qualification-document.service";
import { getReleasesByAssetId, ReleaseRecord } from "../../../services/release.service";
import { getSuppliers, SupplierRecord } from "../../../services/supplier.service";
import { useAuth } from "../../auth/useAuth";
import { AuthoredDocumentEditorModal } from "../../components/assets/AuthoredDocumentEditorModal";
import { AuthoredDocumentTable } from "../../components/assets/AuthoredDocumentTable";
import {
  canDeleteAuthoredDocument,
  formatAuthoredDocumentDate,
  mapAuthoredDocumentAxiosError,
} from "../../components/assets/authoredDocumentForm.shared";
import { AssetDocumentTable } from "../../components/assets/AssetDocumentTable";
import { CreateDocumentLinkModal } from "../../components/assets/CreateDocumentLinkModal";
import {
  isDocumentVectorizationActive,
  loadOmsSourceSystemOptions,
  mapDocumentLinkAxiosError,
} from "../../components/assets/documentLinkForm.shared";
import { EditDocumentLinkModal } from "../../components/assets/EditDocumentLinkModal";
import { QualificationDocumentModal } from "../../components/assets/QualificationDocumentModal";
import { QualificationDocumentTable } from "../../components/assets/QualificationDocumentTable";
import {
  canDeleteQualificationDocument,
  mapQualificationDocumentAxiosError,
} from "../../components/assets/qualificationDocumentForm.shared";
import {
  ConfirmStrip,
  EmptyState,
  FilterBar,
  SearchableCombobox,
  StatusBadge,
  type ComboboxOption,
} from "../../components/foundation";
import {
  CommonPageHeader,
  PAGE_CONTENT_CLASS,
  PAGE_LAYOUT_SHELL_CLASS,
} from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { LookupOption } from "../../services/lookupValue.service";
import { navigateToDocumentIntelligence } from "../../utils/moduleNavigation";

type PortalTab = "authored" | "qualification" | "linked" | "templates";

const normalize = (value?: string | null): string => (value ?? "").trim();

const getInitialAssetFilter = (): string => {
  if (typeof window === "undefined") return "ALL";
  return new URLSearchParams(window.location.search).get("asset_id") || "ALL";
};

const getInitialReleaseFilter = (): string | null => {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("release_id");
};

const updateDocumentPortalQuery = (assetId: string | null, releaseId?: string | null) => {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  url.pathname = "/document-portal";
  if (assetId && assetId !== "ALL") {
    url.searchParams.set("asset_id", assetId);
  } else {
    url.searchParams.delete("asset_id");
  }

  if (assetId && assetId !== "ALL" && releaseId) {
    url.searchParams.set("release_id", releaseId);
  } else {
    url.searchParams.delete("release_id");
  }

  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
};

const findAssetByToken = (assets: AssetRecord[], token: string | null): AssetRecord | null => {
  if (!token || token === "ALL") return null;
  return assets.find((asset) => asset.asset_uuid === token || asset.asset_id === token) ?? null;
};

const compareByUpdatedDate = <
  T extends {
    modified_dt?: string | null;
    created_dt?: string | null;
    submission_date?: string | null;
    upload_dt?: string | null;
  },
>(
  left: T,
  right: T,
): number => {
  const leftDate = Date.parse(left.modified_dt || left.submission_date || left.upload_dt || left.created_dt || "");
  const rightDate = Date.parse(right.modified_dt || right.submission_date || right.upload_dt || right.created_dt || "");
  return (Number.isNaN(rightDate) ? 0 : rightDate) - (Number.isNaN(leftDate) ? 0 : leftDate);
};

const textMatches = (values: Array<string | null | undefined>, search: string): boolean => {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  return values
    .map((value) => normalize(value).toLowerCase())
    .filter(Boolean)
    .some((value) => value.includes(query));
};

const getTemplateUpdatedAt = (template: DocumentTemplateRecord): string | null =>
  template.modified_dt || template.created_dt || null;

const getContextTitle = (asset: AssetRecord | null, release: ReleaseRecord | null): string => {
  if (!asset) return "No asset selected";
  const assetLabel = asset.asset_name || asset.asset_id || asset.asset_uuid;
  if (!release) return `Viewing documents for ${assetLabel}`;
  return `Viewing documents for ${assetLabel} / ${release.version || release.release_id}`;
};

const getLinkedDocumentIntelligenceId = (document: DocumentLinkRecord): string | null =>
  document.vectorization_job?.rag_document_id || null;

function SectionHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function TemplateCatalog({
  templates,
  loading,
  search,
}: {
  templates: DocumentTemplateRecord[];
  loading: boolean;
  search: string;
}) {
  if (loading) {
    return <div className="px-4 py-6 text-sm text-slate-500">Loading document templates...</div>;
  }

  if (templates.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title={search.trim() ? "No template search results" : "No templates available"}
          description={
            search.trim()
              ? "No templates match the current document search."
              : "Template management APIs are not exposed here, so this catalog remains read-only."
          }
          icon={<Library className="h-5 w-5" />}
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead className="min-w-[18rem] font-semibold">Template</TableHead>
            <TableHead className="font-semibold">Type</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map((template) => (
            <TableRow key={template.template_id} className="hover:bg-slate-50">
              <TableCell className="align-top">
                <div className="font-medium text-slate-900">{template.template_name || "-"}</div>
                <p className="mt-1 text-xs text-slate-500">{template.template_code || template.template_id}</p>
              </TableCell>
              <TableCell className="align-top">
                <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                  {template.document_type || "-"}
                </Badge>
              </TableCell>
              <TableCell className="align-top">
                <StatusBadge status={template.is_active ? "active" : "inactive"} />
              </TableCell>
              <TableCell className="align-top" title={getTemplateUpdatedAt(template) ?? undefined}>
                {formatAuthoredDocumentDate(getTemplateUpdatedAt(template))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function DocumentPortalPage() {
  const { hasPermission, hasAnyPermission } = useAuth();
  const header = getPageHeaderConfig("document-portal");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [releaseOptions, setReleaseOptions] = useState<ReleaseRecord[]>([]);
  const [sourceSystemOptions, setSourceSystemOptions] = useState<LookupOption[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplateRecord[]>([]);
  const [authoredDocuments, setAuthoredDocuments] = useState<AuthoredDocumentRecord[]>([]);
  const [qualificationDocuments, setQualificationDocuments] = useState<QualificationDocumentRecord[]>([]);
  const [linkedDocuments, setLinkedDocuments] = useState<DocumentLinkRecord[]>([]);
  const [shellLoading, setShellLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState(getInitialAssetFilter);
  const [releaseFilter, setReleaseFilter] = useState<string | null>(getInitialReleaseFilter);
  const [activeTab, setActiveTab] = useState<PortalTab>("authored");
  const [authoredEditorOpen, setAuthoredEditorOpen] = useState(false);
  const [editingAuthoredId, setEditingAuthoredId] = useState<string | null>(null);
  const [qualificationEditorOpen, setQualificationEditorOpen] = useState(false);
  const [editingQualificationId, setEditingQualificationId] = useState<string | null>(null);
  const [createDocumentOpen, setCreateDocumentOpen] = useState(false);
  const [editDocumentId, setEditDocumentId] = useState<string | null>(null);
  const [authoredToDelete, setAuthoredToDelete] = useState<AuthoredDocumentRecord | null>(null);
  const [qualificationToDelete, setQualificationToDelete] = useState<QualificationDocumentRecord | null>(null);
  const [linkedToDelete, setLinkedToDelete] = useState<DocumentLinkRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canViewDocuments = hasPermission("DOCUMENT_VIEW");
  const canCreateDocument = hasAnyPermission(["DOCUMENT_LINK", "DOCUMENT_UPLOAD"]);
  const canUpdateDocument = hasPermission("DOCUMENT_UPDATE");
  const canDeleteDocument = hasPermission("DOCUMENT_DELETE");

  const selectedAsset = useMemo(() => findAssetByToken(assets, assetFilter), [assetFilter, assets]);
  const selectedRelease = useMemo(
    () => releaseOptions.find((release) => release.release_id === releaseFilter) ?? null,
    [releaseFilter, releaseOptions],
  );

  const assetOptions = useMemo<ComboboxOption[]>(
    () =>
      assets
        .map((asset) => ({
          value: asset.asset_uuid,
          label: `${asset.asset_id || asset.asset_uuid} - ${asset.asset_name || "Unnamed asset"}`,
          description: asset.asset_version ? `Asset version ${asset.asset_version}` : undefined,
        }))
        .sort((left, right) => left.label.localeCompare(right.label)),
    [assets],
  );

  const portalContext = useMemo(() => {
    if (!selectedAsset) return null;
    if (selectedRelease) {
      return {
        type: "release" as const,
        releaseId: selectedRelease.release_id,
        assetId: selectedAsset.asset_uuid,
        assetName: selectedAsset.asset_name,
        assetCode: selectedAsset.asset_id,
        releaseVersion: selectedRelease.version,
        createdDt: selectedRelease.created_dt,
        endDt: selectedRelease.end_dt,
      };
    }

    return {
      type: "asset" as const,
      assetId: selectedAsset.asset_uuid,
      assetName: selectedAsset.asset_name,
      assetCode: selectedAsset.asset_id,
      assetVersion: selectedAsset.asset_version,
    };
  }, [selectedAsset, selectedRelease]);

  const authoredDocumentContext = useMemo(() => {
    if (!selectedAsset) {
      return {
        type: "asset" as const,
        assetId: null,
        assetName: null,
        assetCode: null,
        assetVersion: null,
      };
    }

    if (selectedRelease) {
      return {
        type: "release" as const,
        releaseId: selectedRelease.release_id,
        assetName: selectedAsset.asset_name,
        assetCode: selectedAsset.asset_id,
        releaseVersion: selectedRelease.version,
      };
    }

    return {
      type: "asset" as const,
      assetId: selectedAsset.asset_uuid,
      assetName: selectedAsset.asset_name,
      assetCode: selectedAsset.asset_id,
      assetVersion: selectedAsset.asset_version,
    };
  }, [selectedAsset, selectedRelease]);

  const qualificationDocumentContext = useMemo(() => {
    if (!selectedAsset) {
      return {
        type: "asset" as const,
        assetId: null,
        assetName: null,
        assetCode: null,
        assetVersion: null,
      };
    }

    if (selectedRelease) {
      return {
        type: "release" as const,
        assetId: selectedAsset.asset_uuid,
        releaseId: selectedRelease.release_id,
        assetName: selectedAsset.asset_name,
        assetCode: selectedAsset.asset_id,
        releaseVersion: selectedRelease.version,
      };
    }

    return {
      type: "asset" as const,
      assetId: selectedAsset.asset_uuid,
      assetName: selectedAsset.asset_name,
      assetCode: selectedAsset.asset_id,
      assetVersion: selectedAsset.asset_version,
    };
  }, [selectedAsset, selectedRelease]);

  const loadShell = useCallback(async () => {
    setShellLoading(true);
    setTemplatesLoading(true);
    try {
      const [assetData, supplierData, sourceOptions] = await Promise.all([
        getAssets(),
        getSuppliers(),
        loadOmsSourceSystemOptions(),
      ]);
      setAssets(assetData);
      setSuppliers(supplierData);
      setSourceSystemOptions(sourceOptions);

      try {
        const templateData = await getDocumentTemplates({});
        setTemplates(templateData);
      } catch (error) {
        console.error("Failed to load document templates:", error);
        toast.error("Failed to load document templates");
        setTemplates([]);
      } finally {
        setTemplatesLoading(false);
      }
    } catch (error) {
      console.error("Failed to load document portal:", error);
      toast.error("Failed to load document portal");
      setTemplatesLoading(false);
    } finally {
      setShellLoading(false);
    }
  }, []);

  const loadWorkspace = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!selectedAsset?.asset_uuid) {
        setReleaseOptions([]);
        setAuthoredDocuments([]);
        setQualificationDocuments([]);
        setLinkedDocuments([]);
        setWorkspaceLoading(false);
        return;
      }

      if (!options.silent) setWorkspaceLoading(true);
      try {
        const releases = await getReleasesByAssetId(selectedAsset.asset_uuid);
        const scopedRelease = releaseFilter
          ? releases.find((release) => release.release_id === releaseFilter) ?? null
          : null;

        setReleaseOptions(releases);
        if (releaseFilter && !scopedRelease) {
          setReleaseFilter(null);
          updateDocumentPortalQuery(selectedAsset.asset_uuid, null);
        }

        const [authored, qualification, linked] = scopedRelease
          ? await Promise.all([
              getReleaseAuthoredDocuments(scopedRelease.release_id),
              getReleaseQualificationDocuments(scopedRelease.release_id),
              getReleaseDocuments(scopedRelease.release_id),
            ])
          : await Promise.all([
              getAssetAuthoredDocuments(selectedAsset.asset_uuid),
              getAssetQualificationDocuments(selectedAsset.asset_uuid),
              getAssetDocuments(selectedAsset.asset_uuid),
            ]);

        setAuthoredDocuments([...authored].sort(compareByUpdatedDate));
        setQualificationDocuments([...qualification].sort(compareByUpdatedDate));
        setLinkedDocuments([...linked].sort(compareByUpdatedDate));
      } catch (error) {
        console.error("Failed to load document workspace:", error);
        toast.error("Failed to load document workspace");
      } finally {
        if (!options.silent) setWorkspaceLoading(false);
      }
    },
    [releaseFilter, selectedAsset],
  );

  useEffect(() => {
    void loadShell();
  }, [loadShell]);

  useEffect(() => {
    if (assets.length === 0 || assetFilter === "ALL") return;
    const matchedAsset = findAssetByToken(assets, assetFilter);
    if (!matchedAsset) {
      setAssetFilter("ALL");
      setReleaseFilter(null);
      updateDocumentPortalQuery("ALL", null);
      return;
    }

    if (matchedAsset.asset_uuid !== assetFilter) {
      setAssetFilter(matchedAsset.asset_uuid);
      updateDocumentPortalQuery(matchedAsset.asset_uuid, releaseFilter);
    }
  }, [assetFilter, assets, releaseFilter]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const hasActiveDocumentVectorization = useMemo(
    () => linkedDocuments.some(isDocumentVectorizationActive),
    [linkedDocuments],
  );

  useEffect(() => {
    if (!selectedAsset?.asset_uuid || !hasActiveDocumentVectorization) return;

    const intervalId = window.setInterval(() => {
      void loadWorkspace({ silent: true });
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [hasActiveDocumentVectorization, loadWorkspace, selectedAsset?.asset_uuid]);

  const filteredAuthoredDocuments = useMemo(
    () =>
      authoredDocuments.filter((document) =>
        textMatches(
          [
            document.title,
            document.document_type,
            document.template_name,
            document.template_code,
            document.status,
            document.publish_status,
            document.reviewer_name,
            document.approver_name,
            document.external_document_id,
            document.external_document_name,
            document.release_version,
          ],
          search,
        ),
      ),
    [authoredDocuments, search],
  );

  const filteredQualificationDocuments = useMemo(
    () =>
      qualificationDocuments.filter((document) =>
        textMatches(
          [
            document.document_name,
            document.qualification_type,
            document.status,
            document.supplier_name,
            document.document_version,
            document.source_system,
            document.external_document_id,
            document.source_reference,
            document.release_version,
          ],
          search,
        ),
      ),
    [qualificationDocuments, search],
  );

  const filteredLinkedDocuments = useMemo(
    () =>
      linkedDocuments.filter((document) =>
        textMatches(
          [
            document.document_name,
            document.document_type,
            document.document_version,
            document.source_system,
            document.external_document_id,
            document.source_reference,
            document.notes,
            document.vectorization_status,
            document.vectorization_job?.status,
            document.vectorization_job?.current_stage,
          ],
          search,
        ),
      ),
    [linkedDocuments, search],
  );

  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) =>
        textMatches(
          [template.template_name, template.template_code, template.document_type, template.template_content],
          search,
        ),
      ),
    [search, templates],
  );

  const headerStats = buildPageHeaderStats(header.stats, {
    documents: filteredAuthoredDocuments.length + filteredQualificationDocuments.length + filteredLinkedDocuments.length,
    assets: selectedAsset ? 1 : 0,
    authored: filteredAuthoredDocuments.length,
    qualification: filteredQualificationDocuments.length,
  });

  const activeFilters = useMemo(
    () => [
      ...(selectedAsset
        ? [
            {
              key: "asset",
              label: selectedAsset.asset_name || selectedAsset.asset_id || selectedAsset.asset_uuid,
              onRemove: () => {
                setAssetFilter("ALL");
                setReleaseFilter(null);
                updateDocumentPortalQuery("ALL", null);
              },
            },
          ]
        : []),
      ...(selectedRelease
        ? [
            {
              key: "release",
              label: `Release ${selectedRelease.version || selectedRelease.release_id}`,
              onRemove: () => {
                setReleaseFilter(null);
                updateDocumentPortalQuery(selectedAsset?.asset_uuid ?? "ALL", null);
              },
            },
          ]
        : []),
      ...(search.trim()
        ? [
            {
              key: "search",
              label: `Search: ${search.trim()}`,
              onRemove: () => setSearch(""),
            },
          ]
        : []),
    ],
    [search, selectedAsset, selectedRelease],
  );

  const handleAssetChange = (value: string | null) => {
    const nextAssetId = value || "ALL";
    setAssetFilter(nextAssetId);
    setReleaseFilter(null);
    setReleaseOptions([]);
    updateDocumentPortalQuery(nextAssetId, null);
  };

  const handleReleaseChange = (value: string) => {
    const nextReleaseId = value || null;
    setReleaseFilter(nextReleaseId);
    updateDocumentPortalQuery(selectedAsset?.asset_uuid ?? "ALL", nextReleaseId);
  };

  const clearContextAndFilters = () => {
    setAssetFilter("ALL");
    setReleaseFilter(null);
    setReleaseOptions([]);
    setSearch("");
    updateDocumentPortalQuery("ALL", null);
  };

  const refreshAll = async () => {
    await Promise.all([loadShell(), loadWorkspace()]);
  };

  const openCreateAuthored = () => {
    if (!canCreateDocument || !selectedAsset) return;
    setEditingAuthoredId(null);
    setAuthoredEditorOpen(true);
  };

  const openAuthored = (document: AuthoredDocumentRecord) => {
    if (!canViewDocuments && !canUpdateDocument) return;
    setEditingAuthoredId(document.authored_document_id);
    setAuthoredEditorOpen(true);
  };

  const openCreateQualification = () => {
    if (!canCreateDocument || !selectedAsset) return;
    setEditingQualificationId(null);
    setQualificationEditorOpen(true);
  };

  const openQualification = (document: QualificationDocumentRecord) => {
    if (!canViewDocuments && !canUpdateDocument) return;
    setEditingQualificationId(document.qualification_document_id);
    setQualificationEditorOpen(true);
  };

  const handleDeleteAuthored = async () => {
    if (!authoredToDelete || !canDeleteDocument || !canDeleteAuthoredDocument(authoredToDelete.status)) return;

    setDeleting(true);
    try {
      await deleteAuthoredDocument(authoredToDelete.authored_document_id);
      toast.success("Authored document deleted successfully");
      setAuthoredToDelete(null);
      await loadWorkspace();
    } catch (error) {
      const mapped = mapAuthoredDocumentAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteQualification = async () => {
    if (
      !qualificationToDelete ||
      !canDeleteDocument ||
      !canDeleteQualificationDocument(qualificationToDelete.status)
    ) {
      return;
    }

    setDeleting(true);
    try {
      await deleteQualificationDocument(qualificationToDelete.qualification_document_id);
      toast.success("Qualification document deleted successfully");
      setQualificationToDelete(null);
      await loadWorkspace();
    } catch (error) {
      const mapped = mapQualificationDocumentAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteLinked = async () => {
    if (!linkedToDelete || !canDeleteDocument) return;

    setDeleting(true);
    try {
      await deleteDocumentLink(linkedToDelete.document_link_id);
      toast.success("Document link deleted successfully");
      setLinkedToDelete(null);
      await loadWorkspace();
    } catch (error) {
      const mapped = mapDocumentLinkAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleReprocessDocument = async (document: DocumentLinkRecord) => {
    if (!canUpdateDocument) return;

    try {
      await reprocessDocumentVectorization(document.document_link_id);
      toast.success("Document vectorization queued");
      await loadWorkspace({ silent: true });
    } catch (error) {
      const mapped = mapDocumentLinkAxiosError(error);
      toast.error(mapped.message);
    }
  };

  const handleViewInDocumentIntelligence = (document: DocumentLinkRecord) => {
    if (!canViewDocuments) return;
    const documentId = getLinkedDocumentIntelligenceId(document);
    if (!documentId) return;
    navigateToDocumentIntelligence(selectedAsset?.asset_uuid, documentId);
  };

  const linkedContext = portalContext
    ? portalContext.type === "release"
      ? {
          type: "release" as const,
          releaseId: portalContext.releaseId,
          assetName: portalContext.assetName,
          releaseVersion: portalContext.releaseVersion,
          createdDt: portalContext.createdDt,
          endDt: portalContext.endDt,
        }
      : portalContext
    : {
        type: "asset" as const,
        assetId: null,
        assetName: null,
        assetCode: null,
        assetVersion: null,
      };

  const showNoAssetState = !selectedAsset && activeTab !== "templates";
  const contextTitle = getContextTitle(selectedAsset, selectedRelease);

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title="Document Portal"
        subtitle="Manage authored documents, qualification evidence, linked documents, and templates"
        stats={headerStats}
        secondaryActions={[
          {
            key: "refresh",
            label: shellLoading || workspaceLoading ? "Loading" : "Refresh",
            icon: "refresh",
            variant: "secondary",
            onClick: () => void refreshAll(),
            disabled: shellLoading || workspaceLoading,
          },
        ]}
      />

      <main className={PAGE_CONTENT_CLASS}>
        <FilterBar
          activeFilters={activeFilters}
          onClearAll={clearContextAndFilters}
          className="sticky top-0 z-20 shadow-sm"
        >
          <SearchableCombobox
            label="Asset"
            options={assetOptions}
            value={selectedAsset?.asset_uuid ?? null}
            onChange={(value) => handleAssetChange(value)}
            placeholder="Search asset..."
            emptyText="No assets found"
            disabled={shellLoading}
            className="min-w-72"
          />

          <label className="flex min-w-56 flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span>Release</span>
            <select
              value={selectedRelease?.release_id ?? ""}
              onChange={(event) => handleReleaseChange(event.target.value)}
              className="h-9 rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              disabled={!selectedAsset || workspaceLoading}
            >
              <option value="">All asset documents</option>
              {releaseOptions.map((release) => (
                <option key={release.release_id} value={release.release_id}>
                  {release.version || release.release_id}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-72 flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
            <span>Search Documents</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search documents, source, version, or status..."
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-9 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                disabled={shellLoading}
              />
              {search ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => setSearch("")}
                  aria-label="Clear document search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </label>
        </FilterBar>

        <section className="rounded-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{contextTitle}</p>
              <p className="mt-1 text-xs text-slate-500">
                {selectedAsset
                  ? selectedRelease
                    ? "Release-scoped workspace using release document APIs."
                    : "Asset-scoped workspace using asset document APIs."
                  : "Select an asset to load authored documents, qualification evidence, and linked documents."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricTile label="Authored" value={authoredDocuments.length} />
              <MetricTile label="Evidence" value={qualificationDocuments.length} />
              <MetricTile label="Linked" value={linkedDocuments.length} />
              <MetricTile label="Templates" value={templates.length} />
            </div>
          </div>
        </section>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PortalTab)} className="gap-4">
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md border border-slate-200 bg-white p-1">
            <TabsTrigger value="authored" className="min-w-40 rounded">
              <FileText className="size-4" />
              Authored Documents
            </TabsTrigger>
            <TabsTrigger value="qualification" className="min-w-44 rounded">
              <FileCheck2 className="size-4" />
              Qualification Evidence
            </TabsTrigger>
            <TabsTrigger value="linked" className="min-w-40 rounded">
              <Link2 className="size-4" />
              Linked Documents
            </TabsTrigger>
            <TabsTrigger value="templates" className="min-w-32 rounded">
              <Library className="size-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          {showNoAssetState ? (
            <EmptyState
              title="Select an asset context"
              description="Document Portal works from an asset or release context so regulated actions are scoped correctly."
              icon={<FileText className="h-5 w-5" />}
            />
          ) : null}

          <TabsContent value="authored">
            {!showNoAssetState ? (
              <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                  icon={<FileText className="h-5 w-5" />}
                  title="Authored Documents"
                  description="Manage URS, FRS, and system-authored documents for the selected context."
                  action={
                    canCreateDocument ? (
                      <Button type="button" size="sm" onClick={openCreateAuthored} disabled={workspaceLoading}>
                        <FilePlus2 className="size-4" />
                        New Authored Document
                      </Button>
                    ) : null
                  }
                />

                <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 md:grid-cols-3">
                  <MetricTile label="In Review" value={authoredDocuments.filter((document) => document.status === "IN_REVIEW").length} />
                  <MetricTile label="Approved" value={authoredDocuments.filter((document) => document.status === "APPROVED").length} />
                  <MetricTile
                    label="Publish Failed"
                    value={authoredDocuments.filter((document) => document.publish_status === "PUBLISH_FAILED").length}
                  />
                </div>

                {authoredToDelete ? (
                  <div className="px-4 pt-4">
                    <ConfirmStrip
                      title="Delete authored document?"
                      message={`This will remove "${authoredToDelete.title || "Untitled authored document"}".`}
                      confirmLabel={deleting ? "Deleting..." : "Delete"}
                      onConfirm={() => void handleDeleteAuthored()}
                      onCancel={() => setAuthoredToDelete(null)}
                      disabled={deleting}
                      tone="danger"
                    />
                  </div>
                ) : null}

                {!workspaceLoading && filteredAuthoredDocuments.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      title={search.trim() ? "No authored document search results" : "No authored documents"}
                      description={
                        search.trim()
                          ? "No authored documents match the current search."
                          : "Create an authored document from an available template when this context needs a URS or FRS workflow."
                      }
                      action={
                        canCreateDocument && !search.trim() ? (
                          <Button type="button" size="sm" onClick={openCreateAuthored}>
                            <FilePlus2 className="size-4" />
                            New Authored Document
                          </Button>
                        ) : null
                      }
                      icon={<FileText className="h-5 w-5" />}
                    />
                  </div>
                ) : (
                  <AuthoredDocumentTable
                    documents={filteredAuthoredDocuments}
                    loading={workspaceLoading}
                    onOpen={openAuthored}
                    onDelete={(document) => setAuthoredToDelete(document)}
                    canOpenRecord={canViewDocuments || canUpdateDocument}
                    canDelete={canDeleteDocument}
                    emptyMessage="No authored documents."
                  />
                )}
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="qualification">
            {!showNoAssetState ? (
              <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                  icon={<UploadCloud className="h-5 w-5" />}
                  title="Qualification Evidence"
                  description="Manage IQ, OQ, and PQ evidence with supplier and review context."
                  action={
                    canCreateDocument ? (
                      <Button type="button" size="sm" onClick={openCreateQualification} disabled={workspaceLoading}>
                        <UploadCloud className="size-4" />
                        Upload Evidence
                      </Button>
                    ) : null
                  }
                />

                <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 md:grid-cols-3">
                  <MetricTile label="Submitted" value={qualificationDocuments.filter((document) => document.status === "SUBMITTED").length} />
                  <MetricTile label="In Review" value={qualificationDocuments.filter((document) => document.status === "IN_REVIEW").length} />
                  <MetricTile label="Accepted" value={qualificationDocuments.filter((document) => document.status === "ACCEPTED").length} />
                </div>

                {qualificationToDelete ? (
                  <div className="px-4 pt-4">
                    <ConfirmStrip
                      title="Delete qualification evidence?"
                      message={`This will remove "${qualificationToDelete.document_name || "Untitled evidence"}".`}
                      confirmLabel={deleting ? "Deleting..." : "Delete"}
                      onConfirm={() => void handleDeleteQualification()}
                      onCancel={() => setQualificationToDelete(null)}
                      disabled={deleting}
                      tone="danger"
                    />
                  </div>
                ) : null}

                {!workspaceLoading && filteredQualificationDocuments.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      title={search.trim() ? "No evidence search results" : "No qualification evidence"}
                      description={
                        search.trim()
                          ? "No qualification evidence matches the current search."
                          : "Upload IQ, OQ, or PQ evidence when supplier qualification records are available."
                      }
                      action={
                        canCreateDocument && !search.trim() ? (
                          <Button type="button" size="sm" onClick={openCreateQualification}>
                            <UploadCloud className="size-4" />
                            Upload Evidence
                          </Button>
                        ) : null
                      }
                      icon={<FileCheck2 className="h-5 w-5" />}
                    />
                  </div>
                ) : (
                  <QualificationDocumentTable
                    documents={filteredQualificationDocuments}
                    loading={workspaceLoading}
                    onOpen={openQualification}
                    onDelete={(document) => setQualificationToDelete(document)}
                    canOpenRecord={canViewDocuments || canUpdateDocument}
                    canDelete={canDeleteDocument}
                    canPreview={canViewDocuments}
                    emptyMessage="No qualification evidence."
                  />
                )}
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="linked">
            {!showNoAssetState ? (
              <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                  icon={<Link2 className="h-5 w-5" />}
                  title="Linked Documents"
                  description="Manage external/manual document links and vectorization handoff."
                  action={
                    canCreateDocument ? (
                      <Button type="button" size="sm" onClick={() => setCreateDocumentOpen(true)} disabled={workspaceLoading}>
                        <Link2 className="size-4" />
                        Link Document
                      </Button>
                    ) : null
                  }
                />

                <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 md:grid-cols-4">
                  <MetricTile label="Linked" value={linkedDocuments.length} />
                  <MetricTile
                    label="Vectorized"
                    value={linkedDocuments.filter((document) => document.vectorization_status === "COMPLETED").length}
                  />
                  <MetricTile
                    label="Processing"
                    value={linkedDocuments.filter((document) => isDocumentVectorizationActive(document)).length}
                  />
                  <MetricTile
                    label="Failed"
                    value={linkedDocuments.filter((document) => document.vectorization_status === "FAILED").length}
                  />
                </div>

                {linkedToDelete ? (
                  <div className="px-4 pt-4">
                    <ConfirmStrip
                      title="Delete linked document?"
                      message={`This will remove "${linkedToDelete.document_name || "Untitled linked document"}".`}
                      confirmLabel={deleting ? "Deleting..." : "Delete"}
                      onConfirm={() => void handleDeleteLinked()}
                      onCancel={() => setLinkedToDelete(null)}
                      disabled={deleting}
                      tone="danger"
                    />
                  </div>
                ) : null}

                {!workspaceLoading && filteredLinkedDocuments.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      title={search.trim() ? "No linked document search results" : "No linked documents"}
                      description={
                        search.trim()
                          ? "No linked documents match the current search."
                          : "Link an external document or upload a file to make vectorization status visible here."
                      }
                      action={
                        canCreateDocument && !search.trim() ? (
                          <Button type="button" size="sm" onClick={() => setCreateDocumentOpen(true)}>
                            <Link2 className="size-4" />
                            Link Document
                          </Button>
                        ) : null
                      }
                      icon={<Link2 className="h-5 w-5" />}
                    />
                  </div>
                ) : (
                  <AssetDocumentTable
                    documents={filteredLinkedDocuments}
                    loading={workspaceLoading}
                    onEdit={(document) => setEditDocumentId(document.document_link_id)}
                    onDelete={(document) => setLinkedToDelete(document)}
                    onReprocess={(document) => void handleReprocessDocument(document)}
                    onViewIntelligence={handleViewInDocumentIntelligence}
                    canUpdate={canUpdateDocument}
                    canDelete={canDeleteDocument}
                    canPreview={canViewDocuments}
                    canViewIntelligence={canViewDocuments}
                    sourceSystemOptions={sourceSystemOptions}
                    emptyMessage="No linked documents."
                  />
                )}
              </section>
            ) : null}
          </TabsContent>

          <TabsContent value="templates">
            <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
              <SectionHeader
                icon={<Library className="h-5 w-5" />}
                title="Templates"
                description="Read-only catalog of templates used by authored document creation."
              />

              <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 md:grid-cols-3">
                <MetricTile label="Templates" value={templates.length} />
                <MetricTile label="Active" value={templates.filter((template) => template.is_active).length} />
                <MetricTile label="Visible" value={filteredTemplates.length} />
              </div>

              <TemplateCatalog templates={filteredTemplates} loading={templatesLoading} search={search} />
            </section>
          </TabsContent>
        </Tabs>
      </main>

      {/* TODO: Move this complex regulated workflow into RightPanel once the editor has focused regression coverage. */}
      <AuthoredDocumentEditorModal
        open={Boolean(selectedAsset) && authoredEditorOpen}
        context={authoredDocumentContext}
        authoredDocumentId={editingAuthoredId}
        onClose={() => {
          setAuthoredEditorOpen(false);
          setEditingAuthoredId(null);
        }}
        onSaved={loadWorkspace}
        canCreate={canCreateDocument}
        canEdit={canUpdateDocument}
        canSubmit={canUpdateDocument}
        canReview={canUpdateDocument}
        canPublish={canUpdateDocument}
        canRetryPublish={canUpdateDocument}
        canComment={canUpdateDocument}
        canAiAssist={canUpdateDocument}
        canPreview={canViewDocuments}
      />

      {/* TODO: Move this complex evidence review form into RightPanel after workflow parity tests are in place. */}
      <QualificationDocumentModal
        open={Boolean(selectedAsset) && qualificationEditorOpen}
        context={qualificationDocumentContext}
        suppliers={suppliers}
        releaseOptions={releaseOptions}
        sourceSystemOptions={sourceSystemOptions}
        qualificationDocumentId={editingQualificationId}
        onClose={() => {
          setQualificationEditorOpen(false);
          setEditingQualificationId(null);
        }}
        onSaved={loadWorkspace}
        canCreate={canCreateDocument}
        canEdit={canUpdateDocument}
        canSubmit={canUpdateDocument}
        canReview={canUpdateDocument}
      />

      {canCreateDocument ? (
        <CreateDocumentLinkModal
          open={Boolean(selectedAsset) && createDocumentOpen}
          context={linkedContext}
          sourceSystemOptions={sourceSystemOptions}
          presentation="panel"
          onClose={() => setCreateDocumentOpen(false)}
          onCreated={async () => {
            await loadWorkspace();
            setCreateDocumentOpen(false);
          }}
        />
      ) : null}

      {canUpdateDocument ? (
        <EditDocumentLinkModal
          open={Boolean(selectedAsset) && Boolean(editDocumentId)}
          documentLinkId={editDocumentId}
          context={linkedContext}
          sourceSystemOptions={sourceSystemOptions}
          presentation="panel"
          onClose={() => setEditDocumentId(null)}
          onUpdated={async () => {
            await loadWorkspace();
            setEditDocumentId(null);
          }}
        />
      ) : null}

      <Toaster position="top-right" richColors />
    </div>
  );
}
