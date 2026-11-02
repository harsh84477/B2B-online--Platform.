import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CloudDownload, Database, FileSpreadsheet, HardDriveDownload, History, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GroupGrid, SaveBar, SectionSkeleton, SelectField, SettingsCard, ToggleRow } from "./kit";
import { useSettingsSection } from "@/lib/settings-store";
import { downloadCsv, downloadJson, dateTimeLabel } from "@/lib/export";

type TableName =
  | "products"
  | "customers"
  | "suppliers"
  | "categories"
  | "bills"
  | "bill_items"
  | "bill_payments"
  | "credit_notes"
  | "credit_note_items"
  | "batches"
  | "stock_movements"
  | "purchase_orders"
  | "purchase_items"
  | "expenses"
  | "expense_categories"
  | "customer_payments"
  | "supplier_payments";

const EXPORTS: { table: TableName; label: string; description: string }[] = [
  { table: "products", label: "Products", description: "Catalogue with pricing, GST and pack settings" },
  { table: "customers", label: "Customers", description: "Parties with credit limits and outstanding" },
  { table: "suppliers", label: "Suppliers", description: "Distributors and payables" },
  { table: "bills", label: "Sales invoices", description: "Bill headers with totals and payment status" },
  { table: "bill_items", label: "Invoice line items", description: "Item-level sales detail" },
  { table: "stock_movements", label: "Stock movements", description: "Every inward and outward entry" },
  { table: "expenses", label: "Expenses", description: "Daily expenses by category" },
];

const FULL_BACKUP_TABLES: TableName[] = [
  "categories",
  "products",
  "batches",
  "customers",
  "suppliers",
  "bills",
  "bill_items",
  "bill_payments",
  "credit_notes",
  "credit_note_items",
  "stock_movements",
  "purchase_orders",
  "purchase_items",
  "expense_categories",
  "expenses",
  "customer_payments",
  "supplier_payments",
];

const DEFAULTS = {
  auto_backup: false,
  frequency: "weekly",
  retention: "12",
  include_media: false,
  email_copy: false,
};

function toCsvRows(rows: Record<string, unknown>[]) {
  if (!rows.length) return [["No data"]];
  const headers = Object.keys(rows[0] as Record<string, unknown>);
  return [headers, ...rows.map((r) => headers.map((h) => (r[h] == null ? "" : String(r[h]))))];
}

export function BackupSection({ canEdit }: { canEdit: boolean }) {
  const state = useSettingsSection("backup", DEFAULTS);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const { data: counts } = useQuery({
    queryKey: ["backup", "counts"],
    queryFn: async () => {
      const entries = await Promise.all(
        (["products", "customers", "bills"] as TableName[]).map(async (t) => {
          const { count } = await supabase.from(t).select("id", { count: "exact", head: true });
          return [t, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
    staleTime: 60_000,
  });

  if (state.loading) return <SectionSkeleton />;

  async function exportTable(table: TableName, label: string) {
    setBusy(table);
    try {
      const { data, error } = await supabase.from(table).select("*");
      if (error) throw error;
      downloadCsv(`${table}-${new Date().toISOString().slice(0, 10)}.csv`, toCsvRows((data ?? []) as Record<string, unknown>[]));
      toast.success(`${label} exported`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function fullBackup() {
    setBusy("full");
    try {
      const payload: Record<string, unknown> = { exportedAt: new Date().toISOString(), app: "BillingAZ" };
      for (const table of FULL_BACKUP_TABLES) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw error;
        payload[table] = data ?? [];
      }
      downloadJson(`billingaz-backup-${new Date().toISOString().slice(0, 10)}.json`, payload);
      setLastBackup(new Date().toISOString());
      toast.success("Full backup downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Full backup"
        description="A single JSON snapshot of your entire workspace — catalogue, parties, sales, purchases and ledgers."
        actions={
          <Badge variant="secondary" className="gap-1">
            <History className="size-3" /> {lastBackup ? dateTimeLabel(lastBackup) : "No backup this session"}
          </Badge>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Products", counts?.['products'] ?? 0],
            ["Customers", counts?.['customers'] ?? 0],
            ["Invoices", counts?.['bills'] ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
        <Button className="mt-4" onClick={fullBackup} disabled={busy === "full"}>
          <HardDriveDownload className="size-4" /> {busy === "full" ? "Preparing…" : "Download full backup"}
        </Button>
      </SettingsCard>

      <SettingsCard title="Export data" description="Download any dataset as CSV for Excel, Tally or your accountant.">
        <div className="grid gap-3 md:grid-cols-2">
          {EXPORTS.map((e) => (
            <div
              key={e.table}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{e.label}</p>
                <p className="truncate text-xs text-muted-foreground">{e.description}</p>
              </div>
              <Button variant="outline" size="sm" disabled={busy === e.table} onClick={() => exportTable(e.table, e.label)}>
                <FileSpreadsheet className="size-4" /> CSV
              </Button>
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Import data"
        description="Bring in products or customers from a CSV file. Column headers must match the exported file."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {["Products", "Customers"].map((label) => (
            <label
              key={label}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-5 text-sm transition-colors hover:bg-muted/60"
            >
              <Upload className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Import {label.toLowerCase()}</span>
                <span className="block text-xs text-muted-foreground">CSV up to 5 MB</span>
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(ev) => {
                  const file = ev.target.files?.[0];
                  if (!file) return;
                  toast.info(
                    `${file.name} queued — use the ${label} screen's import action to map columns before committing.`,
                  );
                  ev.target.value = "";
                }}
              />
            </label>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Automatic backups" description="Schedule reminders and retention for your snapshots.">
        <GroupGrid columns={2}>
          <ToggleRow
            label="Enable automatic backup reminders"
            checked={!!state.values['auto_backup']}
            onChange={(x) => state.set("auto_backup", x)}
            disabled={!canEdit}
          />
          <SelectField
            label="Frequency"
            value={state.values['frequency']}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
            onChange={(x) => state.set("frequency", x)}
            disabled={!canEdit}
          />
          <SelectField
            label="Keep last"
            value={state.values['retention']}
            options={["3", "6", "12", "24"].map((n) => ({ value: n, label: `${n} backups` }))}
            onChange={(x) => state.set("retention", x)}
            disabled={!canEdit}
          />
          <ToggleRow
            label="Email me a copy"
            checked={!!state.values['email_copy']}
            onChange={(x) => state.set("email_copy", x)}
            disabled={!canEdit}
          />
        </GroupGrid>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Database className="size-3.5" /> Your data is stored on managed cloud Postgres with continuous replication.
          These snapshots are for your own offline archive.
        </p>
      </SettingsCard>

      <SettingsCard title="Storage & sync" description="Offline cache used by the billing counter.">
        <Button
          variant="outline"
          onClick={async () => {
            try {
              if ("caches" in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map((k) => caches.delete(k)));
              }
              toast.success("Local cache cleared");
            } catch {
              toast.error("Could not clear the cache");
            }
          }}
        >
          <CloudDownload className="size-4" /> Clear local cache
        </Button>
      </SettingsCard>

      <SaveBar
        dirty={state.dirty}
        saving={state.saving}
        onSave={state.save}
        onDiscard={state.discard}
        onRestore={state.restoreDefaults}
        readOnly={!canEdit}
      />
    </div>
  );
}
