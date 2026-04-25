import { Router, type IRouter } from "express";
import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { db, swatchOrdersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function generateOrderCode(): Promise<string> {
  const prefix = "ZSW-";
  const [latest] = await db
    .select({ orderCode: swatchOrdersTable.orderCode })
    .from(swatchOrdersTable)
    .where(ilike(swatchOrdersTable.orderCode, `${prefix}%`))
    .orderBy(desc(swatchOrdersTable.orderCode))
    .limit(1);
  if (!latest) return `${prefix}0001`;
  const num = parseInt(latest.orderCode.replace(prefix, ""), 10);
  return `${prefix}${String(num + 1).padStart(4, "0")}`;
}

router.get("/swatch-orders", requireAuth, async (req, res): Promise<void> => {
  const { search = "", status = "all", priority = "all", chargeable = "all", page = "1", limit = "20" } = req.query as Record<string, string>;
  const pg = Math.max(1, parseInt(page));
  const lim = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pg - 1) * lim;

  const conditions = [eq(swatchOrdersTable.isDeleted, false)];
  if (search) conditions.push(ilike(swatchOrdersTable.swatchName, `%${search}%`));
  if (status !== "all") conditions.push(eq(swatchOrdersTable.orderStatus, status));
  if (priority !== "all") conditions.push(eq(swatchOrdersTable.priority, priority));
  if (chargeable === "yes") conditions.push(eq(swatchOrdersTable.isChargeable, true));
  if (chargeable === "no") conditions.push(eq(swatchOrdersTable.isChargeable, false));

  const where = and(...conditions);
  const [rows, countRow] = await Promise.all([
    db.select().from(swatchOrdersTable).where(where).orderBy(desc(swatchOrdersTable.createdAt)).limit(lim).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(swatchOrdersTable).where(where),
  ]);

  res.json({ data: rows, total: Number(countRow[0]?.count ?? 0), page: pg, limit: lim });
});

router.get("/swatch-orders/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(swatchOrdersTable).where(
    and(eq(swatchOrdersTable.id, id), eq(swatchOrdersTable.isDeleted, false))
  );
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

router.post("/swatch-orders", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user?: { email: string } }).user;
  const body = req.body as Record<string, unknown>;

  if (!body.swatchName || typeof body.swatchName !== "string" || !body.swatchName.trim()) {
    res.status(400).json({ error: "Swatch Name is required" });
    return;
  }

  const orderCode = await generateOrderCode();
  const [row] = await db.insert(swatchOrdersTable).values({
    orderCode,
    swatchName: body.swatchName as string,
    clientId: (body.clientId as string) || null,
    clientName: (body.clientName as string) || null,
    isChargeable: Boolean(body.isChargeable),
    quantity: (body.quantity as string) || null,
    priority: (body.priority as string) || "Medium",
    orderStatus: (body.orderStatus as string) || "Draft",
    styleReferences: (body.styleReferences as object[]) || [],
    swatchReferences: (body.swatchReferences as object[]) || [],
    fabricId: (body.fabricId as string) || null,
    fabricName: (body.fabricName as string) || null,
    hasLining: Boolean(body.hasLining),
    liningFabricId: (body.liningFabricId as string) || null,
    liningFabricName: (body.liningFabricName as string) || null,
    unitLength: (body.unitLength as string) || null,
    unitWidth: (body.unitWidth as string) || null,
    unitType: (body.unitType as string) || null,
    orderIssueDate: (body.orderIssueDate as string) || null,
    deliveryDate: (body.deliveryDate as string) || null,
    targetHours: (body.targetHours as string) || null,
    issuedTo: (body.issuedTo as string) || null,
    department: (body.department as string) || null,
    description: (body.description as string) || null,
    internalNotes: (body.internalNotes as string) || null,
    clientInstructions: (body.clientInstructions as string) || null,
    refDocs: (body.refDocs as object[]) || [],
    refImages: (body.refImages as object[]) || [],
    actualStartDate: (body.actualStartDate as string) || null,
    actualStartTime: (body.actualStartTime as string) || null,
    tentativeDeliveryDate: (body.tentativeDeliveryDate as string) || null,
    actualCompletionDate: (body.actualCompletionDate as string) || null,
    actualCompletionTime: (body.actualCompletionTime as string) || null,
    delayReason: (body.delayReason as string) || null,
    approvalDate: (body.approvalDate as string) || null,
    revisionCount: Number(body.revisionCount) || 0,
    createdBy: user?.email ?? "system",
  }).returning();

  logger.info({ id: row.id, orderCode }, "Swatch order created");
  res.status(201).json({ data: row });
});

router.put("/swatch-orders/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  const body = req.body as Record<string, unknown>;

  const [existing] = await db.select({ id: swatchOrdersTable.id })
    .from(swatchOrdersTable).where(and(eq(swatchOrdersTable.id, id), eq(swatchOrdersTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db.update(swatchOrdersTable).set({
    swatchName: body.swatchName as string || undefined,
    clientId: (body.clientId as string) ?? null,
    clientName: (body.clientName as string) ?? null,
    isChargeable: body.isChargeable !== undefined ? Boolean(body.isChargeable) : undefined,
    quantity: (body.quantity as string) ?? null,
    priority: (body.priority as string) || undefined,
    orderStatus: (body.orderStatus as string) || undefined,
    styleReferences: (body.styleReferences as object[]) ?? undefined,
    swatchReferences: (body.swatchReferences as object[]) ?? undefined,
    fabricId: (body.fabricId as string) ?? null,
    fabricName: (body.fabricName as string) ?? null,
    hasLining: body.hasLining !== undefined ? Boolean(body.hasLining) : undefined,
    liningFabricId: (body.liningFabricId as string) ?? null,
    liningFabricName: (body.liningFabricName as string) ?? null,
    unitLength: (body.unitLength as string) ?? null,
    unitWidth: (body.unitWidth as string) ?? null,
    unitType: (body.unitType as string) ?? null,
    orderIssueDate: (body.orderIssueDate as string) ?? null,
    deliveryDate: (body.deliveryDate as string) ?? null,
    targetHours: (body.targetHours as string) ?? null,
    issuedTo: (body.issuedTo as string) ?? null,
    department: (body.department as string) ?? null,
    description: (body.description as string) ?? null,
    internalNotes: (body.internalNotes as string) ?? null,
    clientInstructions: (body.clientInstructions as string) ?? null,
    refDocs: (body.refDocs as object[]) ?? undefined,
    refImages: (body.refImages as object[]) ?? undefined,
    actualStartDate: (body.actualStartDate as string) ?? null,
    actualStartTime: (body.actualStartTime as string) ?? null,
    tentativeDeliveryDate: (body.tentativeDeliveryDate as string) ?? null,
    actualCompletionDate: (body.actualCompletionDate as string) ?? null,
    actualCompletionTime: (body.actualCompletionTime as string) ?? null,
    delayReason: (body.delayReason as string) ?? null,
    approvalDate: (body.approvalDate as string) ?? null,
    revisionCount: body.revisionCount !== undefined ? Number(body.revisionCount) : undefined,
    updatedBy: user?.email ?? "system",
    updatedAt: new Date(),
  }).where(eq(swatchOrdersTable.id, id)).returning();

  res.json({ data: row });
});

router.patch("/swatch-orders/:id/status", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  const { orderStatus, priority } = req.body as { orderStatus?: string; priority?: string };

  const updates: Partial<typeof swatchOrdersTable.$inferInsert> = {
    updatedBy: user?.email ?? "system",
    updatedAt: new Date(),
  };
  if (orderStatus) updates.orderStatus = orderStatus;
  if (priority) updates.priority = priority;

  const [row] = await db.update(swatchOrdersTable).set(updates).where(eq(swatchOrdersTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

router.delete("/swatch-orders/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  await db.update(swatchOrdersTable).set({ isDeleted: true, updatedBy: user?.email ?? "system", updatedAt: new Date() })
    .where(eq(swatchOrdersTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
