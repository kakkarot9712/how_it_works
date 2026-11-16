"use client";

import type { KeyboardEvent } from "react";
import { cx } from "@/lib/cx";

/**
 * Pick one of a few options shown side by side (speed: 0.25× … 4×). A radio group for
 * assistive tech; ← / → move the choice when focused.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  format = String,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  format?: (v: T) => string;
  /** Accessible name of the group. */
  label: string;
}) {
  const onKey = (e: KeyboardEvent) => {
    const i = options.indexOf(value);
    const next = e.key === "ArrowRight" ? options[i + 1] : e.key === "ArrowLeft" ? options[i - 1] : undefined;
    if (next === undefined) return;
    e.preventDefault();
    e.stopPropagation(); // the player also uses ←/→
    onChange(next);
  };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className="flex items-center gap-0.5 rounded-md border border-line bg-panel-2 p-0.5">
      {options.map((o) => (
        <button
          key={String(o)}
          type="button"
          role="radio"
          aria-checked={o === value}
          tabIndex={o === value ? 0 : -1}
          onClick={() => onChange(o)}
          className={cx(
            "rounded px-2 py-1 font-mono text-xs transition-colors",
            o === value ? "bg-accent/20 text-accent" : "text-fg-muted hover:text-fg",
          )}
        >
          {format(o)}
        </button>
      ))}
    </div>
  );
}
