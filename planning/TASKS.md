# Project Tasks

## Initialization

- [x] Create the documentation and workspace structure.
- [x] Establish project-wide development instructions.
- [x] Record initial architecture constraints.

## Discovery

- [ ] Copy the existing POS source into `existing-pos/`.
- [ ] Inventory the POS technology stack and runtime requirements.
- [ ] Map POS modules, data stores, business rules, and extension points.
- [ ] Identify authoritative identifiers and synchronization capabilities.
- [ ] Review detailed B2B product documentation.
- [ ] Catalog and annotate reference screenshots.

## Architecture

- [ ] Define verified system boundaries and data ownership.
- [ ] Document security, authorization, audit, and observability requirements.
- [ ] Decide synchronization patterns and reconciliation behavior.
- [ ] Evaluate technology options only after POS inspection.
- [ ] Approve an implementation plan with measurable acceptance criteria.

## Implementation readiness

- [x] Confirm the first implementation slice: separate storefront catalog foundation.
- [x] Confirm single-business scope and shared Supabase identity approach.
- [ ] Create implementation-specific tasks after discovery.
- [ ] Establish validation, testing, and deployment requirements.

## First implementation slice

- [x] Create the standalone storefront application shell.
- [x] Add typed catalog provider boundary.
- [x] Add catalog search and category filtering UI.
- [x] Add explicit disconnected-integration state.
- [x] Add owner/customer role entry flow.
- [x] Add customer cart and checkout surface.
- [ ] Connect the provider to an approved integration contract.
- [ ] Add owner and customer authentication through shared Supabase.
- [ ] Add customer order submission through a server-side integration function.
- [ ] Add customer purchase history and order-status tracking.
- [ ] Add POS incoming-order review and preparation workflow.
