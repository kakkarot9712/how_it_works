import type { Tone } from "@/components/ui";
import { toneColor } from "@/components/ui";
import { isLeader, type BrokerId, type PacketKind, type ProducerRecord, type State } from "./model";

/** Leader epochs → traffic colour: records written under different leaders look different on the tape. */
const EPOCH_COLOR = ["var(--color-ch-1)", "var(--color-ch-2)", "var(--color-ch-3)", "var(--color-ch-4)"];
export const epochColor = (epoch: number) => EPOCH_COLOR[(Math.max(1, epoch) - 1) % EPOCH_COLOR.length];

export function packetColor(kind: PacketKind, error: boolean): string {
  if (error) return toneColor.err;
  switch (kind) {
    case "produce":
      return "var(--color-ch-1)";
    case "produce-resp":
      return toneColor.ok;
    case "fetch":
      return toneColor.muted;
    case "fetch-resp":
      return "var(--color-ch-3)";
  }
}

/** The broker process itself: up, crashed, cut off, stalled. */
export function brokerCondition(s: State, b: BrokerId): { text: string; tone: Tone } {
  const br = s.brokers[b];
  if (!br.up) return { text: "crashed", tone: "err" };
  if (br.cut) return { text: "network cut", tone: "err" };
  if (s.ctl.fenced[b]) return { text: "fenced", tone: "err" };
  if (br.stalled && !isLeader(br)) return { text: "fetcher stalled", tone: "warn" };
  return { text: "up", tone: "ok" };
}

/** The broker's role, as the controller sees it, plus a leader that hasn't heard it was replaced. */
export function brokerRole(s: State, b: BrokerId): { text: string; tone: Tone } {
  const br = s.brokers[b];
  if (!br.up) return { text: "down", tone: "err" };
  if (s.ctl.leader === b) return { text: `leader · epoch ${s.ctl.epoch}`, tone: "accent" };
  if (isLeader(br)) return { text: `still thinks it leads (epoch ${br.view.epoch})`, tone: "warn" };
  return { text: "follower", tone: "muted" };
}

export function recordView(r: ProducerRecord): { text: string; tone: Tone } {
  if (r.lost) return { text: "lost", tone: "err" };
  switch (r.status) {
    case "acked":
      return { text: "acked", tone: "ok" };
    case "sent":
      return { text: "sent", tone: "muted" };
    case "failed":
      return { text: "failed", tone: "err" };
    case "in flight":
      return { text: r.attempts > 1 ? "retrying" : "in flight", tone: r.attempts > 1 ? "warn" : "muted" };
    case "buffered":
      return { text: r.attempts > 0 ? "retry wait" : "buffered", tone: r.attempts > 0 ? "warn" : "muted" };
  }
}
