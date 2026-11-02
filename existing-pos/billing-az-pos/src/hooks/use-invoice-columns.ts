/**
 * Hook for managing invoice column configuration state
 * 
 * This hook provides:
 * - Loading and saving column configuration
 * - Draft state management (unsaved changes)
 * - Reset and restore functionality
 * - Integration with settings storage
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  InvoiceColumnsSettings,
  InvoiceColumnId,
  InvoiceColumnConfig,
  ColumnWidth,
  getDefaultInvoiceColumnsSettings,
  validateColumnConfiguration,
} from "@/lib/invoice-columns";
import { useSettingsSection } from "@/lib/settings-store";

export function useInvoiceColumns() {
  const defaults = useMemo(() => {
    const d = getDefaultInvoiceColumnsSettings();
    return {
      invoice_columns: JSON.stringify(d),
    };
  }, []);

  const state = useSettingsSection("print", defaults as any);
  const [draftColumns, setDraftColumns] = useState<InvoiceColumnsSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize columns from settings
  useEffect(() => {
    try {
      const defaultSettings = getDefaultInvoiceColumnsSettings();
      
      // Try to load from settings storage
      const storedConfig = (state.values as any)?.invoice_columns;
      let loaded: InvoiceColumnsSettings;

      if (storedConfig) {
        try {
          loaded = typeof storedConfig === "string" ? JSON.parse(storedConfig) : storedConfig;
        } catch {
          loaded = defaultSettings;
        }
      } else {
        loaded = defaultSettings;
      }

      // Validate
      const validationErrors = validateColumnConfiguration(loaded);
      if (validationErrors.length > 0) {
        console.warn("Column configuration validation errors:", validationErrors);
        loaded = defaultSettings;
      }

      setDraftColumns(JSON.parse(JSON.stringify(loaded)));
      setError(null);
    } catch (err) {
      console.error("Failed to initialize invoice columns:", err);
      setError("Failed to load column configuration");
      const defaults = getDefaultInvoiceColumnsSettings();
      setDraftColumns(JSON.parse(JSON.stringify(defaults)));
    }
  }, [state.values]);

  const savedColumns = useMemo(() => {
    const storedConfig = (state.values as any)?.invoice_columns;
    if (!storedConfig) return null;
    try {
      return typeof storedConfig === "string" ? JSON.parse(storedConfig) : storedConfig;
    } catch {
      return null;
    }
  }, [state.values]);

  // Check if there are unsaved changes
  const isDirty = savedColumns && draftColumns && JSON.stringify(savedColumns) !== JSON.stringify(draftColumns);

  // Toggle column visibility
  const toggleColumn = useCallback((columnId: InvoiceColumnId, enabled: boolean) => {
    setDraftColumns((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as InvoiceColumnsSettings;
      const col = next.columns.find((c) => c.id === columnId);
      if (col) {
        col.enabled = enabled;
      }
      return next;
    });
  }, []);

  // Update column label
  const updateColumnLabel = useCallback((columnId: InvoiceColumnId, label: string) => {
    setDraftColumns((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as InvoiceColumnsSettings;
      const col = next.columns.find((c) => c.id === columnId);
      if (col) {
        col.label = label;
      }
      return next;
    });
  }, []);

  // Update column width
  const updateColumnWidth = useCallback((columnId: InvoiceColumnId, width: ColumnWidth) => {
    setDraftColumns((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as InvoiceColumnsSettings;
      const col = next.columns.find((c) => c.id === columnId);
      if (col) {
        col.width = width;
      }
      return next;
    });
  }, []);

  // Update column alignment
  const updateColumnAlignment = useCallback((columnId: InvoiceColumnId, alignment: "left" | "center" | "right") => {
    setDraftColumns((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as InvoiceColumnsSettings;
      const col = next.columns.find((c) => c.id === columnId);
      if (col) {
        col.alignment = alignment;
      }
      return next;
    });
  }, []);

  // Reorder columns (drag and drop)
  const reorderColumns = useCallback((fromIndex: number, toIndex: number) => {
    setDraftColumns((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev)) as InvoiceColumnsSettings;
      const [moved] = next.columns.splice(fromIndex, 1);
      next.columns.splice(toIndex, 0, moved);
      
      // Update order values
      next.columns.forEach((col, index) => {
        col.order = index + 1;
      });
      
      return next;
    });
  }, []);

  // Save current draft configuration
  const save = useCallback(async () => {
    if (!draftColumns) return;
    
    try {
      setSaving(true);
      setError(null);
      
      const validationErrors = validateColumnConfiguration(draftColumns);
      if (validationErrors.length > 0) {
        throw new Error(`Invalid column configuration: ${validationErrors.join(", ")}`);
      }

      // Save to settings as JSON string
      const updated = {
        ...draftColumns,
        lastModified: new Date().toISOString(),
      };

      state.set("invoice_columns", JSON.stringify(updated));
      
      // Also update individual column toggles for backward compatibility
      updated.columns.forEach((col) => {
        state.set(col.id, col.enabled);
      });

      // Trigger the actual save
      await state.save();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save column configuration";
      setError(message);
      console.error("Failed to save invoice columns:", err);
    } finally {
      setSaving(false);
    }
  }, [draftColumns, state]);

  // Discard draft changes, restore to last saved
  const discard = useCallback(() => {
    if (savedColumns) {
      setDraftColumns(JSON.parse(JSON.stringify(savedColumns)));
    } else {
      setDraftColumns(JSON.parse(JSON.stringify(getDefaultInvoiceColumnsSettings())));
    }
  }, [savedColumns]);

  // Restore to defaults
  const restoreDefaults = useCallback(() => {
    const defaults = getDefaultInvoiceColumnsSettings();
    setDraftColumns(defaults);
  }, []);

  return {
    draftColumns,
    loading: state.loading,
    saving,
    error,
    isDirty,
    toggleColumn,
    updateColumnLabel,
    updateColumnWidth,
    updateColumnAlignment,
    reorderColumns,
    save,
    discard,
    restoreDefaults,
  };
}
