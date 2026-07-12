import type { PhotosMediaItem } from "@/lib/google/photos";

export type CandidateType = "screenshot" | "spam";

export interface DetectionReason {
  code: string;
  detail?: string;
  /** Confidence contribution of this reason to the candidate score. */
  weight: number;
}

export interface DetectionCandidate {
  item: PhotosMediaItem;
  type: CandidateType;
  /** Weighted sum of the matched reasons' weights (higher = more confident). */
  score: number;
  reasons: DetectionReason[];
}

/**
 * Result of analysing the *pixels* of a media item (when bytes are available).
 * Everything here is optional because decoding may fail for unsupported
 * formats (e.g. HEIC) or when the caller does not supply image bytes.
 */
export interface ImageAnalysis {
  /** True when the bytes were decoded into pixels. */
  decoded: boolean;
  /** 64-bit perceptual hash as a 16-char hex string (null if not computed). */
  phash: string | null;
  /** Variance of the Laplacian — lower values mean blurrier images. */
  blurScore: number | null;
  /** Raw byte length of the fetched image, when known. */
  byteLength: number | null;
}

export interface AnalyzeOptions {
  /**
   * Fetches the raw image bytes for a media item. When omitted, detection
   * falls back to purely metadata-based heuristics (no blur / pHash signals).
   * Return `null` to skip content analysis for an item.
   */
  fetchImage?: (item: PhotosMediaItem) => Promise<Uint8Array | null>;
  /** Max concurrent image fetches. Defaults to 4. */
  concurrency?: number;
  /** Abort signal for the in-flight content analysis. */
  signal?: AbortSignal;
}
