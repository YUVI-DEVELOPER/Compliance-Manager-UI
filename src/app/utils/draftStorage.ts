export function loadDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return null;
  }
}

export function saveDraft<T>(key: string, value: T): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function clearDraft(key: string): void {
  window.localStorage.removeItem(key);
}

export function isShallowDirtyTrimmed(
  current: Record<string, string>,
  baseline: Record<string, string>,
): boolean {
  const keys = Object.keys(current);
  for (const key of keys) {
    const currentValue = (current[key] ?? "").trim();
    const baselineValue = (baseline[key] ?? "").trim();
    if (currentValue !== baselineValue) return true;
  }
  return false;
}

