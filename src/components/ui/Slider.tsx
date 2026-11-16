"use client";

import type { ReactNode } from "react";
import { gloss } from "./gloss";

/** Labelled range input showing its current value and unit. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  help,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  help?: ReactNode;
}) {
  return (
    <label className="block py-1.5">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-fg">{gloss(label, { focusable: false })}</span>
        <span className="font-mono text-fg-muted">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--color-accent)]"
      />
      {help && <span className="block text-note leading-snug text-fg-muted">{gloss(help)}</span>}
    </label>
  );
}
