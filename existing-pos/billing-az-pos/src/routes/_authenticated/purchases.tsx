import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, PageShell, EmptyState } from "@/components/page";
import { allProductsQuery, purchaseOrdersQuery, suppliersQuery } from "@/lib/admin-queries";
import { round2, rupees } from "@/lib/pos";
import { dateLabel, todayIso } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/purchases")({
  head: () => ({
    meta: [
      { title: "Purchases — BillingAZ Wholesale POS" },
      {
        name: "description",
        content:
          "Record supplier purchase invoices, create stock batches with expiry and update inventory automatically.",
      },
      { property: "og:title", content: "Purchases — BillingAZ" },
      { property: "og:description", content: "Purchase entry with batch and expiry capture." },
    ],
  }),
  component: PurchasesPage,
});

interface Line {
  productId: string;
  qty: string;
  price: string;
  gst: string;
  batch: string;
  expiry: string;
}

const blankLine: Line = { productId: "", qty: "", price: "", gst: "5", batch: "", expiry: "" };

function PurchasesPage() {
  const qc = useQueryClient();
  const { data: orders = [] } = useQuery(purchaseOrdersQuery());
  const { data: suppliers = [] } = useQuery(suppliersQuery());
  const { data: products = [] } = useQuery(allProductsQuery());
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [amountPaid, setAmountPaid] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...blankLine }]);

  const computed = lines.map((l) => {
    const taxable = round2(Number(l.qty || 0) * Number(l.price || 0));
    const gst = round2((taxable * Number(l.gst || 0)) / 100);
    return { taxable, gst, total: round2(taxable + gst) };
  });
  const subTotal = round2(computed.reduce((s, c) => s + c.taxable, 0));
  const totalGst = round2(computed.reduce((s, c) => s + c.gst, 0));
  const grandTotal = round2(subTotal + totalGst);

  const save = useMutation({
    mutationFn: async () => {
      const valid = lines.filter((l) => l.productId && Number(l.qty) > 0);
      if (!valid.length) throw new Error("Add at least one item");
      const paid = Number(amountPaid) || 0;
      const { data: po, error } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_id: supplierId || null,
          invoice_number: invoiceNumber || null,
          invoice_date: invoiceDate,
          sub_total: subTotal,
          total_gst: totalGst,
          grand_total: grandTotal,
          amount_paid: paid,
          status: "COMPLETED" as never,
        })
        .select("id")
        .single();
      if (error) throw error;

      for (const line of valid) {
        const product = products.find((p) => p.id === line.productId)!;
        const qty = Math.trunc(Number(line.qty));
        const price = Number(line.price) || 0;
        const { data: batch, error: bErr } = await supabase
          .from("batches")
          .insert({
            product_id: product.id,
            batch_number: line.batch || null,
            expiry_date: line.expiry || null,
            purchase_price: price,
            quantity_base_units: qty,
            remaining_quantity: qty,
            supplier_id: supplierId || null,
          })
          .select("id")
          .single();
        if (bErr) throw bErr;

        const { error: iErr } = await supabase.from("purchase_items").insert({
          purchase_order_id: po.id,
          product_id: product.id,
          batch_id: batch.id,
          quantity_base_units: qty,
          unit_price: price,
          gst_percent: Number(line.gst) || 0,
          total_amount: round2(qty * price * (1 + Number(line.gst || 0) / 100)),
        });
        if (iErr) throw iErr;

        const { error: mErr } = await supabase.from("stock_movements").insert({
          product_id: product.id,
          batch_id: batch.id,
          type: "PURCHASE" as never,
          quantity: qty,
          reference_id: po.id,
          note: invoiceNumber || "Purchase",
        });
        if (mErr) throw mErr;

        const { error: pErr } = await supabase
          .from("products")
          .update({
            current_stock: Number(product.current_stock) + qty,
            purchase_price: price || product.purchase_price,
          })
          .eq("id", product.id);
        if (pErr) throw pErr;
      }

      if (supplierId) {
        const supplier = suppliers.find((s) => s.id === supplierId);
        if (supplier) {
          await supabase
            .from("suppliers")
            .update({
              outstanding_balance: round2(
                Number(supplier.outstanding_balance) + (grandTotal - paid),
              ),
            })
            .eq("id", supplierId);
        }
      }
    },
    onSuccess: () => {
      toast.success("Purchase recorded and stock updated");
      setOpen(false);
      setLines([{ ...blankLine }]);
      setInvoiceNumber("");
      setAmountPaid("");
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <PageShell>
      <PageHeader
        title="Purchases"
        subtitle="Record supplier invoices — stock, batches and payables update automatically"
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> New purchase
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        {orders.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            title="No purchases recorded"
            description="Enter a supplier invoice to bring stock in."
            action={<Button onClick={() => setOpen(true)}>Record purchase</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.invoice_number ?? "—"}</TableCell>
                  <TableCell className="text-sm font-medium">
                    {(o.suppliers as { name?: string } | null)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">{dateLabel(o.invoice_date)}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {rupees(Number(o.sub_total))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {rupees(Number(o.total_gst))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {rupees(Number(o.grand_total))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm text-destructive">
                    {rupees(Number(o.grand_total) - Number(o.amount_paid))}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{o.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New purchase entry</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Supplier
              </Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Invoice no.
              </Label>
              <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Date</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Amount paid
              </Label>
              <Input
                type="number"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[2fr_repeat(5,1fr)_auto]">
                <Select
                  value={line.productId}
                  onValueChange={(v) => {
                    const p = products.find((x) => x.id === v);
                    setLine(i, {
                      productId: v,
                      price: p ? String(p.purchase_price) : line.price,
                      gst: p ? String(p.gst_percent) : line.gst,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Product" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Qty (base)"
                  type="number"
                  value={line.qty}
                  onChange={(e) => setLine(i, { qty: e.target.value })}
                />
                <Input
                  placeholder="Rate"
                  type="number"
                  value={line.price}
                  onChange={(e) => setLine(i, { price: e.target.value })}
                />
                <Input
                  placeholder="GST %"
                  type="number"
                  value={line.gst}
                  onChange={(e) => setLine(i, { gst: e.target.value })}
                />
                <Input
                  placeholder="Batch no."
                  value={line.batch}
                  onChange={(e) => setLine(i, { batch: e.target.value })}
                />
                <Input
                  type="date"
                  value={line.expiry}
                  onChange={(e) => setLine(i, { expiry: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove line"
                  onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button variant="outline" onClick={() => setLines((p) => [...p, { ...blankLine }])}>
              <Plus className="size-4" /> Add item
            </Button>
          </div>

          <div className="mt-4 flex justify-end gap-8 border-t border-border pt-4 text-sm">
            <span className="text-muted-foreground">
              Taxable <span className="ml-2 font-mono text-foreground">{rupees(subTotal)}</span>
            </span>
            <span className="text-muted-foreground">
              GST <span className="ml-2 font-mono text-foreground">{rupees(totalGst)}</span>
            </span>
            <span className="font-semibold">
              Total <span className="ml-2 font-mono text-primary">{rupees(grandTotal)}</span>
            </span>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save purchase
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
