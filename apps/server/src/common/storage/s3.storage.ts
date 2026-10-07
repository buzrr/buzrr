import { createHash, createHmac } from "node:crypto";
import { nanoid } from "nanoid";
import { sniffImage } from "./image-sniff";
import {
  MediaStorage,
  type StoredMedia,
  type UploadMeta,
} from "./media-storage";

export interface S3Config {
  /** e.g. http://minio:9000, https://<account>.r2.cloudflarestorage.com. */
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** `endpoint/bucket/key` (MinIO, most self-hosted stores) vs `bucket.endpoint/key`. */
  forcePathStyle: boolean;
  /** Base URL browsers load objects from (a CDN, or the bucket's public URL). */
  publicUrl: string;
  /** Object key prefix, e.g. "buzrr/". */
  prefix: string;
}

const sha256Hex = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) =>
  createHmac("sha256", key).update(data).digest();

/** RFC 3986 encoding, as SigV4 requires (`encodeURIComponent` leaves !'()*). */
const encodeSegment = (s: string) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * AWS Signature Version 4 for a single S3 request — the whole of what this
 * driver needs, without pulling in the AWS SDK. Returns the headers to send
 * (including `authorization`). Exported for its test vector.
 */
export function signS3Request(input: {
  method: string;
  host: string;
  path: string;
  headers: Record<string, string>;
  payloadHash: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  now: Date;
}): Record<string, string> {
  const amzDate = input.now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    ...Object.fromEntries(
      Object.entries(input.headers).map(([k, v]) => [k.toLowerCase(), v]),
    ),
    host: input.host,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": amzDate,
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names
    .map((n) => `${n}:${headers[n]!.trim().replace(/\s+/g, " ")}\n`)
    .join("");
  const signedHeaders = names.join(";");
  const canonicalPath = input.path.split("/").map(encodeSegment).join("/");
  const canonicalRequest = [
    input.method,
    canonicalPath,
    "",
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");
  const scope = `${date}/${input.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, date), input.region), "s3"),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");
  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

/**
 * Any S3-compatible object store: AWS S3, MinIO, Cloudflare R2, Backblaze B2,
 * Garage, … The bucket must allow public reads of the objects (or sit behind
 * `publicUrl` that does) — question images are loaded straight by browsers.
 */
export class S3Storage extends MediaStorage {
  readonly driver = "s3" as const;
  private readonly endpoint: URL;
  private readonly publicUrl: string;

  constructor(private readonly config: S3Config) {
    super();
    this.endpoint = new URL(config.endpoint);
    this.publicUrl = config.publicUrl.replace(/\/+$/, "");
  }

  private target(key: string): { url: string; host: string; path: string } {
    const { bucket, forcePathStyle } = this.config;
    const base = this.endpoint.pathname.replace(/\/+$/, "");
    if (forcePathStyle) {
      const path = `${base}/${bucket}/${key}`;
      return {
        url: `${this.endpoint.origin}${path}`,
        host: this.endpoint.host,
        path,
      };
    }
    const host = `${bucket}.${this.endpoint.host}`;
    const path = `${base}/${key}`;
    return { url: `${this.endpoint.protocol}//${host}${path}`, host, path };
  }

  private async send(
    method: "PUT" | "DELETE",
    key: string,
    body?: Buffer,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    const { url, host, path } = this.target(key);
    const signed = signS3Request({
      method,
      host,
      path,
      headers,
      payloadHash: sha256Hex(body ?? ""),
      region: this.config.region,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      now: new Date(),
    });
    // `host` is derived from the URL by fetch itself.
    const { host: _host, ...sendHeaders } = signed;
    void _host;
    return fetch(url, {
      method,
      headers: sendHeaders,
      body: body ? new Uint8Array(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  }

  async upload(buffer: Buffer, _meta?: UploadMeta): Promise<StoredMedia> {
    const { type, ext } = sniffImage(buffer);
    const key = `${this.config.prefix}${nanoid(21)}.${ext}`;
    const res = await this.send("PUT", key, buffer, {
      "content-type": type,
      "cache-control": "public, max-age=31536000, immutable",
    });
    if (!res.ok) {
      throw new Error(
        `S3 upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`,
      );
    }
    return { url: `${this.publicUrl}/${key}`, mediaType: "image" };
  }

  async remove(url: string): Promise<void> {
    if (!url.startsWith(`${this.publicUrl}/`)) return;
    const key = url.slice(this.publicUrl.length + 1);
    if (!key || key.includes("..")) return;
    await this.send("DELETE", key).catch(() => undefined);
  }
}
