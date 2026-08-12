/** Canonical numeric helpers used by all browser detectors. */

export function average(values: ArrayLike<number>): number {
  if (!values.length) return 0;
  let total = 0;
  for (let index = 0; index < values.length; index += 1) total += values[index];
  return total / values.length;
}

export function percentile(values: ArrayLike<number>, fraction: number): number {
  const ordered = Array.from(values).sort((first, second) => first - second);
  if (!ordered.length) return 0;
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.floor((ordered.length - 1) * fraction)))];
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function variance(values: ArrayLike<number>, mean = average(values)): number {
  if (!values.length) return 0;
  let total = 0;
  for (let index = 0; index < values.length; index += 1) total += (values[index] - mean) ** 2;
  return total / values.length;
}
