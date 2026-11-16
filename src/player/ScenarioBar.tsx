"use client";

import type { ReactNode } from "react";
import type { AnySimDefinition } from "@/sims/types";
import { ScenarioPicker } from "./ScenarioPicker";
import { gloss } from "@/components/ui";

/** Top of the player: scenario picker, toolbar actions, the scenario's summary and what to watch for. */
export function ScenarioBar({
  def,
  current,
  onPick,
  modified,
  actions,
}: {
  def: AnySimDefinition;
  current: number;
  onPick: (i: number) => void;
  /** The user has changed blocks or settings from the scenario's own. */
  modified: boolean;
  actions: ReactNode;
}) {
  const scenario = def.scenarios[current];
  return (
    <div className="border-b border-line px-5 py-2.5">
      <div className="flex items-center gap-2">
        <ScenarioPicker def={def} current={current} onPick={onPick} />
        {modified && <span className="text-xs text-warn">modified</span>}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>
      </div>
      <p className="mt-1.5 max-w-5xl text-sm leading-relaxed text-fg-muted">{gloss(scenario.summary)}</p>
      <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-note text-fg-muted">
        {scenario.watchFor.map((w) => (
          <li key={w} className="before:mr-1.5 before:text-accent before:content-['▸']">
            {gloss(w)}
          </li>
        ))}
      </ul>
    </div>
  );
}
