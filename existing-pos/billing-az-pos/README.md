# billing AZ pos

# SYSTEM PROMPT: Build BillingAZ — Wholesale POS System (PWA)

## 1. PROJECT IDENTITY

- **Name:** BillingAZ

- **Type:** Progressive Web App (PWA) — Wholesale Point of Sale

- **Target Users:** Single Kirana Wholesale Business (NOT multi-tenant SaaS in V1)

- **Primary Devices:** Desktop browser + Tablet (10-inch, touch-first at counter)

- **Modes:** Online + Offline with local-first data storage

- **Design Priority:** Speed. Every invoice must be creatable in under 10 seconds after product search.

---

## 2. TECH STACK (Strict — Do Not Deviate)

- **Frontend:** Next.js 14+ (App Router), TypeScript, Tailwind CSS, shadcn/ui components

- **State Management:** Zustand (client state), TanStack Query (server state)

- **Database:** 

  - Server: PostgreSQL (via Prisma ORM)

  - Client (Offline): IndexedDB via Dexie.js

  - Sync: Background bi-directional sync when online; manual "Sync Now" button always visible

- **Auth:** NextAuth.js with Credentials Provider (username/password) + bcrypt

- **PWA:** next-pwa, service worker for offline shell, manifest.json

- **Printing:** 

  - Thermal: ESC/POS raw bytes via browser Serial/USB (58mm & 80mm)

  - A4: html2canvas + jsPDF

- **Excel:** SheetJS (xlsx) for import/export

- **WhatsApp:** WhatsApp Web API deep links (wa.me) + share API for PDF

- **Charts:** Recharts for dashboard analytics

---

## 3. CORE DATA MODEL (Prisma Schema — Build These First)

### User

- id, name, email, passwordHash, role (ADMIN | SALES | ACCOUNTANT | STOCK_MANAGER), isActive, createdAt

### ShopProfile (Singleton — one row only)

- shopName, address, phone, email, gstin, stateCode, bankName, bankAccount, ifsc, logoUrl, invoicePrefix, invoiceStartNumber, defaultGstSlab, theme (LIGHT | DARK)

### Category

- id, name, sortOrder, isActive

### Product

- id, name, sku (unique), barcode, categoryId, brand, imageUrl, description

- purchasePrice, sellingPrice, wholesalePrice, mrp

- gstPercent (0 | 5 | 12 | 18 | 28), hsnCode

- baseUnit (PIECE | KG | LITRE | GRAM | ML | BOX | BUNDLE)

- packName (Case | Box | Carton | Bag | Jar), packSize (number of base units in 1 pack)

- allowPieceSale (boolean), allowPackSale (boolean)

- currentStock (stored ALWAYS in base units, integer), minStockAlert (base units)

- isActive, createdAt, updatedAt

### Batch (CRITICAL — Every stock entry has a batch)

- id, productId, batchNumber, expiryDate, manufacturingDate, purchasePrice, quantityInBaseUnits, remainingQuantity, supplierId, createdAt

### Customer

- id, name, mobile (unique), email, gstin, address, city, pincode, state

- creditLimit (decimal, default 0 = no limit), outstandingBalance (decimal, default 0)

- isActive, createdAt

### Supplier

- id, name, mobile, email, gstin, address, outstandingBalance, isActive

### Bill (Invoice)

- id, invoiceNumber, invoiceDate, customerId, customerName (snapshot), customerGstin (snapshot), customerAddress (snapshot)

- subTotal, totalDiscount, totalGst, roundOff, grandTotal

- paymentMode (CASH | UPI | CREDIT | CHEQUE | BANK_TRANSFER | SPLIT)

- amountPaid, amountDue, paymentStatus (PAID | PARTIAL | UNPAID)

- billType (SALE | SALE_RETURN | DRAFT | HOLD)

- createdBy (userId), createdAt, updatedAt, isDeleted (soft delete), deletedAt, deletedReason

### BillItem

- id, billId, productId, productName (snapshot), sku (snapshot), hsnCode (snapshot)

- quantity (in base units), packQuantity, pieceQuantity, unitPrice, discountPercent, discountAmount

- gstPercent, taxableAmount, cgst, sgst, totalAmount

- batchId (link to Batch for FIFO costing)

### BillPayment (for split payments)

- id, billId, mode, amount, referenceNumber (for UPI/Cheque/Bank), paidAt

### StockMovement

- id, productId, batchId, type (PURCHASE | SALE | SALE_RETURN | PURCHASE_RETURN | ADJUSTMENT | OPENING_STOCK | DAMAGE)

- quantity (positive for IN, negative for OUT), referenceId (billId or purchaseId), note, createdBy, createdAt

### PurchaseOrder

- id, supplierId, invoiceNumber, invoiceDate, subTotal, totalGst, grandTotal, amountPaid, status (PENDING | COMPLETED | CANCELLED), createdAt

### PurchaseItem

- id, purchaseOrderId, productId, batchId, quantityBaseUnits, unitPrice, gstPercent, totalAmount

### ExpenseCategory

- id, name, isActive

### Expense

- id, expenseCategoryId, amount, description, date, createdBy, createdAt

### AuditLog

- id, userId, action (CREATE | UPDATE | DELETE | LOGIN | LOGOUT | PRINT | SYNC), entityType, entityId, oldData (JSON), newData (JSON), ipAddress, createdAt

---

## 4. CRITICAL BUSINESS LOGIC

### 4.1 Case / Piece Intelligence (Signature Feature)

- Every product defines: `baseUnit`, `packName`, `packSize`

- UI must display quantities as: `"{packQty} {packName} + {pieceQty} {baseUnit}"`

- Examples:

  - 24 Pieces, PackSize=12 → "2 Case"

  - 30 Pieces, PackSize=12 → "2 Case + 6 Piece"

  - 37 Pieces, PackSize=12 → "3 Case + 1 Piece" (auto-round UP logic for display only; stock is exact)

- Input methods on billing screen:

  - Type total pieces → auto-converts to Case+Piece display

  - OR type "2" in Case field and "6" in Piece field → calculates total base units = 30

- Stock is ALWAYS stored and transacted in base units. Never store "2.5 Cases".

### 4.2 Multi-Price Logic

- Product has 3 prices: purchasePrice (cost), sellingPrice (MRP/retail), wholesalePrice

- On billing screen, default to `wholesalePrice` for all customers

- BUT allow manual price override per line item

- Future-proof: Add `CustomerPrice` table (customerId + productId + customPrice) but hide UI in V1

### 4.3 GST Calculation

- Support multi-slab: 0%, 5%, 12%, 18%, 28%

- CGST = SGST = GST/2 (intra-state). Assume intra-state only for V1.

- Bill-level: item-wise GST, then sum. Round to 2 decimals per item.

- Bill total: round off to nearest rupee (standard Indian rounding: ₹0.50+ rounds up)

### 4.4 Credit & Ledger

- Every bill updates `Customer.outstandingBalance` atomically

- Credit limit: If new bill would push outstanding &gt; creditLimit, show WARNING banner (do NOT block — wholesalers override this often)

- Payment against outstanding: Create `BillPayment` records linked to the original bill, reducing `amountDue`

- Customer Ledger = all Bills + all Payments + all Returns, sorted by date, showing running balance

### 4.5 FIFO Stock Deduction (Mandatory)

- When a product is sold, deduct from the OLDEST batch first (FIFO)

- If oldest batch has 50 units and bill needs 100, take 50 from oldest + 50 from next oldest

- Track cost of goods sold per line item via linked batchId

### 4.6 Returns (Sales Return / Credit Note)

- User can create a "Sales Return" bill against an existing invoice

- Select original invoice → auto-populate items → user edits quantities to return

- Return adds stock back to original batch (or nearest available if batch expired)

- Reduces customer outstanding automatically

- Print separate "Credit Note" with reference to original invoice

### 4.7 Day Close / Shift Close

- At end of business day, user clicks "Day Close"

- System locks all bills for that day (no edits/deletions without admin override)

- Generates Day Close report: total sales, cash in hand, UPI total, credit total, bill count, item count

- Next day starts fresh shift

---

## 5. MODULE-BY-MODULE FEATURE SPECS

### MODULE A: AUTH & DASHBOARD

**Login Screen:**

- Clean, centered card. Username + Password. "Remember me" checkbox.

- Role-based redirect: Admin→Dashboard, Sales→Billing Screen directly

**Dashboard:**

- KPI Cards: Today's Sales (₹ + bill count), Monthly Sales, Total Customers, Outstanding Due, Low Stock Count

- Charts: 

  - Last 7 days sales (bar chart)

  - Top 5 selling products (horizontal bar)

  - Payment mode distribution (pie chart: Cash vs UPI vs Credit)

- Recent Bills table (last 10), clickable to view/print

- Quick Actions: New Bill, Add Product, Add Customer, Day Close

### MODULE B: BILLING SCREEN (Primary Workspace — Optimize Heavily)

**Layout:**

- LEFT 65%: Product browser + search

- RIGHT 35%: Cart + Customer + Totals + Actions

**Product Browser:**

- Search bar at top (auto-focus on load). Search across: name, sku, barcode

- Category pills horizontally scrollable below search (All, Spices, Rice, Oil, etc.)

- Product grid: Large cards (image thumbnail, name, price, stock). Touch-friendly (min 120px height)

- Click product → adds to cart with qty=1 pack (if allowPackSale) or 1 piece (if not)

- Keyboard shortcut: Type number + Enter = add by SKU/barcode instantly

**Cart Panel:**

- Table: Product | Qty (Case+Piece inputs) | Price | Disc% | GST | Total

- Inline editing: click qty → type number → Enter. Click discount → type % → Enter.

- Running totals: Subtotal, Discount, GST (CGST+SGST), Round Off, Grand Total

- Customer selector: Search by name/mobile. "Add New Customer" inline modal.

- Payment section:

  - Mode selector: Cash / UPI / Credit / Cheque / Bank Transfer / Split

  - If Split: show multiple rows (Mode + Amount)

  - Amount Paid input (auto-filled with grand total)

  - If Amount Paid &lt; Grand Total → auto-set balance as CREDIT due

- Action Buttons (large, colored):

  - [HOLD] — saves as draft, clears screen

  - [PRINT & SAVE] — saves, prints thermal, clears screen

  - [SAVE & PDF] — saves, opens PDF in new tab

  - [SAVE & WHATSAPP] — saves, generates PDF, opens wa.me with pre-filled message + PDF upload

  - [CLEAR] — confirm dialog, empties cart

**Hold Bills:**

- Sidebar or modal showing all held bills. Click to resume. Show customer name + total + time held.

### MODULE C: PRODUCT MANAGEMENT

- Grid view with filters (category, low stock, active/inactive)

- Add/Edit form with all Product fields

- Image upload: compress to 200x200 thumbnail, store as base64 in DB (keep it simple for V1)

- Stock adjustment modal: reason required (Damage, Expired, Found, Lost)

- Excel Import: Upload XLSX with columns: Name, SKU, Category, PurchasePrice, SellingPrice, WholesalePrice, GST, HSN, PackSize, OpeningStock. Validate and preview before import.

### MODULE D: CUSTOMER MANAGEMENT

- List with search. Columns: Name, Mobile, Outstanding, Credit Limit, Status

- Detail view: Profile + Ledger (chronological) + Purchase History + Payment History

- "Receive Payment" action: opens modal → amount + mode + date → updates outstanding

- Customer statement export: PDF of ledger for date range

### MODULE E: SUPPLIER & PURCHASE

- Supplier list similar to customers

- Purchase Entry: Select supplier → add products with batch info → enter quantities → save

- On save: creates PurchaseOrder + StockMovement (IN) + Batch records + updates Product.currentStock

- Supplier ledger: Purchases vs Payments

### MODULE F: INVENTORY

- Stock Report: Product | Opening | Purchased | Sold | Adjusted | Closing | Min Stock | Status

- Low Stock Alert page: filter products below minStockAlert

- Batch-wise stock view: per product, show all batches with expiry dates and remaining qty

- Expiry Alert: products expiring within 30/60/90 days

### MODULE G: EXPENSES

- Simple form: Category | Amount | Date | Description

- Monthly expense report

### MODULE H: REPORTS

All reports must have date range filter and Excel export.

- Daily Sales: Date | Bill Count | Cash | UPI | Credit | Total

- Monthly Sales: Month | Total Sales | Total GST | Bill Count

- Product Sales: Product | Qty Sold | Revenue | Profit

- Customer Report: Customer | Total Purchased | Total Paid | Outstanding

- Due Report: All customers with outstanding &gt; 0, sorted by amount

- Purchase Report: Date | Supplier | Amount | GST

- Stock Report (as above)

- Expense Report

- GST Report: Summary of taxable value + CGST + SGST per slab for the period (GSTR-1 ready format)

### MODULE I: SETTINGS

- Shop Profile: All business details for invoice header

- Invoice Settings: Prefix, start number, terms & conditions footer, auto-print on save (toggle)

- Printer: Select default thermal printer (USB/Serial), test print, A4 template preview

- WhatsApp: Default message template with variables like {{invoiceNumber}}, {{amount}}, {{shopName}}

- Backup: Export full DB as encrypted JSON. Import to restore.

- Users: CRUD users, assign roles

- Roles & Permissions matrix:

  - ADMIN: All access

  - SALES: Billing, Hold Bills, View Products/Customers (no costs), View own reports only

  - ACCOUNTANT: All reports, expenses, customer payments, no billing

  - STOCK_MANAGER: Products, purchases, stock reports, no billing, no sales reports

---

## 6. UI/UX REQUIREMENTS

- **Theme:** Light mode default. Dark mode toggle in settings.

- **Typography:** Inter or system-ui. Numbers (prices, quantities) must use tabular-nums.

- **Touch Targets:** Minimum 44px for all buttons on billing screen.

- **Speed:** Product search must debounce at 150ms and return results in &lt;300ms for 10,000 products.

- **Feedback:** Every save action shows toast notification. Every destructive action shows confirmation modal.

- **Accessibility:** All inputs must have labels. Keyboard navigation must work throughout (Tab order logical).

- **Responsive:** Billing screen must work on 1366x768 (laptop) and 1920x1080. Tablet (1024x768) must show single-column product grid.

- **Empty States:** Every list/page must have friendly empty state with icon and action button.

---

## 7. OFFLINE-FIRST STRATEGY

1. **Service Worker:** Cache app shell. All static assets work offline.

2. **IndexedDB (Dexie.js):** Mirror critical tables locally: Products, Customers, Categories, ShopProfile, Bills (pending sync), Stock (read-only snapshot)

3. **Offline Billing:** When offline, bills save to IndexedDB immediately. Queue for sync.

4. **Sync Engine:** 

   - When online, background sync runs every 60 seconds

   - "Sync Now" button in header shows pending count (e.g., "Sync (3)")

   - Sync order: Customers → Products → Bills → Stock Movements

   - Conflict rule: Server wins for products; but if bill numbers conflict, alert admin to resolve

5. **Offline Indicators:** Red banner "You are offline — bills will sync when connection returns"

---

## 8. SECURITY & COMPLIANCE

- All passwords hashed with bcrypt (cost factor 10)

- API routes protected by NextAuth session/JWT

- Role-based middleware on all sensitive API routes

- Audit log captures: who created/edited/deleted what and when

- Soft deletes on Bills, Products, Customers (never hard delete financial records)

- Input sanitization on all text fields

- Rate limiting on login (5 attempts per IP per 15 min)

---

## 9. INVOICE PRINT / PDF SPECIFICATIONS

**Thermal (80mm):**

- Header: Shop name (bold, center), address, GSTIN, phone

- Separator line: "--------------------------------"

- Bill info: Invoice #, Date, Customer, Payment Mode

- Items table: Item (truncated 16 chars) | Qty | Rate | Amt

- Totals: Subtotal, Discount, GST, Round, GRAND TOTAL

- Footer: "Thank You! Visit Again" + Terms

- Font: Monospace 12pt. Compact spacing.

**A4 PDF:**

- Full professional letterhead with logo

- Two-column item table with HSN, GST breakdown per item

- Signature area: "For [Shop Name]" + "Customer Signature"

- Terms & Conditions page 2 if needed

---

## 10. V1 SCOPE BOUNDARIES (Do NOT Build These Yet)

- ❌ Multi-branch / multi-warehouse

- ❌ Multi-tenancy (SaaS)

- ❌ Barcode scanner hardware integration (keep keyboard input for V1)

- ❌ AI Sales Analytics

- ❌ Mobile native app (PWA only)

- ❌ Advanced accounting (ledger, trial balance, P&L)

- ❌ Direct GST portal filing (only export Excel)

- ❌ E-Way Bill

- ❌ Loyalty / reward points

- ❌ Purchase orders (only purchase ENTRY, not PO workflow)

---

## 11. IMPLEMENTATION ORDER (Build In This Sequence)

1. Project scaffold + DB schema + Auth + Role middleware

2. Shop Profile settings + Seed data

3. Category + Product CRUD + Excel import

4. Customer + Supplier CRUD

5. Billing Screen (UI only, no save)

6. Cart logic + Case/Piece conversion + GST calc

7. Bill save + Print Thermal + PDF generation

8. Stock deduction (FIFO) + Batch tracking

9. Purchase Entry + Supplier ledger

10. Dashboard + Reports

11. Offline sync (IndexedDB + background sync)

12. Day Close + Audit Logs

13. Polish: Dark mode, animations, PWA manifest, testing

---

## 12. SEED DATA REQUIREMENTS

Provide seed script with:

- 1 Admin user (admin / admin123 — force password change on first login)

- 10 Categories (Spices, Rice, Pulses, Oil, Biscuit, Soap, Shampoo, Dairy, Cold Drinks, Snacks)

- 50 Sample Products with realistic Indian FMCG names, GST slabs, and pack sizes

- 10 Sample Customers with Indian names and mobile numbers

- 3 Suppliers

---

## 13. TESTING SCENARIOS (Must Pass Before Delivery)

1. Create a bill for "Aashirvaad Atta 5kg" — 2 Cases + 3 Pieces where PackSize=4. Verify total base units = 11. Verify stock reduces by 11.

2. Sell 100 units of a product with 3 batches (40, 40, 50). Verify FIFO deduction: 40 from batch1, 40 from batch2, 20 from batch3.

3. Create split payment bill: ₹500 cash + ₹1500 UPI. Verify both payments recorded.

4. Go offline. Create 3 bills. Reconnect. Verify sync queue processes and bills appear server-side with correct invoice numbers.

5. Attempt to delete a bill as SALES user. Verify 403 forbidden.

6. Generate thermal print output — verify all fields fit 80mm width without overflow.

7. Export monthly GST report — verify CGST+SGST math matches individual bills.

---

## 14. DELIVERABLES

- Fully functional Next.js application

- Prisma schema + migration files

- Seed script

- PWA manifest + service worker

- README with setup instructions (npm install, db setup, env variables)

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/cc133f29-714b-448c-91b3-c74de7095403).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
