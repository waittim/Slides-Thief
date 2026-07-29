import assert from "node:assert/strict";
import test from "node:test";

const { constrainedImageSize } = await import(
  new URL("../app/image-sizing.ts", import.meta.url).href
);

test("image sizing respects width and pixel budgets for landscape photos", () => {
  const result = constrainedImageSize(12000, 3000, 900, 1_200_000);

  assert.ok(result.width <= 900);
  assert.ok(result.pixels <= 1_200_000);
  assert.equal(result.width / result.height, 4);
});

test("image sizing caps tall-photo memory even when width is already small", () => {
  const result = constrainedImageSize(900, 12000, 900, 1_200_000);

  assert.ok(result.width < 900);
  assert.ok(result.pixels <= 1_200_000);
  assert.ok(result.scale < 1);
});

test("image sizing leaves small images unchanged and rejects invalid dimensions", () => {
  assert.deepEqual(constrainedImageSize(320, 240, 900, 1_200_000), {
    width: 320,
    height: 240,
    scale: 1,
    pixels: 76800,
  });
  assert.throws(() => constrainedImageSize(0, 240, 900, 1_200_000));
});
