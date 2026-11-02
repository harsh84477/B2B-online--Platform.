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

### ADR-004: Start with a separate storefront catalog foundation

- **Status:** Accepted
- **Decision:** Begin implementation in `b2b-storefront/` as a standalone Vite, React, and TypeScript application, starting with the retailer catalog experience.
- **Reason:** This allows storefront UX and typed boundaries to be developed without modifying the POS or coupling the browser directly to POS-owned tables.
- **Consequence:** The catalog provider remains disconnected until an approved integration API and security model are finalized. No product, price, or inventory fixtures are presented as real POS data.

### ADR-005: Separate owner and retailer entry points

- **Status:** Accepted
- **Decision:** The storefront starts with a role selection screen. Business owners are handed off to the configured existing POS URL; retailers enter the B2B shopping experience.
- **Reason:** The POS and storefront have different users, permissions, and responsibilities. The storefront must not reproduce POS operations or expose them to retailers.
- **Consequence:** The POS destination must be configured with `VITE_POS_URL`, and retailer order submission must use a secure integration boundary rather than a browser-to-database write.

### ADR-006: Single-business scope

- **Status:** Accepted
- **Decision:** This platform serves one business and its retailer customers. It is not a SaaS or multi-tenant product.
- **Reason:** The owner confirmed that tenant management, subscriptions, distributor provisioning, and cross-business administration are out of scope.
- **Consequence:** Keep the data model and UI focused on one business account, its POS, and its customer accounts.

### ADR-007: Shared Supabase identity with separate application surfaces

- **Status:** Accepted
- **Decision:** The POS and storefront use the same Supabase project for authentication, while remaining separate application surfaces.
- **Reason:** This supports the business owner identity and customer accounts without coupling storefront presentation to POS operations.
- **Consequence:** Customer roles, profiles, order access, and RLS policies must be explicitly defined before real authentication and order persistence are enabled.
