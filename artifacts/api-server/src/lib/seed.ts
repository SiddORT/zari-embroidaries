import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { hashPassword } from "./auth";
import { logger } from "./logger";

export async function seedAdminUser(): Promise<void> {
  const adminEmail = "admin@zarierp.com";

  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, adminEmail));

  if (existing) {
    logger.info("Admin user already exists, skipping seed");
    return;
  }

  await db.insert(usersTable).values({
    username: "admin",
    email: adminEmail,
    hashedPassword: hashPassword("Admin@123"),
    role: "admin",
    isActive: true,
  });

  logger.info("Default admin user created: admin@zarierp.com");
}
