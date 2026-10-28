import type { Quad } from "../detection/types.ts";
import { applyEnhancement, type EnhancementMode } from "../enhance.ts";
import {
  contentPixelBounds,
  extractContent,
  fillAndBlitContent,
  parseHexColor,
  resolveFillColor,
  sampleBlurredEdgeRgb,
  type PixelImage,
} from "./canvas-utils.ts";
import { containedRect, perspectiveCoefficients } from "./perspective.ts";

export type PerspectiveInterpolation = "nearest" | "bilinear";

export type RenderPerspectivePageOptions = {
  outputWidth: number;
  outputHeight: number;
  sourceRatio: number;
  fillColor: string;
  enhancement: EnhancementMode;
  interpolation: PerspectiveInterpolation;
  safetyInset?: number;
  suppressDarkBorders?: boolean;
};

/**
 * Applies a subtle safety inset towards the quadrilateral centroid.
 * Shifting the sampling rays 0.5% - 0.8% inward prevents sampling outer desk surfaces,
 * shadows, and background bleed without cutting into document or presentation margins.
 */
export function computeSafetyInsetQuad(quad: Quad, factor: number = 0.007): Quad {
  if (factor <= 0) return quad;
  const cx = (quad[0][0] + quad[1][0] + quad[2][0] + quad[3][0]) / 4;
  const cy = (quad[0][1] + quad[1][1] + quad[2][1] + quad[3][1]) / 4;
  const scale = 1 - factor;
  return quad.map(([x, y]) => [
    cx + (x - cx) * scale,
    cy + (y - cy) * scale,
  ]) as Quad;
}

/**
 * Suppresses residual dark perimeter lines and corner overshoots (e.g. tabletop bleed or camera frame shadows)
 * by directionally inpainting anomalous dark pixels on the outer perimeter using adjacent clean paper tone.
 */
export function cleanDarkPerimeter(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  depth: number = 4,
): void {
  if (width < 64 || height < 64 || depth < 1) return;
  const maxScan = Math.min(
    Math.max(depth, Math.floor(Math.min(width, height) * 0.05)),
    64,
  );

  // Sample interior background luma from the central 80% stats region using 256-bucket histogram
  const x0 = Math.floor(width * 0.1);
  const y0 = Math.floor(height * 0.1);
  const x1 = Math.max(x0 + 1, Math.ceil(width * 0.9));
  const y1 = Math.max(y0 + 1, Math.ceil(height * 0.9));
  const hist = new Int32Array(256);
  let count = 0;
  const stride = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 20_000)));
  for (let y = y0; y < y1; y += stride) {
    const yWidth = y * width;
    for (let x = x0; x < x1; x += stride) {
      const idx = (yWidth + x) * 4;
      const luma = Math.floor(data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
      hist[Math.min(255, Math.max(0, luma))] += 1;
      count += 1;
    }
  }
  if (count === 0) return;

  // Extract 80th percentile of interior luma to represent clean paper background
  const targetCount = count * 0.8;
  let accumulated = 0;
  let p80 = 0;
  for (let i = 0; i < 256; i += 1) {
    accumulated += hist[i];
    if (accumulated >= targetCount) {
      p80 = i;
      break;
    }
  }
  if (p80 < 50) return; // inverted or dark-background slide
  const darkThreshold = p80 * 0.85;

  // 1. Corner anchor inpainting for acute overshoots where orthogonal rays stay outside paper
  const tlIdx = (maxScan * width + maxScan) * 4;
  const tlLuma = data[tlIdx] * 0.299 + data[tlIdx + 1] * 0.587 + data[tlIdx + 2] * 0.114;
  if (tlLuma >= darkThreshold) {
    for (let y = 0; y < maxScan; y += 1) {
      const yWidth = y * width;
      for (let x = 0; x < maxScan; x += 1) {
        const i = (yWidth + x) * 4;
        const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (luma < darkThreshold) {
          data[i] = data[tlIdx];
          data[i + 1] = data[tlIdx + 1];
          data[i + 2] = data[tlIdx + 2];
        }
      }
    }
  }

  const trIdx = (maxScan * width + (width - 1 - maxScan)) * 4;
  const trLuma = data[trIdx] * 0.299 + data[trIdx + 1] * 0.587 + data[trIdx + 2] * 0.114;
  if (trLuma >= darkThreshold) {
    for (let y = 0; y < maxScan; y += 1) {
      const yWidth = y * width;
      for (let x = width - 1; x >= width - 1 - maxScan; x -= 1) {
        const i = (yWidth + x) * 4;
        const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (luma < darkThreshold) {
          data[i] = data[trIdx];
          data[i + 1] = data[trIdx + 1];
          data[i + 2] = data[trIdx + 2];
        }
      }
    }
  }

  const blIdx = ((height - 1 - maxScan) * width + maxScan) * 4;
  const blLuma = data[blIdx] * 0.299 + data[blIdx + 1] * 0.587 + data[blIdx + 2] * 0.114;
  if (blLuma >= darkThreshold) {
    for (let y = height - 1; y >= height - 1 - maxScan; y -= 1) {
      const yWidth = y * width;
      for (let x = 0; x < maxScan; x += 1) {
        const i = (yWidth + x) * 4;
        const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (luma < darkThreshold) {
          data[i] = data[blIdx];
          data[i + 1] = data[blIdx + 1];
          data[i + 2] = data[blIdx + 2];
        }
      }
    }
  }

  const brIdx = ((height - 1 - maxScan) * width + (width - 1 - maxScan)) * 4;
  const brLuma = data[brIdx] * 0.299 + data[brIdx + 1] * 0.587 + data[brIdx + 2] * 0.114;
  if (brLuma >= darkThreshold) {
    for (let y = height - 1; y >= height - 1 - maxScan; y -= 1) {
      const yWidth = y * width;
      for (let x = width - 1; x >= width - 1 - maxScan; x -= 1) {
        const i = (yWidth + x) * 4;
        const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        if (luma < darkThreshold) {
          data[i] = data[brIdx];
          data[i + 1] = data[brIdx + 1];
          data[i + 2] = data[brIdx + 2];
        }
      }
    }
  }

  // 2. Clean top edge (downward ray search)
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < maxScan && y < height; y += 1) {
      const i = (y * width + x) * 4;
      const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (luma < darkThreshold) {
        let cleanY = -1;
        for (let sy = y + 1; sy <= maxScan && sy < height; sy += 1) {
          const sIdx = (sy * width + x) * 4;
          const sLuma = data[sIdx] * 0.299 + data[sIdx + 1] * 0.587 + data[sIdx + 2] * 0.114;
          if (sLuma >= darkThreshold) {
            cleanY = sy;
            break;
          }
        }
        if (cleanY !== -1) {
          const refIdx = (cleanY * width + x) * 4;
          data[i] = data[refIdx];
          data[i + 1] = data[refIdx + 1];
          data[i + 2] = data[refIdx + 2];
        }
      }
    }
  }

  // 2. Clean bottom edge (upward ray search)
  for (let x = 0; x < width; x += 1) {
    for (let y = height - 1; y >= height - maxScan && y >= 0; y -= 1) {
      const i = (y * width + x) * 4;
      const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (luma < darkThreshold) {
        let cleanY = -1;
        for (let sy = y - 1; sy >= height - maxScan - 1 && sy >= 0; sy -= 1) {
          const sIdx = (sy * width + x) * 4;
          const sLuma = data[sIdx] * 0.299 + data[sIdx + 1] * 0.587 + data[sIdx + 2] * 0.114;
          if (sLuma >= darkThreshold) {
            cleanY = sy;
            break;
          }
        }
        if (cleanY !== -1) {
          const refIdx = (cleanY * width + x) * 4;
          data[i] = data[refIdx];
          data[i + 1] = data[refIdx + 1];
          data[i + 2] = data[refIdx + 2];
        }
      }
    }
  }

  // 3. Clean left edge (rightward ray search)
  for (let y = 0; y < height; y += 1) {
    const yWidth = y * width;
    for (let x = 0; x < maxScan && x < width; x += 1) {
      const i = (yWidth + x) * 4;
      const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (luma < darkThreshold) {
        let cleanX = -1;
        for (let sx = x + 1; sx <= maxScan && sx < width; sx += 1) {
          const sIdx = (yWidth + sx) * 4;
          const sLuma = data[sIdx] * 0.299 + data[sIdx + 1] * 0.587 + data[sIdx + 2] * 0.114;
          if (sLuma >= darkThreshold) {
            cleanX = sx;
            break;
          }
        }
        if (cleanX !== -1) {
          const refIdx = (yWidth + cleanX) * 4;
          data[i] = data[refIdx];
          data[i + 1] = data[refIdx + 1];
          data[i + 2] = data[refIdx + 2];
        }
      }
    }
  }

  // 4. Clean right edge (leftward ray search)
  for (let y = 0; y < height; y += 1) {
    const yWidth = y * width;
    for (let x = width - 1; x >= width - maxScan && x >= 0; x -= 1) {
      const i = (yWidth + x) * 4;
      const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      if (luma < darkThreshold) {
        let cleanX = -1;
        for (let sx = x - 1; sx >= width - maxScan - 1 && sx >= 0; sx -= 1) {
          const sIdx = (yWidth + sx) * 4;
          const sLuma = data[sIdx] * 0.299 + data[sIdx + 1] * 0.587 + data[sIdx + 2] * 0.114;
          if (sLuma >= darkThreshold) {
            cleanX = sx;
            break;
          }
        }
        if (cleanX !== -1) {
          const refIdx = (yWidth + cleanX) * 4;
          data[i] = data[refIdx];
          data[i + 1] = data[refIdx + 1];
          data[i + 2] = data[refIdx + 2];
        }
      }
    }
  }
}

/**
 * Renders a perspective-corrected page from an already decoded source image.
 * DOM and worker callers adapt their platform ImageData objects around this
 * pure pixel operation. Sampling quality is explicit so thumbnails and PDF
 * export share all geometry, edge handling, and content post-processing.
 */
export function renderPerspectivePage(
  source: PixelImage,
  quad: Quad,
  options: RenderPerspectivePageOptions,
): PixelImage {
  const { outputWidth, outputHeight } = options;
  const isRealisticPage = outputWidth >= 64 && outputHeight >= 64;
  const safetyInset = options.safetyInset ?? (isRealisticPage ? 0.007 : 0);
  const effectiveQuad = safetyInset > 0 ? computeSafetyInsetQuad(quad, safetyInset) : quad;

  const output: PixelImage = {
    width: outputWidth,
    height: outputHeight,
    data: new Uint8ClampedArray(outputWidth * outputHeight * 4),
  };
  const target = containedRect(outputWidth, outputHeight, options.sourceRatio);
  const coeffs = perspectiveCoefficients(effectiveQuad, target);
  const provisionalFill = options.fillColor === "auto"
    ? [255, 255, 255] as [number, number, number]
    : parseHexColor(options.fillColor);

  for (let y = 0; y < outputHeight; y += 1) {
    for (let x = 0; x < outputWidth; x += 1) {
      const outputOffset = (y * outputWidth + x) * 4;
      const insideContent = x >= target[0][0]
        && x < target[1][0]
        && y >= target[0][1]
        && y < target[3][1];

      if (!insideContent) {
        writeRgb(output.data, outputOffset, provisionalFill);
        continue;
      }

      const denominator = coeffs[6] * x + coeffs[7] * y + 1;
      const sourceX = (coeffs[0] * x + coeffs[1] * y + coeffs[2]) / denominator;
      const sourceY = (coeffs[3] * x + coeffs[4] * y + coeffs[5]) / denominator;
      sampleRgb(source, sourceX, sourceY, output.data, outputOffset, options.interpolation);
    }
  }

  const contentBounds = contentPixelBounds(target);
  const content = extractContent(output, contentBounds);
  const shouldCleanBorders = options.suppressDarkBorders ?? isRealisticPage;
  if (shouldCleanBorders) {
    cleanDarkPerimeter(content.data, content.width, content.height);
  }
  applyEnhancement(content.data, content.width, content.height, options.enhancement);
  const fill = resolveFillColor(options.fillColor, content);
  fillAndBlitContent(output, content, contentBounds, fill, provisionalFill);
  return output;
}

function sampleRgb(
  source: PixelImage,
  x: number,
  y: number,
  target: Uint8ClampedArray,
  offset: number,
  interpolation: PerspectiveInterpolation,
) {
  const { width, height, data } = source;
  const dx = x < 0 ? -x : x >= width ? x - (width - 1) : 0;
  const dy = y < 0 ? -y : y >= height ? y - (height - 1) : 0;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > 0) {
    const cx = Math.max(0, Math.min(width - 1, x));
    const cy = Math.max(0, Math.min(height - 1, y));
    const radius = Math.min(14, 2 + Math.floor(distance * 0.25));
    const edge = sampleBlurredEdgeRgb(data, width, height, cx, cy, radius);
    writeRgb(target, offset, edge);
    return;
  }

  if (interpolation === "nearest") {
    const sx = Math.max(0, Math.min(width - 1, Math.round(x)));
    const sy = Math.max(0, Math.min(height - 1, Math.round(y)));
    const sourceOffset = (sy * width + sx) * 4;
    target[offset] = data[sourceOffset];
    target[offset + 1] = data[sourceOffset + 1];
    target[offset + 2] = data[sourceOffset + 2];
    target[offset + 3] = 255;
    return;
  }

  const sx = Math.max(0, Math.min(width - 1, x));
  const sy = Math.max(0, Math.min(height - 1, y));
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = Math.max(0, Math.min(width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const wx = sx - x0;
  const wy = sy - y0;
  const p00 = (y0 * width + x0) * 4;
  const p10 = (y0 * width + x1) * 4;
  const p01 = (y1 * width + x0) * 4;
  const p11 = (y1 * width + x1) * 4;
  target[offset] = bilinear(data[p00], data[p10], data[p01], data[p11], wx, wy);
  target[offset + 1] = bilinear(data[p00 + 1], data[p10 + 1], data[p01 + 1], data[p11 + 1], wx, wy);
  target[offset + 2] = bilinear(data[p00 + 2], data[p10 + 2], data[p01 + 2], data[p11 + 2], wx, wy);
  target[offset + 3] = 255;
}

function writeRgb(target: Uint8ClampedArray, offset: number, rgb: [number, number, number]) {
  target[offset] = rgb[0];
  target[offset + 1] = rgb[1];
  target[offset + 2] = rgb[2];
  target[offset + 3] = 255;
}

function bilinear(a: number, b: number, c: number, d: number, wx: number, wy: number) {
  return a * (1 - wx) * (1 - wy) + b * wx * (1 - wy) + c * (1 - wx) * wy + d * wx * wy;
}
