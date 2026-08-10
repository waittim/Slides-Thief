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
import { DETECTION_CONFIG } from "./config.ts";

const REFINEMENT_CONFIG = DETECTION_CONFIG.refinement;

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
  const movementLimit = Math.hypot(image.width, image.height) * REFINEMENT_CONFIG.movementRatio;
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

  for (
    let angleDegrees = -REFINEMENT_CONFIG.coarseAngleRangeDegrees;
    angleDegrees <= REFINEMENT_CONFIG.coarseAngleRangeDegrees + 0.0001;
    angleDegrees += REFINEMENT_CONFIG.coarseAngleStepDegrees
  ) {
    for (
      let offset = -REFINEMENT_CONFIG.coarseOffset;
      offset <= REFINEMENT_CONFIG.coarseOffset + 0.0001;
      offset += REFINEMENT_CONFIG.coarseOffsetStep
    ) {
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
    let angleDelta = coarse.angleDelta - REFINEMENT_CONFIG.fineAngleRangeDegrees * Math.PI / 180;
    angleDelta <= coarse.angleDelta + (REFINEMENT_CONFIG.fineAngleRangeDegrees + 0.0001) * Math.PI / 180;
    angleDelta += REFINEMENT_CONFIG.fineAngleStepDegrees * Math.PI / 180
  ) {
    for (
      let offset = coarse.offset - REFINEMENT_CONFIG.fineOffsetRange;
      offset <= coarse.offset + REFINEMENT_CONFIG.fineOffsetRange + 0.0001;
      offset += REFINEMENT_CONFIG.fineOffsetStep
    ) {
      if (
        Math.abs(angleDelta) > REFINEMENT_CONFIG.coarseAngleRangeDegrees * Math.PI / 180 ||
        Math.abs(offset) > REFINEMENT_CONFIG.coarseOffset
      ) continue;
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
  const localizationScore = 1 - clamp(
    evidence.localizationOffset / REFINEMENT_CONFIG.localizationScale,
    0,
    1,
  );
  const regularization = REFINEMENT_CONFIG.regularizationWeight * (
    Math.abs(angleDelta) / (REFINEMENT_CONFIG.coarseAngleRangeDegrees * Math.PI / 180) +
    Math.abs(offset) / REFINEMENT_CONFIG.coarseOffset
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
    evidence.medianStrength / Math.max(
      REFINEMENT_CONFIG.gradientStrengthFloor,
      image.gradient.threshold * REFINEMENT_CONFIG.gradientStrengthScale,
    ),
    0,
    1,
  );
  const signedContrast = clamp(
    evidence.signedContrast / REFINEMENT_CONFIG.signedContrastScale,
    0,
    1,
  );
  return (
    REFINEMENT_CONFIG.edgeObjectiveWeights.edgeStrength * edgeStrength +
    REFINEMENT_CONFIG.edgeObjectiveWeights.edgeSupport * evidence.supportRatio +
    REFINEMENT_CONFIG.edgeObjectiveWeights.edgeContinuity * evidence.longestRunRatio +
    REFINEMENT_CONFIG.edgeObjectiveWeights.gradientAlignment * evidence.gradientAlignment +
    REFINEMENT_CONFIG.edgeObjectiveWeights.signedContrast * signedContrast
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
