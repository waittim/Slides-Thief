# Detection benchmark diff

This foundation change intentionally preserves the existing CLI detection
algorithm. `benchmark-current.json` therefore matches
`benchmark-baseline.json`; no accuracy improvement is claimed.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Mean corner error | 0.06833 | 0.06833 | 0 |
| Mean quad IoU | 0.72576 | 0.72576 | 0 |
| All corners under 1% | 33.33% | 33.33% | 0 pp |
| Review rate | 0.00% | 0.00% | 0 pp |
| High-confidence failure rate | 33.33% | 33.33% | 0 pp |

Runtime figures are recorded in the JSON snapshot but are excluded from the
diff because they are sensitive to machine load on this three-image starter
fixture set.
