import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { toneBadge, type Tone } from "./tone";
import { Tooltip } from "./Tooltip";

/** Rounded status badge ("subscribed", "down", "live"). */
export function Pill({
  children,
  tone = "muted",
  size = "md",
  tip,
  tipHeading,
}: {
  children: ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
  /** Explanation in the shared `Tooltip` (a hint chip: "slow motion ⓘ"). End the label with ⓘ. */
  tip?: ReactNode;
  tipHeading?: ReactNode;
}) {
  const cls = cx(
    "inline-flex items-center whitespace-nowrap rounded-full border font-medium",
    size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-0.5 text-xs",
    toneBadge[tone],
  );
  return tip ? (
    <Tooltip tip={tip} heading={tipHeading} className={cls}>
      {children}
    </Tooltip>
  ) : (
    <span className={cls}>{children}</span>
  );
}

/** Square-cornered tag for labels and concepts ("− Output buffer limits", "push delivery"). */
export function Tag({
  children,
  tone,
  mono,
  tip,
  tipFocusable = true,
}: {
  children: ReactNode;
  tone?: Tone;
  mono?: boolean;
  /** Explanation in the shared `Tooltip`. */
  tip?: ReactNode;
  /** false inside a clickable row or button. */
  tipFocusable?: boolean;
}) {
  const cls = cx(
    "inline-flex items-center rounded px-1.5 py-px",
    mono ? "font-mono text-2xs" : "text-2xs",
    tone ? cx("border", toneBadge[tone], "bg-transparent") : "bg-panel-2 text-fg-muted",
  );
  return tip ? (
    <Tooltip tip={tip} focusable={tipFocusable} className={cls}>
      {children}
    </Tooltip>
  ) : (
    <span className={cls}>{children}</span>
  );
}
