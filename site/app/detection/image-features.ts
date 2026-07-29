import type { ImageDataLike, ImageFeatures } from "./types.ts";

export function buildImageFeatures(imageData: ImageDataLike): ImageFeatures {
  const length = imageData.width * imageData.height;
  const gray = new Float64Array(length);
  const saturation = new Float64Array(length);
  for (let source = 0, target = 0; source < imageData.data.length; source += 4, target += 1) {
    const red = imageData.data[source];
    const green = imageData.data[source + 1];
    const blue = imageData.data[source + 2];
    gray[target] = red * 0.299 + green * 0.587 + blue * 0.114;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    saturation[target] = maximum > 1 ? (maximum - minimum) * 255 / maximum : 0;
  }
  return {
    width: imageData.width,
    height: imageData.height,
    rgb: imageData.data,
    gray: boxBlur(gray, imageData.width, imageData.height, 2),
    saturation,
  };
}

export function boxBlur(values: Float64Array, width: number, height: number, radius: number): Float64Array {
  let source = values;
  let target = new Float64Array(values.length);
  const windowSize = radius * 2 + 1;
  for (let y = 0; y < height; y += 1) {
    let sum = 0;
    for (let x = -radius; x <= radius; x += 1) sum += source[y * width + clamp(x, 0, width - 1)];
    for (let x = 0; x < width; x += 1) {
      target[y * width + x] = sum / windowSize;
      sum -= source[y * width + clamp(x - radius, 0, width - 1)];
      sum += source[y * width + clamp(x + radius + 1, 0, width - 1)];
    }
  }
  source = target;
  target = new Float64Array(values.length);
  for (let x = 0; x < width; x += 1) {
    let sum = 0;
    for (let y = -radius; y <= radius; y += 1) sum += source[clamp(y, 0, height - 1) * width + x];
    for (let y = 0; y < height; y += 1) {
      target[y * width + x] = sum / windowSize;
      sum -= source[clamp(y - radius, 0, height - 1) * width + x];
      sum += source[clamp(y + radius + 1, 0, height - 1) * width + x];
    }
  }
  return target;
}

export function sampleGray(features: ImageFeatures, x: number, y: number): number {
  const xi = clamp(Math.round(x), 0, features.width - 1);
  const yi = clamp(Math.round(y), 0, features.height - 1);
  return features.gray[yi * features.width + xi];
}

export function percentile(values: ArrayLike<number>, fraction: number): number {
  const ordered = Array.from(values).sort((a, b) => a - b);
  if (!ordered.length) return 0;
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.floor((ordered.length - 1) * fraction)))];
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
