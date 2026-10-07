/** What a stored upload is, in the vocabulary questions use (`Question.mediaType`). */
export interface StoredMedia {
  url: string;
  mediaType: string;
}

export type StorageDriver = "cloudinary" | "s3" | "local";

/** What the client claimed about an upload. Drivers that serve bytes as-is
 * ignore it and sniff the content instead. */
export interface UploadMeta {
  contentType: string;
  filename?: string;
}

/**
 * Where question media lives. One implementation is bound at boot from
 * `STORAGE_DRIVER` (see `storage.provider.ts`); callers depend only on this, so
 * a self-hosted instance can keep images on its own disk or an S3-compatible
 * bucket (MinIO, R2, …) instead of a SaaS.
 *
 * Abstract class rather than an interface so it can be the Nest injection
 * token.
 */
export abstract class MediaStorage {
  abstract readonly driver: StorageDriver;

  /** Stores an upload and returns its public URL. */
  abstract upload(buffer: Buffer, meta?: UploadMeta): Promise<StoredMedia>;

  /**
   * Deletes media this driver stored. URLs it didn't issue (another driver's,
   * or an external link) are ignored, never an error — switching drivers must
   * not break editing questions that still point at the old store.
   */
  abstract remove(url: string): Promise<void>;
}

/** An upload the configured store refuses; the message is user-facing. */
export class UnsupportedMediaError extends Error {}
