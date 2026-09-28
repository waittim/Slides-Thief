import React, { useId } from "react";

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  className = "",
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  ...props
}: SwitchProps) {
  const autoId = useId();
  const switchId = id ?? autoId;
  const statusId = `${switchId}-status`;
  const effectiveDescribedBy = [statusId, ariaDescribedBy].filter(Boolean).join(" ") || undefined;

  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaLabel || ariaLabelledBy ? effectiveDescribedBy : ariaDescribedBy}
      disabled={disabled}
      className={`switchToggle ${checked ? "checked" : ""} ${className}`.trim()}
      onClick={() => onChange(!checked)}
      {...props}
    >
      <span className="switchTrack">
        <span className="switchThumb" />
      </span>
      <span id={statusId} className="switchLabel">
        {label}
      </span>
    </button>
  );
}
