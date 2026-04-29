import { Router, type IRouter } from "express";
import { eq, ilike, or, and, desc, count } from "drizzle-orm";
import { db, ordersTable } from "@workspace/db";
import { insertOrderSchema, updateOrderSchema } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";
import type { Request } from "express";

const router: IRouter = Router();
type AuthRequest = Request & { user?: { userId: number; email: string; role: string } };

router.get("/orders", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const search = (req.query.search as string) ?? "";
  const status = (req.query.status as string) ?? "all";
  const orderType = (req.query.orderType as string) ?? "all";
  const page = Math.max(1, parseInt((req.query.page as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "10", 10)));
  const offset = (page - 1) * limit;

  const conditions = [eq(ordersTable.isDeleted, false)];
  if (status !== "all") conditions.push(eq(ordersTable.status, status));
  if (orderType !== "all") conditions.push(eq(ordersTable.orderType, orderType));
  if (search) {
    conditions.push(
      or(
        ilike(ordersTable.orderId, `%${search}%`),
        ilike(ordersTable.client, `%${search}%`),
        ilike(ordersTable.assignedTo, `%${search}%`),
        ilike(ordersTable.product, `%${search}%`),
        ilike(ordersTable.fabric, `%${search}%`),
      )!,
    );
  }

  const whereClause = and(...conditions);
  const [rows, countRows] = await Promise.all([
    db.select().from(ordersTable).where(whereClause).orderBy(desc(ordersTable.createdAt)).limit(limit).offset(offset),
    db.select({ id: ordersTable.id }).from(ordersTable).where(whereClause),
  ]);

  res.json({ data: rows, total: countRows.length, page, limit });
});

router.get("/orders/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [record] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, id), eq(ordersTable.isDeleted, false)));
  if (!record) { res.status(404).json({ error: "Order not found" }); return; }
  res.json(record);
});

router.post("/orders", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = insertOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const createdBy = req.user?.email ?? "system";
  const [{ total }] = await db.select({ total: count() }).from(ordersTable);
  const orderId = `ORD${String(total + 1).padStart(4, "0")}`;

  const [record] = await db.insert(ordersTable).values({ ...parsed.data, orderId, createdBy }).returning();
  logger.info({ id: record.id, orderId }, "Order created");
  res.status(201).json(record);
});

router.put("/orders/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = updateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(ordersTable)
    .set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(ordersTable.id, id), eq(ordersTable.isDeleted, false)))
    .returning();

  if (!record) { res.status(404).json({ error: "Order not found" }); return; }
  logger.info({ id: record.id }, "Order updated");
  res.json(record);
});

router.patch("/orders/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const parsed = updateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(ordersTable)
    .set({ ...parsed.data, updatedBy, updatedAt: new Date() })
    .where(and(eq(ordersTable.id, id), eq(ordersTable.isDeleted, false)))
    .returning();

  if (!record) { res.status(404).json({ error: "Order not found" }); return; }
  logger.info({ id: record.id }, "Order status patched");
  res.json(record);
});

router.delete("/orders/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const updatedBy = req.user?.email ?? "system";
  const [record] = await db
    .update(ordersTable)
    .set({ isDeleted: true, updatedBy, updatedAt: new Date() })
    .where(and(eq(ordersTable.id, id), eq(ordersTable.isDeleted, false)))
    .returning();

  if (!record) { res.status(404).json({ error: "Order not found" }); return; }
  logger.info({ id: record.id }, "Order soft-deleted");
  res.json({ message: "Order deleted", record });
});

export default router;
