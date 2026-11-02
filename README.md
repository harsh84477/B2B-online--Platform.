# B2B Distributor Ordering Platform

This repository is the foundation for a B2B wholesale ordering platform that will eventually integrate with an existing point-of-sale (POS) application.

## Current status

This project is in the initialization and discovery phase. It contains project structure, documentation templates, planning records, and development guidance only. No application functionality has been implemented.

## Architecture at a glance

- **Existing POS**: The operational system of record for products, inventory, customers, pricing, billing, invoices, and business operations.
- **B2B Storefront**: The future retailer-facing ordering experience.
- **Integration Layer**: The future boundary for synchronizing data and orders between the POS and storefront.
- **Shared**: Future reusable contracts, utilities, and shared definitions.
- **Infrastructure**: Future deployment, environment, monitoring, and operational configuration.

The existing POS remains the primary source of truth. Technology choices will be made only after the POS source code is imported and inspected.

## Repository guide

| Location | Purpose |
| --- | --- |
| `documentation/` | Product, architecture, database, API, implementation, and reference-material documentation |
| `existing-pos/` | Location for the owner to copy the existing POS source code |
| `b2b-storefront/` | Reserved for the future retailer-facing application |
| `integration/` | Reserved for future POS and storefront integration code |
| `shared/` | Reserved for future shared contracts and components |
| `infrastructure/` | Reserved for future operational and deployment configuration |
| `planning/` | Decisions, tasks, and delivery planning |

## Getting started

Read [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md), [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md), and the documents under `documentation/` before making implementation decisions.

## Source materials

- Copy the existing POS source code into `existing-pos/` without replacing its source of truth or inventing missing components.
- Add product requirements and supporting product documentation under `documentation/product-requirements/`.
- Add Fairdeal Market and other reference screenshots under `documentation/reference-screenshots/`.

