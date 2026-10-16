import { Logger, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CloudinaryStorage } from "./cloudinary.storage";
import { LOCAL_UPLOADS_ROUTE, LocalStorage } from "./local.storage";
import { MediaStorage, type StorageDriver } from "./media-storage";
import { S3Storage } from "./s3.storage";
import { UnavailableStorage } from "./unavailable.storage";

const DRIVERS: StorageDriver[] = ["cloudinary", "s3", "local", "none"];

/**
 * `STORAGE_DRIVER` picks the store. Unset keeps existing deployments as they
 * were: Cloudinary when its credentials are present, otherwise `none` —
 * uploads fail with a 503 rather than silently landing on local disk. Local
 * disk is opt-in via `STORAGE_DRIVER=local`.
 */
export function resolveStorageDriver(
  env: (key: string) => string | undefined,
): StorageDriver {
  const explicit = env("STORAGE_DRIVER")?.trim().toLowerCase();
  if (explicit) {
    if (!DRIVERS.includes(explicit as StorageDriver)) {
      throw new Error(
        `STORAGE_DRIVER must be one of ${DRIVERS.join(", ")} (got "${explicit}")`,
      );
    }
    return explicit as StorageDriver;
  }
  return env("CLOUDINARY_CLOUD_NAME") ? "cloudinary" : "none";
}

/** Where local uploads live on disk and the URL they are served from. */
export function localStorageConfig(env: (key: string) => string | undefined) {
  const port = env("API_PORT") ?? env("PORT") ?? "3001";
  return {
    dir: env("STORAGE_LOCAL_DIR") || "./uploads",
    publicUrl:
      env("STORAGE_PUBLIC_URL") ||
      `http://localhost:${port}${LOCAL_UPLOADS_ROUTE}`,
  };
}

export function createStorage(
  env: (key: string) => string | undefined,
): MediaStorage {
  const driver = resolveStorageDriver(env);
  switch (driver) {
    case "cloudinary": {
      const cloudName = env("CLOUDINARY_CLOUD_NAME");
      const apiKey = env("CLOUDINARY_API_KEY");
      const apiSecret = env("CLOUDINARY_API_SECRET");
      // Incomplete credentials would fail every upload anyway; report it as
      // "unavailable" up front instead of as an opaque Cloudinary error.
      if (!cloudName || !apiKey || !apiSecret) return new UnavailableStorage();
      return new CloudinaryStorage({ cloudName, apiKey, apiSecret });
    }
    case "s3": {
      const bucket = env("S3_BUCKET");
      const accessKeyId = env("S3_ACCESS_KEY_ID");
      const secretAccessKey = env("S3_SECRET_ACCESS_KEY");
      // Same as Cloudinary: missing credentials disable uploads, not boot.
      if (!bucket || !accessKeyId || !secretAccessKey) {
        return new UnavailableStorage();
      }
      const region = env("S3_REGION") || "us-east-1";
      const customEndpoint = env("S3_ENDPOINT");
      const endpoint = customEndpoint || `https://s3.${region}.amazonaws.com`;
      // Self-hosted stores are path-style; AWS itself prefers virtual hosts.
      const forcePathStyle =
        (env("S3_FORCE_PATH_STYLE") ?? (customEndpoint ? "true" : "false")) ===
        "true";
      const prefix = env("S3_PREFIX") ?? "";
      return new S3Storage({
        endpoint,
        region,
        bucket,
        accessKeyId,
        secretAccessKey,
        forcePathStyle,
        prefix: prefix && !prefix.endsWith("/") ? `${prefix}/` : prefix,
        publicUrl:
          env("S3_PUBLIC_URL") ||
          (forcePathStyle
            ? `${endpoint.replace(/\/+$/, "")}/${bucket}`
            : `${new URL(endpoint).protocol}//${bucket}.${new URL(endpoint).host}`),
      });
    }
    case "local":
      return new LocalStorage(localStorageConfig(env));
    case "none":
      return new UnavailableStorage();
  }
}

export const storageProvider: Provider = {
  provide: MediaStorage,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const storage = createStorage((key) => config.get<string>(key));
    const logger = new Logger("MediaStorage");
    if (storage.driver === "none") {
      logger.warn(
        "No media store configured (set CLOUDINARY_* or STORAGE_DRIVER) — question image uploads will fail with 503",
      );
    } else {
      logger.log(`Question media stored via ${storage.driver}`);
    }
    return storage;
  },
};
