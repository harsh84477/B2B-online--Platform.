import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  CreditCard,
  Download,
  IndianRupee,
  Package,
  PackageSearch,
  Plus,
  Receipt,
  ShoppingCart,
  Smartphone,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { dashboardOverviewQuery, recentBillsQuery, topProductsQuery } from "@/lib/queries";
import { rupees } from "@/lib/pos";
import { downloadCsv } from "@/lib/export";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — BillingAZ Wholesale POS" },
      {
        name: "description",
        content:
          "Today's sales, profit, collections, monthly performance and low-stock alerts for your wholesale counter.",
      },
      { property: "og:title", content: "Dashboard — BillingAZ" },
      {
        property: "og:description",
        content: "Sales, profit, dues and inventory KPIs for your wholesale business.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

type Tone = "green" | "teal" | "amber" | "red" | "blue";

const TONE: Record<Tone, { bar: string; chip: string }> = {
  green: { bar: "bg-primary", chip: "bg-primary/10 text-primary" },
  teal: { bar: "bg-chart-2", chip: "bg-chart-2/10 text-chart-2" },
  amber: { bar: "bg-warning", chip: "bg-warning/10 text-warning" },
  red: { bar: "bg-destructive", chip: "bg-destructive/10 text-destructive" },
  blue: { bar: "bg-chart-3", chip: "bg-chart-3/10 text-chart-3" },
};

function monthOptions() {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    });
  }
  return out;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function DashboardPage() {
  const { name } = useAuth();
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0]!.value);

  const { data, isLoading } = useQuery(dashboardOverviewQuery(month));
  const { data: recent } = useQuery(recentBillsQuery());
  const { data: top } = useQuery(topProductsQuery());

  const t = data?.today;
  const m = data?.month;
  const o = data?.overall;
  const netProfit = (m?.profit ?? 0) - 0;

  const exportMonth = () => {
    const label = months.find((x) => x.value === month)?.label ?? month;
    downloadCsv(`billingaz-report-${month}.csv`, [
      ["BillingAZ monthly report", label],
      [],
      ["Metric", "Value"],
      ["Total revenue", m?.sales ?? 0],
      ["Total cost", m?.cost ?? 0],
      ["Discounts given", m?.discount ?? 0],
      ["Net profit", m?.profit ?? 0],
      ["Orders", m?.orders ?? 0],
      ["Due bills", m?.dueBills ?? 0],
      ["Due collected", m?.dueCollected ?? 0],
      ["Outstanding from month", m?.dueAmount ?? 0],
      [],
      ["Day", "Sales"],
      ...(data?.daily ?? []).map((d) => [d.day, d.total] as (string | number)[]),
    ]);
  };

  const modeChart = (top ?? []).slice(0, 5).map((p, i) => ({
    name: p.name,
    revenue: p.revenue,
    fill: `var(--chart-${(i % 5) + 1})`,
  }));

  return (
    <main className="mx-auto w-full max-w-[1600px] space-y-8 p-4 lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {greeting()}, <span className="text-primary">{name || "User"}</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening with your business today
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link to="/billing">
              <Plus className="size-4" /> New Bill
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/products">
              <Package className="size-4" /> Add Product
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/customers">
              <UserPlus className="size-4" /> Add Customer
            </Link>
          </Button>
        </div>
      </header>

      <Section title="Today's Performance">
        <Kpi label="Today's Sales" value={rupees(t?.sales ?? 0)} sub="Total sales amount today" icon={IndianRupee} tone="green" loading={isLoading} />
        <Kpi label="Today's Profit" value={rupees(t?.profit ?? 0)} sub="Profit earned today" icon={TrendingUp} tone="green" loading={isLoading} />
        <Kpi label="Today's Cash Collection" value={rupees(t?.cash ?? 0)} sub="Cash payments received today" icon={Banknote} tone="teal" loading={isLoading} />
        <Kpi label="Today's Online Collection" value={rupees(t?.online ?? 0)} sub="UPI/Card payments today" icon={Smartphone} tone="teal" loading={isLoading} />
        <Kpi label="Today's Orders" value={String(t?.orders ?? 0)} sub="Total bills created today" icon={ShoppingCart} tone="teal" loading={isLoading} />
        <Kpi label="Today's Due Bills" value={String(t?.dueBills ?? 0)} sub="Bills created today but not fully paid" icon={AlertTriangle} tone="amber" loading={isLoading} />
        <Kpi label="Today's Due Collection" value={rupees(t?.dueCollected ?? 0)} sub="Payments received today from due invoices" icon={CreditCard} tone="amber" loading={isLoading} />
        <Kpi label="Today's Total Due Amount" value={rupees(t?.dueAmount ?? 0)} sub="Remaining amount from today's due bills" icon={AlertTriangle} tone="red" loading={isLoading} />
      </Section>

      <Section title="Monthly Performance">
        <Kpi label="Monthly Sales" value={rupees(m?.sales ?? 0)} sub="Total sales this month" icon={TrendingUp} tone="green" loading={isLoading} />
        <Kpi label="Monthly Profit" value={rupees(m?.profit ?? 0)} sub="Profit this month" icon={IndianRupee} tone="green" loading={isLoading} />
        <Kpi label="Monthly Orders" value={String(m?.orders ?? 0)} sub="Number of invoices created this month" icon={ShoppingCart} tone="teal" loading={isLoading} />
        <Kpi label="Monthly Due Bills" value={String(m?.dueBills ?? 0)} sub="Unpaid bills from this month" icon={AlertTriangle} tone="amber" loading={isLoading} />
        <Kpi label="Monthly Due Collection" value={rupees(m?.dueCollected ?? 0)} sub="Payments collected this month from due bills" icon={CreditCard} tone="amber" loading={isLoading} />
        <Kpi label="Monthly Total Due Amount" value={rupees(m?.dueAmount ?? 0)} sub="Remaining amount from this month's due bills" icon={AlertTriangle} tone="red" loading={isLoading} />
      </Section>

      <Section title="Overall Operations">
        <Kpi label="Total Customers" value={String(o?.customers ?? 0)} sub="Total registered customers" icon={Users} tone="teal" loading={isLoading} />
        <Kpi label="Inventory Value" value={rupees(o?.inventoryValue ?? 0)} sub="Total value of stock" icon={Package} tone="amber" loading={isLoading} />
        <Kpi label="Total Due Amount" value={rupees(o?.totalDue ?? 0)} sub="Outstanding payments" icon={AlertTriangle} tone="amber" loading={isLoading} />
        <Kpi label="Draft Bills" value={String(o?.draftBills ?? 0)} sub="Bills saved but not finalized" icon={ShoppingCart} tone="amber" loading={isLoading} />
        <Kpi label="Low Stock Items" value={String(o?.lowStock ?? 0)} sub="Products below minimum stock" icon={PackageSearch} tone="red" loading={isLoading} />
      </Section>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" /> Monthly Report
            </CardTitle>
            <p className="text-sm text-muted-foreground">Revenue, costs, and profit summary</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((x) => (
                  <SelectItem key={x.value} value={x.value}>
                    {x.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportMonth}>
              <Download className="size-4" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Stat label="Total Revenue" value={rupees(m?.sales ?? 0)} note={`${m?.orders ?? 0} orders`} tone="text-primary" />
            <Stat label="Total Cost" value={rupees(m?.cost ?? 0)} note="Product costs" tone="text-warning" />
            <Stat label="Discounts Given" value={rupees(m?.discount ?? 0)} note="Total discounts" tone="text-destructive" />
            <Stat
              label="Net Profit"
              value={rupees(netProfit)}
              note={m?.sales ? `${((netProfit / m.sales) * 100).toFixed(1)}% margin` : "No sales"}
              tone={netProfit >= 0 ? "text-primary" : "text-destructive"}
            />
          </div>

          <ChartContainer
            config={{ total: { label: "Sales", color: "var(--chart-1)" } }}
            className="h-[220px] w-full"
          >
            <BarChart data={data?.daily ?? []}>
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} width={60} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" /> Low Stock Alerts
            </CardTitle>
            <p className="text-sm text-muted-foreground">Products that need restocking</p>
          </CardHeader>
          <CardContent>
            {data?.lowStockItems.length ? (
              <ul className="divide-y divide-border">
                {data.lowStockItems.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="truncate">{p.name}</span>
                    <Badge variant="outline" className="num shrink-0">
                      {p.current_stock} / {p.min_stock_alert}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                All products are well stocked!
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="size-5 text-primary" /> Recent Bills
            </CardTitle>
            <p className="text-sm text-muted-foreground">Latest billing activity</p>
          </CardHeader>
          <CardContent className="p-0">
            {recent?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2">Invoice</th>
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Mode</th>
                      <th className="px-4 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((b) => (
                      <tr key={b.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2 font-medium num">{b.invoice_number}</td>
                        <td className="px-4 py-2">{b.customer_name ?? "Walk-in"}</td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary">{b.payment_mode}</Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold num">
                          {rupees(Number(b.grand_total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">No bills yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {modeChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top products (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            <ChartContainer
              config={{ revenue: { label: "Revenue", color: "var(--chart-2)" } }}
              className="h-[240px] w-full"
            >
              <BarChart data={modeChart} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={5} />
              </BarChart>
            </ChartContainer>
            <ChartContainer config={{}} className="h-[240px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie data={modeChart} dataKey="revenue" nameKey="name" innerRadius={50}>
                  {modeChart.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon: Icon,
  tone,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
  loading?: boolean;
}) {
  const t = TONE[tone];
  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <span className={cn("absolute inset-x-0 top-0 h-1", t.bar)} />
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", t.chip)}>
            <Icon className="size-4" />
          </span>
        </div>
        {loading ? (
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-2xl font-extrabold num">{value}</p>
        )}
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-extrabold num", tone)}>{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}
