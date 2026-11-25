export function readStorage(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readStoredJson<T>(key: string, fallback: T, guard?: (v: unknown) => v is T): T {
  try {
    const raw = readStorage(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (guard && !guard(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key: string, value: unknown): boolean {
  try {
    return writeStorage(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export function readStoredArray<T>(key: string, guard?: (v: unknown) => v is T): T[] {
  const arr = readStoredJson<unknown>(key, []);
  if (!Array.isArray(arr)) return [];
  return guard ? arr.filter(guard) : (arr as T[]);
}
