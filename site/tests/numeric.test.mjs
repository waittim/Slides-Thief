import assert from "node:assert/strict";
import test from "node:test";

const { boundedPercentiles, percentile } = await import(
  new URL("../app/detection/numeric.ts", import.meta.url).href,
);

test("percentile preserves order-statistic semantics without changing the input", () => {
  const values = new Float64Array([8, 1, 3, 0]);
  assert.deepEqual(
    [0, 0.5, 0.75, 1].map((fraction) => percentile(values, fraction)),
    [0, 1, 3, 8],
  );
  assert.deepEqual(Array.from(values), [8, 1, 3, 0]);
  assert.equal(percentile(values, -1), 0);
  assert.equal(percentile(values, 2), 8);
  assert.equal(percentile(new Float64Array(), 0.5), 0);
});

test("bounded percentiles use fixed-range buckets with a bounded quantization error", () => {
  const values = new Float64Array([0.1, 1.9, 2.2, 9.8, 10.4]);
  assert.deepEqual(boundedPercentiles(values, [0, 0.5, 1]), [0, 2, 10]);
  assert.deepEqual(boundedPercentiles(values, []), []);
  assert.deepEqual(boundedPercentiles(new Float64Array(), [0.25, 0.75]), [0, 0]);
});
