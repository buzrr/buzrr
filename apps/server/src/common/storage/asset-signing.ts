import { createHmac, timingSafeEqual } from "node:crypto";
import { localStorageConfig, resolveStorageDriver } from "./storage.provider";

/**
 * Uploaded media (question images and sounds, sound-skin files) on the local
 * store is not public: `/uploads/<key>` is only served with a signature,
 * `?sig=<expiry>.<hmac>`. Signatures are handed out only to whoever may see
 * the asset —
 *
 *  - players and the host of a room, with the question as it opens
 *    (`question-start` / `state-sync`), so nobody learns a question's media
 *    before it is shown;
 *  - signed-in callers of the REST API, in responses they're authorised for
 *    (`SignAssetsInterceptor`), e.g. the quiz owner's editor.
 *
 * The database only ever holds the bare URL (`stripAssetSignature`). Other
 * stores (S3, Cloudinary) serve their own public URLs and are left as-is.
 */

const env = (key: string) => process.env[key];

/** Signed links live this long — a game, or an editing session. */
export const ASSET_TTL_SECONDS = 6 * 60 * 60;

function secret(): Buffer | null {
  const s = env("BETTER_AUTH_SECRET");
  return s ? createHmac("sha256", s).update("buzrr:uploads").digest() : null;
}

/** The local store's public URL prefix, or null when it isn't in use. */
function localPrefix(): string | null {
  try {
    if (resolveStorageDriver(env) !== "local") return null;
  } catch {
    return null;
  }
  return `${localStorageConfig(env).publicUrl.replace(/\/+$/, "")}/`;
}

function mac(key: string, expiry: number, k: Buffer): string {
  return createHmac("sha256", k).update(`${key}:${expiry}`).digest("base64url");
}

/** `url` without a `sig` query parameter (what gets stored). */
export function stripAssetSignature(url: string): string {
  const prefix = localPrefix();
  if (!prefix || !url.startsWith(prefix)) return url;
  return url.replace(/[?&]sig=[^&#]*/, "").replace(/\?$/, "");
}

/** A local upload URL with a fresh signature; anything else unchanged. */
export function signAssetUrl(
  url: string,
  ttlSeconds = ASSET_TTL_SECONDS,
): string {
  const prefix = localPrefix();
  const k = secret();
  if (!prefix || !k || !url.startsWith(prefix)) return url;
  const bare = stripAssetSignature(url);
  const key = bare.slice(prefix.length);
  if (!/^[\w-]+\.\w+$/.test(key)) return url;
  // Rounded so the same asset gets the same URL for a while (browser cache).
  const expiry = Math.ceil((Date.now() / 1000 + ttlSeconds) / 600) * 600;
  return `${bare}?sig=${expiry}.${mac(key, expiry, k)}`;
}

/** Public without a signature: built-in skins' files, `builtin-<…>.<ext>`. */
export function isPublicAssetKey(key: string): boolean {
  return /^builtin-[\w-]+\.\w+$/.test(key);
}

/** Whether `sig` (from the query) admits `key` right now. */
export function verifyAssetSignature(key: string, sig: unknown): boolean {
  const k = secret();
  if (!k || typeof sig !== "string") return false;
  const [exp, given] = sig.split(".");
  const expiry = Number(exp);
  if (!given || !Number.isFinite(expiry) || expiry * 1000 < Date.now()) {
    return false;
  }
  const want = Buffer.from(mac(key, expiry, k));
  const got = Buffer.from(given);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Signs every local upload URL found anywhere in `value` (deep copy). */
export function signAssetsDeep<T>(value: T): T {
  if (!localPrefix()) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return signAssetUrl(v);
    if (Array.isArray(v)) return v.map(walk);
    if (
      v &&
      typeof v === "object" &&
      !(v instanceof Date) &&
      !Buffer.isBuffer(v)
    ) {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
