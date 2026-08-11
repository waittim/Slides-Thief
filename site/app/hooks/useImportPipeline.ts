import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { copy, type LocaleValue } from "../i18n";
import { normalizePdfName } from "../filename";
import {
  isHeifImage,
  isSupported,
  makeId,
  messageFromError,
  normalizeImageFile,
} from "../lib/slide-utils";
import { trackEvent, type SlideItem } from "../lib/types";

type ImportPipelineOptions = {
  pdfBaseName: string;
  localeRef: MutableRefObject<LocaleValue>;
  slidesRef: MutableRefObject<SlideItem[]>;
  setSlides: Dispatch<SetStateAction<SlideItem[]>>;
  setSelectedId: Dispatch<SetStateAction<string | null>>;
  setExportName: (name: string) => void;
  setBusyText: (text: string) => void;
  setWorkerError: (error: string) => void;
  setPreviewErrorSlideId: (id: string | null) => void;
  setZoomMode: (mode: "fit" | "manual") => void;
  clearExport: () => void;
  exportUrlRef: MutableRefObject<string | null>;
  cancelExport: () => void;
  cancelDetection: () => void;
  workerRef: MutableRefObject<Worker | null>;
  exportWorkerRef: MutableRefObject<Worker | null>;
  cancelActiveDrag: () => void;
  resetViewport: () => void;
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
  exportUrlRef,
  cancelExport,
  cancelDetection,
  workerRef,
  exportWorkerRef,
  cancelActiveDrag,
  resetViewport,
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
      const hasHeif = inputFiles.some(isHeifImage);

      trackEvent("image_import", {
        count: inputFiles.length,
        has_heif: hasHeif,
      });

      cancelDetection();
      workerRef.current?.terminate();
      workerRef.current = null;
      cancelExport();
      exportWorkerRef.current?.terminate();
      exportWorkerRef.current = null;
      cancelActiveDrag();
      revokeSlideObjectUrls(slidesRef.current);
      clearExport();
      resetViewport();
      setPreviewErrorSlideId(null);

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
    [
      cancelActiveDrag,
      cancelDetection,
      cancelExport,
      clearExport,
      exportWorkerRef,
      pdfBaseName,
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
