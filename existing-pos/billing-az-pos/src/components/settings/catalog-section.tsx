import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Merge, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmButton, GroupGrid, SelectField, SettingsCard, TextField } from "./kit";
import { categoriesQuery } from "@/lib/queries";
import { allProductsQuery } from "@/lib/admin-queries";
import { downloadCsv, parseProductFile, type ProductImportRow } from "@/lib/export";

interface CategoryRow {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export function CatalogSection({ canEdit }: { canEdit: boolean }) {
  return (
    <Tabs defaultValue="categories">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="products">Products</TabsTrigger>
      </TabsList>
      <TabsContent value="categories" className="mt-5">
        <CategoriesTab canEdit={canEdit} />
      </TabsContent>
      <TabsContent value="products" className="mt-5">
        <ProductsTab canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}

function CategoriesTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: products = [] } = useQuery(allProductsQuery());
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [mergeInto, setMergeInto] = useState("");

  const rows = useMemo(
    () =>
      (categories as unknown as CategoryRow[]).filter((c) =>
        c.name.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [categories, q],
  );
  const countFor = (id: string) => products.filter((p) => p.category_id === id).length;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Enter a category name");
      const { error } = await supabase
        .from("categories")
        .insert({ name: name.trim(), sort_order: categories.length + 1 });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category added");
      setName("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (row: CategoryRow) => {
      const { error } = await supabase
        .from("categories")
        .update({ name: row.name, sort_order: row.sort_order, is_active: row.is_active })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category updated");
      setEditing(null);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function remove(row: CategoryRow) {
    if (countFor(row.id) > 0) {
      toast.error("Move or merge its products first");
      return;
    }
    const { error } = await supabase.from("categories").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Category deleted");
      refresh();
    }
  }

  async function merge(from: CategoryRow) {
    if (!mergeInto) {
      toast.error("Pick a target category");
      return;
    }
    const { error } = await supabase.from("products").update({ category_id: mergeInto }).eq("category_id", from.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("categories").delete().eq("id", from.id);
    toast.success("Categories merged");
    setMergeInto("");
    refresh();
  }

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Categories"
        description="Used by the billing product browser and reports."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                "categories.csv",
                [["Name", "Sort order", "Products", "Status"], ...rows.map((c) => [c.name, c.sort_order, countFor(c.id), c.is_active ? "Active" : "Inactive"])],
              )
            }
          >
            <Download className="size-4" /> Export
          </Button>
        }
      >
        <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search categories" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Input className="w-44" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={() => add.mutate()}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Sort</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.sort_order}</TableCell>
                  <TableCell>{countFor(c.id)}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>{c.is_active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing({ ...c })}>
                          <Pencil className="size-4" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Merge">
                              <Merge className="size-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Merge “{c.name}” into…</DialogTitle>
                            </DialogHeader>
                            <SelectField
                              label="Target category"
                              value={mergeInto}
                              options={rows.filter((x) => x.id !== c.id).map((x) => ({ value: x.id, label: x.name }))}
                              onChange={setMergeInto}
                            />
                            <DialogFooter>
                              <Button onClick={() => merge(c)}>Merge</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <ConfirmButton
                          label=""
                          icon={<Trash2 className="size-4" />}
                          title={`Delete ${c.name}?`}
                          description="Categories with products cannot be deleted."
                          onConfirm={() => remove(c)}
                          destructive
                        />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SettingsCard>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
          </DialogHeader>
          {editing && (
            <GroupGrid columns={2}>
              <TextField label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
              <TextField
                label="Sort order"
                type="number"
                value={editing.sort_order}
                onChange={(v) => setEditing({ ...editing, sort_order: Number(v) || 0 })}
              />
              <SelectField
                label="Status"
                value={editing.is_active ? "1" : "0"}
                options={[{ value: "1", label: "Active" }, { value: "0", label: "Inactive" }]}
                onChange={(v) => setEditing({ ...editing, is_active: v === "1" })}
              />
            </GroupGrid>
          )}
          <DialogFooter>
            <Button onClick={() => editing && update.mutate(editing)}>Save category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductsTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(allProductsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [stock, setStock] = useState("ALL");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulk, setBulk] = useState({ pricePercent: "", gst: "", category: "" });
  const [importRows, setImportRows] = useState<ProductImportRow[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return products.filter((p) => {
      if (term && ![p.name, p.sku, p.barcode ?? "", p.brand ?? ""].some((f) => String(f).toLowerCase().includes(term)))
        return false;
      if (category !== "ALL" && p.category_id !== category) return false;
      if (status === "ACTIVE" && !p.is_active) return false;
      if (status === "INACTIVE" && p.is_active) return false;
      if (stock === "LOW" && p.current_stock > p.min_stock_alert) return false;
      if (stock === "OUT" && p.current_stock > 0) return false;
      return true;
    });
  }, [products, q, category, status, stock]);

  const allSelected = rows.length > 0 && selected.length === rows.length;
  const refresh = () => qc.invalidateQueries({ queryKey: ["products"] });

  async function bulkUpdate(patch: Record<string, unknown>, label: string) {
    if (!selected.length) {
      toast.error("Select products first");
      return;
    }
    const { error } = await supabase.from("products").update(patch as never).in("id", selected);
    if (error) toast.error(error.message);
    else {
      toast.success(`${label} applied to ${selected.length} product(s)`);
      setSelected([]);
      refresh();
    }
  }

  async function bulkPrice() {
    const pct = Number(bulk.pricePercent);
    if (!pct) {
      toast.error("Enter a percentage");
      return;
    }
    const targets = products.filter((p) => selected.includes(p.id));
    await Promise.all(
      targets.map((p) =>
        supabase
          .from("products")
          .update({
            selling_price: Math.round(p.selling_price * (1 + pct / 100) * 100) / 100,
            wholesale_price: Math.round(p.wholesale_price * (1 + pct / 100) * 100) / 100,
          })
          .eq("id", p.id),
      ),
    );
    toast.success(`Prices updated by ${pct}%`);
    setSelected([]);
    refresh();
  }

  function exportRows(kind: "csv" | "sample") {
    const header = ["Name", "SKU", "Category", "Barcode", "Brand", "HSN", "GST%", "Purchase", "Wholesale", "Retail price", "MRP", "Stock", "Status"];
    const body =
      kind === "sample"
        ? [["Sample Product", "SKU001", "General", "8901234567890", "Brand", "1704", "18", "85", "90", "100", "120", "0", "Active"]]
        : rows.map((p) => [
            p.name,
            p.sku,
            categories.find((c) => c.id === p.category_id)?.name ?? "",
            p.barcode ?? "",
            p.brand ?? "",
            p.hsn_code ?? "",
            p.gst_percent,
            p.purchase_price,
            p.wholesale_price,
            p.selling_price,
            p.mrp,
            p.current_stock,
            p.is_active ? "Active" : "Inactive",
          ]);
    downloadCsv(kind === "sample" ? "products-sample.csv" : "products.csv", [header, ...body]);
  }

  async function importRowsFromFile(file: File) {
    const parsed = await parseProductFile(file);
    if (!parsed.length) {
      toast.error("No valid product rows were found in the file.");
      return;
    }
    setImportRows(parsed);
    setImportOpen(true);
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
      setImportOpen(false);
      setImportRows([]);
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <SettingsCard
        title="Products"
        description={`${rows.length} of ${products.length} products match your filters.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportRows("csv")}>
              <Download className="size-4" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportRows("sample")}>
              <Upload className="size-4" /> Sample file
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => importInputRef.current?.click()}
            >
              <Upload className="size-4" /> Upload file
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
      >
        <GroupGrid columns={3}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Name, SKU, barcode, brand" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <SelectField
            label=""
            value={category}
            options={[{ value: "ALL", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            onChange={setCategory}
          />
          <SelectField
            label=""
            value={status}
            options={[
              { value: "ALL", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
            onChange={setStatus}
          />
          <SelectField
            label=""
            value={stock}
            options={[
              { value: "ALL", label: "All stock" },
              { value: "LOW", label: "Low stock" },
              { value: "OUT", label: "Out of stock" },
            ]}
            onChange={setStock}
          />
        </GroupGrid>

        {canEdit && selected.length > 0 && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="mb-3 text-sm font-medium">{selected.length} selected — bulk actions</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-end gap-2">
                <TextField label="Price change %" type="number" value={bulk.pricePercent} onChange={(v) => setBulk({ ...bulk, pricePercent: v })} className="flex-1" />
                <Button size="sm" onClick={bulkPrice}>Apply</Button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <SelectField label="Set GST" value={bulk.gst} options={[0, 5, 12, 18, 28].map((n) => ({ value: String(n), label: `${n}%` }))} onChange={(v) => setBulk({ ...bulk, gst: v })} />
                </div>
                <Button size="sm" onClick={() => bulkUpdate({ gst_percent: Number(bulk.gst) }, "GST")}>Apply</Button>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <SelectField label="Set category" value={bulk.category} options={categories.map((c) => ({ value: c.id, label: c.name }))} onChange={(v) => setBulk({ ...bulk, category: v })} />
                </div>
                <Button size="sm" onClick={() => bulkUpdate({ category_id: bulk.category }, "Category")}>Apply</Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Button size="sm" variant="outline" onClick={() => bulkUpdate({ is_active: true }, "Activation")}>Activate</Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdate({ is_active: false }, "Deactivation")}>Deactivate</Button>
                <ConfirmButton
                  variant="destructive"
                  destructive
                  label="Delete"
                  title={`Delete ${selected.length} product(s)?`}
                  description="Products are soft-deleted and hidden from billing; historical invoices keep their data."
                  onConfirm={() => bulkUpdate({ is_deleted: true, is_active: false }, "Deletion")}
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-border">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => setSelected(v ? rows.map((r) => r.id) : [])}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>GST</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(p.id)}
                      aria-label={`Select ${p.name}`}
                      onCheckedChange={(v) =>
                        setSelected((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="block max-w-[240px] truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.brand ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{p.sku}</TableCell>
                  <TableCell>{p.gst_percent}%</TableCell>
                  <TableCell className="text-right">₹{p.mrp}</TableCell>
                  <TableCell className="text-right">{p.current_stock}</TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SettingsCard>

      <Dialog open={importOpen} onOpenChange={(open) => {
        if (!open) {
          setImportOpen(false);
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
            <Button variant="outline" onClick={() => setImportOpen(false)} disabled={isImporting}>
              Cancel
            </Button>
            <Button onClick={() => void confirmImport()} disabled={isImporting}>
              {isImporting ? "Adding..." : "Add all items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
