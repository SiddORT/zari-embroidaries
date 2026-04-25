/**
 * S3 Storage Driver — Future implementation
 *
 * To enable S3:
 *  1. Set STORAGE_PROVIDER=s3 in environment
 *  2. Set AWS_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *  3. Install @aws-sdk/client-s3 and implement the functions below
 */

export interface SaveOptions {
  dir: string;
  filename: string;
}

export async function saveFile(_buffer: Buffer, _opts: SaveOptions): Promise<void> {
  throw new Error(
    "S3 storage is not yet configured. " +
    "Set STORAGE_PROVIDER=local or implement this driver with AWS SDK credentials."
  );
}

export async function deleteFile(_key: string): Promise<void> {
  throw new Error(
    "S3 storage is not yet configured. " +
    "Set STORAGE_PROVIDER=local or implement this driver with AWS SDK credentials."
  );
}
