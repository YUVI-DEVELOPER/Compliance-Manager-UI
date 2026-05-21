import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { getAssetAuthoredDocuments, getReleaseAuthoredDocuments } from "../../../services/authored-document.service";
import { ReleaseRecord } from "../../../services/release.service";
import { SupplierRecord } from "../../../services/supplier.service";
import {
  createSupplierEvaluation,
  SupplierEvaluationRecord,
  updateSupplierEvaluation,
} from "../../../services/supplier-evaluation.service";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Modal } from "../ui/Modal";
import {
  canEditEvaluation,
  DEFAULT_SUPPLIER_EVALUATION_ACTOR,
  EvaluationUrsOption,
  formatEvaluationUrsLabel,
  formatSupplierEvaluationStatus,
  mapSupplierEvaluationAxiosError,
} from "./supplierEvaluationForm.shared";

interface SupplierEvaluationEditorModalProps {
  open: boolean;
  assetId: string | null;
  assetName?: string | null;
  assetCode?: string | null;
  suppliers: SupplierRecord[];
  releases?: ReleaseRecord[];
  evaluation?: SupplierEvaluationRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const buildUrsOptions = async (
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

export function SupplierEvaluationEditorModal({
  open,
  assetId,
  assetName,
  assetCode,
  suppliers,
  releases = [],
  evaluation,
  onClose,
  onSaved,
}: SupplierEvaluationEditorModalProps) {
  const [evaluationName, setEvaluationName] = useState("");
  const [selectedUrsId, setSelectedUrsId] = useState("");
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
  const [ursOptions, setUrsOptions] = useState<EvaluationUrsOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isEditing = Boolean(evaluation);
  const canEditCurrentEvaluation = canEditEvaluation(evaluation?.status);
  const canEditUrsSelection = !evaluation || evaluation.status === "DRAFT";

  useEffect(() => {
    if (!open || !assetId) {
      setLoadingOptions(false);
      return;
    }

    let cancelled = false;
    setLoadingOptions(true);

    void buildUrsOptions(assetId, releases)
      .then((options) => {
        if (cancelled) return;
        setUrsOptions(options);
      })
      .catch((error) => {
        if (cancelled) return;
        toast.error(mapSupplierEvaluationAxiosError(error));
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assetId, open, releases]);

  useEffect(() => {
    if (!open) {
      setEvaluationName("");
      setSelectedUrsId("");
      setSelectedSupplierIds([]);
      setFormError(null);
      setSubmitting(false);
      return;
    }

    setEvaluationName(evaluation?.evaluation_name ?? "");
    setSelectedUrsId(evaluation?.urs_document_id ?? "");
    setSelectedSupplierIds([]);
    setFormError(null);
  }, [evaluation, open]);

  useEffect(() => {
    if (!open || selectedUrsId || ursOptions.length === 0) {
      return;
    }

    const matchedOption = evaluation
      ? ursOptions.find((option) => option.authored_document_id === evaluation.urs_document_id)
      : ursOptions[0];
    if (matchedOption) {
      setSelectedUrsId(matchedOption.authored_document_id);
    }
  }, [evaluation, open, selectedUrsId, ursOptions]);

  const selectedSupplierMap = useMemo(() => new Set(selectedSupplierIds), [selectedSupplierIds]);

  const toggleSupplierSelection = (supplierId: string) => {
    setSelectedSupplierIds((previous) =>
      previous.includes(supplierId)
        ? previous.filter((item) => item !== supplierId)
        : [...previous, supplierId],
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!assetId || submitting) return;

    const normalizedName = evaluationName.trim();
    if (!normalizedName) {
      setFormError("Evaluation name is required");
      return;
    }
    if (!selectedUrsId) {
      setFormError("Select an approved URS document");
      return;
    }
    if (isEditing && !canEditCurrentEvaluation) {
      setFormError("This evaluation is read-only and cannot be edited");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      if (evaluation) {
        await updateSupplierEvaluation(evaluation.evaluation_id, {
          modified_by: DEFAULT_SUPPLIER_EVALUATION_ACTOR,
          evaluation_name: normalizedName,
          ...(canEditUrsSelection ? { urs_document_id: selectedUrsId } : {}),
        });
        toast.success("Supplier evaluation updated successfully");
      } else {
        await createSupplierEvaluation({
          evaluation_name: normalizedName,
          asset_uuid: assetId,
          urs_document_id: selectedUrsId,
          supplier_ids: selectedSupplierIds,
          created_by: DEFAULT_SUPPLIER_EVALUATION_ACTOR,
        });
        toast.success("Supplier evaluation created successfully");
      }

      await onSaved();
      onClose();
    } catch (error) {
      const message = mapSupplierEvaluationAxiosError(error);
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const approvedUrsMessage = loadingOptions
    ? "Loading approved URS documents..."
    : ursOptions.length === 0
      ? "No approved URS documents are available for this asset yet. Approve a URS in the authored-document panel first."
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={evaluation ? "Edit Supplier Evaluation" : "Create Supplier Evaluation"}
      description="Set the evaluation name, choose the approved URS baseline, and optionally attach suppliers for the first response cycle."
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="supplier-evaluation-editor-form"
            disabled={submitting || !assetId || (isEditing ? !canEditCurrentEvaluation : false)}
          >
            {submitting ? (evaluation ? "Saving..." : "Creating...") : evaluation ? "Save Evaluation" : "Create Evaluation"}
          </Button>
        </>
      }
    >
      <form
        id="supplier-evaluation-editor-form"
        className="space-y-5"
        onSubmit={(event) => void handleSubmit(event)}
      >
        {formError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Asset Name</p>
              <p className="text-sm font-medium text-slate-900">{assetName || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Asset ID</p>
              <p className="text-sm font-medium text-slate-900">{assetCode || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Mode</p>
              <p className="text-sm font-medium text-slate-900">
                {evaluation ? `Editing ${formatSupplierEvaluationStatus(evaluation.status)}` : "Create draft evaluation"}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <Input
            label="Evaluation Name"
            value={evaluationName}
            onChange={(event) => setEvaluationName(event.target.value)}
            placeholder="Example: FY26 SCADA URS supplier round"
            disabled={isEditing && !canEditCurrentEvaluation}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700">Approved URS Baseline</label>
          <select
            className="h-10 w-full rounded-md border border-slate-200 px-3 text-sm bg-input-background"
            value={selectedUrsId}
            onChange={(event) => setSelectedUrsId(event.target.value)}
            disabled={loadingOptions || !canEditUrsSelection || (isEditing && !canEditCurrentEvaluation)}
          >
            <option value="">
              {loadingOptions ? "Loading approved URS documents..." : "Select approved URS"}
            </option>
            {ursOptions.map((option) => (
              <option key={option.authored_document_id} value={option.authored_document_id}>
                {formatEvaluationUrsLabel(option)}
              </option>
            ))}
          </select>
          {approvedUrsMessage ? (
            <p className="text-xs text-slate-500">{approvedUrsMessage}</p>
          ) : !canEditUrsSelection && evaluation ? (
            null
          ) : (
            null
          )}
        </div>

        {isEditing ? (
          null
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Initial Participating Suppliers</p>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white">
              {suppliers.length === 0 ? (
                <div className="px-4 py-6 text-sm text-slate-500">No suppliers are available in supplier master yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {suppliers.map((supplier) => (
                    <label
                      key={supplier.supplier_id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                        checked={selectedSupplierMap.has(supplier.supplier_id)}
                        onChange={() => toggleSupplierSelection(supplier.supplier_id)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{supplier.supplier_name}</p>
                        <p className="text-xs text-slate-500">
                          {supplier.supplier_type || "Supplier"}{supplier.contact_email ? ` · ${supplier.contact_email}` : ""}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
