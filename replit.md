# ZARI ERP Workspace

## Overview

pnpm workspace monorepo using TypeScript. Full-stack ERP authentication system for Zari Embroideries.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: JWT (jsonwebtoken) + bcrypt (bcryptjs)
- **Frontend**: React + Vite + Tailwind CSS

## Artifacts

- **ZARI ERP** (`artifacts/zari-erp`) — React frontend at `/`
- **API Server** (`artifacts/api-server`) — Express backend at `/api`

## Authentication

- JWT tokens with bcrypt password hashing
- Default admin: `admin@zarierp.com` / `Admin@123`
- Token stored in localStorage under `zarierp_token`
- Protected routes via `useGetMe` hook

## Frontend Pages & Navigation

- **Login** (`/login`) — Split-screen auth page with ZariButton (black + gold text)
- **Forgot Password** (`/forgot-password`) — 3-step: request → reset → success
- **Dashboard** (`/dashboard`) — Summary cards + recent activity
- **HSN Master** (`/masters`) — Full CRUD master module (see below)
- **TopNavbar** — Horizontal nav bar: ZARI branding left, nav links center, user+logout right
- **ZariButton** — Reusable button: primary (black bg + gold text) and secondary variants

## Navigation

- **TopNavbar** — "Masters" is a click-open dropdown (HSN, Materials, Fabric). "Orders" is a direct link. Other links: Vendors, Settings.
- Direct link `/masters` redirects to `/masters/hsn`
- Nav active state: exact match for most links; `startsWith` used for `/orders` so `/orders/:id` also highlights the nav item

## Reusable Master Components

Located at `artifacts/zari-erp/src/components/master/`:
- `MasterHeader` — Page title + Add button
- `MasterTable` — Data table with sortable cols, skeleton loading, empty state
- `MasterFormModal` — Centered modal with header/footer and keyboard close
- `StatusToggle` — Active/Inactive pill button
- `SearchBar` — Search input with clear button
- `ExportExcelButton` — XLSX export using the `xlsx` library

Reusable UI fields at `artifacts/zari-erp/src/components/ui/`:
- `InputField`, `TextareaField`, `SelectField` — Styled form controls with labels and inline errors
- `AddableSelect` — Custom dropdown (DOM-based, not native `<select>`) with optional inline "+ Add New" action at bottom
- `ConfirmModal` — Delete confirmation modal with warning icon, Cancel + red Delete buttons

## Procurement Module (Unified PO→PR flow)

Centralized procurement across Inventory, Swatch Costing, and Style Planning via unified PO→PR workflow.

### DB Changes
- `purchase_orders` — added `reference_type` (Inventory/Swatch/Style/Manual), `reference_id`
- `purchase_order_items` — new table: id, po_id FK, inventory_item_id FK, item_name/code, ordered_quantity, received_quantity, pending_quantity, unit_price, unit_type, warehouse_location, remarks
- `purchase_receipt_items` — new table: id, pr_id FK, po_item_id FK, inventory_item_id FK, quantity, unit_price, unit_type, warehouse_location, remarks
- `purchase_receipts` — kept; legacy NOT NULL fields (received_qty, actual_price, warehouse_location) filled with dummy values for old rows

### API routes (artifacts/api-server/src/routes/procurement.ts)
- `GET /api/procurement/purchase-orders` — filterable PO list (referenceType, status, search, sort, page)
- `GET /api/procurement/purchase-orders/:id` — PO detail with items array
- `POST /api/procurement/purchase-orders` — create new PO with line items (inventoryItemId required)
- `PATCH /api/procurement/purchase-orders/:id/status` — update PO status (Draft→Approved→Partially Received→Closed)
- `DELETE /api/procurement/purchase-orders/:id` — delete Draft PO only
- `GET /api/procurement/purchase-receipts` — filterable PR list (referenceType, status, date range, search, sort, page)
- `GET /api/procurement/purchase-receipts/:id` — PR detail with items
- `POST /api/procurement/purchase-receipts` — create PR against approved PO; `confirmNow=true` updates inventory (weighted avg) + vendor ledger
- `POST /api/procurement/purchase-receipts/:id/confirm` — confirm open PR, updates inventory + ledger
- `POST /api/procurement/purchase-receipts/:id/cancel` — cancel PR (reverses inventory if Received)
- `DELETE /api/procurement/purchase-receipts/:id` — delete PR
- `GET /api/procurement/approved-pos` — list POs in Approved/Partially Received status
- `GET /api/procurement/item-tracking` — per-item ordered/received/pending quantities

### Frontend pages
- `/procurement/purchase-orders` — `PurchaseOrderList.tsx` (filterable, paginated, source/status badges, ordered/received/pending qty)
- `/procurement/purchase-orders/new` — `PurchaseOrderForm.tsx` create mode (vendor + date + line items with item search dropdown)
- `/procurement/purchase-orders/:id` — `PurchaseOrderForm.tsx` view mode (summary cards, items with progress bars, Approve + Create Receipt buttons)
- `/procurement/purchase-receipts` — `PurchaseReceipts.tsx` (filterable, date range, cancel/delete actions)
- `/procurement/purchase-receipts/new?poId=X` — `PurchaseReceiptForm.tsx` create mode (PO selector, pending qty per item, Save Draft or Confirm)
- `/procurement/purchase-receipts/:id` — `PurchaseReceiptForm.tsx` view mode (Confirm button for Open receipts)

### Navigation
- TopNavbar: Procurement dropdown added (Purchase Orders, Purchase Receipts) — both desktop and mobile menus
- Inventory menu: removed Purchase Receipts sub-link (now lives under Procurement)

## API Routes

- `POST /api/auth/login` — Login, returns JWT
- `POST /api/auth/logout` — Logout
- `POST /api/auth/forgot-password` — Request password reset
- `POST /api/auth/reset-password` — Reset password with token
- `GET /api/auth/me` — Get current user (requires Bearer token)
- `GET /api/hsn` — List HSN records (search, status, page, limit; filter is_deleted=false; sorted created_at DESC)
- `POST /api/hsn` — Create HSN record
- `PUT /api/hsn/:id` — Update HSN record
- `PATCH /api/hsn/:id/status` — Toggle Active/Inactive
- `DELETE /api/hsn/:id` — Soft delete (sets is_deleted=true)
- `GET /api/materials` — List materials (search, status, page, limit; filter is_deleted=false)
- `POST /api/materials` — Create material (auto-generates MAT0001... code)
- `PUT /api/materials/:id` — Update material
- `PATCH /api/materials/:id/status` — Toggle Active/Inactive
- `DELETE /api/materials/:id` — Soft delete
- `GET /api/fabrics` — List fabrics (search, status, page, limit; filter is_deleted=false)
- `POST /api/fabrics` — Create fabric (auto-generates FAB0001... code)
- `PUT /api/fabrics/:id` — Update fabric
- `PATCH /api/fabrics/:id/status` — Toggle Active/Inactive
- `DELETE /api/fabrics/:id` — Soft delete
- `GET /api/lookups/:type` — List lookup records (item-types, unit-types, width-unit-types)
- `POST /api/lookups/:type` — Create lookup record
- `GET /api/swatch-orders` — List swatch orders (search, status, priority, page, limit; filter is_deleted=false; sorted created_at DESC)
- `GET /api/swatch-orders/:id` — Get single swatch order
- `POST /api/swatch-orders` — Create swatch order (auto-generates SWO-YYYY-NNN code)
- `PUT /api/swatch-orders/:id` — Full update
- `PATCH /api/swatch-orders/:id/status` — Patch orderStatus / priority
- `DELETE /api/swatch-orders/:id` — Soft delete
- `GET /api/orders` — List orders (search, status, orderType, page, limit; filter is_deleted=false; sorted created_at DESC)
- `GET /api/orders/:id` — Get single order by ID
- `POST /api/orders` — Create order (auto-generates ORD0001... code)
- `PUT /api/orders/:id` — Full update
- `PATCH /api/orders/:id/status` — Patch status fields (status, costStatus, approvalStatus, invoiceStatus, productionMode, invoiceNumber, paymentStatus)
- `DELETE /api/orders/:id` — Soft delete

## Database Schema

- `users` table: id, username, email, hashed_password, role, is_active, created_at
- `hsn_master` table: id, hsn_code (unique), gst_percentage, govt_description, remarks, is_active, is_deleted, created_by, created_at, updated_by, updated_at
- `materials` table: id, material_code (auto MAT0001...), item_type, quality, type, color, hex_code, color_name, size, unit_price, unit_type, current_stock, hsn_code, gst_percent, vendor, location, images (jsonb, default '[]'), is_active, is_deleted, created_by/at, updated_by/at
- `fabrics` table: id, fabric_code (auto FAB0001...), fabric_type, quality, color, hex_code, color_name, width, width_unit_type, price_per_meter, unit_type, current_stock, hsn_code, gst_percent, vendor, location, images (jsonb, default '[]'), is_active, is_deleted, created_by/at, updated_by/at
- `inventory_items` table: images column (jsonb, default '[]') synced from master on material/fabric update
- `purchase_order_items` + `purchase_receipt_items`: item_image (text, nullable) — per-line base64 image
- `orders` table: id, order_id (auto ORD0001...), order_type (swatch|style), client, status, priority, assigned_to, delivery_date, remarks, production_mode, cost_status, approval_status, invoice_status, invoice_number, payment_status, plus swatch fields (fabric/length/width/quantity/refs), style fields (product/pattern/size/colors), making process, artwork, costing, client centre, is_deleted, audit columns
- `item_types` table: id, name (unique), is_active, created_at
- `unit_types` table: id, name (unique), is_active, created_at
- `width_unit_types` table: id, name (unique), is_active, created_at

## Quotation Module

**Tables (created via raw SQL):**
- `quotations`: id, quotation_number (QT-YYYY-NNNNN), client_id, client_name, client_state, requirement_summary, estimated_weight, estimated_shipping_charges, subtotal_amount, gst_type, gst_rate, gst_amount, total_amount, status, revision_number, parent_quotation_id, internal_notes, client_notes, converted_to, converted_reference_id, converted_at, created_by, created/updated_at
- `quotation_designs`: id, quotation_id, design_name, hsn_code, design_image (base64), remarks, created_at
- `quotation_custom_charges`: id, quotation_id, charge_name, hsn_code, unit, quantity, price, amount, created_at
- `quotation_feedback_logs`: id, quotation_id, feedback_text, feedback_by, feedback_date, revision_reference, created_at
- `quotation_number_seq`: PostgreSQL sequence for unique quotation numbers

**Backend routes** (`artifacts/api-server/src/routes/quotations.ts`):
- GET /quotations — list with filters (search, status, clientId, fromDate, toDate, page, limit)
- POST /quotations — create new
- GET /quotations/:id — get single with designs, charges, feedback, revisions
- PUT /quotations/:id — update
- DELETE /quotations/:id — admin only
- POST /quotations/:id/status — status transition (validated against allowed transitions map)
- POST /quotations/:id/feedback — add feedback log
- POST /quotations/:id/revise — create revision (copies all data, increments revision_number, links parent_quotation_id)
- POST /quotations/:id/convert-swatch — creates swatch_orders record, marks converted_to=Swatch
- POST /quotations/:id/convert-style — creates style_orders record, marks converted_to=Style

**Status workflow**: Draft → Sent → Client Reviewing → [Correction Requested → Revised → Sent | Approved | Rejected]
When Approved: Convert to Swatch or Convert to Style (with duplicate protection — cannot convert to same type twice)

**Frontend pages:**
- `QuotationList.tsx` (`/quotation`) — list with search/status/date filters, pagination, status badges
- `QuotationForm.tsx` (`/quotation/new`, `/quotation/:id/edit`) — create/edit with designs (base64 images) + charges table + auto-computed totals
- `QuotationDetail.tsx` (`/quotation/:id`) — view + status transitions + feedback modal + revision creation + convert to Swatch/Style (with confirmation and duplicate protection)

**GST logic**: `COMPANY_STATE` env var (default "Maharashtra"); CGST+SGST for same state, IGST for different state. Rate: 18%.

## File Upload System

File uploads use a **modular storage abstraction layer** in `artifacts/api-server/src/`:

**Storage drivers** (`src/storage/`):
- `localStorage.ts` — writes files to local disk under `uploads/`
- `s3Storage.ts` — stub for future AWS S3 (throws until configured)
- `index.ts` — picks driver based on `STORAGE_PROVIDER` env var (defaults to `"local"`)

**Upload helper** (`src/utils/uploadHelper.ts`):
- `uploadMiddleware` — shared multer instance using `memoryStorage` (file stays in buffer, not on disk)
- `uploadFile(file, { entity, id?, category? })` — saves buffer via storage driver, returns relative URL
- `deleteUpload(urlOrPath)` — removes file from storage (handles both legacy and new URL formats)
- `resolveUploadAbsPath(url)` — converts stored URL → absolute filesystem path (used in PDF generation)

**Structured folder layout** under `artifacts/api-server/uploads/`:
- `procurement/<prId>/invoices/` — vendor invoice PDFs/images
- `expenses/<expenseId>/` — other expense attachments
- `packing-lists/<plId>/images/` — packing list item images
- `orders/<orderId>/{artwork,wip,final,pattern,toile,invoices}/` — order files (future)
- `materials/`, `fabrics/` — master item images (future)

**Legacy folders** (old data still served):
- `vendor_invoices/` — served via `/api/packing-lists/item-images/:filename` (backward compat)
- `other_expenses/`, `packing-list-items/` — still accessible via static `/uploads` middleware

**Routes using uploads**: `procurement.ts` (vendor invoices), `otherExpenses.ts` (attachments), `packingLists.ts` (item images + PDF generation)

**To switch to S3**: set `STORAGE_PROVIDER=s3` and implement `src/storage/s3Storage.ts` — no route changes needed.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
