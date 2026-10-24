import {
  MediaStorage,
  MediaUnavailableError,
  type StoredMedia,
} from "./media-storage";

/**
 * Bound when no media store is configured. Uploads fail loudly instead of
 * landing on the API server's disk, where they'd be served from a localhost
 * URL and lost on the next redeploy.
 */
export class UnavailableStorage extends MediaStorage {
  readonly driver = "none" as const;

  async upload(): Promise<StoredMedia> {
    throw new MediaUnavailableError();
  }

  async remove(): Promise<void> {}

  async read(): Promise<Buffer | null> {
    return null;
  }
}
