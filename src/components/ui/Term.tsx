"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cx } from "@/lib/cx";
import { GLOSSARY } from "@/lib/glossary";
import { surfaceClass } from "./Surface";

/**
 * An acronym or code with a hover/focus tooltip from the glossary (dotted underline).
 * The tooltip is portalled with fixed positioning, so scroll containers (inspector,
 * narration) don't clip it. Tap toggles it on touch screens. Use `focusable={false}`
 * inside buttons (a focusable element can't nest in another).
 * Usually you don't use this directly: pass text through `gloss()` / `<Glossed>`.
 */
export function Term({ term, children, focusable = true }: { term: string; children?: string; focusable?: boolean }) {
  const entry = GLOSSARY[term];
  const ref = useRef<HTMLElement>(null);
  const id = useId();
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  if (!entry) return <>{children ?? term}</>;

  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.top < 140; // no room above: open downwards
    setPos({ x: Math.min(Math.max(r.left + r.width / 2, 170), window.innerWidth - 170), y: below ? r.bottom + 8 : r.top - 8, below });
  };
  const hide = () => setPos(null);

  return (
    <>
      <abbr
        ref={ref}
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
        className="cursor-help underline decoration-fg-muted/70 decoration-dotted underline-offset-[3px]"
      >
        {children ?? term}
      </abbr>
      {pos &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{ left: pos.x, top: pos.y }}
            className={surfaceClass({ level: "raised", elevated: true }, cx("pointer-events-none fixed z-50 w-[min(320px,calc(100vw-24px))] -translate-x-1/2 px-3 py-2 text-left font-sans text-note font-normal normal-case leading-snug tracking-normal text-fg-muted", !pos.below && "-translate-y-full"))}
          >
            <span className="font-mono font-semibold text-fg">{term}</span>
            {entry.expansion && <span className="text-fg"> · {entry.expansion}</span>}
            <span className="mt-1 block">{entry.brief}</span>
          </span>,
          document.body,
        )}
    </>
  );
}
