import { supabase } from "@/integrations/supabase/client";
import type { ProductRow, CustomerRow } from "./queries";
import { calcBill, calcLine, round2, type LineTotals } from "./pos";

export interface CartLine {
  product: ProductRow;
  quantity: number; // base units
  unitPrice: number;
  discountPercent: number;
}

export interface PaymentSplit {
  mode: string;
  amount: number;
  referenceNumber?: string;
}

export interface SavedBill {
  id: string;
  invoice_number: string;
}

export function lineTotals(line: CartLine): LineTotals {
  return calcLine({
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountPercent: line.discountPercent,
    gstPercent: Number(line.product.gst_percent),
  });
}

export function cartTotals(lines: CartLine[]) {
  return calcBill(lines.map(lineTotals));
}

export async function saveBill(opts: {
  lines: CartLine[];
  customer: CustomerRow | null;
  paymentMode: string;
  payments: PaymentSplit[];
  amountPaid: number;
  billType: "SALE" | "HOLD";
  notes?: string;
}): Promise<SavedBill> {
  // MRP ceiling validation (defense-in-depth)
  for (const l of opts.lines) {
    const mrp = Number(l.product.mrp);
    if (mrp > 0 && l.unitPrice > mrp) {
      throw new Error(
        `Rate (₹${l.unitPrice}) exceeds MRP (₹${mrp}) for "${l.product.name}". Selling above MRP is not allowed.`,
      );
    }
  }

  const totals = cartTotals(opts.lines);
  const amountPaid = opts.billType === "HOLD" ? 0 : round2(opts.amountPaid);
  const amountDue = opts.billType === "HOLD" ? 0 : round2(totals.grandTotal - amountPaid);
  const paymentStatus = amountDue <= 0 ? "PAID" : amountPaid > 0 ? "PARTIAL" : "UNPAID";

  const items = opts.lines.map((l) => {
    const t = lineTotals(l);
    const size = Math.max(1, l.product.pack_size || 1);
    return {
      product_id: l.product.id,
      product_name: l.product.name,
      sku: l.product.sku,
      hsn_code: l.product.hsn_code,
      quantity: l.quantity,
      pack_quantity: Math.floor(l.quantity / size),
      piece_quantity: l.quantity % size,
      pack_size: size,
      pack_name: l.product.pack_name,
      unit_price: l.unitPrice,
      discount_percent: l.discountPercent,
      discount_amount: t.discountAmount,
      gst_percent: Number(l.product.gst_percent),
      taxable_amount: t.taxableAmount,
      cgst: t.cgst,
      sgst: t.sgst,
      total_amount: t.totalAmount,
    };
  });

  const { data, error } = await supabase.rpc("create_bill", {
    p_bill: {
      customer_id: opts.customer?.id ?? null,
      customer_name: opts.customer?.name ?? "Walk-in Customer",
      customer_gstin: opts.customer?.gstin ?? null,
      customer_address: opts.customer?.address ?? null,
      customer_mobile: opts.customer?.mobile ?? null,
      sub_total: totals.subTotal,
      total_discount: totals.totalDiscount,
      total_gst: totals.totalGst,
      round_off: totals.roundOff,
      grand_total: totals.grandTotal,
      payment_mode: opts.paymentMode,
      amount_paid: amountPaid,
      amount_due: amountDue,
      payment_status: paymentStatus,
      bill_type: opts.billType,
      notes: opts.notes ?? null,
    },
    p_items: items,
    p_payments: opts.billType === "HOLD" ? [] : opts.payments.filter((p) => p.amount > 0),
  } as never);

  if (error) throw error;
  return data as unknown as SavedBill;
}
