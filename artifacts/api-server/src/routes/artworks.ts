import { Router, type IRouter } from "express";
import { eq, and, desc, ilike } from "drizzle-orm";
import { db, artworksTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function generateArtworkCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ART-${year}-`;
  const [latest] = await db
    .select({ artworkCode: artworksTable.artworkCode })
    .from(artworksTable)
    .where(ilike(artworksTable.artworkCode, `${prefix}%`))
    .orderBy(desc(artworksTable.createdAt))
    .limit(1);
  if (!latest) return `${prefix}001`;
  const num = parseInt(latest.artworkCode.replace(prefix, ""), 10);
  return `${prefix}${String(num + 1).padStart(3, "0")}`;
}

router.get("/artworks", requireAuth, async (req, res): Promise<void> => {
  const { swatchOrderId } = req.query as Record<string, string>;
  if (!swatchOrderId || isNaN(parseInt(swatchOrderId))) {
    res.status(400).json({ error: "swatchOrderId is required" });
    return;
  }
  const rows = await db
    .select()
    .from(artworksTable)
    .where(and(
      eq(artworksTable.swatchOrderId, parseInt(swatchOrderId)),
      eq(artworksTable.isDeleted, false)
    ))
    .orderBy(desc(artworksTable.createdAt));
  res.json({ data: rows });
});

router.get("/artworks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(artworksTable).where(
    and(eq(artworksTable.id, id), eq(artworksTable.isDeleted, false))
  );
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ data: row });
});

router.post("/artworks", requireAuth, async (req, res): Promise<void> => {
  const user = (req as typeof req & { user?: { email: string } }).user;
  const body = req.body as Record<string, unknown>;

  if (!body.artworkName || typeof body.artworkName !== "string" || !body.artworkName.trim()) {
    res.status(400).json({ error: "Artwork Name is required" });
    return;
  }
  if (!body.swatchOrderId || isNaN(Number(body.swatchOrderId))) {
    res.status(400).json({ error: "swatchOrderId is required" });
    return;
  }

  const artworkCode = await generateArtworkCode();
  const [row] = await db.insert(artworksTable).values({
    artworkCode,
    swatchOrderId: Number(body.swatchOrderId),
    artworkName: body.artworkName as string,
    unitLength: (body.unitLength as string) || null,
    unitWidth: (body.unitWidth as string) || null,
    unitType: (body.unitType as string) || null,
    artworkCreated: (body.artworkCreated as string) || "Inhouse",
    workHours: (body.workHours as string) || null,
    hourlyRate: (body.hourlyRate as string) || null,
    totalCost: (body.totalCost as string) || null,
    feedbackStatus: (body.feedbackStatus as string) || "Pending",
    files: (body.files as object[]) || [],
    refImages: (body.refImages as object[]) || [],
    wipImages: (body.wipImages as object[]) || [],
    finalImages: (body.finalImages as object[]) || [],
    createdBy: user?.email ?? "system",
  }).returning();

  logger.info({ id: row.id, artworkCode }, "Artwork created");
  res.status(201).json({ data: row });
});

router.put("/artworks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  const body = req.body as Record<string, unknown>;

  const [existing] = await db.select({ id: artworksTable.id })
    .from(artworksTable).where(and(eq(artworksTable.id, id), eq(artworksTable.isDeleted, false)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const [row] = await db.update(artworksTable).set({
    artworkName: (body.artworkName as string) || undefined,
    unitLength: (body.unitLength as string) ?? null,
    unitWidth: (body.unitWidth as string) ?? null,
    unitType: (body.unitType as string) ?? null,
    artworkCreated: (body.artworkCreated as string) || undefined,
    workHours: (body.workHours as string) ?? null,
    hourlyRate: (body.hourlyRate as string) ?? null,
    totalCost: (body.totalCost as string) ?? null,
    feedbackStatus: (body.feedbackStatus as string) || undefined,
    files: (body.files as object[]) ?? undefined,
    refImages: (body.refImages as object[]) ?? undefined,
    wipImages: (body.wipImages as object[]) ?? undefined,
    finalImages: (body.finalImages as object[]) ?? undefined,
    updatedBy: user?.email ?? "system",
    updatedAt: new Date(),
  }).where(eq(artworksTable.id, id)).returning();

  res.json({ data: row });
});

router.delete("/artworks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const user = (req as typeof req & { user?: { email: string } }).user;
  await db.update(artworksTable).set({
    isDeleted: true,
    updatedBy: user?.email ?? "system",
    updatedAt: new Date()
  }).where(eq(artworksTable.id, id));
  res.json({ message: "Deleted" });
});

export default router;
