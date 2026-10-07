import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sniffImage } from "../image-sniff";
import { LocalStorage } from "../local.storage";
import { UnsupportedMediaError } from "../media-storage";
import { signS3Request } from "../s3.storage";
import { createStorage, resolveStorageDriver } from "../storage.provider";

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
const env = (vars: Record<string, string>) => (key: string) => vars[key];

describe("signS3Request", () => {
  // The "GET Object" example from AWS's SigV4 documentation
  // (sig-v4-header-based-auth.html), with its published signature.
  it("matches AWS's published test vector", () => {
    const headers = signS3Request({
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      headers: { Range: "bytes=0-9" },
      payloadHash:
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(headers.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
    );
  });
});

describe("sniffImage", () => {
  it("identifies raster images by their bytes", () => {
    expect(sniffImage(PNG)).toEqual({ type: "image/png", ext: "png" });
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).ext).toBe("jpg");
    expect(sniffImage(Buffer.from("GIF89a....")).ext).toBe("gif");
  });

  it("refuses SVG, HTML and anything else", () => {
    for (const body of ["<svg onload=alert(1)>", "<!doctype html>", "hello"]) {
      expect(() => sniffImage(Buffer.from(body))).toThrow(
        UnsupportedMediaError,
      );
    }
  });
});

describe("LocalStorage", () => {
  let dir = "";
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("stores, serves under its public URL, and removes", async () => {
    dir = await mkdtemp(join(tmpdir(), "buzrr-uploads-"));
    const storage = new LocalStorage({
      dir,
      publicUrl: "http://localhost:3001/uploads/",
    });
    const stored = await storage.upload(PNG, { contentType: "image/png" });
    expect(stored.mediaType).toBe("image");
    expect(stored.url).toMatch(
      /^http:\/\/localhost:3001\/uploads\/[\w-]+\.png$/,
    );
    const [file] = await readdir(dir);
    expect(await readFile(join(dir, file!))).toEqual(PNG);

    await storage.remove(stored.url);
    expect(await readdir(dir)).toEqual([]);
  });

  it("ignores URLs it didn't issue, including traversal attempts", async () => {
    dir = await mkdtemp(join(tmpdir(), "buzrr-uploads-"));
    const storage = new LocalStorage({ dir, publicUrl: "http://x/uploads" });
    await storage.upload(PNG, { contentType: "image/png" });
    await storage.remove("https://res.cloudinary.com/demo/image/upload/a.png");
    await storage.remove("http://x/uploads/../../etc/passwd");
    expect(await readdir(dir)).toHaveLength(1);
  });
});

describe("driver selection", () => {
  it("keeps Cloudinary deployments on Cloudinary, everyone else on disk", () => {
    expect(resolveStorageDriver(env({ CLOUDINARY_CLOUD_NAME: "demo" }))).toBe(
      "cloudinary",
    );
    expect(resolveStorageDriver(env({}))).toBe("local");
    expect(
      resolveStorageDriver(
        env({ STORAGE_DRIVER: "S3", CLOUDINARY_CLOUD_NAME: "demo" }),
      ),
    ).toBe("s3");
  });

  it("rejects an unknown driver and an incomplete S3 config at boot", () => {
    expect(() => resolveStorageDriver(env({ STORAGE_DRIVER: "ftp" }))).toThrow(
      /STORAGE_DRIVER/,
    );
    expect(() => createStorage(env({ STORAGE_DRIVER: "s3" }))).toThrow(
      /S3_BUCKET/,
    );
  });
});
