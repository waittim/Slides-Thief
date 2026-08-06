import React from "react";

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, disabled = false, className = "" }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`switchToggle ${checked ? "checked" : ""} ${className}`.trim()}
      onClick={() => onChange(!checked)}
    >
      <span className="switchTrack">
        <span className="switchThumb" />
      </span>
      <span className="switchLabel">{label}</span>
    </button>
  );
}
