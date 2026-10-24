import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  signAssetUrl,
  signAssetsDeep,
  stripAssetSignature,
  verifyAssetSignature,
} from "../asset-signing";

const BASE = "https://quiz.example/uploads";

describe("asset signing (local store)", () => {
  beforeEach(() => {
    vi.stubEnv("STORAGE_DRIVER", "local");
    vi.stubEnv("STORAGE_PUBLIC_URL", BASE);
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  const sigOf = (url: string) => new URL(url).searchParams.get("sig");

  it("signs local upload URLs and the signature admits that key only", () => {
    const signed = signAssetUrl(`${BASE}/abc123.png`);
    expect(signed).toMatch(/\?sig=\d+\.[\w-]+$/);
    expect(verifyAssetSignature("abc123.png", sigOf(signed))).toBe(true);
    expect(verifyAssetSignature("other.png", sigOf(signed))).toBe(false);
  });

  it("refuses missing, forged and expired signatures", () => {
    expect(verifyAssetSignature("abc123.png", undefined)).toBe(false);
    expect(verifyAssetSignature("abc123.png", "123.forged")).toBe(false);
    vi.useFakeTimers();
    const signed = signAssetUrl(`${BASE}/abc123.png`, 60);
    vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
    expect(verifyAssetSignature("abc123.png", sigOf(signed))).toBe(false);
  });

  it("leaves external URLs alone and strips signatures for storage", () => {
    expect(signAssetUrl("https://elsewhere/x.png")).toBe(
      "https://elsewhere/x.png",
    );
    const signed = signAssetUrl(`${BASE}/abc123.mp3`);
    expect(stripAssetSignature(signed)).toBe(`${BASE}/abc123.mp3`);
  });

  it("signs nested payloads", () => {
    const out = signAssetsDeep({
      question: { media: `${BASE}/a.png`, audio: { url: `${BASE}/b.mp3` } },
      title: "plain text",
    });
    expect(out.question.media).toContain("?sig=");
    expect(out.question.audio.url).toContain("?sig=");
    expect(out.title).toBe("plain text");
  });

  it("does nothing for other stores", () => {
    vi.stubEnv("STORAGE_DRIVER", "s3");
    expect(signAssetUrl(`${BASE}/abc123.png`)).toBe(`${BASE}/abc123.png`);
  });
});
