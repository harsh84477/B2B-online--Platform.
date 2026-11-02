const STORAGE_KEY = "billingaz.shortcuts.v1";

export function loadShortcuts(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.shortcuts ?? null;
  } catch (err) {
    console.error("Failed to load shortcuts", err);
    return null;
  }
}

export function saveShortcuts(map: Record<string, string>) {
  try {
    const payload = { version: 1, shortcuts: map };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error("Failed to save shortcuts", err);
  }
}
