import assert from "node:assert/strict";
import test from "node:test";

const {
  DEFAULT_PDF_BASENAME,
  displayFileName,
  formatZipSlideEntryName,
  normalizeJpgZipName,
  normalizePdfName,
  normalizeSingleJpgName,
  PDF_BASENAME_MAX_LENGTH,
  sanitizePdfBaseName,
  stripFileExtension,
  truncateMiddle,
  validatePdfBaseName,
} = await import(new URL("../app/filename.ts", import.meta.url).href);

test("sanitizePdfBaseName removes unsafe filename characters and a pasted extension", () => {
  assert.equal(sanitizePdfBaseName('  quarterly<>:"/\\|?*report.pdf'), "  quarterlyreport");
  assert.equal(sanitizePdfBaseName("演示文稿📊"), "演示文稿📊");
});

test("sanitizePdfBaseName caps names without splitting Unicode code points", () => {
  const name = `${"a".repeat(PDF_BASENAME_MAX_LENGTH - 1)}📊extra`;
  const sanitized = sanitizePdfBaseName(name);
  assert.equal(Array.from(sanitized).length, PDF_BASENAME_MAX_LENGTH);
  assert.equal(sanitized.endsWith("📊"), true);
});

test("normalizePdfName handles empty, trailing, and reserved names safely", () => {
  assert.equal(normalizePdfName(""), "flattened_slides.pdf");
  assert.equal(normalizePdfName(" report...  "), "report.pdf");
  assert.equal(normalizePdfName("CON"), "_CON.pdf");
  assert.equal(normalizePdfName("slides.pdf"), "slides.pdf");
});

test("normalizeSingleJpgName handles base names, trailing characters, and defaults", () => {
  assert.equal(normalizeSingleJpgName(""), "flattened_slides-001.jpg");
  assert.equal(normalizeSingleJpgName(" lecture... "), "lecture-001.jpg");
  assert.equal(normalizeSingleJpgName("slides.pdf"), "slides-001.jpg");
  assert.equal(normalizeSingleJpgName("CON"), "_CON-001.jpg");
});

test("normalizeJpgZipName derives a zip archive name from pdfBaseName", () => {
  assert.equal(normalizeJpgZipName(""), "flattened_slides-images.zip");
  assert.equal(normalizeJpgZipName(" presentation "), "presentation-images.zip");
  assert.equal(normalizeJpgZipName("CON"), "_CON-images.zip");
  assert.equal(normalizeJpgZipName("slides.pdf"), "slides-images.zip");
});

test("formatZipSlideEntryName formats padded index and preserves sanitized stem", () => {
  assert.equal(formatZipSlideEntryName(0, 18, "intro.png"), "001-intro.jpg");
  assert.equal(formatZipSlideEntryName(9, 18, "chart.HEIC"), "010-chart.jpg");
  assert.equal(formatZipSlideEntryName(0, 1005, "slide.jpg"), "0001-slide.jpg");
  assert.equal(formatZipSlideEntryName(2, 18, "bad/name:?.png"), "003-badname.jpg");
  assert.equal(formatZipSlideEntryName(0, 18, "..."), "001-slide.jpg");
  assert.equal(formatZipSlideEntryName(0, 18, "演示文稿📊.png"), "001-演示文稿📊.jpg");
  assert.equal(formatZipSlideEntryName(0, 18, "../../folder/slide.png"), "001-folderslide.jpg");
});

test("truncateMiddle preserves short filenames untouched", () => {
  assert.equal(truncateMiddle("slide.jpg", 20), "slide.jpg");
  assert.equal(truncateMiddle("dark-slide-light-wall.png", 26), "dark-slide-light-wall.png");
  assert.equal(truncateMiddle("light-slide-dark-wall.png", 26), "light-slide-dark-wall.png");
});

test("truncateMiddle preserves head, extension, and trailing serial numbers for camera and slide files", () => {
  // Timestamp / sequence number preserved
  const imgTruncated = truncateMiddle("IMG_20260921_143001.jpg", 18);
  assert.equal(imgTruncated, "IMG_..._143001.jpg");
  assert.equal(imgTruncated.length, 18);

  // Distinguishing slide suffix preserved
  const deckTruncated = truncateMiddle("presentation_deck_slide_01.jpg", 24);
  assert.equal(deckTruncated, "presentat...slide_01.jpg");
  assert.equal(deckTruncated.length, 24);

  // Balanced head and tail when stem has no trailing number
  const processedTruncated = truncateMiddle("DSC_0045_processed.png", 18);
  assert.equal(processedTruncated, "DSC_00...essed.png");
  assert.equal(processedTruncated.length, 18);
});

test("truncateMiddle supports filenames without extensions", () => {
  assert.equal(truncateMiddle("presentation_deck_slide_01", 20), "presentat...slide_01");
  assert.equal(truncateMiddle("short_name", 20), "short_name");
});

test("truncateMiddle handles Unicode code points safely", () => {
  const unicodeName = "2026年人工智能大会专题演讲第01页.png";
  const truncated = truncateMiddle(unicodeName, 16);
  assert.equal(truncated, "2026年...第01页.png");
  assert.equal(Array.from(truncated).length, 16);
});

test("truncateMiddle handles custom options and edge cases cleanly", () => {
  // Custom ellipsis
  assert.equal(truncateMiddle("presentation_deck_slide_01.jpg", 20, { ellipsis: "…" }), "presenta…lide_01.jpg");

  // preserveExtension: false
  assert.equal(truncateMiddle("presentation_deck_slide_01.jpg", 18, { preserveExtension: false }), "presenta..._01.jpg");

  // Empty string
  assert.equal(truncateMiddle("", 20), "");

  // Extremely small maxLength
  assert.equal(truncateMiddle("verylongname.jpg", 3), "ver");
  assert.equal(truncateMiddle("verylongname.jpg", 4), "very");
});

test("stripFileExtension removes only trailing extension safely", () => {
  assert.equal(stripFileExtension("photo.jpg"), "photo");
  assert.equal(stripFileExtension("archive.tar.gz"), "archive.tar");
  assert.equal(stripFileExtension("noextension"), "noextension");
  assert.equal(stripFileExtension(".hidden"), ".hidden");
});

test("displayFileName preserves short names and applies middle truncation for long names", () => {
  // Desktop defaults (maxLength 26)
  assert.equal(displayFileName("light-slide-dark-wall.png", false), "light-slide-dark-wall.png");
  assert.equal(displayFileName("dark-slide-light-wall.png", false), "dark-slide-light-wall.png");
  assert.equal(
    displayFileName("presentation_deck_slide_01.jpg", false),
    "presentati..._slide_01.jpg"
  );

  // Mobile thumbnail view (custom maxLength = 18)
  assert.equal(
    displayFileName("IMG_20260921_143001.jpg", true, 18),
    "IMG_..._143001.jpg"
  );
  assert.equal(
    displayFileName("presentation_deck_slide_01.jpg", true, 18),
    "presen...de_01.jpg"
  );
  assert.equal(displayFileName("slide_01.jpg", true, 18), "slide_01.jpg");

  // Options object with hideExtension
  assert.equal(
    displayFileName("presentation_deck_slide_01.jpg", { hideExtension: true, maxLength: 20 }),
    "presentat...slide_01"
  );
});

test("DEFAULT_PDF_BASENAME is flattened_slides", () => {
  assert.equal(DEFAULT_PDF_BASENAME, "flattened_slides");
});

test("validatePdfBaseName validates filenames accurately", () => {
  // Empty values (default fallback allowed)
  assert.deepEqual(validatePdfBaseName(""), { isValid: true });

  // Valid names
  assert.deepEqual(validatePdfBaseName("my_deck"), { isValid: true });
  assert.deepEqual(validatePdfBaseName("presentation 2026"), { isValid: true });
  assert.deepEqual(validatePdfBaseName("演示文稿📊"), { isValid: true });
  assert.deepEqual(validatePdfBaseName("deck-v1.0"), { isValid: true });

  // Invalid characters
  assert.deepEqual(validatePdfBaseName("报告:第一场"), {
    isValid: false,
    reason: "invalid_characters",
  });
  assert.deepEqual(validatePdfBaseName("path/to/deck"), {
    isValid: false,
    reason: "invalid_characters",
  });
  assert.deepEqual(validatePdfBaseName("path\\to\\deck"), {
    isValid: false,
    reason: "invalid_characters",
  });
  assert.deepEqual(validatePdfBaseName('deck"quote"'), {
    isValid: false,
    reason: "invalid_characters",
  });
  assert.deepEqual(validatePdfBaseName("deck*star"), {
    isValid: false,
    reason: "invalid_characters",
  });
  assert.deepEqual(validatePdfBaseName("deck?question"), {
    isValid: false,
    reason: "invalid_characters",
  });
  assert.deepEqual(validatePdfBaseName("deck<angle>"), {
    isValid: false,
    reason: "invalid_characters",
  });
  assert.deepEqual(validatePdfBaseName("deck|pipe"), {
    isValid: false,
    reason: "invalid_characters",
  });
  assert.deepEqual(validatePdfBaseName("deck\u0000null"), {
    isValid: false,
    reason: "invalid_characters",
  });

  // Invalid extensions (typing .pdf)
  assert.deepEqual(validatePdfBaseName("slides.pdf"), {
    isValid: false,
    reason: "invalid_extension",
  });
  assert.deepEqual(validatePdfBaseName("slides.PDF"), {
    isValid: false,
    reason: "invalid_extension",
  });
  assert.deepEqual(validatePdfBaseName("  slides.pdf  "), {
    isValid: false,
    reason: "invalid_extension",
  });

  // Trailing dot or space
  assert.deepEqual(validatePdfBaseName("slides "), {
    isValid: false,
    reason: "trailing_dot_or_space",
  });
  assert.deepEqual(validatePdfBaseName("slides."), {
    isValid: false,
    reason: "trailing_dot_or_space",
  });
  assert.deepEqual(validatePdfBaseName("   "), {
    isValid: false,
    reason: "trailing_dot_or_space",
  });

  // Windows reserved device names
  assert.deepEqual(validatePdfBaseName("con"), {
    isValid: false,
    reason: "reserved_name",
  });
  assert.deepEqual(validatePdfBaseName("PRN"), {
    isValid: false,
    reason: "reserved_name",
  });
  assert.deepEqual(validatePdfBaseName("AUX"), {
    isValid: false,
    reason: "reserved_name",
  });
  assert.deepEqual(validatePdfBaseName("NUL"), {
    isValid: false,
    reason: "reserved_name",
  });
  assert.deepEqual(validatePdfBaseName("com1"), {
    isValid: false,
    reason: "reserved_name",
  });
  assert.deepEqual(validatePdfBaseName("lpt9"), {
    isValid: false,
    reason: "reserved_name",
  });
});
