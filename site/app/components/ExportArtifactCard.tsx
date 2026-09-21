import React from "react";
import type { LocaleCopy } from "../i18n";
import { formatBytes } from "../lib/slide-utils";

export interface ExportArtifactCardProps {
  format: "pdf" | "jpg";
  url: string;
  filename: string;
  byteLength?: number;
  isStale?: boolean;
  isIOS?: boolean;
  multiSlideJpg?: boolean;
  text: LocaleCopy;
}

export function ExportArtifactCard({
  format,
  url,
  filename,
  byteLength,
  isStale = false,
  isIOS = false,
  multiSlideJpg = false,
  text,
}: ExportArtifactCardProps) {
  const isPdf = format === "pdf";
  const title = isPdf
    ? isIOS
      ? text.openPdf
      : text.downloadPdf
    : isIOS && !multiSlideJpg
      ? text.openJpg
      : multiSlideJpg
        ? text.downloadJpgZip
        : text.downloadJpg;

  const showIosHelp = Boolean(isIOS && (isPdf || !multiSlideJpg));
  const titleAttr = isStale ? text.staleExportHint : `${title}: ${filename}`;

  return (
    <a
      href={url}
      download={isIOS ? undefined : filename}
      target="_blank"
      rel="noopener noreferrer"
      className={`artifactCard ${isStale ? "artifactCard--stale sidebarLink--stale" : ""}`}
      title={titleAttr}
    >
      <div className="artifactCardIcon" aria-hidden="true">
        {showIosHelp ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
      </div>
      <div className="artifactCardInfo">
        <div className="artifactCardPrimary">
          <span className="artifactCardTitle">{title}</span>
          {isStale ? (
            <span className="sidebarStaleBadge" aria-hidden="true">
              {text.staleBadge}
            </span>
          ) : null}
        </div>
        <div className="artifactCardMeta">
          <span className="artifactCardName" title={filename}>
            {filename}
          </span>
          {byteLength ? (
            <span className="artifactCardSize">{formatBytes(byteLength)}</span>
          ) : null}
        </div>
        {showIosHelp ? (
          <div className="artifactCardHelp">
            <span>{text.iosShareHelp}</span>
          </div>
        ) : null}
      </div>
    </a>
  );
}
