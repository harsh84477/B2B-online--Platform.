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
- Order submission remains blocked until the integration contract is connected

The current provider intentionally reports that the approved integration boundary is not configured. Product data, prices, and availability must come from the POS-owned catalog through that boundary.

## Development

```bash
npm install
npm run dev
npm run build
```

The next approved slice should connect `src/catalog/provider.ts` to the integration contract after the API and security design are finalized.
