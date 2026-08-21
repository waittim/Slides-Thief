export type ConstrainedImageSize = {
  width: number;
  height: number;
  scale: number;
  pixels: number;
};

export const DETECTION_MAX_PIXELS = 1_200_000;
export const DETECTION_MAX_SIDE = 4_096;

export function constrainedImageSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxPixels: number,
  maxSide = DETECTION_MAX_SIDE,
): ConstrainedImageSize {
  if (
    !Number.isFinite(sourceWidth)
    || !Number.isFinite(sourceHeight)
    || sourceWidth <= 0
    || sourceHeight <= 0
  ) {
    throw new Error("Image dimensions must be positive finite numbers.");
  }
  const widthScale = maxWidth > 0 ? maxWidth / sourceWidth : 1;
  const pixelScale = maxPixels > 0
    ? Math.sqrt(maxPixels / (sourceWidth * sourceHeight))
    : 1;
  const sideScale = maxSide > 0
    ? maxSide / Math.max(sourceWidth, sourceHeight)
    : 1;
  const scale = Math.min(1, widthScale, pixelScale, sideScale);
  const width = Math.max(1, Math.floor(sourceWidth * scale));
  let height = Math.max(1, Math.floor(sourceHeight * scale));
  let constrainedWidth = width;
  const pixelBudget = maxPixels > 0 ? Math.max(1, Math.floor(maxPixels)) : null;
  while (pixelBudget !== null && constrainedWidth * height > pixelBudget) {
    if (height >= constrainedWidth && height > 1) {
      height = Math.max(1, Math.min(height - 1, Math.floor(pixelBudget / constrainedWidth)));
    } else if (constrainedWidth > 1) {
      constrainedWidth = Math.max(1, Math.min(constrainedWidth - 1, Math.floor(pixelBudget / height)));
    } else {
      break;
    }
  }
  return {
    width: constrainedWidth,
    height,
    scale,
    pixels: constrainedWidth * height,
  };
}
