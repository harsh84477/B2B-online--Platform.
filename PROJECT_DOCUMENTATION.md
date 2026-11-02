# Project Documentation Guide

## Purpose

This repository will support the analysis and gradual integration of an existing POS application with a future B2B distributor ordering platform. Documentation is intentionally established before implementation so that the existing POS architecture, business rules, and data ownership can be understood first.

## Documentation map

| Document | Responsibility |
| --- | --- |
| [Product requirements](documentation/product-requirements/B2B-Platform-Requirements.md) | Scope, actors, capabilities, constraints, and open questions |
| [Reference screenshots](documentation/reference-screenshots/README.md) | Organization and interpretation of visual references |
| [System architecture](documentation/architecture/SYSTEM_ARCHITECTURE.md) | System boundaries, ownership, integration principles, and future architecture |
| [Database design](documentation/database/DATABASE_DESIGN.md) | Data ownership, identity, synchronization, and future modeling principles |
| [API documentation](documentation/api/API_DOCUMENTATION.md) | Future API conventions and integration contract guidance |
| [Development roadmap](documentation/implementation/DEVELOPMENT_ROADMAP.md) | Discovery-first implementation phases and gates |
| [Tasks](planning/TASKS.md) | Planned work items |
| [Decisions](planning/DECISIONS.md) | Architectural and product decisions |

## Documentation standards

- Record verified facts separately from assumptions and open questions.
- Link decisions to the evidence that supports them.
- Do not document capabilities as existing until the POS source has been inspected.
- Keep synchronization ownership and data direction explicit.
- Update related documentation when an approved design changes.

## Planned documentation inputs

The project owner will provide:

1. Detailed B2B product documentation.
2. Fairdeal Market reference screenshots.
3. Existing POS source code.

These inputs should be reviewed before selecting a technology stack or defining implementation contracts.

