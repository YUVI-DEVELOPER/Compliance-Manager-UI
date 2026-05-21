import React from 'react';

interface GraphControlsProps {
  filters: {
    ORG: boolean;
    ASSET: boolean;
    SUPPLIER: boolean;
  };
  onFilterChange: (type: 'ORG' | 'ASSET' | 'SUPPLIER', checked: boolean) => void;
  nodeCounts: {
    ORG: number;
    ASSET: number;
    SUPPLIER: number;
  };
}

export const GraphControls: React.FC<GraphControlsProps> = ({ filters, onFilterChange, nodeCounts }) => {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Show</span>

      <FilterToggle
        label="Organizations"
        type="ORG"
        color="bg-blue-500"
        checked={filters.ORG}
        count={nodeCounts.ORG}
        onChange={onFilterChange}
      />
      <FilterToggle
        label="Assets"
        type="ASSET"
        color="bg-green-500"
        checked={filters.ASSET}
        count={nodeCounts.ASSET}
        onChange={onFilterChange}
      />
      <FilterToggle
        label="Suppliers"
        type="SUPPLIER"
        color="bg-purple-500"
        checked={filters.SUPPLIER}
        count={nodeCounts.SUPPLIER}
        onChange={onFilterChange}
      />
    </div>
  );
};

interface FilterToggleProps {
  label: string;
  type: 'ORG' | 'ASSET' | 'SUPPLIER';
  color: string;
  checked: boolean;
  count: number;
  onChange: (type: 'ORG' | 'ASSET' | 'SUPPLIER', checked: boolean) => void;
}

const FilterToggle: React.FC<FilterToggleProps> = ({ label, type, color, checked, count, onChange }) => {
  return (
    <button
      type="button"
      onClick={() => onChange(type, !checked)}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        checked
          ? 'border-slate-300 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full ${checked ? color : 'bg-slate-300'}`} />
      <span>{label}</span>
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${checked ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500'}`}>
        {count}
      </span>
    </button>
  );
};
