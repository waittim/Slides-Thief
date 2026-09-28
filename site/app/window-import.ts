import type { SlideItem } from "./lib/types.ts";
import { supportedExtensions, supportedMimeTypes } from "./lib/types.ts";

export function isSupportedImage(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    supportedExtensions.some((ext) => lower.endsWith(ext)) ||
    supportedMimeTypes.has(file.type.toLowerCase())
  );
}

type Ref<T> = { current: T };

export function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as { tagName?: string; isContentEditable?: boolean } | null;
  if (!element) return false;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.tagName === "SELECT" ||
    element.isContentEditable === true
  );
}

export function hasDragFiles(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false;
  const types = dataTransfer.types;
  if (!types) return false;
  if (typeof types.includes === "function") {
    return types.includes("Files");
  }
  for (let i = 0; i < types.length; i++) {
    if (types[i] === "Files") return true;
  }
  return false;
}

export function createPastedImageFile(
  file: File,
  existingNames: Set<string>,
  sequenceIndex: number = 0,
  now: Date = new Date(),
): File {
  const mimeExt = file.type?.split("/")[1]?.replace("jpeg", "jpg") || "";
  const ext = mimeExt || "png";
  const isGeneric =
    !file.name ||
    file.name === "image.png" ||
    file.name === "image.jpeg" ||
    file.name === "image.jpg" ||
    file.name === "image.webp" ||
    file.name === "blob";

  if (!isGeneric && !existingNames.has(file.name)) {
    return file;
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const suffix = sequenceIndex > 0 ? `-${sequenceIndex + 1}` : "";
  let candidateName = `pasted-${timeStr}${suffix}.${ext}`;
  let counter = 1;
  while (existingNames.has(candidateName)) {
    candidateName = `pasted-${timeStr}${suffix}-${counter}.${ext}`;
    counter++;
  }

  try {
    return new File([file], candidateName, {
      type: file.type || `image/${ext}`,
      lastModified: now.getTime(),
    });
  } catch {
    return file;
  }
}

export function extractClipboardImageFiles(
  clipboardData: DataTransfer | null,
  existingNames: Set<string>,
): File[] {
  if (!clipboardData) return [];
  const files: File[] = [];

  if (clipboardData.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === "file" || item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file && isSupportedImage(file)) {
          files.push(file);
        }
      }
    }
  } else if (clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const file = clipboardData.files[i];
      if (isSupportedImage(file)) {
        files.push(file);
      }
    }
  }

  if (!files.length) return [];

  const renamedFiles: File[] = [];
  const currentNames = new Set(existingNames);
  for (let i = 0; i < files.length; i++) {
    const renamed = createPastedImageFile(files[i], currentNames, i);
    currentNames.add(renamed.name);
    renamedFiles.push(renamed);
  }
  return renamedFiles;
}

export type WindowImportActions = {
  busy: boolean;
  isInfoOpen: boolean;
  slidesRef: Ref<SlideItem[]>;
  loadFiles: (files: FileList | File[]) => Promise<void> | void;
  setDragActive: (active: boolean) => void;
};

export function createWindowDragDropHandlers(
  actionsRef: Ref<WindowImportActions>,
  dragDepthRef: Ref<number>,
) {
  const onDragEnter = (event: DragEvent) => {
    if (!hasDragFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    if (dragDepthRef.current === 1) {
      if (!actionsRef.current.busy && !actionsRef.current.isInfoOpen) {
        actionsRef.current.setDragActive(true);
      }
    }
  };

  const onDragOver = (event: DragEvent) => {
    if (!hasDragFiles(event.dataTransfer)) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect =
        actionsRef.current.busy || actionsRef.current.isInfoOpen ? "none" : "copy";
    }
  };

  const onDragLeave = (event: DragEvent) => {
    if (!hasDragFiles(event.dataTransfer)) return;
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      actionsRef.current.setDragActive(false);
    }
  };

  const onDrop = (event: DragEvent) => {
    if (!hasDragFiles(event.dataTransfer)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    actionsRef.current.setDragActive(false);

    if (actionsRef.current.busy || actionsRef.current.isInfoOpen) return;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      void actionsRef.current.loadFiles(files);
    }
  };

  const onReset = () => {
    dragDepthRef.current = 0;
    actionsRef.current.setDragActive(false);
  };

  return { onDragEnter, onDragOver, onDragLeave, onDrop, onReset };
}

export function createWindowPasteHandler(actionsRef: Ref<WindowImportActions>) {
  return (event: ClipboardEvent) => {
    if (actionsRef.current.isInfoOpen || actionsRef.current.busy) return;
    if (isEditableTarget(event.target)) return;

    const existingNames = new Set(actionsRef.current.slidesRef.current.map((s) => s.name));
    const imageFiles = extractClipboardImageFiles(event.clipboardData, existingNames);
    if (imageFiles.length > 0) {
      event.preventDefault();
      void actionsRef.current.loadFiles(imageFiles);
    }
  };
}
