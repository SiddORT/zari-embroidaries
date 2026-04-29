import { Router } from "express";
import { db, styleOrdersTable } from "@workspace/db";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { insertStyleOrderSchema, updateStyleOrderSchema } from "@workspace/db";

const router = Router();

async function generateOrderCode(): Promise<string> {
  const prefix = "ZST-";
  const rows = await db
    .select({ orderCode: styleOrdersTable.orderCode })
    .from(styleOrdersTable)
    .where(ilike(styleOrdersTable.orderCode, `${prefix}%`))
    .orderBy(desc(styleOrdersTable.orderCode))
    .limit(1);
  if (rows.length === 0) return `${prefix}0001`;
  const last = rows[0].orderCode;
  const seq = parseInt(last.replace(prefix, ""), 10) + 1;
  return `${prefix}${seq.toString().padStart(4, "0")}`;
}

// List
router.get("/style-orders", requireAuth, async (req, res) => {
  const { search = "", status = "all", priority = "all", chargeable = "all", page = "1", limit = "24" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit));
  const offset = (pageNum - 1) * limitNum;

  const conditions = [eq(styleOrdersTable.isDeleted, false)];

  if (search.trim()) {
    conditions.push(
      or(
        ilike(styleOrdersTable.styleName, `%${search}%`),
        ilike(styleOrdersTable.styleNo, `%${search}%`),
        ilike(styleOrdersTable.clientName, `%${search}%`),
        ilike(styleOrdersTable.orderCode, `%${search}%`),
      )!,
    );
  }
  if (status !== "all") conditions.push(eq(styleOrdersTable.orderStatus, status));
  if (priority !== "all") conditions.push(eq(styleOrdersTable.priority, priority));
  if (chargeable === "yes") conditions.push(eq(styleOrdersTable.isChargeable, true));
  if (chargeable === "no") conditions.push(eq(styleOrdersTable.isChargeable, false));
  const { inhouse = "all" } = req.query as Record<string, string>;
  if (inhouse === "yes") conditions.push(eq(styleOrdersTable.isInhouse, true));
  if (inhouse === "no") conditions.push(eq(styleOrdersTable.isInhouse, false));

  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db.select().from(styleOrdersTable).where(where).orderBy(desc(styleOrdersTable.createdAt)).limit(limitNum).offset(offset),
    db.select({ id: styleOrdersTable.id }).from(styleOrdersTable).where(where),
  ]);

  res.json({ data: rows, total: countRows.length, page: pageNum, limit: limitNum });
});

// Get one
router.get("/style-orders/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [row] = await db.select().from(styleOrdersTable).where(eq(styleOrdersTable.id, id));
  if (!row || row.isDeleted) return res.status(404).json({ error: "Not found" });
  res.json({ data: row });
});

// Create
router.post("/style-orders", requireAuth, async (req, res) => {
  const parsed = insertStyleOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const orderCode = await generateOrderCode();
  const user = (req as any).user;

  const [row] = await db.insert(styleOrdersTable).values({
    ...parsed.data,
    orderCode,
    createdBy: user?.username ?? "system",
  }).returning();

  res.status(201).json({ data: row });
});

// Update
router.put("/style-orders/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const parsed = updateStyleOrderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  const user = (req as any).user;
  const [row] = await db.update(styleOrdersTable).set({
    ...parsed.data,
    updatedBy: user?.username ?? "system",
    updatedAt: new Date(),
  }).where(eq(styleOrdersTable.id, id)).returning();

  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ data: row });
});

// Delete (soft)
router.delete("/style-orders/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.update(styleOrdersTable).set({ isDeleted: true }).where(eq(styleOrdersTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
