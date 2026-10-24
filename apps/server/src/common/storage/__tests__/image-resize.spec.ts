import { describe, expect, it } from "vitest";
import { jpegOrientation } from "../image-resize";

/** A JPEG start with one EXIF APP1 segment holding `orientation`. */
function jpegWith(orientation: number, littleEndian = false): Buffer {
  const u16 = (n: number) => {
    const b = Buffer.alloc(2);
    if (littleEndian) b.writeUInt16LE(n);
    else b.writeUInt16BE(n);
    return b;
  };
  const u32 = (n: number) => {
    const b = Buffer.alloc(4);
    if (littleEndian) b.writeUInt32LE(n);
    else b.writeUInt32BE(n);
    return b;
  };
  const tiff = Buffer.concat([
    Buffer.from(littleEndian ? "II" : "MM"),
    u16(42),
    u32(8),
    u16(1),
    u16(0x0112),
    u16(3),
    u32(1),
    u16(orientation),
    u16(0),
    u32(0),
  ]);
  const app1 = Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(app1.length + 2);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe1]),
    len,
    app1,
    Buffer.from([0xff, 0xda, 0, 2]),
  ]);
}

describe("jpegOrientation", () => {
  it("reads the EXIF orientation (big and little endian)", () => {
    expect(jpegOrientation(jpegWith(6))).toBe(6);
    expect(jpegOrientation(jpegWith(8, true))).toBe(8);
  });

  it("is 1 without EXIF or for other formats", () => {
    expect(jpegOrientation(Buffer.from([0xff, 0xd8, 0xff, 0xda, 0, 2]))).toBe(
      1,
    );
    expect(jpegOrientation(Buffer.from("\x89PNG\r\n\x1a\n"))).toBe(1);
  });
});
