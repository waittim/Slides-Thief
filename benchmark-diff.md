# Detection benchmark diff

This P1 line-detection change adds a multi-scale opponent-color gradient,
orientation-guided probabilistic Hough candidates, free direction clustering,
and continuous edge evidence to the P0 hybrid detector.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Mean corner error | 0.06833 | 0.00294 | −95.7% |
| Mean quad IoU | 0.72576 | 0.98114 | +0.25538 |
| All corners under 1% | 33.33% | 100.00% | +66.67 pp |
| Review rate | 0.00% | 33.33% | +33.33 pp |
| High-confidence failure rate | 33.33% | 0.00% | −33.33 pp |
| Runtime P95 | 626.23 ms | 766.38 ms | +22.4% |

The fixture set is still intentionally small, so these numbers establish a
regression signal rather than a general accuracy claim.

Compared with the immediately preceding P0 implementation, CLI accuracy is
unchanged while P95 runtime increased from `690.88 ms` to `766.38 ms`.
The browser also preserves its P0 accuracy (`0.00566` mean corner error and
`0.97483` mean Quad IoU), with P95 increasing from `118.87 ms` to `173.13 ms`.
Both remain below the plan's three-times-baseline runtime ceiling.

Review rate is intentionally more conservative because the new Hough path can
surface a geometrically distinct runner-up. Confidence/margin calibration is
scheduled for P1-6; the safety-critical high-confidence failure rate remains
zero in both implementations.
