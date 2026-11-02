# Architecture Decisions

## Decision record format

For each decision, record the date, status, context, decision, alternatives considered, consequences, and evidence.

## Initial decisions

### ADR-001: Existing POS is the primary source of truth

- **Status:** Accepted
- **Decision:** The existing POS owns operational product, inventory, customer, pricing, billing, invoice, and business-operation data unless a later, documented decision explicitly changes ownership.
- **Reason:** The platform must preserve existing POS behavior and avoid unnecessary duplication.
- **Consequence:** Storefront and integration designs must account for POS interfaces, availability, consistency, and failure modes.

### ADR-002: Defer technology selection until POS inspection

- **Status:** Accepted
- **Decision:** Do not select or install a new technology stack before the existing POS architecture is imported and inspected.
- **Reason:** The integration approach and reuse strategy depend on verified POS technology and extension points.
- **Consequence:** This initialization contains documentation only and no application scaffold.

### ADR-003: Keep integration separate from storefront

- **Status:** Accepted
- **Decision:** POS synchronization and translation logic belong in the integration boundary, separate from retailer-facing storefront concerns.
- **Reason:** Separation supports maintainability, observability, security, and future multi-distributor support.
- **Consequence:** Future implementation must define explicit contracts between the storefront, integration layer, and POS.

