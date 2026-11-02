import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsCard, SaveBar } from "@/components/settings/kit";
import { categoriesQuery } from "@/lib/queries";
import {
  ALT_SLOT_COMBOS,
  SHORTCUT_ACTIONS,
  buildDefaultBindings,
  comboFromEvent,
  describeTarget,
  formatCombo,
  isReservedCombo,
  resetShortcutBindings,
  saveShortcutBindings,
  useShortcutBindings,
  type ShortcutBinding,
} from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

const UNASSIGNED = "__none__";

export function ShortcutsSection({ canEdit }: { canEdit: boolean }) {
  const { data: categories = [] } = useQuery(categoriesQuery());
  const live = useShortcutBindings(categories);
  const [draft, setDraft] = useState<ShortcutBinding[]>(live);
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    setDraft(live);
  }, [live]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(live), [draft, live]);
  const slots = draft.filter((b) => b.builtin);
  const customs = draft.filter((b) => !b.builtin);

  function update(id: string, patch: Partial<ShortcutBinding>) {
    setDraft((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }

  function comboConflict(combo: string, selfId: string) {
    return draft.find((b) => b.id !== selfId && b.combo?.toLowerCase() === combo.toLowerCase());
  }

  function applyCombo(id: string, combo: string) {
    if (isReservedCombo(combo)) {
      toast.error(`${formatCombo(combo)} is reserved by the browser. Pick another combination.`);
      return;
    }
    const clash = comboConflict(combo, id);
    if (clash) {
      toast.error(`Shortcut already assigned to ${describeTarget(clash, categories)}.`);
      return;
    }
    update(id, { combo });
    setCapturing(null);
  }

  async function save() {
    // Final duplicate guard before persisting.
    const seen = new Map<string, ShortcutBinding>();
    for (const b of draft) {
      if (!b.combo) continue;
      const key = b.combo.toLowerCase();
      const clash = seen.get(key);
      if (clash) {
        toast.error(`Shortcut ${formatCombo(b.combo)} is used twice — assigned to ${describeTarget(clash, categories)}.`);
        return;
      }
      seen.set(key, b);
    }
    setSaving(true);
    try {
      await saveShortcutBindings(draft);
      toast.success("Shortcuts saved — active immediately");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function doReset() {
    setConfirmReset(false);
    await resetShortcutBindings();
    setDraft(buildDefaultBindings(categories));
    toast.success("Shortcuts reset to default");
  }

  function addCustom() {
    const used = new Set(draft.map((b) => b.combo?.toLowerCase()));
    const free = ["F2", "F3", "F4", "F6", "F7", "F8", "Ctrl+Shift+p"].find(
      (c) => !used.has(c.toLowerCase()),
    );
    setDraft((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}`,
        kind: "category",
        combo: free ?? null,
        target: null,
      },
    ]);
  }

  return (
    <div className="space-y-5 pb-24">
      <SettingsCard
        title="Category shortcuts"
        description="Assign any category to Alt + 1 … Alt + 0. Pressing the key at the billing counter switches the category and selects the first product."
      >
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-[160px] p-3 text-left font-medium">Shortcut</th>
                <th className="p-3 text-left font-medium">Category</th>
                <th className="w-[90px] p-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((b, i) => (
                <BindingRow
                  key={b.id}
                  binding={b}
                  fallbackCombo={ALT_SLOT_COMBOS[i] ?? ""}
                  categories={categories}
                  canEdit={canEdit}
                  capturing={capturing === b.id}
                  onCapture={() => setCapturing(b.id)}
                  onCancelCapture={() => setCapturing(null)}
                  onCombo={(c) => applyCombo(b.id, c)}
                  onTarget={(t) => update(b.id, { target: t, kind: "category" })}
                />
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Custom shortcuts"
        description="Add your own combinations — Alt, Ctrl, Shift and function keys are supported."
      >
        {customs.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No custom shortcuts yet.
          </p>
        )}
        {customs.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="w-[160px] p-3 text-left font-medium">Shortcut</th>
                  <th className="p-3 text-left font-medium">Action / Category</th>
                  <th className="w-[130px] p-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {customs.map((b) => (
                  <BindingRow
                    key={b.id}
                    binding={b}
                    fallbackCombo=""
                    categories={categories}
                    canEdit={canEdit}
                    allowActions
                    capturing={capturing === b.id}
                    onCapture={() => setCapturing(b.id)}
                    onCancelCapture={() => setCapturing(null)}
                    onCombo={(c) => applyCombo(b.id, c)}
                    onTarget={(t, kind) => update(b.id, { target: t, kind })}
                    onRemove={() => setDraft((prev) => prev.filter((x) => x.id !== b.id))}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3">
          <Button variant="outline" size="sm" onClick={addCustom} disabled={!canEdit}>
            <Plus className="size-4" /> Add shortcut
          </Button>
        </div>
      </SettingsCard>

      <SettingsCard title="Keyboard controls" description="Reference for the billing counter.">
        <div className="grid gap-3 sm:grid-cols-2">
          <CheatRow keys={slots.filter((s) => s.combo).map((s) => formatCombo(s.combo)).slice(0, 3).join(" / ") + " …"} label="Switch to the assigned category" />
          <CheatRow keys="← ↑ ↓ →" label="Navigate the product grid" />
          <CheatRow keys="Enter" label="Add selected product to the bill (adds quantity if already there)" />
          <CheatRow keys="Esc" label="Close dialog / cancel current action" />
          {customs.filter((c) => c.combo && c.target).map((c) => (
            <CheatRow key={c.id} keys={formatCombo(c.combo)} label={describeTarget(c, categories)} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Shortcuts stay inactive while you are typing in a search box, quantity, rate, discount or
          any other input.
        </p>
      </SettingsCard>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)} disabled={!canEdit}>
          <RotateCcw className="size-4" /> Reset to default
        </Button>
      </div>

      <SaveBar
        dirty={dirty && canEdit}
        saving={saving}
        onSave={save}
        onDiscard={() => setDraft(live)}
        onRestore={() => setDraft(buildDefaultBindings(categories))}
        readOnly={!canEdit}
      />

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all keyboard shortcuts to default?</AlertDialogTitle>
            <AlertDialogDescription>
              Every custom shortcut will be removed and Alt + 1 … Alt + 0 will map back to the
              default categories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doReset}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CheatRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-3 py-2">
      <kbd className="shrink-0 rounded border border-border bg-background px-2 py-1 text-xs font-semibold">
        {keys}
      </kbd>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

function BindingRow({
  binding,
  fallbackCombo,
  categories,
  canEdit,
  allowActions,
  capturing,
  onCapture,
  onCancelCapture,
  onCombo,
  onTarget,
  onRemove,
}: {
  binding: ShortcutBinding;
  fallbackCombo: string;
  categories: { id: string; name: string }[];
  canEdit: boolean;
  allowActions?: boolean;
  capturing: boolean;
  onCapture: () => void;
  onCancelCapture: () => void;
  onCombo: (combo: string) => void;
  onTarget: (target: string | null, kind: "category" | "action") => void;
  onRemove?: () => void;
}) {
  const value =
    binding.target === null ? UNASSIGNED : `${binding.kind}:${binding.target}`;

  return (
    <tr className="border-t border-border">
      <td className="p-3">
        <kbd className="rounded border border-border bg-muted px-2 py-1 text-xs font-semibold">
          {formatCombo(binding.combo ?? (fallbackCombo || null))}
        </kbd>
      </td>
      <td className="p-3">
        <Select
          value={value}
          disabled={!canEdit}
          onValueChange={(v) => {
            if (v === UNASSIGNED) return onTarget(null, binding.kind);
            const [kind, ...rest] = v.split(":");
            onTarget(rest.join(":"), kind === "action" ? "action" : "category");
          }}
        >
          <SelectTrigger className="h-9 max-w-[280px]">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
            <SelectItem value="category:all">All</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={`category:${c.id}`}>
                {c.name}
              </SelectItem>
            ))}
            {allowActions &&
              SHORTCUT_ACTIONS.map((a) => (
                <SelectItem key={a.id} value={`action:${a.id}`}>
                  {a.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </td>
      <td className="p-3">
        <div className="flex items-center justify-end gap-1">
          <Button variant="outline" size="sm" onClick={onCapture} disabled={!canEdit}>
            Edit
          </Button>
          {onRemove && (
            <Button variant="ghost" size="icon" onClick={onRemove} disabled={!canEdit} aria-label="Remove shortcut">
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
        </div>
        <CaptureDialog
          open={capturing}
          onOpenChange={(o) => (o ? onCapture() : onCancelCapture())}
          onCombo={onCombo}
        />
      </td>
    </tr>
  );
}

function CaptureDialog({
  open,
  onOpenChange,
  onCombo,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCombo: (combo: string) => void;
}) {
  const [detected, setDetected] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDetected(null);
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") return;
      e.preventDefault();
      const combo = comboFromEvent(e);
      if (combo) setDetected(combo);
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Press the shortcut</DialogTitle>
          <DialogDescription>
            Hold your modifiers and press a key — for example Alt + 1, Ctrl + Shift + P or F2.
          </DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            "flex h-24 items-center justify-center rounded-lg border-2 border-dashed",
            detected ? "border-primary bg-primary/5" : "border-border",
          )}
        >
          {detected ? (
            <kbd className="rounded-md border border-border bg-background px-4 py-2 text-lg font-bold">
              {formatCombo(detected)}
            </kbd>
          ) : (
            <span className="text-sm text-muted-foreground">Waiting for key press…</span>
          )}
        </div>
        {detected && isReservedCombo(detected) && (
          <Badge variant="destructive" className="w-fit">
            Reserved by the browser
          </Badge>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!detected || isReservedCombo(detected)}
            onClick={() => detected && onCombo(detected)}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
