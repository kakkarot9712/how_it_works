"use client";

import type { ReactNode } from "react";
import { gloss } from "./gloss";
import { SegmentedControl } from "./SegmentedControl";

/** A labelled one-of-few setting (isolation level, acks): label, the choices as a 2-column grid, and a help line. */
export function Choice({
  label,
  value,
  options,
  onChange,
  help,
}: {
  label: string;
  /** Index into `options`. */
  value: number;
  options: string[];
  onChange: (v: number) => void;
  help?: ReactNode;
}) {
  return (
    <div className="block py-1.5">
      <span className="mb-1 block text-sm font-medium text-fg">{gloss(label, { focusable: false })}</span>
      <SegmentedControl label={label} options={options.map((_, i) => i)} value={value} onChange={onChange} format={(i) => options[i]} columns={2} />
      {help && <span className="mt-1 block text-note leading-snug text-fg-muted">{gloss(help)}</span>}
    </div>
  );
}
