import React from "react";

export interface StatusDotProps {
  status: "good" | "busy" | "bad" | "default";
  className?: string;
}

export function StatusDot({ status, className = "" }: StatusDotProps) {
  return <span className={`uiStatusDot uiStatusDot--${status} ${className}`.trim()} aria-hidden="true" />;
}

export interface CountBadgeProps {
  count: number | string;
  className?: string;
}

export function CountBadge({ count, className = "" }: CountBadgeProps) {
  return <span className={`uiCountBadge ${className}`.trim()}>{count}</span>;
}
