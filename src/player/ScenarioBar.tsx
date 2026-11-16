"use client";

import type { ReactNode } from "react";
import type { AnySimDefinition } from "@/sims/types";
import { ScenarioInfo } from "./ScenarioInfo";
import { ScenarioPicker } from "./ScenarioPicker";

/**
 * Top of the player, one row: scenario picker, ⓘ (summary and what to look for, in a
 * popover) and toolbar actions. Kept to one row so the canvas gets the height; the Watch
 * strip below it says where to look while the scenario plays.
 */
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
  return (
    <div className="flex items-center gap-2 border-b border-line px-5 py-2">
      <ScenarioPicker def={def} current={current} onPick={onPick} />
      <ScenarioInfo scenario={def.scenarios[current]} />
      {modified && <span className="text-xs text-warn">modified</span>}
      <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>
    </div>
  );
}
