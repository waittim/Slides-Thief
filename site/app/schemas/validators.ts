import type { ManualQuads } from "./index";

type ManualQuad = ManualQuads[string];

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function samePoint(first: readonly [number, number], second: readonly [number, number]): boolean {
  return first[0] === second[0] && first[1] === second[1];
}

function canonicalQuad(quad: ManualQuad): ManualQuad {
  const points = quad.map(([x, y]) => [x, y] as [number, number]);
  const sum = ([x, y]: readonly [number, number]) => x + y;
  const difference = ([x, y]: readonly [number, number]) => x - y;
  return [
    points.reduce((best, point) => (sum(point) < sum(best) ? point : best)),
    points.reduce((best, point) => (difference(point) > difference(best) ? point : best)),
    points.reduce((best, point) => (sum(point) > sum(best) ? point : best)),
    points.reduce((best, point) => (difference(point) < difference(best) ? point : best)),
  ] as ManualQuad;
}

function validateQuad(value: unknown, path: string): ManualQuad {
  if (!Array.isArray(value) || value.length !== 4) {
    throw new SchemaValidationError(`${path}: expected exactly 4 corner points`);
  }

  const points: [number, number][] = value.map((point, index) => {
    const cornerPath = `${path} corner ${index + 1}`;
    if (!Array.isArray(point) || point.length !== 2 || !isFiniteNumber(point[0]) || !isFiniteNumber(point[1])) {
      throw new SchemaValidationError(`${cornerPath}: expected [x, y] with finite numeric coordinates`);
    }
    return [point[0], point[1]];
  });
  const quad = [points[0], points[1], points[2], points[3]] as ManualQuad;

  const canonical = canonicalQuad(quad);
  if (!quad.every((point, index) => samePoint(point, canonical[index]))) {
    throw new SchemaValidationError(
      `${path}: corners must be ordered top-left, top-right, bottom-right, bottom-left`,
    );
  }

  const crosses = quad.map((point, index) => {
    const next = quad[(index + 1) % quad.length];
    const following = quad[(index + 2) % quad.length];
    const firstX = next[0] - point[0];
    const firstY = next[1] - point[1];
    const secondX = following[0] - next[0];
    const secondY = following[1] - next[1];
    return firstX * secondY - firstY * secondX;
  });
  if (!(crosses.every((cross) => cross > 0) || crosses.every((cross) => cross < 0))) {
    throw new SchemaValidationError(`${path}: corners must form a non-degenerate convex quadrilateral`);
  }

  return quad;
}

/** Parse an unknown JSON value at the manual-quads import boundary. */
export function parseManualQuads(value: unknown): ManualQuads {
  if (!isRecord(value)) {
    throw new SchemaValidationError("manual quads: expected a JSON object keyed by filename or stem");
  }

  const result = {} as ManualQuads;
  for (const [filename, valueForFilename] of Object.entries(value)) {
    if (!filename.trim()) {
      throw new SchemaValidationError("manual quads: entry keys must be non-empty strings");
    }
    Object.defineProperty(result, filename, {
      configurable: true,
      enumerable: true,
      value: validateQuad(valueForFilename, `manual quads entry ${filename}`),
      writable: true,
    });
  }
  return result;
}

/** Parse a serialized manual-quads file and return a generated-schema type. */
export function parseManualQuadsJson(serialized: string): ManualQuads {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new SchemaValidationError(`manual quads: ${detail}`);
  }
  return parseManualQuads(value);
}

/** Validate a quad against the dimensions of its source image. */
export function validateManualQuadForImage(
  value: unknown,
  filename: string,
  width: number,
  height: number,
): ManualQuad {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
    throw new SchemaValidationError(`${filename}: image dimensions must be finite non-negative numbers`);
  }
  const quad = validateQuad(value, `manual quad for ${filename}`);
  quad.forEach(([x, y], index) => {
    if (x < 0 || x > width || y < 0 || y > height) {
      throw new SchemaValidationError(
        `manual quad for ${filename} corner ${index + 1}: point [${x}, ${y}] is outside `
          + `image bounds 0 <= x <= ${width}, 0 <= y <= ${height}`,
      );
    }
  });
  return quad;
}

export function isManualQuads(value: unknown): value is ManualQuads {
  try {
    parseManualQuads(value);
    return true;
  } catch {
    return false;
  }
}
