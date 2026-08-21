/** Canonical numeric helpers used by all browser detectors. */

export function average(values: ArrayLike<number>): number {
  if (!values.length) return 0;
  let total = 0;
  for (let index = 0; index < values.length; index += 1) total += values[index];
  return total / values.length;
}

export function percentile(values: ArrayLike<number>, fraction: number): number {
  if (!values.length) return 0;
  const index = percentileIndex(values.length, fraction);
  const working = new Float64Array(values.length);
  for (let source = 0; source < values.length; source += 1) working[source] = values[source];
  return selectKth(working, index);
}

/**
 * Returns quantiles for values known to be in a small, integer-sized range.
 * Values are assigned to unit-width buckets, so each result is a lower bound
 * within one bucket of the exact order statistic.
 */
export function boundedPercentiles(
  values: ArrayLike<number>,
  fractions: ArrayLike<number>,
  minimum = 0,
  maximum = 255,
): number[] {
  if (!fractions.length) return [];
  if (!values.length) return Array.from(fractions, () => 0);

  const bucketCount = Math.floor(maximum - minimum) + 1;
  const counts = new Uint32Array(bucketCount);
  for (let index = 0; index < values.length; index += 1) {
    const bucket = Math.max(
      0,
      Math.min(bucketCount - 1, Math.floor(values[index] - minimum)),
    );
    counts[bucket] += 1;
  }

  return Array.from(fractions, (fraction) => {
    const target = percentileIndex(values.length, fraction);
    let seen = 0;
    for (let bucket = 0; bucket < counts.length; bucket += 1) {
      seen += counts[bucket];
      if (target < seen) return minimum + bucket;
    }
    return maximum;
  });
}

function percentileIndex(length: number, fraction: number): number {
  return Math.min(
    length - 1,
    Math.max(0, Math.floor((length - 1) * fraction)),
  );
}

function selectKth(values: Float64Array, target: number): number {
  let left = 0;
  let right = values.length - 1;
  while (left <= right) {
    if (left === right) return values[left];
    const pivot = values[medianOfThree(values, left, left + Math.floor((right - left) / 2), right)];
    let lower = left;
    let current = left;
    let upper = right;
    while (current <= upper) {
      if (values[current] < pivot) {
        swap(values, lower, current);
        lower += 1;
        current += 1;
      } else if (values[current] > pivot) {
        swap(values, current, upper);
        upper -= 1;
      } else {
        current += 1;
      }
    }
    if (target < lower) right = lower - 1;
    else if (target > upper) left = upper + 1;
    else return pivot;
  }
  return values[target];
}

function medianOfThree(values: Float64Array, first: number, second: number, third: number): number {
  const firstValue = values[first];
  const secondValue = values[second];
  const thirdValue = values[third];
  if (firstValue < secondValue) {
    if (secondValue < thirdValue) return second;
    return firstValue < thirdValue ? third : first;
  }
  if (firstValue < thirdValue) return first;
  return secondValue < thirdValue ? third : second;
}

function swap(values: Float64Array, first: number, second: number): void {
  const value = values[first];
  values[first] = values[second];
  values[second] = value;
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
