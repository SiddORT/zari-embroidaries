import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";

const ADMIN_EMAIL = "admin@zarierp.com";
const ADMIN_PASSWORD = "Admin@123";

export async function seedAdminUser(): Promise<void> {
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, ADMIN_EMAIL));

  if (existing) {
    return;
  }

  await db.insert(usersTable).values({
    username: "admin",
    email: ADMIN_EMAIL,
    hashedPassword: hashPassword(ADMIN_PASSWORD),
    role: "admin",
    isActive: true,
  });

  logger.info("Default admin user created: admin@zarierp.com");
}
