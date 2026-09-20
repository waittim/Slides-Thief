import assert from "node:assert/strict";
import test from "node:test";

const { copy, localeOptions } = await import(
  new URL("../app/i18n.ts", import.meta.url).href
);

test("all supported locales provide addMorePhotos and duplicateFilesSkipped", () => {
  for (const { value: locale } of localeOptions) {
    const localeCopy = copy[locale];
    assert.ok(
      typeof localeCopy.addMorePhotos === "string" && localeCopy.addMorePhotos.length > 0,
      `Missing or empty addMorePhotos for ${locale}`,
    );
    assert.ok(
      typeof localeCopy.duplicateFilesSkipped === "function",
      `Missing duplicateFilesSkipped function for ${locale}`,
    );
    assert.ok(
      typeof localeCopy.duplicateFilesSkipped(1) === "string" && localeCopy.duplicateFilesSkipped(1).length > 0,
      `Invalid duplicateFilesSkipped(1) for ${locale}`,
    );
    assert.ok(
      typeof localeCopy.duplicateFilesSkipped(3) === "string" && localeCopy.duplicateFilesSkipped(3).length > 0,
      `Invalid duplicateFilesSkipped(3) for ${locale}`,
    );
  }
});

test("duplicateFilesSkipped correctly formats singular and plural", () => {
  assert.equal(copy.en.duplicateFilesSkipped(1), "Skipped 1 duplicate file");
  assert.equal(copy.en.duplicateFilesSkipped(2), "Skipped 2 duplicate files");
  assert.equal(copy["zh-CN"].duplicateFilesSkipped(1), "已跳过 1 个已存在的同名文件");
  assert.equal(copy["zh-CN"].duplicateFilesSkipped(5), "已跳过 5 个已存在的同名文件");
});
