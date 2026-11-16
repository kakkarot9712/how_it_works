"use client";

import { Button, Eyebrow, gloss, IconButton } from "@/components/ui";
import { cx } from "@/lib/cx";
import { secs } from "@/lib/format";
import type { FlowStep } from "@/sims/types";

/** Index of the flow step active at `now` (the last one that has started). */
export function activeStep(flow: FlowStep[], now: number) {
  let i = 0;
  while (i + 1 < flow.length && flow[i + 1].at <= now) i++;
  return i;
}

/**
 * The scenario's "flow to watch", above the canvas: numbered steps (click to jump to
 * one), the current step's note, and the spotlight switch. The canvas spotlights the
 * current step's nodes while `spotlight` is on.
 */
export function FlowBar({
  flow,
  current,
  spotlight,
  onSpotlight,
  onJump,
  onHide,
}: {
  flow: FlowStep[];
  current: number;
  spotlight: boolean;
  onSpotlight: () => void;
  onJump: (step: FlowStep) => void;
  /** Hide the strip (the toolbar's Watch button brings it back). */
  onHide: () => void;
}) {
  const step = flow[current];
  return (
    <div className="flex min-h-11 items-center gap-3 border-b border-line bg-accent/5 px-5 py-1.5">
      <Eyebrow tone="accent" as="span">
        Watch
      </Eyebrow>
      <ol className="flex shrink-0 items-center gap-1" aria-label="Flow steps">
        {flow.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onJump(s)}
              title={`Step ${i + 1} at ${secs(s.at)}: ${s.note}`}
              aria-current={i === current ? "step" : undefined}
              className={cx(
                "grid size-6 place-items-center rounded-full border font-mono text-xs transition-colors",
                i === current
                  ? "border-accent bg-accent/20 text-accent"
                  : i < current
                    ? "border-line text-fg-muted hover:border-fg-muted hover:text-fg"
                    : "border-line/60 text-fg-muted/60 hover:border-fg-muted hover:text-fg",
              )}
            >
              {i + 1}
            </button>
          </li>
        ))}
      </ol>
      <p className="min-w-0 flex-1 text-sm leading-snug text-fg" aria-live="polite">
        {gloss(step.note)}
      </p>
      <Button
        tone={spotlight ? "primary" : "ghost"}
        onClick={onSpotlight}
        title="Spotlight the nodes this step is about and dim the rest (F)"
        className="shrink-0"
      >
        <span className="whitespace-nowrap">Spotlight {spotlight ? "on" : "off"}</span>
      </Button>
      <IconButton label="Hide the Watch strip (H)" size="sm" onClick={onHide}>
        ✕
      </IconButton>
    </div>
  );
}
