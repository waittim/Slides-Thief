import type { GradientMap, ImageDataLike } from "./types.ts";

const PYRAMID_SCALES = [1, 0.67, 0.45];

type ScaleGradient = {
  width: number;
  height: number;
  magnitude: Float64Array;
  orientation: Float64Array;
};

export function buildGradientPyramid(imageData: ImageDataLike): GradientMap {
  const { width, height } = imageData;
  const fusedMagnitude = new Float64Array(width * height);
  const fusedOrientation = new Float64Array(width * height);
  const sourceScale = new Float32Array(width * height);

  for (const scale of PYRAMID_SCALES) {
    const scaledWidth = Math.max(3, Math.round(width * scale));
    const scaledHeight = Math.max(3, Math.round(height * scale));
    const gradient = gradientAtScale(imageData, scaledWidth, scaledHeight);
    for (let y = 0; y < height; y += 1) {
      const sourceY = clamp(Math.round((y + 0.5) * scaledHeight / height - 0.5), 0, scaledHeight - 1);
      for (let x = 0; x < width; x += 1) {
        const sourceX = clamp(Math.round((x + 0.5) * scaledWidth / width - 0.5), 0, scaledWidth - 1);
        const sourceIndex = sourceY * scaledWidth + sourceX;
        const targetIndex = y * width + x;
        const scaledMagnitude = gradient.magnitude[sourceIndex] * Math.sqrt(scale);
        if (scaledMagnitude > fusedMagnitude[targetIndex]) {
          fusedMagnitude[targetIndex] = scaledMagnitude;
          fusedOrientation[targetIndex] = gradient.orientation[sourceIndex];
          sourceScale[targetIndex] = scale;
        }
      }
    }
  }

  return {
    width,
    height,
    magnitude: fusedMagnitude,
    orientation: fusedOrientation,
    sourceScale,
    threshold: Math.max(0.035, percentile(fusedMagnitude, 0.85)),
    scales: [...PYRAMID_SCALES],
  };
}

function percentile(values: ArrayLike<number>, fraction: number): number {
  const ordered = Array.from(values).sort((first, second) => first - second);
  if (!ordered.length) return 0;
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.floor((ordered.length - 1) * fraction)))];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function gradientAtScale(imageData: ImageDataLike, width: number, height: number): ScaleGradient {
  const channels = [
    new Float64Array(width * height),
    new Float64Array(width * height),
    new Float64Array(width * height),
  ];
  for (let y = 0; y < height; y += 1) {
    const sourceY = clamp(Math.round((y + 0.5) * imageData.height / height - 0.5), 0, imageData.height - 1);
    for (let x = 0; x < width; x += 1) {
      const sourceX = clamp(Math.round((x + 0.5) * imageData.width / width - 0.5), 0, imageData.width - 1);
      const source = (sourceY * imageData.width + sourceX) * 4;
      const red = imageData.data[source];
      const green = imageData.data[source + 1];
      const blue = imageData.data[source + 2];
      const target = y * width + x;
      channels[0][target] = (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
      channels[1][target] = (red - green) / 510;
      channels[2][target] = (blue - (red + green) * 0.5) / 510;
    }
  }

  const magnitude = new Float64Array(width * height);
  const orientation = new Float64Array(width * height);
  for (const channel of channels) {
    applySobel(channel, width, height, magnitude, orientation);
  }
  return { width, height, magnitude, orientation };
}

function applySobel(
  channel: Float64Array,
  width: number,
  height: number,
  combinedMagnitude: Float64Array,
  combinedOrientation: Float64Array,
): void {
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const topLeft = channel[(y - 1) * width + x - 1];
      const top = channel[(y - 1) * width + x];
      const topRight = channel[(y - 1) * width + x + 1];
      const left = channel[y * width + x - 1];
      const right = channel[y * width + x + 1];
      const bottomLeft = channel[(y + 1) * width + x - 1];
      const bottom = channel[(y + 1) * width + x];
      const bottomRight = channel[(y + 1) * width + x + 1];
      const gx = -topLeft + topRight - 2 * left + 2 * right - bottomLeft + bottomRight;
      const gy = -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight;
      const strength = Math.hypot(gx, gy) / (4 * Math.SQRT2);
      const index = y * width + x;
      if (strength > combinedMagnitude[index]) {
        combinedMagnitude[index] = strength;
        combinedOrientation[index] = Math.atan2(gy, gx);
      }
    }
  }
}
