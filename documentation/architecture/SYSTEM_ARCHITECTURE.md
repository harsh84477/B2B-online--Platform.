# System Architecture

## Status

Pre-implementation architecture. Technology and deployment choices are intentionally deferred until the existing POS is inspected.

## System boundaries

### Existing POS

The existing POS remains the primary source of truth for products, inventory, billing, customers, pricing, invoices, and business operations. Its source code will be imported into `existing-pos/` for analysis.

### B2B storefront

The storefront will provide the retailer-facing experience: authentication, catalog browsing, wholesale pricing, quantity discounts, cart, checkout, orders, and order tracking.

### Integration layer

The integration layer will isolate synchronization and translation concerns between the POS and storefront. It is expected to handle products, inventory, prices, retailers, online orders, and order status.

## Guiding principles

1. Prefer POS-owned business logic and data over duplicated storefront implementations.
2. Keep clear ownership and direction for every synchronized field.
3. Isolate integration failures and provide observable retry and reconciliation behavior.
4. Preserve POS operations and compatibility.
5. Design boundaries that can support multiple distributors in the future.
6. Apply least-privilege authentication and authorization throughout.

## Discovery gates

No technology stack, service boundary, persistence strategy, or API contract should be finalized until the POS architecture, extension points, data model, deployment model, and operational constraints have been documented.

## Verified POS implementation findings

The imported POS source is a TanStack Start application using React, Vite, TypeScript, TanStack Router, TanStack Query, and Supabase. The implementation is organized around file-based routes under `existing-pos/billing-az-pos/src/routes/`, shared query and billing logic under `src/lib/`, and Supabase integration under `src/integrations/supabase/`.

The authenticated application currently exposes modules for dashboard, billing, customers, expenses, inventory, invoices, products, purchases, reports, returns, suppliers, and settings. The POS uses Supabase Auth for sessions and a `user_roles` table for `ADMIN`, `SALES`, `ACCOUNTANT`, and `STOCK_MANAGER` roles.

Billing is implemented as a client query and calculation flow that submits to the Postgres `create_bill` function. That function creates bills and bill items, deducts inventory using batches, records stock movements and payments, updates customer outstanding balances, and writes an audit entry. The database function also enforces the product MRP ceiling.

These findings are implementation evidence, not a final integration contract. The future storefront must use an explicit integration boundary and must not directly couple its UI to POS tables without an approved security and ownership design.

## Future diagrams

Add approved context, container, data-flow, and deployment diagrams here after discovery. Do not represent unverified behavior as an implemented architecture.
