import * as React from "react";
import { X } from "lucide-react";

import { Button } from "../ui/button";
import { cn } from "../ui/utils";

export interface ActiveFilter {
  key: string;
  label: React.ReactNode;
  onRemove?: () => void;
}

interface FilterBarProps {
  children: React.ReactNode;
  activeFilters?: ActiveFilter[];
  onClearAll?: () => void;
  className?: string;
}

export function FilterBar({ children, activeFilters = [], onClearAll, className }: FilterBarProps) {
  return (
    <div className={cn("rounded-md border border-slate-200 bg-white p-3", className)}>
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {activeFilters.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {activeFilters.map((filter) => (
            <span
              key={filter.key}
              className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700"
            >
              <span className="truncate">{filter.label}</span>
              {filter.onRemove ? (
                <button
                  type="button"
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  onClick={filter.onRemove}
                  aria-label="Remove filter"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
          {onClearAll ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClearAll}>
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

