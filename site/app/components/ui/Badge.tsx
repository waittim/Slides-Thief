import React from "react";

export interface StatusDotProps {
  status: "good" | "busy" | "bad" | "default";
  className?: string;
}

export function StatusDot({ status, className = "" }: StatusDotProps) {
  const statusClass = status === "default" ? "" : status;
  return <div className={`statusDot ${statusClass} ${className}`.trim()} />;
}

export interface CountBadgeProps {
  count: number | string;
  className?: string;
}

export function CountBadge({ count, className = "" }: CountBadgeProps) {
  return <span className={`count ${className}`.trim()}>{count}</span>;
}
