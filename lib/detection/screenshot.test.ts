import { describe, expect, it } from "vitest";
import type { PhotosMediaItem } from "@/lib/google/photos";
import { analyze, detectScreenshot } from "./index";
import { makeItem } from "./test-helpers";

describe("detectScreenshot", () => {
  it("flags PNG mime type", () => {
    const r = detectScreenshot(makeItem({ mimeType: "image/png" }));
    expect(r.find((x) => x.code === "mime_png")).toBeDefined();
  });

  it("flags screenshot filename patterns", () => {
    const r = detectScreenshot(makeItem({ filename: "Screenshot_2023-01-01.png" }));
    expect(r.find((x) => x.code === "filename_pattern")).toBeDefined();
  });

  it("flags screen- and snap- patterns case-insensitively", () => {
    const r = detectScreenshot(makeItem({ filename: "SCREEN-2023.png" }));
    expect(r.find((x) => x.code === "filename_pattern")).toBeDefined();
  });

  it("flags the SCREENSHOT photo category", () => {
    const item = makeItem({
      mediaMetadata: { photo: { category: ["SCREENSHOT"] } }
    });
    const r = detectScreenshot(item);
    expect(r.find((x) => x.code === "photo_category_screenshot")).toBeDefined();
  });

  it("flags known device screenshot dimensions", () => {
    const item = makeItem({ mediaMetadata: { width: "1080", height: "1920" } });
    const r = detectScreenshot(item);
    expect(r.find((x) => x.code === "screenshot_dimensions")).toBeDefined();
  });

  it("flags tall aspect ratios as a weak clue", () => {
    const item = makeItem({ mediaMetadata: { width: "720", height: "1280" } });
    const r = detectScreenshot(item);
    expect(r.find((x) => x.code === "aspect_ratio_screenshot")).toBeDefined();
  });

  it("returns no reasons for an ordinary photo", () => {
    const item: PhotosMediaItem = makeItem({
      filename: "IMG_1234.JPG",
      mimeType: "image/jpeg",
      mediaMetadata: { width: "4032", height: "3024" }
    });
    expect(detectScreenshot(item)).toHaveLength(0);
  });
});

describe("analyze (screenshots)", () => {
  it("produces a scored screenshot candidate", () => {
    const item = makeItem({
      filename: "Screenshot_2023.png",
      mimeType: "image/png",
      mediaMetadata: { width: "1080", height: "1920", photo: { category: ["SCREENSHOT"] } }
    });
    const [cand] = analyze([item]);
    expect(cand.type).toBe("screenshot");
    expect(cand.score).toBeGreaterThan(0);
    expect(cand.reasons.map((r) => r.code).sort()).toEqual(
      [
        "aspect_ratio_screenshot",
        "filename_pattern",
        "mime_png",
        "photo_category_screenshot",
        "screenshot_dimensions"
      ].sort()
    );
  });
});
