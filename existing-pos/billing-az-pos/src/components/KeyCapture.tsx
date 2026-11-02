import React, { useEffect, useState } from "react";

export default function KeyCapture({ onCaptured, onCancel }: { onCaptured: (combo: string) => void; onCancel: () => void; }) {
  const [combo, setCombo] = useState<string>("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      e.preventDefault();
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.metaKey) parts.push("Meta");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      parts.push(e.key);
      const c = parts.join("+");
      setCombo(c);
      // small delay to allow user to see, then capture
      setTimeout(() => onCaptured(c), 100);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("keydown", onEsc, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true } as any);
      window.removeEventListener("keydown", onEsc, { capture: true } as any);
    };
  }, [onCaptured, onCancel]);

  return (
    <div className="p-4">
      <p className="mb-2 text-sm">Press the new key combination now (Esc to cancel)</p>
      <div className="rounded-md border border-border bg-background p-3 text-center">
        <div className="text-lg font-mono">{combo || "—"}</div>
      </div>
    </div>
  );
}
