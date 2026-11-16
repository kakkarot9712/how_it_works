import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Eyebrow } from "./Eyebrow";
import { Surface } from "./Surface";
import { toneText, type Tone } from "./tone";
import { gloss } from "./gloss";

/** A small labelled number. Give it a tone only when the value is a problem (warn/err) or good news (ok). */
export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <Surface level="raised" radius="md" className="px-2 py-1.5">
      <Eyebrow as="div" size="sm">
        {label}
      </Eyebrow>
      <div className={cx("font-mono text-base", tone ? toneText[tone] : "text-fg")}>{gloss(value)}</div>
    </Surface>
  );
}

/** Grid of Stats. */
export function StatGrid({ cols = 2, children }: { cols?: 2 | 3; children: ReactNode }) {
  return <div className={cx("grid gap-1.5", cols === 3 ? "grid-cols-3" : "grid-cols-2")}>{children}</div>;
}
