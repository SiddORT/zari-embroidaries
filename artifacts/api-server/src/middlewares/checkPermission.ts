import { Response,Request,  NextFunction } from "express";
import { db , rolePermissionsTable,rolesTable , eq, and, isNull } from "@workspace/db";


type AuthRequest = Request & { user?: { userId: number; email: string; role: string ; roleId: number} };

export const checkPermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const role = req.user?.role;
    if (!role) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [userRole] = await db.
    select({id: rolesTable.id, name: rolesTable.name})
    .from(rolesTable)
    .where(eq(rolesTable.name, role))
    .limit(1);

    const roleId = userRole.id;

    const [match] = await db
    .select()
    .from(rolePermissionsTable)
    .where(
    and(
        eq(rolePermissionsTable.roleId, roleId),
        eq(rolePermissionsTable.permission, permission),
        isNull(rolePermissionsTable.deletedAt)
    )
    )
    .limit(1);

    if (!match) {
      res.status(403).json({ error: "Forbidden", required: permission });
      return;
    }

    next();
  };
};