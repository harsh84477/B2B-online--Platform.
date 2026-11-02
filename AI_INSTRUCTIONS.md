# AI Development Instructions

## Mission

Assist with establishing and implementing a secure, scalable B2B wholesale ordering platform around the existing POS application. During the current initialization phase, documentation and analysis take precedence over code.

## Current phase restrictions

- Do not implement application functionality yet.
- Do not create a frontend, backend, database, API implementation, or framework scaffold.
- Do not install dependencies unless an approved implementation task requires them.
- Do not invent POS behavior, APIs, schemas, integrations, or business rules.
- Do not modify the existing POS behavior or source unless a later task explicitly authorizes it.
- Do not select a technology stack before inspecting the imported POS architecture.

## Architecture principles

- Treat the existing POS as the primary source of truth.
- Reuse existing POS business logic where practical rather than duplicating it.
- Avoid unnecessary duplicate product and inventory databases.
- Keep the integration layer separate from the storefront.
- Preserve existing POS functionality.
- Design for future multi-distributor support.
- Use secure authentication, authorization, validation, auditing, and secret handling.

## Working practices

1. Inspect relevant source and documentation before proposing changes.
2. Distinguish observed facts, assumptions, and decisions.
3. Prefer small, traceable changes that preserve existing behavior.
4. Update directly related documentation when a decision changes.
5. Validate changes with the smallest appropriate checks.
6. Surface errors explicitly; do not hide failures behind silent defaults.
7. Avoid committing credentials, personal data, generated artifacts, or local environment files.

## Source placement

The owner should copy the existing POS source into `existing-pos/`. Do not generate substitute POS files or placeholder application code in that directory.

