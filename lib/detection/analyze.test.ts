import { describe, expect, it } from "vitest";
import { analyzeWithContent } from "./index";
import { blurryFill, makeItem, makePng } from "./test-helpers";

describe("analyzeWithContent", () => {
  it("flags near-duplicates using perceptual hashing", async () => {
    const a = makeItem({ id: "a", mimeType: "image/png" });
    const b = makeItem({ id: "b", mimeType: "image/png" });
    const buf = makePng(64, 64, (x, y) => ((x + y) % 2 ? [255, 0, 0] : [0, 0, 255]));

    const candidates = await analyzeWithContent([a, b], {
      fetchImage: async () => buf
    });

    const spamA = candidates.find((c) => c.item.id === "a" && c.type === "spam");
    const spamB = candidates.find((c) => c.item.id === "b" && c.type === "spam");
    expect(spamA?.reasons.find((r) => r.code === "near_duplicate")).toBeDefined();
    expect(spamB?.reasons.find((r) => r.code === "near_duplicate")).toBeDefined();
  });

  it("flags blurry images with a low-variance reason", async () => {
    const item = makeItem({ id: "blur", mimeType: "image/png" });
    const buf = makePng(128, 128, blurryFill);

    const candidates = await analyzeWithContent([item], {
      fetchImage: async () => buf
    });

    const spam = candidates.find((c) => c.item.id === "blur" && c.type === "spam");
    expect(spam?.reasons.find((r) => r.code === "blur_low_variance")).toBeDefined();
  });

  it("flags tiny byte sizes with small_file_bytes", async () => {
    const item = makeItem({ id: "tiny", mimeType: "image/png" });
    const buf = makePng(8, 8, (x) => [x * 10, 0, 0]);

    const candidates = await analyzeWithContent([item], {
      fetchImage: async () => buf
    });

    const spam = candidates.find((c) => c.item.id === "tiny" && c.type === "spam");
    expect(spam?.reasons.find((r) => r.code === "small_file_bytes")).toBeDefined();
  });

  it("adds content reasons to existing metadata spam candidates", async () => {
    const item = makeItem({
      id: "both",
      mimeType: "image/png",
      filename: "WA_img_small.jpg",
      mediaMetadata: { width: "120", height: "120" }
    });
    const buf = makePng(8, 8, blurryFill);

    const candidates = await analyzeWithContent([item], {
      fetchImage: async () => buf
    });

    const spam = candidates.find((c) => c.item.id === "both" && c.type === "spam");
    const codes = spam?.reasons.map((r) => r.code) ?? [];
    expect(codes).toEqual(
      expect.arrayContaining([
        "received_marker",
        "small_dimensions",
        "blur_low_variance",
        "small_file_bytes"
      ])
    );
  });

  it("falls back to metadata-only when fetchImage is omitted", async () => {
    const item = makeItem({
      id: "meta",
      filename: "Screenshot_2023.png",
      mimeType: "image/png",
      mediaMetadata: { width: "1080", height: "1920" }
    });
    const candidates = await analyzeWithContent([item]);
    expect(candidates.find((c) => c.type === "screenshot")).toBeDefined();
    expect(candidates.find((c) => c.type === "spam")).toBeUndefined();
  });

  it("skips items whose image cannot be fetched", async () => {
    const sharp = makeItem({ id: "sharp", mimeType: "image/png" });
    const candidates = await analyzeWithContent([sharp], {
      fetchImage: async () => null
    });
    const spam = candidates.find((c) => c.item.id === "sharp" && c.type === "spam");
    expect(spam?.reasons.find((r) => r.code === "blur_low_variance")).toBeUndefined();
  });
});
