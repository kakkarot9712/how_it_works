import type { Tone } from "@/components/ui";
import { toneColor } from "@/components/ui";
import { LANES, maxFails, peerDisabled, percentile, type LaneId, type State } from "./model";

/** Request kinds → traffic colour (theme tokens). Shared by canvas, inspector and write-up. */
export const REQ_COLOR = {
  normal: "var(--color-ch-1)",
  heavy: "var(--color-ch-2)",
} as const;

export const reqColor = (heavy: boolean) => (heavy ? REQ_COLOR.heavy : REQ_COLOR.normal);

/** The real server's condition (the same in every group). */
export function serverCondition(s: State, i: number): { text: string; tone: Tone } {
  const srv = s.servers[i];
  if (srv.crashed) return { text: "crashed", tone: "err" };
  if (srv.hung) return { text: "not responding", tone: "err" };
  if (srv.speed < 1) return { text: `×${srv.speed} speed`, tone: "warn" };
  if (srv.speed > 1) return { text: `×${srv.speed} speed`, tone: "ok" };
  return { text: "up", tone: "ok" };
}

/** nginx's view of a server in one group: available, or disabled with time left. */
export function peerView(s: State, lane: LaneId, i: number, now: number): { text: string; tone: Tone } {
  const p = s.lanes[lane].peers[i];
  if (peerDisabled(s, p, now)) {
    const left = Math.max(0, s.settings.failTimeoutS * 1000 - (now - p.checked));
    return { text: `disabled ${(left / 1000).toFixed(1)}s`, tone: "err" };
  }
  if (maxFails(s) > 0 && p.fails >= maxFails(s)) return { text: "probing", tone: "warn" };
  return { text: `${p.conns} active`, tone: "muted" };
}

/**
 * p95 of normal requests per group, toned against the others: the best group is `ok`,
 * any group at least 1.5× the best is `warn` (2.5× is `err`). Same requests, so the
 * difference is the method.
 */
export function p95Tones(s: State): Record<LaneId, Tone> {
  const p95 = Object.fromEntries(LANES.map((l) => [l, percentile(s.lanes[l].stats.recent, 95)])) as Record<LaneId, number | null>;
  const known = LANES.map((l) => p95[l]).filter((x): x is number => x !== null);
  const best = known.length ? Math.min(...known) : 0;
  return Object.fromEntries(
    LANES.map((l) => {
      const v = p95[l];
      if (v === null || known.length < LANES.length) return [l, "muted"];
      if (v >= best * 2.5) return [l, "err"];
      if (v >= best * 1.5) return [l, "warn"];
      if (v === best) return [l, "ok"];
      return [l, "muted"];
    }),
  ) as Record<LaneId, Tone>;
}

export const toneCss = (t: Tone) => toneColor[t];
