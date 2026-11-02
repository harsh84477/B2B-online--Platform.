import type { CSSProperties, ReactNode } from "react";
import { formatMoney } from "@/lib/pos";

export type InvoicePaperType = "thermal" | "a4" | "a5";
export type InvoiceTemplateId =
  | "classic-receipt"
  | "modern-retail"
  | "compact-minimal"
  | "classic-business"
  | "professional-bill"
  | "paper-saving"
  | "modern-invoice"
  | "premium-professional";

export interface InvoiceBusiness {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  pan?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  ifsc?: string | null;
  upiId?: string | null;
  qrUrl?: string | null;
  terms?: string | null;
}

export interface InvoiceCustomer {
  name: string;
  phone?: string | null;
  address?: string | null;
  gstin?: string | null;
  state?: string | null;
  stateCode?: string | null;
}

export interface InvoiceItem {
  name: string;
  sku?: string | null;
  hsn?: string | null;
  quantity: number;
  unit?: string | null;
  rate: number;
  discount: number;
  gstPercent: number;
  amount: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  grandTotal: number;
  paid: number;
  balance: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  date: Date | string;
  paymentMethod: string;
  business: InvoiceBusiness;
  customer: InvoiceCustomer;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  notes?: string | null;
  amountInWords?: string | null;
  taxType?: "local" | "interstate";
  qrCode?: string | null;
}

export interface InvoiceTemplateDefinition {
  id: InvoiceTemplateId;
  name: string;
  category: InvoicePaperType;
  description: string;
  paperSize: string;
  renderer: (props: InvoiceTemplateProps) => ReactNode;
}

export interface InvoiceTemplateProps {
  invoice: InvoiceData;
  accentColor: string;
  templateId: InvoiceTemplateId;
  paperType: InvoicePaperType;
  thermalWidth?: "58mm" | "80mm" | "112mm";
  compact?: boolean;
}

const THEME_COLOR_MAP: Record<string, string> = {
  Default: "#2563eb",
  Blue: "#2563eb",
  Navy: "#1d4ed8",
  Green: "#16a34a",
  Emerald: "#059669",
  Purple: "#7c3aed",
  Orange: "#f59e0b",
  Red: "#dc2626",
  Teal: "#0f766e",
  Black: "#111827",
};

export const TEMPLATE_LIBRARY: Record<InvoiceTemplateId, InvoiceTemplateDefinition> = {
  "classic-receipt": {
    id: "classic-receipt",
    name: "Classic Receipt",
    category: "thermal",
    description: "Traditional compact POS receipt.",
    paperSize: "58mm • 80mm • 112mm",
    renderer: ThermalClassicTemplate,
  },
  "modern-retail": {
    id: "modern-retail",
    name: "Modern Retail",
    category: "thermal",
    description: "Contemporary retail invoice with accent finish.",
    paperSize: "80mm • 112mm",
    renderer: ThermalModernTemplate,
  },
  "compact-minimal": {
    id: "compact-minimal",
    name: "Compact Minimal",
    category: "thermal",
    description: "High-density minimal receipt for busy counters.",
    paperSize: "58mm • 80mm",
    renderer: ThermalCompactTemplate,
  },
  "classic-business": {
    id: "classic-business",
    name: "Classic Business",
    category: "a4",
    description: "Professional GST invoice for business use.",
    paperSize: "A4 Portrait",
    renderer: A4ClassicTemplate,
  },
  "professional-bill": {
    id: "professional-bill",
    name: "Professional Bill",
    category: "a4",
    description: "A4 wholesale GST bill with structured customer and totals sections.",
    paperSize: "A4 Portrait",
    renderer: A4ProfessionalBillTemplate,
  },
  "paper-saving": {
    id: "paper-saving",
    name: "Paper Saving Bill",
    category: "a5",
    description: "Compact A5 estimate bill designed for space-efficient printing.",
    paperSize: "A5 Portrait",
    renderer: A5PaperSavingTemplate,
  },
  "modern-invoice": {
    id: "modern-invoice",
    name: "Modern Invoice",
    category: "a4",
    description: "Modern POS invoice with a clean summary panel.",
    paperSize: "A4 Portrait",
    renderer: A4ModernTemplate,
  },
  "premium-professional": {
    id: "premium-professional",
    name: "Premium Professional",
    category: "a4",
    description: "Premium corporate invoice with refined hierarchy.",
    paperSize: "A4 Portrait",
    renderer: A4PremiumTemplate,
  },
};

export function normalizeThemeColor(color?: string | null): string {
  if (!color) return "#2563eb";
  if (color.startsWith("#")) return color;
  return THEME_COLOR_MAP[color] ?? THEME_COLOR_MAP.Default;
}

export function resolveInvoiceTemplateId(templateId?: string, paperType?: InvoicePaperType): InvoiceTemplateId {
  const normalized = (templateId ?? "classic-receipt").trim();
  if (normalized in TEMPLATE_LIBRARY) return normalized as InvoiceTemplateId;
  if (paperType === "a5") return "paper-saving";
  if (paperType === "a4") return "classic-business";
  return "classic-receipt";
}

export function buildDemoInvoice(options?: Partial<InvoiceData>): InvoiceData {
  const date = new Date();
  const totals = options?.totals ?? {
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

  const baseItems = [
    { name: "Rice 5kg", sku: "RICE-5", hsn: "1001", quantity: 2, unit: "kg", rate: 160, discount: 0, gstPercent: 0, amount: 320 },
    { name: "Milk 1L", sku: "MILK-1", hsn: "0402", quantity: 1, unit: "L", rate: 120, discount: 0, gstPercent: 0, amount: 120 },
    { name: "Tea Masala", sku: "TEM-10", hsn: "0904", quantity: 1, unit: "pcs", rate: 35, discount: 0, gstPercent: 0, amount: 35 },
  ];

  return {
    invoiceNumber: "INV-00014",
    date,
    paymentMethod: "CASH",
    business: {
      name: "SHREE BALAJI WHOLESALE TRADERS",
      address: "Shop 14, APMC Market Yard, Navi Mumbai, Maharashtra 400705",
      phone: "+91 98200 11223",
      email: "billing@balajiwholesale.in",
      gstin: "27AABCS429B1ZX",
      bankName: "HDFC Bank",
      bankAccount: "XXXXXX1123",
      ifsc: "HDFC0001234",
      upiId: "balaji@upi",
      terms: "Goods once sold will not be taken back.",
      ...options?.business,
    },
    customer: {
      name: "Walk-in Customer",
      phone: "+91 98765 43210",
      address: "Navi Mumbai, Maharashtra",
      gstin: null,
      state: "Maharashtra",
      stateCode: "27",
      ...options?.customer,
    },
    items: [...baseItems, ...(options?.items ?? [])].slice(0, 3 + (options?.items?.length ?? 0)),
    totals,
    notes: "Thank you for shopping with us.",
    amountInWords: "Four Hundred Seventy Five Rupees Only",
    qrCode: options?.qrCode ?? "",
    taxType: options?.taxType ?? "local",
    ...options,
  };
}

export function InvoiceRenderer({
  invoice,
  templateId,
  paperType,
  thermalWidth = "80mm",
  accentColor,
  compact = false,
}: InvoiceTemplateProps) {
  const resolvedTemplateId = resolveInvoiceTemplateId(templateId, paperType);
  const selectedTemplate = TEMPLATE_LIBRARY[resolvedTemplateId];
  const finalAccent = normalizeThemeColor(accentColor ?? "Blue");
  const templateStyle: CSSProperties = paperType === "thermal"
    ? {
        width: thermalWidth === "58mm" ? 212 : thermalWidth === "112mm" ? 420 : 300,
        maxWidth: "100%",
        minHeight: compact ? 180 : 280,
        background: "#ffffff",
        color: "#111827",
        borderRadius: 0,
        overflow: "hidden",
        boxShadow: "none",
        padding: 0,
        fontFamily: '"Segoe UI", Arial, sans-serif',
      }
    : {
        width: "100%",
        maxWidth: 760,
        minHeight: compact ? 420 : 640,
        background: "#ffffff",
        color: "#111827",
        border: "1px solid rgba(15, 23, 42, 0.09)",
        boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)",
        padding: 0,
        fontFamily: '"Segoe UI", Arial, sans-serif',
        pageBreakInside: "avoid",
        breakInside: "avoid",
      };

  return (
    <div style={templateStyle}>
      {selectedTemplate.renderer({
        invoice,
        accentColor: finalAccent,
        templateId: resolvedTemplateId,
        paperType,
        thermalWidth,
        compact,
      })}
    </div>
  );
}

function BusinessHeader({ invoice, accentColor, paperType }: { invoice: InvoiceData; accentColor: string; paperType: InvoicePaperType }) {
  const business = invoice.business;
  const meta = [
    business.phone && `Phone: ${business.phone}`,
    business.email && `Email: ${business.email}`,
    business.gstin && `GSTIN: ${business.gstin}`,
  ].filter(Boolean);
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      padding: paperType === "thermal" ? "8px 0 10px" : "16px 18px 12px",
      borderBottom: "1px solid rgba(148,163,184,0.45)",
      background: paperType === "thermal" ? "transparent" : `linear-gradient(135deg, ${accentColor}08, #ffffff)`,
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0, flex: 1 }}>
        {business.logoUrl ? (
          <img alt={business.name} src={business.logoUrl} style={{ width: paperType === "thermal" ? 30 : 44, height: paperType === "thermal" ? 30 : 44, objectFit: "contain", borderRadius: 6 }} />
        ) : (
          <div style={{ width: paperType === "thermal" ? 30 : 44, height: paperType === "thermal" ? 30 : 44, borderRadius: 6, background: `${accentColor}22`, color: accentColor, display: "grid", placeItems: "center", fontWeight: 700, fontSize: paperType === "thermal" ? 10 : 16 }}>
            {business.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: paperType === "thermal" ? 11 : 21, fontWeight: 800, letterSpacing: 0.2, color: "#0f172a" }}>{business.name}</div>
          {business.address && <div style={{ color: "#475569", fontSize: paperType === "thermal" ? 7.5 : 11, lineHeight: 1.4 }}>{business.address}</div>}
          {meta.length > 0 && <div style={{ color: "#475569", fontSize: paperType === "thermal" ? 7 : 10, lineHeight: 1.4 }}>{meta.join(" • ")}</div>}
        </div>
      </div>
      {paperType === "a4" && (
        <div style={{ minWidth: 190, textAlign: "right" }}>
          <div style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: accentColor, fontWeight: 700 }}>Tax Invoice</div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>#{invoice.invoiceNumber}</div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>{formatDate(invoice.date)}</div>
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function formatTime(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(value);
}

function formatMoneyValue(value: number) {
  return formatMoney(value || 0);
}

function CustomerBlock({ invoice, paperType, accentColor }: { invoice: InvoiceData; paperType: InvoicePaperType; accentColor: string }) {
  const { customer } = invoice;
  const showGST = customer.gstin || customer.stateCode || customer.state;
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: paperType === "a4" ? "1fr 1fr" : "1fr",
      gap: paperType === "a4" ? 12 : 8,
      background: paperType === "a4" ? "#f8fafc" : "transparent",
      border: paperType === "a4" ? "1px solid rgba(148,163,184,0.4)" : "none",
      borderRadius: paperType === "a4" ? 12 : 0,
      padding: paperType === "a4" ? "14px 12px" : "8px 0",
      marginTop: paperType === "a4" ? 10 : 6,
    }}>
      <div>
        <div style={{ fontSize: paperType === "a4" ? 10 : 8, letterSpacing: 1.3, textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Bill To</div>
        <div style={{ fontSize: paperType === "a4" ? 14 : 10, fontWeight: 700, marginTop: 4 }}>{customer.name || "Walk-in Customer"}</div>
        {customer.address && <div style={{ fontSize: paperType === "a4" ? 11 : 8, color: "#475569", marginTop: 2 }}>{customer.address}</div>}
        {customer.phone && <div style={{ fontSize: paperType === "a4" ? 11 : 8, color: "#475569", marginTop: 2 }}>{customer.phone}</div>}
      </div>
      {showGST && (
        <div style={{ textAlign: paperType === "a4" ? "right" : "left", fontSize: paperType === "a4" ? 11 : 8, color: "#475569" }}>
          {customer.gstin && <div><strong>GSTIN:</strong> {customer.gstin}</div>}
          {customer.state && <div><strong>State:</strong> {customer.state}</div>}
          {customer.stateCode && <div><strong>State Code:</strong> {customer.stateCode}</div>}
        </div>
      )}
      {paperType === "thermal" && (
        <div style={{ fontSize: 8, color: "#475569", display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span>{invoice.invoiceNumber}</span>
          <span style={{ color: accentColor, fontWeight: 700 }}>{invoice.paymentMethod}</span>
        </div>
      )}
    </div>
  );
}

function ItemTable({ items, paperType, accentColor }: { items: InvoiceItem[]; paperType: InvoicePaperType; accentColor: string }) {
  const columnWidth = paperType === "thermal" ? "1fr 40px 44px 44px" : "32px minmax(0, 1.8fr) 66px 52px 58px 52px 56px 74px";
  const headerFont = paperType === "thermal" ? 7 : 9;
  const headerCellStyle: CSSProperties = { textAlign: "center", justifySelf: "center" };
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: columnWidth, gap: paperType === "thermal" ? 4 : 8, alignItems: "center", fontWeight: 700, fontSize: headerFont, color: "#0f172a", padding: paperType === "thermal" ? "6px 0 4px" : "10px 0 8px", borderBottom: "1px solid rgba(148,163,184,0.7)" }}>
        <span style={headerCellStyle}>#</span>
        <span style={{ textAlign: "left" }}>Item</span>
        {paperType === "a4" && <span style={headerCellStyle}>HSN</span>}
        <span style={headerCellStyle}>Qty</span>
        <span style={headerCellStyle}>Rate</span>
        <span style={headerCellStyle}>Disc</span>
        {paperType === "a4" && <span style={headerCellStyle}>GST</span>}
        <span style={headerCellStyle}>Amount</span>
      </div>
      {items.map((item, index) => (
        <div key={`${item.name}-${index}`} style={{ display: "grid", gridTemplateColumns: columnWidth, gap: paperType === "thermal" ? 4 : 8, padding: paperType === "thermal" ? "4px 0" : "8px 0", borderBottom: "1px solid rgba(148,163,184,0.25)", alignItems: "center" }}>
          <span style={{ fontSize: paperType === "thermal" ? 7.5 : 10, color: "#475569", textAlign: "center" }}>{index + 1}</span>
          <span style={{ fontSize: paperType === "thermal" ? 7.5 : 10, color: "#0f172a", fontWeight: 600, wordBreak: "break-word", textAlign: "left" }}>{item.name}</span>
          {paperType === "a4" && <span style={{ fontSize: 9, color: "#475569", textAlign: "center" }}>{item.hsn || "-"}</span>}
          <span style={{ fontSize: paperType === "thermal" ? 7.5 : 10, textAlign: "center" }}>{item.quantity}</span>
          <span style={{ fontSize: paperType === "thermal" ? 7.5 : 10, textAlign: "center" }}>{formatMoneyValue(item.rate)}</span>
          <span style={{ fontSize: paperType === "thermal" ? 7.5 : 10, textAlign: "center" }}>{formatMoneyValue(item.discount > 0 ? item.discount : 0)}</span>
          {paperType === "a4" && <span style={{ fontSize: 9, color: "#475569", textAlign: "center" }}>{item.gstPercent}%</span>}
          <span style={{ fontSize: paperType === "thermal" ? 7.5 : 10, fontWeight: 700, textAlign: "right" }}>{formatMoneyValue(item.amount)}</span>
        </div>
      ))}
    </div>
  );
}

function TotalsSection({ invoice, accentColor, paperType }: { invoice: InvoiceData; accentColor: string; paperType: InvoicePaperType }) {
  const totals = invoice.totals;
  const rows = [
    { label: "Subtotal", value: totals.subtotal },
    { label: "Discount", value: totals.discount },
    ...(totals.cgst > 0 ? [{ label: "CGST", value: totals.cgst }] : []),
    ...(totals.sgst > 0 ? [{ label: "SGST", value: totals.sgst }] : []),
    ...(totals.igst > 0 ? [{ label: "IGST", value: totals.igst }] : []),
    { label: "Round Off", value: totals.roundOff },
    { label: "Grand Total", value: totals.grandTotal, strong: true },
    { label: "Paid", value: totals.paid },
    { label: "Balance", value: totals.balance, strong: true },
  ];

  return (
    <div style={{
      marginTop: paperType === "thermal" ? 8 : 12,
      padding: paperType === "thermal" ? "8px 0 0" : "12px",
      borderTop: paperType === "thermal" ? "1px dashed rgba(15,23,42,0.55)" : "1px solid rgba(148,163,184,0.4)",
      background: paperType === "thermal" ? "transparent" : "#f8fafc",
      borderRadius: paperType === "a4" ? 10 : 0,
    }}>
      {rows.map((entry) => (
        <div key={entry.label} style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          fontSize: entry.strong ? 12 : 10,
          lineHeight: 1.4,
          padding: entry.strong ? "7px 0" : "3px 0",
          borderBottom: entry.strong ? "1px solid rgba(148,163,184,0.5)" : "none",
          color: entry.strong ? accentColor : "#334155",
          fontWeight: entry.strong ? 800 : 600,
        }}>
          <span>{entry.label}</span>
          <span style={{ color: entry.strong ? accentColor : "#0f172a", fontWeight: entry.strong ? 800 : 600 }}>{`₹${formatMoneyValue(entry.value)}`}</span>
        </div>
      ))}
    </div>
  );
}

function PaymentFooter({ invoice, accentColor, paperType }: { invoice: InvoiceData; accentColor: string; paperType: InvoicePaperType }) {
  const business = invoice.business;
  const qr = invoice.qrCode || business.qrUrl || business.upiId;
  return (
    <div style={{ marginTop: paperType === "a4" ? 14 : 8, paddingTop: paperType === "a4" ? 10 : 6, borderTop: "1px solid rgba(148,163,184,0.5)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <div style={{ fontSize: paperType === "a4" ? 11 : 8, textTransform: "uppercase", letterSpacing: 1.2, color: "#64748b", fontWeight: 700 }}>Payment</div>
          <div style={{ fontSize: paperType === "a4" ? 12 : 8, marginTop: 4, color: "#0f172a", fontWeight: 700 }}>{invoice.paymentMethod}</div>
          {business.bankName && <div style={{ fontSize: paperType === "a4" ? 10 : 7.5, color: "#475569", marginTop: 4 }}>{business.bankName} • {business.bankAccount}</div>}
          {business.upiId && <div style={{ fontSize: paperType === "a4" ? 10 : 7.5, color: "#475569" }}>UPI: {business.upiId}</div>}
        </div>
        {qr && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: paperType === "a4" ? 70 : 42, height: paperType === "a4" ? 70 : 42, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", display: "grid", placeItems: "center" }}>
              <div style={{ width: "82%", height: "82%", background: "linear-gradient(90deg, rgba(15,23,42,0.8) 0 25%, transparent 25% 50%, rgba(15,23,42,0.8) 50% 75%, transparent 75% 100%)", opacity: 0.12 }} />
            </div>
            <div style={{ fontSize: 7, letterSpacing: 1.2, color: "#64748b", textTransform: "uppercase" }}>QR</div>
          </div>
        )}
      </div>
      {business.terms && <div style={{ fontSize: paperType === "a4" ? 10 : 7.5, color: "#475569", marginTop: 10 }}>{business.terms}</div>}
      {invoice.notes && <div style={{ fontSize: paperType === "a4" ? 10 : 7.5, color: "#475569", marginTop: 4 }}>{invoice.notes}</div>}
    </div>
  );
}

function ThermalClassicTemplate({ invoice, accentColor }: InvoiceTemplateProps) {
  const t = invoice.totals;
  const date = formatDate(invoice.date);
  const time = formatTime(invoice.date);
  return (
    <div style={{ width: "100%", background: "#fff", padding: 10, fontFamily: '"Courier New", monospace' }}>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>{invoice.business.name.toUpperCase()}</div>
      {invoice.business.address && <div style={{ fontSize: 8, textAlign: "center", color: "#475569", lineHeight: 1.4 }}>{invoice.business.address}</div>}
      {invoice.business.phone && <div style={{ fontSize: 8, textAlign: "center", color: "#475569" }}>Ph: {invoice.business.phone}</div>}
      {invoice.business.gstin && <div style={{ fontSize: 8, textAlign: "center", color: "#475569" }}>GSTIN: {invoice.business.gstin}</div>}
      <div style={{ borderTop: "1px dashed #475569", borderBottom: "1px dashed #475569", padding: "6px 0", margin: "8px 0", fontSize: 8, display: "grid", gap: 2 }}>
        <div><strong>Invoice:</strong> {invoice.invoiceNumber}</div>
        <div><strong>Date:</strong> {date}</div>
        <div><strong>Time:</strong> {time}</div>
        <div><strong>Customer:</strong> {invoice.customer.name}</div>
        <div><strong>Payment:</strong> {invoice.paymentMethod}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 34px 38px 40px", gap: 4, fontSize: 7.5, fontWeight: 700 }}>
        <span>ITEM</span><span>QTY</span><span>RATE</span><span>AMT</span>
      </div>
      <div style={{ borderTop: "1px dashed #475569", borderBottom: "1px dashed #475569", paddingTop: 4, paddingBottom: 4 }}>
        {invoice.items.map((item) => (
          <div key={item.name} style={{ display: "grid", gridTemplateColumns: "1fr 34px 38px 40px", gap: 4, fontSize: 7.5, alignItems: "center", marginBottom: 4 }}>
            <span>{item.name}</span>
            <span style={{ textAlign: "right" }}>{item.quantity}</span>
            <span style={{ textAlign: "right" }}>{formatMoneyValue(item.rate)}</span>
            <span style={{ textAlign: "right" }}>{formatMoneyValue(item.amount)}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, fontSize: 8, display: "grid", gap: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>₹{formatMoneyValue(t.subtotal)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Discount</span><span>₹{formatMoneyValue(t.discount)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>CGST</span><span>₹{formatMoneyValue(t.cgst)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>SGST</span><span>₹{formatMoneyValue(t.sgst)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Round Off</span><span>₹{formatMoneyValue(t.roundOff)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>GRAND TOTAL</span><span>₹{formatMoneyValue(t.grandTotal)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>PAID</span><span>₹{formatMoneyValue(t.paid)}</span></div>
      </div>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 11, marginTop: 8 }}>THANK YOU!</div>
      {invoice.business.terms && <div style={{ fontSize: 7.5, textAlign: "center", marginTop: 6, color: "#475569" }}>{invoice.business.terms}</div>}
    </div>
  );
}

function ThermalModernTemplate({ invoice, accentColor }: InvoiceTemplateProps) {
  return (
    <div style={{ width: "100%", background: "#fff", padding: 10, fontFamily: '"Segoe UI", sans-serif' }}>
      <div style={{ background: `${accentColor}15`, borderRadius: 6, padding: "8px 10px", textAlign: "center", fontWeight: 800, color: accentColor, letterSpacing: 0.8 }}>{invoice.business.name}</div>
      <div style={{ marginTop: 8, fontSize: 8, color: "#475569", textAlign: "center" }}>Retail • Grocery • POS</div>
      <div style={{ marginTop: 8, fontSize: 8, color: "#0f172a" }}><strong>Invoice #</strong>{invoice.invoiceNumber}</div>
      <div style={{ fontSize: 8, color: "#475569" }}>{dateText(invoice.date)}</div>
      <div style={{ marginTop: 8, fontSize: 8, padding: "4px 0", borderBottom: "1px solid rgba(148,163,184,0.7)" }}><strong>Customer:</strong> {invoice.customer.name}</div>
      {invoice.items.map((item) => (
        <div key={item.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 8, padding: "4px 0" }}>
          <span>{item.name}</span>
          <span>{item.quantity} × ₹{formatMoneyValue(item.amount)}</span>
        </div>
      ))}
      <div style={{ borderTop: "1px solid rgba(148,163,184,0.7)", marginTop: 8, paddingTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8 }}><span>Subtotal</span><span>₹{formatMoneyValue(invoice.totals.subtotal)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8 }}><span>Tax</span><span>₹{formatMoneyValue(invoice.totals.cgst + invoice.totals.sgst + invoice.totals.igst)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8 }}><span>Discount</span><span>₹{formatMoneyValue(invoice.totals.discount)}</span></div>
        <div style={{ marginTop: 8, background: `${accentColor}18`, borderRadius: 6, padding: "6px 8px", color: accentColor, fontWeight: 800, display: "flex", justifyContent: "space-between", fontSize: 9 }}><span>GRAND TOTAL</span><span>₹{formatMoneyValue(invoice.totals.grandTotal)}</span></div>
      </div>
      <div style={{ marginTop: 8, fontSize: 8, color: "#475569" }}>Payment: {invoice.paymentMethod}</div>
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 10, marginTop: 8, color: accentColor }}>THANK YOU</div>
    </div>
  );
}

function ThermalCompactTemplate({ invoice, accentColor }: InvoiceTemplateProps) {
  return (
    <div style={{ width: "100%", background: "#fff", padding: 8, fontFamily: '"Segoe UI", sans-serif' }}>
      <div style={{ fontSize: 10, fontWeight: 800, marginBottom: 4 }}>{invoice.business.name}</div>
      <div style={{ fontSize: 7, color: "#475569" }}>{invoice.business.address}</div>
      <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 7 }}><span>INV #{invoice.invoiceNumber}</span><span>{invoice.paymentMethod}</span></div>
      <div style={{ marginTop: 8, borderTop: "1px solid rgba(148,163,184,0.7)", borderBottom: "1px solid rgba(148,163,184,0.7)", padding: "4px 0", fontSize: 7, display: "grid", gridTemplateColumns: "1fr 18px 24px", gap: 4 }}>
        <span>Item</span><span>Qty</span><span>Amt</span>
      </div>
      {invoice.items.map((item) => (
        <div key={item.name} style={{ display: "grid", gridTemplateColumns: "1fr 18px 24px", gap: 4, fontSize: 7, padding: "2px 0" }}>
          <span>{item.name}</span>
          <span>{item.quantity}</span>
          <span>{formatMoneyValue(item.amount)}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, fontSize: 7, display: "grid", gap: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Subtotal</span><span>₹{formatMoneyValue(invoice.totals.subtotal)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>GST</span><span>₹{formatMoneyValue(invoice.totals.cgst + invoice.totals.sgst + invoice.totals.igst)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Discount</span><span>₹{formatMoneyValue(invoice.totals.discount)}</span></div>
      </div>
      <div style={{ marginTop: 6, borderTop: "1px solid rgba(148,163,184,0.7)", paddingTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 8 }}><span>TOTAL</span><span>₹{formatMoneyValue(invoice.totals.grandTotal)}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7, marginTop: 6 }}><span>Paid</span><span>₹{formatMoneyValue(invoice.totals.paid)}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 7 }}><span>Balance</span><span>₹{formatMoneyValue(invoice.totals.balance)}</span></div>
      <div style={{ marginTop: 8, fontSize: 7, textAlign: "center", color: accentColor }}>Thank you for shopping!</div>
    </div>
  );
}

function A4ClassicTemplate({ invoice, accentColor }: InvoiceTemplateProps) {
  return (
    <div style={{ width: "100%", background: "#fff", padding: 18, fontFamily: '"Segoe UI", sans-serif' }}>
      <BusinessHeader invoice={invoice} accentColor={accentColor} paperType="a4" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 14 }}>
        <CustomerBlock invoice={invoice} paperType="a4" accentColor={accentColor} />
        <div style={{ justifySelf: "end", textAlign: "right", fontSize: 11, color: "#475569" }}>
          <div><strong>Invoice No:</strong> {invoice.invoiceNumber}</div>
          <div><strong>Date:</strong> {formatDate(invoice.date)}</div>
          <div><strong>Payment:</strong> {invoice.paymentMethod}</div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}><ItemTable items={invoice.items} paperType="a4" accentColor={accentColor} /></div>
      <TotalsSection invoice={invoice} accentColor={accentColor} paperType="a4" />
      <div style={{ marginTop: 12, fontSize: 10, color: "#334155" }}><strong>Amount in Words:</strong> {invoice.amountInWords ?? ""}</div>
      <PaymentFooter invoice={invoice} accentColor={accentColor} paperType="a4" />
    </div>
  );
}

function A4ProfessionalBillTemplate({ invoice, accentColor }: InvoiceTemplateProps) {
  const business = invoice.business;
  const customer = invoice.customer;
  const totals = invoice.totals;
  const taxTotal = totals.cgst + totals.sgst + totals.igst;

  return (
    <div style={{ width: "100%", background: "#ffffff", padding: 0, fontFamily: '"Segoe UI", sans-serif', color: "#0f172a" }}>
      <div style={{ padding: "20px 22px 16px", borderBottom: "2px solid rgba(148,163,184,0.35)", background: `linear-gradient(135deg, ${accentColor}10, #ffffff 60%)` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
            {business.logoUrl ? (
              <img alt={business.name} src={business.logoUrl} style={{ width: 48, height: 48, objectFit: "contain", borderRadius: 8 }} />
            ) : (
              <div style={{ width: 48, height: 48, borderRadius: 10, background: `${accentColor}18`, color: accentColor, display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18 }}>{business.name.slice(0, 2).toUpperCase()}</div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.2 }}>{business.name}</div>
              {business.address && <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.4, marginTop: 2 }}>{business.address}</div>}
              <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.4, marginTop: 4, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {business.phone && <span>Phone: {business.phone}</span>}
                {business.email && <span>Email: {business.email}</span>}
                {business.website && <span>Website: {business.website}</span>}
              </div>
              <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.4, display: "flex", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
                {business.gstin && <span>GSTIN: {business.gstin}</span>}
                {business.pan && <span>PAN: {business.pan}</span>}
              </div>
            </div>
          </div>
          <div style={{ minWidth: 220, textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2.4, color: accentColor, textTransform: "uppercase" }}>Tax Invoice</div>
            <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 11, color: "#475569" }}>
              <div><strong style={{ color: "#0f172a" }}>Invoice No:</strong> {invoice.invoiceNumber}</div>
              <div><strong style={{ color: "#0f172a" }}>Invoice Date:</strong> {formatDate(invoice.date)}</div>
              <div><strong style={{ color: "#0f172a" }}>Payment:</strong> {invoice.paymentMethod}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 22px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ border: "1px solid rgba(148,163,184,0.35)", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#475569" }}>Bill To / Customer</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{customer.name || "Walk-in Customer"}</div>
            {customer.address && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{customer.address}</div>}
            {customer.phone && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Phone: {customer.phone}</div>}
            {customer.gstin && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>GSTIN: {customer.gstin}</div>}
            {customer.state && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>State: {customer.state}{customer.stateCode ? ` (${customer.stateCode})` : ""}</div>}
          </div>

          <div style={{ border: "1px solid rgba(148,163,184,0.35)", borderRadius: 12, padding: 12, background: "#f8fafc" }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: "#475569" }}>Ship To / Consignee</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>{customer.name || "Walk-in Customer"}</div>
            {customer.address && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{customer.address}</div>}
            {customer.phone && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Phone: {customer.phone}</div>}
            {customer.gstin && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>GSTIN: {customer.gstin}</div>}
            {customer.state && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>State: {customer.state}{customer.stateCode ? ` (${customer.stateCode})` : ""}</div>}
          </div>
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <div style={{ background: "#f8fafc", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Order No.</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{invoice.invoiceNumber}</div>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Place of Supply</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{customer.state || "-"}</div>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Due Date</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{formatDate(invoice.date)}</div>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Salesperson</div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>-</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 22px 0" }}>
        <div style={{ border: "1px solid rgba(148,163,184,0.35)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "42px minmax(0, 2.2fr) 72px 56px 64px 70px 62px 82px", gap: 8, background: "#f8fafc", borderBottom: "1px solid rgba(148,163,184,0.35)", padding: "10px 12px", fontSize: 10, fontWeight: 800, letterSpacing: 0.2, color: "#334155" }}>
            <span>S.No</span>
            <span style={{ textAlign: "left" }}>Item / Description</span>
            <span style={{ textAlign: "center" }}>HSN</span>
            <span style={{ textAlign: "center" }}>Qty</span>
            <span style={{ textAlign: "center" }}>Rate</span>
            <span style={{ textAlign: "center" }}>Disc.</span>
            <span style={{ textAlign: "center" }}>GST</span>
            <span style={{ textAlign: "right" }}>Amount</span>
          </div>

          {invoice.items.map((item, index) => (
            <div key={`${item.name}-${index}`} style={{ display: "grid", gridTemplateColumns: "42px minmax(0, 2.2fr) 72px 56px 64px 70px 62px 82px", gap: 8, padding: "10px 12px", borderBottom: "1px solid rgba(148,163,184,0.2)", alignItems: "center", fontSize: 10, color: "#0f172a" }}>
              <span style={{ textAlign: "center" }}>{index + 1}</span>
              <span style={{ textAlign: "left", fontWeight: 600, wordBreak: "break-word" }}>{item.name}</span>
              <span style={{ textAlign: "center", color: "#475569" }}>{item.hsn || "-"}</span>
              <span style={{ textAlign: "center" }}>{item.quantity}</span>
              <span style={{ textAlign: "center" }}>{formatMoneyValue(item.rate)}</span>
              <span style={{ textAlign: "center" }}>{formatMoneyValue(item.discount || 0)}</span>
              <span style={{ textAlign: "center" }}>{item.gstPercent || 0}%</span>
              <span style={{ textAlign: "right", fontWeight: 700 }}>{formatMoneyValue(item.amount)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "18px 22px 0", display: "grid", gridTemplateColumns: "1.5fr 0.9fr", gap: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ background: "#f8fafc", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" }}>Amount in Words</div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#0f172a" }}>{invoice.amountInWords || "-"}</div>
          </div>
          <div style={{ background: "#f8fafc", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 10, color: "#64748b", fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase" }}>Payment Details</div>
            <div style={{ marginTop: 6, fontSize: 11, color: "#475569", lineHeight: 1.5 }}>
              {business.bankName && <div>Bank: {business.bankName}</div>}
              {business.bankAccount && <div>Account: {business.bankAccount}</div>}
              {business.ifsc && <div>IFSC: {business.ifsc}</div>}
              {business.upiId && <div>UPI: {business.upiId}</div>}
            </div>
          </div>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid rgba(148,163,184,0.35)", borderRadius: 12, padding: 12 }}>
          {[
            { label: "Subtotal", value: totals.subtotal },
            { label: "Discount", value: totals.discount },
            ...(totals.cgst > 0 ? [{ label: "CGST", value: totals.cgst }] : []),
            ...(totals.sgst > 0 ? [{ label: "SGST", value: totals.sgst }] : []),
            ...(totals.igst > 0 ? [{ label: "IGST", value: totals.igst }] : []),
            { label: "Round Off", value: totals.roundOff },
            { label: "Tax Total", value: taxTotal },
            { label: "Grand Total", value: totals.grandTotal, strong: true },
            { label: "Paid", value: totals.paid },
            { label: "Balance", value: totals.balance, strong: true },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: row.strong ? 13 : 11, padding: row.strong ? "7px 0" : "4px 0", color: row.strong ? "#0f172a" : "#334155", fontWeight: row.strong ? 800 : 600, borderTop: row.label === "Subtotal" ? "none" : "1px solid rgba(148,163,184,0.2)" }}>
              <span>{row.label}</span>
              <span>{formatMoneyValue(row.value)}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 22px 22px", borderTop: "1px solid rgba(148,163,184,0.35)", marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
        <div style={{ flex: 1, fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
          {business.terms && <div><strong style={{ color: "#0f172a" }}>Terms:</strong> {business.terms}</div>}
          {invoice.notes && <div style={{ marginTop: 4 }}><strong style={{ color: "#0f172a" }}>Notes:</strong> {invoice.notes}</div>}
        </div>
        <div style={{ fontSize: 11, color: "#475569", textAlign: "right" }}>
          <div style={{ fontWeight: 800, color: accentColor, textTransform: "uppercase", letterSpacing: 1.4 }}>Authorized Signature</div>
          <div style={{ marginTop: 8 }}>----------------------</div>
        </div>
      </div>
    </div>
  );
}

function A5PaperSavingTemplate({ invoice, accentColor }: InvoiceTemplateProps) {
  return (
    <div style={{ width: "100%", background: "#fff", padding: 12, fontFamily: '"Segoe UI", sans-serif', color: "#111827" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, borderBottom: "1px solid rgba(148,163,184,0.6)", paddingBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.3 }}>{invoice.business.name}</div>
          {invoice.business.address && <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{invoice.business.address}</div>}
          <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{invoice.business.phone || "-"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.4, color: accentColor, textTransform: "uppercase" }}>Estimate</div>
          <div style={{ fontSize: 10, marginTop: 4 }}>#{invoice.invoiceNumber}</div>
        </div>
      </div>

      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 9, color: "#475569" }}>
        <div>
          <div style={{ fontWeight: 700, color: "#0f172a" }}>Customer</div>
          <div>{invoice.customer.name}</div>
          {invoice.customer.phone && <div>{invoice.customer.phone}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div>{formatDate(invoice.date)}</div>
          <div>{invoice.paymentMethod}</div>
        </div>
      </div>

      <div style={{ marginTop: 8, border: "1px solid rgba(148,163,184,0.35)", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "26px 1fr 38px 42px 44px", gap: 4, background: "#f8fafc", padding: "6px 6px", fontSize: 8, fontWeight: 800, color: "#334155" }}>
          <span>#</span>
          <span>Item</span>
          <span style={{ textAlign: "center" }}>Qty</span>
          <span style={{ textAlign: "right" }}>Rate</span>
          <span style={{ textAlign: "right" }}>Amt</span>
        </div>
        {invoice.items.map((item, index) => (
          <div key={`${item.name}-${index}`} style={{ display: "grid", gridTemplateColumns: "26px 1fr 38px 42px 44px", gap: 4, padding: "5px 6px", borderTop: "1px solid rgba(148,163,184,0.2)", fontSize: 8, alignItems: "center" }}>
            <span>{index + 1}</span>
            <span style={{ fontWeight: 600, lineHeight: 1.3 }}>{item.name}</span>
            <span style={{ textAlign: "center" }}>{item.quantity}</span>
            <span style={{ textAlign: "right" }}>{formatMoneyValue(item.rate)}</span>
            <span style={{ textAlign: "right", fontWeight: 700 }}>{formatMoneyValue(item.amount)}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, marginLeft: "auto", width: "58%", fontSize: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}><span>Subtotal</span><span>{formatMoneyValue(invoice.totals.subtotal)}</span></div>
        {invoice.totals.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}><span>Discount</span><span>-{formatMoneyValue(invoice.totals.discount)}</span></div>}
        {invoice.totals.cgst > 0 && <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}><span>CGST</span><span>{formatMoneyValue(invoice.totals.cgst)}</span></div>}
        {invoice.totals.sgst > 0 && <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}><span>SGST</span><span>{formatMoneyValue(invoice.totals.sgst)}</span></div>}
        {invoice.totals.igst > 0 && <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}><span>IGST</span><span>{formatMoneyValue(invoice.totals.igst)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0 3px", borderTop: "1px solid rgba(148,163,184,0.4)", fontWeight: 800, color: accentColor }}><span>Grand Total</span><span>{formatMoneyValue(invoice.totals.grandTotal)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}><span>Paid</span><span>{formatMoneyValue(invoice.totals.paid)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0" }}><span>Balance</span><span>{formatMoneyValue(invoice.totals.balance)}</span></div>
      </div>

      <div style={{ marginTop: 10, fontSize: 8, color: "#475569", lineHeight: 1.5 }}>
        {invoice.business.terms && <div><strong>Terms:</strong> {invoice.business.terms}</div>}
        {invoice.notes && <div><strong>Note:</strong> {invoice.notes}</div>}
      </div>
    </div>
  );
}

function A4ModernTemplate({ invoice, accentColor }: InvoiceTemplateProps) {
  return (
    <div style={{ width: "100%", background: "#f8fafc", padding: 18, fontFamily: '"Segoe UI", sans-serif' }}>
      <div style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`, color: "#fff", padding: "18px 20px", borderRadius: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{invoice.business.name}</div>
            {invoice.business.address && <div style={{ fontSize: 11, opacity: 0.9 }}>{invoice.business.address}</div>}
          </div>
          <div style={{ textAlign: "right", fontSize: 12, fontWeight: 700 }}>
            <div>TAX INVOICE</div>
            <div style={{ fontSize: 13 }}>#{invoice.invoiceNumber}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginTop: 16 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, border: "1px solid rgba(148,163,184,0.4)" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Invoice</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{invoice.invoiceNumber}</div></div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, border: "1px solid rgba(148,163,184,0.4)" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Date</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{formatDate(invoice.date)}</div></div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, border: "1px solid rgba(148,163,184,0.4)" }}><div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Payment</div><div style={{ fontSize: 14, fontWeight: 700, marginTop: 6 }}>{invoice.paymentMethod}</div></div>      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginTop: 16 }}>
        <CustomerBlock invoice={invoice} paperType="a4" accentColor={accentColor} />
      </div>
      <div style={{ marginTop: 18 }}><ItemTable items={invoice.items} paperType="a4" accentColor={accentColor} /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <div style={{ width: 280, background: "#fff", borderRadius: 14, border: "1px solid rgba(148,163,184,0.4)", padding: 14 }}>
          <TotalsSection invoice={invoice} accentColor={accentColor} paperType="a4" />
        </div>
      </div>
      <PaymentFooter invoice={invoice} accentColor={accentColor} paperType="a4" />
    </div>
  );
}

function A4PremiumTemplate({ invoice, accentColor }: InvoiceTemplateProps) {
  return (
    <div style={{ width: "100%", background: "#fff", padding: 22, fontFamily: '"Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, paddingBottom: 16, borderBottom: "1px solid rgba(148,163,184,0.4)" }}>
        <div>
          {invoice.business.logoUrl ? <img alt={invoice.business.name} src={invoice.business.logoUrl} style={{ width: 62, height: 62, objectFit: "contain", marginBottom: 8 }} /> : null}
          <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: 0.5 }}>{invoice.business.name}</div>
          {invoice.business.address && <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{invoice.business.address}</div>}
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>{[invoice.business.phone, invoice.business.email].filter(Boolean).join(" • ")}</div>
          {invoice.business.gstin && <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>GSTIN: {invoice.business.gstin}</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, letterSpacing: 2, color: accentColor, fontWeight: 780, textTransform: "uppercase" }}>Invoice</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 10 }}>{invoice.invoiceNumber}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 8 }}>{formatDate(invoice.date)}</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>Payment: {invoice.paymentMethod}</div>
        </div>
      </div>
      <div style={{ marginTop: 18 }}><CustomerBlock invoice={invoice} paperType="a4" accentColor={accentColor} /></div>
      <div style={{ marginTop: 18 }}><ItemTable items={invoice.items} paperType="a4" accentColor={accentColor} /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <div style={{ width: 300 }}>
          <TotalsSection invoice={invoice} accentColor={accentColor} paperType="a4" />
        </div>
      </div>
      <PaymentFooter invoice={invoice} accentColor={accentColor} paperType="a4" />
    </div>
  );
}

function dateText(date: string | Date) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(value);
}
