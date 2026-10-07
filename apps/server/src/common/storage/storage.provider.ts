import { Logger, type Provider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CloudinaryStorage } from "./cloudinary.storage";
import { LOCAL_UPLOADS_ROUTE, LocalStorage } from "./local.storage";
import { MediaStorage, type StorageDriver } from "./media-storage";
import { S3Storage } from "./s3.storage";

const DRIVERS: StorageDriver[] = ["cloudinary", "s3", "local"];

/**
 * `STORAGE_DRIVER` picks the store. Unset keeps existing deployments as they
 * were: Cloudinary when its credentials are present, otherwise local disk —
 * so a fresh checkout (or an offline install) has working uploads with no
 * account anywhere.
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
  return env("CLOUDINARY_CLOUD_NAME") ? "cloudinary" : "local";
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

function required(env: (key: string) => string | undefined, key: string) {
  const value = env(key);
  if (!value) {
    throw new Error(`${key} is required when STORAGE_DRIVER=s3`);
  }
  return value;
}

export function createStorage(
  env: (key: string) => string | undefined,
): MediaStorage {
  const driver = resolveStorageDriver(env);
  switch (driver) {
    case "cloudinary":
      return new CloudinaryStorage({
        cloudName: env("CLOUDINARY_CLOUD_NAME"),
        apiKey: env("CLOUDINARY_API_KEY"),
        apiSecret: env("CLOUDINARY_API_SECRET"),
      });
    case "s3": {
      const region = env("S3_REGION") || "us-east-1";
      const bucket = required(env, "S3_BUCKET");
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
        accessKeyId: required(env, "S3_ACCESS_KEY_ID"),
        secretAccessKey: required(env, "S3_SECRET_ACCESS_KEY"),
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
  }
}

export const storageProvider: Provider = {
  provide: MediaStorage,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const storage = createStorage((key) => config.get<string>(key));
    new Logger("MediaStorage").log(
      `Question media stored via ${storage.driver}`,
    );
    return storage;
  },
};
