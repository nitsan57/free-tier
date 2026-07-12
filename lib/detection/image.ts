import { PNG } from "pngjs";
import jpeg from "jpeg-js";

/** Grayscale luminance of a decoded image. */
export interface GrayImage {
  width: number;
  height: number;
  /** Length width*height, values 0..255. */
  data: Float32Array;
}

/** Variances below this are treated as "blurry". Heuristic, tune as needed. */
export const BLUR_VARIANCE_THRESHOLD = 100;

/** Near-duplicate pairs have a pHash Hamming distance at or below this. */
export const NEAR_DUPLICATE_HAMMING = 8;

interface RawRGBA {
  width: number;
  height: number;
  data: Uint8Array | Buffer;
}

function decodeRGBA(buffer: Uint8Array, mimeType: string): RawRGBA | null {
  const lower = mimeType.toLowerCase();
  try {
    if (lower === "image/png") {
      const png = PNG.sync.read(Buffer.from(buffer));
      return { width: png.width, height: png.height, data: png.data };
    }
    if (lower === "image/jpeg" || lower === "image/jpg") {
      const dec = jpeg.decode(Buffer.from(buffer), { useTArray: true });
      return { width: dec.width, height: dec.height, data: dec.data };
    }
  } catch {
    return null;
  }
  return null;
}

function toGray(rgba: RawRGBA): GrayImage {
  const { width, height, data } = rgba;
  const out = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    out[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { width, height, data: out };
}

/** Box-average downscale to at most (maxW x maxH), preserving aspect ratio. */
function downscale(
  img: GrayImage,
  maxW: number,
  maxH: number
): GrayImage {
  const { width, height, data } = img;
  const scale = Math.min(maxW / width, maxH / height, 1);
  const tw = Math.max(1, Math.round(width * scale));
  const th = Math.max(1, Math.round(height * scale));
  const out = new Float32Array(tw * th);

  for (let y = 0; y < th; y++) {
    const sy0 = Math.floor((y / th) * height);
    const sy1 = Math.max(sy0 + 1, Math.floor(((y + 1) / th) * height));
    for (let x = 0; x < tw; x++) {
      const sx0 = Math.floor((x / tw) * width);
      const sx1 = Math.max(sx0 + 1, Math.floor(((x + 1) / tw) * width));
      let sum = 0;
      let count = 0;
      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          sum += data[sy * width + sx];
          count++;
        }
      }
      out[y * tw + x] = sum / count;
    }
  }
  return { width: tw, height: th, data: out };
}

/** Variance of the Laplacian — a standard blur metric. Lower = blurrier. */
function varianceOfLaplacian(img: GrayImage): number {
  const { width, height, data } = img;
  if (width < 3 || height < 3) {
    return 0;
  }
  const lap = new Float64Array((width - 2) * (height - 2));
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const v =
        data[y * width + (x - 1)] +
        data[y * width + (x + 1)] +
        data[(y - 1) * width + x] +
        data[(y + 1) * width + x] -
        4 * data[y * width + x];
      lap[n++] = v;
    }
  }
  let mean = 0;
  for (let i = 0; i < n; i++) mean += lap[i];
  mean /= n;
  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = lap[i] - mean;
    varSum += d * d;
  }
  return varSum / n;
}

let DCT_COS: Float64Array | null = null;
const DCT_N = 32;

function dctCosTable(): Float64Array {
  if (DCT_COS) return DCT_COS;
  const t = new Float64Array(DCT_N * DCT_N);
  for (let i = 0; i < DCT_N; i++) {
    for (let j = 0; j < DCT_N; j++) {
      t[i * DCT_N + j] = Math.cos((Math.PI * i * (2 * j + 1)) / (2 * DCT_N));
    }
  }
  DCT_COS = t;
  return t;
}

/** 2D DCT-II of an n x n matrix (row-major). */
function dct2d(matrix: Float64Array, n: number): Float64Array {
  const cos = dctCosTable();
  const rows = new Float64Array(n * n);
  for (let u = 0; u < n; u++) {
    const cu = u === 0 ? Math.sqrt(1 / n) : Math.sqrt(2 / n);
    for (let x = 0; x < n; x++) {
      let sum = 0;
      for (let y = 0; y < n; y++) sum += matrix[y * n + x] * cos[u * n + y];
      rows[u * n + x] = cu * sum;
    }
  }
  const out = new Float64Array(n * n);
  for (let v = 0; v < n; v++) {
    const cv = v === 0 ? Math.sqrt(1 / n) : Math.sqrt(2 / n);
    for (let x = 0; x < n; x++) {
      let sum = 0;
      for (let u = 0; u < n; u++) sum += rows[u * n + x] * cos[v * n + u];
      out[v * n + x] = cv * sum;
    }
  }
  return out;
}

/**
 * Compute a 64-bit perceptual hash (DCT-based, pHash) as a 16-char hex string.
 * The DC coefficient (0,0) is excluded from the comparison set.
 */
export function computePHash(gray: Float32Array, width: number, height: number): string {
  const small = downscale({ width, height, data: gray }, DCT_N, DCT_N);
  const dct = dct2d(Float64Array.from(small.data), DCT_N);

  const coeffs: number[] = [];
  for (let v = 0; v < 8; v++) {
    for (let u = 0; u < 8; u++) {
      if (u === 0 && v === 0) continue;
      coeffs.push(dct[v * DCT_N + u]);
    }
  }

  const sorted = [...coeffs].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  let bits = 0n;
  let bit = 63n;
  for (let v = 0; v < 8; v++) {
    for (let u = 0; u < 8; u++) {
      if (u === 0 && v === 0) {
        bit -= 1n;
        continue;
      }
      if (dct[v * DCT_N + u] > median) bits |= 1n << bit;
      bit -= 1n;
    }
  }
  return bits.toString(16).padStart(16, "0");
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16);
    const y = parseInt(b[i], 16);
    let xor = x ^ y;
    while (xor) {
      dist += xor & 1;
      xor >>= 1;
    }
  }
  return dist;
}

/** Decode image bytes into grayscale, or null if unsupported/undecodable. */
export function decodeToGray(
  buffer: Uint8Array,
  mimeType: string
): GrayImage | null {
  const rgba = decodeRGBA(buffer, mimeType);
  if (!rgba) return null;
  return toGray(rgba);
}

/** Convenience: blur score + pHash for raw bytes. */
export function analyzeBytes(
  buffer: Uint8Array,
  mimeType: string
): { blurScore: number | null; phash: string | null; decoded: boolean } {
  const gray = decodeToGray(buffer, mimeType);
  if (!gray) {
    return { blurScore: null, phash: null, decoded: false };
  }
  const blurGray = downscale(gray, 200, 200);
  const blurScore = varianceOfLaplacian(blurGray);
  const phash = computePHash(gray.data, gray.width, gray.height);
  return { blurScore, phash, decoded: true };
}
