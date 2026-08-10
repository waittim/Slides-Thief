import {
  geometryIsValid,
  lineIntersection,
  orderQuad,
  polygonArea,
  type Line,
} from "./geometry.ts";
import { DETECTION_CONFIG } from "./config.ts";
import type {
  CandidateDetector,
  CandidateFeatures,
  ImageFeatures,
  Point,
  Quad,
  QuadCandidate,
} from "./types.ts";

const HOUGH_CONFIG = DETECTION_CONFIG.houghLines;

type EdgePoint = {
  x: number;
  y: number;
  magnitude: number;
  orientation: number;
};

type LineSegment = {
  line: Line;
  start: Point;
  end: Point;
  angle: number;
  normalAngle: number;
  rho: number;
  length: number;
  support: number;
};

type HoughPeak = {
  angleIndex: number;
  rhoIndex: number;
  votes: number;
};

const EMPTY_FEATURES: CandidateFeatures = {
  edgeStrength: 0,
  edgeSupport: 0,
  edgeContinuity: 0,
  gradientAlignment: 0,
  insideOutsideDifference: 0,
  regionConsistency: 0,
  normalizedArea: 0,
  geometryValidity: 0,
  aspectPrior: 0,
  batchConsistency: 0,
};

const ANGLE_STEP = Math.PI / HOUGH_CONFIG.angleBins;
const RHO_STEP = HOUGH_CONFIG.rhoStep;

export const houghLineDetector: CandidateDetector = {
  name: "hough-lines",
  detect(features: ImageFeatures): QuadCandidate[] {
    const edgePoints = collectEdgePoints(features);
    if (edgePoints.length < HOUGH_CONFIG.minimumEdgePoints) return [];
    const peaks = voteForLines(edgePoints, features.width, features.height);
    const segments = extractSegments(peaks, edgePoints, features.width, features.height);
    const families = clusterDirections(segments);
    if (!families) return [];
    const [firstFamily, secondFamily] = families;
    const familyAngle = directionDifference(firstFamily.angle, secondFamily.angle);
    if (
      familyAngle < HOUGH_CONFIG.minimumFamilyAngleDegrees * Math.PI / 180 ||
      familyAngle > HOUGH_CONFIG.maximumFamilyAngleDegrees * Math.PI / 180
    ) return [];

    const firstPairs = generateLinePairs(firstFamily.segments, features.width, features.height);
    const secondPairs = generateLinePairs(secondFamily.segments, features.width, features.height);
    const candidates: Array<{ quad: Quad; detectorScore: number; lineSupport: number[] }> = [];
    for (const firstPair of firstPairs) {
      for (const secondPair of secondPairs) {
        const quad = orderQuad([
          lineIntersection(firstPair[0].line, secondPair[0].line),
          lineIntersection(firstPair[0].line, secondPair[1].line),
          lineIntersection(firstPair[1].line, secondPair[1].line),
          lineIntersection(firstPair[1].line, secondPair[0].line),
        ]);
        if (!geometryIsValid(quad, features.width, features.height)) continue;
        const area = polygonArea(quad) / (features.width * features.height);
        const lineSupport = [...firstPair, ...secondPair].map((segment) => segment.support);
        const detectorScore = average(lineSupport) + Math.min(HOUGH_CONFIG.areaScoreCap, area);
        candidates.push({ quad, detectorScore, lineSupport });
      }
    }

    return candidates
      .sort((first, second) => second.detectorScore - first.detectorScore)
      .filter((candidate, index, all) =>
        all.findIndex((other) =>
          quadDistance(candidate.quad, other.quad, features.width, features.height) <
            DETECTION_CONFIG.deduplication.cornerDistanceThreshold
        ) ===
          index
      )
      .slice(0, HOUGH_CONFIG.outputCandidateLimit)
      .map((candidate) => ({
        quad: candidate.quad,
        method: "hough-lines",
        polarity: [],
        features: { ...EMPTY_FEATURES },
        rawScore: candidate.detectorScore,
        warnings: [],
        diagnostics: {
          edgePointCount: edgePoints.length,
          houghPeakCount: peaks.length,
          segmentCount: segments.length,
          familyAngleDegrees: round(familyAngle * 180 / Math.PI, 2),
          lineSupport: candidate.lineSupport.map((value) => round(value, 3)),
          gradientThreshold: round(features.gradient.threshold, 4),
          gradientScales: features.gradient.scales,
        },
      }));
  },
};

function collectEdgePoints(features: ImageFeatures): EdgePoint[] {
  const { magnitude, orientation, threshold } = features.gradient;
  const rawCount = magnitude.reduce((count, value) => count + (value >= threshold ? 1 : 0), 0);
  const stride = rawCount > HOUGH_CONFIG.maximumEdgePointsBeforeStride
    ? HOUGH_CONFIG.strideWhenDense
    : 1;
  const points: EdgePoint[] = [];
  for (let y = 1; y < features.height - 1; y += stride) {
    for (let x = 1; x < features.width - 1; x += stride) {
      const index = y * features.width + x;
      if (magnitude[index] < threshold) continue;
      points.push({ x, y, magnitude: magnitude[index], orientation: normalizeAngle(orientation[index]) });
    }
  }
  return points;
}

function voteForLines(edgePoints: EdgePoint[], width: number, height: number): HoughPeak[] {
  const diagonal = Math.hypot(width, height);
  const angleBins = HOUGH_CONFIG.angleBins;
  const rhoBins = Math.ceil(diagonal * 2 / RHO_STEP) + 1;
  const accumulator = new Float64Array(angleBins * rhoBins);
  for (const point of edgePoints) {
    const centerIndex = Math.round(point.orientation / ANGLE_STEP) % angleBins;
    for (let offset = -HOUGH_CONFIG.voteAngleRadius; offset <= HOUGH_CONFIG.voteAngleRadius; offset += 1) {
      const angleIndex = modulo(centerIndex + offset, angleBins);
      const angle = angleIndex * ANGLE_STEP;
      const rho = point.x * Math.cos(angle) + point.y * Math.sin(angle);
      const rhoIndex = Math.round((rho + diagonal) / RHO_STEP);
      accumulator[angleIndex * rhoBins + rhoIndex] +=
        HOUGH_CONFIG.voteWeightBase + Math.min(HOUGH_CONFIG.voteMagnitudeCap, point.magnitude);
    }
  }

  const peakCandidates: HoughPeak[] = [];
  for (let angleIndex = 0; angleIndex < angleBins; angleIndex += 1) {
    for (let rhoIndex = 0; rhoIndex < rhoBins; rhoIndex += 1) {
      const votes = accumulator[angleIndex * rhoBins + rhoIndex];
      if (votes >= Math.max(HOUGH_CONFIG.minimumVotes, Math.min(width, height) * HOUGH_CONFIG.minimumVotesRatio)) {
        peakCandidates.push({ angleIndex, rhoIndex, votes });
      }
    }
  }
  peakCandidates.sort((first, second) => second.votes - first.votes);
  const peaks: HoughPeak[] = [];
  for (const candidate of peakCandidates) {
    if (peaks.every((peak) =>
      circularBinDistance(candidate.angleIndex, peak.angleIndex, angleBins) > HOUGH_CONFIG.peakAngleDistance ||
      Math.abs(candidate.rhoIndex - peak.rhoIndex) > HOUGH_CONFIG.peakRhoDistance
    )) {
      peaks.push(candidate);
    }
    if (peaks.length >= HOUGH_CONFIG.maximumPeaks) break;
  }
  return peaks;
}

function extractSegments(
  peaks: HoughPeak[],
  edgePoints: EdgePoint[],
  width: number,
  height: number,
): LineSegment[] {
  const diagonal = Math.hypot(width, height);
  const candidates: LineSegment[] = [];
  for (const peak of peaks) {
    const normalAngle = peak.angleIndex * ANGLE_STEP;
    const normalX = Math.cos(normalAngle);
    const normalY = Math.sin(normalAngle);
    const directionX = -normalY;
    const directionY = normalX;
    const rho = peak.rhoIndex * RHO_STEP - diagonal;
    const aligned = edgePoints
      .filter((point) =>
        Math.abs(point.x * normalX + point.y * normalY - rho) <= HOUGH_CONFIG.lineDistance &&
        orientationDifference(point.orientation, normalAngle) <= HOUGH_CONFIG.orientationToleranceDegrees * Math.PI / 180
      )
      .map((point) => ({ point, projection: point.x * directionX + point.y * directionY }))
      .sort((first, second) => first.projection - second.projection);
    if (aligned.length < HOUGH_CONFIG.minimumEdgePoints) continue;

    const groups: typeof aligned[] = [];
    let group: typeof aligned = [aligned[0]];
    const maximumGap = Math.max(HOUGH_CONFIG.maximumGapFloor, diagonal * HOUGH_CONFIG.maximumGapRatio);
    for (let index = 1; index < aligned.length; index += 1) {
      if (aligned[index].projection - aligned[index - 1].projection > maximumGap) {
        groups.push(group);
        group = [];
      }
      group.push(aligned[index]);
    }
    groups.push(group);

    for (const support of groups) {
      const first = support[0].projection;
      const last = support[support.length - 1].projection;
      const length = last - first;
      if (length < diagonal * HOUGH_CONFIG.minimumSegmentLengthRatio) continue;
      candidates.push({
        line: { a: normalX, b: normalY, c: -rho },
        start: [normalX * rho + directionX * first, normalY * rho + directionY * first],
        end: [normalX * rho + directionX * last, normalY * rho + directionY * last],
        angle: normalizeAngle(normalAngle + Math.PI / 2),
        normalAngle,
        rho,
        length,
        support: Math.min(1, support.length / Math.max(1, length / 2)),
      });
    }
  }
  candidates.sort((first, second) => second.length * second.support - first.length * first.support);
  const selected: LineSegment[] = [];
  for (const segment of candidates) {
    if (selected.every((kept) =>
      orientationDifference(segment.normalAngle, kept.normalAngle) >
        HOUGH_CONFIG.lineDeduplicationAngleDegrees * Math.PI / 180 ||
      Math.abs(segment.rho - kept.rho) > HOUGH_CONFIG.lineDeduplicationRho
    )) {
      selected.push(segment);
    }
    if (selected.length >= HOUGH_CONFIG.maximumSegments) break;
  }
  return selected;
}

function clusterDirections(segments: LineSegment[]): [
  { angle: number; segments: LineSegment[] },
  { angle: number; segments: LineSegment[] },
] | null {
  if (segments.length < 4) return null;
  const vectors = segments.map((segment) => [Math.cos(2 * segment.angle), Math.sin(2 * segment.angle)] as Point);
  let centers: [Point, Point] = [
    [...vectors[0]] as Point,
    [...vectors[vectors.reduce((best, vector, index) =>
      squaredDistance(vector, vectors[0]) > squaredDistance(vectors[best], vectors[0]) ? index : best
    , 0)]] as Point,
  ];
  let assignments = new Array<number>(segments.length).fill(0);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    assignments = vectors.map((vector) =>
      squaredDistance(vector, centers[0]) <= squaredDistance(vector, centers[1]) ? 0 : 1
    );
    centers = [0, 1].map((family) => {
      let x = 0;
      let y = 0;
      let weight = 0;
      segments.forEach((segment, index) => {
        if (assignments[index] !== family) return;
        const itemWeight = segment.length * Math.max(HOUGH_CONFIG.supportWeightFloor, segment.support);
        x += vectors[index][0] * itemWeight;
        y += vectors[index][1] * itemWeight;
        weight += itemWeight;
      });
      return weight ? [x / weight, y / weight] as Point : centers[family];
    }) as [Point, Point];
  }
  const grouped = [0, 1].map((family) => segments.filter((_, index) => assignments[index] === family));
  if (grouped.some((group) => group.length < 2)) return null;
  return [
    { angle: normalizeAngle(0.5 * Math.atan2(centers[0][1], centers[0][0])), segments: grouped[0] },
    { angle: normalizeAngle(0.5 * Math.atan2(centers[1][1], centers[1][0])), segments: grouped[1] },
  ];
}

function generateLinePairs(segments: LineSegment[], width: number, height: number): Array<[LineSegment, LineSegment]> {
  const center: Point = [width / 2, height / 2];
  const positioned = segments.map((segment) => ({
    segment,
    position: segment.line.a * center[0] + segment.line.b * center[1] + segment.line.c,
  }));
  const pairs: Array<{ pair: [LineSegment, LineSegment]; score: number }> = [];
  for (let first = 0; first < positioned.length; first += 1) {
    for (let second = first + 1; second < positioned.length; second += 1) {
      const separation = Math.abs(positioned[first].position - positioned[second].position);
      if (separation < Math.min(width, height) * HOUGH_CONFIG.pairSeparationRatio) continue;
      const straddlesCenter = positioned[first].position * positioned[second].position <= 0;
      const support = positioned[first].segment.support + positioned[second].segment.support;
      const length = positioned[first].segment.length + positioned[second].segment.length;
      pairs.push({
        pair: [positioned[first].segment, positioned[second].segment],
        score: support + length / Math.hypot(width, height) + (straddlesCenter ? 0.45 : 0),
      });
    }
  }
  return pairs
    .sort((first, second) => second.score - first.score)
    .slice(0, HOUGH_CONFIG.maximumPairs)
    .map((item) => item.pair);
}

function normalizeAngle(angle: number): number {
  return modulo(angle, Math.PI);
}

function orientationDifference(first: number, second: number): number {
  const difference = Math.abs(normalizeAngle(first) - normalizeAngle(second));
  return Math.min(difference, Math.PI - difference);
}

function directionDifference(first: number, second: number): number {
  return orientationDifference(first, second);
}

function circularBinDistance(first: number, second: number, count: number): number {
  const difference = Math.abs(first - second);
  return Math.min(difference, count - difference);
}

function modulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function squaredDistance(first: Point, second: Point): number {
  return (first[0] - second[0]) ** 2 + (first[1] - second[1]) ** 2;
}

function quadDistance(first: Quad, second: Quad, width: number, height: number): number {
  const diagonal = Math.hypot(width, height);
  return average(first.map((point, index) => Math.hypot(point[0] - second[index][0], point[1] - second[index][1]))) /
    diagonal;
}

function average(values: ArrayLike<number>): number {
  if (!values.length) return 0;
  let total = 0;
  for (let index = 0; index < values.length; index += 1) total += values[index];
  return total / values.length;
}

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
