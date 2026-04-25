/**
 * Storage provider selector.
 * Set STORAGE_PROVIDER=local (default) or STORAGE_PROVIDER=s3 in environment.
 */

import type { SaveOptions } from "./localStorage";

export type { SaveOptions };

const provider = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();

async function getDriver() {
  if (provider === "s3") {
    return import("./s3Storage");
  }
  return import("./localStorage");
}

export const storage = {
  async saveFile(buffer: Buffer, opts: SaveOptions): Promise<void> {
    const driver = await getDriver();
    return driver.saveFile(buffer, opts);
  },
  async deleteFile(relativePath: string): Promise<void> {
    const driver = await getDriver();
    return driver.deleteFile(relativePath);
  },
};
