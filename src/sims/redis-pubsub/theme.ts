import type { Tone } from "@/components/ui";
import type { Subscriber } from "./model";

/** Channel → traffic colour (theme tokens ch-1..ch-3). Shared by canvas, inspector and write-up. */
export const CHANNEL_COLOR: Record<string, string> = {
  orders: "var(--color-ch-1)",
  payments: "var(--color-ch-2)",
  refunds: "var(--color-ch-3)",
};

/** A subscriber's connection status, as shown on its card and in the inspector. */
export function subStatus(sub: Subscriber): { text: string; tone: Tone } {
  if (sub.client === "offline") return { text: "offline", tone: "err" };
  if (sub.client === "waiting") return { text: "reconnecting…", tone: "warn" };
  if (sub.client === "connecting") return { text: "subscribing…", tone: "warn" };
  if (!sub.registered) return { text: "half-open", tone: "err" };
  if (sub.blocked) return { text: "not reading", tone: "warn" };
  return { text: "subscribed", tone: "ok" };
}
