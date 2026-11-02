import React, { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import ShortcutManager from "@/keyboard/shortcutManager";
import KeyCapture from "@/components/KeyCapture";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/settings-shortcuts")({
  head: () => ({ meta: [{ title: "Keyboard Shortcuts — BillingAZ" }] }),
  component: SettingsShortcutsPage,
});

export default function SettingsShortcutsPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ existingId: string; combo: string } | null>(null);

  useEffect(() => {
    ShortcutManager.loadFromStorage();
    setActions(ShortcutManager.listActions());
  }, []);

  function refresh() {
    setActions(ShortcutManager.listActions());
  }

  function onEdit(id: string) {
    setEditing(id);
    setConflict(null);
  }

  function onCaptured(combo: string) {
    if (!editing) return;
    const found = ShortcutManager.findActionByCombo(combo as string);
    if (found && found.id !== editing) {
      setConflict({ existingId: found.id, combo });
      return;
    }
    // apply
    try {
      ShortcutManager.setActionShortcut(editing, combo);
      setEditing(null);
      refresh();
    } catch (err) {
      console.error(err);
    }
  }

  function onReplace() {
    if (!conflict || !editing) return;
    ShortcutManager.setActionShortcut(conflict.existingId, null as any);
    ShortcutManager.setActionShortcut(editing, conflict.combo as any);
    setConflict(null);
    setEditing(null);
    setActions(ShortcutManager.listActions());
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-lg font-bold">Keyboard Shortcuts</h1>
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-xs font-medium text-muted-foreground">
              <th className="p-3">Action</th>
              <th className="p-3">Shortcut</th>
              <th className="p-3"> </th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id} className="border-t border-border">
                <td className="p-3">{a.name}</td>
                <td className="p-3 font-mono">{a.combo ?? "—"}</td>
                <td className="p-3">
                  <Button variant="outline" size="sm" onClick={() => onEdit(a.id)}>Edit</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={() => { ShortcutManager.restoreDefaults(); setActions(ShortcutManager.listActions()); }}>Restore Defaults</Button>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Capture new shortcut</DialogTitle>
          </DialogHeader>
          {conflict ? (
            <div className="p-4">
              <p className="mb-2">Conflict: {conflict.combo} is already assigned to {conflict.existingId}</p>
              <div className="flex gap-2">
                <Button onClick={onReplace}>Replace</Button>
                <Button variant="outline" onClick={() => { setConflict(null); setEditing(null); }}>Cancel</Button>
              </div>
            </div>
          ) : (
            <KeyCapture onCaptured={onCaptured} onCancel={() => setEditing(null)} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
