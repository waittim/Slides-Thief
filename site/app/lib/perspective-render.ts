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
};

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
  const output: PixelImage = {
    width: outputWidth,
    height: outputHeight,
    data: new Uint8ClampedArray(outputWidth * outputHeight * 4),
  };
  const target = containedRect(outputWidth, outputHeight, options.sourceRatio);
  const coeffs = perspectiveCoefficients(quad, target);
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
