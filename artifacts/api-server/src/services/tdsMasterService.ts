import { db, and, asc, count, desc, eq, ilike, or } from "@workspace/db";
import {
  tdsMasterTable,
  InsertTdsMaster,
  UpdateTdsMaster,
  insertTdsMasterSchema
} from "@workspace/db";
import { logger } from "../lib/logger";

// Helper to build WHERE conditions from search and status
export const buildTDSWhere = (search: string, status: string) => {
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(tdsMasterTable.serviceName, `%${search}%`),
        ilike(tdsMasterTable.sectionCode, `%${search}%`)
      )
    );
  }

  if (status === "active") {
    conditions.push(eq(tdsMasterTable.status, true));
  } else if (status === "inactive") {
    conditions.push(eq(tdsMasterTable.status, false));
  }
  return conditions.length ? and(...conditions) : undefined;
};

export async function createTdsMaster(data: InsertTdsMaster, userId: number) {
  const [tds] = await db
    .insert(tdsMasterTable)
    .values({
      ...data,
      createdBy: userId,
    })
    .returning();

  return tds;
}

export async function getTdsMasters(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  paginate: boolean;
}) {
  const { page, limit, search, status, paginate } = params;

  const conditions = [];

  // Exclude Deleted Records
  conditions.push(eq(tdsMasterTable.isDeleted, false));

  if (search) {
    conditions.push(
      or(
        ilike(tdsMasterTable.serviceName, `%${search}%`),
        ilike(tdsMasterTable.paymentNature, `%${search}%`),
        ilike(tdsMasterTable.sectionCode, `%${search}%`),
      ),
    );
  }

  if (status !== undefined) {
    if (status === "active") {
      conditions.push(eq(tdsMasterTable.status, true));
    } else if (status === "inactive") {
      conditions.push(eq(tdsMasterTable.status, false));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Dropdown
  if (!paginate) {
    return db
      .select()
      .from(tdsMasterTable)
      .where(whereClause)
      .orderBy(asc(tdsMasterTable.serviceName));
  }

  const offset = (page - 1) * limit;

  const data = await db.query.tdsMasterTable.findMany({
    where: whereClause,
    with: {
      createdByUser: {
        columns: {
          id: true,
          username: true,
          email: true,
        },
      },
      updatedByUser: {
        columns: {
          id: true,
          username: true,
          email: true,
        },
      },
      deletedByUser: {
        columns: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
    orderBy: desc(tdsMasterTable.createdAt),
    limit,
    offset,
  });

  const [{ total }] = await db
    .select({
      total: count(),
    })
    .from(tdsMasterTable)
    .where(whereClause);

  const totalRecords = Number(total);

  return {
    data,
    page,
    limit,
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
  };
}

export async function getTdsMasterById(id: number) {
  const tds = await db.query.tdsMasterTable.findFirst({
    where: eq(tdsMasterTable.id, id),
    with: {
      createdByUser: {
        columns: {
          id: true,
          username: true,
        },
      },
      updatedByUser: {
        columns: {
          id: true,
          username: true,
        },
      },
    },
  });

  return tds ?? null;
}

export async function updateTdsMaster(
  id: number,
  data: UpdateTdsMaster,
  userId: number,
) {
  const [tds] = await db
    .update(tdsMasterTable)
    .set({
      ...data,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(tdsMasterTable.id, id))
    .returning();

  return tds ?? null;
}

export async function updateTdsMasterStatus(
  id: number,
  status: boolean,
  userId: number,
) {
  const [tds] = await db
    .update(tdsMasterTable)
    .set({
      status,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(tdsMasterTable.id, id))
    .returning();

  return tds ?? null;
}

export async function deleteTdsMaster(id: number, userId: number) {
  const [tds] = await db
    .update(tdsMasterTable)
    .set({
      isDeleted: true,
      deletedBy: userId,
      deletedAt: new Date(),
    })
    .where(eq(tdsMasterTable.id, id))
    .returning();

  return tds ?? null;
}

// Fetch all records with filters (no pagination)
export const getAllTDSRecords = async (search: string, status: string) => {
  const where = buildTDSWhere(search, status);
  const data = await db.query.tdsMasterTable.findMany({
    where: where,
    with: {
      createdByUser: {
        columns: {
          id: true,
          username: true,
          email: true,
        },
      },
      updatedByUser: {
        columns: {
          id: true,
          username: true,
          email: true,
        },
      },
      deletedByUser: {
        columns: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
    orderBy: desc(tdsMasterTable.createdAt),
  });
  return data;
};

export async function bulkImportTDSRecords(
  records: Array<{
    serviceName: string;
    paymentNature: string;
    sectionCode: string;
    ratePercent: string | number;
    thresholdAmount: string | number;
    effectiveFrom: string;
    effectiveTo?: string | null;
    remarks?: string | null;
    status?: boolean;
  }>,
  createdBy: number
): Promise<{
  imported: number;
  skipped: number;
  errors: { row: number; sectionCode: string; error: string }[];
}> {
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; sectionCode: string; error: string }[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNum = i + 2;
    console.log("row.effectiveTo", row.effectiveTo);
    const parsed = insertTdsMasterSchema.safeParse({
      serviceName: row.serviceName?.toString().trim(),
      paymentNature: row.paymentNature?.toString().trim(),
      sectionCode: row.sectionCode?.toString().trim(),
      ratePercent: row.ratePercent?.toString(),
      thresholdAmount: row.thresholdAmount?.toString(),
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo && row.effectiveTo.trim() !== "" ? row.effectiveTo : null,
      remarks: row.remarks?.toString().trim() ?? null,
      status: row.status ?? true,
    });

    if (!parsed.success) {
      const flattened = parsed.error.flatten();
      const fieldErrors = flattened.fieldErrors ?? {};
      const errorParts = Object.entries(fieldErrors).map(([key, value]) => {
        const msg = Array.isArray(value) ? value.join(", ") : String(value);
        return `${key}: ${msg}`;
      });
      const errorMsg = errorParts.join("; ") || "Invalid fields";

      errors.push({
        row: rowNum,
        sectionCode: row.sectionCode?.toString() || "",
        error: errorMsg,
      });
      continue;
    }

    // Check duplicate by sectionCode (unique key)
    const [existing] = await db
      .select({ id: tdsMasterTable.id })
      .from(tdsMasterTable)
      .where(
        and(
          eq(tdsMasterTable.sectionCode, parsed.data.sectionCode),
          eq(tdsMasterTable.isDeleted, false)
        )
      )
      .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

    try {
      await db.insert(tdsMasterTable).values({
        ...parsed.data,
        createdBy,
      });
      imported++;
    } catch (error) {
      logger.error(error, `Failed to insert TDS record at row ${rowNum}`);
      errors.push({
        row: rowNum,
        sectionCode: parsed.data.sectionCode,
        error: "Database insert failed.",
      });
    }
  }

  return { imported, skipped, errors };
}
