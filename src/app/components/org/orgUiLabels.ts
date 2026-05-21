import { LookupOption } from "../../services/lookupValue.service";

export const humanizeCode = (value?: string | null): string => {
  if (!value) return "-";

  return value
    .toString()
    .trim()
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
};

export const buildLookupLabelMap = (options: LookupOption[]): Record<string, string> =>
  options.reduce<Record<string, string>>((labels, option) => {
    labels[option.code.toUpperCase()] = option.value;
    return labels;
  }, {});

export const getLookupLabel = (
  code: string | null | undefined,
  labels: Record<string, string>,
  fallback?: string,
): string => {
  if (!code) return fallback ?? "-";

  const normalizedCode = code.toUpperCase();
  return labels[normalizedCode] ?? fallback ?? humanizeCode(normalizedCode);
};
