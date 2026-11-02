import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupGrid, SaveBar, SectionSkeleton, SettingsCard, TextAreaField, TextField, ToggleRow } from "./kit";
import { shopProfileQuery } from "@/lib/queries";
import { useSettingsSection } from "@/lib/settings-store";
import type { SettingsValues } from "@/lib/settings-schema";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  {
    key: "tpl_invoice",
    label: "Invoice share",
    toggle: "auto_invoice",
    default:
      "Hello {customer},\nThank you for your order!\nInvoice {invoice} — Amount ₹{amount}\nBalance due ₹{balance}\n— {shop}",
  },
  {
    key: "tpl_payment",
    label: "Payment received",
    toggle: "auto_payment",
    default: "Hello {customer},\nWe received ₹{amount} against {invoice}.\nOutstanding: ₹{balance}\nThank you! — {shop}",
  },
  {
    key: "tpl_reminder",
    label: "Payment reminder",
    toggle: "auto_reminder",
    default:
      "Hello {customer},\nGentle reminder: ₹{balance} is pending on invoice {invoice}.\nKindly clear at your convenience.\n— {shop}",
  },
  {
    key: "tpl_order",
    label: "Order confirmation",
    toggle: "auto_order",
    default: "Hello {customer},\nYour order is confirmed and being packed.\nRef {invoice} · ₹{amount}\n— {shop}",
  },
  {
    key: "tpl_delivery",
    label: "Delivery update",
    toggle: "auto_delivery",
    default: "Hello {customer},\nYour order {invoice} is out for delivery today.\n— {shop}",
  },
  {
    key: "tpl_return",
    label: "Return / credit note",
    toggle: "auto_return",
    default: "Hello {customer},\nCredit note {invoice} for ₹{amount} has been issued against your return.\n— {shop}",
  },
] as const;

const TOKENS = ["{customer}", "{invoice}", "{amount}", "{balance}", "{shop}", "{date}", "{phone}"];

function buildDefaults(): SettingsValues {
  const out: SettingsValues = {
    enabled: true,
    business_number: "",
    country_code: "+91",
    send_pdf_link: true,
    open_web_whatsapp: true,
    api_provider: "None",
    api_key: "",
    reminder_days: 7,
  };
  for (const t of TEMPLATES) {
    out[t.key] = t.default;
    out[t.toggle] = t.key === "tpl_invoice";
  }
  return out;
}

export function WhatsAppSection({ canEdit }: { canEdit: boolean }) {
  const defaults = useMemo(buildDefaults, []);
  const state = useSettingsSection("whatsapp", defaults);
  const { data: shop } = useQuery(shopProfileQuery());
  const [active, setActive] = useState<string>(TEMPLATES[0].key);
  const v = state.values;
  const disabled = !canEdit;

  if (state.loading) return <SectionSkeleton />;

  const current = TEMPLATES.find((t) => t.key === active) ?? TEMPLATES[0];
  const preview = String(v[current.key] ?? "")
    .replaceAll("{customer}", "Ramesh Traders")
    .replaceAll("{invoice}", "INV-00042")
    .replaceAll("{amount}", "12,450.00")
    .replaceAll("{balance}", "3,200.00")
    .replaceAll("{shop}", String(shop?.shop_name ?? "Your Business"))
    .replaceAll("{date}", new Date().toLocaleDateString("en-IN"))
    .replaceAll("{phone}", String(shop?.phone ?? "—"));

  return (
    <div className="space-y-5">
      <SettingsCard title="WhatsApp connection" description="Used when you share invoices and reminders from any screen.">
        <GroupGrid columns={3}>
          <ToggleRow label="Enable WhatsApp sharing" checked={!!v['enabled']} onChange={(x) => state.set("enabled", x)} disabled={disabled} />
          <TextField label="Country code" value={v['country_code']} onChange={(x) => state.set("country_code", x)} disabled={disabled} />
          <TextField label="Business number" value={v['business_number']} placeholder="9876543210" onChange={(x) => state.set("business_number", x)} disabled={disabled} />
          <ToggleRow label="Attach invoice PDF link" checked={!!v['send_pdf_link']} onChange={(x) => state.set("send_pdf_link", x)} disabled={disabled} />
          <ToggleRow label="Open WhatsApp Web" checked={!!v['open_web_whatsapp']} onChange={(x) => state.set("open_web_whatsapp", x)} disabled={disabled} />
          <TextField label="Reminder after (days)" type="number" value={v['reminder_days']} onChange={(x) => state.set("reminder_days", Number(x) || 0)} disabled={disabled} />
        </GroupGrid>
      </SettingsCard>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <div className="min-w-0">
          <SettingsCard title="Message templates" description="Placeholders are replaced automatically when the message is sent.">
            <Tabs value={active} onValueChange={setActive}>
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
                {TEMPLATES.map((t) => (
                  <TabsTrigger key={t.key} value={t.key}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {TEMPLATES.map((t) => (
                <TabsContent key={t.key} value={t.key} className="mt-4 space-y-4">
                  <ToggleRow
                    label={`Send "${t.label}" automatically`}
                    checked={!!v[t.toggle]}
                    onChange={(x) => state.set(t.toggle, x)}
                    disabled={disabled}
                  />
                  <TextAreaField
                    label="Template"
                    rows={7}
                    value={v[t.key]}
                    onChange={(x) => state.set(t.key, x)}
                    disabled={disabled}
                  />
                  <div className="flex flex-wrap gap-2">
                    {TOKENS.map((tok) => (
                      <button
                        key={tok}
                        type="button"
                        disabled={disabled}
                        onClick={() => state.set(t.key, `${String(v[t.key] ?? "")}${tok}`)}
                        className="rounded-full border border-border bg-muted/40 px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted"
                      >
                        {tok}
                      </button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </SettingsCard>
        </div>

        <div className="min-w-0">
          <div className="xl:sticky xl:top-24">
            <SettingsCard
              title="Live preview"
              description={current.label}
              actions={<Badge variant="secondary" className="gap-1"><MessageCircle className="size-3" /> WhatsApp</Badge>}
            >
              <div className="rounded-xl bg-[#0b141a] p-4">
                <div className={cn("ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-[#005c4b] px-3 py-2 text-sm text-white shadow")}>
                  <p className="whitespace-pre-wrap break-words">{preview}</p>
                  <p className="mt-1 text-right text-[10px] text-white/60">
                    {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} ✓✓
                  </p>
                </div>
              </div>
              <Button
                className="mt-4 w-full"
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(preview)}`,
                    "_blank",
                    "noopener,noreferrer",
                  )
                }
              >
                <Send className="size-4" /> Send test message
              </Button>
            </SettingsCard>
          </div>
        </div>
      </div>

      <SaveBar
        dirty={state.dirty}
        saving={state.saving}
        onSave={state.save}
        onDiscard={state.discard}
        onRestore={state.restoreDefaults}
        readOnly={disabled}
      />
    </div>
  );
}
