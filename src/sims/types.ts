import type { ComponentType } from "react";
import type { Runtime } from "@/engine/runtime";
import type { SimModel } from "@/engine/types";

/**
 * Every simulation's params have the same shape so the shared player can
 * render setting sliders and "lego" component toggles for any sim.
 */
export interface SimParams<St extends object, Co extends object> {
  settings: St;
  components: Co;
}

export interface Scenario<A, St extends object, Co extends object> {
  id: string;
  title: string;
  summary: string;
  /** Bullet points: what to look at while it plays. */
  watchFor: string[];
  settings?: Partial<St>;
  components?: Partial<Co>;
  /** Actions the scenario performs on its own, at simulated ms. */
  script: { at: number; action: A }[];
  /** Node selected in the inspector when the scenario loads. */
  select?: string;
}

/** A numeric knob. Changing one rebuilds the simulation from t=0. */
export interface SettingDef<St> {
  key: keyof St & string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  help: string;
}

/** A removable building block (the "lego" sandbox). Toggling rebuilds the sim. */
export interface ComponentDef<Co> {
  key: keyof Co & string;
  label: string;
  /** What this part does, and what to expect when it's removed. */
  help: string;
}

export interface ViewProps<S, A> {
  state: S;
  now: number;
  selected: string | null;
  select: (id: string | null) => void;
  dispatch: (a: A) => void;
}

export interface SimDefinition<S, E, A, St extends object, Co extends object> {
  model: SimModel<S, E, A, SimParams<St, Co>>;
  defaults: SimParams<St, Co>;
  settings: SettingDef<St>[];
  components: ComponentDef<Co>[];
  scenarios: Scenario<A, St, Co>[];
  /** The animated diagram (SVG). Rendered every frame. */
  Canvas: ComponentType<ViewProps<S, A>>;
  /** Controls and stats for the selected node: the user's hands on the system. */
  Inspector: ComponentType<ViewProps<S, A>>;
  /** Shown when the simulation clock is in slow motion relative to reality. */
  timeNote?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySimDefinition = SimDefinition<any, any, any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRuntime = Runtime<any, any, any, any>;
