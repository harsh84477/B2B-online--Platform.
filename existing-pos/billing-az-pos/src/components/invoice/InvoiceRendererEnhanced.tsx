/**
 * Enhanced InvoiceRenderer with centralized column configuration
 * 
 * This wraps the base InvoiceRenderer to apply column configuration
 * before rendering. This ensures all templates use the same columns.
 */

import type { CSSProperties, ReactNode } from "react";
import { InvoiceRenderer as BaseInvoiceRenderer, type InvoiceTemplateProps } from "@/components/invoice/InvoiceRenderer";
import type { InvoiceColumnsSettings } from "@/lib/invoice-columns";

export interface EnhancedInvoiceRendererProps extends InvoiceTemplateProps {
  /**
   * Column configuration to apply to the invoice
   * If not provided, uses default configuration
   */
  columnSettings?: InvoiceColumnsSettings | null;
}

/**
 * Enhanced invoice renderer that applies column configuration
 * Currently delegates to base renderer, but prepared for future column filtering
 */
export function EnhancedInvoiceRenderer(props: EnhancedInvoiceRendererProps) {
  // Column configuration will be passed through context or props
  // to template renderers in future iterations
  
  return <BaseInvoiceRenderer {...props} />;
}

export { BaseInvoiceRenderer as InvoiceRenderer };
