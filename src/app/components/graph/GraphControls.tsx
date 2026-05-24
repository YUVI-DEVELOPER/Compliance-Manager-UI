import React, { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "../ui/button";
import { SearchInput } from "../ui/input";

interface GraphControlsProps {
  filters: Record<string, boolean>;
  onFilterChange: (type: string, checked: boolean) => void;
  nodeCounts: Record<string, number>;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

const NODE_TYPE_ORDER = ["ORG", "ASSET", "SUPPLIER"];

const nodeTypeLabels: Record<string, string> = {
  ORG: "Org",
  ASSET: "Asset",
  SUPPLIER: "Supplier",
  ASSETS_COLLAPSED: "Asset Groups",
  SUPPLIERS_COLLAPSED: "Supplier Groups",
};

const nodeTypeColors: Record<string, string> = {
  ORG: "bg-blue-500",
  ASSET: "bg-emerald-500",
  SUPPLIER: "bg-violet-500",
  ASSETS_COLLAPSED: "bg-teal-500",
  SUPPLIERS_COLLAPSED: "bg-fuchsia-500",
};

export const GraphControls: React.FC<GraphControlsProps> = ({
  filters,
  onFilterChange,
  nodeCounts,
  searchQuery,
  onSearchChange,
  onClear,
  disabled = false,
}) => {
  const nodeTypes = useMemo(() => {
    const allTypes = new Set([...NODE_TYPE_ORDER, ...Object.keys(nodeCounts), ...Object.keys(filters)]);
    return [...allTypes].sort((left, right) => {
      const leftIndex = NODE_TYPE_ORDER.indexOf(left);
      const rightIndex = NODE_TYPE_ORDER.indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1) {
        return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }
      return left.localeCompare(right);
    });
  }, [filters, nodeCounts]);

  return (
    <div className="nodrag nowheel pointer-events-auto w-[min(22rem,calc(100vw-3rem))] rounded-lg border border-white/80 bg-white/95 p-3 shadow-xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} disabled={disabled} className="h-7 px-2 text-xs">
          Clear
        </Button>
      </div>

      <SearchInput
        value={searchQuery}
        placeholder="Search name, code, or ID"
        onChange={(event) => onSearchChange(event.target.value)}
        onClear={() => onSearchChange("")}
        disabled={disabled}
        className="h-9 bg-white text-sm"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {nodeTypes.map((type) => (
          <FilterToggle
            key={type}
            label={nodeTypeLabels[type] ?? type.replace(/_/g, " ")}
            type={type}
            color={nodeTypeColors[type] ?? "bg-slate-500"}
            checked={filters[type] !== false}
            count={nodeCounts[type] ?? 0}
            disabled={disabled}
            onChange={onFilterChange}
          />
        ))}
      </div>
    </div>
  );
};

interface FilterToggleProps {
  label: string;
  type: string;
  color: string;
  checked: boolean;
  count: number;
  disabled?: boolean;
  onChange: (type: string, checked: boolean) => void;
}

const FilterToggle: React.FC<FilterToggleProps> = ({ label, type, color, checked, count, disabled, onChange }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(type, !checked)}
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        checked
          ? "border-slate-300 bg-slate-900 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      }`}
      aria-pressed={checked}
    >
      <span className={`h-2 w-2 rounded-full ${checked ? color : "bg-slate-300"}`} />
      <span>{label}</span>
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${checked ? "bg-white/10 text-white" : "bg-slate-100 text-slate-500"}`}>
        {count}
      </span>
    </button>
  );
};
