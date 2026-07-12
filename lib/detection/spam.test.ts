import { describe, expect, it } from "vitest";
import { analyze, detectSpamMetadata } from "./index";
import { makeItem } from "./test-helpers";

describe("detectSpamMetadata", () => {
  it("flags very small dimensions", () => {
    const item = makeItem({ mediaMetadata: { width: "100", height: "100" } });
    const r = detectSpamMetadata(item);
    expect(r.find((x) => x.code === "small_dimensions")).toBeDefined();
  });

  it("does not flag reasonably sized photos", () => {
    const item = makeItem({ mediaMetadata: { width: "4032", height: "3024" } });
    expect(detectSpamMetadata(item)).toHaveLength(0);
  });

  it("flags meme filename markers", () => {
    const r = detectSpamMetadata(makeItem({ filename: "dank_meme_42.png" }));
    expect(r.find((x) => x.code === "meme_marker")).toBeDefined();
  });

  it("flags received-image markers (WhatsApp)", () => {
    const r = detectSpamMetadata(makeItem({ filename: "WA_img1234.jpg" }));
    expect(r.find((x) => x.code === "received_marker")).toBeDefined();
  });

  it("flags forwarded/received markers", () => {
    const r = detectSpamMetadata(makeItem({ filename: "received_2023.jpg" }));
    expect(r.find((x) => x.code === "received_marker")).toBeDefined();
  });
});

describe("analyze (spam metadata)", () => {
  it("produces a scored spam candidate with reasons", () => {
    const item = makeItem({
      filename: "WA_img_small.jpg",
      mediaMetadata: { width: "120", height: "120" }
    });
    const spam = analyze([item]).find((c) => c.type === "spam");
    expect(spam).toBeDefined();
    expect(spam!.score).toBeGreaterThan(0);
    expect(spam!.reasons.map((r) => r.code)).toEqual(
      expect.arrayContaining(["received_marker", "small_dimensions"])
    );
  });
});
