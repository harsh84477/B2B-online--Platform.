# Database Design

## Status

Discovery placeholder. No database schema has been selected or implemented.

## Ownership principles

- The existing POS is the system of record for products, inventory, pricing, customers, invoices, and business operations.
- The storefront should not independently redefine POS-owned data without an approved synchronization design.
- Any local projections should be explicitly identified as projections, with an owner, refresh strategy, and reconciliation process.

## Verified POS schema findings

The imported Supabase migrations define a PostgreSQL schema containing:

- Identity and access: `profiles`, `user_roles`, and role helpers for `ADMIN`, `SALES`, `ACCOUNTANT`, and `STOCK_MANAGER`.
- Catalog: `shop_profile`, `categories`, and `products`.
- Inventory and procurement: `batches`, `stock_movements`, `suppliers`, `purchase_orders`, and `purchase_items`.
- Sales and receivables: `customers`, `bills`, `bill_items`, `bill_payments`, `customer_payments`, and `credit_notes`.
- Operations and controls: `expense_categories`, `expenses`, `audit_log`, `day_closes`, and `app_settings`.

Products contain SKU, barcode, category, brand, purchase/selling/wholesale/MRP prices, GST, unit and pack information, stock totals, and soft-delete state. Inventory is represented both by product `current_stock` and batch-level remaining quantities. Bills preserve customer and line-item snapshots, including quantity, pack/piece quantities, pricing, tax, and totals.

The `create_bill` database function is the current transactional billing boundary. For sale bills it allocates quantities from batches in creation order, records stock movements, updates `products.current_stock`, records payments, updates customer outstanding balances, and writes an audit record. It rejects sale prices above a product's configured MRP.

These findings must be validated against the complete migration set and live deployment before defining storefront synchronization or a new data model. In particular, determine whether the storefront should consume an approved POS API, a controlled integration service, or read-only projections rather than accessing POS tables directly.

## Entities for discovery

Document the POS representation and authoritative identifiers for:

- Products and categories
- Inventory and availability
- Prices and quantity-based discounts
- Retailers and contacts
- Carts, orders, and order lines
- Invoices and payments
- Order statuses and synchronization events

## Design questions

- Which existing database(s) and access patterns does the POS use?
- Can business logic be reused through existing services or APIs?
- Which data must be read in real time versus synchronized?
- How are identifiers, deletions, corrections, and historical prices handled?
- What retention, audit, privacy, and tenant-isolation requirements apply?

Do not create migrations, duplicate schemas, or seed data until these questions are answered from verified POS evidence.
