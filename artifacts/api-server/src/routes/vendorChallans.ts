import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthRequest } from "../middlewares/requireAuth";
import { uploadMiddleware, uploadFile, deleteUpload } from "../utils/uploadHelper";
import { nextSequenceNumber } from "../utils/sequence";
import { checkPermission } from "../middlewares/checkPermission";
import { PROCUREMENT_VENDOR_CHALLANS } from "../constants/permissions";

const router = Router();

function financialYear(): string {
  const now = new Date();
  const yr = now.getFullYear();
  const mo = now.getMonth() + 1;
  const startYr = mo >= 4 ? yr : yr - 1;
  return `${startYr}-${String(startYr + 1).slice(2)}`;
}

async function nextChallanNumber(): Promise<string> {
  const fy = financialYear();
  const seq = (await nextSequenceNumber("vendor_challans", "challan_number", `VC/${fy}/%`))
    .toString().padStart(4, "0");
  return `VC/${fy}/${seq}`;
}

function durationMonthsToStart(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

type CleanLineItem = { description: string; quantity: string; unit: string; rate: string; amount: string };

// Validate & normalise challan line items. A challan must carry at least one
// valid line item (non-blank description with letters/digits, positive qty & rate).
function validateChallanLineItems(
  raw: unknown
): { ok: true; items: CleanLineItem[]; totalQty: number; totalAmount: number } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "At least one line item with quantity and rate is required" };
  }
  const items: CleanLineItem[] = [];
  let totalQty = 0;
  let totalAmount = 0;
  for (const li of raw as Array<Record<string, unknown>>) {
    const description = String(li?.description ?? "").trim();
    const unit = String(li?.unit ?? "").trim();
    const quantity = parseFloat(String(li?.quantity ?? ""));
    const rate = parseFloat(String(li?.rate ?? ""));
    if (!description) return { ok: false, error: "Each line item must have a description" };
    if (!/[A-Za-z0-9]/.test(description)) {
      return { ok: false, error: `Line item description "${description}" must contain letters or numbers` };
    }
    if (isNaN(quantity) || quantity <= 0) {
      return { ok: false, error: `Quantity must be greater than zero for "${description}"` };
    }
    if (isNaN(rate) || rate <= 0) {
      return { ok: false, error: `Rate must be greater than zero for "${description}"` };
    }
    const amount = quantity * rate;
    totalQty += quantity;
    totalAmount += amount;
    items.push({
      description,
      unit,
      quantity: String(quantity),
      rate: rate.toFixed(2),
      amount: amount.toFixed(2),
    });
  }
  return { ok: true, items, totalQty, totalAmount };
}

// Expand a challan's line items into individual purchase_order_items rows so the
// converted PO carries the full item/quantity breakdown. Falls back to a single
// summary row for legacy challans without line items.
async function insertPoItemsForChallan(
  client: { query: (text: string, params: unknown[]) => Promise<unknown> },
  poId: number,
  ch: Record<string, any>
): Promise<void> {
  const lineItems: Array<Record<string, any>> = Array.isArray(ch.line_items) ? ch.line_items : [];
  if (lineItems.length > 0) {
    let idx = 0;
    for (const li of lineItems) {
      idx += 1;
      const qty = parseFloat(String(li?.quantity ?? "")) || 0;
      const rate = parseFloat(String(li?.rate ?? "")) || 0;
      const unit = String(li?.unit ?? "").trim();
      const remarks = `${unit ? `Unit: ${unit} | ` : ""}Challan: ${ch.challan_number} | Date: ${ch.challan_date}`;
      await client.query(
        `INSERT INTO purchase_order_items
           (po_id, item_name, item_code, ordered_quantity, received_quantity, unit_price, remarks)
         VALUES ($1,$2,$3,$4,0,$5,$6)`,
        [poId, String(li?.description ?? "").trim() || ch.challan_type, `${ch.challan_number}-${idx}`, qty, rate, remarks]
      );
    }
    return;
  }
  await client.query(
    `INSERT INTO purchase_order_items
       (po_id, item_name, item_code, ordered_quantity, received_quantity, unit_price, remarks)
     VALUES ($1,$2,$3,$4,0,$5,$6)`,
    [poId, ch.description ?? ch.challan_type, ch.challan_number, ch.quantity ?? 1, ch.rate ?? 0,
     `Challan: ${ch.challan_number} | Date: ${ch.challan_date}`]
  );
}

// ── LIST ──────────────────────────────────────────────────────────────────────
router.get("/vendor-challans", requireAuth, 
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.VIEW] }), 
  async (req: AuthRequest, res) => {
  try {
    const { search = "", vendor = "", challanType = "", status = "", dateFrom = "", dateTo = "", page = "1", limit = "20" } = req.query as Record<string, string>;
    const pg = Math.max(1, parseInt(page, 10));
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const offset = (pg - 1) * lim;

    const conditions: string[] = ["is_deleted = false"];
    const params: (string | number)[] = [];

    if (search) {
      params.push(`%${search}%`);
      const n = params.length;
      conditions.push(`(challan_number ILIKE $${n} OR vendor_name ILIKE $${n} OR description ILIKE $${n})`);
    }
    if (vendor) { params.push(parseInt(vendor, 10)); conditions.push(`vendor_id = $${params.length}`); }
    if (challanType) { params.push(challanType); conditions.push(`challan_type = $${params.length}`); }
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    if (dateFrom) { params.push(dateFrom); conditions.push(`challan_date >= $${params.length}`); }
    if (dateTo) { params.push(dateTo); conditions.push(`challan_date <= $${params.length}`); }

    const where = conditions.join(" AND ");
    const [rows, countRow] = await Promise.all([
      pool.query(`SELECT * FROM vendor_challans WHERE ${where} ORDER BY challan_date DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, lim, offset]),
      pool.query(`SELECT COUNT(*) FROM vendor_challans WHERE ${where}`, params),
    ]);
    res.json({ data: rows.rows, total: parseInt(countRow.rows[0].count), page: pg, limit: lim });
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Failed to fetch vendor challans" });
  }
});

// ── SINGLE ────────────────────────────────────────────────────────────────────
router.get("/vendor-challans/:id", requireAuth, 
checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.VIEW] }),
  async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const r = await pool.query(`SELECT * FROM vendor_challans WHERE id = $1 AND is_deleted = false`, [id]);
  if (!r.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: r.rows[0] });
});

// ── CREATE ────────────────────────────────────────────────────────────────────
// Accepts multipart/form-data so any staged attachments are saved as part of
// creation (files under "files"). Stays backwards-compatible with JSON bodies:
// when the request isn't multipart, multer is a no-op and express.json populates
// req.body — in that case `lineItems` arrives as an array instead of a string.
router.post("/vendor-challans", requireAuth,
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.ADD_EDIT] }),  
  uploadMiddleware.array("files", 10), async (req: AuthRequest, res) => {
  const client = await pool.connect();
  // Track files written to disk so they can be cleaned up if the transaction
  // rolls back (filesystem writes aren't covered by the DB transaction).
  const writtenUrls: string[] = [];
  try {
    const userName = req.user?.email ?? "system";
    const { challanDate, vendorId, vendorName, challanType, referenceOrderId, description, unit, remarks } = req.body;
    let lineItems: unknown = (req.body as { lineItems?: unknown }).lineItems;
    if (typeof lineItems === "string") {
      try { lineItems = JSON.parse(lineItems); } catch { lineItems = []; }
    }
    if (!vendorId) { res.status(400).json({ error: "Vendor is required" }); return; }
    if (!challanDate) { res.status(400).json({ error: "Challan date is required" }); return; }
    if (!challanType) { res.status(400).json({ error: "Challan type is required" }); return; }

    const validated = validateChallanLineItems(lineItems);
    if (!validated.ok) { res.status(400).json({ error: validated.error }); return; }
    const quantity = String(validated.totalQty);
    const rate = null;
    const amount = validated.totalAmount.toFixed(2);

    const challanNumber = await nextChallanNumber();
    // All challans start as Draft so they remain editable; verification is an
    // explicit follow-up action (PATCH /:id/verify) gated by permission.
    const initialStatus = "Draft";
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    await client.query("BEGIN");
    const ins = await client.query(
      `INSERT INTO vendor_challans
         (challan_number, challan_date, vendor_id, vendor_name, challan_type,
          reference_order_id, description, quantity, unit, rate, amount,
          attachments, line_items, status, remarks, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
       RETURNING *`,
      [challanNumber, challanDate, parseInt(String(vendorId), 10), vendorName ?? null, challanType,
       referenceOrderId ?? null, description ?? null, quantity, unit ?? null,
       rate, amount, null,
       JSON.stringify(validated.items),
       initialStatus, remarks ?? null, userName]
    );
    let row = ins.rows[0];

    // Upload attachments within the same transaction, after the row exists (we
    // need its id for the folder path) but tied to creation — so the admin
    // auto-verify status never blocks the creator's own uploads.
    if (files.length) {
      const id = row.id as number;
      const uploaded: ChallanFile[] = [];
      for (const f of files) {
        const url = await uploadFile(f, { entity: "vendor-challans", id: String(id), category: "document" });
        writtenUrls.push(url);
        uploaded.push({ url, originalName: f.originalname, mimeType: f.mimetype, size: f.size });
      }
      const upd = await client.query(
        `UPDATE vendor_challans SET attachments=$1, attachment=NULL, updated_at=NOW() WHERE id=$2 RETURNING *`,
        [JSON.stringify(uploaded), id]
      );
      row = upd.rows[0];
    }

    await client.query("COMMIT");
    res.status(201).json({ data: row });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    // The DB rolled back, so drop any files already written to avoid orphans.
    await Promise.all(writtenUrls.map((u) => deleteUpload(u).catch(() => undefined)));
    req.log?.error(err);
    res.status(500).json({ error: "Failed to create vendor challan" });
  } finally {
    client.release();
  }
});

// ── UPDATE ────────────────────────────────────────────────────────────────────
router.put("/vendor-challans/:id", requireAuth, 
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.ADD_EDIT] }),  
  async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const existing = await pool.query(`SELECT status FROM vendor_challans WHERE id = $1 AND is_deleted = false`, [id]);
    if (!existing.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
    if (!["Draft"].includes(existing.rows[0].status)) {
      res.status(400).json({ error: "Only Draft challans can be edited" }); return;
    }
    const { challanDate, vendorId, vendorName, challanType, referenceOrderId, description, unit, remarks, lineItems } = req.body;
    if (!vendorId) { res.status(400).json({ error: "Vendor is required" }); return; }
    if (!challanDate) { res.status(400).json({ error: "Challan date is required" }); return; }
    if (!challanType) { res.status(400).json({ error: "Challan type is required" }); return; }

    const validated = validateChallanLineItems(lineItems);
    if (!validated.ok) { res.status(400).json({ error: validated.error }); return; }
    const quantity = String(validated.totalQty);
    const amount = validated.totalAmount.toFixed(2);

    // Note: `attachment`/`attachments` are managed exclusively by the document
    // upload/delete endpoints — never touched here, so edits can't clobber files.
    const r = await pool.query(
      `UPDATE vendor_challans SET
         challan_date=$1, vendor_id=$2, vendor_name=$3, challan_type=$4,
         reference_order_id=$5, description=$6, quantity=$7, unit=$8,
         rate=$9, amount=$10, line_items=$11, remarks=$12, updated_at=NOW()
       WHERE id=$13 RETURNING *`,
      [challanDate, vendorId, vendorName ?? null, challanType, referenceOrderId ?? null,
       description ?? null, quantity, unit ?? null, null, amount,
       JSON.stringify(validated.items),
       remarks ?? null, id]
    );
    res.json({ data: r.rows[0] });
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Failed to update vendor challan" });
  }
});

// ── DELETE (soft) ─────────────────────────────────────────────────────────────
router.delete("/vendor-challans/:id", requireAuth, 
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.DELETE] }),  
  async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const existing = await pool.query(`SELECT status FROM vendor_challans WHERE id=$1 AND is_deleted=false`, [id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  if (!["Draft", "Cancelled"].includes(existing.rows[0].status)) {
    res.status(400).json({ error: "Only Draft or Cancelled challans can be deleted" }); return;
  }
  const deletedByUser = (req.user as any)?.email ?? "system";
  await pool.query(`UPDATE vendor_challans SET is_deleted=true, updated_at=NOW(), deleted_by=$2, deleted_at=NOW() WHERE id=$1`, [id, deletedByUser]);
  res.json({ success: true });
});

// ── VERIFY ────────────────────────────────────────────────────────────────────
router.patch("/vendor-challans/:id/verify", requireAuth, 
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.ADD_EDIT] }),  
  async (req: AuthRequest, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  // Check permission: only roles with procurement:vendor_challans:verify may approve
  const userRole = req.user?.role ?? "";
  const permCheck = await pool.query(
    `SELECT rp.permission FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id AND r.is_deleted = false
     WHERE r.name = $1 AND rp.permission = 'procurement:vendor_challans:verify' AND rp.is_deleted = false`,
    [userRole]
  );
  if (!permCheck.rows.length) {
    res.status(403).json({ error: "You do not have permission to verify challans" }); return;
  }

  const existing = await pool.query(`SELECT status FROM vendor_challans WHERE id=$1 AND is_deleted=false`, [id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  if (existing.rows[0].status !== "Draft") {
    res.status(400).json({ error: "Only Draft challans can be verified" }); return;
  }
  const r = await pool.query(`UPDATE vendor_challans SET status='Verified', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
  res.json({ data: r.rows[0] });
});

// ── CANCEL ────────────────────────────────────────────────────────────────────
router.patch("/vendor-challans/:id/cancel", requireAuth, 
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.ADD_EDIT] }),  
  async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const existing = await pool.query(`SELECT status FROM vendor_challans WHERE id=$1 AND is_deleted=false`, [id]);
  if (!existing.rows[0]) { res.status(404).json({ error: "Not found" }); return; }
  if (["Converted to PO", "Converted to PR", "Billed", "Paid", "Cancelled"].includes(existing.rows[0].status)) {
    res.status(400).json({ error: "Cannot cancel a challan in this status" }); return;
  }
  const r = await pool.query(`UPDATE vendor_challans SET status='Cancelled', updated_at=NOW() WHERE id=$1 RETURNING *`, [id]);
  res.json({ data: r.rows[0] });
});

// ── PREVIEW PO (fetch matching verified challans) ─────────────────────────────
router.post("/vendor-challans/preview-po", requireAuth, 
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.VIEW] }),  
  async (req, res) => {
  try {
    const { vendorId, challanType, durationMonths } = req.body as { vendorId: number; challanType: string; durationMonths: number };
    if (!vendorId || !challanType) { res.status(400).json({ error: "Vendor and Challan Type are required" }); return; }
    const dateFrom = durationMonthsToStart(durationMonths ?? 1);
    const r = await pool.query(
      `SELECT * FROM vendor_challans
       WHERE vendor_id=$1 AND challan_type=$2 AND status='Verified'
         AND is_deleted=false AND challan_date >= $3
       ORDER BY challan_date ASC`,
      [vendorId, challanType, dateFrom]
    );
    res.json({ data: r.rows, dateFrom });
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Failed to preview challans" });
  }
});

// ── CONVERT TO PO ─────────────────────────────────────────────────────────────
router.post("/vendor-challans/convert-to-po", requireAuth, 
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.ADD_EDIT] }),  
  async (req: AuthRequest, res) => {
  const { vendorId, vendorName, challanType, durationMonths } = req.body as {
    vendorId: number; vendorName: string; challanType: string; durationMonths: number;
  };
  if (!vendorId) { res.status(400).json({ error: "Vendor is required" }); return; }
  if (!challanType) { res.status(400).json({ error: "Challan Type is required" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const dateFrom = durationMonthsToStart(durationMonths ?? 1);
    const challans = await client.query(
      `SELECT * FROM vendor_challans
       WHERE vendor_id=$1 AND challan_type=$2 AND status='Verified'
         AND is_deleted=false AND challan_date >= $3
       ORDER BY challan_date ASC`,
      [vendorId, challanType, dateFrom]
    );
    if (!challans.rows.length) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "No eligible Verified challans found for this selection" }); return;
    }

    const fy = financialYear();
    const seq = (await nextSequenceNumber("purchase_orders", "po_number", `PO/${fy}/%`, client))
      .toString().padStart(4, "0");
    const poNumber = `PO/${fy}/${seq}`;
    const userName = req.user?.email ?? "system";
    const notes = `Consolidated from ${challans.rows.length} vendor challan(s) — Type: ${challanType}`;

    const poRes = await client.query(
      `INSERT INTO purchase_orders
         (po_number, vendor_id, vendor_name, po_date, status, notes,
          reference_type, reference_id, swatch_order_id, style_order_id,
          bom_row_ids, bom_items, created_by, created_at)
       VALUES ($1,$2,$3,NOW(),'Draft',$4,'Challan',NULL,NULL,NULL,'[]','[]',$5,NOW())
       RETURNING *`,
      [poNumber, vendorId, vendorName, notes, userName]
    );
    const po = poRes.rows[0];

    for (const ch of challans.rows) {
      await insertPoItemsForChallan(client, po.id, ch);
      await client.query(
        `UPDATE vendor_challans SET status='Converted to PO', linked_po_id=$1, linked_po_number=$2, updated_at=NOW() WHERE id=$3`,
        [po.id, poNumber, ch.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({
      data: po,
      message: `Vendor challans converted to PO successfully`,
      poNumber,
      count: challans.rows.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    req.log?.error(err);
    res.status(500).json({ error: "Failed to convert challans to PO" });
  } finally {
    client.release();
  }
});

// ── CONVERT SELECTED IDs TO PO ────────────────────────────────────────────────
router.post("/vendor-challans/convert-selected-to-po", requireAuth, 
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.ADD_EDIT] }),  
  async (req: AuthRequest, res) => {
  const { challanIds } = req.body as { challanIds: number[] };
  if (!Array.isArray(challanIds) || !challanIds.length) {
    res.status(400).json({ error: "No challans selected" }); return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const placeholders = challanIds.map((_, i) => `$${i + 1}`).join(",");
    const challans = await client.query(
      `SELECT * FROM vendor_challans WHERE id IN (${placeholders}) AND is_deleted=false ORDER BY challan_date ASC`,
      challanIds
    );

    if (!challans.rows.length) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "No matching challans found" }); return;
    }

    const nonVerified = challans.rows.filter((c: any) => c.status !== "Verified");
    if (nonVerified.length) {
      await client.query("ROLLBACK");
      const details = nonVerified.map((c: any) => `${c.challan_number} (${c.status})`).join(", ");
      res.status(400).json({
        error: `Only Verified challans can be converted to a PO. These cannot be converted: ${details}. Please deselect them and try again.`,
      });
      return;
    }

    const vendorIds: Set<number> = new Set(challans.rows.map((c: any) => c.vendor_id));
    if (vendorIds.size > 1) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "All selected challans must belong to the same vendor" }); return;
    }

    const vendorId: number = challans.rows[0].vendor_id;
    const vendorName: string = challans.rows[0].vendor_name ?? "";
    const challanType: string = challans.rows[0].challan_type;

    const fy = financialYear();
    const seq = (await nextSequenceNumber("purchase_orders", "po_number", `PO/${fy}/%`, client))
      .toString().padStart(4, "0");
    const poNumber = `PO/${fy}/${seq}`;
    const userName = req.user?.email ?? "system";
    const notes = `Consolidated from ${challans.rows.length} vendor challan(s) — Type: ${challanType}`;

    const poRes = await client.query(
      `INSERT INTO purchase_orders
         (po_number, vendor_id, vendor_name, po_date, status, notes,
          reference_type, reference_id, swatch_order_id, style_order_id,
          bom_row_ids, bom_items, created_by, created_at)
       VALUES ($1,$2,$3,NOW(),'Draft',$4,'Challan',NULL,NULL,NULL,'[]','[]',$5,NOW())
       RETURNING *`,
      [poNumber, vendorId, vendorName, notes, userName]
    );
    const po = poRes.rows[0];

    for (const ch of challans.rows) {
      await insertPoItemsForChallan(client, po.id, ch);
      await client.query(
        `UPDATE vendor_challans SET status='Converted to PO', linked_po_id=$1, linked_po_number=$2, updated_at=NOW() WHERE id=$3`,
        [po.id, poNumber, ch.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({
      data: po,
      message: `${challans.rows.length} challan(s) converted to PO successfully`,
      poNumber,
      count: challans.rows.length,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    req.log?.error(err);
    res.status(500).json({ error: "Failed to convert challans to PO" });
  } finally {
    client.release();
  }
});

// Merge the legacy single `attachment` column into the `attachments` array so
// reads/writes only ever deal with the array going forward.
type ChallanFile = { url: string; originalName: string; mimeType?: string; size?: number };
function normalizeAttachments(row: { attachment?: unknown; attachments?: unknown }): ChallanFile[] {
  const list = Array.isArray(row.attachments) ? (row.attachments as ChallanFile[]) : [];
  const legacy = row.attachment as ChallanFile | null;
  if (legacy?.url && !list.some(a => a.url === legacy.url)) return [legacy, ...list];
  return list;
}

// ── DOCUMENT UPLOAD (one or more files) ───────────────────────────────────────
router.post("/vendor-challans/:id/document", requireAuth, 
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.ADD_EDIT] }),  
  uploadMiddleware.array("files", 10), async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) { res.status(400).json({ error: "No file uploaded" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock the row so concurrent uploads/removals can't clobber the array.
    const existing = await client.query(
      `SELECT status, attachment, attachments FROM vendor_challans WHERE id=$1 AND is_deleted=false FOR UPDATE`, [id]
    );
    if (!existing.rows[0]) { await client.query("ROLLBACK"); res.status(404).json({ error: "Not found" }); return; }
    if (existing.rows[0].status !== "Draft") {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Only Draft challans can be edited" }); return;
    }

    const current = normalizeAttachments(existing.rows[0]);
    const uploaded: ChallanFile[] = [];
    for (const f of files) {
      const url = await uploadFile(f, { entity: "vendor-challans", id: String(id), category: "document" });
      uploaded.push({ url, originalName: f.originalname, mimeType: f.mimetype, size: f.size });
    }
    const next = [...current, ...uploaded];

    // Migrate fully into `attachments`; clear the legacy single column.
    const r = await client.query(
      `UPDATE vendor_challans SET attachments=$1, attachment=NULL, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [JSON.stringify(next), id]
    );
    await client.query("COMMIT");
    res.json({ data: r.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    req.log?.error(err);
    res.status(500).json({ error: "Failed to upload document" });
  } finally {
    client.release();
  }
});

// ── DOCUMENT DELETE (one file by ?url=, or all) ───────────────────────────────
router.delete("/vendor-challans/:id/document", requireAuth, 
  checkPermission({ any: [PROCUREMENT_VENDOR_CHALLANS.ADD_EDIT] }),  
  async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Lock the row so concurrent uploads/removals can't clobber the array.
    const existing = await client.query(
      `SELECT status, attachment, attachments FROM vendor_challans WHERE id=$1 AND is_deleted=false FOR UPDATE`, [id]
    );
    if (!existing.rows[0]) { await client.query("ROLLBACK"); res.status(404).json({ error: "Not found" }); return; }
    if (existing.rows[0].status !== "Draft") {
      await client.query("ROLLBACK");
      res.status(400).json({ error: "Only Draft challans can be edited" }); return;
    }

    const current = normalizeAttachments(existing.rows[0]);
    const targetUrl = typeof req.query.url === "string" ? req.query.url : "";

    if (targetUrl) {
      const toRemove = current.filter(a => a.url === targetUrl);
      if (!toRemove.length) { await client.query("ROLLBACK"); res.status(404).json({ error: "Attachment not found" }); return; }
      const next = current.filter(a => a.url !== targetUrl);
      const r = await client.query(
        `UPDATE vendor_challans SET attachments=$1, attachment=NULL, updated_at=NOW() WHERE id=$2 RETURNING *`,
        [JSON.stringify(next), id]
      );
      await client.query("COMMIT");
      for (const a of toRemove) { try { await deleteUpload(a.url); } catch { /* ignore */ } }
      res.json({ data: r.rows[0], success: true });
      return;
    }

    // No url → remove all.
    const r = await client.query(
      `UPDATE vendor_challans SET attachments='[]'::jsonb, attachment=NULL, updated_at=NOW() WHERE id=$1 RETURNING *`, [id]
    );
    await client.query("COMMIT");
    for (const a of current) { try { await deleteUpload(a.url); } catch { /* ignore */ } }
    res.json({ data: r.rows[0], success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    req.log?.error(err);
    res.status(500).json({ error: "Failed to remove document" });
  } finally {
    client.release();
  }
});

export default router;
