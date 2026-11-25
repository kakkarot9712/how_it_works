import type { Tone } from "@/components/ui";
import { toneColor } from "@/components/ui";
import { CONSUMERS, lagOf, ownerOf, type Packet, type Rec, type State } from "./model";

export function packetColor(p: Packet): string {
  switch (p.kind) {
    case "produce":
      return p.data.poison ? toneColor.err : "var(--color-ch-1)";
    case "fetch":
    case "hb":
      return p.data.leave ? toneColor.warn : toneColor.muted;
    case "fetch-resp":
      return "var(--color-ch-2)";
    case "hb-resp":
      if (p.data.rebalance || p.data.unknown) return toneColor.warn;
      return p.data.assign || p.data.revoke ? toneColor.accent : toneColor.muted;
    case "commit":
      return "var(--color-ch-3)";
    case "commit-resp":
      return p.data.ok ? toneColor.ok : toneColor.err;
  }
}

/** One consumer's condition in a word or two. */
export function consumerStatus(s: State, c: number): { text: string; tone: Tone } {
  const k = s.consumers[c];
  if (k.crashed) return { text: "crashed", tone: "err" };
  if (!k.up) return { text: "not running", tone: "muted" };
  if (k.processing && k.processing.attempts > 1) return { text: k.pollTimedOut ? "stuck, out of the group" : "stuck retrying", tone: "err" };
  if (k.pollTimedOut) return { text: "left the group", tone: "err" };
  if (k.joining || k.rejoinNeeded || k.pendingRevoke.length) return { text: "rebalancing", tone: "warn" };
  if (!k.owned.length) return { text: "idle: no partitions", tone: "muted" };
  if (k.processing) return { text: "processing", tone: "ok" };
  return { text: "polling", tone: "ok" };
}

export function lagTone(lag: number): Tone {
  return lag >= 15 ? "err" : lag >= 8 ? "warn" : "ok";
}

export function groupStateTone(s: State): Tone {
  switch (s.coord.state) {
    case "Stable":
      return "ok";
    case "Empty":
      return "muted";
    default:
      return "warn";
  }
}

/** A record's fate on the tape. */
export function recView(s: State, p: number, r: Rec): { fill: string | null; opacity: number; label: string } {
  if (r.lost) return { fill: toneColor.err, opacity: 0.85, label: "lost: committed, never processed" };
  if (r.dlq) return { fill: toneColor.warn, opacity: 0.6, label: "parked in the dead-letter topic" };
  if (r.poison) return { fill: toneColor.err, opacity: 0.5, label: "poison: the handler throws on it" };
  if (r.processed > 1) return { fill: toneColor.warn, opacity: 0.75, label: `processed ${r.processed} times` };
  if (r.processed === 1) return { fill: toneColor.ok, opacity: 0.35, label: "processed" };
  const o = ownerOf(s, p);
  if (o !== null && s.consumers[o].position[p] > r.offset) return { fill: toneColor.accent, opacity: 0.5, label: "fetched, not processed yet" };
  return { fill: null, opacity: 1, label: "not fetched yet" };
}

export const totalLag = (s: State) => [0, 1, 2].reduce((a, p) => a + lagOf(s, p), 0);
export const runningConsumers = (s: State) => CONSUMERS.filter((c) => s.consumers[c].up).length;
