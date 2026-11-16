import type { Tone } from "@/components/ui";
import type { Consumer, Group } from "./model";

/** Consumer group → traffic colour (theme tokens ch-1..ch-2). Shared by canvas, inspector and write-up. */
export const GROUP_COLOR: Record<string, string> = {
  mailers: "var(--color-ch-1)",
  analytics: "var(--color-ch-2)",
};

/** Producer traffic (XADD) colour. */
export const PRODUCE_COLOR = "var(--color-ch-3)";

/** A consumer's status, as shown on its card and in the inspector. */
export function consumerStatus(c: Consumer): { text: string; tone: Tone } {
  if (c.status === "offline") return { text: "offline", tone: "err" };
  if (c.status === "crashed") return { text: "crashed, restarting…", tone: "err" };
  if (c.status === "reconnecting") return { text: "reconnecting…", tone: "warn" };
  if (c.hung) return { text: "hung", tone: "warn" };
  if (c.processing) return { text: "processing", tone: "ok" };
  if (c.blockedSince !== null) return { text: "blocked", tone: "ok" };
  return { text: "running", tone: "ok" };
}

/** How worrying a pending entry is: idle past min-idle-time is claimable. */
export function pendingTone(idleMs: number, deliveries: number, minIdleMs: number): Tone {
  if (idleMs >= minIdleMs) return "err";
  if (deliveries > 1 || idleMs >= minIdleMs * 0.6) return "warn";
  return "muted";
}

export function groupLagText(lag: number | null): string {
  return lag === null ? "nil" : String(lag);
}

export type { Group };
