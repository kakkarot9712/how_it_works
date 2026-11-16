"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { surfaceClass } from "./Surface";

/**
 * The site's one explanatory tooltip: hover, keyboard focus, or tap on touch screens.
 * Used by glossary terms (`Term`) and by hint chips (`Pill`/`Tag` with `tip`). Portalled
 * with fixed positioning, so scroll containers don't clip it; opens below when there is
 * no room above. Native `title` is only for naming controls (a button's shortcut), never
 * for explanations.
 *
 * `heading` is the bold first line (a term, a version); `children` of `tip` is the body.
 * Use `focusable={false}` inside a button or link (a focusable element can't nest in another).
 */
export function Tooltip({
  tip,
  heading,
  children,
  as: As = "span",
  focusable = true,
  className,
}: {
  /** The explanation. Plain text or rich content. */
  tip: ReactNode;
  /** Optional first line, e.g. "PEL · Pending Entries List" or "Redis 8.10". */
  heading?: ReactNode;
  /** The trigger. */
  children: ReactNode;
  as?: "span" | "abbr";
  focusable?: boolean;
  /** Classes for the trigger (cursor-help is always added). */
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const id = useId();
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.top < 140; // no room above: open downwards
    setPos({ x: Math.min(Math.max(r.left + r.width / 2, 170), window.innerWidth - 170), y: below ? r.bottom + 8 : r.top - 8, below });
  };
  const hide = () => setPos(null);

  return (
    <>
      <As
        ref={ref as never}
        tabIndex={focusable ? 0 : undefined}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          // Touch: tap to toggle, without triggering a surrounding button or link.
          if (!focusable) return;
          e.preventDefault();
          e.stopPropagation();
          if (pos) hide();
          else show();
        }}
        className={cx("cursor-help", className)}
      >
        {children}
      </As>
      {pos &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{ left: pos.x, top: pos.y }}
            className={surfaceClass(
              { level: "raised", elevated: true },
              cx(
                "pointer-events-none fixed z-50 w-[min(320px,calc(100vw-24px))] -translate-x-1/2 px-3 py-2 text-left font-sans text-note font-normal normal-case leading-snug tracking-normal text-fg-muted",
                !pos.below && "-translate-y-full",
              ),
            )}
          >
            {heading && <span className="block text-fg">{heading}</span>}
            <span className={cx("block", heading ? "mt-1" : undefined)}>{tip}</span>
          </span>,
          document.body,
        )}
    </>
  );
}
