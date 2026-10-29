import type { Quad } from "../detection/types";

export function solveLinearSystem(matrix: number[][], vector: number[]) {
  const n = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    }
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const divisor = rows[col][col] || 1e-12;
    for (let j = col; j <= n; j += 1) rows[col][j] /= divisor;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = rows[row][col];
      for (let j = col; j <= n; j += 1) rows[row][j] -= factor * rows[col][j];
    }
  }
  return rows.map((row) => row[n]);
}

export function perspectiveCoefficients(src: Quad, dst: Quad) {
  const matrix: number[][] = [];
  const vector: number[] = [];
  dst.forEach(([x, y], index) => {
    const [u, v] = src[index];
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    vector.push(u, v);
  });
  return solveLinearSystem(matrix, vector);
}

export function containedRect(width: number, height: number, ratio: number): Quad {
  const pageRatio = width / height;
  const contentWidth = pageRatio > ratio ? height * ratio : width;
  const contentHeight = pageRatio > ratio ? height : width / ratio;
  const left = (width - contentWidth) / 2;
  const top = (height - contentHeight) / 2;
  return [
    [left, top],
    [left + contentWidth, top],
    [left + contentWidth, top + contentHeight],
    [left, top + contentHeight],
  ];
}

export type ExtrapolateCornerOptions = {
  targetRatio?: number;
  mode?: "auto" | "affine" | "perspective";
  imageWidth?: number;
  imageHeight?: number;
};

/**
 * Extrapolates a single missing, occluded, or truncated corner of a quadrilateral
 * using the remaining 3 corners and geometric perspective / affine constraints.
 *
 * @param quad The 4 corners in canonical order [TL, TR, BR, BL]
 * @param targetIndex Index of the corner to extrapolate (0..3)
 * @param options Optional configuration: targetRatio, mode, and image dimensions
 * @returns A new Quad with targetIndex replaced by its extrapolated coordinates
 */
export function extrapolateCorner(
  quad: Quad,
  targetIndex: number,
  options?: ExtrapolateCornerOptions,
): Quad {
  const k = ((targetIndex % 4) + 4) % 4;

  // In canonical quad [0=TL, 1=TR, 2=BR, 3=BL]:
  // (0, 1) and (3, 2) are horizontal pairs; (0, 3) and (1, 2) are vertical pairs.
  let hIdx: number;
  let vIdx: number;
  let oppIdx: number;

  if (k === 0) {
    hIdx = 1;
    vIdx = 3;
    oppIdx = 2;
  } else if (k === 1) {
    hIdx = 0;
    vIdx = 2;
    oppIdx = 3;
  } else if (k === 2) {
    hIdx = 3;
    vIdx = 1;
    oppIdx = 0;
  } else {
    hIdx = 2;
    vIdx = 0;
    oppIdx = 1;
  }

  const [xH, yH] = quad[hIdx];
  const [xV, yV] = quad[vIdx];
  const [xOpp, yOpp] = quad[oppIdx];

  // 1. Affine completion baseline: P_k = P_h + P_v - P_opp
  const affinePoint: [number, number] = [
    xH + xV - xOpp,
    yH + yV - yOpp,
  ];

  if (options?.mode === "affine") {
    const next = quad.map(([x, y]) => [x, y]) as Quad;
    next[k] = affinePoint;
    return next;
  }

  // 2. Perspective ray convergence
  const vHOpp = [xV - xOpp, yV - yOpp];
  const vVOpp = [xH - xOpp, yH - yOpp];
  const lHOpp = Math.hypot(vHOpp[0], vHOpp[1]);
  const lVOpp = Math.hypot(vVOpp[0], vVOpp[1]);

  if (lHOpp < 1e-6 || lVOpp < 1e-6) {
    const next = quad.map(([x, y]) => [x, y]) as Quad;
    next[k] = affinePoint;
    return next;
  }

  const uHOpp = [vHOpp[0] / lHOpp, vHOpp[1] / lHOpp];
  const uVOpp = [vVOpp[0] / lVOpp, vVOpp[1] / lVOpp];

  // Inward normal to horizontal edge pointing towards v
  let nH = [-uHOpp[1], uHOpp[0]];
  if (nH[0] * uVOpp[0] + nH[1] * uVOpp[1] < 0) {
    nH = [-nH[0], -nH[1]];
  }

  // Tilt angle of opposite vertical edge relative to horizontal normal
  const th = Math.atan2(
    uVOpp[0] * uHOpp[0] + uVOpp[1] * uHOpp[1],
    uVOpp[0] * nH[0] + uVOpp[1] * nH[1],
  );

  const rayV = [
    Math.cos(-th) * nH[0] + Math.sin(-th) * uHOpp[0],
    Math.cos(-th) * nH[1] + Math.sin(-th) * uHOpp[1],
  ];
  const rayH = uHOpp;

  // Intersect: P_h + s * rayH = P_v + t * rayV
  // [rayH_x  -rayV_x] [s] = [xV - xH]
  // [rayH_y  -rayV_y] [t]   [yV - yH]
  const det = rayH[0] * (-rayV[1]) - (-rayV[0]) * rayH[1];
  let resultPoint = affinePoint;

  if (Math.abs(det) > 1e-4) {
    const dx = xV - xH;
    const dy = yV - yH;
    const s = (dx * (-rayV[1]) - (-rayV[0]) * dy) / det;
    const t = (rayH[0] * dy - dx * rayH[1]) / det;

    if (s > 0.05 * lHOpp && t > 0.05 * lVOpp && s < 10.0 * lHOpp && t < 10.0 * lVOpp) {
      resultPoint = [xH + s * rayH[0], yH + s * rayH[1]];
    }
  }

  // 3. Optional clamping if image boundaries are provided
  if (options?.imageWidth && options?.imageHeight) {
    const maxOutsideX = Math.round(options.imageWidth * 0.3);
    const maxOutsideY = Math.round(options.imageHeight * 0.3);
    resultPoint = [
      Math.max(-maxOutsideX, Math.min(options.imageWidth + maxOutsideX, resultPoint[0])),
      Math.max(-maxOutsideY, Math.min(options.imageHeight + maxOutsideY, resultPoint[1])),
    ];
  }

  const next = quad.map(([x, y]) => [x, y]) as Quad;
  next[k] = [Math.round(resultPoint[0] * 100) / 100, Math.round(resultPoint[1] * 100) / 100];
  return next;
}
