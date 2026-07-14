export type EnhancementMode = "original" | "clean" | "high-contrast" | "bw";

export const enhancementModes: EnhancementMode[] = ["original", "clean", "high-contrast", "bw"];

/** Stats use the centered 80% box so edge fill / wall content does not skew correction. */
const STATS_INSET = 0.1;

export function applyEnhancement(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mode: EnhancementMode,
): void {
  if (mode === "original") return;

  grayWorldBalance(data, width, height);

  if (mode === "bw") {
    toGrayscale(data);
    stretchLuminance(data, width, height, 0.02, 0.98);
    adjustContrastAroundMid(data, 1.28);
    unsharpMask(data, width, height, 0.45);
    return;
  }

  if (mode === "clean") {
    adjustContrastAroundMid(data, 1.12);
    unsharpMask(data, width, height, 0.35);
    return;
  }

  // high-contrast
  stretchLuminance(data, width, height, 0.015, 0.985);
  adjustContrastAroundMid(data, 1.3);
  adjustSaturation(data, 0.9);
  unsharpMask(data, width, height, 0.5);
}

function statsBounds(width: number, height: number) {
  const x0 = Math.floor(width * STATS_INSET);
  const y0 = Math.floor(height * STATS_INSET);
  const x1 = Math.max(x0 + 1, Math.ceil(width * (1 - STATS_INSET)));
  const y1 = Math.max(y0 + 1, Math.ceil(height * (1 - STATS_INSET)));
  return { x0, y0, x1, y1 };
}

function grayWorldBalance(data: Uint8ClampedArray, width: number, height: number) {
  const { x0, y0, x1, y1 } = statsBounds(width, height);
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let pixels = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      sumR += data[i];
      sumG += data[i + 1];
      sumB += data[i + 2];
      pixels += 1;
    }
  }
  if (pixels === 0) return;
  const meanR = sumR / pixels;
  const meanG = sumG / pixels;
  const meanB = sumB / pixels;
  const target = (meanR + meanG + meanB) / 3;
  const scaleR = target / Math.max(meanR, 1);
  const scaleG = target / Math.max(meanG, 1);
  const scaleB = target / Math.max(meanB, 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] * scaleR);
    data[i + 1] = clamp(data[i + 1] * scaleG);
    data[i + 2] = clamp(data[i + 2] * scaleB);
  }
}

function toGrayscale(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
}

function stretchLuminance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  lowPct: number,
  highPct: number,
) {
  const { x0, y0, x1, y1 } = statsBounds(width, height);
  const samples: number[] = [];
  const regionPixels = Math.max(1, (x1 - x0) * (y1 - y0));
  const stride = Math.max(1, Math.floor(Math.sqrt(regionPixels / 80_000)));
  for (let y = y0; y < y1; y += stride) {
    for (let x = x0; x < x1; x += stride) {
      const i = (y * width + x) * 4;
      samples.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
  }
  if (!samples.length) return;
  samples.sort((a, b) => a - b);
  const low = samples[Math.max(0, Math.floor(samples.length * lowPct))] ?? 0;
  const high = samples[Math.min(samples.length - 1, Math.floor(samples.length * highPct))] ?? 255;
  const range = Math.max(8, high - low);
  for (let i = 0; i < data.length; i += 4) {
    const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const mapped = ((luma - low) / range) * 255;
    const factor = luma > 1e-3 ? mapped / luma : 1;
    data[i] = clamp(data[i] * factor);
    data[i + 1] = clamp(data[i + 1] * factor);
    data[i + 2] = clamp(data[i + 2] * factor);
  }
}

function adjustContrastAroundMid(data: Uint8ClampedArray, amount: number) {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp((data[i] - 128) * amount + 128);
    data[i + 1] = clamp((data[i + 1] - 128) * amount + 128);
    data[i + 2] = clamp((data[i + 2] - 128) * amount + 128);
  }
}

function adjustSaturation(data: Uint8ClampedArray, amount: number) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const gray = r * 0.299 + g * 0.587 + b * 0.114;
    data[i] = clamp(gray + (r - gray) * amount);
    data[i + 1] = clamp(gray + (g - gray) * amount);
    data[i + 2] = clamp(gray + (b - gray) * amount);
  }
}

function unsharpMask(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  const copy = new Uint8ClampedArray(data);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        let blur = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const weight = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
            blur += copy[((y + dy) * width + (x + dx)) * 4 + c] * weight;
          }
        }
        blur /= 16;
        data[i + c] = clamp(copy[i + c] + (copy[i + c] - blur) * amount);
      }
    }
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, value));
}
