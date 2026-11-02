# B2B Platform Requirements

## Status

Discovery baseline - November 2026. This document defines a single-business B2B ordering platform and combines the initial brief with verified findings from the imported POS source.

## Objective

Create a retailer-facing B2B wholesale ordering platform for one business that integrates with the existing POS while preserving the POS as the primary system of record. This is not a SaaS or multi-tenant product.

## Current POS baseline

The imported POS is a TanStack Start application using React, TypeScript, Vite, TanStack Router, TanStack Query, and Supabase/PostgreSQL. It currently provides modules for billing, products, inventory, customers, suppliers, purchases, invoices, returns, expenses, reports, settings, and dashboard operations.

The POS database includes products, categories, batches, stock movements, customers, bills, bill items, payments, purchase orders, suppliers, user roles, profiles, audit logs, day closes, and application settings. Its `create_bill` database function performs bill creation, batch stock deduction, stock-movement recording, payment recording, customer-balance updates, audit logging, and MRP-ceiling validation.

These are discovery findings, not permission to couple the storefront directly to POS tables. A controlled integration boundary must be designed and approved.

## Planned capabilities

### Existing POS

The existing POS is expected to manage products, inventory, billing, customers, pricing, invoices, and core business operations. These capabilities must be verified from the imported source code rather than assumed.

### B2B storefront

The future storefront is expected to support retailer login, product browsing, categories, wholesale pricing, quantity-based discounts, cart management, checkout, orders, and order tracking.

### Integration layer

The future integration layer is expected to support product, inventory, price, retailer, online order, and order-status synchronization.

## User journeys

### Business owner

1. Select **Business owner** on the entry screen.
2. Sign in with the existing business/POS account.
3. Enter the existing POS workspace.
4. Review incoming online orders.
5. Accept and manage orders using POS workflows.
6. Print the order or invoice and start preparing it.
7. Update order status for the customer.

### Retailer/customer

1. Select **Customer** on the entry screen.
2. Sign in or create a customer account through the shared Supabase project.
3. Browse all available POS-owned products.
4. Add products and quantities to the cart.
5. Confirm checkout and submit an online order.
6. View order confirmation, purchase history, and order status.

## Data ownership

| Domain | Initial owner | Future storefront responsibility |
| --- | --- | --- |
| Products and categories | Existing POS | Consume an approved catalog contract or projection |
| Inventory availability | Existing POS | Display availability subject to synchronization guarantees |
| Wholesale pricing and discounts | Existing POS/business rules | Display only approved prices and discount rules |
| Customer identity | Shared Supabase project | Authenticate and manage customer-facing profile |
| Online orders | Integration boundary with POS acceptance | Submit idempotently and show synchronization status |
| Invoices, payments, and operational billing | Existing POS | Display approved order/invoice status only |

## Non-functional requirements

- Preserve existing POS functionality.
- Maintain secure authentication and authorization.
- Avoid unnecessary duplication of product and inventory data.
- Keep integration concerns separate from storefront concerns.
- Support one-business account and customer isolation.
- Provide auditable synchronization and order state transitions.
- Preserve historical price and order-line snapshots.
- Make synchronization retries, failures, and reconciliation observable.

## Open questions

- What approved API or service boundary should expose POS-owned data?
- Which POS entities and business rules are safe and supported for reuse?
- What are the authoritative identifiers for products, retailers, prices, inventory, and orders?
- What synchronization frequency and consistency guarantees are required?
- What retailer roles, permissions, and onboarding flows are required?
- Should inventory be real-time, periodically projected, or reservation-backed?
- How should unavailable, changed, cancelled, or partially fulfilled orders be reconciled?
- Which existing POS order states map to customer-visible statuses?
- Which customer and purchase-history fields may be displayed?

## Acceptance criteria for implementation readiness

Implementation should not begin until:

1. The POS architecture and supported extension points are documented.
2. Ownership and synchronization direction are approved for every shared domain.
3. Retailer roles, authorization rules, and onboarding are defined.
4. Product, price, inventory, and order identifiers are agreed.
5. Failure, retry, reconciliation, audit, and observability behavior is specified.
6. A technology and deployment decision is recorded in `planning/DECISIONS.md`.
7. Customer account, purchase-history, and order-status visibility rules are approved.

## Requirements intake

Add approved detailed product requirements, acceptance criteria, business rules, and glossary entries here as they are supplied and validated.
