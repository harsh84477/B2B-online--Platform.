// Core wholesale POS calculations: money, GST slabs and Case/Piece intelligence.
// Stock is ALWAYS handled in base units (integers). Case/Piece is display + input only.

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export const formatMoney = (n: number) =>
  new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    round2(n || 0),
  );

export const rupees = (n: number) => `₹${formatMoney(n)}`;

/** Split total base units into pack + piece parts. */
export function splitQty(totalBaseUnits: number, packSize: number) {
  const size = Math.max(1, packSize || 1);
  const qty = Math.max(0, Math.trunc(totalBaseUnits || 0));
  return { packQty: Math.floor(qty / size), pieceQty: qty % size };
}

export function joinQty(packQty: number, pieceQty: number, packSize: number) {
  const size = Math.max(1, packSize || 1);
  return Math.max(0, Math.trunc(packQty || 0)) * size + Math.max(0, Math.trunc(pieceQty || 0));
}

/** "2 Case + 6 Piece" display string. */
export function formatQty(
  totalBaseUnits: number,
  packSize: number,
  packName = "Case",
  baseUnit = "PIECE",
) {
  const unit = baseUnit.charAt(0) + baseUnit.slice(1).toLowerCase();
  const size = Math.max(1, packSize || 1);
  if (size <= 1) return `${totalBaseUnits} ${unit}`;
  const { packQty, pieceQty } = splitQty(totalBaseUnits, size);
  if (packQty && pieceQty) return `${packQty} ${packName} + ${pieceQty} ${unit}`;
  if (packQty) return `${packQty} ${packName}`;
  return `${pieceQty} ${unit}`;
}

export const GST_SLABS = [0, 5, 12, 18, 28] as const;

export interface LineInput {
  quantity: number; // base units
  unitPrice: number; // per base unit
  discountPercent: number;
  gstPercent: number;
}

export interface LineTotals {
  gross: number;
  discountAmount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  gstAmount: number;
  totalAmount: number;
}

/** Item-wise GST, intra-state (CGST = SGST = GST/2), rounded to 2 dp per item. */
export function calcLine(line: LineInput): LineTotals {
  const inclusiveGross = round2(line.quantity * line.unitPrice);
  const inclusiveDiscount = round2((inclusiveGross * (line.discountPercent || 0)) / 100);
  const totalAmount = round2(inclusiveGross - inclusiveDiscount); // inclusive net
  
  const taxableAmount = round2(totalAmount / (1 + (line.gstPercent || 0) / 100));
  const gstAmount = round2(totalAmount - taxableAmount);
  const cgst = round2(gstAmount / 2);
  const sgst = round2(gstAmount - cgst);

  // We want `gross` to be Taxable Gross, and `discountAmount` to be Taxable Discount
  const taxableGross = round2(inclusiveGross / (1 + (line.gstPercent || 0) / 100));
  const taxableDiscount = round2(taxableGross - taxableAmount);

  return {
    gross: taxableGross,
    discountAmount: taxableDiscount,
    taxableAmount,
    cgst,
    sgst,
    gstAmount,
    totalAmount,
  };
}

export interface BillTotals {
  subTotal: number;
  totalDiscount: number;
  totalGst: number;
  totalCgst: number;
  totalSgst: number;
  beforeRound: number;
  roundOff: number;
  grandTotal: number;
}

/** Bill totals with standard Indian round-off to the nearest rupee (₹0.50+ rounds up). */
export function calcBill(lines: LineTotals[]): BillTotals {
  const subTotal = round2(lines.reduce((s, l) => s + l.gross, 0));
  const totalDiscount = round2(lines.reduce((s, l) => s + l.discountAmount, 0));
  const totalCgst = round2(lines.reduce((s, l) => s + l.cgst, 0));
  const totalSgst = round2(lines.reduce((s, l) => s + l.sgst, 0));
  const totalGst = round2(totalCgst + totalSgst);
  const beforeRound = round2(lines.reduce((s, l) => s + l.totalAmount, 0));
  const grandTotal = Math.round(beforeRound);
  return {
    subTotal,
    totalDiscount,
    totalGst,
    totalCgst,
    totalSgst,
    beforeRound,
    roundOff: round2(grandTotal - beforeRound),
    grandTotal,
  };
}

export const PAYMENT_MODES = [
  "CASH",
  "UPI",
  "CREDIT",
  "CHEQUE",
  "BANK_TRANSFER",
  "SPLIT",
] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const paymentLabel = (m: string) =>
  m
    .split("_")
    .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
    .join(" ");
