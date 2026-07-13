"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

interface GtagWindow extends Window {
  gtag?: (command: string, action: string, params?: Record<string, unknown>) => void;
}

function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    const gtagWindow = window as unknown as GtagWindow;
    if (gtagWindow.gtag) {
      gtagWindow.gtag("event", name, params);
    }
  }
}

type RatioValue = "16:9" | "4:3";
type ThemeValue = "auto" | "light" | "dark";
type LocaleValue = "zh-CN" | "zh-TW" | "en" | "es" | "fr" | "de" | "ja" | "ko" | "pt-BR";

type Settings = {
  ratio: RatioValue;
  width: number;
  height: number | null;
  quality: number;
  grayscale: boolean;
  fillColor: string;
};

type Quad = [[number, number], [number, number], [number, number], [number, number]];

type SlideStatus = "queued" | "detecting" | "ready" | "error";

type SlideItem = {
  id: string;
  file: File;
  name: string;
  url: string;
  width: number;
  height: number;
  quad: Quad | null;
  autoQuad: Quad | null;
  thumbnailUrl?: string;
  method: string;
  confidence: number;
  status: SlideStatus;
  error?: string;
};

type DetectResult = {
  id: string;
  width: number;
  height: number;
  quad: Quad;
  method: string;
  confidence: number;
};

type HandlePosition = {
  left: number;
  top: number;
};

type CanvasRenderState = {
  slideId: string;
  image: HTMLImageElement;
  width: number;
  height: number;
  padX: number;
  padY: number;
  scale: number;
  compact: boolean;
};

type WorkerMessage =
  | { type: "detect-start"; id: string }
  | { type: "detect-result"; result: DetectResult }
  | { type: "slide-error"; id: string; error: string }
  | { type: "export-progress"; current: number; total: number; name: string }
  | { type: "export-complete"; pdf: ArrayBuffer; filename: string }
  | { type: "error"; error: string };

const defaultSettings: Settings = {
  ratio: "16:9",
  width: 2400,
  height: null,
  quality: 0.92,
  grayscale: false,
  fillColor: "#000000",
};

const heifExtensions = [".heic", ".heif"];
const supportedExtensions = [".jpg", ".jpeg", ".png", ".webp", ...heifExtensions];
const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const heifMimeTypes = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);

const localeOptions: { value: LocaleValue; label: string }[] = [
  { value: "zh-CN", label: "简体中文" },
  { value: "zh-TW", label: "繁體中文" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "pt-BR", label: "Português" },
];

const copy = {
  "zh-CN": {
    appTitle: "Slides Thief · PPT捕手",
    brandMark: "ST",
    brandName: "Slides Thief · PPT捕手",
    ratio: "比例",
    more: "更多设置",
    settings: "设置",
    width: "宽度",
    height: "高度",
    heightAuto: "自动",
    quality: "导出质量",
    grayscale: "灰度",
    fillColor: "填充色",
    pdfName: "目标文件名",
    theme: "主题",
    language: "语言",
    auto: "自动",
    light: "亮色",
    dark: "暗色",
    chinese: "中文",
    english: "English",
    runAuto: "自动校正",
    generatePdf: "生成 PDF",
    images: "图片",
    details: "详情",
    dropTitle: "点击或拖拽上传",
    dropSubtitle: "支持 JPG、PNG、WebP、HEIC/HEIF",
    prev: "上一页",
    next: "下一页",
    zoomOut: "缩小",
    zoomIn: "放大",
    fit: "适合",
    resetSlide: "重置本页",
    noSlide: "未选择页面",
    empty: "上传图片后点击自动校正按钮",
    ready: "待上传",
    waiting: "张，等待校正",
    stretching: "校正中",
    reviewReady: "可审核",
    generating: "生成中",
    generated: "已生成",
    failed: "失败",
    downloadPdf: "下载 PDF",
    file: "文件",
    status: "状态",
    dimensions: "尺寸",
    method: "方法",
    confidence: "置信度",
    pending: "待自动校正",
    noUpload: "浏览器本地处理",
    adjustCorners: "拖动四个编号角点以对齐幻灯片边缘",
    cornerHandle: "角点",
    collapse: "缩小详情栏",
    expand: "展开详情栏",
  },
  "zh-TW": {
    appTitle: "Slides Thief · PPT捕手",
    brandMark: "ST",
    brandName: "Slides Thief · PPT捕手",
    ratio: "比例",
    more: "更多設定",
    settings: "設定",
    width: "寬度",
    height: "高度",
    heightAuto: "自動",
    quality: "匯出品質",
    grayscale: "灰階",
    fillColor: "填充色",
    pdfName: "目標檔名",
    theme: "主題",
    language: "語言",
    auto: "自動",
    light: "亮色",
    dark: "暗色",
    chinese: "簡體中文",
    english: "English",
    runAuto: "自動校正",
    generatePdf: "產生 PDF",
    images: "圖片",
    details: "詳情",
    dropTitle: "點擊或拖放上傳",
    dropSubtitle: "支援 JPG、PNG、WebP、HEIC/HEIF",
    prev: "上一頁",
    next: "下一頁",
    zoomOut: "縮小",
    zoomIn: "放大",
    fit: "適合",
    resetSlide: "重設本頁",
    noSlide: "未選擇頁面",
    empty: "上傳圖片後點擊自動校正",
    ready: "待上傳",
    waiting: "張，等待校正",
    stretching: "校正中",
    reviewReady: "可檢查",
    generating: "產生中",
    generated: "已產生",
    failed: "失敗",
    downloadPdf: "下載 PDF",
    file: "檔案",
    status: "狀態",
    dimensions: "尺寸",
    method: "方法",
    confidence: "可信度",
    pending: "待自動校正",
    noUpload: "瀏覽器本機處理",
    adjustCorners: "拖動四個編號角點以對齊投影片邊緣",
    cornerHandle: "角點",
    collapse: "收合詳情欄",
    expand: "展開詳情欄",
  },
  en: {
    appTitle: "Slides Thief - Straighten Slide Photos into PDFs",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Ratio",
    more: "More settings",
    settings: "Settings",
    width: "Width",
    height: "Height",
    heightAuto: "Auto",
    quality: "Export quality",
    grayscale: "Grayscale",
    fillColor: "Fill color",
    pdfName: "Target file name",
    theme: "Theme",
    language: "Language",
    auto: "Auto",
    light: "Light",
    dark: "Dark",
    chinese: "Chinese",
    english: "English",
    runAuto: "Auto straighten",
    generatePdf: "Generate PDF",
    images: "Images",
    details: "Details",
    dropTitle: "Click or drop images",
    dropSubtitle: "JPG, PNG, WebP, HEIC/HEIF in browser",
    prev: "Previous page",
    next: "Next page",
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    fit: "Fit",
    resetSlide: "Reset page",
    noSlide: "No page selected",
    empty: "Upload images, then click Auto straighten",
    ready: "Ready",
    waiting: "images, waiting to straighten",
    stretching: "Straightening",
    reviewReady: "Ready to review",
    generating: "Generating",
    generated: "Generated",
    failed: "Failed",
    downloadPdf: "Download PDF",
    file: "File",
    status: "Status",
    dimensions: "Dimensions",
    method: "Method",
    confidence: "Confidence",
    pending: "Waiting for auto straighten",
    noUpload: "Browser-local processing",
    adjustCorners: "Drag the four numbered corners to align the slide edges",
    cornerHandle: "Corner",
    collapse: "Collapse details",
    expand: "Expand details",
  },
  es: {
    appTitle: "Slides Thief - Endereza fotos de diapositivas en PDF",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Relación",
    more: "Más ajustes",
    settings: "Ajustes",
    width: "Ancho",
    height: "Alto",
    heightAuto: "Auto",
    quality: "Calidad",
    grayscale: "Grises",
    fillColor: "Relleno",
    pdfName: "Nombre PDF",
    theme: "Tema",
    language: "Idioma",
    auto: "Auto",
    light: "Claro",
    dark: "Oscuro",
    chinese: "Chino",
    english: "English",
    runAuto: "Enderezar",
    generatePdf: "Generar PDF",
    images: "Imágenes",
    details: "Detalles",
    dropTitle: "Haz clic o arrastra imágenes",
    dropSubtitle: "JPG, PNG, WebP, HEIC/HEIF local",
    prev: "Página anterior",
    next: "Página siguiente",
    zoomOut: "Alejar",
    zoomIn: "Acercar",
    fit: "Ajustar",
    resetSlide: "Restablecer",
    noSlide: "Sin página",
    empty: "Sube imágenes y pulsa Enderezar",
    ready: "Listo",
    waiting: "imágenes por enderezar",
    stretching: "Enderezando",
    reviewReady: "Listo para revisar",
    generating: "Generando",
    generated: "Generado",
    failed: "Error",
    downloadPdf: "Descargar PDF",
    file: "Archivo",
    status: "Estado",
    dimensions: "Dimensiones",
    method: "Método",
    confidence: "Confianza",
    pending: "Esperando enderezado",
    noUpload: "Proceso local",
    adjustCorners: "Arrastra las cuatro esquinas numeradas para alinear la diapositiva",
    cornerHandle: "Esquina",
    collapse: "Contraer detalles",
    expand: "Expandir detalles",
  },
  fr: {
    appTitle: "Slides Thief - Redresser des photos de diapositives en PDF",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Format",
    more: "Réglages",
    settings: "Réglages",
    width: "Largeur",
    height: "Hauteur",
    heightAuto: "Auto",
    quality: "Qualité",
    grayscale: "Niveaux de gris",
    fillColor: "Remplissage",
    pdfName: "Nom du PDF",
    theme: "Thème",
    language: "Langue",
    auto: "Auto",
    light: "Clair",
    dark: "Sombre",
    chinese: "Chinois",
    english: "English",
    runAuto: "Redresser",
    generatePdf: "Créer PDF",
    images: "Images",
    details: "Détails",
    dropTitle: "Cliquez ou déposez des images",
    dropSubtitle: "JPG, PNG, WebP, HEIC/HEIF local",
    prev: "Page précédente",
    next: "Page suivante",
    zoomOut: "Zoom arrière",
    zoomIn: "Zoom avant",
    fit: "Ajuster",
    resetSlide: "Réinitialiser",
    noSlide: "Aucune page",
    empty: "Ajoutez des images, puis redressez",
    ready: "Prêt",
    waiting: "images à redresser",
    stretching: "Redressement",
    reviewReady: "Prêt à vérifier",
    generating: "Création",
    generated: "Créé",
    failed: "Échec",
    downloadPdf: "Télécharger PDF",
    file: "Fichier",
    status: "État",
    dimensions: "Dimensions",
    method: "Méthode",
    confidence: "Confiance",
    pending: "En attente",
    noUpload: "Traitement local",
    adjustCorners: "Faites glisser les quatre coins numérotés pour aligner la diapositive",
    cornerHandle: "Coin",
    collapse: "Réduire détails",
    expand: "Afficher détails",
  },
  de: {
    appTitle: "Slides Thief - Folienfotos als PDF begradigen",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Format",
    more: "Mehr",
    settings: "Einstellungen",
    width: "Breite",
    height: "Höhe",
    heightAuto: "Auto",
    quality: "Qualität",
    grayscale: "Graustufen",
    fillColor: "Füllfarbe",
    pdfName: "PDF-Name",
    theme: "Design",
    language: "Sprache",
    auto: "Auto",
    light: "Hell",
    dark: "Dunkel",
    chinese: "Chinesisch",
    english: "English",
    runAuto: "Begradigen",
    generatePdf: "PDF erstellen",
    images: "Bilder",
    details: "Details",
    dropTitle: "Klicken oder Bilder ablegen",
    dropSubtitle: "JPG, PNG, WebP, HEIC/HEIF lokal",
    prev: "Vorherige Seite",
    next: "Nächste Seite",
    zoomOut: "Verkleinern",
    zoomIn: "Vergrößern",
    fit: "Einpassen",
    resetSlide: "Zurücksetzen",
    noSlide: "Keine Seite",
    empty: "Bilder hochladen, dann begradigen",
    ready: "Bereit",
    waiting: "Bilder warten",
    stretching: "Begradigen",
    reviewReady: "Bereit zur Prüfung",
    generating: "Erstellen",
    generated: "Erstellt",
    failed: "Fehlgeschlagen",
    downloadPdf: "PDF herunterladen",
    file: "Datei",
    status: "Status",
    dimensions: "Größe",
    method: "Methode",
    confidence: "Sicherheit",
    pending: "Wartet auf Begradigung",
    noUpload: "Lokale Verarbeitung",
    adjustCorners: "Ziehen Sie die vier nummerierten Ecken an die Folienränder",
    cornerHandle: "Ecke",
    collapse: "Details einklappen",
    expand: "Details ausklappen",
  },
  ja: {
    appTitle: "Slides Thief - スライド写真を補正してPDF化",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "比率",
    more: "詳細設定",
    settings: "設定",
    width: "幅",
    height: "高さ",
    heightAuto: "自動",
    quality: "品質",
    grayscale: "グレー",
    fillColor: "余白色",
    pdfName: "PDF名",
    theme: "テーマ",
    language: "言語",
    auto: "自動",
    light: "ライト",
    dark: "ダーク",
    chinese: "中国語",
    english: "English",
    runAuto: "自動補正",
    generatePdf: "PDF生成",
    images: "画像",
    details: "詳細",
    dropTitle: "クリックまたはドラッグ",
    dropSubtitle: "JPG、PNG、WebP、HEIC/HEIF対応",
    prev: "前のページ",
    next: "次のページ",
    zoomOut: "縮小",
    zoomIn: "拡大",
    fit: "合わせる",
    resetSlide: "リセット",
    noSlide: "ページ未選択",
    empty: "画像を追加して自動補正",
    ready: "待機中",
    waiting: "枚、補正待ち",
    stretching: "補正中",
    reviewReady: "確認可能",
    generating: "生成中",
    generated: "生成済み",
    failed: "失敗",
    downloadPdf: "PDFを保存",
    file: "ファイル",
    status: "状態",
    dimensions: "サイズ",
    method: "方法",
    confidence: "信頼度",
    pending: "自動補正待ち",
    noUpload: "ブラウザ内処理",
    adjustCorners: "4つの番号付きコーナーをドラッグしてスライドの端に合わせます",
    cornerHandle: "コーナー",
    collapse: "詳細を閉じる",
    expand: "詳細を開く",
  },
  ko: {
    appTitle: "Slides Thief - 슬라이드 사진을 PDF로 보정",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "비율",
    more: "추가 설정",
    settings: "설정",
    width: "너비",
    height: "높이",
    heightAuto: "자동",
    quality: "품질",
    grayscale: "흑백",
    fillColor: "채움색",
    pdfName: "PDF 이름",
    theme: "테마",
    language: "언어",
    auto: "자동",
    light: "밝게",
    dark: "어둡게",
    chinese: "중국어",
    english: "English",
    runAuto: "자동 보정",
    generatePdf: "PDF 생성",
    images: "이미지",
    details: "상세",
    dropTitle: "클릭하거나 끌어다 놓기",
    dropSubtitle: "JPG, PNG, WebP, HEIC/HEIF 지원",
    prev: "이전 페이지",
    next: "다음 페이지",
    zoomOut: "축소",
    zoomIn: "확대",
    fit: "맞춤",
    resetSlide: "재설정",
    noSlide: "선택 없음",
    empty: "이미지를 올린 뒤 자동 보정",
    ready: "대기",
    waiting: "장, 보정 대기",
    stretching: "보정 중",
    reviewReady: "검토 가능",
    generating: "생성 중",
    generated: "생성됨",
    failed: "실패",
    downloadPdf: "PDF 저장",
    file: "파일",
    status: "상태",
    dimensions: "크기",
    method: "방법",
    confidence: "신뢰도",
    pending: "자동 보정 대기",
    noUpload: "브라우저 내 처리",
    adjustCorners: "번호가 표시된 네 모서리를 끌어 슬라이드 가장자리에 맞추세요",
    cornerHandle: "모서리",
    collapse: "상세 접기",
    expand: "상세 펼치기",
  },
  "pt-BR": {
    appTitle: "Slides Thief - Corrigir fotos de slides em PDF",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Proporção",
    more: "Mais ajustes",
    settings: "Ajustes",
    width: "Largura",
    height: "Altura",
    heightAuto: "Auto",
    quality: "Qualidade",
    grayscale: "Cinza",
    fillColor: "Preenchimento",
    pdfName: "Nome do PDF",
    theme: "Tema",
    language: "Idioma",
    auto: "Auto",
    light: "Claro",
    dark: "Escuro",
    chinese: "Chinês",
    english: "English",
    runAuto: "Corrigir",
    generatePdf: "Gerar PDF",
    images: "Imagens",
    details: "Detalhes",
    dropTitle: "Clique ou arraste imagens",
    dropSubtitle: "JPG, PNG, WebP, HEIC/HEIF local",
    prev: "Página anterior",
    next: "Próxima página",
    zoomOut: "Diminuir zoom",
    zoomIn: "Aumentar zoom",
    fit: "Ajustar",
    resetSlide: "Redefinir",
    noSlide: "Nenhuma página",
    empty: "Envie imagens e clique em Corrigir",
    ready: "Pronto",
    waiting: "imagens para corrigir",
    stretching: "Corrigindo",
    reviewReady: "Pronto para revisar",
    generating: "Gerando",
    generated: "Gerado",
    failed: "Falhou",
    downloadPdf: "Baixar PDF",
    file: "Arquivo",
    status: "Status",
    dimensions: "Dimensões",
    method: "Método",
    confidence: "Confiança",
    pending: "Aguardando correção",
    noUpload: "Processamento local",
    adjustCorners: "Arraste os quatro cantos numerados para alinhar as bordas do slide",
    cornerHandle: "Canto",
    collapse: "Recolher detalhes",
    expand: "Expandir detalhes",
  },
};

function supportedLocaleFromLanguage(language: string | undefined): LocaleValue | null {
  const normalized = language?.trim().toLowerCase().replace(/_/g, "-");
  if (!normalized) return null;

  if (normalized === "zh" || normalized.startsWith("zh-")) {
    return normalized.includes("hant") || ["zh-tw", "zh-hk", "zh-mo"].includes(normalized) ? "zh-TW" : "zh-CN";
  }

  const baseLanguage = normalized.split("-")[0];
  const localeByLanguage: Partial<Record<string, LocaleValue>> = {
    de: "de",
    en: "en",
    es: "es",
    fr: "fr",
    ja: "ja",
    ko: "ko",
    pt: "pt-BR",
  };

  return localeByLanguage[baseLanguage] ?? null;
}

function detectBrowserLocale(): LocaleValue {
  if (typeof navigator === "undefined") return "en";

  const candidates = [...(navigator.languages ?? []), navigator.language];
  for (const language of candidates) {
    const locale = supportedLocaleFromLanguage(language);
    if (locale) return locale;
  }

  return "en";
}

function makeId(file: File, index: number) {
  return `${index}-${file.name}-${file.lastModified}-${file.size}`;
}

function hasExtension(file: File, extensions: string[]) {
  const lower = file.name.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

function isHeifImage(file: File) {
  return hasExtension(file, heifExtensions) || heifMimeTypes.has(file.type.toLowerCase());
}

function isSupported(file: File) {
  return hasExtension(file, supportedExtensions) || supportedMimeTypes.has(file.type.toLowerCase());
}

function jpegNameFor(file: File) {
  return /\.(heic|heif)$/i.test(file.name) ? file.name.replace(/\.(heic|heif)$/i, ".jpg") : `${file.name}.jpg`;
}

function messageFromError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas could not encode the image as JPEG."));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function nativeDecodeToJpeg(file: File, quality: number) {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available in this browser.");
    ctx.drawImage(bitmap, 0, 0);
    return canvasToJpegBlob(canvas, quality);
  } finally {
    bitmap.close();
  }
}

async function normalizeImageFile(file: File) {
  if (!isHeifImage(file)) return file;

  let jpeg: Blob;
  try {
    jpeg = await nativeDecodeToJpeg(file, 0.92);
  } catch {
    try {
      const { heicTo } = await import("heic-to/csp");
      jpeg = await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
    } catch (error) {
      throw new Error(`Could not convert ${file.name} from HEIC/HEIF: ${messageFromError(error)}`);
    }
  }

  return new File([jpeg], jpegNameFor(file), {
    type: "image/jpeg",
    lastModified: file.lastModified,
  });
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function confidenceText(value: number) {
  return value ? value.toFixed(2) : "-";
}

function cloneQuad(quad: Quad): Quad {
  return quad.map((point) => [point[0], point[1]]) as Quad;
}

function quadHandlePositions(quad: Quad, padX: number, padY: number, scale: number): HandlePosition[] {
  return quad.map(([x, y]) => ({
    left: (padX + x) * scale,
    top: (padY + y) * scale,
  }));
}

function normalizePdfName(value: string) {
  const base = value.trim().replace(/\.pdf$/i, "") || "flattened_slides";
  return `${base}.pdf`;
}

function parseHexColor(value: string): [number, number, number] {
  const clean = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "000000";
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function outputRatio(settings: Settings) {
  return settings.height ? settings.width / settings.height : settings.ratio === "4:3" ? 4 / 3 : 16 / 9;
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
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

function perspectiveCoefficients(src: Quad, dst: Quad) {
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

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cannot render thumbnail for this image."));
    image.src = url;
  });
}

async function buildAdjustedThumbnail(slide: SlideItem, quad: Quad, settings: Settings) {
  const image = await loadImage(slide.url);
  const sourceScale = Math.min(1, 1000 / image.naturalWidth);
  const sourceWidth = Math.max(1, Math.round(image.naturalWidth * sourceScale));
  const sourceHeight = Math.max(1, Math.round(image.naturalHeight * sourceScale));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = sourceWidth;
  sourceCanvas.height = sourceHeight;
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx) throw new Error("Cannot render thumbnail in this browser.");
  sourceCtx.drawImage(image, 0, 0, sourceWidth, sourceHeight);
  const source = sourceCtx.getImageData(0, 0, sourceWidth, sourceHeight).data;

  const outWidth = 160;
  const outHeight = Math.max(1, Math.round(outWidth / outputRatio(settings)));
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outWidth;
  outputCanvas.height = outHeight;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) throw new Error("Cannot render thumbnail in this browser.");
  const output = outputCtx.createImageData(outWidth, outHeight);
  const fill = parseHexColor(settings.fillColor);
  const scaledQuad = quad.map(([x, y]) => [x * sourceScale, y * sourceScale]) as Quad;
  const dst: Quad = [[0, 0], [outWidth, 0], [outWidth, outHeight], [0, outHeight]];
  const coeffs = perspectiveCoefficients(scaledQuad, dst);

  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const den = coeffs[6] * x + coeffs[7] * y + 1;
      const sx = (coeffs[0] * x + coeffs[1] * y + coeffs[2]) / den;
      const sy = (coeffs[3] * x + coeffs[4] * y + coeffs[5]) / den;
      const outIndex = (y * outWidth + x) * 4;
      if (sx >= 0 && sx < sourceWidth && sy >= 0 && sy < sourceHeight) {
        const ix = Math.max(0, Math.min(sourceWidth - 1, Math.round(sx)));
        const iy = Math.max(0, Math.min(sourceHeight - 1, Math.round(sy)));
        const srcIndex = (iy * sourceWidth + ix) * 4;
        output.data[outIndex] = source[srcIndex];
        output.data[outIndex + 1] = source[srcIndex + 1];
        output.data[outIndex + 2] = source[srcIndex + 2];
        output.data[outIndex + 3] = 255;
      } else {
        output.data[outIndex] = fill[0];
        output.data[outIndex + 1] = fill[1];
        output.data[outIndex + 2] = fill[2];
        output.data[outIndex + 3] = 255;
      }
    }
  }
  outputCtx.putImageData(output, 0, 0);
  return outputCanvas.toDataURL("image/png");
}

export function SlidesThiefApp() {
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [pdfBaseName, setPdfBaseName] = useState("flattened_slides");
  const [theme, setTheme] = useState<ThemeValue>("auto");
  const [locale, setLocale] = useState<LocaleValue>("en");
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [busyText, setBusyText] = useState("");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exportName, setExportName] = useState("flattened_slides.pdf");
  const [exporting, setExporting] = useState(false);
  const [workerError, setWorkerError] = useState("");
  const [dragHandle, setDragHandle] = useState<number | null>(null);
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [zoom, setZoom] = useState(1);
  const [displayZoom, setDisplayZoom] = useState(1);
  const [handlePositions, setHandlePositions] = useState<HandlePosition[]>([]);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const slidesRef = useRef<SlideItem[]>([]);
  const exportUrlRef = useRef<string | null>(null);
  const localeRef = useRef<LocaleValue>("en");
  const settingsRef = useRef<Settings>(defaultSettings);
  const latestDragQuadRef = useRef<{ id: string; quad: Quad } | null>(null);
  const canvasRenderRef = useRef<CanvasRenderState | null>(null);
  const imageCacheRef = useRef<{ id: string; url: string; image: HTMLImageElement } | null>(null);
  const handleRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const settingsMenuRef = useRef<HTMLDetailsElement | null>(null);
  const moreSettingsRef = useRef<HTMLDetailsElement | null>(null);
  const dragHandleRef = useRef<number | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const thumbnailRefreshTokenRef = useRef(0);
  const loadTokenRef = useRef(0);
  const viewportRef = useRef({ padX: 0, padY: 0 });
  const scaleRef = useRef(1);
  const fitZoomRef = useRef(1);
  const maxZoomRef = useRef(3);

  const text = copy[locale];
  const readySlides = slides.filter((slide) => slide.status === "ready" && slide.quad);
  const selectedIndex = slides.findIndex((slide) => slide.id === selectedId);
  const selectedSlide = selectedIndex >= 0 ? slides[selectedIndex] : slides[0] ?? null;
  const hasRun = slides.some((slide) => slide.status === "ready" || slide.status === "detecting" || slide.status === "error");
  const detecting = slides.some((slide) => slide.status === "detecting");
  const busy = detecting || exporting || Boolean(busyText) || dragHandle !== null;

  const cancelActiveDrag = useCallback(() => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    latestDragQuadRef.current = null;
    activePointerRef.current = null;
    dragHandleRef.current = null;
    setDragHandle(null);
  }, []);

  const statusText = useMemo(() => {
    if (workerError) return workerError;
    if (busyText) return busyText;
    if (!slides.length) return text.ready;
    if (detecting) return text.stretching;
    if (exporting) return text.generating;
    if (exportUrl) return text.generated;
    if (hasRun) return text.reviewReady;
    return locale === "zh-CN" ? `${slides.length} ${text.waiting}` : `${slides.length} ${text.waiting}`;
  }, [busyText, detecting, exporting, exportUrl, hasRun, locale, slides.length, text, workerError]);

  const statusTone = useMemo(() => {
    if (workerError) return "bad";
    if (detecting || exporting) return "busy";
    if (hasRun || exportUrl) return "good";
    return "neutral";
  }, [detecting, exporting, exportUrl, hasRun, workerError]);

  const refreshSlideThumbnail = useCallback(async (id: string, quad: Quad) => {
    const slide = slidesRef.current.find((item) => item.id === id);
    if (!slide) return;
    try {
      const thumbnailUrl = await buildAdjustedThumbnail(slide, quad, settingsRef.current);
      setSlides((current) => current.map((item) => (item.id === id ? { ...item, thumbnailUrl } : item)));
    } catch {
      // Keep the original preview if thumbnail generation fails.
    }
  }, []);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    let worker: Worker;
    try {
      worker = new Worker(new URL("./slides-worker.ts", import.meta.url), {
        type: "module",
      });
    } catch (error) {
      setWorkerError(messageFromError(error));
      setBusyText("");
      return null;
    }
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "detect-start") {
        const name = slidesRef.current.find((slide) => slide.id === message.id)?.name ?? "";
        const currentCopy = copy[localeRef.current];
        setBusyText(name ? `${currentCopy.stretching}: ${name}` : currentCopy.stretching);
        setSlides((current) =>
          current.map((slide) =>
            slide.id === message.id
              ? { ...slide, status: "detecting", method: "detecting", thumbnailUrl: undefined, error: undefined }
              : slide,
          ),
        );
      }
      if (message.type === "detect-result") {
        setSlides((current) =>
          current.map((slide) =>
            slide.id === message.result.id
              ? {
                  ...slide,
                  width: message.result.width,
                  height: message.result.height,
                  quad: message.result.quad,
                  autoQuad: message.result.quad,
                  method: message.result.method,
                  confidence: message.result.confidence,
                  status: "ready",
                  error: undefined,
                }
              : slide,
          ),
        );
        void refreshSlideThumbnail(message.result.id, message.result.quad);
        setBusyText("");
      }
      if (message.type === "slide-error") {
        trackEvent("processing_error", {
          error_type: "slide_error",
          error_message: message.error || "Slide processing error",
        });
        setSlides((current) =>
          current.map((slide) =>
            slide.id === message.id
              ? { ...slide, status: "error", method: "error", error: message.error }
              : slide,
          ),
        );
        setBusyText("");
      }
      if (message.type === "export-progress") {
        setBusyText(`${copy[localeRef.current].generating} ${message.current}/${message.total}: ${message.name}`);
      }
      if (message.type === "export-complete") {
        trackEvent("pdf_export_success", {
          page_count: slidesRef.current.length,
          file_size_bytes: message.pdf.byteLength,
        });
        if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
        const blob = new Blob([message.pdf], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        exportUrlRef.current = url;
        setExportUrl(url);
        setExportName(message.filename);
        setExporting(false);
        setBusyText("");
      }
      if (message.type === "error") {
        trackEvent("processing_error", {
          error_type: "worker_error",
          error_message: message.error || "General worker error",
        });
        setSlides((current) =>
          current.map((slide) =>
            slide.status === "detecting"
              ? { ...slide, status: "error", method: "error", error: message.error }
              : slide,
          ),
        );
        setWorkerError(message.error);
        setExporting(false);
        setBusyText("");
      }
    };
    const handleWorkerFailure = (message: string) => {
      trackEvent("processing_error", {
        error_type: "worker_failure",
        error_message: message || "Worker terminated unexpectedly",
      });
      worker.terminate();
      if (workerRef.current === worker) workerRef.current = null;
      setSlides((current) =>
        current.map((slide) =>
          slide.status === "detecting" ? { ...slide, status: "error", method: "error", error: message } : slide,
        ),
      );
      setWorkerError(message);
      setExporting(false);
      setBusyText("");
    };
    worker.onerror = (event) => handleWorkerFailure(event.message || "The image worker stopped unexpectedly.");
    worker.onmessageerror = () => handleWorkerFailure("The browser could not read a response from the image worker.");
    workerRef.current = worker;
    return worker;
  }, [refreshSlideThumbnail]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
    };
  }, []);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const token = thumbnailRefreshTokenRef.current + 1;
    thumbnailRefreshTokenRef.current = token;
    const timeoutId = window.setTimeout(async () => {
      for (const slide of slidesRef.current) {
        if (thumbnailRefreshTokenRef.current !== token) return;
        if (slide.status === "ready" && slide.quad) await refreshSlideThumbnail(slide.id, slide.quad);
      }
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
      if (thumbnailRefreshTokenRef.current === token) thumbnailRefreshTokenRef.current += 1;
    };
  }, [refreshSlideThumbnail, settings.fillColor, settings.height, settings.ratio, settings.width]);

  useEffect(() => {
    exportUrlRef.current = exportUrl;
  }, [exportUrl]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useLayoutEffect(() => {
    const settingsMenu = settingsMenuRef.current;
    const moreSettings = moreSettingsRef.current;
    if (!settingsMenu) return;

    const media = window.matchMedia("(max-width: 720px)");
    const sync = () => {
      if (media.matches) {
        settingsMenu.open = false;
        if (moreSettings) moreSettings.open = true;
      } else {
        settingsMenu.open = true;
      }
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = text.appTitle;
    localeRef.current = locale;
  }, [locale, text.appTitle]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const browserLocale = detectBrowserLocale();
      setLocale((current) => (current === browserLocale ? current : browserLocale));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    return () => {
      slidesRef.current.forEach((slide) => URL.revokeObjectURL(slide.url));
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    };
  }, []);

  const loadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      const inputFiles = Array.from(fileList)
        .filter(isSupported)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (!inputFiles.length) return;
      const hasHeif = inputFiles.some(isHeifImage);

      trackEvent("image_import", {
        count: inputFiles.length,
        has_heif: hasHeif,
      });

      workerRef.current?.terminate();
      workerRef.current = null;
      cancelActiveDrag();
      slidesRef.current.forEach((slide) => URL.revokeObjectURL(slide.url));
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
      imageCacheRef.current = null;
      canvasRenderRef.current = null;
      if (canvasRef.current) {
        canvasRef.current.width = 1;
        canvasRef.current.height = 1;
      }
      setSlides([]);
      setSelectedId(null);
      setHandlePositions([]);
      setExportUrl(null);
      setExportName(normalizePdfName(pdfBaseName));
      setZoomMode("fit");
      setWorkerError("");
      setBusyText(hasHeif ? (localeRef.current === "zh-CN" ? "正在转换 HEIC/HEIF" : "Converting HEIC/HEIF") : "");

      const files: File[] = [];
      try {
        for (let index = 0; index < inputFiles.length; index += 1) {
          if (loadTokenRef.current !== token) return;
          const file = inputFiles[index];
          if (isHeifImage(file)) {
            const prefix = localeRef.current === "zh-CN" ? "正在转换 HEIC/HEIF" : "Converting HEIC/HEIF";
            setBusyText(`${prefix} ${index + 1}/${inputFiles.length}`);
          }
          files.push(await normalizeImageFile(file));
        }
      } catch (error) {
        if (loadTokenRef.current !== token) return;
        setBusyText("");
        setWorkerError(messageFromError(error));
        return;
      }
      if (loadTokenRef.current !== token) return;

      const nextSlides: SlideItem[] = files.map((file, index) => ({
        id: makeId(file, index),
        file,
        name: file.name,
        url: URL.createObjectURL(file),
        width: 0,
        height: 0,
        quad: null,
        autoQuad: null,
        method: "queued",
        confidence: 0,
        status: "queued",
      }));

      setSlides(nextSlides);
      setSelectedId(nextSlides[0]?.id ?? null);
      setBusyText("");
    },
    [cancelActiveDrag, pdfBaseName],
  );

  const paintCanvas = useCallback((quad: Quad | null) => {
    const canvas = canvasRef.current;
    const render = canvasRenderRef.current;
    if (!canvas || !render) return;

    const { image, width, height, padX, padY, scale, compact } = render;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    const imageX = padX * scale;
    const imageY = padY * scale;
    const imageWidth = image.naturalWidth * scale;
    const imageHeight = image.naturalHeight * scale;
    ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
    ctx.strokeStyle = "rgba(255, 255, 255, .36)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(imageX, imageY, imageWidth, imageHeight);

    if (!quad) return;
    const positions = quadHandlePositions(quad, padX, padY, scale);
    positions.forEach((position, index) => {
      const handle = handleRefs.current[index];
      if (!handle) return;
      handle.style.left = `${position.left}px`;
      handle.style.top = `${position.top}px`;
    });

    ctx.lineWidth = Math.max(3, Math.min(7, width / 420));
    ctx.strokeStyle = "rgba(200, 69, 53, .98)";
    ctx.beginPath();
    positions.forEach(({ left, top }, index) => {
      if (index === 0) ctx.moveTo(left, top);
      else ctx.lineTo(left, top);
    });
    ctx.closePath();
    ctx.stroke();

    positions.forEach(({ left, top }, index) => {
      const radius = compact ? 12 : Math.max(9, Math.min(18, width / 150));
      ctx.fillStyle = "rgba(255, 216, 74, .96)";
      ctx.strokeStyle = "rgba(16, 20, 22, .92)";
      ctx.lineWidth = Math.max(2, Math.min(4, width / 700));
      ctx.beginPath();
      ctx.arc(left, top, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#172026";
      ctx.font = `700 ${Math.max(13, Math.min(18, width / 80))}px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(index + 1), left, top + 1);
    });
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const slide = selectedSlide;
    if (!canvas || !stage || !slide) return;

    const renderImage = (image: HTMLImageElement) => {
      if (imageCacheRef.current?.image !== image) return;
      if (!slide.width || !slide.height) {
        setSlides((current) =>
          current.map((item) =>
            item.id === slide.id && (!item.width || !item.height)
              ? { ...item, width: image.naturalWidth, height: image.naturalHeight }
              : item,
          ),
        );
      }

      const previewQuad = latestDragQuadRef.current?.id === slide.id ? latestDragQuadRef.current.quad : slide.quad;
      const compact = stage.clientWidth <= 720 || window.matchMedia("(pointer: coarse)").matches;
      const maxWidth = Math.max(1, stage.clientWidth - (compact ? 16 : 26));
      const maxHeight = Math.max(1, stage.clientHeight - (compact ? 16 : 26));
      const imageFitScale = Math.max(
        0.0001,
        Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1),
      );
      const desiredHandleGutter = compact ? 30 : 34;
      const quadOverflowX = previewQuad
        ? Math.max(
            0,
            ...previewQuad.map(([x]) => Math.max(-x, x - image.naturalWidth)),
          )
        : 0;
      const quadOverflowY = previewQuad
        ? Math.max(
            0,
            ...previewQuad.map(([, y]) => Math.max(-y, y - image.naturalHeight)),
          )
        : 0;
      const handleSourceGutter = 24 / imageFitScale;
      const padX = Math.min(
        Math.round(image.naturalWidth * 0.3),
        Math.max(
          compact ? 40 : 64,
          Math.round(desiredHandleGutter / imageFitScale),
          Math.ceil(quadOverflowX + handleSourceGutter),
        ),
      );
      const padY = Math.min(
        Math.round(image.naturalHeight * 0.3),
        Math.max(
          compact ? 40 : 64,
          Math.round(desiredHandleGutter / imageFitScale),
          Math.ceil(quadOverflowY + handleSourceGutter),
        ),
      );
      const totalWidth = image.naturalWidth + padX * 2;
      const totalHeight = image.naturalHeight + padY * 2;
      const fitScale = Math.min(maxWidth / totalWidth, maxHeight / totalHeight, 1);
      const maxDimension = compact ? 4096 : 8192;
      const maxPixels = compact ? 8_000_000 : 24_000_000;
      const budgetScale = Math.min(
        maxDimension / totalWidth,
        maxDimension / totalHeight,
        Math.sqrt(maxPixels / (totalWidth * totalHeight)),
      );
      const maxScale = Math.max(fitScale, Math.min(3, budgetScale));
      const requestedScale = zoomMode === "fit" ? fitScale : zoom;
      const scale = Math.max(0.01, Math.min(requestedScale, maxScale));
      const width = Math.max(1, Math.round(totalWidth * scale));
      const height = Math.max(1, Math.round(totalHeight * scale));

      canvas.width = width;
      canvas.height = height;
      scaleRef.current = scale;
      fitZoomRef.current = fitScale;
      maxZoomRef.current = maxScale;
      viewportRef.current = { padX, padY };
      canvasRenderRef.current = { slideId: slide.id, image, width, height, padX, padY, scale, compact };
      setDisplayZoom((current) => (Math.abs(current - scale) < 0.0001 ? current : scale));

      setHandlePositions(previewQuad ? quadHandlePositions(previewQuad, padX, padY, scale) : []);
      paintCanvas(previewQuad);
    };

    const cached = imageCacheRef.current;
    if (cached?.id === slide.id && cached.url === slide.url) {
      if (cached.image.complete && cached.image.naturalWidth) {
        renderImage(cached.image);
      } else {
        cached.image.onload = () => renderImage(cached.image);
        cached.image.onerror = () => {
          if (imageCacheRef.current?.image === cached.image) setWorkerError("Cannot render this image in the browser.");
        };
      }
      return;
    }

    const image = new Image();
    image.decoding = "async";
    imageCacheRef.current = { id: slide.id, url: slide.url, image };
    image.onload = () => renderImage(image);
    image.onerror = () => {
      if (imageCacheRef.current?.image === image) setWorkerError("Cannot render this image in the browser.");
    };
    image.src = slide.url;
  }, [paintCanvas, selectedSlide, zoom, zoomMode]);

  useEffect(() => {
    redrawCanvas();
    const observer = new ResizeObserver(redrawCanvas);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [redrawCanvas]);

  const updateSlideQuad = useCallback((id: string, nextQuad: Quad) => {
    setSlides((current) =>
      current.map((slide) => {
        if (slide.id === id) {
          if (slide.method !== "manual") {
            trackEvent("corner_adjusted", {
              slide_id: id,
            });
          }
          return { ...slide, quad: nextQuad, method: "manual" };
        }
        return slide;
      }),
    );
  }, []);

  const canvasPoint = (event: React.PointerEvent<HTMLElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return [0, 0] as const;
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * canvas.width,
      ((event.clientY - rect.top) / rect.height) * canvas.height,
    ] as const;
  };

  const onHandlePointerDown = (index: number, event: React.PointerEvent<HTMLButtonElement>) => {
    if (
      !event.isPrimary ||
      activePointerRef.current !== null ||
      !selectedSlide?.quad ||
      canvasRenderRef.current?.slideId !== selectedSlide.id
    ) {
      return;
    }
    latestDragQuadRef.current = { id: selectedSlide.id, quad: cloneQuad(selectedSlide.quad) };
    activePointerRef.current = event.pointerId;
    dragHandleRef.current = index;
    setDragHandle(index);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onHandlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const handleIndex = dragHandleRef.current;
    const render = canvasRenderRef.current;
    const latest = latestDragQuadRef.current;
    if (
      handleIndex === null ||
      activePointerRef.current !== event.pointerId ||
      !render ||
      !latest ||
      render.slideId !== latest.id
    ) {
      return;
    }
    const [x, y] = canvasPoint(event);
    const scale = scaleRef.current || 1;
    const { padX, padY } = viewportRef.current;
    const next = cloneQuad(latest.quad);
    const handleMargin = 24 / scale;
    next[handleIndex] = [
      Math.max(
        -padX + handleMargin,
        Math.min(render.image.naturalWidth + padX - handleMargin, x / scale - padX),
      ),
      Math.max(
        -padY + handleMargin,
        Math.min(render.image.naturalHeight + padY - handleMargin, y / scale - padY),
      ),
    ];
    latestDragQuadRef.current = { id: latest.id, quad: next };
    if (dragFrameRef.current === null) {
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const pending = latestDragQuadRef.current;
        if (pending) paintCanvas(pending.quad);
      });
    }
    event.preventDefault();
  };

  const onHandlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== event.pointerId) return;
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const latest = latestDragQuadRef.current;
    if (latest) {
      paintCanvas(latest.quad);
      const render = canvasRenderRef.current;
      if (render) setHandlePositions(quadHandlePositions(latest.quad, render.padX, render.padY, render.scale));
      updateSlideQuad(latest.id, latest.quad);
      void refreshSlideThumbnail(latest.id, latest.quad);
    }
    latestDragQuadRef.current = null;
    activePointerRef.current = null;
    dragHandleRef.current = null;
    setDragHandle(null);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // The pointer may already be released by the browser.
    }
  };

  const onHandleKeyDown = (index: number, event: React.KeyboardEvent<HTMLButtonElement>) => {
    const render = canvasRenderRef.current;
    if (!selectedSlide?.quad || !render || render.slideId !== selectedSlide.id) return;
    const direction: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const delta = direction[event.key];
    if (!delta) return;
    event.preventDefault();
    const visualStep = event.shiftKey ? 10 : 1;
    const sourceStep = visualStep / (scaleRef.current || 1);
    const next = cloneQuad(selectedSlide.quad);
    const handleMargin = 24 / (scaleRef.current || 1);
    next[index] = [
      Math.max(
        -render.padX + handleMargin,
        Math.min(
          render.image.naturalWidth + render.padX - handleMargin,
          next[index][0] + delta[0] * sourceStep,
        ),
      ),
      Math.max(
        -render.padY + handleMargin,
        Math.min(
          render.image.naturalHeight + render.padY - handleMargin,
          next[index][1] + delta[1] * sourceStep,
        ),
      ),
    ];
    paintCanvas(next);
    setHandlePositions(quadHandlePositions(next, render.padX, render.padY, render.scale));
    updateSlideQuad(selectedSlide.id, next);
    void refreshSlideThumbnail(selectedSlide.id, next);
  };

  const runAuto = () => {
    if (!slides.length) return;
    cancelActiveDrag();
    const worker = ensureWorker();
    if (!worker) return;
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    exportUrlRef.current = null;
    setExportUrl(null);
    setWorkerError("");
    setBusyText(text.stretching);
    setSlides((current) =>
      current.map((slide) => ({
        ...slide,
        status: "detecting",
        method: "detecting",
        quad: null,
        thumbnailUrl: undefined,
        error: undefined,
      })),
    );
    worker.postMessage({
      type: "detect",
      files: slides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
      settings,
    });
  };

  const resetSelected = () => {
    if (!selectedSlide) return;
    if (selectedSlide.autoQuad) {
      const next = cloneQuad(selectedSlide.autoQuad);
      cancelActiveDrag();
      updateSlideQuad(selectedSlide.id, next);
      void refreshSlideThumbnail(selectedSlide.id, next);
      return;
    }
    cancelActiveDrag();
    const worker = ensureWorker();
    if (!worker) return;
    setBusyText(`${text.stretching}: ${selectedSlide.name}`);
    worker.postMessage({
      type: "detect",
      files: [{ id: selectedSlide.id, name: selectedSlide.name, file: selectedSlide.file }],
      settings,
    });
  };

  const exportPdf = () => {
    if (!readySlides.length) return;
    const worker = ensureWorker();
    if (!worker) return;
    const filename = normalizePdfName(pdfBaseName);
    if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
    exportUrlRef.current = null;
    setExporting(true);
    setExportUrl(null);
    setWorkerError("");
    setBusyText(text.generating);
    worker.postMessage({
      type: "export",
      files: readySlides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
      slides: readySlides.map((slide) => ({
        id: slide.id,
        name: slide.name,
        quad: slide.quad,
      })),
      settings,
      filename,
    });
  };

  const selectAt = (index: number) => {
    const slide = slides[Math.max(0, Math.min(slides.length - 1, index))];
    if (slide) {
      cancelActiveDrag();
      if (slide.id !== selectedSlide?.id) {
        canvasRenderRef.current = null;
        setHandlePositions([]);
      }
      setSelectedId(slide.id);
      setZoomMode("fit");
    }
  };

  const zoomOut = () => {
    setZoomMode("manual");
    setZoom(Math.max(fitZoomRef.current * 0.5, Math.min(maxZoomRef.current, displayZoom / 1.18)));
  };

  const zoomIn = () => {
    setZoomMode("manual");
    setZoom(Math.min(maxZoomRef.current, Math.max(fitZoomRef.current * 0.5, displayZoom * 1.18)));
  };

  const metrics = selectedSlide
    ? [
        [text.file, selectedSlide.name],
        [text.status, selectedSlide.status === "queued" ? text.pending : selectedSlide.status],
        [text.dimensions, selectedSlide.width ? `${selectedSlide.width} × ${selectedSlide.height}` : "-"],
        [text.method, selectedSlide.method],
        [text.confidence, confidenceText(selectedSlide.confidence)],
        ["Privacy", text.noUpload],
      ]
    : [];

  return (
    <div className="app" aria-busy={busy || Boolean(busyText)}>
      <header className="topbar">
        <div className="brand">
          <div className="mark" aria-label={text.brandMark} role="img">
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 10.5L24 8.5V21.5L8 23.5V10.5Z" fill="var(--logo-slide, #F5F7F2)"/>
              <path d="M11 13.625L21 12.375V13.375L11 14.625Z" fill="var(--logo-lines, #64717A)"/>
              <path d="M11 16.125L19 15.125V16.125L11 17.125Z" fill="var(--logo-lines, #64717A)"/>
              <path d="M11 18.625L16 18.0V19.0L11 19.625Z" fill="var(--logo-lines, #64717A)"/>
            </svg>
          </div>
          <h1 className="brandText">{text.brandName}</h1>
        </div>
        <div className="settings">
          <details
            className="settingsMenu"
            ref={settingsMenuRef}
            defaultOpen
            onToggle={(event) => {
              if (!window.matchMedia("(max-width: 720px)").matches) {
                event.currentTarget.open = true;
              }
            }}
          >
            <summary className="settingsMenuToggle">{text.settings}</summary>
            <div className="settingsMenuBody">
              <label className="ratioSetting">
                <span>{text.ratio}</span>
                <select
                  value={settings.ratio}
                  onChange={(event) => setSettings((current) => ({ ...current, ratio: event.target.value as RatioValue }))}
                >
                  <option value="16:9">16:9</option>
                  <option value="4:3">4:3</option>
                </select>
              </label>
              <details
                className="moreSettings"
                ref={moreSettingsRef}
                onToggle={(event) => {
                  if (window.matchMedia("(max-width: 720px)").matches) {
                    event.currentTarget.open = true;
                  }
                }}
              >
                <summary>{text.more}</summary>
                <div className="morePanel">
                  <label>
                    <span>{text.width}</span>
                    <input
                      type="number"
                      min={800}
                      max={6000}
                      value={settings.width}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          width: Math.max(800, Math.min(6000, Number(event.target.value) || current.width)),
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>{text.height}</span>
                    <input
                      type="number"
                      min={600}
                      max={6000}
                      placeholder={text.heightAuto}
                      value={settings.height ?? ""}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          height: event.target.value
                            ? Math.max(600, Math.min(6000, Number(event.target.value) || 600))
                            : null,
                        }))
                      }
                    />
                  </label>
                  <label>
                    <span>{text.quality}</span>
                    <input
                      type="number"
                      min={60}
                      max={98}
                      value={Math.round(settings.quality * 100)}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          quality: Math.max(60, Math.min(98, Number(event.target.value) || 92)) / 100,
                        }))
                      }
                    />
                  </label>
                  <label className="checks">
                    <span>{text.grayscale}</span>
                    <input
                      type="checkbox"
                      checked={settings.grayscale}
                      onChange={(event) => setSettings((current) => ({ ...current, grayscale: event.target.checked }))}
                    />
                  </label>
                  <label className="colorSetting">
                    <span>{text.fillColor}</span>
                    <input
                      type="color"
                      value={settings.fillColor}
                      onChange={(event) => setSettings((current) => ({ ...current, fillColor: event.target.value }))}
                    />
                  </label>
                </div>
              </details>
              <label className="pdfNameSetting">
                <span>{text.pdfName}</span>
                <input value={pdfBaseName} onChange={(event) => setPdfBaseName(event.target.value)} type="text" />
                <span className="fileSuffix">.pdf</span>
              </label>
            </div>
          </details>
        </div>
      </header>

      <main className={`shell ${inspectorCollapsed ? "inspectorCollapsed" : ""}`}>
        <aside className="sidebar">
          <div className="sidebarActions">
            <button type="button" className="primary" disabled={busy || !slides.length} onClick={runAuto}>
              {text.runAuto}
            </button>
            <button type="button" className="green" disabled={busy || !readySlides.length} onClick={exportPdf}>
              {text.generatePdf}
            </button>
          </div>
          <div className="sidebarRunMeta">
            <div className="sidebarStatus" role="status" aria-live="polite">
              <span className={`statusDot ${statusTone}`} aria-hidden="true" />
              <span className="statusLine">{statusText}</span>
            </div>
            <div className="links sidebarLinks">
              {exportUrl ? (
                <a href={exportUrl} download={exportName}>
                  {text.downloadPdf}
                </a>
              ) : null}
            </div>
          </div>
          <div className="sectionHead">
            <h2>{text.images}</h2>
            <span className="count">{slides.length}</span>
          </div>
          <div>
            <input
              ref={inputRef}
              className="fileInput"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
              multiple
              disabled={busy}
              onChange={(event) => {
                const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
                event.currentTarget.value = "";
                if (files.length) void loadFiles(files);
              }}
            />
            <button
              type="button"
              className={`dropzone ${dragActive ? "active" : ""}`}
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                void loadFiles(event.dataTransfer.files);
              }}
            >
              <span className="dropzoneContent">
                <strong>{text.dropTitle}</strong>
                <span>{text.dropSubtitle}</span>
              </span>
            </button>
            <div className="files">
              {slides.map((slide, index) => {
                const active = selectedId === slide.id || (!selectedId && index === 0);
                const className = `${hasRun ? "slideRow" : "fileRow"} ${active ? "active" : ""}`;
                return (
                  <button
                    type="button"
                    key={slide.id}
                    className={className}
                    aria-pressed={active}
                    onClick={() => selectAt(index)}
                  >
                    <div className="idx">{String(index + 1).padStart(2, "0")}</div>
                    {/* eslint-disable-next-line @next/next/no-img-element -- Blob URLs are browser-local previews. */}
                    <img
                      className="thumb"
                      src={hasRun ? slide.thumbnailUrl ?? slide.url : slide.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="name">{slide.name}</div>
                    {hasRun ? (
                      <div className={`badge ${slide.confidence < 0.65 ? "low" : ""}`}>
                        {slide.status === "ready" ? confidenceText(slide.confidence) : slide.status}
                      </div>
                    ) : (
                      <div className="sub">{formatBytes(slide.file.size)}</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="workspace">
          <div className="reviewBar">
            <button
              type="button"
              className="icon reviewPrevious"
              disabled={!slides.length || selectedIndex <= 0}
              title={text.prev}
              aria-label={text.prev}
              onClick={() => selectAt(selectedIndex - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="icon reviewNext"
              disabled={!slides.length || selectedIndex < 0 || selectedIndex >= slides.length - 1}
              title={text.next}
              aria-label={text.next}
              onClick={() => selectAt(selectedIndex + 1)}
            >
              ›
            </button>
            <div className="title">
              {selectedSlide ? `${String((selectedIndex >= 0 ? selectedIndex : 0) + 1).padStart(2, "0")}  ${selectedSlide.name}` : text.noSlide}
            </div>
            <div className="zoomControls">
              <button type="button" className="icon" disabled={!selectedSlide} title={text.zoomOut} aria-label={text.zoomOut} onClick={zoomOut}>
                −
              </button>
              <span className="zoomValue">{Math.round(displayZoom * 100)}%</span>
              <button type="button" className="icon" disabled={!selectedSlide} title={text.zoomIn} aria-label={text.zoomIn} onClick={zoomIn}>
                +
              </button>
              <button type="button" disabled={!selectedSlide} title={text.fit} onClick={() => setZoomMode("fit")}>
                {text.fit}
              </button>
            </div>
            <button type="button" className="resetButton" disabled={!selectedSlide || selectedSlide.status !== "ready"} onClick={resetSelected}>
              {text.resetSlide}
            </button>
          </div>
          <div className="stage" ref={stageRef}>
            <div className="canvasShell">
              {selectedSlide ? (
                <div className="canvasWrap">
                  <canvas ref={canvasRef} aria-label={text.adjustCorners}>
                    {text.adjustCorners}
                  </canvas>
                  {selectedSlide.quad && handlePositions.length === selectedSlide.quad.length
                    ? selectedSlide.quad.map((_, index) => {
                        const position = handlePositions[index] ?? { left: 0, top: 0 };
                        return (
                          <button
                            type="button"
                            key={index}
                            ref={(node) => {
                              handleRefs.current[index] = node;
                            }}
                            className={`cornerHandle ${dragHandle === index ? "active" : ""}`}
                            style={{ left: position.left, top: position.top }}
                            aria-label={`${text.cornerHandle} ${index + 1}`}
                            title={text.adjustCorners}
                            onPointerDown={(event) => onHandlePointerDown(index, event)}
                            onPointerMove={onHandlePointerMove}
                            onPointerUp={onHandlePointerUp}
                            onPointerCancel={onHandlePointerUp}
                            onLostPointerCapture={onHandlePointerUp}
                            onKeyDown={(event) => onHandleKeyDown(index, event)}
                          />
                        );
                      })
                    : null}
                </div>
              ) : (
                <div className="empty">{text.empty}</div>
              )}
            </div>
          </div>
        </section>

        <aside className={`inspector ${inspectorCollapsed ? "collapsed" : ""}`}>
          <div className="sectionHead">
            <h2>{text.details}</h2>
            <span className="count">{readySlides.length}</span>
            <button
              className="icon inspectorToggle"
              type="button"
              title={inspectorCollapsed ? text.expand : text.collapse}
              aria-label={inspectorCollapsed ? text.expand : text.collapse}
              aria-expanded={!inspectorCollapsed}
              aria-controls="inspectorDetails"
              onClick={() => setInspectorCollapsed((value) => !value)}
            >
              {inspectorCollapsed ? "+" : "−"}
            </button>
          </div>
          <div className="inspectorBody" id="inspectorDetails">
            <div className="metrics">
              {metrics.map(([key, value]) => (
                <div className="metric" key={key}>
                  <div className="key">{key}</div>
                  <div className="value">{value}</div>
                </div>
              ))}
            </div>
            <div className="cornerTable">
              {selectedSlide?.quad
                ? selectedSlide.quad.map(([x, y], index) => (
                    <div className="cornerRow" key={index}>
                      <span>{index + 1}</span>
                      <code>{Math.round(x * 100) / 100}</code>
                      <code>{Math.round(y * 100) / 100}</code>
                    </div>
                  ))
                : null}
            </div>
            {workerError ? <p className="errorText" role="alert">{workerError}</p> : null}
            {selectedSlide?.error ? <p className="errorText" role="alert">{selectedSlide.error}</p> : null}
          </div>
        </aside>
      </main>

      <footer className="prefsBar">
        <label className="themeSetting">
          <span>{text.theme}</span>
          <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeValue)}>
            <option value="auto">{text.auto}</option>
            <option value="light">{text.light}</option>
            <option value="dark">{text.dark}</option>
          </select>
        </label>
        <label className="languageSetting">
          <span>{text.language}</span>
          <select value={locale} onChange={(event) => setLocale(event.target.value as LocaleValue)}>
            {localeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </footer>
    </div>
  );
}
