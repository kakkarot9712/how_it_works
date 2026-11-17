import type { Tone } from "@/components/ui";
import { effectiveLevel, LEVELS, type Session, type XactStatus } from "./model";

/** Session → traffic colour (theme tokens ch-1, ch-2). Shared by canvas and inspector. */
export const SESSION_COLOR: Record<"A" | "B", string> = {
  A: "var(--color-ch-1)",
  B: "var(--color-ch-2)",
};

/** What a session is doing, as its card and inspector show it. */
export function sessionStatus(s: Session): { text: string; tone: Tone } {
  if (!s.connected) return { text: "reconnecting…", tone: "err" };
  if (s.wait) return { text: "waiting for a row lock", tone: "warn" };
  if (s.tx?.aborted) return { text: "transaction aborted, needs ROLLBACK", tone: "err" };
  if (s.stalled) return { text: s.tx ? "app stuck, transaction open" : "app stuck", tone: "warn" };
  if (s.tx) {
    const lvl = LEVELS[s.tx.level];
    const runs = s.tx.level !== effectiveLevel(s.tx.level) ? ` (runs as ${LEVELS[effectiveLevel(s.tx.level)]})` : "";
    return { text: `in transaction · ${lvl}${runs}`, tone: "ok" };
  }
  if (s.status === "failed") return { text: "idle · last transaction failed", tone: "err" };
  if (s.status === "refused") return { text: "idle · app refused", tone: "muted" };
  if (s.status === "done") return { text: "idle · done", tone: "muted" };
  return { text: "idle", tone: "muted" };
}

/** A one- or two-word form for status pills. */
export function sessionPill(s: Session): string {
  if (!s.connected) return "reconnecting";
  if (s.wait) return "waiting";
  if (s.tx?.aborted) return "aborted";
  if (s.stalled) return "app stuck";
  if (s.tx) return "in transaction";
  return "idle";
}

/** pg_xact status colour. */
export function xactTone(st: XactStatus): Tone {
  return st === "committed" ? "ok" : st === "in progress" ? "warn" : "err";
}

/** pg_stat_activity.state, wrapped to fit the backend card. */
export function backendLines(state: Session["backend"]): string[] {
  if (state === "idle in transaction") return ["idle in", "transaction"];
  if (state === "idle in transaction (aborted)") return ["idle in", "transaction", "(aborted)"];
  return [state];
}
