import type { PhotosMediaItem } from "@/lib/google/photos";
import type { DetectionReason } from "./types";

/** Common device screen resolutions (phones, tablets, monitors). */
const SCREENSHOT_DIMENSIONS: ReadonlySet<string> = new Set([
  // Phones (portrait + landscape)
  "1080x1920", "1080x2340", "1080x2400", "1170x2532", "1125x2436",
  "1242x2688", "828x1792", "750x1334", "720x1280", "1440x2560",
  "1080x2280", "1080x2408", "1080x2636", "1224x2778", "1290x2796",
  "1920x1080", "2340x1080", "2400x1080", "2532x1170", "2436x1125",
  "2688x1242", "1792x828", "1334x750", "1280x720", "2560x1440",
  // Tablets / desktop
  "2048x2732", "2732x2048", "1668x2388", "2388x1668", "1640x2360",
  "1366x768", "1440x900", "1536x864", "2560x1440", "1920x1080",
  "2560x1600", "2880x1800", "3024x1964", "3840x2160"
]);

const FILENAME_PATTERN =
  /(screenshot|screen-|snap-?shot|screencapture|screengrab|capture)/i;

/** Tall aspect ratios typical of phone screenshots. */
const SCREENSHOT_MIN_ASPECT = 1.6;

function num(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function detectScreenshot(item: PhotosMediaItem): DetectionReason[] {
  const reasons: DetectionReason[] = [];
  const name = (item.filename || "").toLowerCase();
  const width = num(item.mediaMetadata.width);
  const height = num(item.mediaMetadata.height);

  if (item.mimeType === "image/png") {
    reasons.push({
      code: "mime_png",
      detail: item.mimeType,
      weight: 0.3
    });
  }

  if (FILENAME_PATTERN.test(name)) {
    reasons.push({
      code: "filename_pattern",
      detail: item.filename,
      weight: 0.5
    });
  }

  const category = item.mediaMetadata.photo?.category ?? [];
  if (category.includes("SCREENSHOT")) {
    reasons.push({
      code: "photo_category_screenshot",
      detail: "SCREENSHOT",
      weight: 1.0
    });
  }

  if (width && height) {
    const key = `${width}x${height}`;
    if (SCREENSHOT_DIMENSIONS.has(key)) {
      reasons.push({
        code: "screenshot_dimensions",
        detail: key,
        weight: 0.45
      });
    }

    const aspect = Math.max(width, height) / Math.min(width, height);
    if (aspect >= SCREENSHOT_MIN_ASPECT && width >= 320 && height >= 320) {
      reasons.push({
        code: "aspect_ratio_screenshot",
        detail: `aspect ${aspect.toFixed(2)}:1`,
        weight: 0.2
      });
    }
  }

  return reasons;
}
