import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Save, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, PageShell } from "@/components/page";
import { UploadField } from "@/components/settings/kit";
import { allProductsQuery } from "@/lib/admin-queries";

export const Route = createFileRoute("/_authenticated/ecommerce")({
  head: () => ({ meta: [{ title: "Manage Ecommerce — BillingAZ Wholesale POS" }] }),
  component: EcommercePage,
});

type EcommerceSettings = {
  id: boolean;
  is_enabled: boolean;
  banner_enabled: boolean;
  banner_title: string;
  banner_subtitle: string;
  banner_image_url: string | null;
};

type OnlinePackOption = {
  id: string;
  product_id: string;
  quantity: number;
  label: string;
  is_enabled: boolean;
  sort_order: number;
};

const defaults: EcommerceSettings = {
  id: true,
  is_enabled: true,
  banner_enabled: true,
  banner_title: "Stock up with confidence.",
  banner_subtitle: "Browse approved wholesale products and send your order to the POS.",
  banner_image_url: null,
};

function EcommercePage() {
  const qc = useQueryClient();
  const [settings, setSettings] = useState(defaults);
  const [newPackProductId, setNewPackProductId] = useState<string | null>(null);
  const [newPackQuantity, setNewPackQuantity] = useState("3");
  const [newPackLabel, setNewPackLabel] = useState("Pack of 3");
  const { data: products = [] } = useQuery(allProductsQuery());
  const packOptionsQuery = useQuery({
    queryKey: ["online-pack-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("online_product_pack_options" as never)
        .select("*")
        .order("product_id")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as OnlinePackOption[];
    },
  });
  const query = useQuery({
    queryKey: ["ecommerce-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ecommerce_settings" as never).select("*").eq("id", true).maybeSingle();
      if (error) throw error;
      return (data as unknown as EcommerceSettings | null) ?? defaults;
    },
  });

  useEffect(() => {
    if (query.data) setSettings(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ecommerce_settings" as never).upsert({ ...settings, updated_at: new Date().toISOString() } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ecommerce settings saved");
      qc.invalidateQueries({ queryKey: ["ecommerce-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const savePackOption = useMutation({
    mutationFn: async ({ option, enabled }: { option: OnlinePackOption; enabled: boolean }) => {
      const { error } = await supabase
        .from("online_product_pack_options" as never)
        .update({ is_enabled: enabled } as never)
        .eq("id", option.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pack option updated");
      qc.invalidateQueries({ queryKey: ["online-pack-options"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleProduct = useMutation({
    mutationFn: async ({ productId, isOnline }: { productId: string; isOnline: boolean }) => {
      const { error } = await supabase.from("products").update({ is_online: isOnline }).eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product visibility updated");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["online-pack-options"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addPackOption = useMutation({
    mutationFn: async ({ productId, quantity, label }: { productId: string; quantity: number; label: string }) => {
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Pack quantity must be a positive whole number.");
      if (!label.trim()) throw new Error("Pack label is required.");
      const { error } = await supabase.from("online_product_pack_options" as never).insert({
        product_id: productId,
        quantity,
        label: label.trim(),
        sort_order: quantity,
        is_enabled: true,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pack option added");
      setNewPackProductId(null);
      setNewPackQuantity("3");
      setNewPackLabel("Pack of 3");
      qc.invalidateQueries({ queryKey: ["online-pack-options"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletePackOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("online_product_pack_options" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pack option removed");
      qc.invalidateQueries({ queryKey: ["online-pack-options"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <PageShell>
      <PageHeader title="Manage Ecommerce" subtitle="Control the retailer storefront without leaving the POS." actions={<Button onClick={() => save.mutate()} disabled={save.isPending}><Save /> Save changes</Button>} />
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-5 p-5">
          <div className="flex items-center gap-3"><Globe className="size-5 text-primary" /><div><h2 className="font-semibold">Storefront controls</h2><p className="text-sm text-muted-foreground">Turn ordering on or off and manage the landing banner.</p></div></div>
          <div className="flex items-center justify-between rounded-lg border p-4"><div><Label>Storefront enabled</Label><p className="text-sm text-muted-foreground">Allow retailers to browse and submit orders.</p></div><Switch checked={settings.is_enabled} onCheckedChange={(value) => setSettings({ ...settings, is_enabled: value })} /></div>
          <div className="flex items-center justify-between rounded-lg border p-4"><div><Label>Show hero banner</Label><p className="text-sm text-muted-foreground">Display the banner on the ecommerce home page.</p></div><Switch checked={settings.banner_enabled} onCheckedChange={(value) => setSettings({ ...settings, banner_enabled: value })} /></div>
          <div className="space-y-2"><Label htmlFor="banner-title">Banner title</Label><Input id="banner-title" value={settings.banner_title} onChange={(event) => setSettings({ ...settings, banner_title: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="banner-subtitle">Banner subtitle</Label><Input id="banner-subtitle" value={settings.banner_subtitle} onChange={(event) => setSettings({ ...settings, banner_subtitle: event.target.value })} /></div>
          <UploadField label="Banner image" hint="Upload a wide PNG or JPG for the storefront" value={settings.banner_image_url ?? ""} onChange={(value) => setSettings({ ...settings, banner_image_url: value || null })} />
        </Card>
        <Card className="p-5"><h2 className="font-semibold">What this controls</h2><ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground"><li>Products marked “Show in ecommerce” appear in the storefront.</li><li>Product images uploaded in Products are shown to retailers.</li><li>Online orders stay pending until an operator accepts or declines them.</li><li>Billing, stock, pricing, and final invoice creation remain in the POS.</li></ul></Card>
      </div>
      <Card className="mt-5 space-y-5 p-5">
        <div className="flex items-center gap-3"><Package className="size-5 text-primary" /><div><h2 className="font-semibold">Products and retailer pack options</h2><p className="text-sm text-muted-foreground">Publish products individually and create different pack choices for every product.</p></div></div>
        <div className="divide-y rounded-lg border">
          {products.filter((product) => product.is_active).map((product) => {
            const options = (packOptionsQuery.data ?? []).filter((option) => option.product_id === product.id);
            return <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" key={product.id}>
              <div className="min-w-48"><p className="font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.sku}</p><label className="mt-2 flex items-center gap-2 text-xs"><Switch checked={product.is_online} onCheckedChange={(isOnline) => toggleProduct.mutate({ productId: product.id, isOnline })} /><span>{product.is_online ? "Visible online" : "Hidden online"}</span></label></div>
              {product.is_online && <div className="flex flex-1 flex-wrap items-center justify-start gap-3 sm:justify-end">
                {options.map((option) => <div className="flex items-center gap-1 rounded-md border px-2 py-1" key={option.id}><label className="flex items-center gap-2 text-sm"><Switch checked={option.is_enabled} onCheckedChange={(enabled) => savePackOption.mutate({ option, enabled })} /><span>{option.label} ({option.quantity})</span></label><Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label={`Delete ${option.label}`} onClick={() => deletePackOption.mutate(option.id)}><Trash2 className="size-3.5" /></Button></div>)}
                {newPackProductId === product.id ? <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto"><div className="space-y-1"><Label className="text-xs">Units</Label><Input className="w-20" type="number" min="1" value={newPackQuantity} onChange={(event) => setNewPackQuantity(event.target.value)} /></div><div className="space-y-1"><Label className="text-xs">Label</Label><Input className="w-36" value={newPackLabel} onChange={(event) => setNewPackLabel(event.target.value)} placeholder="Bag of 10" /></div><Button size="sm" onClick={() => addPackOption.mutate({ productId: product.id, quantity: Number(newPackQuantity), label: newPackLabel })} disabled={addPackOption.isPending}>Save</Button></div> : <Button variant="outline" size="sm" onClick={() => { setNewPackProductId(product.id); setNewPackLabel("Pack of 3"); setNewPackQuantity("3"); }}><Plus className="mr-1 size-4" /> Add pack</Button>}
              </div>}
            </div>;
          })}
          {!packOptionsQuery.isLoading && products.filter((product) => product.is_active).length === 0 && <p className="p-5 text-sm text-muted-foreground">Add an active product in Products to manage ecommerce visibility here.</p>}
        </div>
      </Card>
    </PageShell>
  );
}
