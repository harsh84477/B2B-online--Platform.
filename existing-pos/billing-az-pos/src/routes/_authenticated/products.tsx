import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Search, Pencil, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import { categoriesQuery } from "@/lib/queries";
import { allProductsQuery } from "@/lib/admin-queries";
import { GST_SLABS, formatQty, rupees } from "@/lib/pos";
import { downloadCsv, parseProductFile, type ProductImportRow } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — BillingAZ Wholesale POS" },
      {
        name: "description",
        content:
          "Manage your wholesale catalogue: pack sizes, GST slabs, purchase and wholesale rates, stock alerts.",
      },
      { property: "og:title", content: "Products — BillingAZ" },
      { property: "og:description", content: "Wholesale product catalogue with case/piece pack setup." },
    ],
  }),
  component: ProductsPage,
});

type Draft = Record<string, string | number | boolean | null>;

const emptyDraft: Draft = {
  id: "",
  name: "",
  sku: "",
  barcode: "",
  category_id: "",
  brand: "",
  hsn_code: "",
  purchase_price: 0,
  selling_price: 0,
  wholesale_price: 0,
  mrp: 0,
  gst_percent: 5,
  base_unit: "PIECE",
  pack_name: "Case",
  pack_size: 1,
  allow_piece_sale: true,
  allow_pack_sale: true,
  current_stock: 0,
  min_stock_alert: 10,
  is_active: true,
};

function ProductsPage() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery(allProductsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [importRows, setImportRows] = useState<ProductImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "all" && p.category_id !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [products, search, category]);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const payload = {
        name: String(d['name']).trim(),
        sku: String(d['sku']).trim(),
        barcode: d['barcode'] ? String(d['barcode']) : null,
        category_id: d['category_id'] ? String(d['category_id']) : null,
        brand: d['brand'] ? String(d['brand']) : null,
        hsn_code: d['hsn_code'] ? String(d['hsn_code']) : null,
        purchase_price: Number(d['purchase_price']) || 0,
        selling_price: Number(d['selling_price']) || 0,
        wholesale_price: Number(d['wholesale_price']) || 0,
        mrp: Number(d['mrp']) || 0,
        gst_percent: Number(d['gst_percent']) || 0,
        base_unit: String(d['base_unit']) as never,
        pack_name: String(d['pack_name']) || "Case",
        pack_size: Math.max(1, Number(d['pack_size']) || 1),
        allow_piece_sale: !!d['allow_piece_sale'],
        allow_pack_sale: !!d['allow_pack_sale'],
        current_stock: Math.trunc(Number(d['current_stock']) || 0),
        min_stock_alert: Math.trunc(Number(d['min_stock_alert']) || 0),
        is_active: !!d['is_active'],
      };
      if (!payload.name || !payload.sku) throw new Error("Name and SKU are required");
      if (d['id']) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", String(d['id']));
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Product saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ is_deleted: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product removed");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    downloadCsv("products.csv", [
      ["Name", "SKU", "Category", "Brand", "Pack", "Pack size", "GST %", "Purchase", "Wholesale", "Retail price", "MRP", "Stock"],
      ...filtered.map((p) => [
        p.name,
        p.sku,
        categories.find((c) => c.id === p.category_id)?.name ?? "",
        p.brand ?? "",
        p.pack_name,
        p.pack_size,
        p.gst_percent,
        p.purchase_price,
        p.wholesale_price,
        p.selling_price,
        p.mrp,
        p.current_stock,
      ]),
    ]);
  }

  async function importRowsFromFile(file: File) {
    const parsed = await parseProductFile(file);
    if (!parsed.length) {
      toast.error("No valid product rows were found in the file.");
      return;
    }
    setImportRows(parsed);
    setShowImportDialog(true);
  }

  async function confirmImport() {
    if (!importRows.length) return;
    setIsImporting(true);
    try {
      const tasks = importRows.map(async (row) => {
        let categoryId: string | null = null;
        if (row.category.trim()) {
          const { data: categoryData, error: categoryError } = await supabase
            .from("categories")
            .upsert({ name: row.category.trim(), sort_order: 0, is_active: true }, { onConflict: "name" })
            .select("id")
            .single();
          if (categoryError) throw categoryError;
          categoryId = categoryData?.id ?? null;
        }

        const payload = {
          name: row.name,
          sku: row.sku,
          barcode: row.barcode || null,
          brand: row.brand || null,
          category_id: categoryId,
          hsn_code: row.hsn_code || null,
          purchase_price: Number(row.purchase_price) || 0,
          selling_price: Number(row.selling_price) || 0,
          wholesale_price: Number(row.wholesale_price) || 0,
          mrp: Number(row.mrp) || Number(row.selling_price) || 0,
          gst_percent: Number(row.gst_percent) || 0,
          base_unit: (row.base_unit || "PIECE") as "PIECE" | "KG" | "GRAM" | "LITRE" | "ML" | "BOX" | "BUNDLE",
          pack_name: row.pack_name || "Case",
          pack_size: Math.max(1, Number(row.pack_size) || 1),
          current_stock: Math.max(0, Number(row.current_stock) || 0),
          min_stock_alert: 0,
          allow_piece_sale: true,
          allow_pack_sale: true,
          is_active: row.status === "Active",
          is_deleted: false,
        };

        const { error } = await supabase.from("products").upsert(payload, { onConflict: "sku" });
        if (error) throw error;
      });

      await Promise.all(tasks);
      toast.success(`Imported ${importRows.length} product(s)`);
      setShowImportDialog(false);
      setImportRows([]);
      qc.invalidateQueries({ queryKey: ["products"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Products"
        subtitle={`${products.length} items in the catalogue`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="size-4" /> Export
            </Button>
            <Button variant="outline" onClick={() => importInputRef.current?.click()}>
              <Upload className="size-4" /> Upload file
            </Button>
            <Button onClick={() => setDraft({ ...emptyDraft })}>
              <Plus className="size-4" /> New product
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importRowsFromFile(file);
                event.target.value = "";
              }}
            />
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, SKU or barcode"
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden p-0">
        {filtered.length === 0 && !isLoading ? (
          <EmptyState
            icon={Package}
            title="No products found"
            description="Add your first product to start billing."
            action={<Button onClick={() => setDraft({ ...emptyDraft })}>Add product</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Pack</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Purchase</TableHead>
                <TableHead className="text-right">Wholesale</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const low = p.current_stock <= p.min_stock_alert;
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.sku}
                        {p.brand ? ` · ${p.brand}` : ""}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.pack_name} of {p.pack_size}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={low ? "font-semibold text-destructive" : ""}>
                        {formatQty(p.current_stock, p.pack_size, p.pack_name, p.base_unit)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rupees(Number(p.purchase_price))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold text-primary">
                      {rupees(Number(p.wholesale_price))}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {rupees(Number(p.mrp))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{p.gst_percent}%</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Edit product"
                        onClick={() => setDraft({ ...(p as unknown as Draft) })}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete product"
                        onClick={() => {
                          if (confirm(`Remove ${p.name}?`)) remove.mutate(p.id);
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={showImportDialog} onOpenChange={(open) => {
        if (!open) {
          setShowImportDialog(false);
          setImportRows([]);
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Import products from file</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {importRows.length} item(s) found. Do you want to add all of them to your catalogue?
            </p>
            <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Brand</TableHead>
                    <TableHead className="text-right">Retail</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importRows.slice(0, 15).map((row, index) => (
                    <TableRow key={`${row.sku}-${index}`}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.sku}</TableCell>
                      <TableCell>{row.category || "—"}</TableCell>
                      <TableCell>{row.brand || "—"}</TableCell>
                      <TableCell className="text-right">₹{row.selling_price}</TableCell>
                      <TableCell className="text-right">₹{row.mrp}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={() => void confirmImport()} disabled={isImporting}>
              {isImporting ? "Adding..." : "Add all items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.['id'] ? "Edit product" : "New product"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Product name">
                <Input
                  value={String(draft['name'] ?? "")}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </Field>
              <Field label="SKU">
                <Input
                  value={String(draft['sku'] ?? "")}
                  onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                />
              </Field>
              <Field label="Barcode">
                <Input
                  value={String(draft['barcode'] ?? "")}
                  onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                />
              </Field>
              <Field label="Brand">
                <Input
                  value={String(draft['brand'] ?? "")}
                  onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                />
              </Field>
              <Field label="Category">
                <Select
                  value={String(draft['category_id'] ?? "")}
                  onValueChange={(v) => setDraft({ ...draft, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="HSN code">
                <Input
                  value={String(draft['hsn_code'] ?? "")}
                  onChange={(e) => setDraft({ ...draft, hsn_code: e.target.value })}
                />
              </Field>
              <Field label="Pack name">
                <Input
                  value={String(draft['pack_name'] ?? "")}
                  onChange={(e) => setDraft({ ...draft, pack_name: e.target.value })}
                />
              </Field>
              <Field label="Pieces per pack">
                <Input
                  type="number"
                  value={String(draft['pack_size'] ?? 1)}
                  onChange={(e) => setDraft({ ...draft, pack_size: e.target.value })}
                />
              </Field>
              <Field label="Purchase price">
                <Input
                  type="number"
                  value={String(draft['purchase_price'] ?? 0)}
                  onChange={(e) => setDraft({ ...draft, purchase_price: e.target.value })}
                />
              </Field>
              <Field label="Wholesale price">
                <Input
                  type="number"
                  value={String(draft['wholesale_price'] ?? 0)}
                  onChange={(e) => setDraft({ ...draft, wholesale_price: e.target.value })}
                />
              </Field>
              <Field label="Retail price">
                <Input
                  type="number"
                  value={String(draft['selling_price'] ?? 0)}
                  onChange={(e) => setDraft({ ...draft, selling_price: e.target.value })}
                />
              </Field>
              <Field label="MRP">
                <Input
                  type="number"
                  value={String(draft['mrp'] ?? 0)}
                  onChange={(e) => setDraft({ ...draft, mrp: e.target.value })}
                />
              </Field>
              <Field label="GST slab">
                <Select
                  value={String(draft['gst_percent'] ?? 5)}
                  onValueChange={(v) => setDraft({ ...draft, gst_percent: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GST_SLABS.map((g) => (
                      <SelectItem key={g} value={String(g)}>
                        {g}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Base unit">
                <Select
                  value={String(draft['base_unit'] ?? "PIECE")}
                  onValueChange={(v) => setDraft({ ...draft, base_unit: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["PIECE", "KG", "LITRE", "GRAM", "ML", "BOX", "BUNDLE"].map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Opening / current stock (base units)">
                <Input
                  type="number"
                  value={String(draft['current_stock'] ?? 0)}
                  onChange={(e) => setDraft({ ...draft, current_stock: e.target.value })}
                />
              </Field>
              <Field label="Low stock alert">
                <Input
                  type="number"
                  value={String(draft['min_stock_alert'] ?? 0)}
                  onChange={(e) => setDraft({ ...draft, min_stock_alert: e.target.value })}
                />
              </Field>
              <div className="flex items-center gap-6 sm:col-span-2">
                <ToggleField
                  label="Allow piece sale"
                  checked={!!draft['allow_piece_sale']}
                  onChange={(v) => setDraft({ ...draft, allow_piece_sale: v })}
                />
                <ToggleField
                  label="Allow pack sale"
                  checked={!!draft['allow_pack_sale']}
                  onChange={(v) => setDraft({ ...draft, allow_pack_sale: v })}
                />
                <ToggleField
                  label="Active"
                  checked={!!draft['is_active']}
                  onChange={(v) => setDraft({ ...draft, is_active: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              Save product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}
