import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Download, Eye, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroupGrid, SaveBar, SectionSkeleton, SettingsCard, TextField, ToggleRow } from "./kit";
import { shopProfileQuery } from "@/lib/queries";
import { useSettingsSection } from "@/lib/settings-store";
import type { SettingsValues } from "@/lib/settings-schema";
import { cn } from "@/lib/utils";
import { InvoiceRenderer, buildDemoInvoice, normalizeThemeColor } from "@/components/invoice/InvoiceRenderer";
import { openInvoicePdf, printInvoiceBySettings } from "@/lib/print";
import { useInvoiceColumns } from "@/hooks/use-invoice-columns";
import { getDefaultInvoiceColumnsSettings } from "@/lib/invoice-columns";
import { InvoiceColumnsManager } from "./invoice-columns-manager";

const PRINT_TABS = ["Printer", "Templates", "Layout", "Columns", "Header", "Footer", "Advanced"] as const;
type PrintTab = (typeof PRINT_TABS)[number];

const THERMAL_TEMPLATES = [
  { id: "classic-receipt", name: "Classic Receipt", description: "Traditional Indian retail receipt.", paper: "Thermal", recommended: "58mm • 80mm • 112mm" },
  { id: "modern-retail", name: "Modern Retail", description: "Contemporary retail invoice with accent blocks.", paper: "Thermal", recommended: "80mm • 112mm" },
  { id: "compact-minimal", name: "Compact Minimal", description: "Minimal, paper-efficient receipt for busy counters.", paper: "Thermal", recommended: "58mm • 80mm" },
] as const;

const A4_TEMPLATES = [
  { id: "classic-business", name: "Classic Business", description: "Strong GST invoice with a traditional layout.", paper: "A4", recommended: "A4 Portrait" },
  { id: "professional-bill", name: "Professional Bill", description: "A4 bill with customer, shipping, tax, and totals sections for wholesale billing.", paper: "A4", recommended: "A4 Portrait" },
  { id: "modern-invoice", name: "Modern Invoice", description: "Clean, card-based invoice for modern POS work.", paper: "A4", recommended: "A4 Portrait" },
  { id: "premium-professional", name: "Premium Professional", description: "Premium corporate invoice with elegant hierarchy.", paper: "A4", recommended: "A4 Portrait" },
] as const;

const A5_TEMPLATES = [
  { id: "paper-saving", name: "Paper Saving Bill", description: "Compact A5 estimate / bill for tighter paper usage.", paper: "A5", recommended: "A5 Portrait" },
] as const;

const THEME_COLORS = [
  { name: "Default", color: "#2563eb" },
  { name: "Blue", color: "#2563eb" },
  { name: "Navy", color: "#1e3a8a" },
  { name: "Green", color: "#16a34a" },
  { name: "Emerald", color: "#059669" },
  { name: "Purple", color: "#7c3aed" },
  { name: "Orange", color: "#f59e0b" },
  { name: "Red", color: "#dc2626" },
  { name: "Teal", color: "#0f766e" },
  { name: "Black", color: "#111827" },
  { name: "Custom", color: "#1f2937" },
] as const;

const COLUMN_FIELDS = [
  ["sno", "S.No", true],
  ["product", "Product", true],
  ["sku", "SKU", false],
  ["barcode", "Barcode", false],
  ["hsn", "HSN", false],
  ["qty", "Qty", true],
  ["unit", "Unit", false],
  ["mrp", "MRP", true],
  ["rate", "Rate", true],
  ["discount", "Discount", true],
  ["gst", "GST", false],
  ["tax_amount", "Tax Amount", false],
  ["amount", "Amount", true],
  ["batch", "Batch", false],
  ["expiry", "Expiry", false],
] as const;

const BLOCK_FIELDS = [
  ["logo", "Logo", true],
  ["business_address", "Business Address", true],
  ["gstin", "GSTIN", true],
  ["phone", "Phone", true],
  ["invoice_number", "Invoice Number", true],
  ["date", "Date", true],
  ["time", "Time", true],
  ["customer_name", "Customer Name", true],
  ["customer_mobile", "Customer Mobile", true],
  ["customer_address", "Customer Address", false],
  ["customer_gstin", "Customer GSTIN", false],
  ["payment_qr", "Payment QR", true],
  ["payment_mode", "Payment Mode", true],
  ["paid_amount", "Paid Amount", true],
  ["balance_due", "Balance Due", true],
  ["bank_details", "Bank Details", false],
  ["signature", "Signature", false],
  ["notes", "Notes", true],
  ["terms", "Terms", true],
  ["amount_in_words", "Amount in Words", true],
  ["thank_you_message", "Thank You Message", true],
] as const;

const THERMAL_WIDTHS = ["58mm", "80mm", "112mm"] as const;

function buildDefaults(): SettingsValues {
  const out: SettingsValues = {
    print_type: "thermal",
    thermal_width: "80mm",
    template_id: "modern-retail",
    theme_color: "Blue",
    custom_theme_color: "#2563eb",
    orientation: "portrait",
    font_family: "Inter",
    font_size: 11,
    line_spacing: 1.2,
    left_margin: 6,
    right_margin: 6,
    qr_size: 18,
    logo_enabled: true,
    qr_enabled: true,
    show_upi_id: true,
    show_payment_label: true,
    repeat_header: true,
    paper_size: "A4",
    landscape: false,
    margin: 12,
    header_height: 72,
    footer_height: 56,
    padding: 12,
    default_printer: "Thermal Printer",
    print_preview: true,
    save_pdf: false,
  };

  for (const [k, , def] of COLUMN_FIELDS) out[k] = def;
  for (const [k, , def] of BLOCK_FIELDS) out[k] = def;
  return out;
}

function parseHex(hex: string): string {
  const value = hex.replace("#", "");
  const normalized = value.length === 3 ? value.split("").map((char) => `${char}${char}`).join("") : value;
  const number = Number.parseInt(normalized, 16);
  const r = (number >> 16) & 255;
  const g = (number >> 8) & 255;
  const b = number & 255;
  return `${r}, ${g}, ${b}`;
}

function hexToRgba(hex: string, alpha: number) {
  return `rgba(${parseHex(hex)}, ${alpha})`;
}

function buildPreviewInvoice(shop: { shop_name?: string | null; address?: string | null; phone?: string | null; email?: string | null; gstin?: string | null; terms?: string | null; } | null, printType: string, thermalWidth: string, templateId: string, accentColor: string) {
  const totals = {
    subtotal: 475,
    discount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    roundOff: 0,
    grandTotal: 475,
    paid: 475,
    balance: 0,
  };

  return buildDemoInvoice({
    invoiceNumber: "INV-00014",
    date: new Date("2026-08-22T12:47:00"),
    paymentMethod: "CASH",
    business: {
      name: shop?.shop_name ?? "SHREE BALAJI WHOLESALE TRADERS",
      address: shop?.address ?? "Shop 14, APMC Market Yard, Navi Mumbai, Maharashtra 400705",
      phone: shop?.phone ?? "+91 98200 11223",
      email: shop?.email ?? "billing@balajiwholesale.in",
      gstin: shop?.gstin ?? "27AABCS429B1ZX",
      terms: shop?.terms ?? "Goods once sold will not be taken back.",
    },
    customer: {
      name: "Walk-in Customer",
      phone: "+91 98765 43210",
      address: "Navi Mumbai, Maharashtra",
      gstin: null,
      state: "Maharashtra",
      stateCode: "27",
    },
    items: [
      { name: "Rice 5kg", sku: "RICE-5", hsn: "1001", quantity: 2, unit: "kg", rate: 160, discount: 0, gstPercent: 0, amount: 320 },
      { name: "Milk 1L", sku: "MILK-1", hsn: "0402", quantity: 1, unit: "L", rate: 120, discount: 0, gstPercent: 0, amount: 120 },
      { name: "Tea Masala", sku: "TEM-10", hsn: "0904", quantity: 1, unit: "pcs", rate: 35, discount: 0, gstPercent: 0, amount: 35 },
    ],
    totals,
    amountInWords: "Four Hundred Seventy Five Rupees Only",
    qrCode: "QR",
    taxType: "local",
  });
}

export function PrintSection({ canEdit }: { canEdit: boolean }) {
  const defaults = useMemo(buildDefaults, []);
  const state = useSettingsSection("print", defaults);
  const { data: shop } = useQuery(shopProfileQuery());
  const [zoom, setZoom] = useState(0.82);
  const [activeTab, setActiveTab] = useState<PrintTab>("Printer");
  
  // Invoice columns management
  const columnsMgmt = useInvoiceColumns();
  
  const v = state.values;
  const disabled = !canEdit;

  const printType = String(v["print_type"] ?? "thermal");
  const thermalWidth = String(v["thermal_width"] ?? "80mm");
  const selectedThemeName = String(v["theme_color"] ?? "Blue");
  const selectedTheme =
    THEME_COLORS.find((theme) => theme.name === selectedThemeName) ?? THEME_COLORS[0];
  const accentColor = selectedThemeName === "Custom"
    ? String(v["custom_theme_color"] ?? selectedTheme.color)
    : selectedTheme.color;

  const templateOptions = printType === "thermal" ? THERMAL_TEMPLATES : printType === "a5" ? A5_TEMPLATES : A4_TEMPLATES;
  const currentTemplateId = String(v["template_id"] ?? templateOptions[0]?.id ?? "classic-receipt");
  const activeTemplate = templateOptions.find((template) => template.id === currentTemplateId) ?? templateOptions[0];
  const normalizedTemplateId = activeTemplate?.id ?? templateOptions[0]?.id ?? "classic-receipt";
  const previewInvoice = useMemo(
    () => buildPreviewInvoice(shop ?? null, printType, thermalWidth, normalizedTemplateId, accentColor),
    [shop, printType, thermalWidth, normalizedTemplateId, accentColor],
  );

  useEffect(() => {
    if (normalizedTemplateId !== String(v["template_id"] ?? "")) {
      state.set("template_id", normalizedTemplateId);
    }
  }, [normalizedTemplateId, v["template_id"], state]);

  const handlePrintPreview = () => {
    const payload = {
      invoiceNumber: previewInvoice.invoiceNumber,
      date: new Date(previewInvoice.date),
      customerName: previewInvoice.customer.name,
      customerMobile: previewInvoice.customer.phone,
      customerGstin: previewInvoice.customer.gstin,
      customerAddress: previewInvoice.customer.address,
      paymentMode: previewInvoice.paymentMethod,
      amountPaid: previewInvoice.totals.paid,
      amountDue: previewInvoice.totals.balance,
      lines: previewInvoice.items.map((item) => ({
        product: {
          id: item.sku ?? item.name,
          name: item.name,
          sku: item.sku ?? item.name,
          barcode: null,
          category_id: null,
          brand: null,
          purchase_price: 0,
          selling_price: item.rate,
          wholesale_price: item.rate,
          mrp: item.rate,
          gst_percent: item.gstPercent,
          hsn_code: item.hsn ?? "",
          base_unit: item.unit ?? "pcs",
          pack_name: item.unit ?? "pcs",
          pack_size: 1,
          allow_piece_sale: true,
          allow_pack_sale: true,
          current_stock: 0,
          min_stock_alert: 0,
        },
        quantity: item.quantity,
        unitPrice: item.rate,
        discountPercent: item.discount,
      })),
      shop: shop as never,
      printSettings: {
        print_type: printType,
        thermal_width: thermalWidth,
        template_id: normalizedTemplateId,
        theme_color: selectedThemeName,
        custom_theme_color: accentColor,
      },
    };
    printInvoiceBySettings(payload as never, payload.printSettings as never);
  };

  const handleDownloadPdf = () => {
    const payload = {
      invoiceNumber: previewInvoice.invoiceNumber,
      date: new Date(previewInvoice.date),
      customerName: previewInvoice.customer.name,
      customerMobile: previewInvoice.customer.phone,
      customerGstin: previewInvoice.customer.gstin,
      customerAddress: previewInvoice.customer.address,
      paymentMode: previewInvoice.paymentMethod,
      amountPaid: previewInvoice.totals.paid,
      amountDue: previewInvoice.totals.balance,
      lines: previewInvoice.items.map((item) => ({
        product: {
          id: item.sku ?? item.name,
          name: item.name,
          sku: item.sku ?? item.name,
          barcode: null,
          category_id: null,
          brand: null,
          purchase_price: 0,
          selling_price: item.rate,
          wholesale_price: item.rate,
          mrp: item.rate,
          gst_percent: item.gstPercent,
          hsn_code: item.hsn ?? "",
          base_unit: item.unit ?? "pcs",
          pack_name: item.unit ?? "pcs",
          pack_size: 1,
          allow_piece_sale: true,
          allow_pack_sale: true,
          current_stock: 0,
          min_stock_alert: 0,
        },
        quantity: item.quantity,
        unitPrice: item.rate,
        discountPercent: item.discount,
      })),
      shop: shop as never,
      printSettings: {
        print_type: printType,
        thermal_width: thermalWidth,
        template_id: normalizedTemplateId,
        theme_color: selectedThemeName,
        custom_theme_color: accentColor,
      },
    };
    openInvoicePdf(payload as never, payload.printSettings as never);
  };

  if (state.loading) return <SectionSkeleton />;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">Print & Invoices</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight">Invoice templates, printers & print settings</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handlePrintPreview}>
              <Eye className="mr-2 size-4" /> Print Preview
            </Button>
            <Button type="button" size="sm" onClick={handlePrintPreview}>
              <Printer className="mr-2 size-4" /> Print Invoice
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(tab) => setActiveTab(tab as PrintTab)} className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
          {PRINT_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="rounded-md px-3 py-2 text-xs font-medium">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="space-y-5">
            <TabsContent value="Printer" className="mt-0 space-y-5">
              <SettingsCard title="Print type" description="Choose the output category that matches your invoice workflow.">
                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    { value: "thermal", label: "Thermal Printer" },
                    { value: "a4", label: "A4 Paper" },
                    { value: "a5", label: "A5 Paper" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        state.set("print_type", option.value);
                        const nextTemplate = option.value === "thermal"
                          ? THERMAL_TEMPLATES[0].id
                          : option.value === "a5"
                            ? A5_TEMPLATES[0].id
                            : A4_TEMPLATES[0].id;
                        state.set("template_id", nextTemplate);
                      }}
                      className={cn(
                        "rounded-xl border p-4 text-left transition-all",
                        printType === option.value
                          ? "border-primary bg-primary/5 shadow-sm ring-2 ring-primary/20"
                          : "border-border bg-card hover:bg-muted/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-base font-semibold">{option.label}</span>
                        {printType === option.value && (
                          <span className="rounded-full bg-primary/10 p-1 text-primary">
                            <Check className="size-4" />
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {option.value === "thermal"
                          ? "Five compact thermal bill layouts and hardware widths."
                          : option.value === "a5"
                            ? "Compact A5 estimate and paper-saving invoice layouts."
                            : "Five A4 invoice layouts for office and business billing."}
                      </p>
                    </button>
                  ))}
                </div>
              </SettingsCard>

              {printType === "thermal" && (
                <SettingsCard title="Thermal paper width" description="Choose the paper width to tune readable spacing, margins and item density.">
                  <div className="flex flex-wrap gap-2">
                    {THERMAL_WIDTHS.map((width) => (
                      <button
                        key={width}
                        type="button"
                        disabled={disabled}
                        onClick={() => state.set("thermal_width", width)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                          thermalWidth === width
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {width}
                      </button>
                    ))}
                  </div>
                </SettingsCard>
              )}
            </TabsContent>

            <TabsContent value="Templates" className="mt-0 space-y-5">
              <SettingsCard title="Template library" description={printType === "thermal" ? "Five thermal invoice styles for POS counters and retail billing." : printType === "a5" ? "Compact A5 estimate layouts for paper-efficient billing." : "Five commercial A4 layouts for business and office billing."}>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {templateOptions.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => state.set("template_id", template.id)}
                      disabled={disabled}
                      className={cn(
                        "min-h-12 rounded-lg border bg-card px-3 py-2 text-left transition-all",
                        currentTemplateId === template.id
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border hover:border-primary/40 hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{template.name}</p>
                        {currentTemplateId === template.id && (
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        )}
                      </div>
                      <p className="mt-1 text-xs uppercase tracking-[0.08em] text-muted-foreground">{template.paper}</p>
                    </button>
                  ))}
                </div>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="Layout" className="mt-0 space-y-5">
              <SettingsCard title="Page settings" description="Tune the invoice dimensions without changing the overall print workflow.">
                <GroupGrid columns={3}>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Orientation</label>
                    <div className="flex rounded-md border border-border bg-muted/30 p-1">
                      {[
                        { label: "Portrait", value: "portrait" },
                        { label: "Landscape", value: "landscape" },
                      ].map((orientation) => (
                        <button
                          key={orientation.value}
                          type="button"
                          disabled={disabled}
                          onClick={() => state.set("orientation", orientation.value)}
                          className={cn(
                            "flex-1 rounded-md px-3 py-2 text-sm font-medium",
                            String(v["orientation"] ?? "portrait") === orientation.value
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground",
                          )}
                        >
                          {orientation.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TextField label="Font size" type="number" value={v["font_size"] ?? 11} onChange={(value) => state.set("font_size", Number(value) || 11)} disabled={disabled} />
                  <TextField label="Line spacing" type="number" value={v["line_spacing"] ?? 1.2} onChange={(value) => state.set("line_spacing", Number(value) || 1.2)} disabled={disabled} />
                  <TextField label="Margin" type="number" value={v["margin"] ?? 12} onChange={(value) => state.set("margin", Number(value) || 12)} disabled={disabled} />
                  <TextField label="Padding" type="number" value={v["padding"] ?? 12} onChange={(value) => state.set("padding", Number(value) || 12)} disabled={disabled} />
                  <TextField label="Header height" type="number" value={v["header_height"] ?? 72} onChange={(value) => state.set("header_height", Number(value) || 72)} disabled={disabled} />
                  <TextField label="Footer height" type="number" value={v["footer_height"] ?? 56} onChange={(value) => state.set("footer_height", Number(value) || 56)} disabled={disabled} />
                  <ToggleRow label="Repeat header on new page" checked={!!v["repeat_header"]} onChange={(value) => state.set("repeat_header", value)} disabled={disabled} />
                </GroupGrid>
              </SettingsCard>

              <SettingsCard title="Theme color" description="The selected accent color updates invoice headers, totals and QR sections automatically.">
                <div className="flex flex-wrap gap-2">
                  {THEME_COLORS.map((theme) => (
                    <button
                      key={theme.name}
                      type="button"
                      disabled={disabled}
                      onClick={() => state.set("theme_color", theme.name)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        selectedThemeName === theme.name
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      <span className="size-3 rounded-full border border-white/80" style={{ backgroundColor: theme.color }} />
                      {theme.name}
                    </button>
                  ))}
                </div>
                {selectedThemeName === "Custom" && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-3">
                    <input
                      type="color"
                      value={String(v["custom_theme_color"] ?? "#2563eb")}
                      disabled={disabled}
                      onChange={(event) => state.set("custom_theme_color", event.target.value)}
                      className="h-10 w-14 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="text-sm text-muted-foreground">Custom accent color</span>
                  </div>
                )}
              </SettingsCard>
            </TabsContent>

            <TabsContent value="Columns" className="mt-0 space-y-5">
              <SettingsCard title="Invoice columns" description="Configure which columns appear on your invoices. Changes update the preview instantly.">
                <InvoiceColumnsManager
                  settings={columnsMgmt.draftColumns}
                  disabled={disabled || columnsMgmt.loading}
                  onToggleColumn={columnsMgmt.toggleColumn}
                  onUpdateLabel={columnsMgmt.updateColumnLabel}
                  onReorderColumns={columnsMgmt.reorderColumns}
                  onUpdateAlignment={columnsMgmt.updateColumnAlignment}
                  onUpdateWidth={columnsMgmt.updateColumnWidth}
                />
              </SettingsCard>
            </TabsContent>

            <TabsContent value="Header" className="mt-0">
              <SettingsCard title="Header blocks" description="Pick the information that should appear above the invoice body.">
                <GroupGrid columns={2}>
                  {BLOCK_FIELDS.filter(([key]) => ["logo", "business_address", "gstin", "phone", "invoice_number", "date", "time", "customer_name", "customer_mobile", "customer_address", "customer_gstin"].includes(key)).map(([key, label]) => (
                    <ToggleRow
                      key={key}
                      label={label}
                      checked={Boolean(v[key as string])}
                      onChange={(value) => state.set(key, value)}
                      disabled={disabled}
                    />
                  ))}
                </GroupGrid>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="Footer" className="mt-0">
              <SettingsCard title="Footer blocks" description="Keep necessary legal and payment notes without expanding the receipt unnecessarily.">
                <GroupGrid columns={2}>
                  {BLOCK_FIELDS.filter(([key]) => ["payment_qr", "payment_mode", "paid_amount", "balance_due", "bank_details", "signature", "notes", "terms", "amount_in_words", "thank_you_message"].includes(key)).map(([key, label]) => (
                    <ToggleRow
                      key={key}
                      label={label}
                      checked={Boolean(v[key as string])}
                      onChange={(value) => state.set(key, value)}
                      disabled={disabled}
                    />
                  ))}
                </GroupGrid>
              </SettingsCard>
            </TabsContent>

            <TabsContent value="Advanced" className="mt-0 space-y-5">
              <SettingsCard title="QR code" description="Keep payment QR and UPI details dynamic, so they match the account data already configured in POS.">
                <GroupGrid columns={3}>
                  <ToggleRow label="Show QR Code" checked={Boolean(v["qr_enabled"])} onChange={(value) => state.set("qr_enabled", value)} disabled={disabled} />
                  <TextField label="QR Size" type="number" value={v["qr_size"] ?? 18} onChange={(value) => state.set("qr_size", Number(value) || 18)} disabled={disabled} />
                  <ToggleRow label="Show UPI ID" checked={Boolean(v["show_upi_id"])} onChange={(value) => state.set("show_upi_id", value)} disabled={disabled} />
                  <ToggleRow label="Show Payment Label" checked={Boolean(v["show_payment_label"])} onChange={(value) => state.set("show_payment_label", value)} disabled={disabled} />
                  <ToggleRow label="Show print preview" checked={Boolean(v["print_preview"])} onChange={(value) => state.set("print_preview", value)} disabled={disabled} />
                  <ToggleRow label="Download PDF" checked={Boolean(v["save_pdf"])} onChange={(value) => state.set("save_pdf", value)} disabled={disabled} />
                </GroupGrid>
              </SettingsCard>
            </TabsContent>
          </div>

          <div className="min-w-0">
            <div className="xl:sticky xl:top-24">
              <SettingsCard
                title="LIVE PREVIEW"
                description={`${printType === "thermal" ? "Thermal" : printType === "a5" ? "A5" : "A4"} • ${activeTemplate?.name ?? "Template"}`}
                actions={
                  <>
                    <Button variant="ghost" size="icon" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.52, value - 0.08))}>
                      <ZoomOut className="size-4" />
                    </Button>
                    <Badge className="min-w-12 justify-center" variant="secondary">
                      {Math.round(zoom * 100)}%
                    </Badge>
                    <Button variant="ghost" size="icon" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.2, value + 0.08))}>
                      <ZoomIn className="size-4" />
                    </Button>
                  </>
                }
              >
                <div className="rounded-xl border border-border bg-slate-100 p-3">
                  <div className="overflow-auto rounded-lg bg-white p-2 sm:p-3">
                    <InvoiceCanvas
                      printType={printType}
                      templateId={currentTemplateId}
                      thermalWidth={thermalWidth}
                      accentColor={accentColor}
                      themeColorName={selectedThemeName}
                      shopName={String(shop?.shop_name ?? "Your Business Name")}
                      shop={shop as Record<string, string> | null}
                      zoom={zoom}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" className="flex-1 justify-center sm:flex-none" onClick={handlePrintPreview}>
                    <Eye className="mr-2 size-4" /> Print Preview
                  </Button>
                  <Button type="button" className="flex-1 justify-center sm:flex-none" onClick={handlePrintPreview}>
                    <Printer className="mr-2 size-4" /> Print Invoice
                  </Button>
                  <Button type="button" variant="outline" className="flex-1 justify-center sm:flex-none" onClick={handleDownloadPdf}>
                    <Download className="mr-2 size-4" /> Download PDF
                  </Button>
                </div>
              </SettingsCard>
            </div>
          </div>
        </div>
      </Tabs>

      <SaveBar
        dirty={state.dirty || columnsMgmt.isDirty || columnsMgmt.saving}
        saving={state.saving || columnsMgmt.saving}
        onSave={async () => {
          await state.save();
          await columnsMgmt.save();
        }}
        onDiscard={() => {
          state.discard();
          columnsMgmt.discard();
        }}
        onRestore={() => {
          state.restoreDefaults();
          columnsMgmt.restoreDefaults();
        }}
        readOnly={disabled || columnsMgmt.loading}
      />
    </div>
  );
}

function InvoiceCanvas({
  printType,
  templateId,
  thermalWidth,
  accentColor,
  themeColorName,
  shopName,
  shop,
  zoom,
}: {
  printType: string;
  templateId: string;
  thermalWidth: string;
  accentColor: string;
  themeColorName: string;
  shopName: string;
  shop: Record<string, string> | null;
  zoom: number;
}) {
  const previewInvoice = buildPreviewInvoice(shop ?? null, printType, thermalWidth, templateId, accentColor);
  const widthMap: Record<string, number> = { "58mm": 212, "80mm": 300, "112mm": 420 };
  const widthValue = printType === "thermal" ? widthMap[thermalWidth] ?? 300 : 760;
  const containerStyle = {
    width: printType === "thermal" ? widthValue : "100%",
    maxWidth: printType === "thermal" ? widthValue : widthValue,
    transform: `scale(${zoom})`,
    transformOrigin: "top center",
    transition: "transform 0.18s ease",
    margin: "0 auto",
  } as const;

  return (
    <div style={containerStyle}>
      <div style={{ background: "#fff", border: `1px solid ${hexToRgba(accentColor, 0.2)}`, boxShadow: `0 12px 28px ${hexToRgba(accentColor, 0.12)}`, borderRadius: printType === "thermal" ? 0 : 16, overflow: "hidden" }}>
        <InvoiceRenderer
          invoice={previewInvoice}
          templateId={templateId as never}
          paperType={printType === "thermal" ? "thermal" : printType === "a5" ? "a5" : "a4"}
          thermalWidth={thermalWidth as "58mm" | "80mm" | "112mm"}
          accentColor={normalizeThemeColor(accentColor)}
        />
      </div>
    </div>
  );
}

export default PrintSection;
