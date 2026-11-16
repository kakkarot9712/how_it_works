import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { toneBadge, type Tone } from "./tone";

/** Rounded status badge ("subscribed", "down", "live"). */
export function Pill({
  children,
  tone = "muted",
  size = "md",
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
  /** Native tooltip, e.g. for a hint chip ("slow motion ⓘ"). Adds cursor-help. */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        title && "cursor-help whitespace-nowrap",
        "inline-flex items-center rounded-full border font-medium",
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-0.5 text-xs",
        toneBadge[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Square-cornered tag for labels and concepts ("− Output buffer limits", "push delivery"). */
export function Tag({ children, tone, mono, title }: { children: ReactNode; tone?: Tone; mono?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center rounded px-1.5 py-px",
        mono ? "font-mono text-2xs" : "text-2xs",
        tone ? cx("border", toneBadge[tone], "bg-transparent") : "bg-panel-2 text-fg-muted",
      )}
    >
      {children}
    </span>
  );
}
