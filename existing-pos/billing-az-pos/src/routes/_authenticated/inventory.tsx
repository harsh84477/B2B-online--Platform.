import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, AlertTriangle, CalendarClock, SlidersHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { allProductsQuery, batchesQuery, stockMovementsQuery } from "@/lib/admin-queries";
import { formatQty, rupees } from "@/lib/pos";
import { dateLabel, dateTimeLabel } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — BillingAZ Wholesale POS" },
      {
        name: "description",
        content:
          "Live stock in case/piece units, low-stock alerts, batch expiry tracking and stock adjustments.",
      },
      { property: "og:title", content: "Inventory — BillingAZ" },
      { property: "og:description", content: "Batch-wise wholesale stock control with FIFO." },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(allProductsQuery());
  const { data: batches = [] } = useQuery(batchesQuery());
  const { data: movements = [] } = useQuery(stockMovementsQuery());
  const [search, setSearch] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [type, setType] = useState("ADJUSTMENT");
  const [note, setNote] = useState("");
  const [demoOpen, setDemoOpen] = useState(false);

  const demoInventory = useMutation({
    mutationFn: async (action: "seed" | "clear") => {
      const demoCategoryNames = ["Demo Grocery", "Demo Beverages", "Demo Household"];
      const demoSkuPrefixes = ["DEMO-", "SPI", "RIC", "PUL", "OIL", "BIS", "SOA", "SHA", "DAI", "CLD", "SNA"];

      if (action === "clear") {
        const [{ data: existingProducts, error: productsError }, { data: existingCategories, error: categoriesError }] =
          await Promise.all([
            supabase.from("products").select("id,sku,category_id"),
            supabase.from("categories").select("id,name").in("name", demoCategoryNames),
          ]);
        if (productsError) throw productsError;
        if (categoriesError) throw categoriesError;

        const categoryIds = new Set((existingCategories ?? []).map((category) => category.id));
        const demoProducts = (existingProducts ?? []).filter(
          (product) =>
            categoryIds.has(product.category_id) ||
            demoSkuPrefixes.some((prefix) => product.sku.toUpperCase().startsWith(prefix)),
        );
        if (demoProducts.length > 0) {
          const { error } = await supabase
            .from("products")
            .delete()
            .in("id", demoProducts.map((product) => product.id));
          if (error) throw error;
        }
        if (categoryIds.size > 0) {
          const { error } = await supabase
            .from("categories")
            .delete()
            .in("id", [...categoryIds]);
          if (error) throw error;
        }
        return demoProducts.length;
      }

      const categoryRows = await Promise.all(
        demoCategoryNames.map(async (name, index) => {
          const { data, error } = await supabase
            .from("categories")
            .upsert({ name, sort_order: 90 + index, is_active: true }, { onConflict: "name" })
            .select("id")
            .single();
          if (error) throw error;
          return { name, id: data.id };
        }),
      );
      const categoryId = (name: string) => categoryRows.find((category) => category.name === name)?.id ?? null;
      const demoProducts = [
        ["Demo Rice 5kg", "DEMO-RICE-001", "Demo Grocery", 420, 520, 460, 540, 5, 40, 10],
        ["Demo Toor Dal 1kg", "DEMO-DAL-001", "Demo Grocery", 120, 155, 135, 165, 5, 60, 12],
        ["Demo Sunflower Oil 1L", "DEMO-OIL-001", "Demo Grocery", 135, 170, 150, 180, 5, 48, 12],
        ["Demo Cola 750ml", "DEMO-COLA-001", "Demo Beverages", 30, 42, 36, 45, 28, 72, 24],
        ["Demo Mineral Water 1L", "DEMO-WATER-001", "Demo Beverages", 12, 20, 16, 20, 18, 96, 24],
        ["Demo Laundry Soap", "DEMO-SOAP-001", "Demo Household", 28, 38, 32, 42, 18, 50, 12],
      ] as const;
      const { error } = await supabase.from("products").upsert(
        demoProducts.map(([name, sku, category, purchase, selling, wholesale, mrp, gst, stock, alert]) => ({
          name,
          sku,
          category_id: categoryId(category),
          brand: "Demo Brand",
          purchase_price: purchase,
          selling_price: selling,
          wholesale_price: wholesale,
          mrp,
          gst_percent: gst,
          base_unit: "PIECE" as const,
          pack_name: "Case",
          pack_size: 12,
          current_stock: stock,
          min_stock_alert: alert,
          allow_piece_sale: true,
          allow_pack_sale: true,
          is_active: true,
          is_deleted: false,
        })),
        { onConflict: "sku" },
      );
      if (error) throw error;
      return demoProducts.length;
    },
    onSuccess: (count, action) => {
      setDemoOpen(false);
      toast.success(action === "seed" ? `${count} demo products added` : "Demo inventory removed");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
    },
    onError: (error: Error) => toast.error(`Demo inventory failed: ${error.message}`),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, search]);

  const lowStock = products.filter((p) => p.current_stock <= p.min_stock_alert);
  const stockValue = products.reduce(
    (s, p) => s + Number(p.purchase_price) * Number(p.current_stock),
    0,
  );
  const soon = new Date();
  soon.setDate(soon.getDate() + 90);
  const expiring = batches.filter(
    (b) => b.expiry_date && new Date(b.expiry_date) <= soon,
  );

  const adjust = useMutation({
    mutationFn: async () => {
      const delta = Math.trunc(Number(qty));
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error("Select a product");
      if (!delta) throw new Error("Enter a non-zero quantity");
      const signed = type === "DAMAGE" ? -Math.abs(delta) : delta;
      const { error } = await supabase.from("stock_movements").insert({
        product_id: product.id,
        type: type as never,
        quantity: signed,
        note: note || null,
      });
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("products")
        .update({ current_stock: Number(product.current_stock) + signed })
        .eq("id", product.id);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Stock updated");
      setAdjustOpen(false);
      setQty("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock_movements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageShell>
      <PageHeader
        title="Inventory"
        subtitle="Stock is always stored in base units — case/piece is display only"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDemoOpen(true)}>
              <Sparkles className="size-4" /> Demo inventory
            </Button>
            <Button onClick={() => setAdjustOpen(true)}>
              <SlidersHorizontal className="size-4" /> Stock adjustment
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Stock value (at cost)" value={rupees(stockValue)} icon={Boxes} />
        <StatCard label="Low stock items" value={String(lowStock.length)} icon={AlertTriangle} />
        <StatCard
          label="Batches expiring in 90 days"
          value={String(expiring.length)}
          icon={CalendarClock}
        />
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="low">Low stock</TabsTrigger>
          <TabsTrigger value="batches">Batches &amp; expiry</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products"
            className="mb-4 max-w-md"
          />
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead className="text-right">Base units</TableHead>
                  <TableHead className="text-right">Alert at</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.sku}</p>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatQty(p.current_stock, p.pack_size, p.pack_name, p.base_unit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {p.current_stock}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {p.min_stock_alert}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rupees(Number(p.purchase_price) * Number(p.current_stock))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="low" className="mt-4">
          <Card className="overflow-hidden p-0">
            {lowStock.length === 0 ? (
              <EmptyState icon={Boxes} title="Everything is well stocked" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">In stock</TableHead>
                    <TableHead className="text-right">Alert at</TableHead>
                    <TableHead className="text-right">Shortfall</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStock.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-destructive">
                        {p.current_stock}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {p.min_stock_alert}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {Math.max(0, p.min_stock_alert - p.current_stock)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="batches" className="mt-4">
          <Card className="overflow-hidden p-0">
            {batches.length === 0 ? (
              <EmptyState
                icon={CalendarClock}
                title="No open batches"
                description="Batches are created when you record a purchase."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => {
                    const exp = b.expiry_date ? new Date(b.expiry_date) : null;
                    const near = exp ? exp <= soon : false;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">
                          {(b.products as { name?: string } | null)?.name ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {b.batch_number ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {exp ? (
                            <Badge variant={near ? "destructive" : "secondary"}>
                              {dateLabel(exp)}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {b.remaining_quantity}/{b.quantity_base_units}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {rupees(Number(b.purchase_price))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="movements" className="mt-4">
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">{dateTimeLabel(m.created_at)}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {(m.products as { name?: string } | null)?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{m.type}</Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm ${
                        m.quantity < 0 ? "text-destructive" : "text-primary"
                      }`}
                    >
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.note ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={demoOpen} onOpenChange={setDemoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Demo inventory</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Do you want to add demo products and categories so you can test the system? Choose No to
            remove demo inventory without adding anything.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={demoInventory.isPending}
              onClick={() => demoInventory.mutate("clear")}
            >
              No, remove demo data
            </Button>
            <Button disabled={demoInventory.isPending} onClick={() => demoInventory.mutate("seed")}>
              Yes, add demo inventory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Stock adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Product
              </Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["ADJUSTMENT", "OPENING_STOCK", "DAMAGE", "PURCHASE_RETURN"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Quantity in base units (negative to reduce)
              </Label>
              <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Note</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button disabled={adjust.isPending} onClick={() => adjust.mutate()}>
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Boxes;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
