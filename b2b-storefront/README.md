# B2B Storefront

The first implementation slice is a standalone Vite, React, and TypeScript catalog foundation.

## Current slice

- Retailer-facing storefront shell
- Catalog search and category controls
- Role selection for business owners and retailers
- Customer cart and checkout surface
- Typed catalog provider boundary
- Explicit loading, error, and empty states
- No direct POS database access
- No invented product data
- Owner handoff uses the configured `VITE_POS_URL`
- Orders are submitted to the POS-owned online order queue through a guarded Supabase RPC
- Owner authentication will use the existing POS account through the shared Supabase project
- Customer authentication, purchase history, and order-status tracking will use the shared Supabase project

The catalog provider reads the POS-owned online catalog through Supabase. Products must be marked **Show in ecommerce** in the POS, and the storefront requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Development

```bash
npm install
npm run dev
npm run build
```

The POS migration `20261113000000_add_online_order_boundary.sql` must be applied before
deploying checkout. POS staff can then review pending orders from the `online_orders` queue
and accept them through the normal billing workflow.
