// Generated from schemas/detection-config.json; do not edit manually.

export const DETECTION_CONFIG = {
  "version": 1,
  "deduplication": {
    "iouThreshold": 0.94,
    "cornerDistanceThreshold": 0.012
  },
  "geometry": {
    "minimumAreaRatio": 0.08,
    "boundsRatio": 0.2,
    "minimumEdgeRatio": 0.1,
    "minimumAngleDegrees": 12,
    "maximumAngleDegrees": 168
  },
  "contrastLines": {
    "horizontalSampleCount": 180,
    "verticalSampleCount": 170,
    "horizontalOffsetRatio": 0.017,
    "verticalOffsetRatio": 0.012,
    "minimumOffset": 5,
    "topRange": [
      0.07,
      0.45
    ],
    "bottomRange": [
      0.42,
      0.92
    ],
    "leftRange": [
      0.01,
      0.46
    ],
    "rightRange": [
      0.54,
      0.99
    ],
    "horizontalStepDivisor": 220,
    "verticalStepDivisor": 240,
    "horizontalSlopeRange": [
      -0.22,
      0.16
    ],
    "verticalSlopeRange": [
      -0.24,
      0.24
    ],
    "horizontalSlopeCount": 29,
    "verticalSlopeCount": 31,
    "horizontalValidFraction": 0.82,
    "verticalValidFraction": 0.8,
    "candidateLimit": 8,
    "outputCandidateLimit": 1,
    "topBottomSeparationRatio": 0.18,
    "leftRightSeparationRatio": 0.2,
    "minimumScore": 3.5,
    "positivePercentile": 0.72,
    "positiveMeanWeight": 0.35,
    "minimumPositiveCount": 8,
    "minimumPositiveFraction": 0.12,
    "positionDeduplicationRatio": 0.035,
    "horizontalSlopeGap": 0.055,
    "verticalSlopeGap": 0.065,
    "minimumAreaRatio": 0.08,
    "aspectMinimumRatio": 0.45,
    "aspectMaximumRatio": 1.85
  },
  "maskLines": {
    "grayPercentiles": {
      "lower": 0.25,
      "threshold": 0.55,
      "highlight": 0.92
    },
    "thresholdOffset": 5,
    "thresholdRangeScale": 0.16,
    "primaryMinimumGray": 24,
    "primarySaturationMinimum": 34,
    "primarySaturationMaximum": 78,
    "primarySaturationPercentile": 0.48,
    "primarySaturationOffset": 18,
    "highlightMinimumGray": 115,
    "highlightGrayScale": 0.78,
    "highlightSaturationOffset": 18,
    "densityBlurRatio": 0.006,
    "densityThreshold": 0.38,
    "rowActiveFraction": 0.3,
    "rowSpanFraction": 0.5,
    "rowDensityFraction": 0.32,
    "columnActiveFraction": 0.24,
    "columnSpanFraction": 0.35,
    "columnDensityFraction": 0.3,
    "scanStep": 2,
    "fitMinimumPoints": 16,
    "fitMinimumWorkingPoints": 12,
    "fitLowQuantile": 0.08,
    "fitHighQuantile": 0.92,
    "fitOutlierQuantile": 0.7,
    "fitOutlierScale": 1.8,
    "fitOutlierFloor": 3,
    "fitIterations": 3,
    "variants": [
      {
        "name": "fitted",
        "scale": 1
      },
      {
        "name": "inset",
        "scale": 0.985
      },
      {
        "name": "outset",
        "scale": 1.015
      }
    ]
  },
  "gradient": {
    "pyramidScales": [
      1,
      0.67,
      0.45
    ],
    "thresholdFloor": 0.035,
    "thresholdPercentile": 0.85,
    "magnitudeScaleExponent": 0.5
  },
  "houghLines": {
    "angleBins": 90,
    "rhoStep": 3,
    "minimumEdgePoints": 48,
    "maximumEdgePointsBeforeStride": 28000,
    "strideWhenDense": 2,
    "voteWeightBase": 0.35,
    "voteMagnitudeCap": 1,
    "minimumVotes": 8,
    "minimumVotesRatio": 0.018,
    "voteAngleRadius": 2,
    "maximumPeaks": 40,
    "peakAngleDistance": 2,
    "peakRhoDistance": 3,
    "lineDistance": 2.75,
    "orientationToleranceDegrees": 12,
    "maximumGapFloor": 5,
    "maximumGapRatio": 0.012,
    "minimumSegmentLengthRatio": 0.08,
    "maximumSegments": 28,
    "lineDeduplicationAngleDegrees": 4,
    "lineDeduplicationRho": 5,
    "pairSeparationRatio": 0.16,
    "maximumPairs": 6,
    "outputCandidateLimit": 5,
    "areaScoreCap": 0.8,
    "supportWeightFloor": 0.15,
    "minimumFamilyAngleDegrees": 35,
    "maximumFamilyAngleDegrees": 145
  },
  "scoring": {
    "weights": {
      "edgeStrength": 0.24,
      "edgeSupport": 0.22,
      "edgeContinuity": 0.03,
      "gradientAlignment": 0.03,
      "insideOutsideDifference": 0.16,
      "regionConsistency": 0.12,
      "geometryValidity": 0.1,
      "normalizedArea": 0.07,
      "aspectPrior": 0.03,
      "batchConsistency": 0.015
    },
    "minimumEdgeSupport": 0.18,
    "weakEdgeSupportReview": 0.25,
    "edgeSampleMinimum": 96,
    "edgeSampleMaximum": 192,
    "edgeSamplesPerPixel": 3,
    "normalOffsetMinimum": 3,
    "normalOffsetMaximum": 8,
    "normalOffsetRatio": 0.012,
    "contrastSupportThreshold": 3,
    "mixedPolarityDelta": 0.08,
    "mixedPolarityMinimum": 0.18,
    "mixedPolarityScale": 0.82,
    "gradientSupportFloor": 0.025,
    "gradientSupportScale": 0.72,
    "gradientEdgeStrengthFloor": 0.05,
    "gradientEdgeStrengthScale": 1.8,
    "contrastEdgeStrengthScale": 42,
    "insideOutsideContrastScale": 32,
    "regionDifferenceScale": 72,
    "regionConsistencyScale": 90,
    "regionDistributionWeight": 0.65,
    "regionInsideConsistencyWeight": 0.35,
    "continuityGapWeight": 0.35,
    "normalizedAreaTarget": 0.78,
    "agreementCornerDistance": 0.035,
    "agreementIoU": 0.9,
    "edgeStrengthGradientWeight": 0.65,
    "edgeStrengthContrastWeight": 0.35,
    "gradientAlignmentMinimum": 0.45,
    "edgeContinuityWarning": 0.12,
    "contrastPercentile": 0.72,
    "medianPercentile": 0.5,
    "regionSamplingDivisor": 90,
    "formulaWeights": {
      "bestScore": 0.3,
      "margin": 0.25,
      "edgeSupport": 0.2,
      "detectorAgreement": 0.15,
      "geometryValidity": 0.1
    }
  },
  "confidence": {
    "autoReviewThreshold": 0.68,
    "marginScale": 0.18,
    "ambiguousMargin": 0.33,
    "ambiguousIoU": 0.75,
    "ambiguousAgreement": 0.8,
    "twoDetectorAgreement": 0.8,
    "minimumDetectorAgreement": 0.2
  },
  "batchPrior": {
    "minimumReliableConfidence": 0.78,
    "clusterDistance": 0.045,
    "minimumClusterMembers": 3,
    "maximumRmsDeviation": 0.028,
    "consistencyScale": 0.035
  },
  "refinement": {
    "movementRatio": 0.04,
    "coarseAngleRangeDegrees": 3,
    "coarseAngleStepDegrees": 0.5,
    "coarseOffset": 12,
    "coarseOffsetStep": 2,
    "fineAngleRangeDegrees": 0.3,
    "fineAngleStepDegrees": 0.1,
    "fineOffsetRange": 1,
    "fineOffsetStep": 0.5,
    "regularizationWeight": 0.0015,
    "localizationScale": 4,
    "gradientStrengthFloor": 0.05,
    "gradientStrengthScale": 1.8,
    "signedContrastScale": 32,
    "edgeObjectiveWeights": {
      "edgeStrength": 0.35,
      "edgeSupport": 0.3,
      "edgeContinuity": 0.2,
      "gradientAlignment": 0.1,
      "signedContrast": 0.05
    }
  },
  "fallback": {
    "marginXRatio": 0.045,
    "marginYRatio": 0.055
  }
} as const;
