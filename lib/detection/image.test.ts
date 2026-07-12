import { describe, expect, it } from "vitest";
import {
  analyzeBytes,
  BLUR_VARIANCE_THRESHOLD,
  computePHash,
  decodeToGray,
  hammingDistance,
  NEAR_DUPLICATE_HAMMING
} from "./image";
import { blurryFill, makePng, sharpFill } from "./test-helpers";

function circle(x: number, y: number): [number, number, number] {
  const dx = x - 32;
  const dy = y - 32;
  const inside = dx * dx + dy * dy < 400;
  return inside ? [255, 0, 0] : [0, 0, 0];
}

function different(x: number, y: number): [number, number, number] {
  return (x + y) % 16 < 8 ? [0, 255, 0] : [0, 0, 255];
}

describe("analyzeBytes", () => {
  it("decodes PNG and reports a perceptual hash", () => {
    const buf = makePng(64, 64, circle);
    const res = analyzeBytes(buf, "image/png");
    expect(res.decoded).toBe(true);
    expect(res.phash).toMatch(/^[0-9a-f]{16}$/);
    expect(res.blurScore).not.toBeNull();
  });

  it("returns decoded=false for unsupported mime types", () => {
    const buf = makePng(16, 16, (x) => [x, x, x]);
    const res = analyzeBytes(buf, "image/heic");
    expect(res.decoded).toBe(false);
    expect(res.phash).toBeNull();
  });

  it("reports lower blur variance for smooth images than sharp ones", () => {
    const sharp = analyzeBytes(makePng(128, 128, (x) => sharpFill(x)), "image/png");
    const blurry = analyzeBytes(makePng(128, 128, blurryFill), "image/png");
    expect(blurry.blurScore!).toBeLessThan(sharp.blurScore!);
    expect(blurry.blurScore!).toBeLessThanOrEqual(BLUR_VARIANCE_THRESHOLD);
  });
});

describe("perceptual hash", () => {
  it("is identical for exact duplicates", () => {
    const a = makePng(64, 64, circle);
    const b = makePng(64, 64, circle);
    expect(computePHash(...grayOf(a))).toBe(computePHash(...grayOf(b)));
  });

  it("is near-identical for a 1px-shifted image", () => {
    const a = makePng(64, 64, circle);
    const b = makePng(64, 64, (x, y) => circle(x - 1, y));
    const dist = hammingDistance(computePHash(...grayOf(a)), computePHash(...grayOf(b)));
    expect(dist).toBeLessThanOrEqual(NEAR_DUPLICATE_HAMMING);
  });

  it("differs strongly for unrelated images", () => {
    const a = makePng(64, 64, circle);
    const c = makePng(64, 64, different);
    const dist = hammingDistance(computePHash(...grayOf(a)), computePHash(...grayOf(c)));
    expect(dist).toBeGreaterThan(NEAR_DUPLICATE_HAMMING);
  });
});

// Helper: decode a PNG buffer to the (gray, w, h) args computePHash expects.
function grayOf(buf: Buffer): [Float32Array, number, number] {
  const g = decodeToGray(buf, "image/png")!;
  return [g.data, g.width, g.height];
}
