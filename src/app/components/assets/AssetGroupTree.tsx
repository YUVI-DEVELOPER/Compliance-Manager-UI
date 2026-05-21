import React, { useState } from "react";
import { ChevronRight, Layers3, Network } from "lucide-react";

import type { AssetGroupRecord } from "../../../services/assetGrouping.service";

interface AssetGroupTreeProps {
  groups: AssetGroupRecord[];
  selectedGroupId: string | null;
  loading?: boolean;
  onSelectGroup: (groupId: string) => void;
}

const typeBadgeClass: Record<AssetGroupRecord["group_type"], string> = {
  SYSTEM: "border-blue-200 bg-blue-50 text-blue-700",
  SUB_SYSTEM: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function GroupNode({
  group,
  depth,
  selectedGroupId,
  onSelectGroup,
}: {
  group: AssetGroupRecord;
  depth: number;
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
}) {
  const hasChildren = (group.children?.length ?? 0) > 0;
  const [expanded, setExpanded] = useState(depth < 1);
  const isSelected = selectedGroupId === group.id;

  return (
    <div className="space-y-2">
      <div
        className={[
          "rounded-xl border px-3 py-3 transition-colors",
          isSelected
            ? "border-blue-200 bg-blue-50 shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
          !group.is_active ? "opacity-70" : "",
        ].join(" ")}
        style={{ marginLeft: depth * 16 }}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            className={[
              "mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500",
              hasChildren ? "hover:border-slate-300 hover:text-slate-700" : "cursor-default opacity-60",
            ].join(" ")}
            onClick={(event) => {
              event.stopPropagation();
              if (hasChildren) {
                setExpanded((current) => !current);
              }
            }}
          >
            {hasChildren ? (
              <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
            ) : group.group_type === "SYSTEM" ? (
              <Layers3 className="h-3.5 w-3.5" />
            ) : (
              <Network className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onSelectGroup(group.id)}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{group.group_name}</span>
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeBadgeClass[group.group_type]}`}>
                    {group.group_type === "SYSTEM" ? "System" : "Sub-system"}
                  </span>
                  {!group.is_active && (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {group.group_code ? `${group.group_code} • ` : ""}
                  {group.direct_asset_count} direct asset{group.direct_asset_count === 1 ? "" : "s"}
                  {" • "}
                  {group.child_group_count} child group{group.child_group_count === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="space-y-2">
          {group.children?.map((child) => (
            <GroupNode
              key={child.id}
              group={child}
              depth={depth + 1}
              selectedGroupId={selectedGroupId}
              onSelectGroup={onSelectGroup}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function AssetGroupTree({
  groups,
  selectedGroupId,
  loading = false,
  onSelectGroup,
}: AssetGroupTreeProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        Loading asset grouping hierarchy...
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
        No systems or sub-systems are configured yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <GroupNode
          key={group.id}
          group={group}
          depth={0}
          selectedGroupId={selectedGroupId}
          onSelectGroup={onSelectGroup}
        />
      ))}
    </div>
  );
}
