import { canvasToJpegBlob } from "./slide-utils.ts";

export const SAMPLE_SLIDE_FILENAME = "sample-presentation-slide.jpg";

/**
 * Deterministic quad coordinates of the slide in the synthetic 1200x800 scene.
 * Order: top-left, top-right, bottom-right, bottom-left.
 */
export const SAMPLE_SLIDE_QUAD: [number, number][] = [
  [160, 110],
  [1040, 140],
  [990, 680],
  [210, 710],
];

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

  // 3. Slide Content (clipped to the perspective quad)
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(tlX, tlY);
  ctx.lineTo(trX, trY);
  ctx.lineTo(brX, brY);
  ctx.lineTo(blX, blY);
  ctx.closePath();
  ctx.clip();

  // Crisp slide background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // Top header category badge
  ctx.fillStyle = "#0f766e"; // Accent teal
  ctx.beginPath();
  ctx.roundRect(230, 160, 260, 32, 6);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("SLIDES THIEF • DEMO SAMPLE", 245, 181);

  // Main Presentation Title
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("Autonomous Document Rectification", 230, 235);

  // Subtitle
  ctx.fillStyle = "#475569";
  ctx.font = "500 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("100% browser-local processing · Sub-pixel corner detection · Clean PDF export", 230, 268);

  // 3 Key Feature Cards
  const cards = [
    { title: "100% Local Privacy", desc: "Zero cloud upload", fill: "#f1f5f9", stroke: "#cbd5e1" },
    { title: "Precision Quad", desc: "Sub-pixel loupe handles", fill: "#f1f5f9", stroke: "#cbd5e1" },
    { title: "Crisp PDF Output", desc: "Sharpened & contrast boosted", fill: "#f1f5f9", stroke: "#cbd5e1" },
  ];

  cards.forEach((card, i) => {
    const cx = 230 + i * 240;
    const cy = 305;
    ctx.fillStyle = card.fill;
    ctx.strokeStyle = card.stroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx, cy, 220, 95, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#0f766e";
    ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(card.title, cx + 16, cy + 36);

    ctx.fillStyle = "#64748b";
    ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(card.desc, cx + 16, cy + 62);
  });

  // Visual Chart Section
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(230, 425, 700, 180, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 15px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("Key Performance Metrics", 252, 458);

  const bars = [
    { label: "Corner Detection Accuracy", val: 0.96, color: "#0f766e" },
    { label: "Warp & Rectify Speed", val: 0.92, color: "#3b82f6" },
    { label: "Image Contrast Enhancement", val: 0.88, color: "#f59e0b" },
    { label: "Local Privacy Guarantee", val: 1.0, color: "#10b981" },
  ];

  bars.forEach((bar, index) => {
    const by = 480 + index * 28;
    ctx.fillStyle = "#64748b";
    ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(bar.label, 252, by + 12);

    // Track
    ctx.fillStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.roundRect(470, by, 380, 14, 4);
    ctx.fill();

    // Fill bar
    ctx.fillStyle = bar.color;
    ctx.beginPath();
    ctx.roundRect(470, by, 380 * bar.val, 14, 4);
    ctx.fill();

    ctx.fillStyle = "#334155";
    ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(`${Math.round(bar.val * 100)}%`, 865, by + 12);
  });

  // Slide Footer
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(230, 625);
  ctx.lineTo(930, 625);
  ctx.stroke();

  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("Slide 01 of 12 • Annual Engineering Keynote • Slides Thief Demo", 230, 648);

  ctx.restore();

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
