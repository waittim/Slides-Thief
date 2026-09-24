import type { Quad } from "../detection/types.ts";
import { perspectiveCoefficients } from "./perspective.ts";
import { canvasToJpegBlob } from "./slide-utils.ts";

export const SAMPLE_SLIDE_FILENAME = "sample-presentation-slide.jpg";

/**
 * Deterministic quad coordinates of the slide in the synthetic 1200x800 scene.
 * Order: top-left, top-right, bottom-right, bottom-left.
 */
export const SAMPLE_SLIDE_QUAD: Quad = [
  [160, 110],
  [1040, 140],
  [990, 680],
  [210, 710],
];

/** Head-on size of the slide artwork before it is projected onto the quad. 16:9. */
const ARTWORK_WIDTH = 1120;
const ARTWORK_HEIGHT = 630;

/**
 * Projector falloff across the slide, brightest at the near (left) edge. The quad's left
 * edge is taller than its right, so the left side is the one closer to the lens.
 */
const SHADE_AT_FAR_EDGE = 0.86;

/**
 * Draws the slide head-on, in its own 16:9 coordinate space. This artwork is what the
 * photo would have captured from directly in front of the screen; the perspective is
 * applied afterwards by projecting it onto the scene quad.
 */
function drawSlideArtwork(ctx: CanvasRenderingContext2D): void {
  const padding = 72;
  const contentWidth = ARTWORK_WIDTH - padding * 2;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, ARTWORK_WIDTH, ARTWORK_HEIGHT);

  // Top header category badge
  ctx.fillStyle = "#0f766e";
  ctx.beginPath();
  ctx.roundRect(padding, 52, 300, 36, 6);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("SLIDES THIEF • DEMO SAMPLE", padding + 18, 76);

  // Main Presentation Title
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 42px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("Autonomous Document Rectification", padding, 140);

  // Subtitle
  ctx.fillStyle = "#475569";
  ctx.font = "500 19px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("100% browser-local processing · Sub-pixel corner detection · Clean PDF export", padding, 176);

  // 3 Key Feature Cards
  const cards = [
    { title: "100% Local Privacy", desc: "Zero cloud upload" },
    { title: "Precision Quad", desc: "Sub-pixel loupe handles" },
    { title: "Crisp PDF Output", desc: "Sharpened & contrast boosted" },
  ];
  const cardGap = 24;
  const cardWidth = (contentWidth - cardGap * (cards.length - 1)) / cards.length;

  cards.forEach((card, i) => {
    const cx = padding + i * (cardWidth + cardGap);
    const cy = 204;
    ctx.fillStyle = "#f1f5f9";
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardWidth, 104, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f766e";
    ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(card.title, cx + 20, cy + 40);

    ctx.fillStyle = "#64748b";
    ctx.font = "15px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(card.desc, cx + 20, cy + 68);
  });

  // Visual Chart Section
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(padding, 340, contentWidth, 200, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("Key Performance Metrics", padding + 24, 374);

  const bars = [
    { label: "Corner Detection Accuracy", val: 0.96, color: "#0f766e" },
    { label: "Warp & Rectify Speed", val: 0.92, color: "#3b82f6" },
    { label: "Image Contrast Enhancement", val: 0.88, color: "#f59e0b" },
    { label: "Local Privacy Guarantee", val: 1.0, color: "#10b981" },
  ];
  const trackX = padding + 448;
  const trackWidth = 400;

  bars.forEach((bar, index) => {
    const by = 398 + index * 32;
    ctx.fillStyle = "#64748b";
    ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(bar.label, padding + 24, by + 14);

    // Track
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.roundRect(trackX, by, trackWidth, 16, 4);
    ctx.fill();

    // Fill bar
    ctx.fillStyle = bar.color;
    ctx.beginPath();
    ctx.roundRect(trackX, by, trackWidth * bar.val, 16, 4);
    ctx.fill();

    ctx.fillStyle = "#334155";
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(`${Math.round(bar.val * 100)}%`, trackX + trackWidth + 12, by + 14);
  });

  // Slide Footer
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, 574);
  ctx.lineTo(padding + contentWidth, 574);
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("Slide 01 of 12 • Annual Engineering Keynote • Slides Thief Demo", padding, 602);
}

/**
 * True projective mapping of the head-on artwork onto the scene quad, using the same
 * homography solver the correction pipeline runs. Walking destination pixels and looking
 * the source up backwards means slide content converges with the slide's own edges
 * instead of staying axis-aligned inside a clipped outline.
 */
function projectArtworkOntoQuad(
  scene: CanvasRenderingContext2D,
  artwork: ImageData,
  quad: Quad,
  sceneWidth: number,
  sceneHeight: number,
): void {
  const artworkRect: Quad = [
    [0, 0],
    [artwork.width, 0],
    [artwork.width, artwork.height],
    [0, artwork.height],
  ];
  const coeffs = perspectiveCoefficients(artworkRect, quad);

  const xs = quad.map(([x]) => x);
  const ys = quad.map(([, y]) => y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(sceneWidth - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(sceneHeight - 1, Math.ceil(Math.max(...ys)));

  const target = scene.getImageData(0, 0, sceneWidth, sceneHeight);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const coverage = quadCoverage(quad, x, y);
      if (coverage === 0) continue;

      const denominator = coeffs[6] * (x + 0.5) + coeffs[7] * (y + 0.5) + 1;
      const u = (coeffs[0] * (x + 0.5) + coeffs[1] * (y + 0.5) + coeffs[2]) / denominator;
      const v = (coeffs[3] * (x + 0.5) + coeffs[4] * (y + 0.5) + coeffs[5]) / denominator;

      const shade = 1 - (1 - SHADE_AT_FAR_EDGE) * clamp(u / artwork.width, 0, 1);
      const rgb = sampleBilinear(artwork, u, v);
      const offset = (y * sceneWidth + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const lit = rgb[channel] * shade;
        target.data[offset + channel] = lit * coverage + target.data[offset + channel] * (1 - coverage);
      }
      target.data[offset + 3] = 255;
    }
  }

  scene.putImageData(target, 0, 0);
}

/** 2x2 supersampled coverage so the projected slide edge stays smooth against the room. */
function quadCoverage(quad: Quad, x: number, y: number): number {
  let inside = 0;
  for (let sy = 0; sy < 2; sy += 1) {
    for (let sx = 0; sx < 2; sx += 1) {
      if (isInsideQuad(quad, x + 0.25 + sx * 0.5, y + 0.25 + sy * 0.5)) inside += 1;
    }
  }
  return inside / 4;
}

function isInsideQuad(quad: Quad, px: number, py: number): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i += 1) {
    const [ax, ay] = quad[i];
    const [bx, by] = quad[(i + 1) % 4];
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    if (cross === 0) continue;
    const current = cross > 0 ? 1 : -1;
    if (sign === 0) sign = current;
    else if (current !== sign) return false;
  }
  return true;
}

function sampleBilinear(image: ImageData, x: number, y: number): [number, number, number] {
  const sx = clamp(x, 0, image.width - 1);
  const sy = clamp(y, 0, image.height - 1);
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);
  const x1 = Math.min(image.width - 1, x0 + 1);
  const y1 = Math.min(image.height - 1, y0 + 1);
  const wx = sx - x0;
  const wy = sy - y0;
  const p00 = (y0 * image.width + x0) * 4;
  const p10 = (y0 * image.width + x1) * 4;
  const p01 = (y1 * image.width + x0) * 4;
  const p11 = (y1 * image.width + x1) * 4;
  const channel = (offset: number) =>
    image.data[p00 + offset] * (1 - wx) * (1 - wy)
    + image.data[p10 + offset] * wx * (1 - wy)
    + image.data[p01 + offset] * (1 - wx) * wy
    + image.data[p11 + offset] * wx * wy;
  return [channel(0), channel(1), channel(2)];
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function renderArtwork(): ImageData {
  const canvas = document.createElement("canvas");
  canvas.width = ARTWORK_WIDTH;
  canvas.height = ARTWORK_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }
  drawSlideArtwork(ctx);
  return ctx.getImageData(0, 0, ARTWORK_WIDTH, ARTWORK_HEIGHT);
}

/**
 * Draws a synthetic presentation slide in perspective onto an HTML canvas.
 * Designed to look like an authentic meeting/lecture photo while presenting
 * high-contrast, clean quadrilateral boundaries that Slides Thief's edge-detection
 * pipeline detects with >= 0.95 confidence.
 */
export function drawSampleSlideScene(ctx: CanvasRenderingContext2D, width = 1200, height = 800): void {
  // 1. Dark auditorium/conference room background with subtle texture
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, "#141c22");
  bgGrad.addColorStop(0.5, "#1c262e");
  bgGrad.addColorStop(1, "#12181d");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle acoustic wall seam lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
  ctx.lineWidth = 1;
  for (let x = 80; x < width; x += 110) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Soft ambient projector spotlight behind the screen
  const spotGrad = ctx.createRadialGradient(width * 0.5, height * 0.48, 100, width * 0.5, height * 0.48, 550);
  spotGrad.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  spotGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = spotGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Slide Quad geometry
  const [[tlX, tlY], [trX, trY], [brX, brY], [blX, blY]] = SAMPLE_SLIDE_QUAD;

  // Thin outer screen bezel
  ctx.strokeStyle = "#2e3b44";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(tlX, tlY);
  ctx.lineTo(trX, trY);
  ctx.lineTo(brX, brY);
  ctx.lineTo(blX, blY);
  ctx.closePath();
  ctx.stroke();

  // 3. Slide content, drawn head-on and then projected onto the quad
  projectArtworkOntoQuad(ctx, renderArtwork(), SAMPLE_SLIDE_QUAD, width, height);

  // Razor-sharp outer perimeter line for high edge gradient
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tlX, tlY);
  ctx.lineTo(trX, trY);
  ctx.lineTo(brX, brY);
  ctx.lineTo(blX, blY);
  ctx.closePath();
  ctx.stroke();
}

/**
 * Generates a synthetic File representing an angled presentation slide in a meeting room.
 * Built 100% in-browser via canvas, with zero network requests.
 */
export async function generateSampleSlideFile(): Promise<File> {
  if (typeof document === "undefined") {
    const dummyBlob = new Blob(["sample-slide-placeholder"], { type: "image/jpeg" });
    return new File([dummyBlob], SAMPLE_SLIDE_FILENAME, { type: "image/jpeg" });
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 800;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }

  drawSampleSlideScene(ctx, 1200, 800);

  const blob = await canvasToJpegBlob(canvas, 0.92);
  return new File([blob], SAMPLE_SLIDE_FILENAME, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
