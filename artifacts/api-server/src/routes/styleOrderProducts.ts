import { Router } from "express";
import { db, styleOrderProductsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth";
import { insertStyleOrderProductSchema, updateStyleOrderProductSchema } from "@workspace/db";

const router = Router();

// List products for a style order
router.get("/style-order-products", requireAuth, async (req, res) => {
  const { styleOrderId } = req.query as Record<string, string>;
  if (!styleOrderId) { res.status(400).json({ error: "styleOrderId required" }); return; }
  const rows = await db
    .select()
    .from(styleOrderProductsTable)
    .where(and(
      eq(styleOrderProductsTable.styleOrderId, parseInt(styleOrderId)),
      eq(styleOrderProductsTable.isDeleted, false),
    ));
  res.json({ data: rows });
});

// Get one
router.get("/style-order-products/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(styleOrderProductsTable).where(eq(styleOrderProductsTable.id, id));
  if (!row || row.isDeleted) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

// Create
router.post("/style-order-products", requireAuth, async (req, res) => {
  const parsed = insertStyleOrderProductSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const user = (req as any).user;
  const [row] = await db.insert(styleOrderProductsTable).values({
    ...parsed.data,
    createdBy: user?.username ?? "system",
  }).returning();
  res.status(201).json({ data: row });
});

// Update
router.put("/style-order-products/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = updateStyleOrderProductSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues }); return; }
  const user = (req as any).user;
  const [row] = await db.update(styleOrderProductsTable).set({
    ...parsed.data,
    updatedBy: user?.username ?? "system",
    updatedAt: new Date(),
  }).where(eq(styleOrderProductsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

// Soft delete
router.delete("/style-order-products/:id", requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.update(styleOrderProductsTable).set({ isDeleted: true }).where(eq(styleOrderProductsTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
