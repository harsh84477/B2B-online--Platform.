import * as XLSX from "xlsx";

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ProductImportRow = {
  name: string;
  sku: string;
  barcode: string;
  brand: string;
  category: string;
  hsn_code: string;
  purchase_price: number;
  wholesale_price: number;
  selling_price: number;
  mrp: number;
  gst_percent: number;
  base_unit: string;
  pack_name: string;
  pack_size: number;
  current_stock: number;
  status: "Active" | "Inactive";
};

const normalizeCsvHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const findCsvValue = (record: Record<string, string>, aliases: string[]) => {
  const normalized = aliases.map(normalizeCsvHeader);
  for (const key of Object.keys(record)) {
    if (normalized.includes(normalizeCsvHeader(key))) return (record[key] ?? "").trim();
  }
  return "";
};

const parseCurrencyValue = (value: unknown) => {
  const clean = String(value ?? "").replace(/[₹$,%\s]/g, "").trim();
  if (!clean) return 0;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseIntegerValue = (value: unknown, fallback = 0) => {
  const parsed = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
};

const parseBaseUnit = (value: unknown) => {
  const clean = String(value ?? "").trim().toUpperCase();
  const mapping: Record<string, string> = {
    PIECE: "PIECE",
    KG: "KG",
    LITRE: "LITRE",
    LTR: "LITRE",
    LITER: "LITRE",
    GRAM: "GRAM",
    GM: "GRAM",
    G: "GRAM",
    ML: "ML",
    BOX: "BOX",
    BUNDLE: "BUNDLE",
  };
  return mapping[clean] ?? (clean || "PIECE");
};

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentValue += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      currentRow.push(currentValue);
      if (currentRow.some((cell) => cell.trim() !== "")) rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  currentRow.push(currentValue);
  if (currentRow.some((cell) => cell.trim() !== "")) rows.push(currentRow);

  return rows;
}

function parseSpreadsheetRows(rows: (string | number)[][]): ProductImportRow[] {
  if (rows.length < 2) return [];

  const headerRow = rows[0].map((cell) => String(cell ?? "").trim());
  const headerKeys = headerRow.map(normalizeCsvHeader);

  return rows
    .slice(1)
    .map((row) => {
      const record: Record<string, string> = {};
      headerKeys.forEach((key, index) => {
        record[key] = String(row[index] ?? "");
      });

      const name = findCsvValue(record, ["name", "product name", "item name", "product"]);
      const sku = findCsvValue(record, ["sku", "product sku", "item code", "code"]);
      if (!name || !sku) return null;

      const category = findCsvValue(record, ["category", "category name", "group", "department"]);
      const brand = findCsvValue(record, ["brand", "manufacturer"]);
      const barcode = findCsvValue(record, ["barcode", "bar code"]);
      const hsnCode = findCsvValue(record, ["hsn", "hsn code", "hsn_code"]);
      const packName = findCsvValue(record, ["pack", "pack name", "pack_name", "packaging", "packing"]);
      const packSize = parseIntegerValue(
        findCsvValue(record, ["pack size", "packsize", "pack_size", "pieces per pack", "pieces_in_pack"]),
        1,
      );
      const purchasePrice = parseCurrencyValue(findCsvValue(record, ["purchase", "purchase price", "purchase_price"]));
      const wholesalePrice = parseCurrencyValue(findCsvValue(record, ["wholesale", "wholesale price", "wholesale_price"]));
      const sellingPrice = parseCurrencyValue(
        findCsvValue(record, ["retail", "retail price", "selling", "selling price", "retail_price", "selling_price"]),
      );
      const mrp = parseCurrencyValue(findCsvValue(record, ["mrp"]));
      const gstPercent = parseCurrencyValue(findCsvValue(record, ["gst", "gst %", "gst_percent", "gst percentage"]));
      const baseUnit = parseBaseUnit(findCsvValue(record, ["base unit", "unit", "base_unit", "unit type"]));
      const currentStock = parseIntegerValue(findCsvValue(record, ["stock", "current stock", "qty", "quantity"]), 0);
      const status = findCsvValue(record, ["status"]).toLowerCase() === "inactive" ? "Inactive" : "Active";

      return {
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim(),
        brand: brand.trim(),
        category: category.trim(),
        hsn_code: hsnCode.trim(),
        purchase_price: purchasePrice,
        wholesale_price: wholesalePrice,
        selling_price: sellingPrice,
        mrp: mrp || sellingPrice,
        gst_percent: gstPercent,
        base_unit: baseUnit,
        pack_name: packName || "Case",
        pack_size: Math.max(1, packSize || 1),
        current_stock: Math.max(0, currentStock),
        status,
      };
    })
    .filter((row): row is ProductImportRow => !!row);
}

export function parseProductCsvText(text: string): ProductImportRow[] {
  const rows = parseCsvRows(text);
  return parseSpreadsheetRows(rows);
}

export async function parseProductFile(file: File): Promise<ProductImportRow[]> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".csv") || lowerName.endsWith(".txt")) {
    const text = await file.text();
    return parseProductCsvText(text);
  }

  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: "" }) as (string | number)[][];
    return parseSpreadsheetRows(rows);
  }

  return [];
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const todayIso = () => new Date().toISOString().slice(0, 10);

export function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export const dateLabel = (v: string | Date) =>
  new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export const dateTimeLabel = (v: string | Date) =>
  new Date(v).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
