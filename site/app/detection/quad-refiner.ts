import { evaluateEdgeEvidence } from "./candidate-scorer.ts";
import {
  distance,
  geometryIsValid,
  lineIntersection,
  type Line,
} from "./geometry.ts";
import type {
  EdgeEvidence,
  ImageFeatures,
  Point,
  Quad,
  QuadCandidate,
} from "./types.ts";

type EdgeSearchResult = {
  line: Line;
  angleDelta: number;
  offset: number;
  objectiveBefore: number;
  objectiveAfter: number;
  localizationAfter: number;
};

export function refineCandidate(candidate: QuadCandidate, image: ImageFeatures): QuadCandidate | null {
  const edges = candidate.quad.map((start, index) =>
    refineEdge(start, candidate.quad[(index + 1) % 4], image)
  );
  const refinedQuad: Quad = [
    lineIntersection(edges[3].line, edges[0].line),
    lineIntersection(edges[0].line, edges[1].line),
    lineIntersection(edges[1].line, edges[2].line),
    lineIntersection(edges[2].line, edges[3].line),
  ];
  if (!geometryIsValid(refinedQuad, image.width, image.height)) return null;

  const maximumMovement = Math.max(
    ...candidate.quad.map((point, index) => distance(point, refinedQuad[index])),
  );
  const movementLimit = Math.hypot(image.width, image.height) * 0.04;
  if (maximumMovement > movementLimit) return null;

  return {
    ...candidate,
    quad: refinedQuad,
    diagnostics: {
      ...candidate.diagnostics,
      refinement: {
        angleDeltasDegrees: edges.map((edge) => round(edge.angleDelta * 180 / Math.PI, 2)),
        offsets: edges.map((edge) => round(edge.offset, 2)),
        edgeObjectivesBefore: edges.map((edge) => round(edge.objectiveBefore, 4)),
        edgeObjectivesAfter: edges.map((edge) => round(edge.objectiveAfter, 4)),
        localizationOffsetsAfter: edges.map((edge) => round(edge.localizationAfter, 3)),
        maximumCornerMovement: round(maximumMovement, 3),
        movementLimit: round(movementLimit, 3),
      },
    },
  };
}

function refineEdge(start: Point, end: Point, image: ImageFeatures): EdgeSearchResult {
  const midpoint: Point = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const length = distance(start, end);
  const baseAngle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  let best = evaluateEdgeTransform(midpoint, length, baseAngle, 0, 0, image);
  const objectiveBefore = best.objective;

  for (let angleDegrees = -3; angleDegrees <= 3.0001; angleDegrees += 0.5) {
    for (let offset = -12; offset <= 12.0001; offset += 2) {
      const candidate = evaluateEdgeTransform(
        midpoint,
        length,
        baseAngle,
        angleDegrees * Math.PI / 180,
        offset,
        image,
      );
      if (candidate.selectionScore > best.selectionScore) best = candidate;
    }
  }

  const coarse = best;
  for (
    let angleDelta = coarse.angleDelta - 0.3 * Math.PI / 180;
    angleDelta <= coarse.angleDelta + 0.3001 * Math.PI / 180;
    angleDelta += 0.1 * Math.PI / 180
  ) {
    for (let offset = coarse.offset - 1; offset <= coarse.offset + 1.0001; offset += 0.5) {
      if (Math.abs(angleDelta) > 3 * Math.PI / 180 || Math.abs(offset) > 12) continue;
      const candidate = evaluateEdgeTransform(midpoint, length, baseAngle, angleDelta, offset, image);
      if (candidate.selectionScore > best.selectionScore) best = candidate;
    }
  }

  return {
    line: best.line,
    angleDelta: best.angleDelta,
    offset: best.offset,
    objectiveBefore,
    objectiveAfter: best.objective,
    localizationAfter: best.localizationOffset,
  };
}

function evaluateEdgeTransform(
  midpoint: Point,
  length: number,
  baseAngle: number,
  angleDelta: number,
  offset: number,
  image: ImageFeatures,
): {
  line: Line;
  angleDelta: number;
  offset: number;
  objective: number;
  localizationOffset: number;
  selectionScore: number;
} {
  const angle = baseAngle + angleDelta;
  const directionX = Math.cos(angle);
  const directionY = Math.sin(angle);
  const normalX = -directionY;
  const normalY = directionX;
  const shiftedMidpoint: Point = [
    midpoint[0] + normalX * offset,
    midpoint[1] + normalY * offset,
  ];
  const halfLength = length / 2;
  const start: Point = [
    shiftedMidpoint[0] - directionX * halfLength,
    shiftedMidpoint[1] - directionY * halfLength,
  ];
  const end: Point = [
    shiftedMidpoint[0] + directionX * halfLength,
    shiftedMidpoint[1] + directionY * halfLength,
  ];
  const evidence = evaluateEdgeEvidence(start, end, image);
  const objective = edgeObjective(evidence, image);
  const localizationScore = 1 - clamp(evidence.localizationOffset / 4, 0, 1);
  const regularization = 0.0015 * (
    Math.abs(angleDelta) / (3 * Math.PI / 180) +
    Math.abs(offset) / 12
  );
  return {
    line: {
      a: normalX,
      b: normalY,
      c: -(normalX * shiftedMidpoint[0] + normalY * shiftedMidpoint[1]),
    },
    angleDelta,
    offset,
    objective,
    localizationOffset: evidence.localizationOffset,
    selectionScore: objective + 0.02 * localizationScore - regularization,
  };
}

function edgeObjective(evidence: EdgeEvidence, image: ImageFeatures): number {
  const edgeStrength = clamp(
    evidence.medianStrength / Math.max(0.05, image.gradient.threshold * 1.8),
    0,
    1,
  );
  const signedContrast = clamp(evidence.signedContrast / 32, 0, 1);
  return (
    0.35 * edgeStrength +
    0.3 * evidence.supportRatio +
    0.2 * evidence.longestRunRatio +
    0.1 * evidence.gradientAlignment +
    0.05 * signedContrast
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
