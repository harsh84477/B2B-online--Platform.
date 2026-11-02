import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2, Search, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, PageShell, EmptyState } from "@/components/page";
import { billDetailQuery, billsQuery, creditNotesQuery } from "@/lib/admin-queries";
import { round2, rupees } from "@/lib/pos";
import { dateTimeLabel, downloadCsv } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/returns")({
  head: () => ({
    meta: [
      { title: "Sales Returns & Credit Notes — BillingAZ" },
      {
        name: "description",
        content:
          "Raise credit notes against sales invoices, restock returned goods and adjust customer credit balances.",
      },
      { property: "og:title", content: "Sales Returns & Credit Notes — BillingAZ" },
      {
        property: "og:description",
        content: "GST credit notes with automatic stock-in and ledger adjustment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReturnsPage,
});

interface ReturnLine {
  product_id: string | null;
  product_name: string;
  sku: string | null;
  maxQty: number;
  quantity: number;
  unit_price: number;
  gst_percent: number;
}

function ReturnsPage() {
  const qc = useQueryClient();
  const { data: notes = [] } = useQuery(creditNotesQuery());
  const [open, setOpen] = useState(false);

  const totalCredited = notes.reduce((s, n) => s + Number(n.net_amount), 0);

  return (
    <PageShell>
      <PageHeader
        title="Sales Returns"
        subtitle="Credit notes raised against sales invoices"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "credit-notes.csv",
                  [
                    ["Credit Note", "Date", "Customer", "Sub Total", "GST", "Net", "Type"],
                    ...notes.map((n) => [
                      n.credit_note_number,
                      dateTimeLabel(n.note_date),
                      n.customer_name ?? "",
                      Number(n.sub_total),
                      Number(n.gst_amount),
                      Number(n.net_amount),
                      n.adjustment_type,
                    ]),
                  ],
                )
              }
            >
              Export CSV
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 size-4" />
              New Return
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Credit Notes" value={String(notes.length)} />
        <StatCard label="Total Credited" value={rupees(totalCredited)} />
        <StatCard
          label="This Month"
          value={rupees(
            notes
              .filter((n) => n.note_date.slice(0, 7) === new Date().toISOString().slice(0, 7))
              .reduce((s, n) => s + Number(n.net_amount), 0),
          )}
        />
      </div>

      <Card className="overflow-hidden p-0">
        {notes.length === 0 ? (
          <EmptyState
            icon={Undo2}
            title="No returns yet"
            description="Raise a credit note when a customer returns goods."
            action={<Button onClick={() => setOpen(true)}>New Return</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Credit Note</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Net Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((n) => (
                <TableRow key={n.id}>
                  <TableCell className="font-medium">{n.credit_note_number}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateTimeLabel(n.note_date)}
                  </TableCell>
                  <TableCell>{n.customer_name || "Walk-in"}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-muted-foreground">
                    {n.reason || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={n.adjustment_type === "CASH" ? "secondary" : "default"}>
                      {n.adjustment_type === "CASH" ? "Cash refund" : "Credit adjust"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-primary">
                    {rupees(Number(n.net_amount))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <NewReturnDialog
        open={open}
        onOpenChange={setOpen}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["credit_notes"] });
          qc.invalidateQueries({ queryKey: ["products"] });
          qc.invalidateQueries({ queryKey: ["customers"] });
          qc.invalidateQueries({ queryKey: ["stock_movements"] });
        }}
      />
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </Card>
  );
}

function NewReturnDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { data: bills = [] } = useQuery(billsQuery());
  const [search, setSearch] = useState("");
  const [billId, setBillId] = useState<string | null>(null);
  const { data: detail } = useQuery(billDetailQuery(billId));
  const [lines, setLines] = useState<ReturnLine[]>([]);
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(true);
  const [adjustment, setAdjustment] = useState("CREDIT");

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bills.slice(0, 8);
    return bills
      .filter(
        (b) =>
          b.invoice_number.toLowerCase().includes(q) ||
          (b.customer_name ?? "").toLowerCase().includes(q) ||
          (b.customer_mobile ?? "").includes(q),
      )
      .slice(0, 8);
  }, [bills, search]);

  function pickBill(id: string) {
    setBillId(id);
    setLines([]);
  }

  const billItems = detail?.items ?? [];

  // Seed return lines the first time a bill's items land.
  const seeded = lines.length > 0;
  if (billId && billItems.length > 0 && !seeded) {
    setLines(
      billItems.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        sku: it.sku,
        maxQty: Number(it.quantity),
        quantity: 0,
        unit_price: Number(it.unit_price),
        gst_percent: Number(it.gst_percent),
      })),
    );
  }

  const active = lines.filter((l) => l.quantity > 0);
  const totals = active.reduce(
    (acc, l) => {
      const taxable = round2(l.quantity * l.unit_price);
      const gst = round2((taxable * l.gst_percent) / 100);
      acc.sub += taxable;
      acc.gst += gst;
      return acc;
    },
    { sub: 0, gst: 0 },
  );
  const net = round2(totals.sub + totals.gst);

  const save = useMutation({
    mutationFn: async () => {
      if (active.length === 0) throw new Error("Add at least one returned item");
      const bill = detail?.bill;
      const { data, error } = await supabase.rpc("create_credit_note", {
        p_note: {
          original_bill_id: billId,
          customer_id: bill?.customer_id ?? null,
          customer_name: bill?.customer_name ?? null,
          sub_total: round2(totals.sub),
          gst_amount: round2(totals.gst),
          net_amount: net,
          adjustment_type: adjustment,
          reason,
          restock,
        },
        p_items: active.map((l) => {
          const taxable = round2(l.quantity * l.unit_price);
          const gst = round2((taxable * l.gst_percent) / 100);
          return {
            product_id: l.product_id,
            product_name: l.product_name,
            sku: l.sku,
            quantity: l.quantity,
            unit_price: l.unit_price,
            gst_percent: l.gst_percent,
            taxable_amount: taxable,
            gst_amount: gst,
            total_amount: round2(taxable + gst),
          };
        }),
      });
      if (error) throw error;
      return data as unknown as { credit_note_number: string };
    },
    onSuccess: (res) => {
      toast.success(`Credit note ${res.credit_note_number} created`);
      onSaved();
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function reset() {
    setBillId(null);
    setLines([]);
    setReason("");
    setRestock(true);
    setAdjustment("CREDIT");
    setSearch("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Sales Return</DialogTitle>
        </DialogHeader>

        {!billId ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-9"
                placeholder="Search invoice number, customer or mobile"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="divide-y rounded-xl border border-border">
              {matches.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No matching invoices.</p>
              )}
              {matches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => pickBill(b.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  <div>
                    <p className="text-sm font-medium">{b.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.customer_name || "Walk-in"} · {dateTimeLabel(b.invoice_date)}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums text-primary">
                    {rupees(Number(b.grand_total))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{detail?.bill?.invoice_number}</p>
                <p className="text-xs text-muted-foreground">
                  {detail?.bill?.customer_name || "Walk-in"}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => pickBill("")}>
                <Trash2 className="mr-2 size-4" />
                Change
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-24 text-right">Sold</TableHead>
                  <TableHead className="w-28 text-right">Return Qty</TableHead>
                  <TableHead className="w-28 text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l, i) => {
                  const taxable = round2(l.quantity * l.unit_price);
                  return (
                    <TableRow key={`${l.product_name}-${i}`}>
                      <TableCell>
                        <p className="text-sm font-medium">{l.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {rupees(l.unit_price)} · GST {l.gst_percent}%
                        </p>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.maxQty}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min={0}
                          max={l.maxQty}
                          value={l.quantity || ""}
                          onChange={(e) => {
                            const v = Math.max(
                              0,
                              Math.min(l.maxQty, Number(e.target.value) || 0),
                            );
                            setLines((prev) =>
                              prev.map((p, pi) => (pi === i ? { ...p, quantity: v } : p)),
                            );
                          }}
                          className="h-9 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {rupees(round2(taxable + (taxable * l.gst_percent) / 100))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Adjustment</Label>
                <Select value={adjustment} onValueChange={setAdjustment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT">Reduce customer outstanding</SelectItem>
                    <SelectItem value="CASH">Cash refund</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end justify-between rounded-lg border border-border px-4 py-2.5">
                <div>
                  <Label className="text-sm">Restock items</Label>
                  <p className="text-xs text-muted-foreground">Add returned goods back to stock</p>
                </div>
                <Switch checked={restock} onCheckedChange={setRestock} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Damaged in transit, wrong item supplied…"
              />
            </div>

            <div className="rounded-xl border border-border p-4">
              <Row label="Taxable" value={rupees(round2(totals.sub))} />
              <Row label="GST" value={rupees(round2(totals.gst))} />
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="font-semibold">Credit Amount</span>
                <span className="text-xl font-bold tabular-nums text-primary">{rupees(net)}</span>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={net <= 0 || save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? "Saving…" : "Create Credit Note"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
