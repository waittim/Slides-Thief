import React, { forwardRef } from "react";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = "", children, ...props },
  ref
) {
  const combinedClassName = ["uiSelect", className].filter(Boolean).join(" ");

  return (
    <select ref={ref} className={combinedClassName} {...props}>
      {children}
    </select>
  );
});
