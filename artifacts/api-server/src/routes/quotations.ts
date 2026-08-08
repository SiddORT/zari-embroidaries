import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import type { AuthRequest } from "../middlewares/requireAuth";
import { generateOrderCode } from "../services/orderCodeService";
import { checkPermission } from "../middlewares/checkPermission";
import { QUOTATION } from "../constants/permissions";

const router = Router();
const COMPANY_STATE = process.env["COMPANY_STATE"] ?? "Maharashtra";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  "Draft":               ["Sent"],
  "Sent":                ["Client Reviewing", "Approved", "Rejected"],
  "Client Reviewing":    ["Correction Requested", "Approved", "Rejected"],
  "Correction Requested":["Revised"],
  "Revised":             ["Sent"],
  "Approved":            ["Converted to Style", "Converted to Swatch"],
  "Rejected":            [],
  "Converted to Style":  [],
  "Converted to Swatch": [],
};


function calcGst(clientState: string | null, subtotal: number, shipping: number): { type: string; rate: number; amount: number } {
  const state = (clientState ?? "").toLowerCase().trim();
  const company = COMPANY_STATE.toLowerCase().trim();
  const isIntraState = state === company;
  const rate = 18;
  const gstBase = subtotal;
  const amount = parseFloat((gstBase * rate / 100).toFixed(2));
  return { type: isIntraState ? "CGST+SGST" : "IGST", rate, amount };
}

// ─── LIST ────────────────────────────────────────────────────────────────────
router.get("/quotations", requireAuth, 
  checkPermission({ any: [QUOTATION.VIEW] }), 
  async (req, res) => {
  try {
    const {
      search = "", status = "all", clientId = "",
      fromDate = "", toDate = "",
      page = "1", limit = "20",
    } = req.query as Record<string, string>;

    const conditions: string[] = ["q.parent_quotation_id IS NULL", "q.is_deleted = false"];
    const params: (string | number)[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(q.quotation_number ILIKE $${params.length} OR q.client_name ILIKE $${params.length} OR q.requirement_summary ILIKE $${params.length})`);
    }
    if (status !== "all") {
      params.push(status);
      conditions.push(`EXISTS (SELECT 1 FROM quotations r WHERE (r.parent_quotation_id = q.id OR r.id = q.id) AND r.status = $${params.length} AND r.is_deleted = false)`);
    }
    if (clientId) { params.push(clientId); conditions.push(`q.client_id = $${params.length}`); }
    if (fromDate) { params.push(fromDate); conditions.push(`q.created_at::date >= $${params.length}::date`); }
    if (toDate)   { params.push(toDate);   conditions.push(`q.created_at::date <= $${params.length}::date`); }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pg - 1) * lim;

    const [rows, total] = await Promise.all([
      pool.query(
        `SELECT q.*,
                COUNT(DISTINCT qd.id)::int AS design_count,
                COUNT(DISTINCT qc.id)::int AS charge_count,
                (SELECT COUNT(*) FROM quotations r WHERE (r.parent_quotation_id = q.id OR r.id = q.id) AND r.is_deleted = false)::int AS revision_count,
                (SELECT r2.status FROM quotations r2
                 WHERE (r2.parent_quotation_id = q.id OR r2.id = q.id) AND r2.is_deleted = false
                 ORDER BY r2.revision_number DESC LIMIT 1) AS latest_status,
                (SELECT EXISTS (SELECT 1 FROM quotations r3
                 WHERE (r3.parent_quotation_id = q.id OR r3.id = q.id) AND r3.status = 'Approved' AND r3.is_deleted = false)) AS has_approval
         FROM quotations q
         LEFT JOIN quotation_designs qd ON qd.quotation_id = q.id AND qd.is_deleted = false
         LEFT JOIN quotation_custom_charges qc ON qc.quotation_id = q.id AND qc.is_deleted = false
         ${where}
         GROUP BY q.id
         ORDER BY q.created_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, lim, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM quotations q ${where}`,
        params
      ),
    ]);

    return res.json({ data: rows.rows, total: parseInt(total.rows[0].count), page: pg, limit: lim });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Failed to load quotations" });
  }
});

// ─── GET ONE ─────────────────────────────────────────────────────────────────
router.get("/quotations/:id", requireAuth, 
  checkPermission({ any: [QUOTATION.VIEW] }), 
  async (req, res) => {
  try {
    const { id } = req.params;
    const [q, designs, charges, feedback, revisions] = await Promise.all([
      pool.query(`SELECT * FROM quotations WHERE id = $1 AND is_deleted = false`, [id]),
      pool.query(`SELECT * FROM quotation_designs WHERE quotation_id = $1 AND is_deleted = false ORDER BY id`, [id]),
      pool.query(`SELECT * FROM quotation_custom_charges WHERE quotation_id = $1 AND is_deleted = false ORDER BY id`, [id]),
      pool.query(`SELECT * FROM quotation_feedback_logs WHERE quotation_id = $1 AND is_deleted = false ORDER BY created_at DESC`, [id]),
      pool.query(
        `SELECT id, quotation_number, revision_number, status, created_at, created_by, updated_at
         FROM quotations
         WHERE (parent_quotation_id = $1 OR (id = $1 AND parent_quotation_id IS NULL)) AND is_deleted = false
         ORDER BY revision_number ASC`,
        [id]
      ),
    ]);
    if (!q.rows.length) return res.status(404).json({ error: "Quotation not found" });
    return res.json({
      data: {
        ...q.rows[0],
        designs: designs.rows,
        charges: charges.rows,
        feedback: feedback.rows,
        revisions: revisions.rows,
      }
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── CREATE ──────────────────────────────────────────────────────────────────
router.post("/quotations", requireAuth, 
  checkPermission({ any: [QUOTATION.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  const actor = (req as any).user?.name || (req as any).user?.email || "System";
  const client = await (pool as any).connect();
  try {
    const {
      clientId, clientName, clientState, requirementSummary,
      estimatedWeight, estimatedShippingCharges, internalNotes, clientNotes,
      designs = [], charges = [],
      gstType: gstTypeOverride, gstRate: gstRateOverride,
      coverPage = "classic", coverPageImage = "",
      shippingRatePerKg = 0,
    } = req.body;

    await client.query("BEGIN");

    const qNum = await generateOrderCode(clientId, "quotations", "quotation_number", client);

    // Sanitize once — every downstream calculation uses the clamped values.
    const safeWeight = Math.max(0, parseFloat(estimatedWeight) || 0);
    const safeRate = Math.max(0, parseFloat(shippingRatePerKg) || 0);
    const safeShipping = Math.max(0, parseFloat(estimatedShippingCharges) || 0);
    const safeCharges = (charges as any[]).map((c) => ({
      ...c,
      qty: Math.max(0, parseFloat(c.quantity) || 1),
      price: Math.max(0, parseFloat(c.price) || 0),
    }));
    const chargesTotal = safeCharges.reduce((s, c) => s + c.qty * c.price, 0);
    const subtotal = chargesTotal;
    const autoGst = calcGst(clientState, subtotal, safeShipping);
    const gstRate = gstRateOverride != null ? Math.max(0, parseFloat(gstRateOverride) || 0) : autoGst.rate;
    const gst = {
      type: gstTypeOverride || autoGst.type,
      rate: gstRate,
      amount: parseFloat((subtotal * gstRate / 100).toFixed(2)),
    };
    const total = subtotal + gst.amount + safeShipping;

    const qRes = await client.query(
      `INSERT INTO quotations
         (quotation_number, client_id, client_name, client_state,
          requirement_summary, estimated_weight, estimated_shipping_charges, shipping_rate_per_kg,
          subtotal_amount, gst_type, gst_rate, gst_amount, total_amount,
          internal_notes, client_notes, cover_page, cover_page_image, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING id`,
      [qNum, clientId || null, clientName || null, clientState || null,
       requirementSummary || null, safeWeight, safeShipping, safeRate,
       subtotal, gst.type, gst.rate,
       gst.amount, total, internalNotes || null, clientNotes || null, coverPage, coverPageImage || null, actor]
    );
    const qId = qRes.rows[0].id;

    for (const d of designs) {
      await client.query(
        `INSERT INTO quotation_designs (quotation_id, design_name, hsn_code, design_image, remarks) VALUES ($1,$2,$3,$4,$5)`,
        [qId, d.designName, d.hsnCode || null, d.designImage || null, d.remarks || null]
      );
    }
    for (const c of safeCharges) {
      await client.query(
        `INSERT INTO quotation_custom_charges (quotation_id, charge_name, hsn_code, unit, quantity, price, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [qId, c.chargeName, c.hsnCode || null, c.unit || null, c.qty, c.price, c.qty * c.price]
      );
    }

    await client.query("COMMIT");
    return res.json({ data: { id: qId, quotationNumber: qNum }, message: "Quotation saved successfully" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── UPDATE ──────────────────────────────────────────────────────────────────
router.put("/quotations/:id", requireAuth, 
  checkPermission({ any: [QUOTATION.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  const client = await (pool as any).connect();
  try {
    const { id } = req.params;
    const deletedByUser = (req as any).user?.name || (req as any).user?.email || "System";
    const {
      clientId, clientName, clientState, requirementSummary,
      estimatedWeight, estimatedShippingCharges, internalNotes, clientNotes,
      designs = [], charges = [],
      gstType: gstTypeOverride, gstRate: gstRateOverride,
      coverPage = "classic", coverPageImage = "",
      shippingRatePerKg = 0,
    } = req.body;

    const existing = await client.query(`SELECT status FROM quotations WHERE id = $1 AND is_deleted = false`, [id]);
    if (!existing.rows.length) return res.status(404).json({ error: "Quotation not found" });

    await client.query("BEGIN");

    // Sanitize once — every downstream calculation uses the clamped values.
    const safeWeight = Math.max(0, parseFloat(estimatedWeight) || 0);
    const safeRate = Math.max(0, parseFloat(shippingRatePerKg) || 0);
    const safeShipping = Math.max(0, parseFloat(estimatedShippingCharges) || 0);
    const safeCharges = (charges as any[]).map((c) => ({
      ...c,
      qty: Math.max(0, parseFloat(c.quantity) || 1),
      price: Math.max(0, parseFloat(c.price) || 0),
    }));
    const chargesTotal = safeCharges.reduce((s, c) => s + c.qty * c.price, 0);
    const subtotal = chargesTotal;
    const autoGst = calcGst(clientState, subtotal, safeShipping);
    const gstRate = gstRateOverride != null ? Math.max(0, parseFloat(gstRateOverride) || 0) : autoGst.rate;
    const gst = {
      type: gstTypeOverride || autoGst.type,
      rate: gstRate,
      amount: parseFloat((subtotal * gstRate / 100).toFixed(2)),
    };
    const total = subtotal + gst.amount + safeShipping;

    await client.query(
      `UPDATE quotations SET
         client_id=$1, client_name=$2, client_state=$3,
         requirement_summary=$4, estimated_weight=$5, estimated_shipping_charges=$6, shipping_rate_per_kg=$7,
         subtotal_amount=$8, gst_type=$9, gst_rate=$10, gst_amount=$11, total_amount=$12,
         internal_notes=$13, client_notes=$14, cover_page=$15, cover_page_image=$16,
         updated_at=NOW()
       WHERE id=$17`,
      [clientId || null, clientName || null, clientState || null,
       requirementSummary || null, safeWeight, safeShipping, safeRate,
       subtotal, gst.type, gst.rate, gst.amount, total,
       internalNotes || null, clientNotes || null, coverPage, coverPageImage || null, id]
    );

    await client.query(`UPDATE quotation_designs SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE quotation_id = $1 AND is_deleted = false`, [id, deletedByUser]);
    for (const d of designs) {
      await client.query(
        `INSERT INTO quotation_designs (quotation_id, design_name, hsn_code, design_image, remarks) VALUES ($1,$2,$3,$4,$5)`,
        [id, d.designName, d.hsnCode || null, d.designImage || null, d.remarks || null]
      );
    }

    await client.query(`UPDATE quotation_custom_charges SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE quotation_id = $1 AND is_deleted = false`, [id, deletedByUser]);
    for (const c of safeCharges) {
      await client.query(
        `INSERT INTO quotation_custom_charges (quotation_id, charge_name, hsn_code, unit, quantity, price, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id, c.chargeName, c.hsnCode || null, c.unit || null, c.qty, c.price, c.qty * c.price]
      );
    }

    await client.query("COMMIT");
    return res.json({ message: "Quotation saved successfully" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── DELETE ──────────────────────────────────────────────────────────────────
router.delete("/quotations/:id", requireAuth, 
  checkPermission({ any: [QUOTATION.DELETE] }), 
  async (req: AuthRequest, res) => {
  if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  const client = await (pool as any).connect();
  try {
    const { id } = req.params;
    const deletedByUser = (req as any).user?.name || (req as any).user?.email || "System";
    await client.query("BEGIN");
    const r = await client.query(
      `UPDATE quotations SET is_deleted = true, deleted_by = $2, deleted_at = now(), updated_at = NOW() WHERE id = $1 AND is_deleted = false RETURNING id`,
      [id, deletedByUser]
    );
    if (r.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Quotation not found" });
    }
    await client.query(`UPDATE quotation_designs SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE quotation_id = $1 AND is_deleted = false`, [id, deletedByUser]);
    await client.query(`UPDATE quotation_custom_charges SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE quotation_id = $1 AND is_deleted = false`, [id, deletedByUser]);
    await client.query(`UPDATE quotation_feedback_logs SET is_deleted = true, deleted_by = $2, deleted_at = now() WHERE quotation_id = $1 AND is_deleted = false`, [id, deletedByUser]);
    await client.query("COMMIT");
    return res.json({ success: true });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── STATUS CHANGE ────────────────────────────────────────────────────────────
router.post("/quotations/:id/status", requireAuth, 
  checkPermission({ any: [QUOTATION.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { newStatus } = req.body as { newStatus: string };
    const q = await pool.query(`SELECT status, parent_quotation_id FROM quotations WHERE id = $1 AND is_deleted = false`, [id]);
    if (!q.rows.length) return res.status(404).json({ error: "Not found" });
    const current = q.rows[0].status;
    const allowed = STATUS_TRANSITIONS[current] ?? [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({ error: `Cannot transition from "${current}" to "${newStatus}"` });
    }
    // Only one revision per chain may be Approved
    if (newStatus === "Approved") {
      const rootId = q.rows[0].parent_quotation_id ?? id;
      const conflict = await pool.query(
        `SELECT id FROM quotations
         WHERE (id = $1 OR parent_quotation_id = $1)
           AND id != $2
           AND status = 'Approved'
           AND is_deleted = false`,
        [rootId, id]
      );
      if (conflict.rows.length > 0) {
        return res.status(400).json({
          error: "Another revision in this quotation chain is already Approved. Only one revision can be approved.",
        });
      }
    }
    await pool.query(
      `UPDATE quotations SET status=$1, updated_at=NOW() WHERE id=$2`,
      [newStatus, id]
    );
    return res.json({ message: `Status updated to ${newStatus}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── ADD FEEDBACK ─────────────────────────────────────────────────────────────
router.post("/quotations/:id/feedback", requireAuth, 
  checkPermission({ any: [QUOTATION.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const actor = (req as any).user?.name || (req as any).user?.email || "System";
    const { feedbackText, revisionReference } = req.body as { feedbackText: string; revisionReference?: string };
    if (!feedbackText?.trim()) return res.status(400).json({ error: "Feedback text is required" });
    await pool.query(
      `INSERT INTO quotation_feedback_logs (quotation_id, feedback_text, feedback_by, feedback_date, revision_reference)
       VALUES ($1,$2,$3,$4,$5)`,
      [id, feedbackText, actor, new Date().toISOString().split("T")[0], revisionReference || null]
    );
    return res.json({ message: "Feedback added" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── CREATE REVISION ─────────────────────────────────────────────────────────
router.post("/quotations/:id/revise", requireAuth, 
  checkPermission({ any: [QUOTATION.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  const actor = (req as any).user?.name || (req as any).user?.email || "System";
  const client = await (pool as any).connect();
  try {
    const { id } = req.params;
    const orig = await client.query(`SELECT * FROM quotations WHERE id = $1 AND is_deleted = false`, [id]);
    if (!orig.rows.length) return res.status(404).json({ error: "Not found" });
    const o = orig.rows[0];

    await client.query("BEGIN");

    const clientId = o.client_id;
    const qNum = await generateOrderCode(clientId, "quotations", "quotation_number", client);

    const newRev = o.revision_number + 1;
    const rootId = o.parent_quotation_id ?? o.id;

    const newRes = await client.query(
      `INSERT INTO quotations
         (quotation_number, client_id, client_name, client_state,
          requirement_summary, estimated_weight, estimated_shipping_charges,
          subtotal_amount, gst_type, gst_rate, gst_amount, total_amount,
          status, revision_number, parent_quotation_id,
          internal_notes, client_notes, cover_page, cover_page_image, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Draft',$13,$14,$15,$16,$17,$18,$19)
       RETURNING id`,
      [qNum, o.client_id, o.client_name, o.client_state,
       o.requirement_summary, o.estimated_weight, o.estimated_shipping_charges,
       o.subtotal_amount, o.gst_type, o.gst_rate, o.gst_amount, o.total_amount,
       newRev, rootId, o.internal_notes, o.client_notes, o.cover_page ?? "classic", o.cover_page_image ?? null, actor]
    );
    const newId = newRes.rows[0].id;

    const [designs, charges] = await Promise.all([
      client.query(`SELECT * FROM quotation_designs WHERE quotation_id = $1 AND is_deleted = false`, [id]),
      client.query(`SELECT * FROM quotation_custom_charges WHERE quotation_id = $1 AND is_deleted = false`, [id]),
    ]);
    for (const d of designs.rows) {
      await client.query(
        `INSERT INTO quotation_designs (quotation_id, design_name, hsn_code, design_image, remarks) VALUES ($1,$2,$3,$4,$5)`,
        [newId, d.design_name, d.hsn_code, d.design_image, d.remarks]
      );
    }
    for (const c of charges.rows) {
      await client.query(
        `INSERT INTO quotation_custom_charges (quotation_id, charge_name, hsn_code, unit, quantity, price, amount) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [newId, c.charge_name, c.hsn_code, c.unit, c.quantity, c.price, c.amount]
      );
    }

    await client.query(`UPDATE quotations SET status='Revised', updated_at=NOW() WHERE id=$1`, [id]);

    await client.query("COMMIT");
    return res.json({ data: { id: newId, quotationNumber: qNum, revisionNumber: newRev }, message: "Revision created" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── CONVERT TO SWATCH ───────────────────────────────────────────────────────
router.post("/quotations/:id/convert-swatch", requireAuth, 
  checkPermission({ any: [QUOTATION.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  const actor = (req as any).user?.name || (req as any).user?.email || "System";
  const client = await (pool as any).connect();
  try {
    const { id } = req.params;
    const q = await client.query(`SELECT * FROM quotations WHERE id = $1 AND is_deleted = false`, [id]);
    if (!q.rows.length) return res.status(404).json({ error: "Not found" });
    const qt = q.rows[0];
    if (qt.status !== "Approved") return res.status(400).json({ error: "Quotation must be Approved to convert" });
    if (qt.converted_to === "Swatch") return res.status(400).json({ error: "Already converted to Swatch" });

    await client.query("BEGIN");

    const designs = await client.query(`SELECT * FROM quotation_designs WHERE quotation_id = $1 AND is_deleted = false LIMIT 1`, [id]);
    const firstDesign = designs.rows[0];

    const swCode = await generateOrderCode(
      Number(qt.client_id),
      "swatch_orders",
      "order_code",
      client,
    );

    const swRes = await client.query(
      `INSERT INTO swatch_orders
         (order_code, swatch_name, client_id, client_name, quantity, priority, order_status, description, created_by)
       VALUES ($1,$2,$3,$4,1,'Medium','Draft',$5,$6)
       RETURNING id`,
      [swCode,
       firstDesign?.design_name || `Swatch from ${qt.quotation_number}`,
       qt.client_id, qt.client_name,
       qt.requirement_summary || null,
       actor]
    );
    const swId = swRes.rows[0].id;

    await client.query(
      `UPDATE quotations SET converted_to='Swatch', converted_reference_id=$1, converted_at=NOW(), status='Converted to Swatch', updated_at=NOW() WHERE id=$2`,
      [String(swId), id]
    );

    await client.query("COMMIT");
    return res.json({ data: { swatchOrderId: swId, orderCode: swCode }, message: "Quotation converted successfully" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── CONVERT TO STYLE ────────────────────────────────────────────────────────
router.post("/quotations/:id/convert-style", requireAuth, 
  checkPermission({ any: [QUOTATION.ADD_EDIT] }), 
  async (req: AuthRequest, res) => {
  const actor = (req as any).user?.name || (req as any).user?.email || "System";
  const client = await (pool as any).connect();
  try {
    const { id } = req.params;
    const q = await client.query(`SELECT * FROM quotations WHERE id = $1 AND is_deleted = false`, [id]);
    if (!q.rows.length) return res.status(404).json({ error: "Not found" });
    const qt = q.rows[0];
    if (qt.status !== "Approved") return res.status(400).json({ error: "Quotation must be Approved to convert" });
    if (qt.converted_to === "Style") return res.status(400).json({ error: "Already converted to Style" });

    await client.query("BEGIN");

    const designs = await client.query(`SELECT * FROM quotation_designs WHERE quotation_id = $1 AND is_deleted = false LIMIT 1`, [id]);
    const firstDesign = designs.rows[0];

    const seq = await client.query(`SELECT nextval('quotation_number_seq') AS n`);
    const stCode = `QST-${new Date().getFullYear()}-${String(seq.rows[0].n).padStart(5, "0")}`;

    const stRes = await client.query(
      `INSERT INTO style_orders
         (order_code, style_name, style_no, client_id, client_name, quantity, priority, order_status, description, created_by)
       VALUES ($1,$2,$3,$4,$5,1,'Medium','Draft',$6,$7)
       RETURNING id`,
      [stCode,
       firstDesign?.design_name || `Style from ${qt.quotation_number}`,
       stCode,
       qt.client_id, qt.client_name,
       qt.requirement_summary || null,
       actor]
    );
    const stId = stRes.rows[0].id;

    await client.query(
      `UPDATE quotations SET converted_to='Style', converted_reference_id=$1, converted_at=NOW(), status='Converted to Style', updated_at=NOW() WHERE id=$2`,
      [String(stId), id]
    );

    await client.query("COMMIT");
    return res.json({ data: { styleOrderId: stId, orderCode: stCode }, message: "Quotation converted successfully" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export default router;
