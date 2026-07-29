# Detection benchmark diff

This P0 hybrid-detector change runs contrast and mask detectors together,
supports both edge polarities, and ranks all valid candidates with the shared
linear feature score.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Mean corner error | 0.06833 | 0.00294 | −95.7% |
| Mean quad IoU | 0.72576 | 0.98114 | +0.25538 |
| All corners under 1% | 33.33% | 100.00% | +66.67 pp |
| Review rate | 0.00% | 0.00% | 0 pp |
| High-confidence failure rate | 33.33% | 0.00% | −33.33 pp |
| Runtime P95 | 626.23 ms | 690.88 ms | +10.3% |

The fixture set is still intentionally small, so these numbers establish a
regression signal rather than a general accuracy claim.

The browser benchmark shows the same direction: mean corner error improved
from `0.09460` to `0.00566`, mean Quad IoU improved from `0.61713` to
`0.97483`, and the high-confidence failure rate fell from `33.33%` to `0%`.
