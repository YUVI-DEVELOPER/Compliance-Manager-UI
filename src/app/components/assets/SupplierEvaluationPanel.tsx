import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ReleaseRecord } from "../../../services/release.service";
import { SupplierRecord } from "../../../services/supplier.service";
import {
  getSupplierEvaluations,
  SupplierEvaluationRecord,
} from "../../../services/supplier-evaluation.service";
import { LookupOption } from "../../services/lookupValue.service";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import {
  canEditEvaluation,
  formatEvaluationDate,
  formatSupplierEvaluationStatus,
  getSupplierEvaluationStatusBadgeClass,
  mapSupplierEvaluationAxiosError,
} from "./supplierEvaluationForm.shared";
import { SupplierEvaluationEditorModal } from "./SupplierEvaluationEditorModal";
import { SupplierEvaluationWorkspaceModal } from "./SupplierEvaluationWorkspaceModal";

interface SupplierEvaluationPanelProps {
  enabled: boolean;
  assetId: string | null;
  assetName?: string | null;
  assetCode?: string | null;
  suppliers: SupplierRecord[];
  releases?: ReleaseRecord[];
  sourceSystemOptions?: LookupOption[];
}

export function SupplierEvaluationPanel({
  enabled,
  assetId,
  assetName,
  assetCode,
  suppliers,
  releases = [],
  sourceSystemOptions = [],
}: SupplierEvaluationPanelProps) {
  const [evaluations, setEvaluations] = useState<SupplierEvaluationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEvaluation, setEditingEvaluation] = useState<SupplierEvaluationRecord | null>(null);
  const [workspaceEvaluationId, setWorkspaceEvaluationId] = useState<string | null>(null);

  const loadEvaluations = useCallback(async () => {
    if (!assetId) return;

    setLoading(true);
    try {
      const data = await getSupplierEvaluations({ asset_uuid: assetId });
      setEvaluations(data);
    } catch (error) {
      toast.error(mapSupplierEvaluationAxiosError(error));
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    if (!enabled || !assetId) {
      setEvaluations([]);
      setLoading(false);
      return;
    }

    void loadEvaluations();
  }, [assetId, enabled, loadEvaluations]);

  useEffect(() => {
    if (enabled) return;

    setEditorOpen(false);
    setEditingEvaluation(null);
    setWorkspaceEvaluationId(null);
  }, [enabled]);

  const draftCount = useMemo(
    () => evaluations.filter((evaluation) => evaluation.status === "DRAFT").length,
    [evaluations],
  );
  const activeCount = useMemo(
    () => evaluations.filter((evaluation) => evaluation.status === "OPEN_FOR_RESPONSE").length,
    [evaluations],
  );
  const lockedCount = useMemo(
    () => evaluations.filter((evaluation) => evaluation.status === "LOCKED" || evaluation.status === "CLOSED").length,
    [evaluations],
  );

  return (
    <>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Supplier Response and Selection</p>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
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
                <p className="text-sm font-medium text-slate-900">Asset-scoped evaluation workspace</p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditingEvaluation(null);
              setEditorOpen(true);
            }}
            disabled={!enabled || !assetId}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Evaluation
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Evaluations</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{evaluations.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Draft</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{draftCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Open</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{activeCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-500">Locked / Closed</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{lockedCount}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[24%] min-w-44 font-semibold">Evaluation</TableHead>
                <TableHead className="min-w-32 font-semibold">Status</TableHead>
                <TableHead className="w-[30%] min-w-64 font-semibold">URS</TableHead>
                <TableHead className="min-w-20 font-semibold">Suppliers</TableHead>
                <TableHead className="min-w-36 font-semibold">Updated</TableHead>
                <TableHead className="min-w-36 font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    Loading supplier evaluations...
                  </TableCell>
                </TableRow>
              ) : evaluations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    No supplier evaluations exist for this asset yet. Create the first evaluation to start collecting supplier responses.
                  </TableCell>
                </TableRow>
              ) : (
                evaluations.map((evaluation) => (
                  <TableRow key={evaluation.evaluation_id} className="hover:bg-slate-50">
                    <TableCell className="align-top whitespace-normal">
                      <div className="font-medium text-slate-900">{evaluation.evaluation_name}</div>
                      <p className="mt-1 text-xs text-slate-500">
                        Submitted-ready: {evaluation.submitted_response_count} / {evaluation.response_count}
                      </p>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant="outline"
                        className={getSupplierEvaluationStatusBadgeClass(evaluation.status)}
                      >
                        {formatSupplierEvaluationStatus(evaluation.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-64 align-top whitespace-normal">
                      <div className="max-w-[20rem] break-words font-medium leading-5 text-slate-900">{evaluation.urs_title || "-"}</div>
                      <p className="mt-1 text-xs text-slate-500">
                        {evaluation.urs_release_version
                          ? `Release ${evaluation.urs_release_version}`
                          : "Asset-level URS"}
                      </p>
                    </TableCell>
                    <TableCell className="align-top text-slate-700">{evaluation.response_count}</TableCell>
                    <TableCell className="align-top text-slate-600">
                      {formatEvaluationDate(evaluation.modified_dt || evaluation.created_dt)}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setWorkspaceEvaluationId(evaluation.evaluation_id)}
                        >
                          Workspace
                        </Button>
                        {canEditEvaluation(evaluation.status) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingEvaluation(evaluation);
                              setEditorOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <SupplierEvaluationEditorModal
        open={editorOpen}
        assetId={assetId}
        assetName={assetName}
        assetCode={assetCode}
        suppliers={suppliers}
        releases={releases}
        evaluation={editingEvaluation}
        onClose={() => {
          setEditorOpen(false);
          setEditingEvaluation(null);
        }}
        onSaved={loadEvaluations}
      />

      <SupplierEvaluationWorkspaceModal
        open={Boolean(workspaceEvaluationId)}
        evaluationId={workspaceEvaluationId}
        suppliers={suppliers}
        sourceSystemOptions={sourceSystemOptions}
        onClose={() => setWorkspaceEvaluationId(null)}
        onChanged={loadEvaluations}
      />
    </>
  );
}




