import type { Quad } from "../detection/types";

export function parseHexColor(value: string): [number, number, number] {
  const clean = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "111111";
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

export const AUTO_FILL_FALLBACK: [number, number, number] = [255, 255, 255];

/**
 * Finds the dominant colour inside the corrected slide, deliberately skipping
 * its edge so a projector bezel or photographed screen border is not used.
 */
export function resolveFillColor(value: string, content: ImageData) {
  if (value !== "auto") return parseHexColor(value);
  const inset = 0.12;
  const left = content.width * inset;
  const right = content.width * (1 - inset);
  const top = content.height * inset;
  const bottom = content.height * (1 - inset);
  const samples: [number, number, number][] = [];

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      const x = left + (right - left) * ((column + 0.5) / 12);
      const y = top + (bottom - top) * ((row + 0.5) / 8);
      const offset = (
        Math.min(content.height - 1, Math.max(0, Math.round(y))) * content.width
        + Math.min(content.width - 1, Math.max(0, Math.round(x)))
      ) * 4;
      samples.push([content.data[offset], content.data[offset + 1], content.data[offset + 2]]);
    }
  }

  const buckets = new Map<string, [number, number, number][]>();
  for (const sample of samples) {
    const key = sample.map((value) => Math.floor(value / 32)).join(":");
    buckets.set(key, [...(buckets.get(key) ?? []), sample]);
  }
  const dominant = [...buckets.values()].reduce((largest, bucket) => bucket.length > largest.length ? bucket : largest, [] as [number, number, number][]);
  if (dominant.length < samples.length * 0.14) return AUTO_FILL_FALLBACK;
  return [0, 1, 2].map((channel) => medianValue(dominant.map((sample) => sample[channel]))) as [number, number, number];
}

export function contentPixelBounds(target: Quad) {
  const x = Math.ceil(target[0][0]);
  const y = Math.ceil(target[0][1]);
  return {
    x,
    y,
    width: Math.max(1, Math.ceil(target[1][0]) - x),
    height: Math.max(1, Math.ceil(target[3][1]) - y),
  };
}

export function extractContent(page: ImageData, bounds: ReturnType<typeof contentPixelBounds>) {
  const content = new ImageData(bounds.width, bounds.height);
  for (let y = 0; y < bounds.height; y += 1) {
    const sourceStart = ((bounds.y + y) * page.width + bounds.x) * 4;
    const targetStart = y * bounds.width * 4;
    content.data.set(page.data.subarray(sourceStart, sourceStart + bounds.width * 4), targetStart);
  }
  return content;
}

export function fillAndBlitContent(
  page: ImageData,
  content: ImageData,
  bounds: ReturnType<typeof contentPixelBounds>,
  fill: [number, number, number],
  provisionalFill?: [number, number, number],
) {
  for (let offset = 0; offset < page.data.length; offset += 4) {
    page.data[offset] = fill[0];
    page.data[offset + 1] = fill[1];
    page.data[offset + 2] = fill[2];
    page.data[offset + 3] = 255;
  }
  for (let y = 0; y < bounds.height; y += 1) {
    const sourceStart = y * bounds.width * 4;
    const targetStart = ((bounds.y + y) * page.width + bounds.x) * 4;
    for (let x = 0; x < bounds.width; x += 1) {
      const sOff = sourceStart + x * 4;
      const tOff = targetStart + x * 4;
      const r = content.data[sOff];
      const g = content.data[sOff + 1];
      const b = content.data[sOff + 2];
      if (
        provisionalFill &&
        r === provisionalFill[0] &&
        g === provisionalFill[1] &&
        b === provisionalFill[2]
      ) {
        page.data[tOff] = fill[0];
        page.data[tOff + 1] = fill[1];
        page.data[tOff + 2] = fill[2];
        page.data[tOff + 3] = 255;
      } else {
        page.data[tOff] = r;
        page.data[tOff + 1] = g;
        page.data[tOff + 2] = b;
        page.data[tOff + 3] = 255;
      }
    }
  }
}

export function sampleBlurredEdgeRgb(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number = 3,
): [number, number, number] {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  const icx = Math.round(cx);
  const icy = Math.round(cy);
  const r = Math.min(14, Math.max(1, Math.round(radius)));
  const step = r > 8 ? 2 : 1;

  for (let dy = -r; dy <= r; dy += step) {
    for (let dx = -r; dx <= r; dx += step) {
      const px = Math.max(0, Math.min(width - 1, icx + dx));
      const py = Math.max(0, Math.min(height - 1, icy + dy));
      const offset = (py * width + px) * 4;
      rSum += data[offset];
      gSum += data[offset + 1];
      bSum += data[offset + 2];
      count += 1;
    }
  }

  return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
}

export function medianValue(values: number[]) {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)];
}

export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cannot render thumbnail for this image."));
    image.src = url;
  });
}
