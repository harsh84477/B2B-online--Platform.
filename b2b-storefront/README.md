# B2B Storefront

The first implementation slice is a standalone Vite, React, and TypeScript catalog foundation.

## Current slice

- Retailer-facing storefront shell
- Catalog search and category controls
- Role selection for business owners and retailers
- Customer cart and checkout surface
- Dynamic product detail page with a responsive 2–5 image gallery
- Retail partner sign-in gate before checkout
- Business and delivery address collection during checkout
- POS-controlled pack choices with custom quantities and labels per product
- Typed catalog provider boundary
- Explicit loading, error, and empty states
- No direct POS database access
- No invented product data
- Owner handoff uses the configured `VITE_POS_URL`
- Orders are submitted to the POS-owned online order queue through a guarded Supabase RPC
- Owner authentication will use the existing POS account through the shared Supabase project
- Customer authentication, purchase history, and order-status tracking will use the shared Supabase project

The current UI validates the sign-in form and keeps the checkout flow gated behind an authenticated
state. The Supabase authentication call and customer/address fields should be connected to the
production account and online-order RPC contract before launch.

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

The POS migrations `20261115000000_add_online_pack_options.sql` and
`20261115010000_allow_custom_online_pack_options.sql` add the retailer pack
configuration. Administrators can publish or hide each product, enable or disable
pack choices, add custom quantities such as Pack of 3 or Pack of 4, rename them
to labels such as “Bag of 10”, and delete choices from **Manage Ecommerce**.
The storefront reads those per-product choices from the POS.
