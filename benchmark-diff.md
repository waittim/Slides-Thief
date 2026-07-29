# Detection benchmark diff

This P1 detector now includes local four-edge refinement after multi-scale
gradient, orientation-guided Hough, free direction clustering, and continuous
edge scoring. Refinement uses coarse and fine angle/offset searches and is kept
only when geometry stays valid and the shared candidate score does not fall.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Mean corner error | 0.06833 | 0.00273 | −96.0% |
| Mean quad IoU | 0.72576 | 0.98659 | +0.26082 |
| All corners under 1% | 33.33% | 100.00% | +66.67 pp |
| Review rate | 0.00% | 33.33% | +33.33 pp |
| High-confidence failure rate | 33.33% | 0.00% | −33.33 pp |
| Runtime P95 | 626.23 ms | 999.34 ms | +59.6% |

The fixture set is still intentionally small, so these numbers establish a
regression signal rather than a general accuracy claim.

Compared with the immediately preceding P1 line detector, refinement reduces
CLI mean corner error from `0.00294` to `0.00273` and raises mean Quad IoU from
`0.98114` to `0.98659`. Browser mean corner error falls from `0.00566` to
`0.00487`, while mean Quad IoU rises from `0.97483` to `0.97777`.

The extra search raises P95 to `999.34 ms` for the CLI and `195.93 ms` in the
browser. Both remain below the plan's three-times-baseline runtime ceiling.

Review rate is intentionally more conservative because the new Hough path can
surface a geometrically distinct runner-up. Confidence/margin calibration is
scheduled for P1-6; the safety-critical high-confidence failure rate remains
zero in both implementations.
