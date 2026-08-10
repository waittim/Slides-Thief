import type { Point, Quad } from "./types.ts";
import { DETECTION_CONFIG } from "./config.ts";

const GEOMETRY_CONFIG = DETECTION_CONFIG.geometry;

export type Line = {
  a: number;
  b: number;
  c: number;
};

export function lineIntersection(first: Line, second: Line): Point {
  const denominator = first.a * second.b - second.a * first.b;
  if (Math.abs(denominator) < 1e-9) return [Number.NaN, Number.NaN];
  return [
    (first.b * second.c - second.b * first.c) / denominator,
    (first.c * second.a - second.c * first.a) / denominator,
  ];
}

export function orderQuad(points: Point[]): Quad {
  const bySum = [...points].sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
  const byDiff = [...points].sort((a, b) => a[0] - a[1] - (b[0] - b[1]));
  return [bySum[0], byDiff[3], bySum[3], byDiff[0]] as Quad;
}

export function polygonArea(points: Quad): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[1] - current[1] * next[0];
  }
  return Math.abs(area) * 0.5;
}

export function distance(first: Point, second: Point): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

export function isPointInside(point: Point, quad: Quad): boolean {
  let inside = false;
  for (let index = 0, previous = quad.length - 1; index < quad.length; previous = index, index += 1) {
    const [x1, y1] = quad[index];
    const [x2, y2] = quad[previous];
    if ((y1 > point[1]) !== (y2 > point[1])) {
      const crossingX = ((x2 - x1) * (point[1] - y1)) / (y2 - y1) + x1;
      if (point[0] < crossingX) inside = !inside;
    }
  }
  return inside;
}

export function isConvexQuad(quad: Quad): boolean {
  const signs: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const first = quad[index];
    const second = quad[(index + 1) % 4];
    const third = quad[(index + 2) % 4];
    const cross = (second[0] - first[0]) * (third[1] - second[1]) -
      (second[1] - first[1]) * (third[0] - second[0]);
    if (Math.abs(cross) < 1e-6) return false;
    signs.push(Math.sign(cross));
  }
  return signs.every((sign) => sign === signs[0]);
}

export function geometryIsValid(quad: Quad, width: number, height: number): boolean {
  if (!quad.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) return false;
  if (!isConvexQuad(quad)) return false;
  if (polygonArea(quad) < width * height * GEOMETRY_CONFIG.minimumAreaRatio) return false;
  if (quad.some(([x, y]) =>
    x < -width * GEOMETRY_CONFIG.boundsRatio ||
    x > width * (1 + GEOMETRY_CONFIG.boundsRatio) ||
    y < -height * GEOMETRY_CONFIG.boundsRatio ||
    y > height * (1 + GEOMETRY_CONFIG.boundsRatio)
  )) {
    return false;
  }
  const shortestEdge = Math.min(...quad.map((point, index) => distance(point, quad[(index + 1) % 4])));
  if (shortestEdge < Math.min(width, height) * GEOMETRY_CONFIG.minimumEdgeRatio) return false;
  for (let index = 0; index < 4; index += 1) {
    const previous = quad[(index + 3) % 4];
    const current = quad[index];
    const next = quad[(index + 1) % 4];
    const first = [previous[0] - current[0], previous[1] - current[1]];
    const second = [next[0] - current[0], next[1] - current[1]];
    const cosine = (first[0] * second[0] + first[1] * second[1]) /
      Math.max(1e-9, Math.hypot(...first) * Math.hypot(...second));
    const angle = Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
    if (angle < GEOMETRY_CONFIG.minimumAngleDegrees || angle > GEOMETRY_CONFIG.maximumAngleDegrees) return false;
  }
  return true;
}

export function normalizedCornerDistance(first: Quad, second: Quad, width: number, height: number): number {
  const diagonal = Math.hypot(width, height);
  return first.reduce((sum, point, index) => sum + distance(point, second[index]), 0) / (4 * diagonal);
}

export function quadIoU(first: Quad, second: Quad, width: number, height: number): number {
  const scale = Math.max(1, Math.ceil(Math.max(width, height) / 240));
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < height; y += scale) {
    for (let x = 0; x < width; x += scale) {
      const point: Point = [x + scale / 2, y + scale / 2];
      const insideFirst = isPointInside(point, first);
      const insideSecond = isPointInside(point, second);
      if (insideFirst || insideSecond) union += 1;
      if (insideFirst && insideSecond) intersection += 1;
    }
  }
  return union ? intersection / union : 0;
}

export function convexQuadIoU(first: Quad, second: Quad): number {
  const intersection = clipConvexPolygon(first, second);
  const intersectionArea = polygonAreaPoints(intersection);
  const unionArea = polygonArea(first) + polygonArea(second) - intersectionArea;
  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

export function scaleQuad(quad: Quad, factor: number): Quad {
  const center: Point = [
    quad.reduce((sum, point) => sum + point[0], 0) / 4,
    quad.reduce((sum, point) => sum + point[1], 0) / 4,
  ];
  return quad.map(([x, y]) => [
    center[0] + (x - center[0]) * factor,
    center[1] + (y - center[1]) * factor,
  ]) as Quad;
}

function clipConvexPolygon(subject: Point[], clip: Point[]): Point[] {
  let output = [...subject];
  const orientation = signedPolygonArea(clip) >= 0 ? 1 : -1;
  for (let edgeIndex = 0; edgeIndex < clip.length; edgeIndex += 1) {
    const edgeStart = clip[edgeIndex];
    const edgeEnd = clip[(edgeIndex + 1) % clip.length];
    const input = output;
    output = [];
    if (!input.length) break;
    let previous = input[input.length - 1];
    let previousInside = halfPlane(previous, edgeStart, edgeEnd) * orientation >= -1e-7;
    for (const current of input) {
      const currentInside = halfPlane(current, edgeStart, edgeEnd) * orientation >= -1e-7;
      if (currentInside) {
        if (!previousInside) output.push(segmentLineIntersection(previous, current, edgeStart, edgeEnd));
        output.push(current);
      } else if (previousInside) {
        output.push(segmentLineIntersection(previous, current, edgeStart, edgeEnd));
      }
      previous = current;
      previousInside = currentInside;
    }
  }
  return output;
}

function segmentLineIntersection(start: Point, end: Point, lineStart: Point, lineEnd: Point): Point {
  const segmentX = end[0] - start[0];
  const segmentY = end[1] - start[1];
  const lineX = lineEnd[0] - lineStart[0];
  const lineY = lineEnd[1] - lineStart[1];
  const denominator = segmentX * lineY - segmentY * lineX;
  if (Math.abs(denominator) < 1e-9) return end;
  const offsetX = lineStart[0] - start[0];
  const offsetY = lineStart[1] - start[1];
  const fraction = (offsetX * lineY - offsetY * lineX) / denominator;
  return [start[0] + segmentX * fraction, start[1] + segmentY * fraction];
}

function halfPlane(point: Point, start: Point, end: Point): number {
  return (end[0] - start[0]) * (point[1] - start[1]) -
    (end[1] - start[1]) * (point[0] - start[0]);
}

function polygonAreaPoints(points: Point[]): number {
  return Math.abs(signedPolygonArea(points));
}

function signedPolygonArea(points: Point[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[1] - current[1] * next[0];
  }
  return area * 0.5;
}
