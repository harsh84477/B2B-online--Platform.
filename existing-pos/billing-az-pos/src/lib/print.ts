import jsPDF from "jspdf";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceRenderer, normalizeThemeColor, resolveInvoiceTemplateId, type InvoiceData, type InvoiceTemplateId } from "@/components/invoice/InvoiceRenderer";
import { formatMoney, formatQty, rupees } from "./pos";
import type { ShopProfileRow } from "./queries";
import type { CartLine } from "./bill";
import { cartTotals, lineTotals } from "./bill";

export interface PrintPayload {
  invoiceNumber: string;
  date: Date;
  customerName: string;
  customerMobile?: string | null;
  customerGstin?: string | null;
  customerAddress?: string | null;
  paymentMode: string;
  amountPaid: number;
  amountDue: number;
  lines: CartLine[];
  shop: ShopProfileRow | null;
  printSettings?: Record<string, string | number | boolean | null>;
}

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s.padEnd(n));
const padL = (s: string, n: number) => (s.length > n ? s.slice(-n) : s.padStart(n));
const RULE = "--------------------------------";

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

function resolvePrintSettings(settings: Record<string, string | number | boolean | null> = {}) {
  const paperValue = typeof settings.paper === "string" ? settings.paper : "";
  const printType = settings.print_type === "a5"
    ? "a5"
    : settings.print_type === "a4"
      ? "a4"
      : settings.print_type === "thermal"
        ? "thermal"
        : paperValue === "Thermal 80mm" || paperValue === "Thermal 58mm" || paperValue === "Thermal 112mm"
          ? "thermal"
          : paperValue === "A5 Portrait" || paperValue === "A5"
            ? "a5"
            : "a4";
  const templateId = typeof settings.template_id === "string"
    ? settings.template_id
    : printType === "thermal"
      ? "classic-receipt"
      : printType === "a5"
        ? "paper-saving"
        : "professional";
  const thermalWidth = String(settings.thermal_width ?? (paperValue.includes("58") ? "58mm" : paperValue.includes("112") ? "112mm" : "80mm"));
  const themeName = String(settings.theme_color ?? "Blue");
  const customColor = typeof settings.custom_theme_color === "string" ? settings.custom_theme_color : "#2563eb";
  const accent = themeName === "Custom" ? customColor : THEME_COLOR_MAP[themeName] ?? "#2563eb";

  return {
    printType,
    templateId,
    thermalWidth,
    accent,
  };
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const expanded = value.length === 3 ? value.split("").map((ch) => ch + ch).join("") : value;
  const numeric = Number.parseInt(expanded, 16);
  return {
    r: (numeric >> 16) & 255,
    g: (numeric >> 8) & 255,
    b: numeric & 255,
  };
}

function buildInvoiceData(p: PrintPayload): InvoiceData {
  const totals = cartTotals(p.lines ?? []);
  const shop = p.shop;
  const customerGstin = p.customerGstin ?? "";
  const shopGstin = shop?.gstin ?? "";
  const sameState = !!(shopGstin && customerGstin && shopGstin.slice(0, 2) === customerGstin.slice(0, 2));
  const invoiceData: InvoiceData = {
    invoiceNumber: p.invoiceNumber,
    date: p.date,
    paymentMethod: p.paymentMode,
    business: {
      name: shop?.shop_name ?? "BillingAZ",
      address: shop?.address ?? "",
      phone: shop?.phone ?? "",
      email: shop?.email ?? "",
      gstin: shop?.gstin ?? "",
      bankName: shop?.bank_name ?? "",
      bankAccount: shop?.bank_account ?? "",
      ifsc: shop?.ifsc ?? "",
      upiId: (shop as { upi_id?: string } | null)?.upi_id ?? "",
      terms: shop?.terms ?? "",
      logoUrl: (shop as { logo_url?: string } | null)?.logo_url ?? "",
    },
    customer: {
      name: p.customerName || "Walk-in Customer",
      phone: p.customerMobile ?? "",
      address: p.customerAddress ?? "",
      gstin: p.customerGstin ?? "",
      state: "",
      stateCode: "",
    },
    items: p.lines.map((line) => {
      const itemTotals = lineTotals(line);
      return {
        name: line.product.name,
        sku: line.product.sku,
        hsn: line.product.hsn_code ?? "",
        quantity: line.quantity,
        unit: line.product.base_unit,
        rate: Number(line.unitPrice),
        discount: Number(line.discountPercent || 0),
        gstPercent: Number(line.product.gst_percent || 0),
        amount: Number(itemTotals.totalAmount),
      };
    }),
    totals: {
      subtotal: Number(totals.subTotal || 0),
      discount: Number(totals.totalDiscount || 0),
      cgst: Number(totals.totalCgst || 0),
      sgst: Number(totals.totalSgst || 0),
      igst: 0,
      roundOff: Number(totals.roundOff || 0),
      grandTotal: Number(totals.grandTotal || 0),
      paid: Number(p.amountPaid || 0),
      balance: Number(p.amountDue || 0),
    },
    notes: shop?.terms ?? "",
    amountInWords: "",
    taxType: sameState ? "local" : "interstate",
  };
  invoiceData.totals.igst = 0;
  return invoiceData;
}

function buildTemplateHtml(p: PrintPayload, settings: Record<string, string | number | boolean | null> = p.printSettings ?? {}) {
  const resolved = resolvePrintSettings(settings);
  const invoice = buildInvoiceData(p);
  const templateId = resolveInvoiceTemplateId(resolved.templateId, resolved.printType as "thermal" | "a4" | "a5") as InvoiceTemplateId;
  const accent = normalizeThemeColor(resolved.accent);
  const markup = renderToStaticMarkup(
    InvoiceRenderer({
      invoice,
      templateId,
      paperType: resolved.printType as "thermal" | "a4" | "a5",
      thermalWidth: (resolved.thermalWidth as "58mm" | "80mm" | "112mm") ?? "80mm",
      accentColor: accent,
    }),
  );

  const pageCss = resolved.printType === "thermal"
    ? `@page { size: ${resolved.thermalWidth} auto; margin: 0; } body { margin: 0; background: #fff; } * { box-sizing: border-box; } .invoice-root { width: ${resolved.thermalWidth === "58mm" ? "58mm" : resolved.thermalWidth === "112mm" ? "112mm" : "80mm"}; max-width: 100%; margin: 0 auto; break-inside: avoid; page-break-inside: avoid; }`
    : resolved.printType === "a5"
      ? `@page { size: A5 portrait; margin: 0; } body { margin: 0; background: #f3f4f6; } * { box-sizing: border-box; } .invoice-root { width: 148mm; min-height: 210mm; margin: 0 auto; background: #fff; break-inside: avoid; page-break-inside: avoid; }`
      : `@page { size: A4 portrait; margin: 0; } body { margin: 0; background: #f3f4f6; } * { box-sizing: border-box; } .invoice-root { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; break-inside: avoid; page-break-inside: avoid; }`;

  return `<!doctype html><html><head><meta charset="utf-8" /><title>${p.invoiceNumber}</title><style>${pageCss}</style></head><body><div class="invoice-root">${markup}</div></body></html>`;
}

/** 80mm thermal receipt as monospace text (32 chars wide). */
export function thermalText(p: PrintPayload): string {
  const shop = p.shop;
  const out: string[] = [];
  const center = (s: string) => s.slice(0, 32).padStart(Math.floor((32 + Math.min(s.length, 32)) / 2)).padEnd(32);
  out.push(center((shop?.shop_name ?? "BillingAZ").toUpperCase()));
  if (shop?.address) {
    shop.address.match(/.{1,32}/g)?.forEach((l) => out.push(center(l.trim())));
  }
  if (shop?.phone) out.push(center(`Ph: ${shop.phone}`));
  if (shop?.gstin) out.push(center(`GSTIN: ${shop.gstin}`));
  out.push(RULE);
  out.push(`Bill: ${p.invoiceNumber}`);
  out.push(`Date: ${p.date.toLocaleString("en-IN")}`);
  out.push(`Cust: ${p.customerName}`);
  if (p.customerMobile) out.push(`Mob : ${p.customerMobile}`);
  out.push(`Mode: ${p.paymentMode}`);
  out.push(RULE);
  out.push(`${pad("Item", 14)}${padL("Qty", 4)}${padL("Rate", 6)}${padL("Amt", 8)}`);
  out.push(RULE);
  for (const l of p.lines) {
    const t = lineTotals(l);
    out.push(
      `${pad(l.product.name, 14)}${padL(String(l.quantity), 4)}${padL(formatMoney(l.unitPrice), 6)}${padL(formatMoney(t.totalAmount), 8)}`,
    );
    if (l.product.pack_size > 1) {
      out.push(`  ${formatQty(l.quantity, l.product.pack_size, l.product.pack_name, l.product.base_unit)}`);
    }
  }
  const totals = cartTotals(p.lines);
  out.push(RULE);
  const row = (label: string, value: string) => `${pad(label, 20)}${padL(value, 12)}`;
  out.push(row("Subtotal", formatMoney(totals.subTotal)));
  if (totals.totalDiscount) out.push(row("Discount", `-${formatMoney(totals.totalDiscount)}`));
  out.push(row("CGST", formatMoney(totals.totalCgst)));
  out.push(row("SGST", formatMoney(totals.totalSgst)));
  out.push(row("Round Off", formatMoney(totals.roundOff)));
  out.push(RULE);
  out.push(row("GRAND TOTAL", formatMoney(totals.grandTotal)));
  out.push(row("Paid", formatMoney(p.amountPaid)));
  if (p.amountDue > 0) out.push(row("Balance Due", formatMoney(p.amountDue)));
  out.push(RULE);
  out.push(center("Thank You! Visit Again"));
  if (shop?.terms) shop.terms.match(/.{1,32}/g)?.forEach((l) => out.push(center(l.trim())));
  return out.join("\n");
}

/** Opens a print window sized for the selected thermal width. */
export function printThermal(p: PrintPayload, settings: Record<string, string | number | boolean | null> = p.printSettings ?? {}) {
  const resolved = resolvePrintSettings(settings);
  const widthMm = resolved.thermalWidth === "58mm" ? 58 : resolved.thermalWidth === "112mm" ? 112 : 80;
  const w = window.open("", "_blank", `width=${Math.min(560, 100 + widthMm * 4)},height=900`);
  if (!w) return;
  w.document.write(buildTemplateHtml(p, settings));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

/** Raw ESC/POS over Web Serial, when a thermal printer is attached. */
export async function printEscPos(p: PrintPayload) {
  const nav = navigator as Navigator & { serial?: { requestPort(): Promise<SerialPortLike> } };
  if (!nav.serial) throw new Error("This browser does not support direct printer access.");
  const port = await nav.serial.requestPort();
  await port.open({ baudRate: 9600 });
  const encoder = new TextEncoder();
  const writer = port.writable.getWriter();
  const ESC = "\x1b";
  await writer.write(encoder.encode(`${ESC}@`));
  await writer.write(encoder.encode(`${thermalText(p)}\n\n\n\n`));
  await writer.write(new Uint8Array([0x1d, 0x56, 0x00]));
  writer.releaseLock();
  await port.close();
}

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array>;
}

/** Professional A4 tax invoice. */
export function buildInvoicePdf(p: PrintPayload, settings: Record<string, string | number | boolean | null> = p.printSettings ?? {}): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const shop = p.shop;
  const resolved = resolvePrintSettings(settings);
  const accentRgb = hexToRgb(resolved.accent);
  const M = 14;
  let y = 18;

  doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b).rect(0, 0, 210, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(18);
  doc.text(shop?.shop_name ?? "BillingAZ", M, y + 6);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal").setFontSize(9);
  y += 10;
  if (shop?.address) {
    doc.text(doc.splitTextToSize(shop.address, 110) as string[], M, y);
    y += 4 * (doc.splitTextToSize(shop.address, 110) as string[]).length;
  }
  if (shop?.phone) {
    doc.text(`Phone: ${shop.phone}`, M, y);
    y += 4;
  }
  if (shop?.gstin) {
    doc.text(`GSTIN: ${shop.gstin}`, M, y);
    y += 4;
  }

  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text("TAX INVOICE", 196, 18, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(`Invoice No: ${p.invoiceNumber}`, 196, 24, { align: "right" });
  doc.text(`Date: ${p.date.toLocaleString("en-IN")}`, 196, 29, { align: "right" });
  doc.text(`Payment: ${p.paymentMode}`, 196, 34, { align: "right" });

  y = Math.max(y, 40) + 2;
  doc.setDrawColor(190).line(M, y, 196, y);
  y += 6;

  doc.setFont("helvetica", "bold").text("Bill To", M, y);
  doc.setFont("helvetica", "normal");
  y += 5;
  doc.text(p.customerName, M, y);
  y += 4;
  if (p.customerAddress) {
    const lines = doc.splitTextToSize(p.customerAddress, 90) as string[];
    doc.text(lines, M, y);
    y += 4 * lines.length;
  }
  if (p.customerMobile) {
    doc.text(`Mobile: ${p.customerMobile}`, M, y);
    y += 4;
  }
  if (p.customerGstin) {
    doc.text(`GSTIN: ${p.customerGstin}`, M, y);
    y += 4;
  }

  y += 4;
  const cols = [M, M + 8, M + 76, M + 92, M + 110, M + 126, M + 142, M + 158, 196];
  doc.setFillColor(accentRgb.r, accentRgb.g, accentRgb.b).rect(M, y - 4.5, 182, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("#", cols[0]! + 1, y);
  doc.text("Item", cols[1]! + 1, y);
  doc.text("HSN", cols[2]! + 1, y);
  doc.text("Qty", cols[3]! + 14, y, { align: "right" });
  doc.text("Rate", cols[4]! + 14, y, { align: "right" });
  doc.text("Disc", cols[5]! + 12, y, { align: "right" });
  doc.text("GST", cols[6]! + 12, y, { align: "right" });
  doc.text("Amount", 195, y, { align: "right" });
  y += 6;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");

  p.lines.forEach((l, i) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    const t = lineTotals(l);
    doc.text(String(i + 1), cols[0]! + 1, y);
    doc.text(doc.splitTextToSize(l.product.name, 62)[0] as string, cols[1]! + 1, y);
    doc.text(l.product.hsn_code ?? "-", cols[2]! + 1, y);
    doc.text(String(l.quantity), cols[3]! + 14, y, { align: "right" });
    doc.text(formatMoney(l.unitPrice), cols[4]! + 14, y, { align: "right" });
    doc.text(`${l.discountPercent}%`, cols[5]! + 12, y, { align: "right" });
    doc.text(`${l.product.gst_percent}%`, cols[6]! + 12, y, { align: "right" });
    doc.text(formatMoney(t.totalAmount), 195, y, { align: "right" });
    y += 4.4;
    if (l.product.pack_size > 1) {
      doc.setTextColor(120);
      doc.text(
        formatQty(l.quantity, l.product.pack_size, l.product.pack_name, l.product.base_unit),
        cols[1]! + 1,
        y,
      );
      doc.setTextColor(0);
      y += 4.4;
    }
  });

  const totals = cartTotals(p.lines);
  y += 2;
  doc.setDrawColor(190).line(120, y, 196, y);
  y += 5;
  const trow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, 130, y);
    doc.text(value, 195, y, { align: "right" });
    y += 5;
  };
  trow("Subtotal", formatMoney(totals.subTotal));
  trow("Discount", `-${formatMoney(totals.totalDiscount)}`);
  trow("CGST", formatMoney(totals.totalCgst));
  trow("SGST", formatMoney(totals.totalSgst));
  trow("Round Off", formatMoney(totals.roundOff));
  trow("Grand Total", formatMoney(totals.grandTotal), true);
  trow("Paid", formatMoney(p.amountPaid));
  if (p.amountDue > 0) trow("Balance Due", formatMoney(p.amountDue), true);

  y += 10;
  doc.setFontSize(8).setFont("helvetica", "normal");
  if (shop?.terms) doc.text(`Terms: ${shop.terms}`, M, y);
  doc.text("Customer Signature", M, 275);
  doc.text(`For ${shop?.shop_name ?? "BillingAZ"}`, 196, 275, { align: "right" });
  doc.setDrawColor(160).line(M, 271, M + 45, 271).line(150, 271, 196, 271);
  return doc;
}

export function openInvoicePdf(p: PrintPayload, settings: Record<string, string | number | boolean | null> = p.printSettings ?? {}) {
  const doc = buildInvoicePdf(p, settings);
  window.open(doc.output("bloburl") as unknown as string, "_blank");
}

export function printInvoiceBySettings(p: PrintPayload, settings: Record<string, string | number | boolean | null> = p.printSettings ?? {}) {
  const resolved = resolvePrintSettings(settings);
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return;
  const html = buildTemplateHtml(p, settings);
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

export function shareOnWhatsApp(p: PrintPayload, settings: Record<string, string | number | boolean | null> = p.printSettings ?? {}) {
  const doc = buildInvoicePdf(p, settings);
  doc.save(`${p.invoiceNumber}.pdf`);
  const totals = cartTotals(p.lines);
  const template =
    p.shop?.whatsapp_template ??
    "Hello {{customerName}}, thank you for your purchase at {{shopName}}. Invoice {{invoiceNumber}} for Rs {{amount}}.";
  const message = template
    .replace(/{{customerName}}/g, p.customerName)
    .replace(/{{shopName}}/g, p.shop?.shop_name ?? "BillingAZ")
    .replace(/{{invoiceNumber}}/g, p.invoiceNumber)
    .replace(/{{amount}}/g, formatMoney(totals.grandTotal));
  const mobile = (p.customerMobile ?? "").replace(/\D/g, "");
  const to = mobile.length === 10 ? `91${mobile}` : mobile;
  window.open(`https://wa.me/${to}?text=${encodeURIComponent(message)}`, "_blank");
}

export function printPaperSavingReceipt(p: PrintPayload) {
  const shop = p.shop;
  const totals = cartTotals(p.lines);
  const dateStr = p.date.toLocaleDateString("en-IN");
  const timeStr = p.date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
 const title = "ESTIMATE";

 const rowsHtml = p.lines
   .map((line, index) => {
     const itemTotals = lineTotals(line);
     const packSize = Number(line.product.pack_size || 1);
     const totalUnits = Number(line.quantity || 0);
     const caseQty = packSize > 1 ? Math.floor(totalUnits / packSize) : 0;
     const pcsQty = packSize > 1 ? totalUnits % packSize : totalUnits;
     const mrp = Number(line.product.mrp || line.unitPrice || 0);
     return `
       <tr>
         <td>${index + 1}</td>
         <td>${caseQty}</td>
         <td>${pcsQty.toFixed(2).replace(/\.00$/, ".00")}</td>
         <td class="name-col">${line.product.name}</td>
         <td>${formatMoney(mrp)}</td>
         <td>${formatMoney(line.unitPrice)}</td>
         <td>${formatMoney(itemTotals.totalAmount)}</td>
       </tr>
     `;
   })
   .join("");

 const amountInWords = "";
 const qrHtml = (shop as { upi_id?: string | null } | null | undefined)?.upi_id && p.paymentMode === "UPI"
   ? `
     <div class="qr-box">
       <div class="qr-title">UPI</div>
       <div class="qr-code"></div>
     </div>
   `
   : "";

 const html = `<!doctype html>
<html lang="en">
<head>
 <meta charset="utf-8" />
 <title>${p.invoiceNumber}</title>
 <style>
   @page {
     size: A5 portrait;
     margin: 6mm;
   }
   @media print {
     html, body {
       margin: 0;
       padding: 0;
       background: #fff;
     }
   }
   * { box-sizing: border-box; }
   body {
     margin: 0;
     background: #fff;
     color: #111827;
     font-family: Arial, Helvetica, sans-serif;
     font-size: 10.5px;
     line-height: 1.25;
   }
   .page {
     width: 148mm;
     min-height: 210mm;
     margin: 0 auto;
     padding: 7mm 6mm 5mm;
     background: white;
   }
   .header {
     display: flex;
     justify-content: space-between;
     align-items: flex-start;
     gap: 8px;
     padding-bottom: 5px;
     border-bottom: 1px solid #d1d5db;
   }
   .brand {
     display: flex;
     align-items: center;
     gap: 8px;
     min-width: 0;
     flex: 1;
   }
   .logo {
     width: 18px;
     height: 18px;
     border-radius: 4px;
     background: #111827;
     color: #fff;
     display: grid;
     place-items: center;
     font-size: 8px;
     font-weight: 700;
     flex-shrink: 0;
   }
   .brand-meta {
     min-width: 0;
     flex: 1;
   }
   .title {
     font-size: 18px;
     font-weight: 800;
     letter-spacing: 0.5px;
     text-transform: uppercase;
     margin: 0;
     color: #111827;
   }
   .contact {
     font-size: 8px;
     color: #475569;
     white-space: nowrap;
     overflow: hidden;
     text-overflow: ellipsis;
   }
   .header-meta {
     text-align: right;
     font-size: 8px;
     color: #374151;
     min-width: 78px;
   }
   .header-meta strong {
     font-size: 8.5px;
     color: #111827;
   }
   .customer {
     display: grid;
     grid-template-columns: 1fr 1fr;
     gap: 8px;
     margin-top: 7px;
     font-size: 8px;
     color: #374151;
   }
   .label {
     font-size: 7px;
     font-weight: 700;
     letter-spacing: 0.8px;
     text-transform: uppercase;
     color: #64748b;
     margin-bottom: 3px;
   }
   .customer-box {
     background: #f8fafc;
     border: 1px solid #e2e8f0;
     border-radius: 4px;
     padding: 5px 6px;
     min-height: 42px;
   }
   .customer-box strong {
     color: #111827;
     font-size: 9px;
   }
   .table-wrap {
     margin-top: 8px;
     border: 1px solid #d1d5db;
     border-radius: 4px;
     overflow: hidden;
   }
   table {
     width: 100%;
     border-collapse: collapse;
     table-layout: fixed;
   }
   thead th {
     background: #f8fafc;
     color: #0f172a;
     font-size: 7px;
     font-weight: 800;
     letter-spacing: 0.3px;
     text-transform: uppercase;
     text-align: center;
     padding: 4px 3px;
     border-bottom: 1px solid #d1d5db;
   }
   tbody td {
     padding: 4px 3px;
     border-bottom: 1px solid #e5e7eb;
     font-size: 8px;
     vertical-align: top;
     text-align: center;
     word-break: break-word;
   }
   tbody tr:last-child td { border-bottom: none; }
   .name-col {
     text-align: left;
     padding-left: 5px;
     font-weight: 600;
   }
   .totals {
     width: 100%;
     margin-top: 8px;
     padding-top: 4px;
     border-top: 1px solid #d1d5db;
     font-size: 8px;
   }
   .totals-row {
     display: flex;
     justify-content: space-between;
     gap: 8px;
     padding: 2px 0;
     color: #334155;
   }
   .totals-row.grand {
     font-size: 10px;
     font-weight: 800;
     color: #111827;
     border-top: 1px solid #d1d5db;
     margin-top: 4px;
     padding-top: 5px;
   }
   .footer {
     margin-top: 8px;
     font-size: 7.5px;
     color: #475569;
     border-top: 1px solid #d1d5db;
     padding-top: 5px;
   }
   .payment {
     display: flex;
     justify-content: space-between;
     gap: 8px;
     margin-top: 5px;
     font-size: 7.5px;
     color: #374151;
   }
   .qr-box {
     display: flex;
     align-items: center;
     justify-content: space-between;
     margin-top: 5px;
     padding-top: 5px;
     border-top: 1px solid #d1d5db;
   }
   .qr-title {
     font-size: 7.5px;
     font-weight: 800;
     text-transform: uppercase;
     letter-spacing: 0.8px;
     color: #475569;
   }
   .qr-code {
     width: 34px;
     height: 34px;
     border: 1px solid #111827;
     background: repeating-linear-gradient(
       90deg,
       #111827 0 4px,
       transparent 4px 6px,
       #111827 6px 10px,
       transparent 10px 12px
     );
     border-radius: 3px;
     opacity: 0.9;
   }
   .muted { color: #64748b; }
 </style>
</head>
<body>
 <div class="page">
   <header class="header">
     <div class="brand">
       <div class="logo">${(shop?.shop_name ?? "B").slice(0, 1).toUpperCase()}</div>
       <div class="brand-meta">
         <h1 class="title">${title}</h1>
         <div class="contact">${shop?.phone ? `Mob: ${shop.phone}` : "Phone: N/A"}</div>
         <div class="contact">${shop?.shop_name ?? "Business Name"}</div>
       </div>
     </div>
     <div class="header-meta">
       <div><strong>Invoice No.</strong> ${p.invoiceNumber}</div>
       <div><strong>Date</strong> ${dateStr}</div>
     </div>
   </header>

   <section class="customer">
     <div class="customer-box">
       <div class="label">Customer</div>
       <div><strong>${p.customerName}</strong></div>
     </div>
     <div class="customer-box">
       <div class="label">Address / Mobile</div>
       <div>${p.customerAddress || "—"}</div>
       <div>${p.customerMobile || "—"}</div>
     </div>
   </section>

   <div class="table-wrap">
     <table>
       <thead>
         <tr>
           <th style="width: 8%">S.</th>
           <th style="width: 10%">Case</th>
           <th style="width: 10%">Pcs</th>
           <th style="width: 34%">Item Description</th>
           <th style="width: 12%">M.R.P</th>
           <th style="width: 12%">Rate</th>
           <th style="width: 14%">Amount</th>
         </tr>
       </thead>
       <tbody>
         ${rowsHtml}
       </tbody>
     </table>
   </div>

   <div class="totals">
     <div class="totals-row"><span>Sub Total</span><span>₹ ${formatMoney(totals.subTotal)}</span></div>
     <div class="totals-row"><span>Discount</span><span>₹ ${formatMoney(totals.totalDiscount)}</span></div>
     <div class="totals-row grand"><span>Grand Total</span><span>₹ ${formatMoney(totals.grandTotal)}</span></div>
   </div>

   <div class="payment">
     <span>Mode: ${p.paymentMode}</span>
     <span>Paid: ₹ ${formatMoney(p.amountPaid)}</span>
   </div>

   ${amountInWords ? `<div class="footer">Amount in Words: ${amountInWords}</div>` : ""}
   ${qrHtml}

   <div class="footer">
     <div>Business: ${shop?.shop_name ?? "Business Name"}</div>
     <div>${shop?.gstin ? `GSTIN: ${shop.gstin}` : "GSTIN: N/A"}</div>
     <div>${shop?.terms ?? "Goods once sold will not be taken back."}</div>
   </div>
 </div>

 <script>
   window.onload = function () {
     setTimeout(() => window.print(), 250);
   };
 </script>
</body>
</html>`;

 const w = window.open("", "_blank", "width=720,height=900");
 if (!w) return;
 w.document.write(html);
 w.document.close();
 w.focus();
}
