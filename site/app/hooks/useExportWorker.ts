import { useCallback, useRef } from "react";
import { copy, type LocaleValue } from "../i18n";
import { messageFromError } from "../lib/slide-utils";
import { trackEvent, type ExportArtifact, type ExportWorkerMessage, type SlideItem } from "../lib/types";

export function useExportWorker(
  slidesRef: React.MutableRefObject<SlideItem[]>,
  exportArtifactsRef: React.MutableRefObject<{ pdf?: ExportArtifact; jpg?: ExportArtifact }>,
  setExportArtifacts: React.Dispatch<React.SetStateAction<{ pdf?: ExportArtifact; jpg?: ExportArtifact }>>,
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
        const actionText =
          message.format === "jpg"
            ? copy[localeRef.current].generatingJpg
            : copy[localeRef.current].generating;
        setBusyText(`${actionText} ${message.current}/${message.total}: ${message.name}`);
      }
      if (message.type === "export-complete") {
        const format = message.format ?? "pdf";
        const buffer = message.pdf ?? message.buffer;
        trackEvent(format === "jpg" ? "jpg_export_success" : "pdf_export_success", {
          page_count: slidesRef.current.length,
          file_size_bytes: buffer.byteLength,
        });
        const prevUrl = exportArtifactsRef.current[format]?.url;
        if (prevUrl) {
          URL.revokeObjectURL(prevUrl);
        }
        const blob = new Blob([buffer], {
          type: message.mimeType || (format === "jpg" ? "application/zip" : "application/pdf"),
        });
        const url = URL.createObjectURL(blob);
        const artifact: ExportArtifact = {
          format,
          url,
          filename: message.filename,
          byteLength: buffer.byteLength,
        };
        exportArtifactsRef.current = {
          ...exportArtifactsRef.current,
          [format]: artifact,
        };
        setExportArtifacts((current) => ({
          ...current,
          [format]: artifact,
        }));
        setExporting(false);
        setBusyText("");
        releaseWorker();
      }
      if (message.type === "error") {
        trackEvent("processing_error", {
          error_type: "export_worker_error",
          error_message: message.error || "Export error",
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
        error_message: message || "Export worker terminated unexpectedly",
      });
      setWorkerError(message);
      setExporting(false);
      setBusyText("");
      releaseWorker();
    };
    worker.onerror = (event) => handleWorkerFailure(event.message || "The export worker stopped unexpectedly.");
    worker.onmessageerror = () => handleWorkerFailure("The browser could not read a response from the export worker.");
    exportWorkerRef.current = worker;
    return worker;
  }, [exportArtifactsRef, localeRef, setBusyText, setExportArtifacts, setExporting, setWorkerError, slidesRef]);

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
