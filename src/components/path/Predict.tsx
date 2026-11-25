"use client";

import { useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { Button, Eyebrow, gloss, Heading, LinkButton, Surface, toneBadge } from "@/components/ui";

/** One prediction in a lab: a situation, a few answers (exactly one right), and the scenario that settles it. */
export interface Prediction {
  /** Scenario id in the lab's simulator. */
  scenario: string;
  /** Simulated ms to open the scenario at: just after the moment that answers the question. */
  t: number;
  question: string;
  /** What is set up, one or two sentences. */
  setup: string;
  options: { text: string; correct?: boolean }[];
  /** Why the right answer is right, with citations. Shown once the reader has committed. */
  explain: ReactNode;
}

/**
 * The "predict, then run" block: the reader picks an answer before seeing the result,
 * then gets the explanation and a deep link that opens the simulator at that moment.
 */
export function Predict({ n, prediction: p, simHref }: { n: number; prediction: Prediction; simHref: string }) {
  // Concept terms are marked on their first use in the card.
  const seen = new Set<string>();
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const right = answered && p.options[picked].correct;

  return (
    <Surface as="section" radius="xl" className="not-prose my-6 overflow-hidden">
      <header className="border-b border-line px-5 py-4">
        <Eyebrow tone="accent">Predict {n}</Eyebrow>
        <Heading level="card" as="h3" className="mt-1">
          {gloss(p.question, { seen })}
        </Heading>
        <p className="mt-1 text-sm leading-relaxed text-fg-muted">{gloss(p.setup, { seen })}</p>
      </header>

      <div className="space-y-2 px-5 py-4" role="group" aria-label="Your prediction">
        {p.options.map((o, i) => {
          const mark = !answered ? null : o.correct ? "ok" : i === picked ? "err" : null;
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => setPicked(i)}
              className={cx(
                "flex w-full items-baseline gap-3 rounded-md border px-3 py-2 text-left text-body transition-colors",
                mark ? toneBadge[mark] : "border-line bg-panel-2 text-fg",
                !answered && "hover:border-accent/60",
                answered && !mark && "opacity-60",
              )}
            >
              <span className="w-4 shrink-0 font-mono text-xs">{mark === "ok" ? "✓" : mark === "err" ? "✕" : String.fromCharCode(65 + i)}</span>
              <span>{gloss(o.text, { focusable: false })}</span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="border-t border-line bg-panel-2/50 px-5 py-4">
          <Eyebrow tone={right ? "ok" : "warn"}>{right ? "✓ Right" : "✕ Not quite"}</Eyebrow>
          <div className="mt-1.5 text-body leading-relaxed text-fg-muted [&_code]:rounded [&_code]:bg-panel-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_code]:text-fg [&_strong]:font-semibold [&_strong]:text-fg">
            {gloss(p.explain, { seen })}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <LinkButton href={`${simHref}?s=${p.scenario}&t=${p.t}`}>▶ Check it in the simulator</LinkButton>
            <Button tone="ghost" onClick={() => setPicked(null)}>
              Try again
            </Button>
          </div>
        </div>
      )}
    </Surface>
  );
}
