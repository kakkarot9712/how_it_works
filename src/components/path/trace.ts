import type { ReactNode } from "react";

/** One participant in a trace: a client, a broker, a replica. */
export interface TraceActor {
  id: string;
  /** Short name on the lifeline head: `producer`, `broker-1`. */
  label: string;
  /** Its role, one short line: `leader`, `follower`. */
  sub?: string;
}

/** One hop of a trace: a message between two actors, or a step inside one (`from === to`). */
export interface TraceHop {
  from: string;
  to: string;
  /** The request, response or action, as short as its real name: `Produce`, `Fetch(offset=1)`, `append`. */
  label: string;
  /** A response (drawn dashed). */
  reply?: boolean;
  /** Headline for this hop, one sentence. */
  title: string;
  /** What happens and why, with citations. Short: two to four sentences. */
  body: ReactNode;
  /** State this hop changes: actor id → field → new value. Fields not named keep their value. */
  set?: Record<string, Record<string, string>>;
}

/** A trace: actors, hops in order, and the state table they update (columns = actors, rows = fields). */
export interface TraceSpec {
  actors: TraceActor[];
  hops: TraceHop[];
  /**
   * State shown in each actor's box: which fields (a full `label`, and a `short` one that fits
   * the box, ≤ 12 characters), and each actor's values before the first hop.
   */
  state?: { fields: { id: string; label: string; short: string }[]; initial: Record<string, Record<string, string>> };
}

/** Each actor's state after hop `at` (cumulative; `at = -1` is the initial state), and which cells hop `at` changed. */
export function traceStateAt(spec: TraceSpec, at: number) {
  const state: Record<string, Record<string, string>> = structuredClone(spec.state?.initial ?? {});
  const changed = new Set<string>();
  spec.hops.slice(0, at + 1).forEach((h, i) => {
    for (const [actor, fields] of Object.entries(h.set ?? {}))
      for (const [f, v] of Object.entries(fields)) {
        state[actor] = { ...state[actor], [f]: v };
        if (i === at) changed.add(`${actor}.${f}`);
      }
  });
  return { state, changed };
}
