import type { Request, Response } from "express";

import {
  insertTdsMasterSchema,
  updateTdsMasterSchema,
  updateTdsStatusSchema,
  tdsMasterQuerySchema,
} from "@workspace/db";

import * as tdsMasterService from "../services/tdsMasterService";
import { logger } from "../lib/logger";

type AuthRequest = Request & {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
};

export async function createTdsMaster(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const parsed = insertTdsMasterSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.flatten(),
    });
    return;
  }

  try {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const userId = req.user.userId;

    const tds = await tdsMasterService.createTdsMaster(parsed.data, userId);

    res.status(201).json({
      data: tds,
      message: "TDS master created successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to create TDS master",
    });
  }
}

export async function getTdsMasters(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const parsed = tdsMasterQuerySchema.safeParse(req.query);

  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.flatten(),
    });
    return;
  }

  try {
    const result = await tdsMasterService.getTdsMasters({
      page: parsed.data.page,
      limit: parsed.data.limit,
      search: parsed.data.search,
      status: parsed.data.status,
      paginate: parsed.data.paginate === "true",
    });

    res.json(result);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch TDS masters",
    });
  }
}

export async function getTdsMasterById(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      error: "Invalid TDS master ID",
    });
    return;
  }

  try {
    const tds = await tdsMasterService.getTdsMasterById(id);

    if (!tds) {
      res.status(404).json({
        error: "TDS master not found",
      });
      return;
    }

    res.json({
      data: tds,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to fetch TDS master",
    });
  }
}

export async function updateTdsMaster(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      error: "Invalid TDS master ID",
    });
    return;
  }

  const parsed = updateTdsMasterSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.flatten(),
    });
    return;
  }

  try {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const userId = req.user.userId;

    const tds = await tdsMasterService.updateTdsMaster(id, parsed.data, userId);

    if (!tds) {
      res.status(404).json({
        error: "TDS master not found",
      });
      return;
    }

    res.json({
      data: tds,
      message: "TDS master updated successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update TDS master",
    });
  }
}

export async function updateTdsMasterStatus(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      error: "Invalid TDS master ID",
    });
    return;
  }

  const parsed =
    updateTdsStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.flatten(),
    });
    return;
  }

  try {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const userId = req.user.userId;

    const tds =
      await tdsMasterService.updateTdsMasterStatus(
        id,
        parsed.data.status,
        userId,
      );

    if (!tds) {
      res.status(404).json({
        error: "TDS master not found",
      });
      return;
    }

    res.json({
      data: tds,
      message: "TDS master status updated successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to update TDS master status",
    });
  }
}

export async function deleteTdsMaster(
  req: AuthRequest,
  res: Response,
): Promise<void> {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({
      error: "Invalid TDS master ID",
    });
    return;
  }

  try {
    if (!req.user) {
      res.status(401).json({
        error: "Unauthorized",
      });
      return;
    }

    const userId = req.user.userId;

    const tds =
      await tdsMasterService.deleteTdsMaster(
        id,
        userId,
      );

    if (!tds) {
      res.status(404).json({
        error: "TDS master not found",
      });
      return;
    }

    res.json({
      data: tds,
      message: "TDS master deleted successfully",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to delete TDS master",
    });
  }
}

export async function exportTDSRecords(
  req: AuthRequest, 
  res: Response
): Promise<void> {
  try {
    const search = (req.query.search as string) ?? "";
    const status = (req.query.status as string) ?? "all";
    const records = await tdsMasterService.getAllTDSRecords(search, status);

    res.json({ 
      meassage : "Fetched reord sucessfully",
      data: records 
    });
  } catch (error) {
    console.error("Export TDS error:", error);
    res.status(500).json({ error: "Failed to export TDS records" });
  }
};

export async function importTDSRecords(
  req: AuthRequest,
  res: Response
): Promise<void> {
  const body = req.body;

  if (!Array.isArray(body) || body.length === 0) {
    res.status(400).json({ error: "Request body must be a non-empty array of TDS records." });
    return;
  }

  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const createdBy = req.user.userId;

  try {
    const result = await tdsMasterService.bulkImportTDSRecords(body, createdBy);

    logger.info(
      { imported: result.imported, skipped: result.skipped, errors: result.errors.length },
      "TDS bulk import completed"
    );

    res.json({
      imported: result.imported,
      skipped: result.skipped,
      errors: result.errors,
    });
  } catch (error) {
    logger.error(error, "TDS bulk import failed");
    res.status(500).json({ error: "Import failed due to server error." });
  }
}
