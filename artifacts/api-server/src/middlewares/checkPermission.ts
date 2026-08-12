import { Response, Request, NextFunction } from "express";
import { db, rolePermissionsTable, rolesTable, eq, and, isNull, inArray } from "@workspace/db";

type AuthRequest = Request & {
  user?: { userId: number; email: string; role: string; roleId: number };
};

type PermissionInput =
  | string
  | { any: string[] }
  | { all: string[] };

export const checkPermission = (input: PermissionInput) => {
  const mode: "any" | "all" = typeof input === "string" || "any" in input ? "any" : "all";
  const required: string[] =
    typeof input === "string" ? [input] : "any" in input ? input.any : input.all;

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const role = req.user?.role;
    if (!role) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [userRole] = await db
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(eq(rolesTable.name, role))
      .limit(1);

    if (!userRole) {
      res.status(403).json({ error: "Forbidden", required });
      return;
    }

    const matches = await db
      .select({ permission: rolePermissionsTable.permission })
      .from(rolePermissionsTable)
      .where(
        and(
          eq(rolePermissionsTable.roleId, userRole.id),
          inArray(rolePermissionsTable.permission, required),
          isNull(rolePermissionsTable.deletedAt)
        )
      );

    const matchedSet = new Set(matches.map((m) => m.permission));
    const passed =
      mode === "any"
        ? required.some((p) => matchedSet.has(p))
        : required.every((p) => matchedSet.has(p));

    if (!passed) {
      res.status(403).json({ error: "Forbidden", required });
      return;
    }

    next();
  };
};