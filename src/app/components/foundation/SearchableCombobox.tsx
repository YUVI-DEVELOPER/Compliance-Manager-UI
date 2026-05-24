import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";

import { cn } from "../ui/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SearchableComboboxProps {
  options: ComboboxOption[];
  value?: string | null;
  onChange: (value: string | null, option?: ComboboxOption) => void;
  label?: React.ReactNode;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  id?: string;
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  label,
  placeholder = "Search...",
  emptyText = "No results found",
  disabled = false,
  clearable = true,
  className,
  id,
}: SearchableComboboxProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleOptions = normalizedQuery
    ? options.filter((option) =>
        [option.label, option.value, option.description]
          .filter((part): part is string => Boolean(part))
          .some((part) => part.toLowerCase().includes(normalizedQuery)),
      )
    : options;

  React.useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const selectOption = (option: ComboboxOption) => {
    if (option.disabled) return;
    onChange(option.value, option);
    setOpen(false);
    setQuery("");
  };

  const clearSelection = () => {
    onChange(null);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative flex min-w-52 flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          disabled={disabled}
          value={open ? query : selectedOption?.label ?? ""}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className={cn(
            "h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-1 pr-16 text-sm text-slate-900 outline-none transition-[color,box-shadow]",
            "placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          )}
        />
        <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {clearable && selectedOption && !disabled ? (
            <button
              type="button"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={clearSelection}
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled}
            onClick={() => setOpen((current) => !current)}
            aria-label="Toggle options"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>
      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  className={cn(
                    "flex w-full items-start gap-2 rounded px-2 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
                    selected && "bg-blue-50 text-blue-700",
                  )}
                  onClick={() => selectOption(option)}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                    {selected ? <Check className="h-4 w-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description ? <span className="mt-0.5 block truncate text-xs text-slate-500">{option.description}</span> : null}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500">{emptyText}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
