import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";

export interface StoredObject {
  storageKey: string;
}

export interface StorageDriver {
  put(buffer: Buffer, originalName: string, contentType: string): Promise<StoredObject>;
  get(storageKey: string): Promise<Buffer>;
}

// Deliberately NOT under process.cwd() — the production image (see
// backend/Dockerfile) copies the app in as root and then runs it as an
// unprivileged "parts_inventory" user, which cannot create a new
// directory inside its own read-only working directory (confirmed live:
// every upload failed with EACCES: permission denied, mkdir
// '/app/backend/uploads'). The OS temp dir is world-writable by
// convention on every platform this runs on (Linux's /tmp carries the
// sticky bit; same idea on the other platforms `os.tmpdir()` resolves
// on), so it works regardless of which user owns the app's own files.
const LOCAL_UPLOAD_DIR = path.join(os.tmpdir(), "parts-inventory-system-uploads");

class LocalStorageDriver implements StorageDriver {
  async put(buffer: Buffer, originalName: string): Promise<StoredObject> {
    await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
    const safeName = originalName.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const storageKey = `${randomUUID()}-${safeName}`;
    await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, storageKey), buffer);
    return { storageKey };
  }

  async get(storageKey: string): Promise<Buffer> {
    return fs.readFile(path.join(LOCAL_UPLOAD_DIR, storageKey));
  }
}

/**
 * S3StorageDriver is intentionally not implemented here to avoid bundling
 * the AWS SDK when it isn't configured. Swap STORAGE_DRIVER=s3 and provide
 * an implementation using @aws-sdk/client-s3 (PutObjectCommand/GetObjectCommand)
 * against AWS_S3_BUCKET/AWS_REGION — the StorageDriver interface above is the
 * only contract the rest of the app depends on, so no business logic changes.
 */

export const storage: StorageDriver = new LocalStorageDriver();

void env.STORAGE_DRIVER; // documents the intended switch point above
