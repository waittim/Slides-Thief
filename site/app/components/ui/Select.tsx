import React, { forwardRef } from "react";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = "", children, ...props },
  ref
) {
  return (
    <select ref={ref} className={className || undefined} {...props}>
      {children}
    </select>
  );
});
