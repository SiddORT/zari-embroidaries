import fs from "fs";
import path from "path";

export interface SaveOptions {
  dir: string;
  filename: string;
}

export async function saveFile(buffer: Buffer, opts: SaveOptions): Promise<void> {
  fs.mkdirSync(opts.dir, { recursive: true });
  await fs.promises.writeFile(path.join(opts.dir, opts.filename), buffer);
}

export async function deleteFile(relativePath: string): Promise<void> {
  if (!relativePath) return;
  const abs = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(process.cwd(), relativePath);
  try {
    await fs.promises.unlink(abs);
  } catch {
    // Silently ignore — file may already be gone
  }
}
