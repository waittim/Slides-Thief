import { useCallback, useRef } from "react";
import { copy, type LocaleValue } from "../i18n";
import { messageFromError } from "../lib/slide-utils";
import { trackEvent, type ExportWorkerMessage, type SlideItem } from "../lib/types";

export function useExportWorker(
  slidesRef: React.MutableRefObject<SlideItem[]>,
  exportUrlRef: React.MutableRefObject<string | null>,
  setExportUrl: React.Dispatch<React.SetStateAction<string | null>>,
  setExportName: (name: string) => void,
  setExporting: (exporting: boolean) => void,
  setWorkerError: (error: string) => void,
  setBusyText: (text: string) => void,
  localeRef: React.MutableRefObject<LocaleValue>,
) {
  const exportWorkerRef = useRef<Worker | null>(null);

  const ensureExportWorker = useCallback(() => {
    if (exportWorkerRef.current) return exportWorkerRef.current;
    let worker: Worker;
    try {
      worker = new Worker(new URL("../slides-export-worker.ts", import.meta.url), {
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
    worker.onmessage = (event: MessageEvent<ExportWorkerMessage>) => {
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
  }, [exportUrlRef, localeRef, setBusyText, setExportName, setExportUrl, setExporting, setWorkerError, slidesRef]);

  const cancelExport = useCallback(() => {
    if (exportWorkerRef.current) {
      exportWorkerRef.current.terminate();
      exportWorkerRef.current = null;
    }
    setExporting(false);
    setBusyText("");
  }, [setBusyText, setExporting]);

  return { exportWorkerRef, ensureExportWorker, cancelExport };
}
