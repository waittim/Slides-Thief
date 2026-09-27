import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { copy, formatAppError, type LocaleValue } from "../i18n";
import { normalizePdfName } from "../filename";
import {
  isHeifImage,
  isSupported,
  makeId,
  normalizeImageFile,
} from "../lib/slide-utils";
import {
  isAppError,
  toAppErrorPayload,
  trackEvent,
  type SlideItem,
  type WorkerErrorInput,
} from "../lib/types";

type ImportPipelineOptions = {
  pdfBaseName: string;
  localeRef: MutableRefObject<LocaleValue>;
  slidesRef: MutableRefObject<SlideItem[]>;
  setSlides: Dispatch<SetStateAction<SlideItem[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setExportName: (name: string) => void;
  setBusyText: (text: string) => void;
  setWorkerError: (error: WorkerErrorInput) => void;
  setPreviewErrorSlideId: (id: string | null) => void;
  setZoomMode: (mode: "fit" | "manual") => void;
  clearExport: () => void;
  markExportStale: () => void;
  exportUrlRef: MutableRefObject<string | null>;
  cancelExport: () => void;
  cancelDetection: () => void;
  workerRef: MutableRefObject<Worker | null>;
  exportWorkerRef: MutableRefObject<Worker | null>;
  cancelActiveDrag: () => void;
  resetViewport: () => void;
  pushHistory: () => void;
};

function revokeSlideObjectUrls(slides: SlideItem[]) {
  slides.forEach((slide) => URL.revokeObjectURL(slide.url));
}

export function useImportPipeline({
  pdfBaseName,
  localeRef,
  slidesRef,
  setSlides,
  setSelectedId,
  setExportName,
  setBusyText,
  setWorkerError,
  setPreviewErrorSlideId,
  setZoomMode,
  clearExport,
  markExportStale,
  exportUrlRef,
  cancelExport,
  cancelDetection,
  workerRef,
  exportWorkerRef,
  cancelActiveDrag,
  resetViewport,
  pushHistory,
}: ImportPipelineOptions) {
  const loadTokenRef = useRef(0);

  const loadFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      const inputFiles = Array.from(fileList)
        .filter(isSupported)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      if (!inputFiles.length) return;

      const existingSlides = slidesRef.current;
      const isAppending = existingSlides.length > 0;
      const existingNames = new Set(existingSlides.map((slide) => slide.name));

      const uniqueFiles: File[] = [];
      const duplicateNames: string[] = [];

      for (const file of inputFiles) {
        if (existingNames.has(file.name)) {
          duplicateNames.push(file.name);
        } else {
          existingNames.add(file.name);
          uniqueFiles.push(file);
        }
      }

      if (!uniqueFiles.length) {
        if (duplicateNames.length) {
          setWorkerError(copy[localeRef.current].duplicateFilesSkipped(duplicateNames.length));
        }
        return;
      }

      const hasHeif = uniqueFiles.some(isHeifImage);

      trackEvent("image_import", {
        count: uniqueFiles.length,
        has_heif: hasHeif,
      });

      if (isAppending) {
        pushHistory();
      } else {
        revokeSlideObjectUrls(slidesRef.current);
      }

      cancelDetection();
      workerRef.current?.terminate();
      workerRef.current = null;
      cancelExport();
      exportWorkerRef.current?.terminate();
      exportWorkerRef.current = null;
      cancelActiveDrag();
      if (isAppending) {
        markExportStale();
      } else {
        clearExport();
      }
      resetViewport();
      setPreviewErrorSlideId(null);

      const baseIndex = isAppending ? existingSlides.length : 0;
      const nextSlides: SlideItem[] = uniqueFiles.map((file, index) => {
        const converting = isHeifImage(file);
        return {
          id: makeId(file, baseIndex + index),
          file,
          name: file.name,
          url: converting ? "" : URL.createObjectURL(file),
          width: 0,
          height: 0,
          quad: null,
          autoDetection: null,
          method: null,
          confidence: 0,
          needsReview: false,
          reviewReasons: [],
          sourceRatio: 16 / 9,
          status: converting ? "converting" : "queued",
        };
      });

      if (isAppending) {
        setSlides((current) => [...current, ...nextSlides]);
      } else {
        setSlides(nextSlides);
        setExportName(normalizePdfName(pdfBaseName));
      }

      setSelectedId(nextSlides[0]?.id ?? null);
      setZoomMode("fit");
      setWorkerError(
        duplicateNames.length
          ? copy[localeRef.current].duplicateFilesSkipped(duplicateNames.length)
          : "",
      );
      setBusyText(hasHeif ? copy[localeRef.current].converting : "");

      let firstConversionError: WorkerErrorInput = "";
      for (let index = 0; index < uniqueFiles.length; index += 1) {
        if (loadTokenRef.current !== token) return;
        const file = uniqueFiles[index];
        if (!isHeifImage(file)) continue;

        setBusyText(`${copy[localeRef.current].converting} ${index + 1}/${uniqueFiles.length}`);
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
                    quad: null,
                    autoDetection: null,
                    method: null,
                    confidence: 0,
                    needsReview: false,
                    reviewReasons: [],
                    status: "queued",
                    error: undefined,
                  }
                : slide,
            ),
          );
        } catch (error) {
          if (loadTokenRef.current !== token) return;
          const isApp = isAppError(error);
          const payload = toAppErrorPayload(error, "heif-conversion-failed");
          const message = formatAppError(payload, localeRef.current);
          if (!firstConversionError) firstConversionError = payload;
          setSlides((current) =>
            current.map((slide) =>
              slide.id === id
                ? {
                    ...slide,
                    status: "error",
                    quad: null,
                    autoDetection: null,
                    method: null,
                    confidence: 0,
                    needsReview: false,
                    reviewReasons: [],
                    error: {
                      code: "conversion-failed",
                      message,
                      errorCode: isApp ? error.code : payload.code,
                      errorParams: isApp ? error.params : payload.params,
                    },
                  }
                : slide,
            ),
          );
        }
      }

      setBusyText("");
      if (firstConversionError) {
        setWorkerError(firstConversionError);
      }
    },
    [
      cancelActiveDrag,
      cancelDetection,
      cancelExport,
      clearExport,
      markExportStale,
      exportWorkerRef,
      pdfBaseName,
      pushHistory,
      resetViewport,
      setBusyText,
      setExportName,
      setSelectedId,
      setSlides,
      setWorkerError,
      setPreviewErrorSlideId,
      setZoomMode,
      slidesRef,
      workerRef,
      localeRef,
    ],
  );

  useEffect(() => {
    const getCurrentSlides = () => slidesRef.current;
    return () => {
      revokeSlideObjectUrls(getCurrentSlides());
      if (exportUrlRef.current) {
        URL.revokeObjectURL(exportUrlRef.current);
        exportUrlRef.current = null;
      }
      if (exportWorkerRef.current) {
        exportWorkerRef.current.terminate();
        exportWorkerRef.current = null;
      }
    };
  }, [exportWorkerRef, exportUrlRef, slidesRef]);

  return { loadFiles };
}
