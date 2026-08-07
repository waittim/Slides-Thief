# Slide Thief Detection Algorithm Specification Standard

This document defines the canonical specification for the Slide Thief border detection pipeline across both the Python CLI (`src/slides_thief/detection/`) and the TypeScript Web App (`site/app/detection/`). Both implementations MUST strictly conform to these rules, scoring formulas, sampling limits, and threshold values.

---

## 1. Pipeline Overview

The slide boundary detector evaluates quadrilateral candidates from up to four sources:
1. **Contrast Lines Detector** (`contrast-lines`)
2. **Mask Lines Detector** (`mask-lines`)
3. **Hough Lines Detector** (`hough-lines`)
4. **Batch Prior Candidates** (`batch-prior`, optional)

All generated quad candidates are scored by the explainable **Candidate Scorer**, deduplicated, optionally refined by local edge optimization, and calibrated by the **Confidence Evaluator**.

---

## 2. Shared Candidate Scorer

Each candidate quad is assigned a `rawScore` calculated from 10 normalized features:

$$\text{rawScore} = \sum_{k} w_k \cdot f_k$$

| Feature Name | Weight ($w_k$) | Description |
| :--- | :--- | :--- |
| `edgeStrength` | `0.24` | Mean normalized gradient & contrast strength across all 4 edges |
| `edgeSupport` | `0.22` | Mean proportion of edge points with active gradient/contrast support |
| `edgeContinuity` | `0.03` | Mean continuity score ($longest\_run \times (1 - 0.35 \times largest\_gap)$) |
| `gradientAlignment` | `0.03` | Mean alignment of edge normal vector to local gradient orientation |
| `insideOutsideDifference` | `0.16` | Contrast difference across the 4 quad edges |
| `regionConsistency` | `0.12` | Uniformity of interior vs exterior region pixel intensity distributions |
| `geometryValidity` | `0.10` | Binary/continuous convex geometry sanity indicator (`1.0` if valid) |
| `normalizedArea` | `0.07` | Polygon area normalized relative to target `0.78` image area ratio |
| `aspectPrior` | `0.03` | Aspect ratio match prior ($\exp(-\|\ln(\text{aspect} / \text{ratio})\|)$) |
| `batchConsistency` | `0.015` | Prior agreement score if batch camera prior is available |

---

## 3. Candidate Deduplication Standard

When ranking and filtering quad candidates, candidate $B$ is considered a **duplicate** of candidate $A$ if either of the following conditions holds:

$$\text{quadIoU}(A, B) > 0.94 \quad \text{OR} \quad \text{normalizedCornerDistance}(A, B) < 0.012$$

Where:
- $\text{quadIoU}(A, B)$ is the exact convex polygon intersection area divided by union area.
- $\text{normalizedCornerDistance}(A, B) = \frac{1}{4 \cdot \text{diagonal}} \sum_{i=1}^{4} \|A_i - B_i\|_2$.

---

## 4. Detector Specs

### 4.1 Contrast Lines Detector (`contrast-lines`)
- **Horizontal Edge Sampling**:
  - Sample $X$ coordinates: 180 points linearly spaced between $0.16 \cdot W$ and $0.88 \cdot W$.
  - Normal offset: $\max(5.0, H \cdot 0.017)$.
  - Candidate $Y_0$ step: $\max(2, \lfloor H / 220 \rfloor)$.
  - Slopes: 29 values linearly spaced between $-0.22$ and $0.16$.
  - Minimum valid sample fraction: $0.82$.
  - Per-side candidate limit: 8. Minimum $Y$ separation between top and bottom lines: $0.18 \cdot H$.
- **Vertical Edge Sampling**:
  - Sample $Y$ coordinates: 170 points linearly spaced between $0.18 \cdot H$ and $0.84 \cdot H$.
  - Normal offset: $\max(5.0, W \cdot 0.012)$.
  - Candidate $X_0$ step: $\max(2, \lfloor W / 240 \rfloor)$.
  - Slopes: 31 values linearly spaced between $-0.24$ and $0.24$.
  - Minimum valid sample fraction: $0.80$.
  - Per-side candidate limit: 8. Minimum $X$ separation between left and right lines: $0.20 \cdot W$.
- **Raw Detector Candidate Score**:
  $$\text{detectorScore} = \text{mean}(S_{\text{top}}, S_{\text{bottom}}, S_{\text{left}}, S_{\text{right}}) + 10.0 \cdot \text{area\_norm} - \text{aspect\_error}$$
  where $\text{aspect\_error} = \left|\ln\left(\max\left(0.05, \frac{\text{aspect\_est}}{\text{ratio}}\right)\right)\right|$.

### 4.2 Mask Lines Detector (`mask-lines`)
- Low-saturation slide surface segmentation:
  - `primary`: $(\text{gray} > \text{threshold}) \land (\text{sat} < \text{sat\_threshold})$
  - `highlight`: $(\text{gray} > \max(115.0, p_{92} \cdot 0.78)) \land (\text{sat} < \text{sat\_threshold} + 18.0)$
  - `threshold`: $\max(24.0, \min(p_{55} - 5.0, p_{25} + (p_{92} - p_{25}) \cdot 0.16))$
  - `sat_threshold`: $\max(34.0, \min(78.0, p_{48}(\text{sat}) + 18.0))$
- Density blur: box blur with radius $\max(3, \text{round}(W \cdot 0.006))$.
- Line fitting: Robust PCA line fitting with outlier rejection ($8\%$ to $92\%$ quantile filter, $1.8 \times$ distance cutoff).
- Variants emitted per quad: `fitted` ($1.0\times$), `inset` ($0.985\times$), `outset` ($1.015\times$).

---

## 5. Confidence Calibration & Ambiguity Standard

- Threshold for automatic acceptance: `AUTO_REVIEW_CONFIDENCE = 0.68`.
- Calibrated confidence formula:
  $$\text{confidence} = \text{clamp}(0.30 \cdot S_{\text{best}} + 0.25 \cdot M_{\text{norm}} + 0.20 \cdot E_{\text{min}} + 0.15 \cdot A_{\text{det}} + 0.10 \cdot G_{\text{valid}}, 0.0, 1.0)$$
- Ambiguous candidate flag (`ambiguous_candidates`) is raised if:
  $$M_{\text{norm}} < 0.33 \quad \land \quad \text{quadIoU}(\text{best}, \text{second}) < 0.75 \quad \land \quad A_{\text{det}} < 0.8$$
