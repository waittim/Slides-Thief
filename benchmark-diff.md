# Detection benchmark diff

This P1 detector now performs a two-pass batch analysis. Only non-fallback
results with confidence at or above `0.78` can form normalized camera-position
clusters, and each cluster requires at least three low-variance members.
Low-confidence review items can then try the cluster median as a locally
refined candidate, while current-image edge evidence remains mandatory.

| Metric | Baseline | Current | Change |
| --- | ---: | ---: | ---: |
| Mean corner error | 0.06833 | 0.00273 | −96.0% |
| Mean quad IoU | 0.72576 | 0.98659 | +0.26082 |
| All corners under 1% | 33.33% | 100.00% | +66.67 pp |
| Review rate | 0.00% | 0.00% | 0 pp |
| High-confidence failure rate | 33.33% | 0.00% | −33.33 pp |
| Runtime P95 | 626.23 ms | 973.77 ms | +55.5% |

The fixture set is still intentionally small, so these numbers establish a
regression signal rather than a general accuracy claim.

Single-image benchmark accuracy is unchanged because the batch prior is
disabled for independent detection: CLI mean corner error remains `0.00273`
with `0.98659` mean Quad IoU, while browser mean corner error remains
`0.00487` with `0.97777` mean Quad IoU.

P95 is `973.77 ms` for the CLI and `187.23 ms` in the browser; both remain
below the plan's three-times-baseline runtime ceiling. The two-pass batch
orchestration only reruns low-confidence review items when a safe cluster
actually exists.

The safety-critical high-confidence failure rate remains zero in both
implementations. The ten reported Downloads failures produced zero reliable
anchors and therefore zero batch priors, confirming that this stage does not
propagate their incorrect geometry.
