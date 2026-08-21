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
