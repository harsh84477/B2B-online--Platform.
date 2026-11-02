import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Search, Printer, FileText, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, PageShell, EmptyState } from "@/components/page";
import { billDetailQuery, billsQuery } from "@/lib/admin-queries";
import { shopProfileQuery } from "@/lib/queries";
import { paymentLabel, rupees } from "@/lib/pos";
import { dateTimeLabel, downloadCsv, monthStartIso, todayIso } from "@/lib/export";
import { openInvoicePdf, printInvoiceBySettings, printPaperSavingReceipt, type PrintPayload } from "@/lib/print";
import type { CartLine } from "@/lib/bill";
import { useAuth } from "@/lib/auth";
import { settingsQuery } from "@/lib/settings-store";

export const Route = createFileRoute("/_authenticated/invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — BillingAZ Wholesale POS" },
      {
        name: "description",
        content: "Search past GST invoices, reprint 80mm receipts, download PDFs and track dues.",
      },
      { property: "og:title", content: "Invoices — BillingAZ" },
      { property: "og:description", content: "Full sales invoice history with reprint and PDF." },
    ],
  }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const { data: bills = [] } = useQuery(billsQuery());
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const [viewId, setViewId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills.filter((b) => {
      const day = b.invoice_date.slice(0, 10);
      if (day < from || day > to) return false;
      if (!q) return true;
      return (
        b.invoice_number.toLowerCase().includes(q) ||
        (b.customer_name ?? "").toLowerCase().includes(q) ||
        (b.customer_mobile ?? "").includes(q)
      );
    });
  }, [bills, search, from, to]);

  const total = filtered.reduce((s, b) => s + Number(b.grand_total), 0);
  const due = filtered.reduce((s, b) => s + Number(b.amount_due), 0);

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("bills")
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice cancelled");
      qc.invalidateQueries({ queryKey: ["bills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell>
      <PageHeader
        title="Invoices"
        subtitle={`${filtered.length} invoices · ${rupees(total)} billed · ${rupees(due)} due`}
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv("invoices.csv", [
                ["Invoice", "Date", "Customer", "Total", "Paid", "Due", "Mode", "Status"],
                ...filtered.map((b) => [
                  b.invoice_number,
                  b.invoice_date,
                  b.customer_name ?? "",
                  b.grand_total,
                  b.amount_paid,
                  b.amount_due,
                  b.payment_mode,
                  b.payment_status,
                ]),
              ])
            }
          >
            Export
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice no., customer or mobile"
            className="pl-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices found"
            description="Try a wider date range or a different search."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-xs font-semibold">
                    {b.invoice_number}
                  </TableCell>
                  <TableCell className="text-sm">{dateTimeLabel(b.invoice_date)}</TableCell>
                  <TableCell className="text-sm">{b.customer_name ?? "Walk-in"}</TableCell>
                  <TableCell className="text-sm">{paymentLabel(b.payment_mode)}</TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {rupees(Number(b.grand_total))}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {Number(b.amount_due) > 0 ? (
                      <span className="text-destructive">{rupees(Number(b.amount_due))}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={b.payment_status === "PAID" ? "secondary" : "destructive"}
                    >
                      {b.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="View invoice"
                      onClick={() => setViewId(b.id)}
                    >
                      <Eye className="size-4" />
                    </Button>
                    {role === "ADMIN" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Cancel invoice"
                        onClick={() => {
                          if (confirm(`Cancel ${b.invoice_number}?`)) softDelete.mutate(b.id);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <InvoiceDialog billId={viewId} onClose={() => setViewId(null)} />
    </PageShell>
  );
}

function InvoiceDialog({ billId, onClose }: { billId: string | null; onClose: () => void }) {
  const { data } = useQuery(billDetailQuery(billId));
  const { data: shop } = useQuery(shopProfileQuery());
  const { data: invoiceSettings = {} } = useQuery(settingsQuery("invoice"));
  const { data: printSettings = {} } = useQuery(settingsQuery("print"));
  const bill = data?.bill;

  const payload: PrintPayload | null = bill
    ? {
        invoiceNumber: bill.invoice_number,
        date: new Date(bill.invoice_date),
        customerName: bill.customer_name ?? "Walk-in",
        customerMobile: bill.customer_mobile,
        customerGstin: bill.customer_gstin,
        customerAddress: bill.customer_address,
        paymentMode: bill.payment_mode,
        amountPaid: Number(bill.amount_paid),
        amountDue: Number(bill.amount_due),
        shop: shop ?? null,
        printSettings: {
          ...printSettings,
          print_type: printSettings.print_type ?? "thermal",
          thermal_width: printSettings.thermal_width ?? "80mm",
          template_id: printSettings.template_id ?? "modern-retail",
          theme_color: printSettings.theme_color ?? "Blue",
          custom_theme_color: printSettings.custom_theme_color ?? "#2563eb",
        },
        lines: (data?.items ?? []).map(
          (i) =>
            ({
              product: {
                id: i.product_id ?? i.id,
                name: i.product_name,
                sku: i.sku ?? "",
                gst_percent: Number(i.gst_percent),
                pack_size: Number(i.pack_size),
                pack_name: i.pack_name ?? "Case",
                base_unit: "PIECE",
              },
              quantity: Number(i.quantity),
              unitPrice: Number(i.unit_price),
              discountPercent: Number(i.discount_percent),
            }) as unknown as CartLine,
        ),
      }
    : null;

  return (
    <Dialog open={!!billId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice {bill?.invoice_number}</DialogTitle>
        </DialogHeader>
        {bill && (
          <>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p className="text-muted-foreground">
                Customer:{" "}
                <span className="font-medium text-foreground">
                  {bill.customer_name ?? "Walk-in"}
                </span>
              </p>
              <p className="text-muted-foreground">
                Date:{" "}
                <span className="font-medium text-foreground">
                  {dateTimeLabel(bill.invoice_date)}
                </span>
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.items ?? []).map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="text-sm font-medium">{i.product_name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{i.quantity}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rupees(Number(i.unit_price))}
                    </TableCell>
                    <TableCell className="text-right text-sm">{i.gst_percent}%</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rupees(Number(i.total_amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">
                Taxable <span className="ml-3 font-mono text-foreground">{rupees(Number(bill.sub_total) - Number(bill.total_discount))}</span>
              </span>
              <span className="text-muted-foreground">
                GST <span className="ml-3 font-mono text-foreground">{rupees(Number(bill.total_gst))}</span>
              </span>
              <span className="text-base font-semibold">
                Grand total{" "}
                <span className="ml-3 font-mono text-primary">
                  {rupees(Number(bill.grand_total))}
                </span>
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => payload && printInvoiceBySettings(payload, payload.printSettings)}>
                <Printer className="size-4" /> Print
              </Button>
              {invoiceSettings.invoice_template === "PAPER_SAVING" && (
                <Button variant="outline" onClick={() => payload && printPaperSavingReceipt(payload)}>
                  <Printer className="size-4" /> Paper Saving
                </Button>
              )}
              <Button onClick={() => payload && openInvoicePdf(payload, payload.printSettings)}>
                <FileText className="size-4" /> PDF
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
