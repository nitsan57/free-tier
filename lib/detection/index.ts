import type { PhotosMediaItem } from "@/lib/google/photos";

export type CandidateType = "screenshot" | "spam";

export interface DetectionReason {
  code: string;
  detail?: string;
}

export interface DetectionCandidate {
  item: PhotosMediaItem;
  type: CandidateType;
  score: number;
  reasons: DetectionReason[];
}

export function detectScreenshot(item: PhotosMediaItem): DetectionReason[] {
  const reasons: DetectionReason[] = [];
  const name = item.filename.toLowerCase();

  if (item.mimeType === "image/png") {
    reasons.push({ code: "mime_png", detail: item.mimeType });
  }
  if (/(screenshot|screen-|snap-?shot|screencapture)/.test(name)) {
    reasons.push({ code: "filename_pattern", detail: item.filename });
  }
  const category = item.mediaMetadata.photo?.category ?? [];
  if (category.includes("SCREENSHOT")) {
    reasons.push({ code: "photo_category", detail: "SCREENSHOT" });
  }
  return reasons;
}

export function detectSpam(item: PhotosMediaItem): DetectionReason[] {
  const reasons: DetectionReason[] = [];
  return reasons;
}

export function analyze(items: PhotosMediaItem[]): DetectionCandidate[] {
  const candidates: DetectionCandidate[] = [];

  for (const item of items) {
    const shotReasons = detectScreenshot(item);
    if (shotReasons.length > 0) {
      candidates.push({
        item,
        type: "screenshot",
        score: shotReasons.length,
        reasons: shotReasons
      });
    }
    const spamReasons = detectSpam(item);
    if (spamReasons.length > 0) {
      candidates.push({
        item,
        type: "spam",
        score: spamReasons.length,
        reasons: spamReasons
      });
    }
  }

  return candidates;
}
