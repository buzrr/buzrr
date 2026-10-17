import { describe, expect, it } from "vitest";
import { sniffAudio } from "../image-sniff";
import { UnsupportedMediaError } from "../media-storage";

describe("sniffAudio", () => {
  it("accepts MP3 with an ID3 tag or a bare frame sync", () => {
    expect(sniffAudio(Buffer.from("ID3\x04\x00\x00", "binary")).ext).toBe(
      "mp3",
    );
    expect(sniffAudio(Buffer.from([0xff, 0xfb, 0x90, 0x64])).type).toBe(
      "audio/mpeg",
    );
  });

  it("refuses anything else", () => {
    expect(() => sniffAudio(Buffer.from("RIFF....WAVE"))).toThrow(
      UnsupportedMediaError,
    );
    expect(() =>
      sniffAudio(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    ).toThrow(UnsupportedMediaError);
  });
});
