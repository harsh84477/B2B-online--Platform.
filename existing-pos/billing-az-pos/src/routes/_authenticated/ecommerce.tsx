import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, PageShell } from "@/components/page";
import { UploadField } from "@/components/settings/kit";

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
    </PageShell>
  );
}
