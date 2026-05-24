import React, { useEffect, useMemo, useState } from "react";
import { Building2, CircleDollarSign, ExternalLink, FileJson, FileText, MapPin, RotateCw, Workflow } from "lucide-react";
import { toast } from "sonner";

import { AssetRecord, getAssetById } from "../../../services/asset.service";
import { AssetFinanceRecord, getAssetFinance } from "../../../services/asset-finance.service";
import { AssetLocationRecord, getAssetLocation } from "../../../services/asset-location.service";
import { OrgNode } from "../../../services/org.service";
import { SupplierRecord } from "../../../services/supplier.service";
import { PermissionGuard } from "../../auth/PermissionGuard";
import {
  navigateToAssetReleases,
  navigateToDocumentIntelligence,
  navigateToDocumentPortal,
  navigateToPeriodicReview,
  navigateToSupplierEvaluations,
} from "../../utils/moduleNavigation";
import { LookupOption } from "../../services/lookupValue.service";
import { EmptyState, StatusBadge } from "../foundation";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Drawer } from "../ui/Modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { buildOrgMap, getCriticalityBadgeClass } from "./assetForm.shared";

export type AssetDetailTab = "overview" | "location" | "finance" | "references";

interface AssetDetailDrawerProps {
  open: boolean;
  assetId: string | null;
  initialTab?: AssetDetailTab;
  onClose: () => void;
  orgTree?: OrgNode[];
  suppliers?: SupplierRecord[];
  assetClasses?: LookupOption[];
  assetCategories?: LookupOption[];
  assetSubCategories?: LookupOption[];
  assetTypes?: LookupOption[];
  assetStatuses?: LookupOption[];
  currencies?: LookupOption[];
  depreciationMethods?: LookupOption[];
  assetClassGlOptions?: LookupOption[];
  criticalities?: LookupOption[];
  assetNatures?: LookupOption[];
}

interface ReferenceCard {
  title: string;
  description: string;
  action: string;
  icon: React.ReactNode;
  permission?: string;
  anyOf?: string[];
  onClick: () => void;
}

const detailTabs: Array<{ key: AssetDetailTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "location", label: "Location" },
  { key: "finance", label: "Finance" },
  { key: "references", label: "References" },
];

const formatValue = (value?: string | number | null): string => {
  if (value === undefined || value === null || String(value).trim() === "") return "-";
  return String(value);
};

const formatDate = (value?: string | null): string => {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
};

const formatMoney = (value?: number | string | null, currency?: string | null): string => {
  if (value === undefined || value === null || value === "") return "-";
  const numeric = typeof value === "number" ? value : Number(value);
  const rendered = Number.isFinite(numeric) ? numeric.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(value);
  return currency ? `${currency} ${rendered}` : rendered;
};

const findLookupLabel = (options: LookupOption[] = [], code?: string | null): string => {
  if (!code) return "-";
  const found = options.find((item) => item.code === code);
  return found?.value || code;
};

const statusKind = (status?: string | null): "active" | "inactive" | "pending" => {
  if (status === "ACTIVE") return "active";
  if (!status) return "pending";
  return "inactive";
};

const FieldGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{children}</div>
);

const FieldItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <div className="mt-1 break-words text-sm font-medium text-slate-900">{value}</div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
    {children}
  </section>
);

export function AssetDetailDrawer({
  open,
  assetId,
  initialTab = "overview",
  onClose,
  orgTree = [],
  suppliers = [],
  assetClasses = [],
  assetCategories = [],
  assetSubCategories = [],
  assetTypes = [],
  assetStatuses = [],
  currencies = [],
  depreciationMethods = [],
  assetClassGlOptions = [],
  criticalities = [],
  assetNatures = [],
}: AssetDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<AssetDetailTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [asset, setAsset] = useState<AssetRecord | null>(null);
  const [location, setLocation] = useState<AssetLocationRecord | null>(null);
  const [finance, setFinance] = useState<AssetFinanceRecord | null>(null);

  const orgMap = useMemo(() => buildOrgMap(orgTree), [orgTree]);
  const supplierMap = useMemo(
    () => new Map<string, string>(suppliers.map((supplier) => [supplier.supplier_id, supplier.supplier_name])),
    [suppliers],
  );

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
  }, [initialTab, open]);

  useEffect(() => {
    if (!open || !assetId) {
      setAsset(null);
      setLocation(null);
      setFinance(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const run = async () => {
      try {
        const [assetDetail, locationDetail, financeDetail] = await Promise.all([
          getAssetById(assetId),
          getAssetLocation(assetId).catch(() => null),
          getAssetFinance(assetId).catch(() => null),
        ]);
        if (cancelled) return;
        setAsset(assetDetail);
        setLocation(locationDetail);
        setFinance(financeDetail);
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load asset detail");
          onClose();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [assetId, onClose, open]);

  const orgLabel = asset?.org_node_name || (asset?.org_node_id ? orgMap.get(asset.org_node_id)?.name : null) || "-";
  const supplierLabel =
    asset?.supplier_name || (asset?.supplier_id ? supplierMap.get(asset.supplier_id) : null) || "-";
  const statusLabel = findLookupLabel(assetStatuses, asset?.asset_status);
  const currencyLabel = findLookupLabel(currencies, asset?.asset_currency);

  // Related modules normalize both asset_uuid and business asset_id; UUID is preferred when available.
  const referenceAssetId = asset?.asset_uuid || asset?.asset_id || assetId || "";

  const referenceCards: ReferenceCard[] = [
    {
      title: "Releases",
      description: "Release planning, version changes, and impact assessment.",
      action: "View Releases",
      icon: <Workflow className="h-5 w-5" />,
      permission: "ASSET_VIEW",
      onClick: () => navigateToAssetReleases(referenceAssetId),
    },
    {
      title: "Documents",
      description: "Authored, qualification, and linked asset documents.",
      action: "View Documents",
      icon: <FileText className="h-5 w-5" />,
      permission: "DOCUMENT_VIEW",
      onClick: () => navigateToDocumentPortal(referenceAssetId),
    },
    {
      title: "Supplier Evaluations",
      description: "Supplier response and assessment workflows.",
      action: "View Supplier Evaluations",
      icon: <Building2 className="h-5 w-5" />,
      anyOf: ["ASSET_VIEW", "SUPPLIER_VIEW"],
      onClick: () => navigateToSupplierEvaluations(referenceAssetId, asset?.supplier_id ?? undefined),
    },
    {
      title: "Periodic Review",
      description: "Manual audit-trail review activity for this asset.",
      action: "View Periodic Reviews",
      icon: <RotateCw className="h-5 w-5" />,
      anyOf: ["SCHEDULE_VIEW", "AUDIT_REVIEW_VIEW"],
      onClick: () => navigateToPeriodicReview(referenceAssetId),
    },
    {
      title: "Document Intelligence",
      description: "Vectorization, extraction, and intelligence status.",
      action: "View Intelligence",
      icon: <FileJson className="h-5 w-5" />,
      permission: "DOCUMENT_VIEW",
      onClick: () => navigateToDocumentIntelligence(referenceAssetId),
    },
  ];

  return (
    <Drawer open={open} onClose={onClose} title="Asset Master Detail" width="w-[52rem] max-w-[96vw]">
      <div className="space-y-5 px-5 py-4">
        {loading ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Loading asset detail...
          </div>
        ) : !asset ? (
          <EmptyState title="No asset selected" description="Select an asset row to view master data details." />
        ) : (
          <>
            <div className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Asset Master</p>
                  <h3 className="mt-1 text-xl font-semibold text-slate-900">{formatValue(asset.asset_name)}</h3>
                  <p className="mt-1 text-sm text-slate-500">{formatValue(asset.asset_id)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {asset.asset_status ? <StatusBadge status={statusKind(asset.asset_status)} title={statusLabel} /> : null}
                  {asset.criticality_class ? (
                    <Badge variant="outline" className={getCriticalityBadgeClass(asset.criticality_class)}>
                      {findLookupLabel(criticalities, asset.criticality_class)}
                    </Badge>
                  ) : null}
                </div>
              </div>
              {asset.short_description ? <p className="mt-3 text-sm text-slate-600">{asset.short_description}</p> : null}
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AssetDetailTab)} className="gap-4">
              <TabsList className="w-full justify-start rounded-md">
                {detailTabs.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key} className="flex-none rounded-md px-3">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-5">
                <Section title="Core Identity">
                  <FieldGrid>
                    <FieldItem label="Asset ID" value={formatValue(asset.asset_id)} />
                    <FieldItem label="Asset Name" value={formatValue(asset.asset_name)} />
                    <FieldItem label="Serial Number" value={formatValue(asset.serial_number)} />
                    <FieldItem label="Legacy ID" value={formatValue(asset.legacy_id)} />
                    <FieldItem label="Tag Number" value={formatValue(asset.tag_number)} />
                    <FieldItem label="Version" value={formatValue(asset.asset_version)} />
                  </FieldGrid>
                </Section>

                <Section title="Classification">
                  <FieldGrid>
                    <FieldItem label="Asset Class" value={findLookupLabel(assetClasses, asset.asset_class)} />
                    <FieldItem label="Category" value={findLookupLabel(assetCategories, asset.asset_category)} />
                    <FieldItem label="Sub-category" value={findLookupLabel(assetSubCategories, asset.asset_sub_category)} />
                    <FieldItem label="Asset Type" value={findLookupLabel(assetTypes, asset.asset_type)} />
                    <FieldItem label="Criticality" value={findLookupLabel(criticalities, asset.criticality_class)} />
                    <FieldItem label="Asset Nature" value={findLookupLabel(assetNatures, asset.asset_nature)} />
                    <FieldItem label="Status" value={asset.asset_status ? <StatusBadge status={statusKind(asset.asset_status)} title={statusLabel} /> : "-"} />
                    <FieldItem label="Owner" value={formatValue(asset.asset_owner)} />
                    <FieldItem label="Supplier" value={supplierLabel} />
                    <FieldItem label="Org Unit" value={orgLabel} />
                  </FieldGrid>
                </Section>

                <Section title="Description">
                  <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    {formatValue(asset.asset_description)}
                  </div>
                </Section>
              </TabsContent>

              <TabsContent value="location" className="space-y-5">
                <Section title="Org And Placement">
                  <FieldGrid>
                    <FieldItem label="Org Unit" value={orgLabel} />
                    <FieldItem label="Location Record" value={location ? "Configured" : "Not configured"} />
                    <FieldItem label="Building Reference" value={formatValue(location?.building_reference)} />
                    <FieldItem label="Floor / Level" value={formatValue(location?.floor_reference)} />
                    <FieldItem label="Local Reference" value={formatValue(location?.local_reference)} />
                    <FieldItem label="Location Remarks" value={formatValue(location?.remarks)} />
                  </FieldGrid>
                </Section>
                {!location ? (
                  <EmptyState
                    title="No location record"
                    description="Location fields can be added or updated from the Asset Master edit wizard."
                    icon={<MapPin className="h-5 w-5" />}
                  />
                ) : null}
              </TabsContent>

              <TabsContent value="finance" className="space-y-5">
                <Section title="Asset Purchase Summary">
                  <FieldGrid>
                    <FieldItem label="Purchase Date" value={formatDate(asset.asset_purchase_dt)} />
                    <FieldItem label="Commission Date" value={formatDate(asset.asset_commission_dt)} />
                    <FieldItem label="Purchase Reference" value={formatValue(asset.asset_purchase_ref)} />
                    <FieldItem label="Warranty Period" value={asset.warranty_period ? `${asset.warranty_period} months` : "-"} />
                    <FieldItem label="Asset Value" value={formatMoney(asset.asset_value, currencyLabel === "-" ? asset.asset_currency : currencyLabel)} />
                    <FieldItem label="Release Reference URL" value={formatValue(asset.asset_release_url)} />
                  </FieldGrid>
                </Section>

                <Section title="Finance Record">
                  {finance ? (
                    <FieldGrid>
                      <FieldItem label="Acquisition Date" value={formatDate(finance.acquisition_dt)} />
                      <FieldItem label="Supplier" value={finance.supplier_name || supplierMap.get(finance.supplier_id) || "-"} />
                      <FieldItem label="Purchase Order" value={formatValue(finance.purchase_order_no)} />
                      <FieldItem label="Invoice Reference" value={formatValue(finance.invoice_ref)} />
                      <FieldItem label="Capitalization Date" value={formatDate(finance.capitalization_date)} />
                      <FieldItem label="Acquisition Cost" value={formatMoney(finance.acquisition_cost, finance.currency_code)} />
                      <FieldItem label="Book Value" value={formatMoney(finance.book_value, finance.currency_code)} />
                      <FieldItem label="Replacement Value" value={formatMoney(finance.replacement_value, finance.currency_code)} />
                      <FieldItem label="Insured Value" value={formatMoney(finance.insured_value, finance.currency_code)} />
                      <FieldItem label="Salvage Value" value={formatMoney(finance.salvage_value, finance.currency_code)} />
                      <FieldItem label="Depreciation Method" value={findLookupLabel(depreciationMethods, finance.depreciation_method)} />
                      <FieldItem label="Useful Life" value={finance.useful_life_years ? `${finance.useful_life_years} years` : "-"} />
                      <FieldItem label="Depreciation Rate" value={finance.depreciation_rate_pct === null || finance.depreciation_rate_pct === undefined ? "-" : `${finance.depreciation_rate_pct}%`} />
                      <FieldItem label="Accumulated Depreciation" value={formatMoney(finance.accumulated_depreciation, finance.currency_code)} />
                      <FieldItem label="Cost Center" value={formatValue(finance.cost_center)} />
                      <FieldItem label="GL Account Capex" value={formatValue(finance.gl_account_capex)} />
                      <FieldItem label="Asset Class GL" value={findLookupLabel(assetClassGlOptions, finance.asset_class_gl)} />
                      <FieldItem label="WBS Element" value={formatValue(finance.wbs_element)} />
                    </FieldGrid>
                  ) : (
                    <EmptyState
                      title="No finance record"
                      description="Finance fields can be added from the Asset Master edit wizard when needed."
                      icon={<CircleDollarSign className="h-5 w-5" />}
                    />
                  )}
                </Section>
              </TabsContent>

              <TabsContent value="references" className="space-y-4">
                {referenceAssetId ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {referenceCards.map((card) => (
                      <div key={card.title} className="flex min-h-44 flex-col rounded-md border border-slate-200 bg-white p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                            {card.icon}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-slate-900">{card.title}</h4>
                            <p className="mt-1 text-sm text-slate-500">{card.description}</p>
                          </div>
                        </div>
                        <div className="mt-auto pt-4">
                          <PermissionGuard permission={card.permission} anyOf={card.anyOf}>
                            <Button type="button" variant="secondary" size="sm" onClick={card.onClick}>
                              <ExternalLink className="h-4 w-4" />
                              {card.action}
                            </Button>
                          </PermissionGuard>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="No references available" description="This asset needs a saved asset identifier before related workflow links can be opened." />
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Drawer>
  );
}
