import assert from "node:assert/strict";
import test from "node:test";

const { settingsReducer } = await import(
  new URL("../app/lib/settingsTransitions.ts", import.meta.url).href
);
const { defaultSettings } = await import(
  new URL("../app/lib/types.ts", import.meta.url).href
);

function reduce(settings, action) {
  return settingsReducer(settings, action);
}

test("source format transitions use table-driven orientation defaults", () => {
  const cases = [
    ["16:9", "16:9", "landscape"],
    ["4:3", "4:3", "landscape"],
    ["16:10", "16:10", "landscape"],
    ["A4", "A4-portrait", "portrait"],
    ["letter", "letter-portrait", "portrait"],
    ["custom", "custom", "landscape"],
  ];

  for (const [value, sourceFormat, sourceOrientation] of cases) {
    const next = reduce(defaultSettings, { type: "source-format", value });
    assert.equal(next.sourceFormat, sourceFormat, value);
    assert.equal(next.sourceOrientation, sourceOrientation, value);
  }
});

test("source ratio and orientation transitions clamp and preserve settings", () => {
  const cases = [
    [6, 5],
    [0.1, 0.2],
    [0, 16 / 9],
  ];

  for (const [value, expected] of cases) {
    const next = reduce(defaultSettings, { type: "source-custom-ratio", value });
    assert.equal(next.sourceCustomRatio, expected, String(value));
    assert.equal(next.width, defaultSettings.width);
  }

  const portrait = reduce(defaultSettings, { type: "source-orientation-toggle" });
  assert.equal(portrait.sourceFormat, "9:16");
  assert.equal(portrait.sourceOrientation, "portrait");

  const custom = reduce(
    { ...defaultSettings, sourceFormat: "custom", sourceOrientation: "portrait" },
    { type: "source-orientation-toggle" },
  );
  assert.equal(custom.sourceFormat, "custom");
  assert.equal(custom.sourceOrientation, "landscape");
});

test("page layout transitions choose consistent paper and custom dimensions", () => {
  const cases = [
    {
      name: "match source",
      settings: { ...defaultSettings, outputPageRatio: "A4-landscape", height: 1350 },
      action: { type: "page-layout", value: "match-source" },
      outputPageRatio: "match-source",
      height: null,
    },
    {
      name: "landscape source defaults to landscape paper",
      settings: defaultSettings,
      action: { type: "page-layout", value: "paper" },
      outputPageRatio: "A4-landscape",
      height: null,
    },
    {
      name: "existing paper selection is preserved",
      settings: { ...defaultSettings, outputPageRatio: "letter-portrait" },
      action: { type: "page-layout", value: "paper" },
      outputPageRatio: "letter-portrait",
      height: null,
    },
    {
      name: "custom page matches source ratio",
      settings: defaultSettings,
      action: { type: "page-layout", value: "custom-size" },
      outputPageRatio: "match-source",
      height: 1350,
    },
  ];

  for (const { name, settings, action, outputPageRatio, height } of cases) {
    const next = reduce(settings, action);
    assert.equal(next.outputPageRatio, outputPageRatio, name);
    assert.equal(next.height, height, name);
  }
});

test("output field transitions clamp values and keep unrelated fields intact", () => {
  const cases = [
    [{ type: "width", value: 700 }, "width", 800],
    [{ type: "width", value: 7000 }, "width", 6000],
    [{ type: "height", value: 500 }, "height", 600],
    [{ type: "height", value: 7000 }, "height", 6000],
    [{ type: "quality-percent", value: 50 }, "quality", 0.6],
    [{ type: "quality-percent", value: 100 }, "quality", 0.98],
  ];

  for (const [action, field, expected] of cases) {
    const next = reduce(defaultSettings, action);
    assert.equal(next[field], expected, JSON.stringify(action));
    assert.equal(next.sourceFormat, defaultSettings.sourceFormat);
  }

  assert.equal(
    reduce(defaultSettings, { type: "fill-color-auto" }).fillColor,
    "auto",
  );
  assert.equal(
    reduce(defaultSettings, { type: "fill-color", value: "#123456" }).fillColor,
    "#123456",
  );
});
