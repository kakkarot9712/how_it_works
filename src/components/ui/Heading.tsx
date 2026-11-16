import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

const LEVELS = {
  /** Page hero: home, write-up title. */
  display: "text-4xl font-semibold tracking-tight",
  /** Page title: topic pages. */
  title: "text-3xl font-semibold tracking-tight",
  /** A section of a page or write-up. */
  section: "text-2xl font-semibold tracking-tight",
  /** A card or group heading. */
  card: "text-lg font-semibold leading-snug",
  /** The name of the thing a panel shows (inspector node name). */
  panel: "text-base font-semibold",
  /** A small item heading inside a card or list. */
  item: "text-sm font-semibold",
} as const;

/**
 * Headings by role, not by tag: pick `level` for the look and `as` for the document
 * outline (h1 once per page). Text is always `fg`.
 */
export function Heading({
  level,
  as: As = "h2",
  id,
  className,
  children,
}: {
  level: keyof typeof LEVELS;
  as?: "h1" | "h2" | "h3" | "h4" | "p";
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <As id={id} className={cx(LEVELS[level], "text-fg", className)}>
      {children}
    </As>
  );
}
