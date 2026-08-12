import type {
  BatchPrior,
  PreliminaryResult,
  Quad,
  QuadCandidate,
} from "./types.ts";
import { DETECTION_CONFIG } from "./config.ts";
import { createCandidate, emptyCandidateFeatures } from "./candidate-factory.ts";
import { average, clamp, round } from "./numeric.ts";

const BATCH_CONFIG = DETECTION_CONFIG.batchPrior;

export function buildBatchPriors(results: PreliminaryResult[]): BatchPrior[] {
  const reliable = results.filter((result) =>
    result.confidence >= BATCH_CONFIG.minimumReliableConfidence && result.method !== "fallback-frame"
  );
  const clusters: PreliminaryResult[][] = [];
  for (const result of reliable) {
    const orientation = imageOrientation(result.width, result.height);
    let bestCluster: PreliminaryResult[] | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const cluster of clusters) {
      if (imageOrientation(cluster[0].width, cluster[0].height) !== orientation) continue;
      const center = medianQuad(cluster.map((item) => item.normalizedQuad));
      const distance = normalizedQuadDistance(result.normalizedQuad, center);
      if (distance < BATCH_CONFIG.clusterDistance && distance < bestDistance) {
        bestCluster = cluster;
        bestDistance = distance;
      }
    }
    if (bestCluster) bestCluster.push(result);
    else clusters.push([result]);
  }

  const priors: BatchPrior[] = [];
  for (const cluster of clusters) {
    if (cluster.length < BATCH_CONFIG.minimumClusterMembers) continue;
    const normalizedQuad = medianQuad(cluster.map((item) => item.normalizedQuad));
    const rmsDeviation = Math.sqrt(
      average(cluster.map((item) => normalizedQuadDistance(item.normalizedQuad, normalizedQuad) ** 2)),
    );
    if (rmsDeviation >= BATCH_CONFIG.maximumRmsDeviation) continue;
    priors.push({
      id: `camera-position-cluster-${priors.length + 1}`,
      orientation: imageOrientation(cluster[0].width, cluster[0].height),
      normalizedQuad,
      memberCount: cluster.length,
      rmsDeviation,
      consistency: clamp(1 - rmsDeviation / BATCH_CONFIG.consistencyScale, 0, 1),
    });
  }
  return priors;
}

export function batchPriorCandidates(
  priors: BatchPrior[],
  width: number,
  height: number,
): QuadCandidate[] {
  const orientation = imageOrientation(width, height);
  return priors
    .filter((prior) => prior.orientation === orientation)
    .map((prior) => createCandidate(
      "batch-prior",
      prior.normalizedQuad.map(([x, y]) => [x * width, y * height]) as Quad,
      0,
      {
        batchPriorId: prior.id,
        batchPriorMemberCount: prior.memberCount,
        batchPriorRmsDeviation: round(prior.rmsDeviation, 5),
        batchPriorConsistency: round(prior.consistency, 4),
      },
      { ...emptyCandidateFeatures(), batchConsistency: prior.consistency },
    ));
}

export function normalizeResult(
  imageId: string,
  width: number,
  height: number,
  quad: Quad,
  confidence: number,
  method: PreliminaryResult["method"],
  needsReview: boolean,
): PreliminaryResult {
  return {
    imageId,
    width,
    height,
    normalizedQuad: quad.map(([x, y]) => [x / width, y / height]) as Quad,
    confidence,
    method,
    needsReview,
  };
}

function medianQuad(quads: Quad[]): Quad {
  return Array.from({ length: 4 }, (_, corner) => [
    median(quads.map((quad) => quad[corner][0])),
    median(quads.map((quad) => quad[corner][1])),
  ]) as Quad;
}

function normalizedQuadDistance(first: Quad, second: Quad): number {
  return average(first.map((point, index) =>
    Math.hypot(point[0] - second[index][0], point[1] - second[index][1])
  ));
}

function imageOrientation(width: number, height: number): "landscape" | "portrait" {
  return width >= height ? "landscape" : "portrait";
}

function median(values: number[]): number {
  const ordered = [...values].sort((first, second) => first - second);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}
