import assert from "node:assert/strict";
import test from "node:test";

const { copy, reviewUiCopy } = await import(
  new URL("../app/i18n.ts", import.meta.url).href
);
const {
  createPluralMessage,
  getPluralRules,
  selectPluralCategory,
} = await import(new URL("../app/lib/plural.ts", import.meta.url).href);

test("selectPluralCategory and getPluralRules correctly determine LDML categories", () => {
  // English: 1 is one, others are other
  assert.equal(selectPluralCategory("en", 1), "one");
  assert.equal(selectPluralCategory("en", 0), "other");
  assert.equal(selectPluralCategory("en", 2), "other");
  assert.equal(selectPluralCategory("en", 5), "other");

  // French: 0 and 1 are one, 2+ are other
  assert.equal(selectPluralCategory("fr", 0), "one");
  assert.equal(selectPluralCategory("fr", 1), "one");
  assert.equal(selectPluralCategory("fr", 2), "other");

  // East Asian: only 'other'
  assert.equal(selectPluralCategory("zh-CN", 1), "other");
  assert.equal(selectPluralCategory("ja", 1), "other");
  assert.equal(selectPluralCategory("ko", 1), "other");

  // Russian: one, few, many
  assert.equal(selectPluralCategory("ru", 1), "one");
  assert.equal(selectPluralCategory("ru", 2), "few");
  assert.equal(selectPluralCategory("ru", 5), "many");

  // Verify caching returns same instance
  const pr1 = getPluralRules("en");
  const pr2 = getPluralRules("en");
  assert.equal(pr1, pr2);
});

test("createPluralMessage generates natural pluralized sentences with backward compatibility", () => {
  const formatter = createPluralMessage(
    "en",
    {
      one: (c) => `${c} apple`,
      other: (c) => `${c} apples`,
    },
    "legacy apples",
  );

  assert.equal(typeof formatter, "function");
  assert.equal(formatter(1), "1 apple");
  assert.equal(formatter(2), "2 apples");
  assert.equal(formatter(), "1 apple");
  assert.equal(formatter.category(1), "one");
  assert.equal(formatter.category(2), "other");
  // String coercion / template literal backward compatibility
  assert.equal(`${formatter}`, "legacy apples");
  assert.equal(formatter.toString(), "legacy apples");
});

test("text.waiting produces grammatically correct singular and plural across all 9 languages", () => {
  const expectedSingular = {
    "zh-CN": "1 张照片，等待校正",
    "zh-TW": "1 張相片，等待校正",
    en: "1 image, waiting to straighten",
    es: "1 imagen por enderezar",
    fr: "1 image à redresser",
    de: "1 Bild wartet",
    ja: "1枚の写真、補正待ち",
    ko: "1장의 사진, 보정 대기",
    "pt-BR": "1 imagem para corrigir",
  };

  const expectedPlural = {
    "zh-CN": "2 张照片，等待校正",
    "zh-TW": "2 張相片，等待校正",
    en: "2 images, waiting to straighten",
    es: "2 imágenes por enderezar",
    fr: "2 images à redresser",
    de: "2 Bilder warten",
    ja: "2枚の写真、補正待ち",
    ko: "2장의 사진, 보정 대기",
    "pt-BR": "2 imagens para corrigir",
  };

  const locales = Object.keys(expectedSingular);
  assert.equal(locales.length, 9);

  for (const locale of locales) {
    const text = copy[locale];
    assert.ok(text, `Locale ${locale} exists in copy`);
    assert.equal(typeof text.waiting, "function", `${locale}.waiting must be a function`);

    // Singular form (count = 1)
    const singularResult = text.waiting(1);
    assert.equal(
      singularResult,
      expectedSingular[locale],
      `Incorrect singular waiting text for ${locale}`,
    );

    // Plural form (count = 2)
    const pluralResult = text.waiting(2);
    assert.equal(
      pluralResult,
      expectedPlural[locale],
      `Incorrect plural waiting text for ${locale}`,
    );

    // Larger plural form (count = 5)
    const count5Result = text.waiting(5);
    assert.ok(
      count5Result.includes("5"),
      `count = 5 text should contain '5' for ${locale}`,
    );

    // Default count (no args)
    assert.equal(
      text.waiting(),
      expectedSingular[locale],
      `Calling waiting() without arguments should default to count 1 for ${locale}`,
    );

    // Backward compatibility: string coercion returns non-empty legacy fallback
    const stringCoercion = `${text.waiting}`;
    assert.ok(
      stringCoercion.length > 0,
      `String coercion of ${locale}.waiting must return a non-empty string`,
    );
  }
});

test("text.waiting English singular avoids '1 images' bug", () => {
  const textEn = copy.en;
  const single = textEn.waiting(1);
  assert.equal(single, "1 image, waiting to straighten");
  assert.ok(!single.includes("1 images"), "Must not output '1 images'");

  const plural = textEn.waiting(3);
  assert.equal(plural, "3 images, waiting to straighten");
});

test("clearAllConfirm distinguishes singular and plural properly", () => {
  // English
  assert.equal(copy.en.clearAllConfirm(1), "Are you sure you want to clear 1 image?");
  assert.equal(copy.en.clearAllConfirm(2), "Are you sure you want to clear all 2 images?");

  // Spanish
  assert.equal(copy.es.clearAllConfirm(1), "¿Seguro que quieres borrar 1 imagen?");
  assert.equal(copy.es.clearAllConfirm(2), "¿Seguro que quieres borrar las 2 imágenes?");

  // French
  assert.equal(copy.fr.clearAllConfirm(1), "Voulez-vous vraiment effacer 1 image ?");
  assert.equal(copy.fr.clearAllConfirm(2), "Voulez-vous vraiment effacer les 2 images ?");

  // German
  assert.equal(copy.de.clearAllConfirm(1), "Möchten Sie wirklich 1 Bild löschen?");
  assert.equal(copy.de.clearAllConfirm(2), "Möchten Sie wirklich alle 2 Bilder löschen?");

  // Portuguese
  assert.equal(copy["pt-BR"].clearAllConfirm(1), "Tem certeza de que deseja limpar 1 imagem?");
  assert.equal(copy["pt-BR"].clearAllConfirm(2), "Tem certeza de que deseja limpar todas as 2 imagens?");

  // East Asian locales
  assert.equal(copy["zh-CN"].clearAllConfirm(1), "确定要清空全部 1 张图片吗？");
  assert.equal(copy["zh-TW"].clearAllConfirm(1), "確定要清空全部 1 張圖片嗎？");
  assert.equal(copy.ja.clearAllConfirm(1), "全 1 枚の画像を消去してもよろしいですか？");
  assert.equal(copy.ko.clearAllConfirm(1), "전체 1개의 이미지를 지우시겠습니까?");
});

test("Portuguese manualImportSuccess fixes plural typo 'imagemns' -> 'imagens'", () => {
  const ptText = copy["pt-BR"];
  assert.equal(ptText.manualImportSuccess(1), "Cantos importados para 1 imagem");
  assert.equal(ptText.manualImportSuccess(2), "Cantos importados para 2 imagens");
  assert.ok(!ptText.manualImportSuccess(2).includes("imagemns"), "Typo 'imagemns' must not appear");
});

test("reviewUiCopy.reviewSummary and reviewConfirmation work across all locales", () => {
  const locales = ["zh-CN", "zh-TW", "en", "es", "fr", "de", "ja", "ko", "pt-BR"];

  for (const locale of locales) {
    const review = reviewUiCopy[locale];
    assert.equal(typeof review.reviewSummary, "function");
    assert.equal(typeof review.reviewConfirmation, "function");

    const summary1 = review.reviewSummary(1);
    const summary2 = review.reviewSummary(2);
    const confirm1 = review.reviewConfirmation(1);
    const confirm2 = review.reviewConfirmation(2);

    assert.ok(summary1.includes("1"), `${locale} summary1 should include 1`);
    assert.ok(summary2.includes("2"), `${locale} summary2 should include 2`);
    assert.ok(confirm1.includes("1"), `${locale} confirm1 should include 1`);
    assert.ok(confirm2.includes("2"), `${locale} confirm2 should include 2`);
  }

  // Check specific singular forms
  assert.equal(reviewUiCopy.en.reviewSummary(1), "1 photo may need review");
  assert.equal(reviewUiCopy.en.reviewSummary(2), "2 photos may need review");
  assert.equal(reviewUiCopy.es.reviewSummary(1), "1 foto puede necesitar revisión");
  assert.equal(reviewUiCopy.es.reviewSummary(2), "2 fotos pueden necesitar revisión");
  assert.equal(reviewUiCopy.de.reviewSummary(1), "1 Foto sollte geprüft werden");
  assert.equal(reviewUiCopy.de.reviewSummary(2), "2 Fotos sollten geprüft werden");
});
