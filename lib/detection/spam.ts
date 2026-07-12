import type { PhotosMediaItem } from "@/lib/google/photos";
import type { DetectionReason } from "./types";

/** Markers that an image was received/shared rather than captured. */
const RECEIVED_MARKERS = [
  "wa_img",      // WhatsApp
  "whatsapp",
  "img-",        // WhatsApp / generic
  "received",
  "forwarded",
  "download",
  "shared",
  "fb_img"       // Facebook
];

/** Markers strongly associated with memes / viral images. */
const MEME_MARKERS = [
  "meme",
  "snapchat",
  "instagram",
  "tiktok",
  "image_20",    // common download prefix
  "img_20"
];

const MAX_SMALL_DIMENSION = 240;
const MIN_SMALL_AREA = 240 * 240;

/**
 * "Very small file" proxy using dimensions. The Photos API does not expose
 * byte size in the media item metadata, so we use the decoded pixel
 * dimensions as a proxy. When byte length is available (see image analysis)
 * it is used as a stronger signal.
 */
function smallDimensionReasons(
  item: PhotosMediaItem
): DetectionReason[] {
  const reasons: DetectionReason[] = [];
  const w = item.mediaMetadata.width ? Number(item.mediaMetadata.width) : NaN;
  const h = item.mediaMetadata.height
    ? Number(item.mediaMetadata.height)
    : NaN;

  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return reasons;
  }

  const maxDim = Math.max(w, h);
  const area = w * h;

  if (maxDim <= MAX_SMALL_DIMENSION || area <= MIN_SMALL_AREA) {
    reasons.push({
      code: "small_dimensions",
      detail: `${w}x${h}`,
      weight: 0.4
    });
  }

  return reasons;
}

function filenameMarkerReasons(
  item: PhotosMediaItem
): DetectionReason[] {
  const reasons: DetectionReason[] = [];
  const name = (item.filename || "").toLowerCase();

  if (MEME_MARKERS.some((m) => name.includes(m))) {
    reasons.push({
      code: "meme_marker",
      detail: item.filename,
      weight: 0.5
    });
  }

  if (RECEIVED_MARKERS.some((m) => name.includes(m))) {
    reasons.push({
      code: "received_marker",
      detail: item.filename,
      weight: 0.5
    });
  }

  return reasons;
}

/** Metadata-only spam heuristics (no pixel inspection). */
export function detectSpamMetadata(
  item: PhotosMediaItem
): DetectionReason[] {
  return [
    ...smallDimensionReasons(item),
    ...filenameMarkerReasons(item)
  ];
}
