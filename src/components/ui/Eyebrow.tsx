import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { toneText, type Tone } from "./tone";

/**
 * Small uppercase label. `md` (12px, semibold) heads a block: "STATS", "SEE IT HAPPEN", "SETUP".
 * `sm` (11px) labels a value: a Stat's name, an inspector's node kind.
 */
export function Eyebrow({
  children,
  tone = "muted",
  size = "md",
  as: As = "p",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
  as?: "p" | "h2" | "h3" | "span" | "div" | "dt";
  className?: string;
}) {
  return <As className={cx("uppercase tracking-wider", size === "sm" ? "text-2xs font-medium" : "text-xs font-semibold", toneText[tone], className)}>{children}</As>;
}
