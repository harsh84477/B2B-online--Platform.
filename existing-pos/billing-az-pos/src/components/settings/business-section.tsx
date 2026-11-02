import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, MapPin, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  GroupGrid,
  SaveBar,
  SectionSkeleton,
  SelectField,
  SettingsCard,
  TextAreaField,
  TextField,
  UploadField,
} from "./kit";
import { shopProfileQuery } from "@/lib/queries";
import { useSettingsSection } from "@/lib/settings-store";
import type { SettingsValues } from "@/lib/settings-schema";

const BUSINESS_DEFAULTS: SettingsValues = {
  legal_name: "",
  display_name: "",
  business_type: "WHOLESALE",
  logo: "",
  banner: "",
  stamp: "",
  signature: "",
  country: "India",
  state: "",
  city: "",
  district: "",
  pincode: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
  language: "en-IN",
  website: "",
  maps_url: "",
  google_business: "",
  instagram: "",
  facebook: "",
  youtube: "",
  linkedin: "",
  twitter: "",
  pan: "",
  msme: "",
  fssai: "",
  cin: "",
  registration_number: "",
  support_email: "",
  support_phone: "",
  alt_phone: "",
  default_warehouse: "Main store",
  default_salesperson: "",
  working_hours: "09:00 – 21:00",
  weekly_holiday: "SUNDAY",
  financial_year_start: "APRIL",
  opening_date: "",
  notes: "",
  upi_id: "",
  upi_qr: "",
};

const BUSINESS_TYPES = [
  "RETAIL",
  "WHOLESALE",
  "RESTAURANT",
  "MEDICAL",
  "ELECTRONICS",
  "FASHION",
  "GROCERY",
  "HARDWARE",
  "JEWELLERY",
  "SERVICES",
].map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase() }));

type Shop = Record<string, string | number | boolean | null>;

export function BusinessSection({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: shop, isLoading } = useQuery(shopProfileQuery());
  const defaults = useMemo(() => BUSINESS_DEFAULTS, []);
  const ext = useSettingsSection("business", defaults);
  const [form, setForm] = useState<Shop>({});
  const [shopDirty, setShopDirty] = useState(false);

  useEffect(() => {
    if (shop) {
      setForm({ ...(shop as unknown as Shop) });
      setShopDirty(false);
    }
  }, [shop]);

  const saveShop = useMutation({
    mutationFn: async (patch: Shop) => {
      if (!shop?.id) throw new Error("Business profile not initialised");
      const { error } = await supabase.from("shop_profile").update(patch as never).eq("id", shop.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shop_profile"] }),
  });

  if (isLoading || ext.loading) return <SectionSkeleton />;

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setShopDirty(true);
  };
  const val = (k: string) => form[k] ?? "";
  const disabled = !canEdit;

  async function saveAll() {
    try {
      await saveShop.mutateAsync({
        shop_name: val("shop_name"),
        address: val("address"),
        phone: val("phone"),
        email: val("email"),
        gstin: val("gstin"),
        state_code: val("state_code"),
        bank_name: val("bank_name"),
        bank_account: val("bank_account"),
        ifsc: val("ifsc"),
      });
      setShopDirty(false);
      ext.save();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <Tabs defaultValue="identity">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="identity">Identity</TabsTrigger>
          <TabsTrigger value="contact">Contact & address</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="bank">Bank & payments</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="mt-5 space-y-5">
          <SettingsCard title="Branding" description="Used on invoices, receipts and shared documents.">
            <GroupGrid columns={2}>
              <UploadField label="Business logo" value={String(ext.values['logo'] ?? "")} onChange={(v) => ext.set("logo", v)} disabled={disabled} />
              <UploadField label="Business banner" value={String(ext.values['banner'] ?? "")} onChange={(v) => ext.set("banner", v)} disabled={disabled} />
              <UploadField label="Business stamp" value={String(ext.values['stamp'] ?? "")} onChange={(v) => ext.set("stamp", v)} disabled={disabled} />
              <UploadField label="Authorised signature" value={String(ext.values['signature'] ?? "")} onChange={(v) => ext.set("signature", v)} disabled={disabled} />
            </GroupGrid>
          </SettingsCard>

          <SettingsCard title="Names" description="How your business appears across the app and on documents.">
            <GroupGrid columns={3}>
              <TextField label="Business name" value={val("shop_name")} onChange={(v) => set("shop_name", v)} disabled={disabled} />
              <TextField label="Legal business name" value={ext.values['legal_name']} onChange={(v) => ext.set("legal_name", v)} disabled={disabled} />
              <TextField label="Display name" value={ext.values['display_name']} onChange={(v) => ext.set("display_name", v)} disabled={disabled} />
              <SelectField label="Business type" value={ext.values['business_type']} options={BUSINESS_TYPES} onChange={(v) => ext.set("business_type", v)} disabled={disabled} />
              <SelectField
                label="Currency"
                value={ext.values['currency']}
                options={[{ value: "INR", label: "₹ Indian Rupee" }, { value: "USD", label: "$ US Dollar" }, { value: "AED", label: "AED Dirham" }]}
                onChange={(v) => ext.set("currency", v)}
                disabled={disabled}
              />
              <SelectField
                label="Language"
                value={ext.values['language']}
                options={[{ value: "en-IN", label: "English (India)" }, { value: "hi-IN", label: "हिन्दी" }, { value: "ta-IN", label: "தமிழ்" }]}
                onChange={(v) => ext.set("language", v)}
                disabled={disabled}
              />
            </GroupGrid>
          </SettingsCard>

          <PreviewCard shop={form} ext={ext.values} />
        </TabsContent>

        <TabsContent value="contact" className="mt-5 space-y-5">
          <SettingsCard title="Address">
            <GroupGrid columns={3}>
              <TextField label="Country" value={ext.values['country']} onChange={(v) => ext.set("country", v)} disabled={disabled} />
              <TextField label="State" value={ext.values['state']} onChange={(v) => ext.set("state", v)} disabled={disabled} />
              <TextField label="City" value={ext.values['city']} onChange={(v) => ext.set("city", v)} disabled={disabled} />
              <TextField label="District" value={ext.values['district']} onChange={(v) => ext.set("district", v)} disabled={disabled} />
              <TextField label="PIN code" value={ext.values['pincode']} onChange={(v) => ext.set("pincode", v)} disabled={disabled} />
              <TextField label="Timezone" value={ext.values['timezone']} onChange={(v) => ext.set("timezone", v)} disabled={disabled} />
              <div className="sm:col-span-2 lg:col-span-3">
                <TextAreaField label="Street address" value={val("address")} rows={2} onChange={(v) => set("address", v)} disabled={disabled} />
              </div>
            </GroupGrid>
          </SettingsCard>

          <SettingsCard title="Contact">
            <GroupGrid columns={3}>
              <TextField label="Phone" value={val("phone")} onChange={(v) => set("phone", v)} disabled={disabled} />
              <TextField label="Alternative phone" value={ext.values['alt_phone']} onChange={(v) => ext.set("alt_phone", v)} disabled={disabled} />
              <TextField label="Email" type="email" value={val("email")} onChange={(v) => set("email", v)} disabled={disabled} />
              <TextField label="Support email" type="email" value={ext.values['support_email']} onChange={(v) => ext.set("support_email", v)} disabled={disabled} />
              <TextField label="Support phone" value={ext.values['support_phone']} onChange={(v) => ext.set("support_phone", v)} disabled={disabled} />
              <TextField label="Website" value={ext.values['website']} onChange={(v) => ext.set("website", v)} disabled={disabled} />
            </GroupGrid>
          </SettingsCard>

          <SettingsCard title="Online presence" description="Links printed on invoices and shared over WhatsApp.">
            <GroupGrid columns={3}>
              <TextField label="Google Maps URL" value={ext.values['maps_url']} onChange={(v) => ext.set("maps_url", v)} disabled={disabled} />
              <TextField label="Google Business" value={ext.values['google_business']} onChange={(v) => ext.set("google_business", v)} disabled={disabled} />
              <TextField label="Instagram" value={ext.values['instagram']} onChange={(v) => ext.set("instagram", v)} disabled={disabled} />
              <TextField label="Facebook" value={ext.values['facebook']} onChange={(v) => ext.set("facebook", v)} disabled={disabled} />
              <TextField label="YouTube" value={ext.values['youtube']} onChange={(v) => ext.set("youtube", v)} disabled={disabled} />
              <TextField label="LinkedIn" value={ext.values['linkedin']} onChange={(v) => ext.set("linkedin", v)} disabled={disabled} />
              <TextField label="Twitter / X" value={ext.values['twitter']} onChange={(v) => ext.set("twitter", v)} disabled={disabled} />
            </GroupGrid>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="compliance" className="mt-5 space-y-5">
          <SettingsCard title="Registrations" description="Shown on GST invoices and statutory documents.">
            <GroupGrid columns={3}>
              <TextField label="GSTIN" value={val("gstin")} onChange={(v) => set("gstin", v)} disabled={disabled} />
              <TextField label="State code" value={val("state_code")} onChange={(v) => set("state_code", v)} disabled={disabled} />
              <TextField label="PAN" value={ext.values['pan']} onChange={(v) => ext.set("pan", v)} disabled={disabled} />
              <TextField label="MSME / Udyam" value={ext.values['msme']} onChange={(v) => ext.set("msme", v)} disabled={disabled} />
              <TextField label="FSSAI" value={ext.values['fssai']} onChange={(v) => ext.set("fssai", v)} disabled={disabled} />
              <TextField label="CIN" value={ext.values['cin']} onChange={(v) => ext.set("cin", v)} disabled={disabled} />
              <TextField label="Registration number" value={ext.values['registration_number']} onChange={(v) => ext.set("registration_number", v)} disabled={disabled} />
            </GroupGrid>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="operations" className="mt-5 space-y-5">
          <SettingsCard title="Operating defaults">
            <GroupGrid columns={3}>
              <TextField label="Default warehouse" value={ext.values['default_warehouse']} onChange={(v) => ext.set("default_warehouse", v)} disabled={disabled} />
              <TextField label="Default salesperson" value={ext.values['default_salesperson']} onChange={(v) => ext.set("default_salesperson", v)} disabled={disabled} />
              <TextField label="Working hours" value={ext.values['working_hours']} onChange={(v) => ext.set("working_hours", v)} disabled={disabled} />
              <SelectField
                label="Weekly holiday"
                value={ext.values['weekly_holiday']}
                options={["NONE", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].map((d) => ({ value: d, label: d.charAt(0) + d.slice(1).toLowerCase() }))}
                onChange={(v) => ext.set("weekly_holiday", v)}
                disabled={disabled}
              />
              <SelectField
                label="Financial year starts"
                value={ext.values['financial_year_start']}
                options={[{ value: "APRIL", label: "April" }, { value: "JANUARY", label: "January" }, { value: "JULY", label: "July" }]}
                onChange={(v) => ext.set("financial_year_start", v)}
                disabled={disabled}
              />
              <TextField label="Business opening date" type="date" value={ext.values['opening_date']} onChange={(v) => ext.set("opening_date", v)} disabled={disabled} />
              <div className="sm:col-span-2 lg:col-span-3">
                <TextAreaField label="Business notes" value={ext.values['notes']} onChange={(v) => ext.set("notes", v)} disabled={disabled} />
              </div>
            </GroupGrid>
          </SettingsCard>
        </TabsContent>

        <TabsContent value="bank" className="mt-5 space-y-5">
          <SettingsCard title="Bank details" description="Printed on invoices when bank details are enabled.">
            <GroupGrid columns={3}>
              <TextField label="Bank name" value={val("bank_name")} onChange={(v) => set("bank_name", v)} disabled={disabled} />
              <TextField label="Account number" value={val("bank_account")} onChange={(v) => set("bank_account", v)} disabled={disabled} />
              <TextField label="IFSC" value={val("ifsc")} onChange={(v) => set("ifsc", v)} disabled={disabled} />
              <TextField label="UPI ID" value={ext.values['upi_id']} onChange={(v) => ext.set("upi_id", v)} disabled={disabled} />
              <UploadField label="Payment QR code" value={String(ext.values['upi_qr'] ?? "")} onChange={(v) => ext.set("upi_qr", v)} disabled={disabled} />
            </GroupGrid>
          </SettingsCard>
        </TabsContent>
      </Tabs>

      <SaveBar
        dirty={ext.dirty || shopDirty}
        saving={ext.saving || saveShop.isPending}
        onSave={saveAll}
        onDiscard={() => {
          ext.discard();
          if (shop) setForm({ ...(shop as unknown as Shop) });
          setShopDirty(false);
        }}
        onRestore={ext.restoreDefaults}
        readOnly={disabled}
      />
    </div>
  );
}

function PreviewCard({ shop, ext }: { shop: Shop; ext: SettingsValues }) {
  const logo = String(ext['logo'] ?? "");
  return (
    <SettingsCard title="Business preview" description="How your header appears on printed documents.">
      <div className="rounded-xl border border-border bg-muted/30 p-5">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
          {logo ? (
            <img src={logo} alt="Logo" className="size-14 shrink-0 rounded-lg object-contain" />
          ) : (
            <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-6" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">{String(shop['shop_name'] ?? "Your business")}</p>
            <p className="truncate text-sm text-muted-foreground">
              <MapPin className="mr-1 inline size-3" />
              {[shop['address'], ext['city'], ext['state'], ext['pincode']].filter(Boolean).join(", ") || "Address not set"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              <Phone className="mr-1 inline size-3" />
              {String(shop['phone'] ?? "—")} · {String(shop['email'] ?? "—")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shop['gstin'] ? <Badge variant="secondary">GSTIN {String(shop['gstin'])}</Badge> : null}
              {ext['pan'] ? <Badge variant="secondary">PAN {String(ext['pan'])}</Badge> : null}
              {ext['fssai'] ? <Badge variant="secondary">FSSAI {String(ext['fssai'])}</Badge> : null}
            </div>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
