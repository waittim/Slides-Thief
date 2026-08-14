export type ConstrainedImageSize = {
  width: number;
  height: number;
  scale: number;
  pixels: number;
};

export const DETECTION_MAX_PIXELS = 1_200_000;

export function constrainedImageSize(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxPixels: number,
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
  const scale = Math.min(1, widthScale, pixelScale);
  const width = Math.max(1, Math.floor(sourceWidth * scale));
  const height = Math.max(1, Math.floor(sourceHeight * scale));
  return {
    width,
    height,
    scale,
    pixels: width * height,
  };
}
