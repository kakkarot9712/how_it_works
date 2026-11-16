"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { gloss } from "./gloss";

/** On/off switch with a label and optional help line. `danger` for "break it" controls. */
export function Toggle({
  label,
  checked,
  onChange,
  help,
  tone = "default",
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <span
        className={cx(
          "relative mt-0.5 inline-flex h-[18px] w-8 shrink-0 rounded-full border transition-colors",
          checked ? (tone === "danger" ? "border-err/60 bg-err/40" : "border-accent/60 bg-accent/40") : "border-line bg-panel-2",
        )}
      >
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span
          className={cx(
            "absolute top-[1px] h-3.5 w-3.5 rounded-full bg-fg transition-all",
            checked ? "left-[15px]" : "left-[1px] opacity-60",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{gloss(label, { focusable: false })}</span>
        {help && <span className="mt-0.5 block text-note leading-snug text-fg-muted">{gloss(help)}</span>}
      </span>
    </label>
  );
}
