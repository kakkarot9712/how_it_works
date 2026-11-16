import type { ComponentType } from "react";
import type { Runtime } from "@/engine/runtime";
import type { SimModel } from "@/engine/types";
import type { SourceSet } from "@/lib/sources";

/**
 * Every simulation's params have the same shape so the shared player can
 * render setting sliders and "lego" component toggles for any sim.
 */
export interface SimParams<St extends object, Co extends object> {
  settings: St;
  components: Co;
}

/**
 * One step of a scenario's "flow to watch". From `at` until the next step, the canvas
 * spotlights `nodes` (and the wires and messages between them), dims the rest, and the
 * player shows `note`. Steps are what to look at; narration says what happened.
 */
export interface FlowStep {
  /** Simulated ms when this step starts. The first step is at 0. */
  at: number;
  /** Node ids to spotlight: the same ids the inspector selects (`select`). */
  nodes: string[];
  /** One short line: where to look and what to expect. Under ~110 characters. */
  note: string;
}

/** Default scenario length: long enough for one lesson, short enough to replay. */
export const DEFAULT_DURATION_MS = 30_000;

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
  /**
   * Length of the run in simulated ms (default DEFAULT_DURATION_MS, 30s). Playback stops
   * here, the timeline shows exactly this span, and seeking can't go past it.
   */
  duration?: number;
  /** The path to follow while it plays, step by step (required; see the add-scenario skill). */
  flow: FlowStep[];
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
  /** Every node id the canvas draws for this state (NodeBox `id`). Lets tests check `flow` ids. */
  nodeIds: (state: S) => string[];
  /** Version the model follows, shown as a badge: the sim's `sources` (src/lib/sources.ts). */
  sources: SourceSet;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySimDefinition = SimDefinition<any, any, any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRuntime = Runtime<any, any, any, any>;
