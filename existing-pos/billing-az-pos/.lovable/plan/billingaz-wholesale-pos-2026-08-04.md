# BillingAZ — Wholesale POS

## Stack reality check

The spec asks for Next.js + Prisma + NextAuth + self-hosted Postgres. This platform runs **TanStack Start (React 19 + Vite)** with **Lovable Cloud** (managed Postgres, auth, storage, server functions). Next.js/Prisma/NextAuth cannot be installed here. Everything in the spec is achievable with the equivalent pieces:

| Spec | Here |
| --- | --- |
| Next.js App Router | TanStack Start file routes |
| Prisma + Postgres | Lovable Cloud Postgres + SQL migrations |
| NextAuth credentials | Cloud Auth (email + password, bcrypt-managed) |
| Role middleware | `user_roles` table + RLS + server-function role checks |
| Dexie offline | Dexie.js (unchanged) |
| next-pwa | vite-plugin-pwa (offline shell + manifest) |
| SheetJS / jsPDF / Recharts | unchanged |

Everything else (Case/Piece logic, FIFO, GST, ledger, thermal print, reports) is built exactly as specified.

## Phase 1 — Foundation (this build)

1. **Design system**: warm high-contrast wholesale-counter theme, tabular-nums numerics, 44px touch targets, light default + dark toggle.
2. **Database**: full schema — shop_profile, categories, products, batches, customers, suppliers, bills, bill_items, bill_payments, stock_movements, purchase_orders, purchase_items, expense_categories, expenses, audit_log, user_roles. Grants + RLS on every table.
3. **Auth**: login screen, role-based redirect (Admin → Dashboard, Sales → Billing).
4. **Seed migration**: admin-ready roles, 10 categories, 50 Indian FMCG products with pack sizes and GST slabs, 10 customers, 3 suppliers, shop profile.
5. **Billing screen**: product browser (search + category pills + grid), cart with Case/Piece inputs, GST/round-off totals, customer selector, payment modes incl. split, Hold / Print & Save / Save & PDF / WhatsApp / Clear.
6. **Bill save server function**: atomic invoice numbering, FIFO batch deduction, stock movements, customer outstanding update, audit log.
7. **Thermal 80mm + A4 PDF** output.
8. **Dashboard**: KPI cards, 7-day sales bar, top products, payment-mode pie, recent bills.

## Phase 2 (next builds)

Products CRUD + Excel import, customers/suppliers ledgers, purchase entry, inventory & expiry, expenses, all reports + Excel export, settings (shop/invoice/printer/WhatsApp/backup/users), offline Dexie mirror + sync engine, day close, audit log viewer, PWA offline shell.

## Technical notes

- Stock always stored in base units (integer). Case/Piece is display + input only.
- FIFO deduction runs inside a Postgres function so a bill save is a single atomic transaction.
- Credit limit produces a warning banner, never a block.
- Soft delete on bills/products/customers.
- Bill writes go through authenticated server functions; SALES role cannot delete bills.
