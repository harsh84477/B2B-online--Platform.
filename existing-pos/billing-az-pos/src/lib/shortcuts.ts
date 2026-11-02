/**
 * Central shortcut configuration for the POS.
 *
 * - Bindings are persisted in localStorage (instant, per-device) and mirrored to
 *   the existing `app_settings` table (section = "shortcuts") when the signed in
 *   user is allowed to write it.
 * - Any component can subscribe with `useShortcutBindings()` and gets live
 *   updates the moment Settings saves — no page refresh.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ShortcutKind = "category" | "action";

export interface ShortcutBinding {
  /** stable id, e.g. "cat-slot-1" or "custom-1717..." */
  id: string;
  kind: ShortcutKind;
  /** normalised combo, e.g. "Alt+1", "Ctrl+Shift+P", "F2". null = disabled */
  combo: string | null;
  /** category id, "all", or an action id — null = unassigned */
  target: string | null;
  /** true for the ten built-in Alt+1..Alt+0 slots */
  builtin?: boolean;
}

export interface ShortcutActionDef {
  id: string;
  label: string;
}

/** Non-category actions that the Billing screen exposes to the shortcut manager. */
export const SHORTCUT_ACTIONS: ShortcutActionDef[] = [
  { id: "focus_search", label: "Focus product search" },
  { id: "focus_products", label: "Focus product grid" },
  { id: "focus_cart", label: "Focus current bill (cart)" },
  { id: "clear_cart", label: "Clear current bill" },
];

const STORAGE_KEY = "billingaz.shortcuts.v1";
const SECTION = "shortcuts";

/** Default category names for Alt+1 … Alt+0, matched against real categories. */
export const DEFAULT_SLOT_NAMES = [
  "All",
  "Spices",
  "Rice",
  "Pulses",
  "Oil",
  "Biscuit",
  "Soap",
  "Shampoo",
  "Dairy",
  "Cold Drinks",
];

export const ALT_SLOT_COMBOS = [
  "Alt+1",
  "Alt+2",
  "Alt+3",
  "Alt+4",
  "Alt+5",
  "Alt+6",
  "Alt+7",
  "Alt+8",
  "Alt+9",
  "Alt+0",
];

export interface CategoryLike {
  id: string;
  name: string;
}

/** Builds the ten default Alt slots, mapping names to real categories only. */
export function buildDefaultBindings(categories: CategoryLike[]): ShortcutBinding[] {
  return ALT_SLOT_COMBOS.map((combo, i) => {
    const wanted = DEFAULT_SLOT_NAMES[i] ?? "";
    let target: string | null = null;
    if (wanted.toLowerCase() === "all") target = "all";
    else {
      const match = categories.find((c) => c.name.trim().toLowerCase() === wanted.toLowerCase());
      target = match ? match.id : null;
    }
    return { id: `cat-slot-${i + 1}`, kind: "category" as const, combo, target, builtin: true };
  });
}

/* ------------------------------------------------------------------ store */

let raw: ShortcutBinding[] | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function readLocal(): ShortcutBinding[] | null {
  if (typeof window === "undefined") return null;
  try {
    const s = window.localStorage.getItem(STORAGE_KEY);
    if (!s) return null;
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? (parsed as ShortcutBinding[]) : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!hydrated) {
    hydrated = true;
    raw = readLocal();
    // Pull the shared configuration from the backend when nothing is stored locally.
    if (!raw) {
      void supabase
        .from("app_settings")
        .select("value")
        .eq("section", SECTION)
        .maybeSingle()
        .then(({ data }) => {
          const value = (data?.value ?? null) as { bindings?: ShortcutBinding[] } | null;
          if (value?.bindings && Array.isArray(value.bindings) && !readLocal()) {
            raw = value.bindings;
            emit();
          }
        });
    }
  }
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return raw;
}

function getServerSnapshot(): ShortcutBinding[] | null {
  return null;
}

/** Persists bindings everywhere and notifies every subscriber immediately. */
export async function saveShortcutBindings(bindings: ShortcutBinding[]) {
  raw = bindings;
  emit();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
  } catch {
    /* storage full / disabled — in-memory state still applies */
  }
  const { error } = await supabase
    .from("app_settings")
    .upsert({ section: SECTION, value: { bindings } as never }, { onConflict: "section" });
  // RLS may block non-admins; local persistence keeps their device working.
  if (error && !error.message.toLowerCase().includes("row-level security")) throw error;
}

/** Clears customisation so defaults apply again. */
export async function resetShortcutBindings() {
  raw = null;
  emit();
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  await supabase
    .from("app_settings")
    .upsert({ section: SECTION, value: { bindings: null } as never }, { onConflict: "section" });
}

/** Live bindings, merged over defaults derived from the current categories. */
export function useShortcutBindings(categories: CategoryLike[]): ShortcutBinding[] {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    const defaults = buildDefaultBindings(categories);
    if (!stored) return defaults;
    // keep stored order; ensure the ten builtin slots always exist
    const byId = new Map(stored.map((b) => [b.id, b]));
    const merged = defaults.map((d) => byId.get(d.id) ?? d);
    const extras = stored.filter((b) => !b.builtin && !merged.some((m) => m.id === b.id));
    return [...merged, ...extras];
  }, [stored, categories]);
}

export function useShortcutActions() {
  const save = useCallback((b: ShortcutBinding[]) => saveShortcutBindings(b), []);
  const reset = useCallback(() => resetShortcutBindings(), []);
  return { save, reset };
}

/* ------------------------------------------------------- combo utilities */

/** Browser/OS combos we refuse to capture. */
const RESERVED = new Set([
  "Ctrl+w",
  "Ctrl+t",
  "Ctrl+n",
  "Ctrl+q",
  "Meta+w",
  "Meta+t",
  "Meta+n",
  "Meta+q",
  "Alt+F4",
  "F5",
  "F11",
  "F12",
  "Ctrl+Shift+i",
  "Ctrl+Shift+j",
]);

export function isReservedCombo(combo: string) {
  return RESERVED.has(combo);
}

/** Normalises a keyboard event into a stable combo string. */
export function comboFromEvent(e: KeyboardEvent | React.KeyboardEvent): string | null {
  const key = e.key;
  if (["Control", "Alt", "Shift", "Meta", "Dead"].includes(key)) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.metaKey) parts.push("Meta");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  // Alt on some layouts produces symbols — fall back to the physical digit/letter.
  const code = (e as KeyboardEvent).code ?? "";
  let base = key;
  if (/^Digit\d$/.test(code)) base = code.slice(5);
  else if (/^Key[A-Z]$/.test(code)) base = code.slice(3).toLowerCase();
  else if (key.length === 1) base = key.toLowerCase();
  parts.push(base);
  return parts.join("+");
}

export function matchesCombo(combo: string, e: KeyboardEvent): boolean {
  const eventCombo = comboFromEvent(e);
  if (!eventCombo) return false;
  return eventCombo.toLowerCase() === combo.toLowerCase();
}

/** Human label such as "Alt + 1". */
export function formatCombo(combo: string | null): string {
  if (!combo) return "—";
  return combo
    .split("+")
    .map((p) => (p.length === 1 ? p.toUpperCase() : p))
    .join(" + ");
}

export function describeTarget(
  b: ShortcutBinding,
  categories: CategoryLike[],
): string {
  if (b.kind === "action") {
    return SHORTCUT_ACTIONS.find((a) => a.id === b.target)?.label ?? "Unassigned";
  }
  if (b.target === "all") return "All";
  const cat = categories.find((c) => c.id === b.target);
  return cat ? cat.name : "Unassigned";
}
