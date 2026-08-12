#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { emptyCandidateFeatures } from "../app/detection/candidate-factory.ts";
import {
  geometryIsValid,
  lineIntersection,
  normalizedCornerDistance,
  quadIoU,
} from "../app/detection/geometry.ts";
import { average, percentile } from "../app/detection/numeric.ts";

const fixture = JSON.parse(await readFile(process.argv[2], "utf8"));
const geometry = fixture.geometry;
const numeric = fixture.numeric;
const intersectionLines = geometry.intersectionLines.map(([a, b, c]) => ({ a, b, c }));
const intersection = lineIntersection(...intersectionLines);

process.stdout.write(JSON.stringify({
  validGeometry: geometryIsValid(geometry.validQuad, geometry.width, geometry.height),
  invalidConcaveGeometry: geometryIsValid(geometry.invalidConcaveQuad, geometry.width, geometry.height),
  outOfBoundsGeometry: geometryIsValid(geometry.outOfBoundsQuad, geometry.width, geometry.height),
  intersection: Array.from(intersection),
  iou: quadIoU(fixture.iou.first, fixture.iou.second),
  normalizedCornerDistance: normalizedCornerDistance(
    fixture.distance.first,
    fixture.distance.second,
    fixture.distance.width,
    fixture.distance.height,
  ),
  average: average(numeric.values),
  percentiles: numeric.percentileFractions.map((fraction) => percentile(numeric.values, fraction)),
  emptyFeatureKeys: Object.keys(emptyCandidateFeatures()),
  emptyFeatureValues: Object.values(emptyCandidateFeatures()),
}));
