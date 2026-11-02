import { loadShortcuts, saveShortcuts } from "./persistence";

// Export a single top-level ShortcutManager value. Avoid using `export` inside
// conditional blocks because ES modules require exports to be at the top level.

type KeyHandler = (e: KeyboardEvent) => void;

interface Registration {
  id: string;
  match: (e: KeyboardEvent) => boolean;
  handler: KeyHandler;
  zone?: string | null;
}

interface ActionDef {
  id: string;
  name: string;
  defaultCombo: string | null;
  combo: string | null;
  zone?: string | null;
  handler?: KeyHandler;
}

const regs: Registration[] = [];
const actions: Record<string, ActionDef> = {};

function isTypingElement(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((target as HTMLElement).isContentEditable) return true;
  return false;
}

function normalizeComboFromEvent(e: KeyboardEvent) {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.metaKey) parts.push("Meta");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  // use key for printable and named keys
  parts.push(e.key);
  return parts.join("+");
}

function comboMatchesEvent(combo: string, e: KeyboardEvent) {
  const wanted = combo.split("+");
  const key = wanted[wanted.length - 1];
  const mods = new Set(wanted.slice(0, -1).map((s) => s.toLowerCase()));
  if (mods.has("ctrl") !== e.ctrlKey) return false;
  if (mods.has("alt") !== e.altKey) return false;
  if (mods.has("shift") !== e.shiftKey) return false;
  if (mods.has("meta") !== e.metaKey) return false;
  return key === e.key;
}

function handleKeydown(e: KeyboardEvent) {
  if (isTypingElement(e.target)) return;
  for (const r of regs) {
    try {
      if (r.match(e)) {
        e.preventDefault();
        r.handler(e);
        break;
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("shortcut handler error", err);
    }
  }
}

// Define a no-op manager for SSR (when window is undefined). This object is
// exported as ShortcutManager during SSR to avoid touching the DOM or adding
// event listeners at module-evaluation time.
const isSSR = typeof window === "undefined";

const ssrNoop = {
  register: () => () => {},
  unregister: () => {},
  clear: () => {},
  registerAction: (_id: string, _name: string, _defaultCombo: string | null) => () => {},
  setActionShortcut: (_id: string, _combo: string | null) => {},
  getActionShortcut: (_id: string) => null,
  listActions: () => [],
  findActionByCombo: (_combo: string) => null,
  restoreDefaults: () => {},
  _persist: () => {},
  loadFromStorage: () => {},
} as const;

let ShortcutManager: any = ssrNoop;

if (!isSSR) {
  // Client-side: install keydown listener and provide full manager implementation.
  window.addEventListener("keydown", handleKeydown);

  function findRegIndexById(id: string) {
    return regs.findIndex((r) => r.id === id);
  }

  function findActionByComboInternal(combo: string) {
    for (const k of Object.keys(actions)) {
      if (actions[k].combo === combo) return actions[k];
    }
    return null;
  }

  ShortcutManager = {
    register(id: string, match: (e: KeyboardEvent) => boolean, handler: KeyHandler, zone?: string | null) {
      regs.push({ id, match, handler, zone });
      return () => this.unregister(id);
    },
    unregister(id: string) {
      const idx = findRegIndexById(id);
      if (idx >= 0) regs.splice(idx, 1);
    },
    clear() {
      regs.length = 0;
    },
    registerAction(id: string, name: string, defaultCombo: string | null, handler: KeyHandler, zone?: string | null) {
      actions[id] = { id, name, defaultCombo, combo: actions[id]?.combo ?? defaultCombo, zone, handler } as any;
      this.unregister(id);
      const effectiveCombo = actions[id].combo ?? defaultCombo;
      if (effectiveCombo) {
        const match = (e: KeyboardEvent) => comboMatchesEvent(effectiveCombo, e);
        regs.push({ id, match, handler, zone });
      }
      return () => this.unregister(id);
    },
    setActionShortcut(id: string, combo: string | null) {
      const a = actions[id];
      if (!a) throw new Error(`Unknown action ${id}`);
      this.unregister(id);
      a.combo = combo;
      if (combo && a.handler) {
        const match = (e: KeyboardEvent) => comboMatchesEvent(combo, e);
        regs.push({ id, match, handler: a.handler as KeyHandler, zone: a.zone } as any);
      }
      this._persist();
    },
    getActionShortcut(id: string) {
      return actions[id]?.combo ?? null;
    },
    listActions() {
      return Object.values(actions);
    },
    findActionByCombo(combo: string) {
      return findActionByComboInternal(combo);
    },
    restoreDefaults() {
      for (const k of Object.keys(actions)) {
        const a = actions[k];
        a.combo = a.defaultCombo;
        this.unregister(k);
        if (a.combo && a.handler) {
          const match = (e: KeyboardEvent) => comboMatchesEvent(a.combo as string, e);
          regs.push({ id: k, match, handler: a.handler as KeyHandler, zone: a.zone });
        }
      }
      this._persist();
    },
    _persist() {
      const map: Record<string, string> = {};
      for (const k of Object.keys(actions)) {
        if (actions[k].combo) map[k] = actions[k].combo as string;
      }
      try {
        saveShortcuts(map);
      } catch (err) {
        console.error("Could not persist shortcuts", err);
      }
    },
    loadFromStorage() {
      const saved = loadShortcuts();
      if (!saved) return;
      for (const k of Object.keys(saved)) {
        if (actions[k]) {
          actions[k].combo = saved[k];
        } else {
          actions[k] = { id: k, name: k, defaultCombo: null, combo: saved[k], zone: null } as any;
        }
      }
    },
  };
}

export { ShortcutManager };
export default ShortcutManager;
