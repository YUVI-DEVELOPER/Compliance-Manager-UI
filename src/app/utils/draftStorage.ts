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
  current: Record<string, unknown>,
  baseline: Record<string, unknown>,
): boolean {
  const keys = Object.keys(current);
  for (const key of keys) {
    const currentRaw = current[key];
    const baselineRaw = baseline[key];
    const currentValue = typeof currentRaw === "string" ? currentRaw.trim() : JSON.stringify(currentRaw ?? null);
    const baselineValue = typeof baselineRaw === "string" ? baselineRaw.trim() : JSON.stringify(baselineRaw ?? null);
    if (currentValue !== baselineValue) return true;
  }
  return false;
}

