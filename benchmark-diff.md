# Detection benchmark diff

This P1 detector now calibrates confidence from the deduplicated top-two score
margin, minimum edge support, geometry validity, and cross-detector agreement.
Agreement requires at least two detector methods to support the selected
boundary at Quad IoU above `0.9`.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Mean corner error | 0.06833 | 0.00273 | −96.0% |
| Mean quad IoU | 0.72576 | 0.98659 | +0.26082 |
| All corners under 1% | 33.33% | 100.00% | +66.67 pp |
| Review rate | 0.00% | 0.00% | 0 pp |
| High-confidence failure rate | 33.33% | 0.00% | −33.33 pp |
| Runtime P95 | 626.23 ms | 987.65 ms | +57.7% |

The fixture set is still intentionally small, so these numbers establish a
regression signal rather than a general accuracy claim.

Compared with P1-5, confidence calibration reduces review rate from `33.33%`
to `0%` for the CLI and from `100%` to `0%` in the browser. Accuracy is
unchanged: CLI mean corner error remains `0.00273` with `0.98659` mean Quad
IoU, while browser mean corner error remains `0.00487` with `0.97777` mean
Quad IoU.

Convex polygon clipping provides exact agreement IoU without raster scanning.
P95 is `987.65 ms` for the CLI and `195.60 ms` in the browser; both remain
below the plan's three-times-baseline runtime ceiling.

The safety-critical high-confidence failure rate remains zero in both
implementations.
