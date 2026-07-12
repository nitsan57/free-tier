import type { PhotosMediaItem } from "@/lib/google/photos";
import type {
  AnalyzeOptions,
  DetectionCandidate,
  DetectionReason
} from "./types";
import { detectScreenshot } from "./screenshot";
import { detectSpamMetadata } from "./spam";
import {
  analyzeBytes,
  BLUR_VARIANCE_THRESHOLD,
  computePHash,
  hammingDistance,
  NEAR_DUPLICATE_HAMMING
} from "./image";

export * from "./types";
export { detectScreenshot } from "./screenshot";
export { detectSpamMetadata } from "./spam";
export {
  analyzeBytes,
  computePHash,
  hammingDistance,
  BLUR_VARIANCE_THRESHOLD,
  NEAR_DUPLICATE_HAMMING
} from "./image";

/** Backwards-compatible alias for the metadata-only spam heuristic. */
export const detectSpam = detectSpamMetadata;

/** Files at or below this many bytes are flagged as "very small". */
export const SMALL_FILE_BYTES = 30 * 1024;

function candidateScore(reasons: DetectionReason[]): number {
  return reasons.reduce((acc, r) => acc + (r.weight ?? 0), 0);
}

function toCandidate(
  item: PhotosMediaItem,
  type: DetectionCandidate["type"],
  reasons: DetectionReason[]
): DetectionCandidate {
  return { item, type, score: candidateScore(reasons), reasons };
}

/** Metadata-only detection. Cheap, no network/image decoding required. */
export function analyze(items: PhotosMediaItem[]): DetectionCandidate[] {
  const candidates: DetectionCandidate[] = [];

  for (const item of items) {
    const shotReasons = detectScreenshot(item);
    if (shotReasons.length > 0) {
      candidates.push(toCandidate(item, "screenshot", shotReasons));
    }

    const spamReasons = detectSpamMetadata(item);
    if (spamReasons.length > 0) {
      candidates.push(toCandidate(item, "spam", spamReasons));
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

interface ItemImageResult {
  item: PhotosMediaItem;
  blurScore: number | null;
  phash: string | null;
  byteLength: number | null;
}

async function withConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  signal?: AbortSignal
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < tasks.length) {
      if (signal?.aborted) return;
      const i = cursor++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

/**
 * Full detection: metadata heuristics plus content analysis (blur and
 * perceptual-hash near-duplicates). `fetchImage` supplies raw image bytes;
 * items it cannot fetch are detected on metadata alone.
 */
export async function analyzeWithContent(
  items: PhotosMediaItem[],
  options: AnalyzeOptions = {}
): Promise<DetectionCandidate[]> {
  const { fetchImage, concurrency = 4, signal } = options;

  const baseline = new Map<string, DetectionCandidate[]>();
  for (const item of items) {
    const list: DetectionCandidate[] = [];
    const shotReasons = detectScreenshot(item);
    if (shotReasons.length > 0) {
      list.push(toCandidate(item, "screenshot", shotReasons));
    }
    const spamReasons = detectSpamMetadata(item);
    if (spamReasons.length > 0) {
      list.push(toCandidate(item, "spam", spamReasons));
    }
    baseline.set(item.id, list);
  }

  const imageResults: ItemImageResult[] = items.map((item) => ({
    item,
    blurScore: null,
    phash: null,
    byteLength: null
  }));

  if (fetchImage) {
    const tasks = items.map((item, idx) => async () => {
      let bytes: Uint8Array | null = null;
      try {
        bytes = await fetchImage(item);
      } catch {
        bytes = null;
      }
      if (!bytes || bytes.byteLength === 0) return;
      imageResults[idx].byteLength = bytes.byteLength;
      const { blurScore, phash } = analyzeBytes(bytes, item.mimeType);
      imageResults[idx].blurScore = blurScore;
      imageResults[idx].phash = phash;
    });

    await withConcurrency(tasks, concurrency, signal);
  }

  for (const res of imageResults) {
    const reasons = baseline.get(res.item.id) ?? [];
    let spam = reasons.find((c) => c.type === "spam");
    if (!spam) {
      spam = toCandidate(res.item, "spam", []);
      reasons.push(spam);
      baseline.set(res.item.id, reasons);
    }

    if (res.blurScore !== null && res.blurScore <= BLUR_VARIANCE_THRESHOLD) {
      spam.reasons.push({
        code: "blur_low_variance",
        detail: `variance ${res.blurScore.toFixed(1)}`,
        weight: 0.4
      });
    }

    if (res.byteLength !== null && res.byteLength <= SMALL_FILE_BYTES) {
      spam.reasons.push({
        code: "small_file_bytes",
        detail: `${res.byteLength} bytes`,
        weight: 0.4
      });
    }
  }

  const hashes = imageResults.filter((r) => r.phash);
  for (let i = 0; i < hashes.length; i++) {
    let nearest: { dist: number; name: string } | null = null;
    for (let j = 0; j < hashes.length; j++) {
      if (i === j) continue;
      const dist = hammingDistance(hashes[i].phash!, hashes[j].phash!);
      if (dist <= NEAR_DUPLICATE_HAMMING) {
        if (!nearest || dist < nearest.dist) {
          nearest = { dist, name: hashes[j].item.filename };
        }
      }
    }
    if (nearest) {
      const spam = (baseline.get(hashes[i].item.id) ?? []).find(
        (c) => c.type === "spam"
      )!;
      spam.reasons.push({
        code: "near_duplicate",
        detail: `hamming ${nearest.dist} vs "${nearest.name}"`,
        weight: 0.6
      });
    }
  }

  const candidates: DetectionCandidate[] = [];
  for (const list of baseline.values()) {
    for (const c of list) {
      if (c.reasons.length === 0) continue;
      c.score = candidateScore(c.reasons);
      candidates.push(c);
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}
