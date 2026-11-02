import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, PageShell } from "@/components/page";
import { salesRangeQuery } from "@/lib/admin-queries";
import { paymentLabel, rupees } from "@/lib/pos";
import { dateLabel, downloadCsv, monthStartIso, todayIso } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — BillingAZ Wholesale POS" },
      {
        name: "description",
        content:
          "Sales summary, GST slab-wise tax report, day-wise trends, top products and payment-mode splits.",
      },
      { property: "og:title", content: "Reports — BillingAZ" },
      { property: "og:description", content: "GST-ready wholesale sales reporting with CSV export." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const [from, setFrom] = useState(monthStartIso());
  const [to, setTo] = useState(todayIso());
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T23:59:59.999Z`;
  const { data } = useQuery(salesRangeQuery(fromIso, toIso));

  const bills = data?.bills ?? [];
  const items = data?.items ?? [];

  const totals = useMemo(() => {
    const revenue = bills.reduce((s, b) => s + Number(b.grand_total), 0);
    const taxable = bills.reduce(
      (s, b) => s + Number(b.sub_total) - Number(b.total_discount),
      0,
    );
    const gst = bills.reduce((s, b) => s + Number(b.total_gst), 0);
    const due = bills.reduce((s, b) => s + Number(b.amount_due), 0);
    return { revenue, taxable, gst, due, count: bills.length };
  }, [bills]);

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bills) {
      const key = b.invoice_date.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + Number(b.grand_total));
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, value]) => ({ day: day.slice(5), value: Math.round(value) }));
  }, [bills]);

  const gstSlabs = useMemo(() => {
    const map = new Map<number, { taxable: number; cgst: number; sgst: number }>();
    for (const i of items) {
      const slab = Number(i.gst_percent);
      const cur = map.get(slab) ?? { taxable: 0, cgst: 0, sgst: 0 };
      cur.taxable += Number(i.taxable_amount);
      cur.cgst += Number(i.cgst);
      cur.sgst += Number(i.sgst);
      map.set(slab, cur);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [items]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const i of items) {
      const cur = map.get(i.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += Number(i.quantity);
      cur.revenue += Number(i.total_amount);
      map.set(i.product_name, cur);
    }
    return [...map.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 20);
  }, [items]);

  const byMode = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bills) {
      map.set(b.payment_mode, (map.get(b.payment_mode) ?? 0) + Number(b.grand_total));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [bills]);

  return (
    <PageShell>
      <PageHeader
        title="Reports"
        subtitle="GST-ready summaries for any date range"
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(`sales-${from}-to-${to}.csv`, [
                ["Invoice", "Date", "Customer", "Taxable", "GST", "Total", "Mode"],
                ...bills.map((b) => [
                  b.invoice_number,
                  b.invoice_date,
                  b.customer_name ?? "",
                  Number(b.sub_total) - Number(b.total_discount),
                  b.total_gst,
                  b.grand_total,
                  b.payment_mode,
                ]),
              ])
            }
          >
            <Download className="size-4" /> Export sales
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Invoices" value={String(totals.count)} />
        <Kpi label="Revenue" value={rupees(totals.revenue)} accent />
        <Kpi label="Taxable value" value={rupees(totals.taxable)} />
        <Kpi label="GST collected" value={rupees(totals.gst)} />
        <Kpi label="Outstanding" value={rupees(totals.due)} />
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Day-wise</TabsTrigger>
          <TabsTrigger value="gst">GST summary</TabsTrigger>
          <TabsTrigger value="products">Top products</TabsTrigger>
          <TabsTrigger value="modes">Payment modes</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4 space-y-6">
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <BarChart3 className="size-4 text-primary" /> Daily sales
              </h2>
              <ChartContainer config={{ value: { label: "Sales", color: "var(--chart-1)" } }} className="h-64 w-full">
                <ResponsiveContainer>
                  <BarChart data={daily}>
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} width={60} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.invoice_number}</TableCell>
                    <TableCell className="text-sm">{dateLabel(b.invoice_date)}</TableCell>
                    <TableCell className="text-sm">{b.customer_name ?? "Walk-in"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rupees(Number(b.sub_total) - Number(b.total_discount))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rupees(Number(b.total_gst))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {rupees(Number(b.grand_total))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="gst" className="mt-4">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GST slab</TableHead>
                  <TableHead className="text-right">Taxable value</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">Total tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gstSlabs.map(([slab, v]) => (
                  <TableRow key={slab}>
                    <TableCell className="font-medium">{slab}%</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rupees(v.taxable)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{rupees(v.cgst)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{rupees(v.sgst)}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold">
                      {rupees(v.cgst + v.sgst)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <div className="mt-3">
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(`gst-${from}-to-${to}.csv`, [
                  ["Slab %", "Taxable", "CGST", "SGST", "Total tax"],
                  ...gstSlabs.map(([slab, v]) => [
                    slab,
                    v.taxable.toFixed(2),
                    v.cgst.toFixed(2),
                    v.sgst.toFixed(2),
                    (v.cgst + v.sgst).toFixed(2),
                  ]),
                ])
              }
            >
              <Download className="size-4" /> Export GST report
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map(([name, v]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{v.qty}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                      {rupees(v.revenue)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="modes" className="mt-4">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment mode</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byMode.map(([mode, value]) => (
                  <TableRow key={mode}>
                    <TableCell className="font-medium">{paymentLabel(mode)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{rupees(value)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {totals.revenue ? Math.round((value / totals.revenue) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`mt-1 text-xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
