import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const { constrainedImageSize } = await import(
  new URL("../app/image-sizing.ts", import.meta.url).href
);

const fixture = JSON.parse(await readFile(
  new URL("../../tests/fixtures/image-sizing.json", import.meta.url),
  "utf8",
));

for (const item of fixture.cases) {
  test(`image sizing matches shared boundary fixture: ${item.name}`, () => {
    assert.deepEqual(
      constrainedImageSize(
        item.sourceWidth,
        item.sourceHeight,
        fixture.maxWidth,
        fixture.maxPixels,
      ),
      item.expected,
    );
  });
}

test("image sizing rejects invalid dimensions", () => {
  assert.throws(() => constrainedImageSize(0, 240, 900, 1_200_000));
});
