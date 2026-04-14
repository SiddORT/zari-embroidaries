import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, itemTypesTable, unitTypesTable, widthUnitTypesTable, fabricTypesTable, swatchCategoriesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function lookupTable(type: string) {
  if (type === "item-types") return itemTypesTable;
  if (type === "unit-types") return unitTypesTable;
  if (type === "width-unit-types") return widthUnitTypesTable;
  if (type === "fabric-types") return fabricTypesTable;
  if (type === "swatch-categories") return swatchCategoriesTable;
  return null;
}

router.get("/lookups/:type", requireAuth, async (req, res): Promise<void> => {
  const table = lookupTable(req.params.type);
  if (!table) { res.status(404).json({ error: "Unknown lookup type" }); return; }
  const rows = await db.select().from(table).orderBy(table.name);
  res.json(rows);
});

router.post("/lookups/:type", requireAuth, async (req, res): Promise<void> => {
  const table = lookupTable(req.params.type);
  if (!table) { res.status(404).json({ error: "Unknown lookup type" }); return; }

  const { name, isActive = true } = req.body as { name: string; isActive?: boolean };
  if (!name?.trim()) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const [existing] = await db.select({ id: table.id }).from(table).where(eq(table.name, name.trim()));
  if (existing) {
    res.status(409).json({ error: "Name already exists" });
    return;
  }

  const [record] = await db.insert(table).values({ name: name.trim(), isActive }).returning();
  logger.info({ type: req.params.type, id: record.id }, "Lookup record created");
  res.status(201).json(record);
});

export default router;
