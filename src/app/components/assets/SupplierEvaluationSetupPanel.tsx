import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AssetRecord } from "../../../services/asset.service";
import { getAssetAuthoredDocuments, getReleaseAuthoredDocuments } from "../../../services/authored-document.service";
import { getReleasesByAssetId, ReleaseRecord } from "../../../services/release.service";
import { SupplierRecord } from "../../../services/supplier.service";
import {
  createSupplierEvaluation,
  SupplierEvaluationRecord,
  updateSupplierEvaluation,
} from "../../../services/supplier-evaluation.service";
import { useCurrentActor } from "../../auth/useCurrentActor";
import { RightPanel, SearchableCombobox } from "../foundation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  canEditEvaluation,
  EvaluationUrsOption,
  formatEvaluationUrsLabel,
  formatSupplierEvaluationStatus,
  mapSupplierEvaluationAxiosError,
} from "./supplierEvaluationForm.shared";

interface SupplierEvaluationSetupPanelProps {
  open: boolean;
  mode: "create" | "edit";
  evaluation?: SupplierEvaluationRecord | null;
  initialAssetId?: string | null;
  assets: AssetRecord[];
  suppliers: SupplierRecord[];
  onClose: () => void;
  onSaved: (evaluation: SupplierEvaluationRecord) => Promise<void> | void;
}

interface SetupFormState {
  asset_uuid: string;
  evaluation_name: string;
  urs_document_id: string;
  supplier_ids: string[];
}

const EMPTY_FORM: SetupFormState = {
  asset_uuid: "",
  evaluation_name: "",
  urs_document_id: "",
  supplier_ids: [],
};

export const buildSupplierEvaluationUrsOptions = async (
  assetId: string,
  releases: ReleaseRecord[],
): Promise<EvaluationUrsOption[]> => {
  const [assetDocuments, ...releaseDocuments] = await Promise.all([
    getAssetAuthoredDocuments(assetId),
    ...releases.map((release) => getReleaseAuthoredDocuments(release.release_id)),
  ]);

  const mappedOptions = [
    ...assetDocuments.map((document) => ({
      authored_document_id: document.authored_document_id,
      title: document.title,
      status: document.status,
      scope: "ASSET" as const,
      asset_name: document.asset_name,
      asset_code: document.asset_code,
      release_version: null,
    })),
    ...releaseDocuments.flatMap((documents) =>
      documents.map((document) => ({
        authored_document_id: document.authored_document_id,
        title: document.title,
        status: document.status,
        scope: "RELEASE" as const,
        asset_name: document.asset_name,
        asset_code: document.asset_code,
        release_version: document.release_version,
      })),
    ),
  ]
    .filter((document) => document.status === "APPROVED")
    .reduce<EvaluationUrsOption[]>((items, document) => {
      if (items.some((item) => item.authored_document_id === document.authored_document_id)) {
        return items;
      }
      return [...items, document];
    }, []);

  return mappedOptions.sort((left, right) => {
    const titleCompare = left.title.localeCompare(right.title);
    if (titleCompare !== 0) return titleCompare;
    return (left.release_version ?? "").localeCompare(right.release_version ?? "");
  });
};

const formatAssetLabel = (asset?: AssetRecord | null): string => {
  if (!asset) return "";
  return `${asset.asset_id} | ${asset.asset_name || "Unnamed asset"}`;
};

export function SupplierEvaluationSetupPanel({
  open,
  mode,
  evaluation,
  initialAssetId,
  assets,
  suppliers,
  onClose,
  onSaved,
}: SupplierEvaluationSetupPanelProps) {
  const currentActor = useCurrentActor();
  const actor = currentActor.auditName ?? currentActor.displayName;
  const isEditing = mode === "edit" && Boolean(evaluation);
  const canEditCurrentEvaluation = isEditing ? canEditEvaluation(evaluation?.status) : true;
  const canEditUrsSelection = !isEditing || evaluation?.status === "DRAFT";

  const [form, setForm] = useState<SetupFormState>(EMPTY_FORM);
  const [releases, setReleases] = useState<ReleaseRecord[]>([]);
  const [ursOptions, setUrsOptions] = useState<EvaluationUrsOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.asset_uuid === form.asset_uuid) ?? null,
    [assets, form.asset_uuid],
  );
  const selectedSupplierSet = useMemo(() => new Set(form.supplier_ids), [form.supplier_ids]);

  const assetOptions = useMemo(
    () =>
      assets.map((asset) => ({
        value: asset.asset_uuid,
        label: formatAssetLabel(asset),
        description: [asset.asset_class, asset.asset_category, asset.supplier_name].filter(Boolean).join(" | "),
      })),
    [assets],
  );

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setReleases([]);
      setUrsOptions([]);
      setLoadingOptions(false);
      setSaving(false);
      setFormError(null);
      return;
    }

    setForm({
      asset_uuid: evaluation?.asset_uuid ?? initialAssetId ?? "",
      evaluation_name: evaluation?.evaluation_name ?? "",
      urs_document_id: evaluation?.urs_document_id ?? "",
      supplier_ids: [],
    });
    setFormError(null);
  }, [evaluation, initialAssetId, open]);

  useEffect(() => {
    if (!open || !form.asset_uuid) {
      setReleases([]);
      setUrsOptions([]);
      setLoadingOptions(false);
      return;
    }

    let cancelled = false;
    setLoadingOptions(true);

    void getReleasesByAssetId(form.asset_uuid)
      .then(async (releaseRows) => {
        const options = await buildSupplierEvaluationUrsOptions(form.asset_uuid, releaseRows);
        if (cancelled) return;
        setReleases(releaseRows);
        setUrsOptions(options);
        setForm((previous) => {
          if (previous.urs_document_id && options.some((option) => option.authored_document_id === previous.urs_document_id)) {
            return previous;
          }
          return {
            ...previous,
            urs_document_id: options[0]?.authored_document_id ?? "",
          };
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setReleases([]);
        setUrsOptions([]);
        toast.error(mapSupplierEvaluationAxiosError(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [form.asset_uuid, open]);

  const toggleSupplierSelection = (supplierId: string) => {
    setForm((previous) => ({
      ...previous,
      supplier_ids: previous.supplier_ids.includes(supplierId)
        ? previous.supplier_ids.filter((item) => item !== supplierId)
        : [...previous.supplier_ids, supplierId],
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const normalizedName = form.evaluation_name.trim();
    if (!form.asset_uuid) {
      setFormError("Select an asset for this evaluation");
      return;
    }
    if (!normalizedName) {
      setFormError("Evaluation title is required");
      return;
    }
    if (!form.urs_document_id) {
      setFormError("Select an approved URS or authored document baseline");
      return;
    }
    if (isEditing && !canEditCurrentEvaluation) {
      setFormError("This evaluation is read-only and cannot be edited");
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const saved = isEditing && evaluation
        ? await updateSupplierEvaluation(evaluation.evaluation_id, {
            modified_by: actor,
            evaluation_name: normalizedName,
            ...(canEditUrsSelection ? { urs_document_id: form.urs_document_id } : {}),
          })
        : await createSupplierEvaluation({
            evaluation_name: normalizedName,
            asset_uuid: form.asset_uuid,
            urs_document_id: form.urs_document_id,
            supplier_ids: form.supplier_ids,
            created_by: actor,
          });

      toast.success(isEditing ? "Supplier evaluation setup updated" : "Supplier evaluation created as Draft");
      await onSaved(saved);
      onClose();
    } catch (error) {
      const message = mapSupplierEvaluationAxiosError(error);
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const approvedUrsMessage = loadingOptions
    ? "Loading approved URS documents..."
    : ursOptions.length === 0 && form.asset_uuid
      ? "No approved URS documents are available for this asset yet."
      : null;

  return (
    <RightPanel
      open={open}
      onClose={onClose}
      title={isEditing ? "Edit Evaluation Setup" : "New Evaluation"}
      description="Set the supplier evaluation title, asset context, URS baseline, and initial suppliers."
      widthClassName="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-evaluation-setup-form" disabled={saving || !canEditCurrentEvaluation}>
            {saving ? "Saving..." : isEditing ? "Save Setup" : "Create Evaluation"}
          </Button>
        </div>
      }
    >
      <form id="supplier-evaluation-setup-form" className="space-y-5" onSubmit={(event) => void handleSubmit(event)}>
        {formError ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Setup</h3>
            <p className="mt-1 text-xs text-slate-500">
              Supplier evaluations remain linked to one asset and one approved URS baseline.
            </p>
          </div>

          <SearchableCombobox
            label="Asset"
            options={assetOptions}
            value={form.asset_uuid}
            onChange={(value) =>
              setForm((previous) => ({
                ...previous,
                asset_uuid: value ?? "",
                urs_document_id: "",
              }))
            }
            placeholder="Search asset by ID or name"
            emptyText="No assets found"
            clearable={!isEditing}
            disabled={isEditing || saving}
          />

          <Input
            label="Evaluation Title"
            value={form.evaluation_name}
            onChange={(event) => setForm((previous) => ({ ...previous, evaluation_name: event.target.value }))}
            placeholder="Example: FY26 SCADA supplier requirement evaluation"
            disabled={saving || !canEditCurrentEvaluation}
            required
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">URS / Authored Document Baseline</label>
            <select
              className="h-10 w-full rounded-md border border-slate-200 bg-input-background px-3 text-sm"
              value={form.urs_document_id}
              onChange={(event) =>
                setForm((previous) => ({
                  ...previous,
                  urs_document_id: event.target.value,
                }))
              }
              disabled={saving || loadingOptions || !canEditUrsSelection || !canEditCurrentEvaluation}
            >
              <option value="">{loadingOptions ? "Loading approved baselines..." : "Select approved baseline"}</option>
              {ursOptions.map((option) => (
                <option key={option.authored_document_id} value={option.authored_document_id}>
                  {formatEvaluationUrsLabel(option)}
                </option>
              ))}
            </select>
            {approvedUrsMessage ? <p className="text-xs text-slate-500">{approvedUrsMessage}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Asset</p>
              <p className="mt-1 break-words text-sm font-medium text-slate-900">
                {selectedAsset ? formatAssetLabel(selectedAsset) : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Release Sources</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{releases.length}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Mode</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {isEditing ? formatSupplierEvaluationStatus(evaluation?.status) : "Draft"}
              </p>
            </div>
          </div>
        </section>

        {!isEditing ? (
          <section className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Initial Suppliers</h3>
              <p className="mt-1 text-xs text-slate-500">
                Each selected supplier receives one response row when the evaluation is created.
              </p>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200">
              {suppliers.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">No suppliers are available.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {suppliers.map((supplier) => (
                    <label
                      key={supplier.supplier_id}
                      className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                        checked={selectedSupplierSet.has(supplier.supplier_id)}
                        onChange={() => toggleSupplierSelection(supplier.supplier_id)}
                        disabled={saving}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">{supplier.supplier_name}</span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {[supplier.supplier_type || "Supplier", supplier.contact_email].filter(Boolean).join(" | ")}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </form>
    </RightPanel>
  );
}
