import { readFileSync } from "fs";
import { resolve } from "path";
import { pool } from "@workspace/db";

export async function seedIfEmpty(): Promise<void> {
  const client = await pool.connect();
  try {
    // Check if already seeded (users table is the primary indicator)
    const check = await client.query(
      "SELECT COUNT(*)::int AS n FROM users"
    );
    const count = parseInt(check.rows[0].n ?? "0", 10);

    if (count > 0) {
      console.log(`[seed] Database already has ${count} user(s) — skipping seed.`);
      return;
    }

    // Locate seed.sql (workspace root → scripts/seed.sql)
    const seedPath = resolve(process.cwd(), "scripts", "seed.sql");
    let sql: string;
    try {
      sql = readFileSync(seedPath, "utf8");
    } catch {
      console.warn("[seed] scripts/seed.sql not found — skipping seed.");
      return;
    }

    console.log("[seed] Empty database detected — applying seed data…");
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("[seed] Seed completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[seed] Seed failed (rolling back):", err);
  } finally {
    client.release();
  }
}
