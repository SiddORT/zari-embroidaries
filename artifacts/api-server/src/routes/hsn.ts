import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, hsnTable } from "@workspace/db";
import { insertHsnSchema, updateHsnSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();

type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

router.get("/hsn", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const baseWhere = search
    ? or(ilike(hsnTable.hsnCode, `%${search}%`), ilike(hsnTable.govtDescription, `%${search}%`))
    : undefined;

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(hsnTable)
      .where(baseWhere)
      .orderBy(hsnTable.createdAt)
      .limit(limit)
      .offset(offset),
    db.select({ id: hsnTable.id }).from(hsnTable).where(baseWhere),
  ]);

  res.json({ data: rows, total: countRows.length, page, limit });
});

router.post("/hsn", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertHsnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const createdBy = req.user?.email ?? "system";

  const [existing] = await db
    .select({ id: hsnTable.id })
    .from(hsnTable)
    .where(eq(hsnTable.hsnCode, parsed.data.hsnCode));

  if (existing) {
    res.status(409).json({ error: "HSN Code already exists" });
    return;
  }

  const [record] = await db
    .insert(hsnTable)
    .values({ ...parsed.data, createdBy })
    .returning();

  logger.info({ id: record.id, hsnCode: record.hsnCode }, "HSN record created");
  res.status(201).json(record);
});

router.put("/hsn/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const parsed = updateHsnSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const updatedBy = req.user?.email ?? "system";

  if (parsed.data.hsnCode) {
    const [conflict] = await db
      .select({ id: hsnTable.id })
      .from(hsnTable)
      .where(eq(hsnTable.hsnCode, parsed.data.hsnCode));
    if (conflict && conflict.id !== id) {
      res.status(409).json({ error: "HSN Code already exists" });
      return;
    }
  }

  const [record] = await db
    .update(hsnTable)
    .set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(eq(hsnTable.id, id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "HSN record not found" });
    return;
  }

  logger.info({ id: record.id }, "HSN record updated");
  res.json(record);
});

router.patch("/hsn/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [existing] = await db.select().from(hsnTable).where(eq(hsnTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "HSN record not found" });
    return;
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(hsnTable)
    .set({ isActive: !existing.isActive, updatedBy, updatedAt: new Date() })
    .where(eq(hsnTable.id, id))
    .returning();

  logger.info({ id: record.id, isActive: record.isActive }, "HSN status toggled");
  res.json(record);
});

router.delete("/hsn/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(hsnTable)
    .set({ isActive: false, updatedBy, updatedAt: new Date() })
    .where(eq(hsnTable.id, id))
    .returning();

  if (!record) {
    res.status(404).json({ error: "HSN record not found" });
    return;
  }

  logger.info({ id: record.id }, "HSN record soft-deleted");
  res.json({ message: "HSN record deactivated", record });
});

export default router;
