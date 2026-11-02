/**
 * Declarative schema for the Settings module.
 *
 * Sections that are pure configuration (toggles / text / selects) are described
 * here once and rendered generically by <SchemaSection />. Sections with rich
 * behaviour (Account, Business, Catalog, Staff, Print, Backup, Subscription)
 * have dedicated components but still reuse the same primitives.
 */

export type FieldType =
  | "text"
  | "number"
  | "switch"
  | "select"
  | "textarea"
  | "color"
  | "email"
  | "url";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  default: string | number | boolean;
  help?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  /** Grid span on desktop. Defaults to 1. */
  span?: 1 | 2 | 3;
}

export interface GroupDef {
  title: string;
  description?: string;
  /** 1 = stacked (good for switch lists), 2/3 = form grid */
  columns?: 1 | 2 | 3;
  fields: FieldDef[];
}

export interface TabDef {
  id: string;
  label: string;
  groups: GroupDef[];
}

export interface SectionSchema {
  /** app_settings.section key */
  key: string;
  title: string;
  description: string;
  /** Only admins may edit when true */
  adminOnly?: boolean;
  tabs: TabDef[];
}

const yesNo = (label: string, key: string, def = true, help?: string): FieldDef => ({
  key,
  label,
  type: "switch",
  default: def,
  ...(help ? { help } : {}),
});

const GST_OPTIONS = [0, 5, 12, 18, 28].map((n) => ({ value: String(n), label: `${n}%` }));

/* ------------------------------------------------------------------ */
/* Invoice & GST                                                       */
/* ------------------------------------------------------------------ */

export const invoiceSchema: SectionSchema = {
  key: "invoice",
  title: "Invoice & GST",
  description: "Numbering series, tax behaviour, payment terms and document content.",
  adminOnly: true,
  tabs: [
    {
      id: "general",
      label: "General",
      groups: [
        {
          title: "Document prefixes",
          description: "Each document type gets its own running series.",
          columns: 3,
          fields: [
            { key: "prefix_invoice", label: "Invoice", type: "text", default: "INV" },
            { key: "prefix_estimate", label: "Estimate", type: "text", default: "EST" },
            { key: "prefix_quotation", label: "Quotation", type: "text", default: "QTN" },
            { key: "prefix_purchase", label: "Purchase", type: "text", default: "PUR" },
            { key: "prefix_credit_note", label: "Credit note", type: "text", default: "CN" },
            { key: "prefix_debit_note", label: "Debit note", type: "text", default: "DN" },
            { key: "prefix_sales_return", label: "Sales return", type: "text", default: "SR" },
            { key: "prefix_purchase_return", label: "Purchase return", type: "text", default: "PR" },
          ],
        },
        {
          title: "Numbering",
          columns: 3,
          fields: [
            { key: "number_padding", label: "Number padding", type: "number", default: 6, min: 1, max: 10, help: "Digits after the prefix." },
            { key: "start_number", label: "Start number", type: "number", default: 1, min: 1 },
            yesNo("Auto increment", "auto_increment", true),
            yesNo("Reset every financial year", "fy_reset", true, "Restart numbering on 1 April."),
            yesNo("Include financial year in number", "include_fy", true),
          ],
        },
      ],
    },
    {
      id: "gst",
      label: "GST",
      groups: [
        {
          title: "Tax registration",
          columns: 3,
          fields: [
            yesNo("Enable GST", "gst_enabled", true),
            {
              key: "gst_type",
              label: "GST type",
              type: "select",
              default: "REGULAR",
              options: [
                { value: "REGULAR", label: "Regular" },
                { value: "COMPOSITION", label: "Composition" },
              ],
            },
            { key: "gstin", label: "GSTIN", type: "text", default: "", placeholder: "22AAAAA0000A1Z5" },
            { key: "default_gst", label: "Default GST slab", type: "select", default: "18", options: GST_OPTIONS },
            {
              key: "price_mode",
              label: "Price entry",
              type: "select",
              default: "EXCLUSIVE",
              options: [
                { value: "EXCLUSIVE", label: "GST exclusive" },
                { value: "INCLUSIVE", label: "GST inclusive" },
              ],
            },
            {
              key: "tax_method",
              label: "Tax calculation",
              type: "select",
              default: "LINE",
              options: [
                { value: "LINE", label: "Line-wise" },
                { value: "INVOICE", label: "Invoice-wise" },
              ],
            },
          ],
        },
        {
          title: "Compliance",
          columns: 2,
          fields: [
            yesNo("HSN code required", "hsn_required", true),
            yesNo("SAC code required", "sac_required", false),
            yesNo("Enable CESS", "cess_enabled", false),
            yesNo("Reverse charge applicable", "reverse_charge", false),
            yesNo("Split CGST / SGST for local sales", "split_cgst_sgst", true),
            yesNo("Use IGST for inter-state sales", "igst_interstate", true),
            yesNo("Round off invoice total", "round_off", true),
            yesNo("E-Invoice ready (IRN fields)", "einvoice_ready", false),
            yesNo("E-Way bill ready", "eway_ready", false),
            yesNo("Allow export invoices (LUT)", "export_invoice", false),
            yesNo("Allow import invoices", "import_invoice", false),
          ],
        },
      ],
    },
    {
      id: "payment",
      label: "Payment",
      groups: [
        {
          title: "Defaults",
          columns: 3,
          fields: [
            {
              key: "default_payment_mode",
              label: "Default payment mode",
              type: "select",
              default: "CASH",
              options: ["CASH", "CARD", "UPI", "CREDIT", "CHEQUE", "BANK_TRANSFER"].map((v) => ({
                value: v,
                label: v.replace("_", " "),
              })),
            },
            {
              key: "payment_terms",
              label: "Default payment terms",
              type: "select",
              default: "NET_15",
              options: [
                { value: "DUE", label: "Due on receipt" },
                { value: "NET_7", label: "Net 7" },
                { value: "NET_15", label: "Net 15" },
                { value: "NET_30", label: "Net 30" },
                { value: "NET_45", label: "Net 45" },
              ],
            },
            { key: "default_credit_limit", label: "Default credit limit (₹)", type: "number", default: 0, min: 0 },
            { key: "late_fee_percent", label: "Late fee % per month", type: "number", default: 0, min: 0, max: 100 },
          ],
        },
        {
          title: "Allowed behaviour",
          columns: 2,
          fields: [
            yesNo("Split payments", "allow_split", true),
            yesNo("Partial payments", "allow_partial", true),
            yesNo("Advance payments", "allow_advance", true),
            yesNo("Block billing above credit limit", "block_over_limit", false),
          ],
        },
      ],
    },
    {
      id: "options",
      label: "Invoice options",
      groups: [
        {
          title: "Invoice footer",
          columns: 1,
          fields: [
            { key: "customer_address", label: "Show customer address", type: "switch", default: true },
            { key: "shipping_address", label: "Show shipping address", type: "switch", default: false },
            { key: "vehicle", label: "Show vehicle number", type: "switch", default: false },
            { key: "salesperson", label: "Show salesperson", type: "switch", default: false },
            { key: "due_date", label: "Show due date", type: "switch", default: true },
            { key: "qr", label: "Show payment QR code", type: "switch", default: true },
            { key: "bank", label: "Show bank details", type: "switch", default: true },
            { key: "signature", label: "Show signature field", type: "switch", default: true },
            { key: "notes", label: "Show invoice notes", type: "switch", default: true },
            { key: "terms", label: "Show terms & conditions", type: "switch", default: true },
            { key: "transport", label: "Show transport details", type: "switch", default: false },
            { key: "delivery_date", label: "Show delivery date", type: "switch", default: false },
            { key: "order_number", label: "Show order number", type: "switch", default: false },
            { key: "reference", label: "Show reference number", type: "switch", default: false },
          ],
        },
      ],
    },
    {
      id: "footer",
      label: "Footer",
      groups: [
        {
          title: "Footer content",
          columns: 1,
          fields: [
            { key: "terms", label: "Terms & conditions", type: "textarea", default: "Goods once sold will not be taken back.", span: 3 },
            { key: "declaration", label: "Declaration", type: "textarea", default: "We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.", span: 3 },
            { key: "return_policy", label: "Return policy", type: "textarea", default: "", span: 3 },
            { key: "warranty_policy", label: "Warranty policy", type: "textarea", default: "", span: 3 },
            { key: "thank_you", label: "Thank you message", type: "text", default: "Thank you for your business!", span: 3 },
            { key: "footer_notes", label: "Footer notes", type: "textarea", default: "", span: 3 },
            { key: "digital_signature", label: "Digital signature name", type: "text", default: "Authorised Signatory", span: 3 },
          ],
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* POS preferences                                                     */
/* ------------------------------------------------------------------ */

export const posSchema: SectionSchema = {
  key: "pos",
  title: "POS preferences",
  description: "How the billing counter behaves day to day.",
  tabs: [
    {
      id: "billing",
      label: "Billing",
      groups: [
        {
          title: "Counter behaviour",
          columns: 2,
          fields: [
            yesNo("Quick billing mode", "quick_billing", true, "Skip confirmation dialogs where safe."),
            yesNo("Keyboard shortcuts", "keyboard_shortcuts", true),
            yesNo("Barcode scanner input", "barcode_scanner", true),
            yesNo("Touch mode (larger targets)", "touch_mode", false),
            yesNo("Compact mode", "compact_mode", false),
            yesNo("Auto-save draft bills", "auto_save_draft", true),
            yesNo("Auto-complete bill on exact payment", "auto_complete", false),
            yesNo("Show invoice preview before saving", "invoice_preview", false),
            yesNo("Show cost price", "show_cost_price", false, "Display purchase price in the product list."),
            yesNo("Line discount field", "line_discount", true, "Show the Disc % box on each bill line."),
          ],
        },
        {
          title: "Defaults",
          columns: 3,
          fields: [
            { key: "default_customer", label: "Default customer", type: "text", default: "Walk-in", span: 1 },
            { key: "default_warehouse", label: "Default warehouse", type: "text", default: "Main store" },
            { key: "default_tax", label: "Default tax slab", type: "select", default: "18", options: GST_OPTIONS },
            {
              key: "default_payment",
              label: "Default payment",
              type: "select",
              default: "CASH",
              options: ["CASH", "UPI", "CREDIT", "CHEQUE", "BANK_TRANSFER"].map((v) => ({ value: v, label: v.replace("_", " ") })),
            },
            {
              key: "default_billing_price",
              label: "Default billing price",
              type: "select",
              default: "mrp",
              options: [
                { value: "mrp", label: "MRP" },
                { value: "retail", label: "Retail Price" },
                { value: "wholesale", label: "Wholesale Price" },
              ],
            },
          ],
        },
      ],
    },
    {
      id: "hardware",
      label: "Hardware & cash",
      groups: [
        {
          title: "Peripherals",
          columns: 2,
          fields: [
            yesNo("Customer display", "customer_display", false),
            yesNo("Second screen", "second_screen", false),
            yesNo("Cash drawer kick on sale", "cash_drawer", false),
          ],
        },
        {
          title: "Cash management",
          columns: 3,
          fields: [
            { key: "opening_cash", label: "Default opening cash (₹)", type: "number", default: 0, min: 0 },
            { key: "closing_cash_reminder", label: "Day close reminder time", type: "text", default: "21:00" },
          ],
        },
      ],
    },
    {
      id: "session",
      label: "Offline & session",
      groups: [
        {
          title: "Sync",
          columns: 3,
          fields: [
            yesNo("Offline mode", "offline_mode", true, "Queue bills locally when the connection drops."),
            { key: "sync_interval", label: "Sync interval (seconds)", type: "number", default: 30, min: 5, max: 600 },
          ],
        },
        {
          title: "Session",
          columns: 3,
          fields: [
            yesNo("Screen lock when idle", "screen_lock", false),
            { key: "session_timeout", label: "Session timeout (minutes)", type: "number", default: 60, min: 5, max: 1440 },
          ],
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Loyalty                                                             */
/* ------------------------------------------------------------------ */

export const loyaltySchema: SectionSchema = {
  key: "loyalty",
  title: "Loyalty program",
  description: "Reward repeat buyers with points, tiers and referral bonuses.",
  adminOnly: true,
  tabs: [
    {
      id: "program",
      label: "Program",
      groups: [
        {
          title: "Points",
          columns: 3,
          fields: [
            yesNo("Enable loyalty", "enabled", false),
            { key: "points_per_rupee", label: "Points per ₹100 spent", type: "number", default: 1, min: 0 },
            { key: "point_value", label: "Value of 1 point (₹)", type: "number", default: 1, min: 0 },
            { key: "min_redeem", label: "Minimum points to redeem", type: "number", default: 100, min: 0 },
            { key: "expiry_months", label: "Points expire after (months)", type: "number", default: 12, min: 0 },
          ],
        },
        {
          title: "Membership tiers",
          columns: 3,
          fields: [
            { key: "silver_threshold", label: "Silver from (₹ lifetime)", type: "number", default: 25000, min: 0 },
            { key: "gold_threshold", label: "Gold from (₹ lifetime)", type: "number", default: 100000, min: 0 },
            { key: "diamond_threshold", label: "Diamond from (₹ lifetime)", type: "number", default: 500000, min: 0 },
          ],
        },
        {
          title: "Bonus rewards",
          columns: 2,
          fields: [
            yesNo("Referral rewards", "referral_rewards", false),
            { key: "referral_points", label: "Referral bonus points", type: "number", default: 250, min: 0 },
            yesNo("Birthday rewards", "birthday_rewards", false),
            { key: "birthday_points", label: "Birthday bonus points", type: "number", default: 100, min: 0 },
            yesNo("Festival special offers", "festival_offers", false),
          ],
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Appearance                                                          */
/* ------------------------------------------------------------------ */

export const appearanceSchema: SectionSchema = {
  key: "appearance",
  title: "Appearance",
  description: "Theme, density and branding for everyone using this workspace.",
  tabs: [
    {
      id: "theme",
      label: "Theme",
      groups: [
        {
          title: "Look & feel",
          columns: 3,
          fields: [
            {
              key: "theme",
              label: "Theme",
              type: "select",
              default: "system",
              options: [
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ],
            },
            {
              key: "sidebar_style",
              label: "Sidebar style",
              type: "select",
              default: "expanded",
              options: [
                { value: "compact", label: "Compact (icons)" },
                { value: "expanded", label: "Expanded" },
              ],
            },
            {
              key: "density",
              label: "Density",
              type: "select",
              default: "comfortable",
              options: [
                { value: "compact", label: "Compact" },
                { value: "comfortable", label: "Comfortable" },
                { value: "spacious", label: "Spacious" },
              ],
            },
            {
              key: "font_family",
              label: "Font family",
              type: "select",
              default: "system",
              options: [
                { value: "system", label: "System UI" },
                { value: "inter", label: "Inter" },
                { value: "mono", label: "Monospace numerals" },
              ],
            },
            { key: "radius", label: "Corner radius (px)", type: "number", default: 12, min: 0, max: 24 },
            yesNo("Interface animations", "animations", true),
          ],
        },
        {
          title: "Brand colours",
          columns: 3,
          fields: [
            { key: "primary_color", label: "Primary", type: "color", default: "#047857" },
            { key: "secondary_color", label: "Secondary", type: "color", default: "#1a2e1a" },
            { key: "accent_color", label: "Accent", type: "color", default: "#f59e0b" },
          ],
        },
      ],
    },
    {
      id: "dashboard",
      label: "Dashboard widgets",
      groups: [
        {
          title: "Visible widgets",
          columns: 2,
          fields: [
            yesNo("Today's sales", "widget_today", true),
            yesNo("Monthly revenue", "widget_month", true),
            yesNo("Outstanding dues", "widget_dues", true),
            yesNo("Low stock alerts", "widget_low_stock", true),
            yesNo("Sales chart", "widget_chart", true),
            yesNo("Top products", "widget_top_products", true),
            yesNo("Recent invoices", "widget_recent", true),
          ],
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Security                                                            */
/* ------------------------------------------------------------------ */

export const securitySchema: SectionSchema = {
  key: "security",
  title: "Security",
  description: "Password policy, sessions and API access.",
  adminOnly: true,
  tabs: [
    {
      id: "policy",
      label: "Policy",
      groups: [
        {
          title: "Password policy",
          columns: 3,
          fields: [
            { key: "min_length", label: "Minimum length", type: "number", default: 8, min: 6, max: 64 },
            yesNo("Require uppercase", "require_upper", true),
            yesNo("Require number", "require_number", true),
            yesNo("Require symbol", "require_symbol", false),
            { key: "rotate_days", label: "Force change every (days)", type: "number", default: 0, min: 0, help: "0 disables rotation." },
            yesNo("Block leaked passwords", "block_leaked", true),
          ],
        },
        {
          title: "Sessions & access",
          columns: 3,
          fields: [
            yesNo("Require two-factor for admins", "require_2fa", false),
            { key: "session_timeout", label: "Session timeout (minutes)", type: "number", default: 480, min: 5 },
            { key: "max_devices", label: "Max trusted devices", type: "number", default: 5, min: 1 },
            yesNo("Restrict access by IP", "ip_restriction", false),
            { key: "allowed_ips", label: "Allowed IP addresses", type: "textarea", default: "", placeholder: "One per line", span: 3 },
          ],
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const notificationsSchema: SectionSchema = {
  key: "notifications",
  title: "Notifications",
  description: "Choose what BillingAZ tells you about, and where.",
  tabs: [
    {
      id: "channels",
      label: "Channels",
      groups: [
        {
          title: "Delivery channels",
          columns: 3,
          fields: [
            yesNo("Email", "channel_email", true),
            yesNo("WhatsApp", "channel_whatsapp", false),
            yesNo("Desktop", "channel_desktop", true),
          ],
        },
        {
          title: "Alerts",
          columns: 2,
          fields: [
            yesNo("Low stock alerts", "alert_low_stock", true),
            yesNo("Payment received", "alert_payment", true),
            yesNo("Invoice created", "alert_invoice", false),
            yesNo("Backup completed / failed", "alert_backup", true),
            yesNo("Subscription reminders", "alert_subscription", true),
            yesNo("Daily sales summary", "alert_daily_summary", true),
          ],
        },
        {
          title: "Timing",
          columns: 3,
          fields: [
            { key: "summary_time", label: "Daily summary at", type: "text", default: "21:30" },
            { key: "reminder_days", label: "Payment reminder after (days)", type: "number", default: 7, min: 1 },
          ],
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Integrations                                                        */
/* ------------------------------------------------------------------ */

export const integrationsSchema: SectionSchema = {
  key: "integrations",
  title: "Integrations",
  description: "Connect payments, messaging, storage and accounting tools.",
  adminOnly: true,
  tabs: [
    {
      id: "payments",
      label: "Payments",
      groups: [
        {
          title: "Payment gateways",
          columns: 2,
          fields: [
            yesNo("Razorpay", "razorpay_enabled", false),
            { key: "razorpay_key", label: "Razorpay key id", type: "text", default: "" },
            yesNo("PhonePe", "phonepe_enabled", false),
            { key: "phonepe_merchant", label: "PhonePe merchant id", type: "text", default: "" },
            yesNo("Cashfree", "cashfree_enabled", false),
            { key: "cashfree_app_id", label: "Cashfree app id", type: "text", default: "" },
            yesNo("Paytm", "paytm_enabled", false),
            { key: "paytm_mid", label: "Paytm MID", type: "text", default: "" },
          ],
        },
      ],
    },
    {
      id: "messaging",
      label: "Messaging",
      groups: [
        {
          title: "WhatsApp Business API",
          columns: 2,
          fields: [
            yesNo("Enable WhatsApp API", "wa_api_enabled", false),
            { key: "wa_phone_id", label: "Phone number id", type: "text", default: "" },
          ],
        },
        {
          title: "Email (SMTP)",
          columns: 2,
          fields: [
            yesNo("Enable SMTP", "smtp_enabled", false),
            { key: "smtp_host", label: "Host", type: "text", default: "" },
            { key: "smtp_port", label: "Port", type: "number", default: 587 },
            { key: "smtp_user", label: "Username", type: "text", default: "" },
            { key: "smtp_from", label: "From address", type: "email", default: "" },
          ],
        },
        {
          title: "SMS gateway",
          columns: 2,
          fields: [
            yesNo("Enable SMS", "sms_enabled", false),
            { key: "sms_sender_id", label: "Sender ID", type: "text", default: "" },
          ],
        },
      ],
    },
    {
      id: "storage",
      label: "Storage & accounting",
      groups: [
        {
          title: "Cloud storage",
          columns: 3,
          fields: [
            yesNo("Google Drive", "gdrive_enabled", false),
            yesNo("Dropbox", "dropbox_enabled", false),
            yesNo("OneDrive", "onedrive_enabled", false),
            { key: "backup_folder", label: "Backup folder path", type: "text", default: "/BillingAZ/backups", span: 3 },
          ],
        },
        {
          title: "Accounting export",
          columns: 3,
          fields: [
            yesNo("Tally XML export", "tally_export", false),
            yesNo("Excel export", "excel_export", true),
          ],
        },
      ],
    },
    {
      id: "developer",
      label: "Developer",
      groups: [
        {
          title: "API access",
          columns: 2,
          fields: [
            yesNo("Enable REST API", "api_enabled", false),
            { key: "api_token_label", label: "Active token label", type: "text", default: "" },
            yesNo("Enable webhooks", "webhooks_enabled", false),
            { key: "webhook_url", label: "Webhook endpoint", type: "url", default: "", placeholder: "https://" },
            { key: "webhook_secret_hint", label: "Webhook secret hint", type: "text", default: "", help: "Never store the raw secret here." },
          ],
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Legal                                                               */
/* ------------------------------------------------------------------ */

export const legalSchema: SectionSchema = {
  key: "legal",
  title: "Legal",
  description: "Policies and disclaimers printed on documents or shown to customers.",
  adminOnly: true,
  tabs: [
    {
      id: "policies",
      label: "Policies",
      groups: [
        {
          title: "Customer facing policies",
          columns: 1,
          fields: [
            { key: "privacy_policy", label: "Privacy policy", type: "textarea", default: "", span: 3 },
            { key: "terms", label: "Terms & conditions", type: "textarea", default: "", span: 3 },
            { key: "gst_declaration", label: "GST declaration", type: "textarea", default: "Certified that the particulars given above are true and correct.", span: 3 },
            { key: "invoice_disclaimer", label: "Invoice disclaimer", type: "textarea", default: "Subject to local jurisdiction.", span: 3 },
            { key: "compliance_info", label: "Compliance information", type: "textarea", default: "", span: 3 },
          ],
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */

export const billingModesSchema: SectionSchema = {
  key: "billing_modes",
  title: "Billing modes",
  description: "Choose the counter experience used by your team while keeping one bill and invoice engine.",
  adminOnly: true,
  tabs: [
    {
      id: "general",
      label: "General",
      groups: [
        {
          title: "Counter experience",
          description: "Standard Billing is product-first. Professional Billing is optimized for keyboard and barcode entry.",
          columns: 2,
          fields: [
            {
              key: "default_mode",
              label: "Default billing mode",
              type: "select",
              default: "standard",
              options: [
                { value: "standard", label: "Standard Billing" },
                { value: "professional", label: "Professional Billing" },
              ],
            },
            yesNo("Enable Professional Billing", "professional_enabled", true, "When disabled, the counter always opens in Standard Billing."),
          ],
        },
      ],
    },
  ],
};

export const SCHEMAS: Record<string, SectionSchema> = {
  invoice: invoiceSchema,
  pos: posSchema,
  "billing-modes": billingModesSchema,
  loyalty: loyaltySchema,
  appearance: appearanceSchema,
  security: securitySchema,
  notifications: notificationsSchema,
  integrations: integrationsSchema,
  legal: legalSchema,
};

export type SettingsValues = Record<string, string | number | boolean>;

export function schemaDefaults(schema: SectionSchema): SettingsValues {
  const out: SettingsValues = {};
  for (const tab of schema.tabs)
    for (const group of tab.groups) for (const f of group.fields) out[f.key] = f.default;
  return out;
}
