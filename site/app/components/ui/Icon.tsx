import React from "react";

export type IconName =
  | "chevron.backward"
  | "chevron.forward"
  | "chevron.up"
  | "chevron.down"
  | "plus"
  | "minus"
  | "xmark"
  | "checkmark"
  | "exclamationmark"
  | "exclamationmark.circle"
  | "exclamationmark.triangle"
  | "arrow.uturn.backward"
  | "arrow.uturn.forward"
  | "magnifyingglass"
  | "sparkles"
  | "doc.text"
  | "photo"
  | "trash"
  | "arrow.right"
  | "lock.shield"
  | "info.circle"
  | "questionmark.circle"
  | "slider.horizontal.3"
  | "play.fill"
  | "ellipsis";

export interface IconProps extends React.SVGAttributes<SVGElement> {
  name: IconName;
  size?: number | string;
  strokeWidth?: number;
  className?: string;
}

export function Icon({
  name,
  size = 16,
  strokeWidth = 2,
  className = "",
  ...props
}: IconProps) {
  const combinedClass = `sfIcon sfIcon--${name.replace(/\./g, "-")} ${className}`.trim();

  let content: React.ReactNode = null;

  switch (name) {
    case "chevron.backward":
      content = <path d="M15 18l-6-6 6-6" />;
      break;
    case "chevron.forward":
      content = <path d="M9 18l6-6-6-6" />;
      break;
    case "chevron.up":
      content = <path d="M18 15l-6-6-6 6" />;
      break;
    case "chevron.down":
      content = <path d="M6 9l6 6 6-6" />;
      break;
    case "plus":
      content = (
        <>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </>
      );
      break;
    case "minus":
      content = <line x1="5" y1="12" x2="19" y2="12" />;
      break;
    case "xmark":
      content = (
        <>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </>
      );
      break;
    case "checkmark":
      content = <polyline points="20 6 9 17 4 12" />;
      break;
    case "exclamationmark":
      content = (
        <>
          <line x1="12" y1="8" x2="12" y2="13" />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "exclamationmark.circle":
      content = (
        <>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="12.5" />
          <circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "exclamationmark.triangle":
      content = (
        <>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13.5" />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "arrow.uturn.backward":
      content = (
        <>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
        </>
      );
      break;
    case "arrow.uturn.forward":
      content = (
        <>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5v0A5.5 5.5 0 0 0 9.5 20H13" />
        </>
      );
      break;
    case "magnifyingglass":
      content = (
        <>
          <circle cx="11" cy="11" r="7.5" />
          <line x1="21" y1="21" x2="16.5" y2="16.5" />
        </>
      );
      break;
    case "sparkles":
      content = (
        <>
          <path d="m12 3 1.91 4.89L18.8 9.8l-4.89 1.91L12 16.6l-1.91-4.89L5.2 9.8l4.89-1.91L12 3z" />
          <path d="m19 16 .96 2.45L22.4 19.4l-2.44.95L19 22.8l-.95-2.45L15.6 19.4l2.45-.95L19 16z" />
          <path d="m5 16 .6 1.55L7.15 18.15l-1.55.6L5 20.3l-.6-1.55-1.55-.6 1.55-.6L5 16z" />
        </>
      );
      break;
    case "doc.text":
      content = (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </>
      );
      break;
    case "photo":
      content = (
        <>
          <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </>
      );
      break;
    case "trash":
      content = (
        <>
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </>
      );
      break;
    case "arrow.right":
      content = (
        <>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </>
      );
      break;
    case "lock.shield":
      content = (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </>
      );
      break;
    case "info.circle":
      content = (
        <>
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="16" x2="12" y2="11.5" />
          <circle cx="12" cy="8" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "questionmark.circle":
      content = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
        </>
      );
      break;
    case "slider.horizontal.3":
      content = (
        <>
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </>
      );
      break;
    case "play.fill":
      content = <polygon points="6 4 20 12 6 20" fill="currentColor" stroke="none" />;
      break;
    case "ellipsis":
      content = (
        <>
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none" />
        </>
      );
      break;
    default:
      return null;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={combinedClass}
      aria-hidden="true"
      {...props}
    >
      {content}
    </svg>
  );
}
