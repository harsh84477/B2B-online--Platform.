/**
 * Centralized invoice column configuration system
 * 
 * This module defines:
 * 1. Column registry with stable IDs
 * 2. Column configuration types
 * 3. Column resolver utilities
 * 4. Sensible defaults
 * 
 * This is the SINGLE SOURCE OF TRUTH for all invoice columns.
 * All templates, renderers, and previews must use this system.
 */

export type InvoiceColumnId =
  | "sno"
  | "product"
  | "sku"
  | "barcode"
  | "hsn"
  | "qty"
  | "unit"
  | "mrp"
  | "rate"
  | "discount"
  | "gst"
  | "tax_amount"
  | "amount"
  | "batch"
  | "expiry";

export type ColumnAlignment = "left" | "center" | "right";
export type ColumnWidth = "auto" | "small" | "medium" | "large" | number;

export interface InvoiceColumnDefinition {
  id: InvoiceColumnId;
  label: string;
  defaultLabel: string;
  dataType: "number" | "text" | "percentage" | "currency" | "date";
  defaultWidth: ColumnWidth;
  defaultAlignment: ColumnAlignment;
  description: string;
  category: "numeric" | "text" | "identifier";
}

export interface InvoiceColumnConfig {
  id: InvoiceColumnId;
  enabled: boolean;
  label: string;
  order: number;
  width: ColumnWidth;
  alignment: ColumnAlignment;
}

export interface InvoiceColumnsSettings {
  columns: InvoiceColumnConfig[];
  lastModified: string;
  version: 1;
}

/**
 * Registry of all supported invoice columns
 * This defines the schema, defaults, and metadata for each column
 */
export const INVOICE_COLUMN_REGISTRY: Record<InvoiceColumnId, InvoiceColumnDefinition> = {
  sno: {
    id: "sno",
    label: "S.No",
    defaultLabel: "S.No",
    dataType: "number",
    defaultWidth: "small",
    defaultAlignment: "center",
    description: "Sequential item number",
    category: "numeric",
  },
  product: {
    id: "product",
    label: "Product",
    defaultLabel: "Product",
    dataType: "text",
    defaultWidth: "large",
    defaultAlignment: "left",
    description: "Product name",
    category: "text",
  },
  sku: {
    id: "sku",
    label: "SKU",
    defaultLabel: "SKU",
    dataType: "text",
    defaultWidth: "medium",
    defaultAlignment: "left",
    description: "Stock keeping unit code",
    category: "identifier",
  },
  barcode: {
    id: "barcode",
    label: "Barcode",
    defaultLabel: "Barcode",
    dataType: "text",
    defaultWidth: "medium",
    defaultAlignment: "left",
    description: "Product barcode",
    category: "identifier",
  },
  hsn: {
    id: "hsn",
    label: "HSN",
    defaultLabel: "HSN",
    dataType: "text",
    defaultWidth: "medium",
    defaultAlignment: "center",
    description: "Harmonized System of Nomenclature",
    category: "identifier",
  },
  qty: {
    id: "qty",
    label: "Qty",
    defaultLabel: "Qty",
    dataType: "number",
    defaultWidth: "small",
    defaultAlignment: "center",
    description: "Quantity",
    category: "numeric",
  },
  unit: {
    id: "unit",
    label: "Unit",
    defaultLabel: "Unit",
    dataType: "text",
    defaultWidth: "small",
    defaultAlignment: "center",
    description: "Unit of measurement",
    category: "text",
  },
  mrp: {
    id: "mrp",
    label: "MRP",
    defaultLabel: "MRP",
    dataType: "currency",
    defaultWidth: "small",
    defaultAlignment: "right",
    description: "Maximum Retail Price",
    category: "numeric",
  },
  rate: {
    id: "rate",
    label: "Rate",
    defaultLabel: "Rate",
    dataType: "currency",
    defaultWidth: "small",
    defaultAlignment: "right",
    description: "Selling price per unit",
    category: "numeric",
  },
  discount: {
    id: "discount",
    label: "Discount",
    defaultLabel: "Discount",
    dataType: "currency",
    defaultWidth: "small",
    defaultAlignment: "right",
    description: "Discount amount",
    category: "numeric",
  },
  gst: {
    id: "gst",
    label: "GST",
    defaultLabel: "GST",
    dataType: "percentage",
    defaultWidth: "small",
    defaultAlignment: "right",
    description: "Goods and Services Tax percentage",
    category: "numeric",
  },
  tax_amount: {
    id: "tax_amount",
    label: "Tax Amount",
    defaultLabel: "Tax Amount",
    dataType: "currency",
    defaultWidth: "small",
    defaultAlignment: "right",
    description: "Calculated tax amount",
    category: "numeric",
  },
  amount: {
    id: "amount",
    label: "Amount",
    defaultLabel: "Amount",
    dataType: "currency",
    defaultWidth: "small",
    defaultAlignment: "right",
    description: "Line total amount",
    category: "numeric",
  },
  batch: {
    id: "batch",
    label: "Batch",
    defaultLabel: "Batch",
    dataType: "text",
    defaultWidth: "medium",
    defaultAlignment: "center",
    description: "Batch number",
    category: "identifier",
  },
  expiry: {
    id: "expiry",
    label: "Expiry",
    defaultLabel: "Expiry",
    dataType: "date",
    defaultWidth: "medium",
    defaultAlignment: "center",
    description: "Expiry date",
    category: "identifier",
  },
};

/**
 * Sensible defaults for initial column configuration
 * Balanced between common GST invoice requirements and readability
 */
export function getDefaultInvoiceColumnsSettings(): InvoiceColumnsSettings {
  const columnOrder: InvoiceColumnId[] = [
    "sno",
    "product",
    "sku",
    "barcode",
    "hsn",
    "qty",
    "unit",
    "mrp",
    "rate",
    "discount",
    "gst",
    "tax_amount",
    "amount",
    "batch",
    "expiry",
  ];

  const defaultEnabled: Set<InvoiceColumnId> = new Set([
    "sno",
    "product",
    "qty",
    "rate",
    "amount",
  ]);

  const columns: InvoiceColumnConfig[] = columnOrder.map((id, index) => {
    const def = INVOICE_COLUMN_REGISTRY[id];
    return {
      id,
      enabled: defaultEnabled.has(id),
      label: def.defaultLabel,
      order: index + 1,
      width: def.defaultWidth,
      alignment: def.defaultAlignment,
    };
  });

  return {
    columns,
    lastModified: new Date().toISOString(),
    version: 1,
  };
}

/**
 * Resolve only the enabled columns from the configuration
 * Returns columns in their configured order
 */
export function resolveEnabledColumns(
  settings: InvoiceColumnsSettings,
): InvoiceColumnConfig[] {
  return settings.columns
    .filter((col) => col.enabled)
    .sort((a, b) => a.order - b.order);
}

/**
 * Get column configuration by ID
 */
export function getColumnConfig(
  settings: InvoiceColumnsSettings,
  columnId: InvoiceColumnId,
): InvoiceColumnConfig | null {
  return settings.columns.find((col) => col.id === columnId) ?? null;
}

/**
 * Get column definition from registry
 */
export function getColumnDefinition(columnId: InvoiceColumnId): InvoiceColumnDefinition {
  return INVOICE_COLUMN_REGISTRY[columnId];
}

/**
 * Format column width for CSS grid/layout
 */
export function formatColumnWidth(width: ColumnWidth, context: "thermal" | "a4" | "a5"): string {
  if (typeof width === "number") return `${width}px`;
  
  if (context === "thermal") {
    // Thermal printers have limited width, use tighter defaults
    switch (width) {
      case "small": return "30px";
      case "medium": return "50px";
      case "large": return "80px";
      default: return "auto";
    }
  }

  if (context === "a5") {
    // A5 is limited but more spacious than thermal
    switch (width) {
      case "small": return "45px";
      case "medium": return "70px";
      case "large": return "120px";
      default: return "auto";
    }
  }

  // A4 has the most space
  switch (width) {
    case "small": return "60px";
    case "medium": return "90px";
    case "large": return "200px";
    default: return "auto";
  }
}

/**
 * Get CSS alignment value
 */
export function formatAlignment(alignment: ColumnAlignment): string {
  switch (alignment) {
    case "left": return "flex-start";
    case "center": return "center";
    case "right": return "flex-end";
  }
}

/**
 * Get text alignment for CSS
 */
export function getTextAlign(alignment: ColumnAlignment): "left" | "center" | "right" {
  return alignment;
}

/**
 * Validate column configuration
 * Returns array of validation errors, empty if valid
 */
export function validateColumnConfiguration(settings: InvoiceColumnsSettings): string[] {
  const errors: string[] = [];
  const seenIds = new Set<InvoiceColumnId>();

  // Check for duplicate IDs
  for (const col of settings.columns) {
    if (seenIds.has(col.id)) {
      errors.push(`Duplicate column ID: ${col.id}`);
    }
    seenIds.add(col.id);
  }

  // Check for missing columns
  const configIds = new Set(settings.columns.map((c) => c.id));
  for (const registryId of Object.keys(INVOICE_COLUMN_REGISTRY) as InvoiceColumnId[]) {
    if (!configIds.has(registryId)) {
      errors.push(`Missing column in configuration: ${registryId}`);
    }
  }

  // Check for invalid order
  const orders = new Set<number>();
  for (const col of settings.columns) {
    if (col.order < 1) {
      errors.push(`Invalid order for column ${col.id}: order must be >= 1`);
    }
    if (orders.has(col.order)) {
      errors.push(`Duplicate order value: ${col.order}`);
    }
    orders.add(col.order);
  }

  return errors;
}

/**
 * Migrate old settings format to new format
 * If old settings contain column visibility, preserve them
 */
export function migrateOldColumnSettings(
  oldSettings: Record<string, boolean | undefined>,
  currentSettings: InvoiceColumnsSettings,
): InvoiceColumnsSettings {
  const migrated = JSON.parse(JSON.stringify(currentSettings)) as InvoiceColumnsSettings;

  // Map old keys to new column IDs
  const oldKeyMap: Record<string, InvoiceColumnId> = {
    show_sku: "sku",
    show_barcode: "barcode",
    show_hsn: "hsn",
    show_batch: "batch",
    show_expiry: "expiry",
    show_discount: "discount",
    show_mrp: "mrp",
    show_gst: "gst",
  };

  // Apply migrated settings
  for (const [oldKey, columnId] of Object.entries(oldKeyMap)) {
    if (oldKey in oldSettings && oldSettings[oldKey] !== undefined) {
      const col = migrated.columns.find((c) => c.id === columnId);
      if (col) {
        col.enabled = oldSettings[oldKey] ?? false;
      }
    }
  }

  migrated.lastModified = new Date().toISOString();
  return migrated;
}
