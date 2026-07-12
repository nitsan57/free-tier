import { PNG } from "pngjs";
import type { PhotosMediaItem } from "@/lib/google/photos";

/** Build a PNG buffer from a per-pixel colour callback. */
export function makePng(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number]
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const [r, g, b] = fill(x, y);
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

export function makeItem(
  overrides: Partial<PhotosMediaItem> = {}
): PhotosMediaItem {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    filename: overrides.filename ?? "photo.jpg",
    mimeType: overrides.mimeType ?? "image/jpeg",
    baseUrl: overrides.baseUrl ?? "",
    productUrl: overrides.productUrl ?? "",
    mediaMetadata: overrides.mediaMetadata ?? {}
  };
}

/** High-frequency vertical stripes → sharp image. */
export const sharpFill = (x: number): [number, number, number] =>
  x % 8 < 4 ? [255, 255, 255] : [0, 0, 0];

/** Smooth radial gradient → blurry image. */
export const blurryFill = (x: number, y: number): [number, number, number] => {
  const v = Math.round(128 + 80 * Math.sin(x / 40) * Math.cos(y / 40));
  return [v, v, v];
};
