import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "icon" | "danger";
export type ButtonSize = "sm" | "md" | "touch";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", children, type = "button", ...props },
  ref
) {
  const combinedClassName = ["uiButton", `uiButton--${variant}`, `uiButton--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return <button ref={ref} className={combinedClassName} type={type} {...props}>{children}</button>;
});
