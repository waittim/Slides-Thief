"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import packageMetadata from "../package.json";
import { applyEnhancement, type EnhancementMode } from "./enhance";
import type { BatchPrior, Quad, ReviewReason } from "./detection/types";
import {
  normalizePdfName,
  PDF_BASENAME_MAX_LENGTH,
  sanitizePdfBaseName,
} from "./filename";
import {
  defaultOrientationForBaseFormat,
  deriveSourceFormat,
  isPaperRatio,
  outputPageRatioValue,
  pageLayoutMode,
  sourceFormatRatioValue,
  splitSourceFormat,
  type BaseFormat,
  type Orientation,
  type OutputPageRatio,
  type PageLayoutMode,
  type SourceFormat,
} from "./ratio";

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
type ThemeValue = "auto" | "light" | "dark";
type LocaleValue = "zh-CN" | "zh-TW" | "en" | "es" | "fr" | "de" | "ja" | "ko" | "pt-BR";

const APP_VERSION = packageMetadata.version;

type Settings = {
  sourceFormat: SourceFormat;
  sourceCustomRatio?: number;
  outputPageRatio: OutputPageRatio;
  width: number;
  height: number | null;
  quality: number;
  enhancement: EnhancementMode;
  fillColor: string;
};

type SlideStatus = "converting" | "queued" | "detecting" | "ready" | "error";

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
  needsReview: boolean;
  reviewReasons: ReviewReason[];
  reviewedByUser: boolean;
  sourceRatio: number;
  status: SlideStatus;
  error?: string;
};

type DetectResult = {
  id: string;
  width: number;
  height: number;
  quad: Quad;
  sourceRatio: number;
  method: string;
  confidence: number;
  needsReview: boolean;
  reviewReasons: ReviewReason[];
  bestScore: number;
  secondBestScore: number | null;
  candidatesEvaluated: number;
  diagnostics: Record<string, unknown>;
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
  | { type: "detect-result"; phase: "preliminary" | "final"; result: DetectResult }
  | {
      type: "detect-batch-summary";
      summary: {
        preliminaryCount: number;
        reliableCount: number;
        priorCount: number;
        priors: BatchPrior[];
      };
    }
  | { type: "slide-error"; id: string; error: string }
  | { type: "export-progress"; current: number; total: number; name: string }
  | { type: "export-complete"; pdf: ArrayBuffer; filename: string }
  | { type: "error"; error: string };

const defaultSettings: Settings = {
  sourceFormat: "16:9",
  outputPageRatio: "match-source",
  width: 2400,
  height: null,
  quality: 0.92,
  enhancement: "original",
  fillColor: "auto",
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

const ratioUiCopy: Record<LocaleValue, {
  sourceFormat: string;
  presentationGroup: string;
  documentGroup: string;
  custom: string;
  customRatio: string;
  pageLayout: string;
  matchSource: string;
  standardPaper: string;
  customPage: string;
  paperFormat: string;
  orientation: string;
  landscape: string;
  portrait: string;
}> = {
  "zh-CN": {
    sourceFormat: "原稿格式",
    presentationGroup: "幻灯片",
    documentGroup: "文档",
    custom: "自定义比例",
    customRatio: "自定义比例",
    pageLayout: "PDF 页面",
    matchSource: "与原稿一致（推荐）",
    standardPaper: "标准纸张",
    customPage: "自定义页面",
    paperFormat: "纸张规格",
    orientation: "方向",
    landscape: "横向",
    portrait: "纵向",
  },
  "zh-TW": {
    sourceFormat: "原稿格式",
    presentationGroup: "投影片",
    documentGroup: "文件",
    custom: "自訂比例",
    customRatio: "自訂比例",
    pageLayout: "PDF 頁面",
    matchSource: "與原稿一致（建議）",
    standardPaper: "標準紙張",
    customPage: "自訂頁面",
    paperFormat: "紙張規格",
    orientation: "方向",
    landscape: "橫向",
    portrait: "縱向",
  },
  en: {
    sourceFormat: "Source format",
    presentationGroup: "Presentation",
    documentGroup: "Document",
    custom: "Custom ratio",
    customRatio: "Custom ratio",
    pageLayout: "PDF page",
    matchSource: "Match source (recommended)",
    standardPaper: "Standard paper",
    customPage: "Custom page",
    paperFormat: "Paper format",
    orientation: "Orientation",
    landscape: "Landscape",
    portrait: "Portrait",
  },
  es: {
    sourceFormat: "Formato original",
    presentationGroup: "Presentación",
    documentGroup: "Documento",
    custom: "Relación personalizada",
    customRatio: "Relación personalizada",
    pageLayout: "Página PDF",
    matchSource: "Igual al original (recomendado)",
    standardPaper: "Papel estándar",
    customPage: "Página personalizada",
    paperFormat: "Papel",
    orientation: "Orientación",
    landscape: "Horizontal",
    portrait: "Vertical",
  },
  fr: {
    sourceFormat: "Format de l’original",
    presentationGroup: "Présentation",
    documentGroup: "Document",
    custom: "Format personnalisé",
    customRatio: "Format personnalisé",
    pageLayout: "Page PDF",
    matchSource: "Identique à l’original (recommandé)",
    standardPaper: "Papier standard",
    customPage: "Page personnalisée",
    paperFormat: "Papier",
    orientation: "Orientation",
    landscape: "Paysage",
    portrait: "Portrait",
  },
  de: {
    sourceFormat: "Vorlagenformat",
    presentationGroup: "Präsentation",
    documentGroup: "Dokument",
    custom: "Eigenes Seitenverhältnis",
    customRatio: "Eigenes Seitenverhältnis",
    pageLayout: "PDF-Seite",
    matchSource: "Wie Vorlage (empfohlen)",
    standardPaper: "Standardpapier",
    customPage: "Eigene Seite",
    paperFormat: "Papier",
    orientation: "Ausrichtung",
    landscape: "Querformat",
    portrait: "Hochformat",
  },
  ja: {
    sourceFormat: "原稿形式",
    presentationGroup: "プレゼンテーション",
    documentGroup: "文書",
    custom: "カスタム比率",
    customRatio: "カスタム比率",
    pageLayout: "PDF ページ",
    matchSource: "原稿に合わせる（推奨）",
    standardPaper: "標準用紙",
    customPage: "カスタムページ",
    paperFormat: "用紙サイズ",
    orientation: "向き",
    landscape: "横",
    portrait: "縦",
  },
  ko: {
    sourceFormat: "원본 형식",
    presentationGroup: "프레젠테이션",
    documentGroup: "문서",
    custom: "사용자 지정 비율",
    customRatio: "사용자 지정 비율",
    pageLayout: "PDF 페이지",
    matchSource: "원본에 맞춤(권장)",
    standardPaper: "표준 용지",
    customPage: "사용자 지정 페이지",
    paperFormat: "용지 규격",
    orientation: "방향",
    landscape: "가로",
    portrait: "세로",
  },
  "pt-BR": {
    sourceFormat: "Formato original",
    presentationGroup: "Apresentação",
    documentGroup: "Documento",
    custom: "Proporção personalizada",
    customRatio: "Proporção personalizada",
    pageLayout: "Página PDF",
    matchSource: "Igual ao original (recomendado)",
    standardPaper: "Papel padrão",
    customPage: "Página personalizada",
    paperFormat: "Papel",
    orientation: "Orientação",
    landscape: "Paisagem",
    portrait: "Retrato",
  },
};

type ReviewUiCopy = {
  reviewSuggested: string;
  corrected: string;
  manualAdjustment: string;
  fallbackFrame: string;
  automaticDetection: string;
  automaticRecognized: string;
  privacy: string;
  reviewSummary: (count: number) => string;
  reviewConfirmation: (count: number) => string;
};

const reviewUiCopy: Record<LocaleValue, ReviewUiCopy> = {
  "zh-CN": {
    reviewSuggested: "建议复查",
    corrected: "已校正",
    manualAdjustment: "手动调整",
    fallbackFrame: "备用边框",
    automaticDetection: "自动检测",
    automaticRecognized: "自动识别",
    privacy: "隐私",
    reviewSummary: (count) => `${count} 张照片建议复查`,
    reviewConfirmation: (count) => `有 ${count} 张照片建议复查。仍要生成 PDF 吗？`,
  },
  "zh-TW": {
    reviewSuggested: "建議檢查",
    corrected: "已校正",
    manualAdjustment: "手動調整",
    fallbackFrame: "備用邊框",
    automaticDetection: "自動偵測",
    automaticRecognized: "自動辨識",
    privacy: "隱私",
    reviewSummary: (count) => `${count} 張相片建議檢查`,
    reviewConfirmation: (count) => `有 ${count} 張相片建議檢查。仍要產生 PDF 嗎？`,
  },
  en: {
    reviewSuggested: "Review suggested",
    corrected: "Corrected",
    manualAdjustment: "Manual adjustment",
    fallbackFrame: "Fallback frame",
    automaticDetection: "Automatic detection",
    automaticRecognized: "Automatically detected",
    privacy: "Privacy",
    reviewSummary: (count) => `${count} photo${count === 1 ? "" : "s"} may need review`,
    reviewConfirmation: (count) =>
      `${count} photo${count === 1 ? "" : "s"} may need review. Generate the PDF anyway?`,
  },
  es: {
    reviewSuggested: "Revisión recomendada",
    corrected: "Corregido",
    manualAdjustment: "Ajuste manual",
    fallbackFrame: "Marco alternativo",
    automaticDetection: "Detección automática",
    automaticRecognized: "Detectado automáticamente",
    privacy: "Privacidad",
    reviewSummary: (count) =>
      `${count} ${count === 1 ? "foto puede" : "fotos pueden"} necesitar revisión`,
    reviewConfirmation: (count) =>
      `${count} ${count === 1 ? "foto puede" : "fotos pueden"} necesitar revisión. ¿Generar el PDF de todos modos?`,
  },
  fr: {
    reviewSuggested: "Vérification conseillée",
    corrected: "Corrigé",
    manualAdjustment: "Ajustement manuel",
    fallbackFrame: "Cadre de secours",
    automaticDetection: "Détection automatique",
    automaticRecognized: "Détecté automatiquement",
    privacy: "Confidentialité",
    reviewSummary: (count) => `${count} photo${count === 1 ? "" : "s"} à vérifier`,
    reviewConfirmation: (count) =>
      `${count} photo${count === 1 ? "" : "s"} à vérifier. Générer quand même le PDF ?`,
  },
  de: {
    reviewSuggested: "Prüfung empfohlen",
    corrected: "Korrigiert",
    manualAdjustment: "Manuelle Anpassung",
    fallbackFrame: "Ersatzrahmen",
    automaticDetection: "Automatische Erkennung",
    automaticRecognized: "Automatisch erkannt",
    privacy: "Datenschutz",
    reviewSummary: (count) =>
      `${count} Foto${count === 1 ? " sollte" : "s sollten"} geprüft werden`,
    reviewConfirmation: (count) =>
      `${count} Foto${count === 1 ? " sollte" : "s sollten"} geprüft werden. PDF trotzdem erstellen?`,
  },
  ja: {
    reviewSuggested: "要確認",
    corrected: "補正済み",
    manualAdjustment: "手動調整",
    fallbackFrame: "代替フレーム",
    automaticDetection: "自動検出",
    automaticRecognized: "自動認識",
    privacy: "プライバシー",
    reviewSummary: (count) => `${count}枚の写真を確認してください`,
    reviewConfirmation: (count) => `${count}枚の写真を確認する必要があります。このままPDFを生成しますか？`,
  },
  ko: {
    reviewSuggested: "검토 권장",
    corrected: "보정됨",
    manualAdjustment: "수동 조정",
    fallbackFrame: "대체 프레임",
    automaticDetection: "자동 감지",
    automaticRecognized: "자동 인식",
    privacy: "개인정보 보호",
    reviewSummary: (count) => `${count}장의 사진을 검토하는 것이 좋습니다`,
    reviewConfirmation: (count) => `${count}장의 사진을 검토하는 것이 좋습니다. 그래도 PDF를 생성할까요?`,
  },
  "pt-BR": {
    reviewSuggested: "Revisão recomendada",
    corrected: "Corrigido",
    manualAdjustment: "Ajuste manual",
    fallbackFrame: "Quadro alternativo",
    automaticDetection: "Detecção automática",
    automaticRecognized: "Detectado automaticamente",
    privacy: "Privacidade",
    reviewSummary: (count) =>
      `${count} ${count === 1 ? "foto pode" : "fotos podem"} precisar de revisão`,
    reviewConfirmation: (count) =>
      `${count} ${count === 1 ? "foto pode" : "fotos podem"} precisar de revisão. Gerar o PDF mesmo assim?`,
  },
};

const copy = {
  "zh-CN": {
    appTitle: "Slides Thief · PPT捕手",
    brandMark: "ST",
    brandName: "Slides Thief · PPT捕手",
    ratio: "比例",
    ratio16x9: "16:9",
    ratio4x3: "4:3",
    ratioA4Landscape: "A4（横向）",
    ratioA4Portrait: "A4（纵向）",
    ratioLetterLandscape: "Letter (横向)",
    ratioLetterPortrait: "Letter (纵向)",
    more: "更多设置",
    settings: "设置",
    width: "宽度",
    height: "高度",
    heightAuto: "自动",
    quality: "导出质量",
    enhancement: "输出效果",
    enhancementOriginal: "原图",
    enhancementClean: "清晰增强",
    enhancementHighContrast: "高对比",
    enhancementBw: "黑白扫描",
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
    uploadTitle: "点击上传照片",
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
    manualAdjusted: "已手动调整",
    previewError: "无法显示此照片的预览",
    downloadPdf: "下载 PDF",
    file: "文件",
    status: "状态",
    dimensions: "尺寸",
    method: "方法",
    confidence: "置信度",
    converting: "正在转换 HEIC/HEIF",
    pending: "待自动校正",
    noUpload: "浏览器本地处理",
    adjustCorners: "拖动四个编号角点以对齐原稿边缘",
    cornerHandle: "角点",
    cornerKeyboardHelp: "使用方向键微调角点；按住 Shift 可一次移动十个屏幕像素。",
    collapse: "缩小详情栏",
    expand: "展开详情栏",
    infoTitle: "关于 Slides Thief · PPT捕手",
    infoDesc: "Slides Thief 是一款本地运行的浏览器工具，可以将拍摄的倾斜幻灯片或文档快速矫正并整理成清晰的 PDF。",
    infoPrivacy: "照片和 PDF 均在本地处理，绝对不会上传到任何服务器，保护您的隐私安全。",
    infoRepo: "开源仓库",
    infoBlog: "介绍博客",
    shortcutsTitle: "快捷键指南",
    shortcutNav: "切换上一页 / 下一页",
    shortcutDelete: "删除选中的幻灯片",
    shortcutUndo: "撤销角点或页面调整",
    shortcutRedo: "重做上一步撤销",
    shortcutExport: "一键导出 PDF",
    shortcutNudge: "方向键 (+Shift) 8 方向微调角点",
    clearAll: "清空全部",
    clearAllConfirm: (count: number) => `确定要清空全部 ${count} 张图片吗？`,
    deleteSlideHint: "删除此图片",
    close: "关闭",
  },
  "zh-TW": {
    appTitle: "Slides Thief · PPT捕手",
    brandMark: "ST",
    brandName: "Slides Thief · PPT捕手",
    ratio: "比例",
    ratio16x9: "16:9",
    ratio4x3: "4:3",
    ratioA4Landscape: "A4（橫向）",
    ratioA4Portrait: "A4（縱向）",
    ratioLetterLandscape: "Letter (橫向)",
    ratioLetterPortrait: "Letter (縱向)",
    more: "更多設定",
    settings: "設定",
    width: "寬度",
    height: "高度",
    heightAuto: "自動",
    quality: "匯出品質",
    enhancement: "輸出效果",
    enhancementOriginal: "原圖",
    enhancementClean: "清晰增強",
    enhancementHighContrast: "高對比",
    enhancementBw: "黑白掃描",
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
    uploadTitle: "點擊上傳相片",
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
    manualAdjusted: "已手動調整",
    previewError: "無法顯示此照片的預覽",
    downloadPdf: "下載 PDF",
    file: "檔案",
    status: "狀態",
    dimensions: "尺寸",
    method: "方法",
    confidence: "可信度",
    converting: "正在轉換 HEIC/HEIF",
    pending: "待自動校正",
    noUpload: "瀏覽器本機處理",
    adjustCorners: "拖動四個編號角點以對齊原稿邊緣",
    cornerHandle: "角點",
    cornerKeyboardHelp: "使用方向鍵微調角點；按住 Shift 可一次移動十個畫面像素。",
    collapse: "收合詳情欄",
    expand: "展開詳情欄",
    infoTitle: "關於 Slides Thief · PPT捕手",
    infoDesc: "Slides Thief 是一款本地運行的瀏覽器工具，可以將拍攝的傾斜投影片或文件快速矯正並整理成清晰的 PDF。",
    infoPrivacy: "相片和 PDF 均在本地處理，絕對不會上傳到任何伺服器，保護您的隱私安全。",
    infoRepo: "開源倉庫",
    infoBlog: "介紹網誌",
    shortcutsTitle: "快捷鍵指南",
    shortcutNav: "切換上一頁 / 下一頁",
    shortcutDelete: "刪除選取的投影片",
    shortcutUndo: "復原角點或頁面調整",
    shortcutRedo: "重做上一步復原",
    shortcutExport: "一鍵匯出 PDF",
    shortcutNudge: "方向鍵 (+Shift) 8 方向微調角點",
    clearAll: "清空全部",
    clearAllConfirm: (count: number) => `確定要清空全部 ${count} 張圖片嗎？`,
    deleteSlideHint: "刪除此圖片",
    close: "關閉",
  },
  en: {
    appTitle: "Slides Thief - Straighten Slide & Document Photos into PDFs",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Ratio",
    ratio16x9: "16:9",
    ratio4x3: "4:3",
    ratioA4Landscape: "A4 (Landscape)",
    ratioA4Portrait: "A4 (Portrait)",
    ratioLetterLandscape: "Letter (Landscape)",
    ratioLetterPortrait: "Letter (Portrait)",
    more: "More settings",
    settings: "Settings",
    width: "Width",
    height: "Height",
    heightAuto: "Auto",
    quality: "Export quality",
    enhancement: "Enhancement",
    enhancementOriginal: "Original",
    enhancementClean: "Clean",
    enhancementHighContrast: "High contrast",
    enhancementBw: "Black & white",
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
    uploadTitle: "Click to upload photos",
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
    manualAdjusted: "Manually adjusted",
    previewError: "Couldn’t display this photo preview",
    downloadPdf: "Download PDF",
    file: "File",
    status: "Status",
    dimensions: "Dimensions",
    method: "Method",
    confidence: "Confidence",
    converting: "Converting HEIC/HEIF",
    pending: "Waiting for auto straighten",
    noUpload: "Browser-local processing",
    adjustCorners: "Drag the four numbered corners to align the source edges",
    cornerHandle: "Corner",
    cornerKeyboardHelp: "Use the arrow keys to fine-tune this corner. Hold Shift to move ten screen pixels.",
    collapse: "Collapse details",
    expand: "Expand details",
    infoTitle: "About Slides Thief",
    infoDesc: "Slides Thief is a browser-local tool that straightens skewed slide or document photos and organizes them into a clear PDF.",
    infoPrivacy: "All processing is done entirely locally on your device; your photos and PDFs are never uploaded to any server.",
    infoRepo: "Open Source Repo",
    infoBlog: "Introductory Blog",
    shortcutsTitle: "Keyboard Shortcuts",
    shortcutNav: "Previous / Next slide",
    shortcutDelete: "Delete selected slide",
    shortcutUndo: "Undo adjustment",
    shortcutRedo: "Redo adjustment",
    shortcutExport: "Export PDF",
    shortcutNudge: "Arrow keys (+Shift) nudge handle",
    clearAll: "Clear all",
    clearAllConfirm: (count: number) => `Are you sure you want to clear all ${count} images?`,
    deleteSlideHint: "Delete image",
    close: "Close",
  },
  es: {
    appTitle: "Slides Thief - Corrige fotos de diapositivas y documentos",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Relación",
    ratio16x9: "16:9",
    ratio4x3: "4:3",
    ratioA4Landscape: "A4 (Horizontal)",
    ratioA4Portrait: "A4 (Vertical)",
    ratioLetterLandscape: "Carta (Horizontal)",
    ratioLetterPortrait: "Carta (Vertical)",
    more: "Más ajustes",
    settings: "Ajustes",
    width: "Ancho",
    height: "Alto",
    heightAuto: "Auto",
    quality: "Calidad",
    enhancement: "Mejora",
    enhancementOriginal: "Original",
    enhancementClean: "Nítido",
    enhancementHighContrast: "Alto contraste",
    enhancementBw: "Blanco y negro",
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
    uploadTitle: "Haz clic para subir fotos",
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
    manualAdjusted: "Ajustado manualmente",
    previewError: "No se pudo mostrar la vista previa de esta foto",
    downloadPdf: "Descargar PDF",
    file: "Archivo",
    status: "Estado",
    dimensions: "Dimensiones",
    method: "Método",
    confidence: "Confianza",
    converting: "Convirtiendo HEIC/HEIF",
    pending: "Esperando enderezado",
    noUpload: "Proceso local",
    adjustCorners: "Arrastra las cuatro esquinas numeradas para alinear el original",
    cornerHandle: "Esquina",
    cornerKeyboardHelp: "Usa las flechas para ajustar esta esquina. Mantén Mayús para mover diez píxeles de pantalla.",
    collapse: "Contraer detalles",
    expand: "Expandir detalles",
    infoTitle: "Sobre Slides Thief",
    infoDesc: "Slides Thief corrige localmente fotos inclinadas de diapositivas o documentos y las organiza en un PDF claro.",
    infoPrivacy: "Todo el procesamiento se realiza localmente en su dispositivo; sus fotos y PDFs nunca se cargan a ningún servidor.",
    infoRepo: "Repositorio de Código",
    infoBlog: "Blog de Introducción",
    shortcutsTitle: "Atajos de teclado",
    shortcutNav: "Diapositiva anterior / siguiente",
    shortcutDelete: "Eliminar diapositiva seleccionada",
    shortcutUndo: "Deshacer ajuste",
    shortcutRedo: "Rehacer ajuste",
    shortcutExport: "Exportar PDF",
    shortcutNudge: "Flechas (+Shift) ajustar esquina",
    clearAll: "Limpiar todo",
    clearAllConfirm: (count: number) => `¿Seguro que quieres borrar las ${count} imágenes?`,
    deleteSlideHint: "Eliminar imagen",
    close: "Cerrar",
  },
  fr: {
    appTitle: "Slides Thief - Redresser des photos de diapositives et de documents",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Format",
    ratio16x9: "16:9",
    ratio4x3: "4:3",
    ratioA4Landscape: "A4 (Paysage)",
    ratioA4Portrait: "A4 (Portrait)",
    ratioLetterLandscape: "Lettre (Paysage)",
    ratioLetterPortrait: "Lettre (Portrait)",
    more: "Réglages",
    settings: "Réglages",
    width: "Largeur",
    height: "Hauteur",
    heightAuto: "Auto",
    quality: "Qualité",
    enhancement: "Amélioration",
    enhancementOriginal: "Original",
    enhancementClean: "Netteté",
    enhancementHighContrast: "Contraste élevé",
    enhancementBw: "Noir et blanc",
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
    uploadTitle: "Cliquez pour charger des photos",
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
    manualAdjusted: "Ajusté manuellement",
    previewError: "Impossible d’afficher l’aperçu de cette photo",
    downloadPdf: "Télécharger PDF",
    file: "Fichier",
    status: "État",
    dimensions: "Dimensions",
    method: "Méthode",
    confidence: "Confiance",
    converting: "Conversion HEIC/HEIF",
    pending: "En attente",
    noUpload: "Traitement local",
    adjustCorners: "Faites glisser les quatre coins numérotés pour aligner l’original",
    cornerHandle: "Coin",
    cornerKeyboardHelp: "Utilisez les flèches pour ajuster ce coin. Maintenez Maj pour déplacer dix pixels à l’écran.",
    collapse: "Réduire détails",
    expand: "Afficher détails",
    infoTitle: "À propos de Slides Thief",
    infoDesc: "Slides Thief redresse localement les photos inclinées de diapositives ou de documents et les organise dans un PDF propre.",
    infoPrivacy: "Tout le traitement est effectué localement sur votre appareil ; vos photos et PDF ne sont jamais téléchargés sur un serveur.",
    infoRepo: "Dépôt de Code",
    infoBlog: "Blog d'Introduction",
    shortcutsTitle: "Raccourcis clavier",
    shortcutNav: "Diapositive précédente / suivante",
    shortcutDelete: "Supprimer la diapositive",
    shortcutUndo: "Annuler la modification",
    shortcutRedo: "Rétablir la modification",
    shortcutExport: "Exporter en PDF",
    shortcutNudge: "Touches fléchées (+Shift) ajuster coin",
    clearAll: "Tout effacer",
    clearAllConfirm: (count: number) => `Voulez-vous vraiment effacer les ${count} images ?`,
    deleteSlideHint: "Supprimer l'image",
    close: "Fermer",
  },
  de: {
    appTitle: "Slides Thief - Folien- und Dokumentfotos begradigen",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Format",
    ratio16x9: "16:9",
    ratio4x3: "4:3",
    ratioA4Landscape: "A4 (Querformat)",
    ratioA4Portrait: "A4 (Hochformat)",
    ratioLetterLandscape: "US Letter (Querformat)",
    ratioLetterPortrait: "US Letter (Hochformat)",
    more: "Mehr",
    settings: "Einstellungen",
    width: "Breite",
    height: "Höhe",
    heightAuto: "Auto",
    quality: "Qualität",
    enhancement: "Verbesserung",
    enhancementOriginal: "Original",
    enhancementClean: "Klar",
    enhancementHighContrast: "Hoher Kontrast",
    enhancementBw: "Schwarzweiß",
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
    uploadTitle: "Fotos hochladen",
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
    manualAdjusted: "Manuell angepasst",
    previewError: "Die Vorschau dieses Fotos konnte nicht angezeigt werden",
    downloadPdf: "PDF herunterladen",
    file: "Datei",
    status: "Status",
    dimensions: "Größe",
    method: "Methode",
    confidence: "Sicherheit",
    converting: "HEIC/HEIF wird konvertiert",
    pending: "Wartet auf Begradigung",
    noUpload: "Lokale Verarbeitung",
    adjustCorners: "Ziehen Sie die vier nummerierten Ecken an die Vorlagenränder",
    cornerHandle: "Ecke",
    cornerKeyboardHelp: "Mit den Pfeiltasten lässt sich diese Ecke feinjustieren. Umschalt bewegt zehn Bildschirmpixel.",
    collapse: "Details einklappen",
    expand: "Details ausklappen",
    infoTitle: "Über Slides Thief",
    infoDesc: "Slides Thief begradigt Folien- oder Dokumentfotos lokal im Browser und organisiert sie in einer übersichtlichen PDF-Datei.",
    infoPrivacy: "Die Verarbeitung erfolgt vollständig lokal auf Ihrem Gerät; Ihre Fotos und PDFs werden niemals auf einen Server hochgeladen.",
    infoRepo: "Code-Repository",
    infoBlog: "Einführungs-Blog",
    shortcutsTitle: "Tastaturkurzbefehle",
    shortcutNav: "Vorherige / nächste Folie",
    shortcutDelete: "Ausgewählte Folie löschen",
    shortcutUndo: "Anpassung rückgängig machen",
    shortcutRedo: "Anpassung wiederholen",
    shortcutExport: "PDF exportieren",
    shortcutNudge: "Pfeiltasten (+Shift) Eckpunkt anpassen",
    clearAll: "Alles löschen",
    clearAllConfirm: (count: number) => `Möchten Sie wirklich alle ${count} Bilder löschen?`,
    deleteSlideHint: "Bild löschen",
    close: "Schließen",
  },
  ja: {
    appTitle: "Slides Thief - スライドや文書の写真を補正してPDF化",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "比率",
    ratio16x9: "16:9",
    ratio4x3: "4:3",
    ratioA4Landscape: "A4（横）",
    ratioA4Portrait: "A4（縦）",
    ratioLetterLandscape: "レター (横)",
    ratioLetterPortrait: "レター (縦)",
    more: "詳細設定",
    settings: "設定",
    width: "幅",
    height: "高さ",
    heightAuto: "自動",
    quality: "品質",
    enhancement: "補正",
    enhancementOriginal: "オリジナル",
    enhancementClean: "クリア",
    enhancementHighContrast: "高コントラスト",
    enhancementBw: "白黒スキャン",
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
    uploadTitle: "タップして写真をアップロード",
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
    manualAdjusted: "手動調整済み",
    previewError: "この写真のプレビューを表示できません",
    downloadPdf: "PDFを保存",
    file: "ファイル",
    status: "状態",
    dimensions: "サイズ",
    method: "方法",
    confidence: "信頼度",
    converting: "HEIC/HEIF を変換中",
    pending: "自動補正待ち",
    noUpload: "ブラウザ内処理",
    adjustCorners: "4つの番号付きコーナーをドラッグして原稿の端に合わせます",
    cornerHandle: "コーナー",
    cornerKeyboardHelp: "矢印キーでコーナーを微調整します。Shift キーを押しながら操作すると画面上で10ピクセル移動します。",
    collapse: "詳細を閉じる",
    expand: "詳細を開く",
    infoTitle: "Slides Thief について",
    infoDesc: "Slides Thiefは、斜めに撮影されたスライドや文書をブラウザ内で補正し、綺麗なPDFとして整理します。",
    infoPrivacy: "すべての処理はデバイス上でローカルに実行され、写真やPDFがサーバーにアップロードされることはありません。",
    infoRepo: "オープンソースリポジトリ",
    infoBlog: "紹介ブログ",
    shortcutsTitle: "キーボードショートカット",
    shortcutNav: "前 / 次のスライドに移動",
    shortcutDelete: "選択中のスライドを削除",
    shortcutUndo: "調整を取り消す",
    shortcutRedo: "やり直す",
    shortcutExport: "PDF を出力",
    shortcutNudge: "矢印キー (+Shift) で頂点を微調整",
    clearAll: "すべて消去",
    clearAllConfirm: (count: number) => `全 ${count} 枚の画像を消去してもよろしいですか？`,
    deleteSlideHint: "画像を削除",
    close: "閉じる",
  },
  ko: {
    appTitle: "Slides Thief - 슬라이드와 문서 사진을 PDF로 보정",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "비율",
    ratio16x9: "16:9",
    ratio4x3: "4:3",
    ratioA4Landscape: "A4(가로)",
    ratioA4Portrait: "A4(세로)",
    ratioLetterLandscape: "Letter (가로)",
    ratioLetterPortrait: "Letter (세로)",
    more: "추가 설정",
    settings: "설정",
    width: "너비",
    height: "높이",
    heightAuto: "자동",
    quality: "품질",
    enhancement: "향상",
    enhancementOriginal: "원본",
    enhancementClean: "선명",
    enhancementHighContrast: "고대비",
    enhancementBw: "흑백 스캔",
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
    uploadTitle: "사진 업로드하려면 클릭",
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
    manualAdjusted: "수동 조정됨",
    previewError: "이 사진의 미리보기를 표시할 수 없습니다",
    downloadPdf: "PDF 저장",
    file: "파일",
    status: "상태",
    dimensions: "크기",
    method: "방법",
    confidence: "신뢰도",
    converting: "HEIC/HEIF 변환 중",
    pending: "자동 보정 대기",
    noUpload: "브라우저 내 처리",
    adjustCorners: "번호가 표시된 네 모서리를 끌어 원본 가장자리에 맞추세요",
    cornerHandle: "모서리",
    cornerKeyboardHelp: "화살표 키로 모서리를 미세 조정하세요. Shift를 누르면 화면에서 10픽셀씩 이동합니다.",
    collapse: "상세 접기",
    expand: "상세 펼치기",
    infoTitle: "Slides Thief 정보",
    infoDesc: "Slides Thief는 비스듬하게 촬영된 슬라이드나 문서를 브라우저에서 교정하고 깔끔한 PDF로 정리합니다.",
    infoPrivacy: "모든 처리는 기기에서 로컬로 진행되며, 사진과 PDF는 절대 서버로 업로드되지 않습니다.",
    infoRepo: "오픈 소스 저장소",
    infoBlog: "소개 블로그",
    shortcutsTitle: "키보드 단축키",
    shortcutNav: "이전 / 다음 슬라이드 이동",
    shortcutDelete: "선택한 슬라이드 삭제",
    shortcutUndo: "조정 취소",
    shortcutRedo: "다시 실행",
    shortcutExport: "PDF 내보내기",
    shortcutNudge: "방향키 (+Shift) 미세 조정",
    clearAll: "모두 지우기",
    clearAllConfirm: (count: number) => `전체 ${count}개의 이미지를 지우시겠습니까?`,
    deleteSlideHint: "이미지 삭제",
    close: "닫기",
  },
  "pt-BR": {
    appTitle: "Slides Thief - Corrigir fotos de slides e documentos",
    brandMark: "ST",
    brandName: "Slides Thief",
    ratio: "Proporção",
    ratio16x9: "16:9",
    ratio4x3: "4:3",
    ratioA4Landscape: "A4 (Paisagem)",
    ratioA4Portrait: "A4 (Retrato)",
    ratioLetterLandscape: "Carta (Paisagem)",
    ratioLetterPortrait: "Carta (Retrato)",
    more: "Mais ajustes",
    settings: "Ajustes",
    width: "Largura",
    height: "Altura",
    heightAuto: "Auto",
    quality: "Qualidade",
    enhancement: "Melhoria",
    enhancementOriginal: "Original",
    enhancementClean: "Nítido",
    enhancementHighContrast: "Alto contraste",
    enhancementBw: "Preto e branco",
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
    uploadTitle: "Clique para enviar fotos",
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
    manualAdjusted: "Ajustado manualmente",
    previewError: "Não foi possível exibir a prévia desta foto",
    downloadPdf: "Baixar PDF",
    file: "Arquivo",
    status: "Status",
    dimensions: "Dimensões",
    method: "Método",
    confidence: "Confiança",
    converting: "Convertendo HEIC/HEIF",
    pending: "Aguardando correção",
    noUpload: "Processamento local",
    adjustCorners: "Arraste os quatro cantos numerados para alinhar as bordas do original",
    cornerHandle: "Canto",
    cornerKeyboardHelp: "Use as setas para ajustar este canto. Segure Shift para mover dez pixels na tela.",
    collapse: "Recolher detalhes",
    expand: "Expandir detalhes",
    infoTitle: "Sobre o Slides Thief",
    infoDesc: "O Slides Thief corrige localmente fotos inclinadas de slides ou documentos e as organiza em um PDF limpo.",
    infoPrivacy: "Todo o processamento é feito localmente no seu dispositivo; suas fotos e PDFs nunca são enviados para qualquer servidor.",
    infoRepo: "Repositório de Código",
    infoBlog: "Blog de Introdução",
    shortcutsTitle: "Atalhos de teclado",
    shortcutNav: "Slide anterior / próximo",
    shortcutDelete: "Excluir slide selecionado",
    shortcutUndo: "Desfazer ajuste",
    shortcutRedo: "Refazer ajuste",
    shortcutExport: "Exportar PDF",
    shortcutNudge: "Setas (+Shift) ajustar ponto",
    clearAll: "Limpar tudo",
    clearAllConfirm: (count: number) => `Tem certeza de que deseja limpar todas as ${count} imagens?`,
    deleteSlideHint: "Excluir imagem",
    close: "Fechar",
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

function stripFileExtension(name: string) {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return name;
  return name.slice(0, lastDot);
}

function displayFileName(name: string, hideExtension: boolean) {
  return hideExtension ? stripFileExtension(name) : name;
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

function detectionMethodText(method: string, locale: LocaleValue) {
  const reviewText = reviewUiCopy[locale];
  if (method === "manual") return reviewText.manualAdjustment;
  if (method === "fallback-frame") return reviewText.fallbackFrame;
  if (["contrast-lines", "mask-lines", "hough-lines", "batch-prior"].includes(method)) {
    return reviewText.automaticDetection;
  }
  return "-";
}

function cloneQuad(quad: Quad): Quad {
  return quad.map((point) => [point[0], point[1]]) as Quad;
}

function quadsMatch(first: Quad | null, second: Quad | null, tolerance = 0.01): boolean {
  if (!first || !second) return first === second;
  return first.every(([x, y], index) =>
    Math.abs(x - second[index][0]) <= tolerance
    && Math.abs(y - second[index][1]) <= tolerance
  );
}

function quadHandlePositions(quad: Quad, padX: number, padY: number, scale: number): HandlePosition[] {
  return quad.map(([x, y]) => ({
    left: (padX + x) * scale,
    top: (padY + y) * scale,
  }));
}

const QUAD_OUTSIDE_RATIO = 0.3;

function maxQuadOutside(size: number) {
  return Math.round(size * QUAD_OUTSIDE_RATIO);
}

function clampQuadCoordinate(value: number, size: number, maxOutside: number) {
  return Math.max(-maxOutside, Math.min(size + maxOutside, value));
}

function parseHexColor(value: string): [number, number, number] {
  const clean = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "111111";
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

const AUTO_FILL_FALLBACK: [number, number, number] = [255, 255, 255];

/**
 * Finds the dominant colour inside the corrected slide, deliberately skipping
 * its edge so a projector bezel or photographed screen border is not used.
 */
function resolveFillColor(value: string, content: ImageData) {
  if (value !== "auto") return parseHexColor(value);
  const inset = 0.12;
  const left = content.width * inset;
  const right = content.width * (1 - inset);
  const top = content.height * inset;
  const bottom = content.height * (1 - inset);
  const samples: [number, number, number][] = [];

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 12; column += 1) {
      const x = left + (right - left) * ((column + 0.5) / 12);
      const y = top + (bottom - top) * ((row + 0.5) / 8);
      const offset = (
        Math.min(content.height - 1, Math.max(0, Math.round(y))) * content.width
        + Math.min(content.width - 1, Math.max(0, Math.round(x)))
      ) * 4;
      samples.push([content.data[offset], content.data[offset + 1], content.data[offset + 2]]);
    }
  }

  const buckets = new Map<string, [number, number, number][]>();
  for (const sample of samples) {
    const key = sample.map((value) => Math.floor(value / 32)).join(":");
    buckets.set(key, [...(buckets.get(key) ?? []), sample]);
  }
  const dominant = [...buckets.values()].reduce((largest, bucket) => bucket.length > largest.length ? bucket : largest, [] as [number, number, number][]);
  if (dominant.length < samples.length * 0.14) return AUTO_FILL_FALLBACK;
  return [0, 1, 2].map((channel) => medianValue(dominant.map((sample) => sample[channel]))) as [number, number, number];
}

function contentPixelBounds(target: Quad) {
  const x = Math.ceil(target[0][0]);
  const y = Math.ceil(target[0][1]);
  return {
    x,
    y,
    width: Math.max(1, Math.ceil(target[1][0]) - x),
    height: Math.max(1, Math.ceil(target[3][1]) - y),
  };
}

function extractContent(page: ImageData, bounds: ReturnType<typeof contentPixelBounds>) {
  const content = new ImageData(bounds.width, bounds.height);
  for (let y = 0; y < bounds.height; y += 1) {
    const sourceStart = ((bounds.y + y) * page.width + bounds.x) * 4;
    const targetStart = y * bounds.width * 4;
    content.data.set(page.data.subarray(sourceStart, sourceStart + bounds.width * 4), targetStart);
  }
  return content;
}

function fillAndBlitContent(
  page: ImageData,
  content: ImageData,
  bounds: ReturnType<typeof contentPixelBounds>,
  fill: [number, number, number],
  provisionalFill?: [number, number, number],
) {
  for (let offset = 0; offset < page.data.length; offset += 4) {
    page.data[offset] = fill[0];
    page.data[offset + 1] = fill[1];
    page.data[offset + 2] = fill[2];
    page.data[offset + 3] = 255;
  }
  for (let y = 0; y < bounds.height; y += 1) {
    const sourceStart = y * bounds.width * 4;
    const targetStart = ((bounds.y + y) * page.width + bounds.x) * 4;
    for (let x = 0; x < bounds.width; x += 1) {
      const sOff = sourceStart + x * 4;
      const tOff = targetStart + x * 4;
      const r = content.data[sOff];
      const g = content.data[sOff + 1];
      const b = content.data[sOff + 2];
      if (
        provisionalFill &&
        r === provisionalFill[0] &&
        g === provisionalFill[1] &&
        b === provisionalFill[2]
      ) {
        page.data[tOff] = fill[0];
        page.data[tOff + 1] = fill[1];
        page.data[tOff + 2] = fill[2];
        page.data[tOff + 3] = 255;
      } else {
        page.data[tOff] = r;
        page.data[tOff + 1] = g;
        page.data[tOff + 2] = b;
        page.data[tOff + 3] = 255;
      }
    }
  }
}

function sampleBlurredEdgeRgb(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cx: number,
  cy: number,
  radius: number = 3,
): [number, number, number] {
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let count = 0;

  const icx = Math.round(cx);
  const icy = Math.round(cy);
  const r = Math.min(14, Math.max(1, Math.round(radius)));
  const step = r > 8 ? 2 : 1;

  for (let dy = -r; dy <= r; dy += step) {
    for (let dx = -r; dx <= r; dx += step) {
      const px = Math.max(0, Math.min(width - 1, icx + dx));
      const py = Math.max(0, Math.min(height - 1, icy + dy));
      const offset = (py * width + px) * 4;
      rSum += data[offset];
      gSum += data[offset + 1];
      bSum += data[offset + 2];
      count += 1;
    }
  }

  return [Math.round(rSum / count), Math.round(gSum / count), Math.round(bSum / count)];
}

function medianValue(values: number[]) {
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)];
}

function outputRatio(settings: Settings, sourceRatio: number) {
  return settings.height
    ? settings.width / settings.height
    : outputPageRatioValue(settings.outputPageRatio, sourceRatio);
}

function resolvedSlideRatio(slide: SlideItem, settings: Settings) {
  return sourceFormatRatioValue(
    settings.sourceFormat,
    settings.sourceCustomRatio,
  );
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

function containedRect(width: number, height: number, ratio: number): Quad {
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

  const sourceRatio = resolvedSlideRatio(slide, settings);
  const outWidth = 160;
  const outHeight = Math.max(1, Math.round(outWidth / outputRatio(settings, sourceRatio)));
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = outWidth;
  outputCanvas.height = outHeight;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) throw new Error("Cannot render thumbnail in this browser.");
  const output = outputCtx.createImageData(outWidth, outHeight);
  const scaledQuad = quad.map(([x, y]) => [x * sourceScale, y * sourceScale]) as Quad;
  const dst = containedRect(outWidth, outHeight, sourceRatio);
  const coeffs = perspectiveCoefficients(scaledQuad, dst);
  const provisionalFill = settings.fillColor === "auto"
    ? [255, 255, 255] as [number, number, number]
    : parseHexColor(settings.fillColor);

  for (let y = 0; y < outHeight; y += 1) {
    for (let x = 0; x < outWidth; x += 1) {
      const den = coeffs[6] * x + coeffs[7] * y + 1;
      const sx = (coeffs[0] * x + coeffs[1] * y + coeffs[2]) / den;
      const sy = (coeffs[3] * x + coeffs[4] * y + coeffs[5]) / den;
      const outIndex = (y * outWidth + x) * 4;
      const insideContent = x >= dst[0][0] && x < dst[1][0] && y >= dst[0][1] && y < dst[3][1];
      if (insideContent) {
        const dx = sx < 0 ? -sx : sx >= sourceWidth ? sx - (sourceWidth - 1) : 0;
        const dy = sy < 0 ? -sy : sy >= sourceHeight ? sy - (sourceHeight - 1) : 0;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          const cx = Math.max(0, Math.min(sourceWidth - 1, sx));
          const cy = Math.max(0, Math.min(sourceHeight - 1, sy));
          const radius = Math.min(14, 2 + Math.floor(dist * 0.25));
          const [er, eg, eb] = sampleBlurredEdgeRgb(source, sourceWidth, sourceHeight, cx, cy, radius);
          output.data[outIndex] = er;
          output.data[outIndex + 1] = eg;
          output.data[outIndex + 2] = eb;
          output.data[outIndex + 3] = 255;
        } else {
          const ix = Math.round(sx);
          const iy = Math.round(sy);
          const srcIndex = (iy * sourceWidth + ix) * 4;
          output.data[outIndex] = source[srcIndex];
          output.data[outIndex + 1] = source[srcIndex + 1];
          output.data[outIndex + 2] = source[srcIndex + 2];
          output.data[outIndex + 3] = 255;
        }
      } else {
        output.data[outIndex] = provisionalFill[0];
        output.data[outIndex + 1] = provisionalFill[1];
        output.data[outIndex + 2] = provisionalFill[2];
        output.data[outIndex + 3] = 255;
      }
    }
  }
  const contentBounds = contentPixelBounds(dst);
  const content = extractContent(output, contentBounds);
  applyEnhancement(content.data, content.width, content.height, settings.enhancement);
  const fill = resolveFillColor(settings.fillColor, content);
  fillAndBlitContent(output, content, contentBounds, fill, provisionalFill);
  outputCtx.putImageData(output, 0, 0);
  return outputCanvas.toDataURL("image/png");
}

function cloneSlides(items: SlideItem[]): SlideItem[] {
  return items.map((slide) => ({
    ...slide,
    quad: slide.quad ? cloneQuad(slide.quad) : null,
    autoQuad: slide.autoQuad ? cloneQuad(slide.autoQuad) : null,
    reviewReasons: [...slide.reviewReasons],
  }));
}

export function SlidesThiefApp() {
  const [slides, setSlides] = useState<SlideItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
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
  const [previewErrorSlideId, setPreviewErrorSlideId] = useState<string | null>(null);
  const [dragHandle, setDragHandle] = useState<number | null>(null);
  const [zoomMode, setZoomMode] = useState<"fit" | "manual">("fit");
  const [zoom, setZoom] = useState(1);
  const [displayZoom, setDisplayZoom] = useState(1);
  const [handlePositions, setHandlePositions] = useState<HandlePosition[]>([]);
  const [cornerAnnouncement, setCornerAnnouncement] = useState("");
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const exportWorkerRef = useRef<Worker | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const slidesRef = useRef<SlideItem[]>([]);
  const historyPastRef = useRef<SlideItem[][]>([]);
  const historyFutureRef = useRef<SlideItem[][]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const exportingRef = useRef(false);
  const busyRef = useRef(false);
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
  const autoReviewSelectedRef = useRef(false);
  const loadTokenRef = useRef(0);
  const viewportRef = useRef({ padX: 0, padY: 0 });
  const scaleRef = useRef(1);
  const fitZoomRef = useRef(1);
  const maxZoomRef = useRef(3);
  const infoButtonRef = useRef<HTMLButtonElement | null>(null);
  const infoModalRef = useRef<HTMLDivElement | null>(null);
  const closeInfoButtonRef = useRef<HTMLButtonElement | null>(null);

  const text = copy[locale];
  const reviewText = reviewUiCopy[locale];
  const readySlides = slides.filter((slide) => slide.status === "ready" && slide.quad);
  const selectedIndex = slides.findIndex((slide) => slide.id === selectedId);
  const selectedSlide = selectedIndex >= 0 ? slides[selectedIndex] : slides[0] ?? null;
  const hasRun = slides.some(
    (slide) =>
      slide.status === "ready" ||
      slide.status === "detecting" ||
      (slide.status === "error" && slide.method !== "conversion-error"),
  );
  const detecting = slides.some((slide) => slide.status === "detecting");
  const reviewCount = slides.filter((slide) => slide.status === "ready" && slide.needsReview).length;
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
    if (reviewCount) return reviewText.reviewSummary(reviewCount);
    if (hasRun) return text.reviewReady;
    return `${slides.length} ${text.waiting}`;
  }, [busyText, detecting, exporting, exportUrl, hasRun, reviewCount, reviewText, slides.length, text, workerError]);

  const statusTone = useMemo(() => {
    if (workerError) return "bad";
    if (detecting || exporting) return "busy";
    if (hasRun || exportUrl) return "good";
    return "neutral";
  }, [detecting, exporting, exportUrl, hasRun, workerError]);

  const slideStatusText = (slide: SlideItem) => {
    if (slide.status === "converting") return text.converting;
    if (slide.status === "queued") return text.pending;
    if (slide.status === "detecting") return text.stretching;
    if (slide.status === "error") return text.failed;
    if (slide.needsReview) return reviewText.reviewSuggested;
    return reviewText.corrected;
  };

  const refreshSlideThumbnail = useCallback(async (id: string, quad: Quad, overrideSettings?: Settings) => {
    const slide = slidesRef.current.find((item) => item.id === id);
    if (!slide) return;
    try {
      const thumbnailUrl = await buildAdjustedThumbnail(slide, quad, overrideSettings ?? settingsRef.current);
      setSlides((current) => current.map((item) => (item.id === id ? { ...item, thumbnailUrl } : item)));
    } catch {
      // Keep the original preview if thumbnail generation fails.
    }
  }, []);

  const clearExport = useCallback(() => {
    if (exportUrlRef.current) {
      URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
    }
    setExportUrl((current) => (current === null ? current : null));
  }, []);

  const updateSettings = useCallback(
    (updater: (current: Settings) => Settings) => {
      clearExport();
      setSettings(updater);
    },
    [clearExport],
  );

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
              ? {
                  ...slide,
                  status: "detecting",
                  method: "detecting",
                  reviewedByUser: false,
                  thumbnailUrl: undefined,
                  error: undefined,
                }
              : slide,
          ),
        );
      }
      if (message.type === "detect-result") {
        const existing = slidesRef.current.find((slide) => slide.id === message.result.id);
        const preserveManualQuad = Boolean(
          existing?.reviewedByUser
          || (existing?.quad && existing.autoQuad && !quadsMatch(existing.quad, existing.autoQuad))
        );
        const displayedQuad = preserveManualQuad && existing?.quad
          ? existing.quad
          : message.result.quad;
        setSlides((current) =>
          current.map((slide) => {
            if (slide.id !== message.result.id) return slide;
            const preserveManualReview = Boolean(
              slide.reviewedByUser
              || (slide.quad && slide.autoQuad && !quadsMatch(slide.quad, slide.autoQuad))
            );
            return {
              ...slide,
              width: message.result.width,
              height: message.result.height,
              quad: preserveManualReview ? slide.quad : message.result.quad,
              autoQuad: message.result.quad,
              method: preserveManualReview ? "manual" : message.result.method,
              confidence: preserveManualReview ? 1 : message.result.confidence,
              needsReview: preserveManualReview ? false : message.result.needsReview,
              reviewReasons: preserveManualReview ? [] : message.result.reviewReasons,
              reviewedByUser: preserveManualReview,
              sourceRatio: message.result.sourceRatio,
              status: message.phase === "final" ? "ready" : "detecting",
              error: undefined,
            };
          }),
        );
        void refreshSlideThumbnail(message.result.id, displayedQuad);
        if (message.phase === "final") setBusyText("");
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

  const ensureExportWorker = useCallback(() => {
    if (exportWorkerRef.current) return exportWorkerRef.current;
    let worker: Worker;
    try {
      worker = new Worker(new URL("./slides-export-worker.ts", import.meta.url), {
        type: "module",
      });
    } catch (error) {
      setWorkerError(messageFromError(error));
      setExporting(false);
      setBusyText("");
      return null;
    }
    const releaseWorker = () => {
      worker.terminate();
      if (exportWorkerRef.current === worker) exportWorkerRef.current = null;
    };
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
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
        releaseWorker();
      }
      if (message.type === "error") {
        trackEvent("processing_error", {
          error_type: "export_worker_error",
          error_message: message.error || "PDF export error",
        });
        setWorkerError(message.error);
        setExporting(false);
        setBusyText("");
        releaseWorker();
      }
    };
    const handleWorkerFailure = (message: string) => {
      trackEvent("processing_error", {
        error_type: "export_worker_failure",
        error_message: message || "PDF worker terminated unexpectedly",
      });
      setWorkerError(message);
      setExporting(false);
      setBusyText("");
      releaseWorker();
    };
    worker.onerror = (event) => handleWorkerFailure(event.message || "The PDF worker stopped unexpectedly.");
    worker.onmessageerror = () => handleWorkerFailure("The browser could not read a response from the PDF worker.");
    exportWorkerRef.current = worker;
    return worker;
  }, []);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      exportWorkerRef.current?.terminate();
      exportWorkerRef.current = null;
      if (dragFrameRef.current !== null) window.cancelAnimationFrame(dragFrameRef.current);
    };
  }, []);

  useEffect(() => {
    slidesRef.current = slides;
  }, [slides]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    exportingRef.current = exporting;
  }, [exporting]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (slidesRef.current.length > 0 || exportingRef.current) {
        event.preventDefault();
        event.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const pushHistory = useCallback(() => {
    if (slidesRef.current.length === 0) return;
    historyPastRef.current = [...historyPastRef.current.slice(-29), cloneSlides(slidesRef.current)];
    historyFutureRef.current = [];
  }, []);

  const handleUndo = useCallback(() => {
    const past = historyPastRef.current;
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    historyPastRef.current = past.slice(0, -1);
    historyFutureRef.current = [cloneSlides(slidesRef.current), ...historyFutureRef.current];
    clearExport();
    setSlides(previous);
  }, [clearExport]);

  const handleRedo = useCallback(() => {
    const future = historyFutureRef.current;
    if (future.length === 0) return;
    const next = future[0];
    historyFutureRef.current = future.slice(1);
    historyPastRef.current = [...historyPastRef.current, cloneSlides(slidesRef.current)];
    clearExport();
    setSlides(next);
  }, [clearExport]);

  const updateLoupeCanvas = useCallback((quad: Quad | null, handleIndex: number | null) => {
    const loupeCanvas = loupeCanvasRef.current;
    const render = canvasRenderRef.current;
    if (!loupeCanvas || !render?.image || handleIndex === null || !quad || !quad[handleIndex]) return;

    const ctx = loupeCanvas.getContext("2d");
    if (!ctx) return;

    const [srcX, srcY] = quad[handleIndex];
    const size = 120;
    loupeCanvas.width = size;
    loupeCanvas.height = size;

    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const zoomFactor = 2.5;
    const srcSize = size / zoomFactor;
    const cropX = srcX - srcSize / 2;
    const cropY = srcY - srcSize / 2;

    ctx.drawImage(
      render.image,
      cropX,
      cropY,
      srcSize,
      srcSize,
      0,
      0,
      size,
      size,
    );
  }, []);

  const deleteSlide = useCallback(
    (id: string) => {
      pushHistory();
      clearExport();
      setSlides((current) => {
        const next = current.filter((slide) => slide.id !== id);
        if (selectedIdRef.current === id) {
          const index = current.findIndex((slide) => slide.id === id);
          const nextSelected = next[Math.min(index, next.length - 1)];
          setSelectedId(nextSelected?.id ?? null);
        }
        return next;
      });
    },
    [clearExport, pushHistory],
  );

  const clearAllSlides = useCallback(() => {
    const count = slidesRef.current.length;
    if (!count) return;
    const shouldClear = window.confirm(text.clearAllConfirm(count));
    if (!shouldClear) return;
    pushHistory();
    clearExport();
    cancelActiveDrag();
    setSlides([]);
    setSelectedId(null);
  }, [cancelActiveDrag, clearExport, pushHistory, text]);


  const selectNextSlide = useCallback(() => {
    const currentSlides = slidesRef.current;
    if (!currentSlides.length) return;
    const currentId = selectedIdRef.current;
    const currentIndex = currentSlides.findIndex((s) => s.id === currentId);
    const nextIndex = Math.min(currentIndex + 1, currentSlides.length - 1);
    if (nextIndex >= 0 && nextIndex !== currentIndex && currentSlides[nextIndex]) {
      cancelActiveDrag();
      setSelectedId(currentSlides[nextIndex].id);
      setZoomMode("fit");
    }
  }, [cancelActiveDrag]);

  const selectPrevSlide = useCallback(() => {
    const currentSlides = slidesRef.current;
    if (!currentSlides.length) return;
    const currentId = selectedIdRef.current;
    const currentIndex = currentSlides.findIndex((s) => s.id === currentId);
    const prevIndex = Math.max(currentIndex - 1, 0);
    if (prevIndex >= 0 && prevIndex !== currentIndex && currentSlides[prevIndex]) {
      cancelActiveDrag();
      setSelectedId(currentSlides[prevIndex].id);
      setZoomMode("fit");
    }
  }, [cancelActiveDrag]);


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
  }, [
    refreshSlideThumbnail,
    settings.enhancement,
    settings.fillColor,
    settings.height,
    settings.outputPageRatio,
    settings.sourceCustomRatio,
    settings.sourceFormat,
    settings.width,
  ]);

  useEffect(() => {
    exportUrlRef.current = exportUrl;
  }, [exportUrl]);

  useEffect(() => {
    if (detecting || !reviewCount || autoReviewSelectedRef.current) return;
    const firstReview = slides.find((slide) => slide.status === "ready" && slide.needsReview);
    if (!firstReview) return;
    const timeoutId = window.setTimeout(() => {
      autoReviewSelectedRef.current = true;
      setSelectedId(firstReview.id);
      setZoomMode("fit");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [detecting, reviewCount, slides]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const ua = window.navigator.userAgent;
      const isIOSDevice =
        /iPad|iPhone|iPod/.test(ua) ||
        (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsIOS(isIOSDevice);
    }
  }, []);

  useLayoutEffect(() => {
    const settingsMenu = settingsMenuRef.current;
    const moreSettings = moreSettingsRef.current;
    if (!settingsMenu) return;

    const media = window.matchMedia("(max-width: 834px)");
    const sync = () => {
      const matches = media.matches;
      setIsMobile(matches);
      if (matches) {
        settingsMenu.open = false;
        setSettingsOpen(false);
        if (moreSettings) moreSettings.open = true;
        setInspectorCollapsed(true);
      } else {
        settingsMenu.open = true;
        setSettingsOpen(true);
        setInspectorCollapsed(false);
      }
    };

    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (window.matchMedia("(max-width: 834px)").matches) {
        const settingsMenu = settingsMenuRef.current;
        if (settingsMenu && !settingsMenu.contains(target)) {
          if (settingsMenu.open) {
            settingsMenu.open = false;
            setSettingsOpen(false);
          }
        }
      } else {
        const moreSettings = moreSettingsRef.current;
        if (moreSettings && !moreSettings.contains(target)) {
          if (moreSettings.open) {
            moreSettings.open = false;
          }
        }
      }
    };

    document.addEventListener("click", handleDocumentClick);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = text.appTitle;
    localeRef.current = locale;
  }, [locale, text.appTitle]);

  useEffect(() => {
    if (!isInfoOpen) return;
    const fallbackFocus = infoButtonRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : fallbackFocus;
    const focusFrame = window.requestAnimationFrame(() => closeInfoButtonRef.current?.focus());
    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsInfoOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const modal = infoModalRef.current;
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hidden && element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleModalKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleModalKeyDown);
      (previousFocus?.isConnected ? previousFocus : fallbackFocus)?.focus();
    };
  }, [isInfoOpen]);

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
      exportWorkerRef.current?.terminate();
      exportWorkerRef.current = null;
      cancelActiveDrag();
      slidesRef.current.forEach((slide) => URL.revokeObjectURL(slide.url));
      if (exportUrlRef.current) URL.revokeObjectURL(exportUrlRef.current);
      exportUrlRef.current = null;
      imageCacheRef.current = null;
      canvasRenderRef.current = null;
      setPreviewErrorSlideId(null);
      if (canvasRef.current) {
        canvasRef.current.width = 1;
        canvasRef.current.height = 1;
      }
      const nextSlides: SlideItem[] = inputFiles.map((file, index) => {
        const converting = isHeifImage(file);
        return {
          id: makeId(file, index),
          file,
          name: file.name,
          url: converting ? "" : URL.createObjectURL(file),
          width: 0,
          height: 0,
          quad: null,
          autoQuad: null,
          method: converting ? "converting" : "queued",
          confidence: 0,
          needsReview: false,
          reviewReasons: [],
          reviewedByUser: false,
          sourceRatio: 16 / 9,
          status: converting ? "converting" : "queued",
        };
      });

      setSlides(nextSlides);
      setSelectedId(nextSlides[0]?.id ?? null);
      setHandlePositions([]);
      setExportUrl(null);
      setExportName(normalizePdfName(pdfBaseName));
      setZoomMode("fit");
      setWorkerError("");
      setBusyText(hasHeif ? copy[localeRef.current].converting : "");

      let firstConversionError = "";
      for (let index = 0; index < inputFiles.length; index += 1) {
        if (loadTokenRef.current !== token) return;
        const file = inputFiles[index];
        if (!isHeifImage(file)) continue;

        setBusyText(`${copy[localeRef.current].converting} ${index + 1}/${inputFiles.length}`);
        const id = nextSlides[index].id;
        try {
          const normalizedFile = await normalizeImageFile(file);
          if (loadTokenRef.current !== token) return;
          const url = URL.createObjectURL(normalizedFile);
          setSlides((current) =>
            current.map((slide) =>
              slide.id === id
                ? {
                    ...slide,
                    file: normalizedFile,
                    name: normalizedFile.name,
                    url,
                    method: "queued",
                    status: "queued",
                  }
                : slide,
            ),
          );
        } catch (error) {
          if (loadTokenRef.current !== token) return;
          const message = messageFromError(error);
          if (!firstConversionError) firstConversionError = message;
          setSlides((current) =>
            current.map((slide) =>
              slide.id === id
                ? { ...slide, method: "conversion-error", status: "error", error: message }
                : slide,
            ),
          );
        }
      }

      setBusyText("");
      if (firstConversionError) setWorkerError(firstConversionError);
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

    if (dragHandleRef.current !== null && quad) {
      updateLoupeCanvas(quad, dragHandleRef.current);
    }
  }, [updateLoupeCanvas]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const slide = selectedSlide;
    if (!canvas || !stage || !slide) return;
    if (!slide.url) {
      imageCacheRef.current = null;
      canvasRenderRef.current = null;
      setHandlePositions([]);
      return;
    }

    const renderImage = (image: HTMLImageElement) => {
      if (imageCacheRef.current?.image !== image) return;
      setPreviewErrorSlideId((current) => (current === slide.id ? null : current));
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
      const compact = stage.clientWidth <= 834 || window.matchMedia("(pointer: coarse)").matches;
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
      const maxOutsideX = maxQuadOutside(image.naturalWidth);
      const maxOutsideY = maxQuadOutside(image.naturalHeight);
      const padX = Math.min(
        maxOutsideX,
        Math.max(
          compact ? 40 : 64,
          Math.round(desiredHandleGutter / imageFitScale),
          Math.round(image.naturalWidth * 0.12),
          Math.ceil(quadOverflowX + handleSourceGutter),
        ),
      );
      const padY = Math.min(
        maxOutsideY,
        Math.max(
          compact ? 40 : 64,
          Math.round(desiredHandleGutter / imageFitScale),
          Math.round(image.naturalHeight * 0.12),
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
          if (imageCacheRef.current?.image === cached.image) setPreviewErrorSlideId(slide.id);
        };
      }
      return;
    }

    const image = new Image();
    image.decoding = "async";
    imageCacheRef.current = { id: slide.id, url: slide.url, image };
    image.onload = () => renderImage(image);
    image.onerror = () => {
      if (imageCacheRef.current?.image === image) setPreviewErrorSlideId(slide.id);
    };
    image.src = slide.url;
  }, [paintCanvas, selectedSlide, zoom, zoomMode]);

  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(redrawCanvas);
    const observer = new ResizeObserver(redrawCanvas);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => {
      window.cancelAnimationFrame(initialFrame);
      observer.disconnect();
    };
  }, [redrawCanvas]);

  const updateSlideQuad = useCallback((id: string, nextQuad: Quad) => {
    clearExport();
    setSlides((current) =>
      current.map((slide) => {
        if (slide.id === id) {
          if (slide.method !== "manual") {
            trackEvent("corner_adjusted", {
              slide_id: id,
            });
          }
          return {
            ...slide,
            quad: nextQuad,
            method: "manual",
            confidence: 1,
            needsReview: false,
            reviewReasons: [],
            reviewedByUser: true,
          };
        }
        return slide;
      }),
    );
  }, [clearExport]);

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
    pushHistory();
    latestDragQuadRef.current = { id: selectedSlide.id, quad: cloneQuad(selectedSlide.quad) };
    activePointerRef.current = event.pointerId;
    dragHandleRef.current = index;
    setDragHandle(index);
    updateLoupeCanvas(selectedSlide.quad, index);
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
    const imageWidth = render.image.naturalWidth;
    const imageHeight = render.image.naturalHeight;
    next[handleIndex] = [
      clampQuadCoordinate(x / scale - padX, imageWidth, maxQuadOutside(imageWidth)),
      clampQuadCoordinate(y / scale - padY, imageHeight, maxQuadOutside(imageHeight)),
    ];
    latestDragQuadRef.current = { id: latest.id, quad: next };
    if (dragFrameRef.current === null) {
      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const pending = latestDragQuadRef.current;
        if (!pending) return;
        const current = canvasRenderRef.current;
        const needsMorePad =
          !!current &&
          pending.quad.some(
            ([px, py]) =>
              px < -current.padX ||
              py < -current.padY ||
              px > current.image.naturalWidth + current.padX ||
              py > current.image.naturalHeight + current.padY,
          );
        if (needsMorePad) redrawCanvas();
        else paintCanvas(pending.quad);
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
    const handleIndex = dragHandleRef.current;
    if (latest) {
      paintCanvas(latest.quad);
      const render = canvasRenderRef.current;
      if (render) setHandlePositions(quadHandlePositions(latest.quad, render.padX, render.padY, render.scale));
      updateSlideQuad(latest.id, latest.quad);
      void refreshSlideThumbnail(latest.id, latest.quad);
      if (handleIndex !== null) {
        const [x, y] = latest.quad[handleIndex];
        setCornerAnnouncement(`${text.cornerHandle} ${handleIndex + 1}: X ${Math.round(x)}, Y ${Math.round(y)}`);
      }
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
    const imageWidth = render.image.naturalWidth;
    const imageHeight = render.image.naturalHeight;
    next[index] = [
      clampQuadCoordinate(next[index][0] + delta[0] * sourceStep, imageWidth, maxQuadOutside(imageWidth)),
      clampQuadCoordinate(next[index][1] + delta[1] * sourceStep, imageHeight, maxQuadOutside(imageHeight)),
    ];
    const needsMorePad =
      next[index][0] < -render.padX ||
      next[index][1] < -render.padY ||
      next[index][0] > imageWidth + render.padX ||
      next[index][1] > imageHeight + render.padY;
    latestDragQuadRef.current = { id: selectedSlide.id, quad: next };
    if (needsMorePad) {
      redrawCanvas();
    } else {
      paintCanvas(next);
      setHandlePositions(quadHandlePositions(next, render.padX, render.padY, render.scale));
    }
    latestDragQuadRef.current = null;
    updateSlideQuad(selectedSlide.id, next);
    void refreshSlideThumbnail(selectedSlide.id, next);
    setCornerAnnouncement(
      `${text.cornerHandle} ${index + 1}: X ${Math.round(next[index][0])}, Y ${Math.round(next[index][1])}`,
    );
  };

  const runAutoWithSettings = useCallback(
    (overrideSettings?: Settings) => {
      const processableSlides = slides.filter(
        (slide) => slide.status !== "converting" && slide.method !== "conversion-error" && slide.url,
      );
      if (!processableSlides.length) return;
      cancelActiveDrag();
      const worker = ensureWorker();
      if (!worker) return;
      clearExport();
      setWorkerError("");
      setBusyText(text.stretching);
      autoReviewSelectedRef.current = false;
      const targetSettings = overrideSettings ?? settings;
      const processableIds = new Set(processableSlides.map((slide) => slide.id));
      setSlides((current) =>
        current.map((slide) => {
          if (!processableIds.has(slide.id)) return slide;
          const isManual =
            slide.reviewedByUser ||
            Boolean(slide.quad && slide.autoQuad && !quadsMatch(slide.quad, slide.autoQuad));
          return {
            ...slide,
            status: "detecting",
            method: isManual ? "manual" : "detecting",
            reviewedByUser: isManual,
            quad: isManual ? slide.quad : null,
            thumbnailUrl: isManual ? slide.thumbnailUrl : undefined,
            error: undefined,
          };
        }),
      );
      worker.postMessage({
        type: "detect",
        files: processableSlides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
        settings: targetSettings,
      });
    },
    [cancelActiveDrag, clearExport, ensureWorker, settings, slides, text.stretching],
  );

  const runAuto = useCallback(() => {
    runAutoWithSettings();
  }, [runAutoWithSettings]);

  const resetSelected = () => {
    if (!selectedSlide) return;
    clearExport();
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
    const pagesNeedingReview = readySlides.filter((slide) => slide.needsReview);
    if (pagesNeedingReview.length) {
      const shouldContinue = window.confirm(reviewText.reviewConfirmation(pagesNeedingReview.length));
      if (!shouldContinue) {
        setSelectedId(pagesNeedingReview[0].id);
        setZoomMode("fit");
        return;
      }
    }
    const worker = ensureExportWorker();
    if (!worker) return;
    const filename = normalizePdfName(pdfBaseName);
    clearExport();
    setExporting(true);
    setWorkerError("");
    setBusyText(text.generating);
    worker.postMessage({
      type: "export",
      files: readySlides.map((slide) => ({ id: slide.id, name: slide.name, file: slide.file })),
      slides: readySlides.map((slide) => ({
        id: slide.id,
        name: slide.name,
        quad: slide.quad,
        sourceRatio: slide.sourceRatio,
      })),
      settings,
      filename,
    });
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (isInfoOpen) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Undo: Cmd+Z or Ctrl+Z
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
        return;
      }

      // Redo: Cmd+Shift+Z or Ctrl+Shift+Z or Ctrl+Y
      if (
        ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && event.shiftKey) ||
        (event.ctrlKey && event.key.toLowerCase() === "y")
      ) {
        event.preventDefault();
        handleRedo();
        return;
      }

      // Slide Navigation & Deletion
      if (slidesRef.current.length > 0) {
        if (event.key.toLowerCase() === "j" || event.key === "PageDown") {
          event.preventDefault();
          selectNextSlide();
          return;
        }
        if (event.key.toLowerCase() === "k" || event.key === "PageUp") {
          event.preventDefault();
          selectPrevSlide();
          return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          if (selectedIdRef.current) {
            event.preventDefault();
            deleteSlide(selectedIdRef.current);
          }
          return;
        }
      }

      // Export PDF: Cmd+Enter or Ctrl+Enter
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        const ready = slidesRef.current.filter((s) => s.status === "ready" && s.quad);
        if (ready.length && !busyRef.current) {
          exportPdf();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isInfoOpen, handleUndo, handleRedo, selectNextSlide, selectPrevSlide, deleteSlide]);


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
        [
          text.status,
          slideStatusText(selectedSlide),
        ],
        [text.dimensions, selectedSlide.width ? `${selectedSlide.width} × ${selectedSlide.height}` : "-"],
        [text.ratio, `${resolvedSlideRatio(selectedSlide, settings).toFixed(3)} : 1`],
        [text.method, detectionMethodText(selectedSlide.method, locale)],
        [text.confidence, confidenceText(selectedSlide.confidence)],
        [reviewText.privacy, text.noUpload],
      ]
    : [];
  const ratioUi = ratioUiCopy[locale];
  const currentPageLayout = pageLayoutMode(settings.outputPageRatio, settings.height);

  return (
    <div className="app" aria-busy={busy || Boolean(busyText)}>
      <header className="topbar" aria-hidden={isInfoOpen || undefined} inert={isInfoOpen ? true : undefined}>
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
            onToggle={(event) => {
              const isOpen = event.currentTarget.open;
              if (window.matchMedia("(max-width: 834px)").matches) {
                setSettingsOpen(isOpen);
              } else {
                event.currentTarget.open = true;
                setSettingsOpen(true);
              }
            }}
          >
            <summary className="settingsMenuToggle">{text.settings}</summary>
            {settingsOpen && (
              <div className="settingsMenuBody">
                {(() => {
                  const { baseFormat: currentBaseFormat, orientation: currentOrientation } = splitSourceFormat(settings.sourceFormat);
                  return (
                    <label className="ratioSetting">
                      <span>{ratioUi.sourceFormat}</span>
                      <select
                        value={currentBaseFormat}
                        onChange={(event) => {
                          const nextBaseFormat = event.target.value as BaseFormat;
                          const defaultOrient = defaultOrientationForBaseFormat(nextBaseFormat);
                          const sourceFormat = deriveSourceFormat(nextBaseFormat, defaultOrient);
                          const nextSettings: Settings = {
                            ...settings,
                            sourceFormat,
                          };
                          updateSettings(() => nextSettings);
                          if (hasRun) {
                            runAutoWithSettings(nextSettings);
                          }
                        }}
                      >
                        <optgroup label={ratioUi.presentationGroup}>
                          <option value="16:9">{text.ratio16x9}</option>
                          <option value="4:3">{text.ratio4x3}</option>
                          <option value="16:10">16:10</option>
                        </optgroup>
                        <optgroup label={ratioUi.documentGroup}>
                          <option value="A4">A4</option>
                          <option value="letter">Letter</option>
                        </optgroup>
                        <option value="custom">{ratioUi.custom}</option>
                      </select>
                    </label>
                  );
                })()}
                {settings.sourceFormat === "custom" && (
                  <label className="sourceCustomSetting">
                    <span>{ratioUi.customRatio}</span>
                    <input
                      type="number"
                      min={0.2}
                      max={5}
                      step={0.01}
                      value={settings.sourceCustomRatio ?? 16 / 9}
                      onChange={(event) => {
                        const sourceCustomRatio = Math.max(0.2, Math.min(5, Number(event.target.value) || 16 / 9));
                        const nextSettings = { ...settings, sourceCustomRatio };
                        updateSettings(() => nextSettings);
                        if (hasRun) runAutoWithSettings(nextSettings);
                      }}
                    />
                  </label>
                )}
                <details
                  className="moreSettings"
                  ref={moreSettingsRef}
                  open={isMobile ? true : undefined}
                  onToggle={(event) => {
                    if (window.matchMedia("(max-width: 834px)").matches) {
                      event.currentTarget.open = true;
                    }
                  }}
                >
                  <summary>{text.more}</summary>
                  <div className="morePanel">
                    {(() => {
                      const { baseFormat: currentBaseFormat, orientation: currentOrientation } = splitSourceFormat(settings.sourceFormat);
                      const isPortrait = currentOrientation === "portrait";
                      return (
                        <label className="orientationSetting">
                          <span>{ratioUi.orientation}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isPortrait}
                            aria-label={ratioUi.orientation}
                            className={`switchToggle ${isPortrait ? "checked" : ""}`}
                            onClick={() => {
                              const nextOrientation = isPortrait ? "landscape" : "portrait";
                              const nextFormat = deriveSourceFormat(currentBaseFormat, nextOrientation);
                              const nextSettings: Settings = { ...settings, sourceFormat: nextFormat };
                              updateSettings(() => nextSettings);
                              if (hasRun) runAutoWithSettings(nextSettings);
                            }}
                          >
                            <span className="switchTrack">
                              <span className="switchThumb" />
                            </span>
                            <span className="switchLabel">
                              {isPortrait ? ratioUi.portrait : ratioUi.landscape}
                            </span>
                          </button>
                        </label>
                      );
                    })()}
                    <label>
                      <span>{ratioUi.pageLayout}</span>
                      <select
                        value={currentPageLayout}
                        onChange={(event) => {
                          const nextLayout = event.target.value as PageLayoutMode;
                          updateSettings((current) => {
                            if (nextLayout === "paper") {
                              const sourceRatio = sourceFormatRatioValue(
                                current.sourceFormat,
                                current.sourceCustomRatio,
                                selectedSlide?.sourceRatio,
                              );
                              const outputPageRatio = isPaperRatio(current.outputPageRatio)
                                ? current.outputPageRatio
                                : sourceRatio >= 1
                                  ? "A4-landscape"
                                  : "A4-portrait";
                              return {
                                ...current,
                                outputPageRatio,
                                height: null,
                              };
                            }
                            if (nextLayout === "custom-size") {
                              const sourceRatio = sourceFormatRatioValue(
                                current.sourceFormat,
                                current.sourceCustomRatio,
                                selectedSlide?.sourceRatio,
                              );
                              const ratio = outputPageRatioValue(current.outputPageRatio, sourceRatio);
                              return {
                                ...current,
                                outputPageRatio: "match-source",
                                height: Math.max(600, Math.min(6000, Math.round(current.width / ratio))),
                              };
                            }
                            return {
                              ...current,
                              outputPageRatio: "match-source",
                              height: null,
                            };
                          });
                        }}
                      >
                        <option value="match-source">{ratioUi.matchSource}</option>
                        <option value="paper">{ratioUi.standardPaper}</option>
                        <option value="custom-size">{ratioUi.customPage}</option>
                      </select>
                    </label>
                    {currentPageLayout === "paper" && (
                      <label>
                        <span>{ratioUi.paperFormat}</span>
                        <select
                          value={settings.outputPageRatio}
                          onChange={(event) => {
                            const outputPageRatio = event.target.value as OutputPageRatio;
                            updateSettings((current) => ({
                              ...current,
                              outputPageRatio,
                              height: null,
                            }));
                          }}
                        >
                          <option value="A4-landscape">{text.ratioA4Landscape}</option>
                          <option value="A4-portrait">{text.ratioA4Portrait}</option>
                          <option value="letter-landscape">{text.ratioLetterLandscape}</option>
                          <option value="letter-portrait">{text.ratioLetterPortrait}</option>
                        </select>
                      </label>
                    )}
                    <label>
                      <span>{text.width}</span>
                      <input
                        type="number"
                        min={800}
                        max={6000}
                        value={settings.width}
                        onChange={(event) =>
                          updateSettings((current) => ({
                            ...current,
                            width: Math.max(800, Math.min(6000, Number(event.target.value) || current.width)),
                          }))
                        }
                      />
                    </label>
                    {currentPageLayout === "custom-size" && (
                      <label>
                        <span>{text.height}</span>
                        <input
                          type="number"
                          min={600}
                          max={6000}
                          value={settings.height ?? 1350}
                          onChange={(event) =>
                            updateSettings((current) => ({
                              ...current,
                              height: Math.max(600, Math.min(6000, Number(event.target.value) || 600)),
                            }))
                          }
                        />
                      </label>
                    )}
                    <label>
                      <span>{text.quality}</span>
                      <input
                        type="number"
                        min={60}
                        max={98}
                        value={Math.round(settings.quality * 100)}
                        onChange={(event) =>
                          updateSettings((current) => ({
                            ...current,
                            quality: Math.max(60, Math.min(98, Number(event.target.value) || 92)) / 100,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>{text.enhancement}</span>
                      <select
                        value={settings.enhancement}
                        onChange={(event) =>
                          updateSettings((current) => ({
                            ...current,
                            enhancement: event.target.value as EnhancementMode,
                          }))
                        }
                      >
                        <option value="original">{text.enhancementOriginal}</option>
                        <option value="clean">{text.enhancementClean}</option>
                        <option value="high-contrast">{text.enhancementHighContrast}</option>
                        <option value="bw">{text.enhancementBw}</option>
                      </select>
                    </label>
                    <div
                      className="colorSetting"
                      role="group"
                      aria-labelledby="fill-color-label"
                    >
                      <span id="fill-color-label">{text.fillColor}</span>
                      <div className="colorControls">
                        <button
                          type="button"
                          aria-pressed={settings.fillColor === "auto"}
                          onClick={() => updateSettings((current) => ({ ...current, fillColor: "auto" }))}
                        >
                          {text.auto}
                        </button>
                        <input
                          type="color"
                          className={settings.fillColor === "auto" ? undefined : "isActive"}
                          aria-label={text.fillColor}
                          value={settings.fillColor === "auto" ? "#FFFFFF" : settings.fillColor}
                          onChange={(event) => updateSettings((current) => ({ ...current, fillColor: event.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                </details>
                <label className="pdfNameSetting">
                  <span>{text.pdfName}</span>
                  <input
                    value={pdfBaseName}
                    maxLength={PDF_BASENAME_MAX_LENGTH}
                    onChange={(event) => setPdfBaseName(sanitizePdfBaseName(event.target.value))}
                    type="text"
                  />
                  <span className="fileSuffix">.pdf</span>
                </label>
                <hr className="settingsMenuDivider" />
                <label className="themeSetting settingsMenuTheme">
                  <span>{text.theme}</span>
                  <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeValue)}>
                    <option value="auto">{text.auto}</option>
                    <option value="light">{text.light}</option>
                    <option value="dark">{text.dark}</option>
                  </select>
                </label>
                <label className="languageSetting settingsMenuLanguage">
                  <span>{text.language}</span>
                  <select value={locale} onChange={(event) => setLocale(event.target.value as LocaleValue)}>
                    {localeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="settingsMenuInfoRow settingsMenuInfo"
                  onClick={() => setIsInfoOpen(true)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                  <span>{text.infoTitle}</span>
                </button>
              </div>
            )}
          </details>
        </div>
      </header>

      <main
        className={`shell ${inspectorCollapsed ? "inspectorCollapsed" : ""}`}
        aria-hidden={isInfoOpen || undefined}
        inert={isInfoOpen ? true : undefined}
      >
        <aside className="sidebar">
          <div className="sidebarActions">
            <button type="button" className="primary" disabled={busy || !slides.length} onClick={runAuto}>
              {text.runAuto}
            </button>
            <button type="button" className="green" disabled={busy || !readySlides.length} title={`${text.generatePdf} (⌘↵ / Ctrl+Enter)`} onClick={exportPdf}>
              {text.generatePdf}
            </button>
          </div>
          <div className="sidebarRunMeta">
            <div className="sidebarStatus" role="status" aria-live="polite">
              <span className={`statusDot ${statusTone}`} aria-hidden="true" />
              <span className="statusLine">{statusText}</span>
            </div>
            {exportUrl ? (
              <div className="links sidebarLinks">
                <a
                  href={exportUrl}
                  download={isIOS ? undefined : exportName}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {text.downloadPdf}
                </a>
              </div>
            ) : null}
          </div>
          <div className="sectionHead">
            <h2>{text.images}</h2>
            <span className="count">{slides.length}</span>
            {slides.length > 0 && (
              <button
                type="button"
                className="clearAllBtn"
                disabled={busy}
                title={text.clearAll}
                onClick={clearAllSlides}
              >
                {text.clearAll}
              </button>
            )}
          </div>
          <div className="sidebarFilePicker">
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
                <strong>{isMobile ? text.uploadTitle : text.dropTitle}</strong>
                {!isMobile && <span>{text.dropSubtitle}</span>}
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
                    {slide.url ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- Blob URLs are browser-local previews. */
                      <img
                        className="thumb"
                        src={hasRun ? slide.thumbnailUrl ?? slide.url : slide.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="thumb thumbPlaceholder" aria-hidden="true">
                        HEIC
                      </div>
                    )}
                    <div className="name" title={slide.name}>
                      {displayFileName(slide.name, isMobile)}
                    </div>
                    {hasRun ? (
                      <div className={`badge ${slide.needsReview ? "low" : ""} ${slide.status === "error" ? "error" : ""}`}>
                        {slide.status === "ready"
                          ? slide.needsReview
                            ? `! ${reviewText.reviewSuggested}`
                            : slide.method === "manual"
                              ? `✓ ${text.manualAdjusted}`
                              : `✓ ${reviewText.automaticRecognized}`
                          : slide.status === "error"
                            ? `× ${text.failed}`
                            : slideStatusText(slide)}
                      </div>
                    ) : (
                      <div className="sub">
                        {slide.status === "converting"
                          ? text.converting
                          : slide.status === "error"
                            ? text.failed
                            : formatBytes(slide.file.size)}
                      </div>
                    )}
                    <button
                      type="button"
                      className="slideDeleteBtn"
                      title={text.deleteSlideHint}
                      aria-label={`${text.deleteSlideHint}: ${slide.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteSlide(slide.id);
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                      </svg>
                    </button>
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
              title={`${text.prev} (K / PageUp)`}
              aria-label={text.prev}
              onClick={() => selectAt(selectedIndex - 1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="icon reviewNext"
              disabled={!slides.length || selectedIndex < 0 || selectedIndex >= slides.length - 1}
              title={`${text.next} (J / PageDown)`}
              aria-label={text.next}
              onClick={() => selectAt(selectedIndex + 1)}
            >
              ›
            </button>
            <div className="title" title={selectedSlide?.name}>
              {selectedSlide
                ? `${String((selectedIndex >= 0 ? selectedIndex : 0) + 1).padStart(2, "0")}  ${displayFileName(selectedSlide.name, isMobile)}`
                : text.noSlide}
            </div>
            <div className="zoomControls">
              <button type="button" className="icon" disabled={!selectedSlide} title={text.zoomOut} aria-label={text.zoomOut} onClick={zoomOut}>
                −
              </button>
              <span className="zoomValue">{Math.round(displayZoom * 100)}%</span>
              <button type="button" className="icon" disabled={!selectedSlide} title={text.zoomIn} aria-label={text.zoomIn} onClick={zoomIn}>
                +
              </button>
              <button type="button" className="fitButton" disabled={!selectedSlide} title={text.fit} onClick={() => setZoomMode("fit")}>
                {text.fit}
              </button>
            </div>
            <button type="button" className="resetButton" disabled={!selectedSlide || selectedSlide.status !== "ready"} onClick={resetSelected}>
              {text.resetSlide}
            </button>
          </div>
          <div className="stage" ref={stageRef}>
            <div className="canvasShell">
              {selectedSlide?.url && previewErrorSlideId !== selectedSlide.id ? (
                <div className="canvasWrap">
                  <canvas ref={canvasRef} aria-label={text.adjustCorners}>
                    {text.adjustCorners}
                  </canvas>
                  <span id="cornerKeyboardHelp" className="srOnly">
                    {text.cornerKeyboardHelp}
                  </span>
                  {selectedSlide.quad && handlePositions.length === selectedSlide.quad.length
                    ? selectedSlide.quad.map(([x, y], index) => {
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
                            aria-label={`${text.cornerHandle} ${index + 1}: X ${Math.round(x)}, Y ${Math.round(y)}`}
                            aria-describedby="cornerKeyboardHelp"
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
                  {dragHandle !== null && handlePositions[dragHandle] && (
                    <div
                      className="loupeOverlay"
                      style={{
                        left: `${handlePositions[dragHandle].left}px`,
                        top: `${handlePositions[dragHandle].top}px`,
                      }}
                    >
                      <canvas ref={loupeCanvasRef} className="loupeCanvas" />
                      <div className="loupeCrosshair" />
                    </div>
                  )}
                </div>

              ) : (
                <div className="empty">
                  {selectedSlide && previewErrorSlideId === selectedSlide.id
                    ? text.previewError
                    : selectedSlide?.status === "converting"
                    ? text.converting
                    : selectedSlide?.error ?? text.empty}
                </div>
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

      <p className="srOnly" aria-live="polite" aria-atomic="true">
        {cornerAnnouncement}
      </p>

      <footer className="prefsBar" aria-hidden={isInfoOpen || undefined} inert={isInfoOpen ? true : undefined}>
        <button
          ref={infoButtonRef}
          type="button"
          className="icon infoButton"
          title={text.infoTitle}
          aria-label={text.infoTitle}
          onClick={() => setIsInfoOpen(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </button>
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

      {isInfoOpen && (
        <div className="modalOverlay" onClick={() => setIsInfoOpen(false)}>
          <div
            ref={infoModalRef}
            className="modalCard"
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modalHeader">
              <div className="modalTitle">
                <h3 id="info-modal-title">{text.infoTitle}</h3>
                <span className="modalVersion">v{APP_VERSION}</span>
              </div>
              <button
                ref={closeInfoButtonRef}
                className="closeButton"
                type="button"
                onClick={() => setIsInfoOpen(false)}
                aria-label={text.close}
              >
                &times;
              </button>
            </div>
            <div className="modalBody">
              <p className="modalDesc">{text.infoDesc}</p>
              <p className="modalPrivacy">
                <strong>{text.infoPrivacy}</strong>
              </p>
              <div className="modalShortcuts">
                <h4>{text.shortcutsTitle}</h4>
                <div className="shortcutGrid">
                  <div className="shortcutItem">
                    <kbd>J</kbd> / <kbd>K</kbd> <span>{text.shortcutNav}</span>
                  </div>
                  <div className="shortcutItem">
                    <kbd>Delete</kbd> <span>{text.shortcutDelete}</span>
                  </div>
                  <div className="shortcutItem">
                    <kbd>⌘Z</kbd> / <kbd>Ctrl+Z</kbd> <span>{text.shortcutUndo}</span>
                  </div>
                  <div className="shortcutItem">
                    <kbd>⌘⇧Z</kbd> / <kbd>Ctrl+Shift+Z</kbd> <span>{text.shortcutRedo}</span>
                  </div>
                  <div className="shortcutItem">
                    <kbd>⌘↵</kbd> / <kbd>Ctrl+Enter</kbd> <span>{text.shortcutExport}</span>
                  </div>
                  <div className="shortcutItem">
                    <kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> <span>{text.shortcutNudge}</span>
                  </div>
                </div>
              </div>
              <div className="modalLinks">
                <a href="https://github.com/waittim/Slides-Thief" target="_blank" rel="noopener noreferrer" className="modalLink">
                  {text.infoRepo}
                </a>
                <a href="https://www.zekun.blog/2026/07/13/slides-thief/" target="_blank" rel="noopener noreferrer" className="modalLink">
                  {text.infoBlog}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
