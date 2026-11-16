"use client";

import { useEffect, useRef, useState } from "react";
import { Eyebrow, gloss, IconButton, PanelHeader, surfaceClass } from "@/components/ui";
import type { AnySimDefinition } from "@/sims/types";

type Scenario = AnySimDefinition["scenarios"][number];

/**
 * The ⓘ next to the scenario picker: the scenario's summary and what to look for, in a
 * popover. Kept off the page so the canvas gets the height; the Watch strip carries the
 * step-by-step guidance while it plays.
 */
export function ScenarioInfo({ scenario }: { scenario: Scenario }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);
  // A new scenario closes it.
  const [seen, setSeen] = useState(scenario.id);
  if (seen !== scenario.id) {
    setSeen(scenario.id);
    setOpen(false);
  }

  return (
    <div className="relative shrink-0">
      <IconButton label="About this scenario" onClick={() => setOpen((o) => !o)}>
        ⓘ
      </IconButton>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            ref={panel}
            tabIndex={-1}
            role="dialog"
            aria-label="About this scenario"
            onKeyDown={(e) => {
              e.stopPropagation(); // Space etc. must not reach the player's shortcuts
              if (e.key === "Escape") setOpen(false);
            }}
            className={surfaceClass(
              { elevated: true },
              // design-ok: the dialog takes focus only to catch Escape; the popover itself shows it's open
              "absolute left-0 top-full z-40 mt-1.5 w-[min(520px,calc(100vw-2rem))] overflow-hidden outline-none",
            )}
          >
            <PanelHeader compact actions={<IconButton label="Close" size="sm" onClick={() => setOpen(false)}>✕</IconButton>}>
              <Eyebrow as="span">About this scenario</Eyebrow>
            </PanelHeader>
            <div className="px-4 pb-4 pt-3">
              <p className="text-sm leading-relaxed text-fg">{gloss(scenario.summary)}</p>
              <Eyebrow className="mt-4">What to look for</Eyebrow>
              <ul className="mt-1.5 space-y-1 text-note leading-snug text-fg-muted">
                {scenario.watchFor.map((w) => (
                  <li key={w} className="flex gap-1.5 before:text-accent before:content-['▸']">
                    <span>{gloss(w)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
