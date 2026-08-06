import React, { forwardRef } from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "green" | "icon" | "fit" | "reset" | "close" | "clear";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", className = "", children, ...props },
  ref
) {
  const variantClass =
    variant === "default"
      ? ""
      : variant === "close"
        ? "closeButton"
        : variant === "fit"
          ? "fitButton"
          : variant === "reset"
            ? "resetButton"
            : variant === "clear"
              ? "clearAllBtn"
              : variant;

  const combinedClassName = [variantClass, className].filter(Boolean).join(" ");

  return (
    <button ref={ref} className={combinedClassName || undefined} {...props}>
      {children}
    </button>
  );
});
