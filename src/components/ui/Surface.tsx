import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { toneSurface, type Tone } from "./tone";

export interface SurfaceOptions {
  /** `panel` for cards and panels, `raised` (panel-2) for controls, stats and things on a panel. */
  level?: "panel" | "raised";
  /** Radius by role: sm chips · md controls/stats · lg panels, popovers, figures · xl big cards. */
  radius?: "sm" | "md" | "lg" | "xl";
  /** Floats above the page (menus, tooltips, toolbars): adds shadow-popover. */
  elevated?: boolean;
  /** Navigable card: border brightens to accent on hover. */
  interactive?: boolean;
  /** A tinted aside (TryIt = accent, warning Callout = warn) instead of a plain surface. */
  tone?: Tone;
}

/** Class list for a design-system surface. Use for elements Surface can't render (a Next <Link>). */
export function surfaceClass({ level = "panel", radius = "lg", elevated, interactive, tone }: SurfaceOptions = {}, className?: string) {
  return cx(
    "border",
    tone && tone !== "muted" ? toneSurface[tone] : cx("border-line", level === "raised" ? "bg-panel-2" : "bg-panel"),
    { sm: "rounded", md: "rounded-md", lg: "rounded-lg", xl: "rounded-xl" }[radius],
    elevated && "shadow-popover",
    interactive && "transition-colors hover:border-accent/60",
    className,
  );
}

/**
 * A bordered box from the design system: cards, panels, figures, popovers, tinted asides.
 * Padding and layout stay with the caller (className); colour, border, radius and
 * elevation come from props so every box on the site matches.
 */
export function Surface({
  as: As = "div",
  className,
  children,
  ...opts
}: SurfaceOptions & {
  as?: "div" | "section" | "article" | "aside" | "header" | "span";
  className?: string;
  children?: ReactNode;
}) {
  return <As className={surfaceClass(opts, className)}>{children}</As>;
}
