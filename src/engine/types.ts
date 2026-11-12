/**
 * Core types shared by every simulation.
 *
 * A simulation is a pure, deterministic state machine driven by a discrete-event
 * clock. Time is in simulated milliseconds. The engine owns the clock, the event
 * queue, the random number generator, user actions, narration, and snapshots
 * (for rewind). A model only says how state reacts to events and actions.
 */

export type LogLevel = "info" | "ok" | "warn" | "error";

export interface LogEntry {
  /** Simulated time in ms. */
  t: number;
  level: LogLevel;
  /** One-line headline shown in the narration feed. */
  text: string;
  /** Optional technical detail (config names, log lines, why it happened). */
  detail?: string;
  /** Node to highlight when the entry is hovered or clicked. */
  node?: string;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, max]. */
  int(min: number, max: number): number;
}

/** What a model can do while handling an event or an action. */
export interface SimContext<E> {
  /** Current simulated time in ms. */
  readonly now: number;
  readonly rng: Rng;
  /** Schedule an event `delay` ms from now (delay >= 0). */
  schedule(delay: number, event: E): void;
  /** Append a narration entry at the current time. */
  log(level: LogLevel, text: string, extra?: { detail?: string; node?: string }): void;
}

/**
 * A simulation model. `S` must be plain data (objects, arrays, numbers,
 * strings, booleans, null) so it can be snapshotted with structuredClone.
 * Never use Math.random or Date in a model: use ctx.rng and ctx.now.
 */
export interface SimModel<S, E, A, P> {
  init(params: P, ctx: SimContext<E>): S;
  handle(state: S, event: E, ctx: SimContext<E>): void;
  act(state: S, action: A, ctx: SimContext<E>): void;
}

/** An action placed on the timeline, by a scenario script or by the user. */
export interface TimedAction<A> {
  at: number;
  action: A;
  source: "script" | "user";
}
