import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bell,
  Boxes,
  DatabaseBackup,
  Gift,
  MessageCircle,
  Palette,
  Plug,
  Printer,
  ReceiptText,
  Table2,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBag,
  Keyboard,
  Store,
  UserCircle,
  Users2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader, PageShell } from "@/components/page";
import { SchemaSection } from "@/components/settings/schema-section";
import { AccountSection } from "@/components/settings/account-section";
import { BusinessSection } from "@/components/settings/business-section";
import { CatalogSection } from "@/components/settings/catalog-section";
import { StaffSection } from "@/components/settings/staff-section";
import { PrintSection } from "@/components/settings/print-section";
import { WhatsAppSection } from "@/components/settings/whatsapp-section";
import { BackupSection } from "@/components/settings/backup-section";
import { ShortcutsSection } from "@/components/settings/shortcuts-section";
import { SCHEMAS } from "@/lib/settings-schema";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — BillingAZ Wholesale POS" },
      {
        name: "description",
        content:
          "Enterprise settings for BillingAZ: business profile, invoice & GST, POS, catalog, staff roles, printing, WhatsApp, loyalty, security, integrations and backups.",
      },
      { property: "og:title", content: "Settings — BillingAZ" },
      {
        property: "og:description",
        content: "Configure every part of your wholesale counter from one control centre.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

interface Item {
  id: string;
  label: string;
  description: string;
  icon: typeof Store;
  keywords: string;
  adminOnly?: boolean;
}

const GROUPS: { label: string; items: Item[] }[] = [
  {
    label: "Workspace",
    items: [
      {
        id: "account",
        label: "My account",
        description: "Profile, password, sessions",
        icon: UserCircle,
        keywords: "profile password avatar 2fa sessions devices email",
      },
      {
        id: "business",
        label: "Business profile",
        description: "Shop identity, address, bank",
        icon: Store,
        keywords: "shop name logo address bank gstin branding",
        adminOnly: true,
      },
      {
        id: "staff",
        label: "Staff & roles",
        description: "Team access and permissions",
        icon: Users2,
        keywords: "users staff role permission invite cashier admin",
        adminOnly: true,
      },
    ],
  },
  {
    label: "Selling",
    items: [
      {
        id: "invoice",
        label: "Invoice & GST",
        description: "Numbering, tax, compliance",
        icon: ReceiptText,
        keywords: "invoice prefix gst hsn tax series numbering e-invoice eway",
        adminOnly: true,
      },
      {
        id: "pos",
        label: "Billing counter",
        description: "POS behaviour and shortcuts",
        icon: ShoppingBag,
        keywords: "pos billing counter barcode shortcut hold discount rounding",
        adminOnly: true,
      },
      {
        id: "billing-modes",
        label: "Billing modes",
        description: "Standard or keyboard-first counter",
        icon: Table2,
        keywords: "billing mode standard professional grid keyboard barcode counter",
        adminOnly: true,
      },
      {
        id: "shortcuts",
        label: "Shortcut keys",
        description: "Keyboard shortcuts for the counter",
        icon: Keyboard,
        keywords: "shortcut keyboard hotkey keys alt category navigation arrow enter",
      },
      {
        id: "loyalty",
        label: "Loyalty & offers",
        description: "Points, tiers, coupons",
        icon: Gift,
        keywords: "loyalty points rewards coupon discount scheme tier",
        adminOnly: true,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        id: "catalog",
        label: "Catalog",
        description: "Categories and bulk product tools",
        icon: Boxes,
        keywords: "category product bulk price gst merge catalog",
        adminOnly: true,
      },
      {
        id: "print",
        label: "Print & Invoices",
        description: "Invoice templates, printers & print settings",
        icon: Printer,
        keywords: "print pdf a4 thermal paper template layout columns watermark invoice preview",
        adminOnly: true,
      },
      {
        id: "whatsapp",
        label: "WhatsApp",
        description: "Templates and auto-messages",
        icon: MessageCircle,
        keywords: "whatsapp message template reminder share send",
        adminOnly: true,
      },
      {
        id: "notifications",
        label: "Notifications",
        description: "Alerts and daily digests",
        icon: Bell,
        keywords: "notification alert email sms low stock digest reminder",
        adminOnly: true,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        id: "appearance",
        label: "Appearance",
        description: "Theme, density, layout",
        icon: Palette,
        keywords: "theme dark light colour font density layout appearance",
        adminOnly: true,
      },
      {
        id: "security",
        label: "Security",
        description: "Sessions, audit, policies",
        icon: ShieldCheck,
        keywords: "security password policy session audit log lock ip",
        adminOnly: true,
      },
      {
        id: "integrations",
        label: "Integrations",
        description: "Tally, payments, accounting",
        icon: Plug,
        keywords: "integration tally api webhook payment gateway sync export",
        adminOnly: true,
      },
      {
        id: "backup",
        label: "Data & backup",
        description: "Export, import, snapshots",
        icon: DatabaseBackup,
        keywords: "backup export import csv json restore data storage",
        adminOnly: true,
      },
      {
        id: "legal",
        label: "Legal & about",
        description: "Terms, privacy, version",
        icon: Scale,
        keywords: "legal terms privacy policy licence version about support",
        adminOnly: true,
      },
    ],
  },
];

const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

function SettingsPage() {
  const { role, name } = useAuth();
  const isAdmin = role === "ADMIN";
  const [section, setSection] = useState("account");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) =>
        [i.label, i.description, i.keywords].some((f) => f.toLowerCase().includes(term)),
      ),
    })).filter((g) => g.items.length > 0);
  }, [q]);

  const active = ALL_ITEMS.find((i) => i.id === section) ?? ALL_ITEMS[0]!;
  const canEdit = isAdmin || !active.adminOnly;

  return (
    <PageShell>
      <PageHeader title="Settings" subtitle={`Signed in as ${name || "Staff"} · ${role ?? "—"}`} />

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:w-[290px]">
          <div className="flex h-full max-h-[40vh] lg:max-h-none flex-col gap-3 rounded-lg border border-border bg-card p-3 lg:border-none lg:bg-transparent lg:p-0 shadow-sm lg:shadow-none">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search settings…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-2 pr-1">
              {filtered.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSection(item.id)}
                        className={cn(
                          "grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                          section === item.id
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        <item.icon className="size-4 shrink-0" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                          <span className="block truncate text-xs opacity-70">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 text-sm text-muted-foreground">No settings match “{q}”.</p>
              )}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold tracking-tight">{active.label}</h2>
              <p className="truncate text-sm text-muted-foreground">{active.description}</p>
            </div>
            {active.adminOnly && (
              <Badge variant={isAdmin ? "secondary" : "outline"} className="shrink-0 gap-1">
                <ShieldCheck className="size-3" /> {isAdmin ? "Admin" : "View only"}
              </Badge>
            )}
          </div>

          <SectionBody key={active.id} section={active.id} canEdit={canEdit} role={role} />
        </div>
      </div>
    </PageShell>
  );
}

function SectionBody({
  section,
  canEdit,
  role,
}: {
  section: string;
  canEdit: boolean;
  role: ReturnType<typeof useAuth>["role"];
}) {
  if (section === "account") return <AccountSection role={role} />;
  if (section === "business") return <BusinessSection canEdit={canEdit} />;
  if (section === "staff") return <StaffSection canEdit={canEdit} role={role} />;
  if (section === "catalog") return <CatalogSection canEdit={canEdit} />;
  if (section === "print") return <PrintSection canEdit={canEdit} />;
  if (section === "whatsapp") return <WhatsAppSection canEdit={canEdit} />;
  if (section === "backup") return <BackupSection canEdit={canEdit} />;
  if (section === "shortcuts") return <ShortcutsSection canEdit={canEdit} />;

  const schema = SCHEMAS[section];
  if (!schema) return null;
  return <SchemaSection schema={schema} canEdit={canEdit} />;
}
