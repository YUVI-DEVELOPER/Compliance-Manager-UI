import React from "react";
import { AssetRecord } from "../../../services/asset.service";
import { LookupOption } from "../../services/lookupValue.service";

interface AssetLifecycleTimelineProps {
  asset: AssetRecord;
  assetStatuses: LookupOption[];
}

const LIFECYCLE_STAGES = [
  { key: "ACTIVE", label: "Active", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "RETIRED", label: "Retired", icon: "M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { key: "DECOMMISSIONED", label: "Decommissioned", icon: "M6 18L18 6M6 6l12 12" },
  { key: "DISPOSED", label: "Disposed", icon: "M9 7h6m-7 4h8m-9 4h10M5 5h14l-1 14H6L5 5z" },
  { key: "ARCHIVED", label: "Archived", icon: "M4 7h16v10H4V7zm3-3h10v3H7V4z" },
];

const getStageIndex = (status: string | null | undefined): number => {
  if (!status) return -1;
  const normalizedStatus = status.toUpperCase();
  const index = LIFECYCLE_STAGES.findIndex((stage) => stage.key === normalizedStatus);
  return index >= 0 ? index : -1;
};

const getStatusLabel = (statuses: LookupOption[], code?: string | null): string => {
  if (!code) return "Unknown";
  const found = statuses.find((item) => item.code === code);
  return found?.value || code;
};

export function AssetLifecycleTimeline({ asset, assetStatuses }: AssetLifecycleTimelineProps) {
  const currentStageIndex = getStageIndex(asset.asset_status);
  const currentStatusLabel = getStatusLabel(assetStatuses, asset.asset_status);

  return (
    <div className="p-4 bg-slate-50 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-800">Asset Lifecycle</h4>
        <span className="text-xs text-slate-500">
          Current Status: <span className="font-medium text-slate-700">{currentStatusLabel}</span>
        </span>
      </div>

      {/* Timeline */}
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 -z-10" />

        {LIFECYCLE_STAGES.map((stage, index) => {
          const isCompleted = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isPending = index > currentStageIndex;

          let stageClass = "";
          let iconBgClass = "";
          let iconColorClass = "";

          if (isCompleted) {
            stageClass = "text-green-600";
            iconBgClass = "bg-green-100";
            iconColorClass = "text-green-600";
          } else if (isCurrent) {
            stageClass = "text-blue-600";
            iconBgClass = "bg-blue-100";
            iconColorClass = "text-blue-600";
          } else {
            stageClass = "text-slate-400";
            iconBgClass = "bg-slate-100";
            iconColorClass = "text-slate-400";
          }

          return (
            <div key={stage.key} className="flex flex-col items-center relative">
              {/* Stage icon */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${iconBgClass} transition-all ${
                  isCurrent ? "ring-4 ring-blue-200" : ""
                }`}
              >
                <svg
                  className={`w-5 h-5 ${iconColorClass}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  {isCompleted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d={stage.icon} />
                  )}
                </svg>
              </div>

              {/* Stage label */}
              <span className={`text-xs mt-2 font-medium ${stageClass}`}>{stage.label}</span>
            </div>
          );
        })}
      </div>

      {/* Timeline details */}
      {(asset.asset_purchase_dt || asset.asset_commission_dt) && (
        <div className="mt-6 pt-4 border-t border-slate-200 grid grid-cols-2 gap-4">
          {asset.asset_purchase_dt && (
            <div>
              <p className="text-xs text-slate-500">Purchase Date</p>
              <p className="text-sm font-medium text-slate-700">{asset.asset_purchase_dt}</p>
            </div>
          )}
          {asset.asset_commission_dt && (
            <div>
              <p className="text-xs text-slate-500">Commission Date</p>
              <p className="text-sm font-medium text-slate-700">{asset.asset_commission_dt}</p>
            </div>
          )}
          {asset.warranty_period && (
            <div>
              <p className="text-xs text-slate-500">Warranty Period</p>
              <p className="text-sm font-medium text-slate-700">{asset.warranty_period} months</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
