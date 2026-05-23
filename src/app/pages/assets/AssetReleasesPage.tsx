import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";

import { AssetRecord, getAssets } from "../../../services/asset.service";
import {
  deleteRelease,
  downloadImpactAssessment,
  getReleasesByAssetId,
  regenerateImpactAssessment,
  ReleaseRecord,
} from "../../../services/release.service";
import { getSuppliers, SupplierRecord } from "../../../services/supplier.service";
import { CommonPageHeader, PAGE_CONTENT_CLASS, PAGE_LAYOUT_SHELL_CLASS } from "../../components/layout/CommonPageHeader";
import { buildPageHeaderStats, getPageHeaderConfig } from "../../components/layout/pageHeaderConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { CreateReleaseModal } from "../../components/assets/CreateReleaseModal";
import { EditReleaseModal } from "../../components/assets/EditReleaseModal";
import { ReleaseAssessmentModal } from "../../components/assets/ReleaseAssessmentModal";
import { ReleaseDocumentsModal } from "../../components/assets/ReleaseDocumentsModal";
import {
  formatDocumentationMode,
  getDocumentationModeBadgeClass,
  mapReleaseAxiosError,
} from "../../components/assets/releaseForm.shared";
import { loadOmsSourceSystemOptions } from "../../components/assets/documentLinkForm.shared";
import { LookupOption } from "../../services/lookupValue.service";

interface ReleaseRow {
  release: ReleaseRecord;
  asset: AssetRecord;
}

const normalize = (value?: string | null): string => (value ?? "").trim();

const getInitialAssetFilter = (): string => {
  if (typeof window === "undefined") return "ALL";
  return new URLSearchParams(window.location.search).get("asset_id") || "ALL";
};

const updateAssetQueryParam = (assetId: string) => {
  const url = new URL(window.location.href);
  url.pathname = "/asset-releases";
  if (assetId === "ALL") {
    url.searchParams.delete("asset_id");
  } else {
    url.searchParams.set("asset_id", assetId);
  }
  window.history.replaceState({}, "", `${url.pathname}${url.search}`);
};

const findAssetByToken = (assets: AssetRecord[], token: string): AssetRecord | null => {
  if (!token || token === "ALL") return null;
  return assets.find((asset) => asset.asset_uuid === token || asset.asset_id === token) ?? null;
};

const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const getSortValue = (release: ReleaseRecord): number => {
  const parsed = Date.parse(release.created_dt ?? release.modified_dt ?? release.end_dt ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
};

export function AssetReleasesPage() {
  const header = getPageHeaderConfig("asset-releases");
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [sourceSystemOptions, setSourceSystemOptions] = useState<LookupOption[]>([]);
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assetFilter, setAssetFilter] = useState(getInitialAssetFilter);
  const [modeFilter, setModeFilter] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [editReleaseId, setEditReleaseId] = useState<string | null>(null);
  const [workspaceRelease, setWorkspaceRelease] = useState<ReleaseRecord | null>(null);
  const [assessmentReleaseId, setAssessmentReleaseId] = useState<string | null>(null);
  const [assessmentReloadToken, setAssessmentReloadToken] = useState(0);
  const [releaseToDelete, setReleaseToDelete] = useState<ReleaseRecord | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const selectedAsset = useMemo(() => findAssetByToken(assets, assetFilter), [assetFilter, assets]);

  const loadPage = useCallback(async () => {
    setLoading(true);
    try {
      const [assetData, supplierData, sourceOptions] = await Promise.all([
        getAssets(),
        getSuppliers(),
        loadOmsSourceSystemOptions(),
      ]);

      const releaseResults = await Promise.allSettled(
        assetData.map(async (asset) => ({
          asset,
          releases: await getReleasesByAssetId(asset.asset_uuid),
        })),
      );

      const nextRows = releaseResults.flatMap((result) => {
        if (result.status !== "fulfilled") return [];
        return result.value.releases.map((release) => ({ asset: result.value.asset, release }));
      });

      setAssets(assetData);
      setSuppliers(supplierData);
      setSourceSystemOptions(sourceOptions);
      setRows(nextRows.sort((left, right) => getSortValue(right.release) - getSortValue(left.release)));
      const initialAsset = findAssetByToken(assetData, assetFilter);
      if (initialAsset && initialAsset.asset_uuid !== assetFilter) {
        setAssetFilter(initialAsset.asset_uuid);
        updateAssetQueryParam(initialAsset.asset_uuid);
      }
    } catch (error) {
      console.error("Failed to load asset releases:", error);
      toast.error("Failed to load asset releases");
    } finally {
      setLoading(false);
    }
  }, [assetFilter]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(({ asset, release }) => {
      if (assetFilter !== "ALL" && asset.asset_uuid !== assetFilter && asset.asset_id !== assetFilter) return false;
      if (modeFilter !== "ALL" && release.documentation_mode !== modeFilter) return false;
      if (!query) return true;

      return [
        release.version,
        release.system_config_report,
        release.documentation_text,
        release.documentation_source_url,
        asset.asset_id,
        asset.asset_name,
        asset.supplier_name,
        asset.manufacturer,
        asset.model,
      ]
        .map((value) => normalize(value).toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [assetFilter, modeFilter, rows, search]);

  const assessmentRelease = useMemo(
    () => rows.find((row) => row.release.release_id === assessmentReleaseId)?.release ?? null,
    [assessmentReleaseId, rows],
  );
  const workspaceAsset = useMemo(
    () => rows.find((row) => row.release.release_id === workspaceRelease?.release_id)?.asset ?? null,
    [rows, workspaceRelease?.release_id],
  );
  const assessmentAsset = useMemo(
    () => rows.find((row) => row.release.release_id === assessmentReleaseId)?.asset ?? null,
    [assessmentReleaseId, rows],
  );

  const headerStats = buildPageHeaderStats(header.stats, {
    releases: filteredRows.length,
    assets: new Set(filteredRows.map((row) => row.asset.asset_uuid)).size,
    manual: filteredRows.filter((row) => row.release.documentation_mode === "MANUAL").length,
    online: filteredRows.filter((row) => row.release.documentation_mode === "ONLINE_FETCH").length,
  });

  const createDisabledReason = !selectedAsset
    ? "Select an asset to create a release."
    : !selectedAsset.can_create_release
      ? "This asset class is not configured for upgrade-managed releases."
      : null;

  const handleAssetFilterChange = (value: string) => {
    setAssetFilter(value);
    updateAssetQueryParam(value);
  };

  const handleDeleteRelease = async () => {
    if (!releaseToDelete) return;
    setDeleting(true);
    try {
      await deleteRelease(releaseToDelete.release_id);
      toast.success("Release deleted successfully");
      await loadPage();
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setReleaseToDelete(null);
    }
  };

  const handleRegenerateAssessment = async (release: ReleaseRecord) => {
    try {
      await regenerateImpactAssessment(release.release_id);
      toast.success("Impact assessment regenerated successfully");
      if (assessmentReleaseId === release.release_id) {
        setAssessmentReloadToken((previous) => previous + 1);
      }
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    }
  };

  const handleDownloadAssessment = async (release: ReleaseRecord) => {
    try {
      const fileName = await downloadImpactAssessment(release.release_id);
      toast.success(`Downloaded ${fileName}`);
    } catch (error) {
      const mapped = mapReleaseAxiosError(error);
      toast.error(mapped.message);
    }
  };

  return (
    <div className={PAGE_LAYOUT_SHELL_CLASS}>
      <CommonPageHeader
        breadcrumbs={header.breadcrumbs}
        sectionLabel={header.sectionLabel}
        title={header.title}
        subtitle={header.subtitle}
        search={{
          value: search,
          placeholder: header.searchPlaceholder || "Search releases...",
          onChange: setSearch,
          onClear: () => setSearch(""),
          disabled: loading,
        }}
        stats={headerStats}
        primaryAction={{
          ...(header.primaryAction ?? { key: "create-release", label: "Create Release", icon: "plus" }),
          onClick: () => setCreateOpen(true),
          disabled: loading || Boolean(createDisabledReason),
        }}
        secondaryActions={[
          {
            ...(header.secondaryActions?.[0] ?? { key: "refresh", label: "Refresh", icon: "refresh", variant: "secondary" }),
            label: loading ? "Loading" : "Refresh",
            onClick: () => void loadPage(),
            disabled: loading,
          },
        ]}
      />

      <div className={PAGE_CONTENT_CLASS}>
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Release Workspace Index</p>
              <p className="mt-1 text-xs text-slate-500">Release records remain linked by Asset ID while workflow actions live here.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span>Asset</span>
                <select
                  value={assetFilter}
                  onChange={(event) => handleAssetFilterChange(event.target.value)}
                  className="h-9 min-w-52 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  disabled={loading}
                >
                  <option value="ALL">All assets</option>
                  {assets.map((asset) => (
                    <option key={asset.asset_uuid} value={asset.asset_uuid}>
                      {asset.asset_id} | {asset.asset_name || "Unnamed asset"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-slate-600">
                <span>Documentation</span>
                <select
                  value={modeFilter}
                  onChange={(event) => setModeFilter(event.target.value)}
                  className="h-9 min-w-40 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                  disabled={loading}
                >
                  <option value="ALL">All modes</option>
                  <option value="MANUAL">{formatDocumentationMode("MANUAL")}</option>
                  <option value="ONLINE_FETCH">{formatDocumentationMode("ONLINE_FETCH")}</option>
                </select>
              </label>
            </div>
          </div>

          {createDisabledReason ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
              {createDisabledReason}
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-white">
                  <TableHead className="min-w-[16rem] font-semibold">Asset</TableHead>
                  <TableHead className="font-semibold">Version</TableHead>
                  <TableHead className="font-semibold">Documentation</TableHead>
                  <TableHead className="min-w-[16rem] font-semibold">System Configuration Report</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold">End</TableHead>
                  <TableHead className="min-w-[20rem] font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                      Loading asset releases...
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-slate-500">
                      No release records match the current view.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map(({ asset, release }) => (
                    <TableRow key={release.release_id} className="hover:bg-slate-50">
                      <TableCell className="align-top">
                        <div className="font-medium text-slate-900">{asset.asset_name || "-"}</div>
                        <p className="mt-1 text-xs text-slate-500">{asset.asset_id || release.asset_id}</p>
                      </TableCell>
                      <TableCell className="align-top font-medium text-slate-900">{release.version || "-"}</TableCell>
                      <TableCell className="align-top">
                        <Badge variant="outline" className={getDocumentationModeBadgeClass(release.documentation_mode)}>
                          {formatDocumentationMode(release.documentation_mode)}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="max-w-[20rem] truncate text-slate-600" title={release.system_config_report ?? undefined}>
                          {normalize(release.system_config_report) || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="align-top" title={release.created_dt ?? undefined}>{formatDate(release.created_dt)}</TableCell>
                      <TableCell className="align-top" title={release.end_dt ?? undefined}>{formatDate(release.end_dt)}</TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setWorkspaceRelease(release)}>
                            Workspace
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditReleaseId(release.release_id)}>
                            Version Details
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setAssessmentReleaseId(release.release_id)}>
                            View
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => void handleRegenerateAssessment(release)}>
                            Regenerate
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => void handleDownloadAssessment(release)}>
                            Download
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => {
                              setReleaseToDelete(release);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <CreateReleaseModal
        open={createOpen}
        assetId={selectedAsset?.asset_uuid ?? null}
        assetName={selectedAsset?.asset_name}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          await loadPage();
          setCreateOpen(false);
        }}
      />

      <EditReleaseModal
        open={Boolean(editReleaseId)}
        releaseId={editReleaseId}
        onClose={() => setEditReleaseId(null)}
        onUpdated={async () => {
          await loadPage();
          setEditReleaseId(null);
        }}
      />

      <ReleaseDocumentsModal
        open={Boolean(workspaceRelease)}
        release={workspaceRelease}
        assetName={workspaceAsset?.asset_name || workspaceRelease?.asset_name}
        assetCode={workspaceAsset?.asset_id || workspaceRelease?.asset_id}
        suppliers={suppliers}
        sourceSystemOptions={sourceSystemOptions}
        onClose={() => setWorkspaceRelease(null)}
      />

      <ReleaseAssessmentModal
        open={Boolean(assessmentRelease)}
        release={assessmentRelease}
        assetName={assessmentAsset?.asset_name || assessmentRelease?.asset_name}
        reloadToken={assessmentReloadToken}
        onClose={() => setAssessmentReleaseId(null)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Release</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete release "{releaseToDelete?.version}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDeleteRelease();
              }}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster position="top-right" richColors />
    </div>
  );
}
