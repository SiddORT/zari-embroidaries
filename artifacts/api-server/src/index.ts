import app from "./app";
import { logger } from "./lib/logger";
import { seedAdminUser, seedDummyData } from "./lib/seed";
import { ensureShippingTables } from "./routes/shipping";
import { ensureSettingsTables } from "./routes/settings";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  try {
    await ensureShippingTables();
  } catch (seedErr) {
    logger.error({ err: seedErr }, "Failed to create shipping tables");
  }

  try {
    await ensureSettingsTables();
  } catch (seedErr) {
    logger.error({ err: seedErr }, "Failed to create settings tables");
  }

  try {
    await seedAdminUser();
  } catch (seedErr) {
    logger.error({ err: seedErr }, "Failed to seed admin user");
  }

  try {
    await seedDummyData();
  } catch (seedErr) {
    logger.error({ err: seedErr }, "Failed to seed dummy data");
  }
});
