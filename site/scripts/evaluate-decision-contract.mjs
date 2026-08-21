#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import { isAmbiguousCandidate } from "../app/detection/confidence.ts";

const cases = JSON.parse(await readFile(process.argv[2], "utf8"));
process.stdout.write(JSON.stringify(
  cases.map((item) => isAmbiguousCandidate(item.secondBestIoU, {
    normalizedMargin: item.breakdown.normalized_margin ?? item.breakdown.normalizedMargin,
    detectorAgreement: item.breakdown.detector_agreement ?? item.breakdown.detectorAgreement,
  }))),
);
