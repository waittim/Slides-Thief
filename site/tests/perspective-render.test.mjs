import assert from "node:assert/strict";
import test from "node:test";

const { renderPerspectivePage } = await import(
  new URL("../app/lib/perspective-render.ts", import.meta.url).href,
);

function gradientSource() {
  const width = 4;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = x * 40;
      data[offset + 1] = y * 30;
      data[offset + 2] = 10;
      data[offset + 3] = 255;
    }
  }
  return { width, height, data };
}

const settings = {
  outputWidth: 4,
  outputHeight: 4,
  sourceRatio: 1,
  fillColor: "#010203",
  enhancement: "original",
};

test("perspective rendering keeps the same geometry while exposing quality as an explicit option", () => {
  const source = gradientSource();
  const quad = [[0, 0], [3, 0], [3, 3], [0, 3]];
  const nearest = renderPerspectivePage(source, quad, { ...settings, interpolation: "nearest" });
  const bilinear = renderPerspectivePage(source, quad, { ...settings, interpolation: "bilinear" });

  assert.deepEqual([...nearest.data], [
    0, 0, 10, 255,
    40, 0, 10, 255,
    80, 0, 10, 255,
    80, 0, 10, 255,
    0, 30, 10, 255,
    40, 30, 10, 255,
    80, 30, 10, 255,
    80, 30, 10, 255,
    0, 60, 10, 255,
    40, 60, 10, 255,
    80, 60, 10, 255,
    80, 60, 10, 255,
    0, 60, 10, 255,
    40, 60, 10, 255,
    80, 60, 10, 255,
    80, 60, 10, 255,
  ]);
  assert.deepEqual([...bilinear.data], [
    0, 0, 10, 255,
    30, 0, 10, 255,
    60, 0, 10, 255,
    90, 0, 10, 255,
    0, 22, 10, 255,
    30, 22, 10, 255,
    60, 22, 10, 255,
    90, 22, 10, 255,
    0, 45, 10, 255,
    30, 45, 10, 255,
    60, 45, 10, 255,
    90, 45, 10, 255,
    0, 68, 10, 255,
    30, 68, 10, 255,
    60, 68, 10, 255,
    90, 68, 10, 255,
  ]);
  assert.notDeepEqual(nearest.data, bilinear.data);
  assert.deepEqual(source.data, gradientSource().data, "rendering must not mutate the source");
});

test("perspective rendering centralizes letterbox fill and keeps alpha opaque", () => {
  const source = gradientSource();
  const rendered = renderPerspectivePage(source, [[0, 0], [3, 0], [3, 3], [0, 3]], {
    ...settings,
    outputWidth: 6,
    outputHeight: 4,
    sourceRatio: 1,
    interpolation: "nearest",
  });

  for (let y = 0; y < rendered.height; y += 1) {
    for (let x = 0; x < rendered.width; x += 1) {
      const offset = (y * rendered.width + x) * 4;
      assert.equal(rendered.data[offset + 3], 255);
      if (x === 0 || x >= 5) {
        assert.deepEqual([...rendered.data.slice(offset, offset + 3)], [1, 2, 3]);
      }
    }
  }
});

test("perspective rendering uses the shared blurred-edge path for out-of-source quads", () => {
  const source = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255,
    ]),
  };
  const rendered = renderPerspectivePage(source, [[-1, -1], [3, -1], [3, 3], [-1, 3]], {
    ...settings,
    outputWidth: 4,
    outputHeight: 4,
    sourceRatio: 1,
    interpolation: "nearest",
  });

  assert.deepEqual([...rendered.data], [
    133, 102, 102, 255, 133, 102, 102, 255, 122, 153, 102, 255, 122, 153, 102, 255,
    133, 102, 102, 255, 255, 0, 0, 255, 0, 255, 0, 255, 122, 153, 102, 255,
    122, 102, 153, 255, 0, 0, 255, 255, 255, 255, 255, 255, 133, 153, 153, 255,
    122, 102, 153, 255, 122, 102, 153, 255, 133, 153, 153, 255, 133, 153, 153, 255,
  ]);
});

test("auto fill is resolved from enhanced content before the page is re-filled", () => {
  const source = {
    width: 2,
    height: 2,
    data: new Uint8ClampedArray([
      30, 60, 90, 255,
      30, 60, 90, 255,
      30, 60, 90, 255,
      30, 60, 90, 255,
    ]),
  };
  const rendered = renderPerspectivePage(source, [[0, 0], [2, 0], [2, 2], [0, 2]], {
    ...settings,
    outputWidth: 4,
    outputHeight: 4,
    sourceRatio: 1,
    fillColor: "auto",
    enhancement: "clean",
    interpolation: "nearest",
  });

  assert.deepEqual([...rendered.data], new Array(4 * 4 * 4).fill(255).map((value, index) => {
    const channel = index % 4;
    return channel === 3 ? value : 52;
  }));
});
