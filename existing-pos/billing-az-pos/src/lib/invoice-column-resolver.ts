/**
 * Invoice column resolver for templates
 * 
 * This module provides utilities to:
 * 1. Resolve which columns should be rendered
 * 2. Format invoice data based on column configuration
 * 3. Generate table layouts for different paper sizes
 */

import type { InvoiceItem, InvoiceData } from "@/components/invoice/InvoiceRenderer";
import {
  type InvoiceColumnsSettings,
  type InvoiceColumnId,
  type InvoiceColumnConfig,
  resolveEnabledColumns,
  getColumnDefinition,
  INVOICE_COLUMN_REGISTRY,
} from "@/lib/invoice-columns";
import { formatMoney } from "@/lib/pos";

export interface ResolvedColumnData {
  columnId: InvoiceColumnId;
  label: string;
  alignment: "left" | "center" | "right";
  width: string | number;
  value: string | number | null;
  formatted: string;
}

/**
 * Resolve column value from invoice item data
 */
export function resolveColumnValue(
  item: InvoiceItem,
  index: number,
  columnId: InvoiceColumnId,
): string | number | null {
  switch (columnId) {
    case "sno":
      return index + 1;
    case "product":
      return item.name;
    case "sku":
      return item.sku ?? "—";
    case "barcode":
      return item.name; // Placeholder - actual barcode would come from product data
    case "hsn":
      return item.hsn ?? "—";
    case "qty":
      return item.quantity;
    case "unit":
      return item.unit ?? "—";
    case "mrp":
      return "—"; // Placeholder - would come from product data
    case "rate":
      return item.rate;
    case "discount":
      return item.discount ?? 0;
    case "gst":
      return item.gstPercent ?? 0;
    case "tax_amount":
      return (item.amount * item.gstPercent) / 100;
    case "amount":
      return item.amount;
    case "batch":
      return "—"; // Placeholder - would come from product data
    case "expiry":
      return "—"; // Placeholder - would come from product data
    default:
      return null;
  }
}

/**
 * Format column value for display
 */
export function formatColumnValue(
  value: string | number | null,
  columnId: InvoiceColumnId,
): string {
  if (value === null || value === undefined) return "—";
  if (value === "—") return "—";

  const def = getColumnDefinition(columnId);

  switch (def.dataType) {
    case "currency":
      if (typeof value === "number") {
        return `₹${formatMoney(value)}`;
      }
      return String(value);

    case "percentage":
      if (typeof value === "number") {
        return `${value.toFixed(2)}%`;
      }
      return String(value);

    case "number":
      if (typeof value === "number") {
        return value.toFixed(value % 1 === 0 ? 0 : 2);
      }
      return String(value);

    case "date":
      return String(value);

    case "text":
    default:
      return String(value);
  }
}

/**
 * Resolve all enabled columns with their values for an item
 */
export function resolveItemColumns(
  item: InvoiceItem,
  index: number,
  settings: InvoiceColumnsSettings,
  customLabels?: Record<InvoiceColumnId, string>,
): ResolvedColumnData[] {
  const enabledColumns = resolveEnabledColumns(settings);

  return enabledColumns.map((config) => {
    const rawValue = resolveColumnValue(item, index, config.id);
    const formatted = formatColumnValue(rawValue, config.id);

    return {
      columnId: config.id,
      label: customLabels?.[config.id] ?? config.label,
      alignment: config.alignment,
      width: config.width,
      value: rawValue,
      formatted,
    };
  });
}

/**
 * Get column headers for a table
 */
export function getTableHeaders(
  settings: InvoiceColumnsSettings,
): Array<{ columnId: InvoiceColumnId; label: string; alignment: "left" | "center" | "right" }> {
  return resolveEnabledColumns(settings).map((col) => ({
    columnId: col.id,
    label: col.label,
    alignment: col.alignment,
  }));
}

/**
 * Check if any enabled columns require data (for validation)
 */
export function hasEnabledColumns(settings: InvoiceColumnsSettings): boolean {
  return resolveEnabledColumns(settings).length > 0;
}

/**
 * Generate CSS grid template columns for a table layout
 */
export function generateGridColumns(
  settings: InvoiceColumnsSettings,
  context: "thermal" | "a4" | "a5",
): string {
  const enabledColumns = resolveEnabledColumns(settings);

  const widths = enabledColumns.map((col) => {
    if (typeof col.width === "number") {
      return `${col.width}px`;
    }

    // Map width names to actual CSS values based on context
    switch (col.width) {
      case "small":
        return context === "thermal" ? "30px" : context === "a5" ? "45px" : "60px";
      case "medium":
        return context === "thermal" ? "50px" : context === "a5" ? "70px" : "90px";
      case "large":
        return context === "thermal" ? "80px" : context === "a5" ? "120px" : "200px";
      case "auto":
      default:
        // For product column or flexible columns, use flexible width
        if (col.id === "product") {
          return "minmax(0, 1fr)";
        }
        return "auto";
    }
  });

  return widths.join(" ");
}

/**
 * Default column settings (for backward compatibility during transition)
 */
export function getDefaultColumnSettingsForContext(
  context: "thermal" | "a4" | "a5",
): InvoiceColumnsSettings {
  return {
    columns: [
      { id: "sno", enabled: true, label: "S.No", order: 1, width: "small", alignment: "center" },
      { id: "product", enabled: true, label: "Product", order: 2, width: "large", alignment: "left" },
      { id: "qty", enabled: true, label: "Qty", order: 3, width: "small", alignment: "center" },
      { id: "rate", enabled: true, label: "Rate", order: 4, width: "small", alignment: "right" },
      { id: "amount", enabled: true, label: "Amount", order: 5, width: "small", alignment: "right" },
      { id: "sku", enabled: false, label: "SKU", order: 6, width: "medium", alignment: "left" },
      { id: "barcode", enabled: false, label: "Barcode", order: 7, width: "medium", alignment: "left" },
      { id: "hsn", enabled: false, label: "HSN", order: 8, width: "medium", alignment: "center" },
      { id: "unit", enabled: false, label: "Unit", order: 9, width: "small", alignment: "center" },
      { id: "mrp", enabled: false, label: "MRP", order: 10, width: "small", alignment: "right" },
      { id: "discount", enabled: false, label: "Discount", order: 11, width: "small", alignment: "right" },
      { id: "gst", enabled: false, label: "GST", order: 12, width: "small", alignment: "right" },
      { id: "tax_amount", enabled: false, label: "Tax Amount", order: 13, width: "small", alignment: "right" },
      { id: "batch", enabled: false, label: "Batch", order: 14, width: "medium", alignment: "center" },
      { id: "expiry", enabled: false, label: "Expiry", order: 15, width: "medium", alignment: "center" },
    ],
    lastModified: new Date().toISOString(),
    version: 1,
  };
}
