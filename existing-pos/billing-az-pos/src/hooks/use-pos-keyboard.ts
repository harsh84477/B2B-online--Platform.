/**
 * Single keyboard manager for the billing counter.
 *
 * Handles: configured shortcuts (category switch + actions), arrow-key grid
 * navigation and Enter-to-add. One window listener, nothing scattered.
 */
import { useCallback, useEffect, useRef } from "react";
import { matchesCombo, type ShortcutBinding } from "@/lib/shortcuts";

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest('[role="combobox"],[role="listbox"],[role="menu"]')) return true;
  return false;
}

function isModalOpen() {
  if (typeof document === "undefined") return false;
  return !!document.querySelector(
    '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]',
  );
}

export type PosZone = "products" | "cart";

interface Options {
  bindings: ShortcutBinding[];
  itemCount: number;
  gridRef: React.RefObject<HTMLElement | null>;
  onSelectCategory: (categoryId: string) => void;
  onAction: (actionId: string) => void;
  onEnter: () => void;
  selectedIndex: number;
  setSelectedIndex: (updater: (prev: number) => number) => void;
  /** Current keyboard zone: product grid or the current bill. */
  zone?: PosZone;
  setZone?: (zone: PosZone) => void;
  cartCount?: number;
  cartIndex?: number;
  setCartIndex?: (updater: (prev: number) => number) => void;
  /** +1 / -1 on the focused row (PageUp / PageDown). */
  onQtyDelta?: (delta: number) => void;
  onRemoveCartLine?: () => void;
}


/** Reads the real column count from the rendered grid (responsive-safe). */
export function readColumnCount(grid: HTMLElement | null): number {
  if (!grid) return 1;
  const cards = Array.from(grid.querySelectorAll<HTMLElement>('[data-keynav="product"]'));
  if (cards.length === 0) return 1;
  const firstTop = cards[0]!.offsetTop;
  let cols = 0;
  for (const c of cards) {
    if (Math.abs(c.offsetTop - firstTop) < 2) cols++;
    else break;
  }
  return Math.max(1, cols);
}

export function usePosKeyboard(opts: Options) {
  const ref = useRef(opts);
  ref.current = opts;

  const move = useCallback((dir: "up" | "down" | "left" | "right") => {
    const { itemCount, gridRef, setSelectedIndex } = ref.current;
    if (itemCount === 0) return;
    const cols = readColumnCount(gridRef.current);
    setSelectedIndex((prev) => {
      const cur = prev < 0 ? 0 : Math.min(prev, itemCount - 1);
      if (prev < 0) return cur;
      let next = cur;
      if (dir === "right") next = Math.min(cur + 1, itemCount - 1);
      if (dir === "left") next = Math.max(cur - 1, 0);
      if (dir === "down") next = cur + cols <= itemCount - 1 ? cur + cols : itemCount - 1;
      if (dir === "up") next = cur - cols >= 0 ? cur - cols : cur;
      return next;
    });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const {
        bindings,
        onSelectCategory,
        onAction,
        onEnter,
        itemCount,
        selectedIndex,
        setSelectedIndex,
        zone = "products",
        setZone,
        cartCount = 0,
        cartIndex = -1,
        setCartIndex,
        onQtyDelta,
        onRemoveCartLine,
      } = ref.current;
      const typing = isTypingTarget(e.target);

      // 1. Configured shortcuts — never while typing or inside a dialog.
      if (!typing && !isModalOpen()) {
        for (const b of bindings) {
          if (!b.combo || !b.target) continue;
          if (!matchesCombo(b.combo, e)) continue;
          e.preventDefault();
          if (b.kind === "category") onSelectCategory(b.target);
          else onAction(b.target);
          return;
        }
      }

      if (typing || isModalOpen()) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // 2. Quantity stepping with PageUp / PageDown on the focused row.
      if (e.key === "PageUp" || e.key === "PageDown") {
        if (!onQtyDelta) return;
        e.preventDefault();
        onQtyDelta(e.key === "PageUp" ? 1 : -1);
        return;
      }

      // 3. Current-bill zone: arrows walk the cart rows.
      if (zone === "cart") {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          if (cartCount === 0) return;
          e.preventDefault();
          setCartIndex?.((prev) => {
            const cur = prev < 0 ? 0 : Math.min(prev, cartCount - 1);
            if (prev < 0) return cur;
            return e.key === "ArrowUp" ? Math.max(0, cur - 1) : Math.min(cartCount - 1, cur + 1);
          });
          return;
        }
        if (e.key === "Delete" && cartIndex >= 0) {
          e.preventDefault();
          onRemoveCartLine?.();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setZone?.("products");
          return;
        }
        return;
      }

      // 4. Product grid navigation.
      if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (itemCount === 0) return;
        e.preventDefault();
        if (selectedIndex < 0) setSelectedIndex(() => 0);
        else
          move(
            e.key === "ArrowRight"
              ? "right"
              : e.key === "ArrowLeft"
                ? "left"
                : e.key === "ArrowUp"
                  ? "up"
                  : "down",
          );
        return;
      }

      // 5. Enter adds the selected product.
      if (e.key === "Enter" && selectedIndex >= 0 && selectedIndex < itemCount) {
        e.preventDefault();
        onEnter();
      }

    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);
}
