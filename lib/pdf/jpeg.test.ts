import { describe, expect, it } from "vitest";
import { readJpegInfo } from "./jpeg";

/** Build a tiny JPEG: SOI + APP0 + SOFn(components) + EOI. */
function jpeg(components: number, width = 80, height = 64): Uint8Array {
  const sof = [
    0xff, 0xc0, // SOF0
    0x00, 8 + components * 3, // length = 2 + 1(prec) + 2(h) + 2(w) + 1(Nf) + 3*Nf
    0x08, // precision
    (height >> 8) & 0xff, height & 0xff,
    (width >> 8) & 0xff, width & 0xff,
    components,
  ];
  for (let c = 0; c < components; c++) sof.push(c + 1, 0x11, 0x00); // id, sampling, qtable
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, // APP0 with length 4 (2 bytes payload)
    ...sof,
    0xff, 0xd9, // EOI
  ]);
}

describe("readJpegInfo", () => {
  it("reads dimensions and component count for a 3-component (RGB/YCbCr) JPEG", () => {
    expect(readJpegInfo(jpeg(3, 80, 64))).toEqual({ components: 3, width: 80, height: 64 });
  });

  it("reads a 1-component (grayscale) JPEG", () => {
    expect(readJpegInfo(jpeg(1))?.components).toBe(1);
  });

  it("flags 4-component (CMYK) JPEGs so the caller can skip them", () => {
    expect(readJpegInfo(jpeg(4))?.components).toBe(4);
  });

  it("returns null for non-JPEG data", () => {
    expect(readJpegInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(readJpegInfo(new Uint8Array([]))).toBeNull();
  });
});
