/**
 * Enhanced Invoice Columns Configuration Component
 * 
 * Features:
 * - Enable/disable individual columns
 * - Drag-and-drop reordering
 * - Custom label editing
 * - Alignment and width customization
 * - Live preview integration
 * - Real-time updates with no save required for preview
 */

import { useState, useRef, type CSSProperties } from "react";
import { GripVertical, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleRow, SettingsCard, GroupGrid } from "./kit";
import {
  InvoiceColumnsSettings,
  InvoiceColumnId,
  resolveEnabledColumns,
  getColumnDefinition,
  INVOICE_COLUMN_REGISTRY,
  type ColumnWidth,
} from "@/lib/invoice-columns";
import { cn } from "@/lib/utils";

interface InvoiceColumnsManagerProps {
  settings: InvoiceColumnsSettings | null;
  disabled: boolean;
  onToggleColumn: (columnId: InvoiceColumnId, enabled: boolean) => void;
  onUpdateLabel: (columnId: InvoiceColumnId, label: string) => void;
  onReorderColumns: (fromIndex: number, toIndex: number) => void;
  onUpdateAlignment: (columnId: InvoiceColumnId, alignment: "left" | "center" | "right") => void;
  onUpdateWidth: (columnId: InvoiceColumnId, width: ColumnWidth) => void;
}

export function InvoiceColumnsManager({
  settings,
  disabled,
  onToggleColumn,
  onUpdateLabel,
  onReorderColumns,
  onUpdateAlignment,
  onUpdateWidth,
}: InvoiceColumnsManagerProps) {
  const [expandedColumn, setExpandedColumn] = useState<InvoiceColumnId | null>(null);
  const [draggedItem, setDraggedItem] = useState<InvoiceColumnId | null>(null);
  const dragOverItem = useRef<InvoiceColumnId | null>(null);
  const [editingLabel, setEditingLabel] = useState<InvoiceColumnId | null>(null);

  if (!settings) {
    return <div className="text-muted-foreground">Loading columns...</div>;
  }

  const handleDragStart = (columnId: InvoiceColumnId) => {
    setDraggedItem(columnId);
  };

  const handleDragOver = (columnId: InvoiceColumnId) => {
    dragOverItem.current = columnId;
  };

  const handleDrop = () => {
    if (!draggedItem || !dragOverItem.current || draggedItem === dragOverItem.current) return;

    const draggedIndex = settings.columns.findIndex((c) => c.id === draggedItem);
    const targetIndex = settings.columns.findIndex((c) => c.id === dragOverItem.current!);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      onReorderColumns(draggedIndex, targetIndex);
    }

    setDraggedItem(null);
    dragOverItem.current = null;
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    dragOverItem.current = null;
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Column list (drag to reorder)
        </p>
        <div className="space-y-2">
          {settings.columns.map((column, index) => {
            const def = getColumnDefinition(column.id);
            const isExpanded = expandedColumn === column.id;
            const isDragging = draggedItem === column.id;
            const isDragOver = dragOverItem.current === column.id;

            return (
              <div
                key={column.id}
                draggable={!disabled}
                onDragStart={() => handleDragStart(column.id)}
                onDragOver={() => handleDragOver(column.id)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                className={cn(
                  "group rounded-lg border transition-all",
                  isDragging && "opacity-50 bg-muted",
                  isDragOver && "border-primary/50 bg-primary/5",
                  !isDragging && !isDragOver && "border-border bg-card hover:bg-muted/50",
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 p-3 cursor-pointer",
                    !disabled && "cursor-grab active:cursor-grabbing",
                  )}
                  onClick={() =>
                    setExpandedColumn(isExpanded ? null : column.id)
                  }
                >
                  {/* Drag handle */}
                  <div
                    className={cn(
                      "text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity",
                      !disabled && "cursor-grab",
                    )}
                    draggable={!disabled}
                  >
                    <GripVertical className="size-4" />
                  </div>

                  {/* Toggle visibility */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleColumn(column.id, !column.enabled);
                    }}
                    disabled={disabled}
                    className={cn(
                      "p-1 rounded transition-colors",
                      column.enabled
                        ? "text-green-600 hover:bg-green-50"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {column.enabled ? (
                      <Eye className="size-4" />
                    ) : (
                      <EyeOff className="size-4" />
                    )}
                  </button>

                  {/* Column label and order */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={cn(
                          "font-medium text-sm",
                          !column.enabled && "text-muted-foreground opacity-60",
                        )}
                      >
                        {column.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        #{index + 1}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {def.description}
                    </p>
                  </div>

                  {/* Expand indicator */}
                  <div
                    className={cn(
                      "text-muted-foreground transition-transform",
                      isExpanded && "rotate-180",
                    )}
                  >
                    <svg
                      className="size-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      />
                    </svg>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/30 p-3 space-y-3">
                    {/* Label editing */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Label
                      </label>
                      <Input
                        value={editingLabel === column.id ? column.label : column.label}
                        onChange={(e) => {
                          onUpdateLabel(column.id, e.target.value);
                        }}
                        onFocus={() => setEditingLabel(column.id)}
                        onBlur={() => setEditingLabel(null)}
                        disabled={disabled}
                        placeholder={def.defaultLabel}
                        className="h-8 text-sm"
                      />
                    </div>

                    {/* Alignment */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Alignment
                      </label>
                      <div className="flex gap-2">
                        {(["left", "center", "right"] as const).map((align) => (
                          <button
                            key={align}
                            onClick={() => onUpdateAlignment(column.id, align)}
                            disabled={disabled}
                            className={cn(
                              "px-3 py-1.5 rounded text-sm font-medium transition-colors flex-1",
                              column.alignment === align
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/70",
                            )}
                          >
                            {align.charAt(0).toUpperCase() + align.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Width */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Width
                      </label>
                      <div className="flex gap-2">
                        {(["auto", "small", "medium", "large"] as const).map((w) => (
                          <button
                            key={w}
                            onClick={() => onUpdateWidth(column.id, w)}
                            disabled={disabled}
                            className={cn(
                              "px-2 py-1.5 rounded text-xs font-medium transition-colors flex-1",
                              column.width === w
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/70",
                            )}
                          >
                            {w.charAt(0).toUpperCase() + w.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick preview of enabled columns */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Enabled columns preview
        </p>
        <div className="flex flex-wrap gap-2">
          {resolveEnabledColumns(settings).map((col) => (
            <span
              key={col.id}
              className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              {col.label}
            </span>
          ))}
          {resolveEnabledColumns(settings).length === 0 && (
            <p className="text-xs text-muted-foreground">
              No columns enabled. Select at least one column.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
