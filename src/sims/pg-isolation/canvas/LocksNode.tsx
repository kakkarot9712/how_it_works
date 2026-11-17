import { Bar, NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { glossaryTitle } from "@/lib/glossary";
import { LOCKS as LOCKS_ID, ROWS, SESSIONS, type State } from "../model";
import { SESSION_COLOR } from "../theme";
import { LOCKS } from "./layout";

const LINE = 18;

type Item = { kind: "head"; text: string } | { kind: "line"; text: string; color?: string; bar?: number; time?: string; title?: string };

/**
 * The lock table: row locks and who holds them, backends waiting on another transaction
 * (with their deadlock_timeout timer), and at Serializable the SIRead locks and rw-conflicts.
 */
export function LocksNode({ state: s, now, selected, onSelect }: { state: State; now: number; selected: boolean; onSelect: () => void }) {
  const { x, y, w, h } = LOCKS;
  const items: Item[] = [];
  const rowLocks = ROWS.filter((r) => s.rowLocks[r]);
  if (rowLocks.length) {
    items.push({ kind: "head", text: "row locks" });
    for (const r of rowLocks) {
      const l = s.rowLocks[r]!;
      items.push({ kind: "line", text: `${r.padEnd(6)} xid ${l.xid}  ${l.mode}`, color: SESSION_COLOR[l.session] });
    }
  }
  const waiting = SESSIONS.map((id) => s.sessions[id]).filter((x) => x.wait);
  if (waiting.length) {
    items.push({ kind: "head", text: "waiting" });
    for (const ws of waiting) {
      const waited = now - ws.wait!.since;
      items.push({ kind: "line", text: `pid ${ws.pid} waits for ShareLock`, color: toneColor.warn });
      items.push({
        kind: "line",
        text: `  on transaction ${ws.wait!.xid}`,
        time: `${(waited / 1000).toFixed(1)}s`,
        color: toneColor.warn,
        bar: s.components.deadlock ? Math.min(1, waited / s.settings.deadlockTimeoutMs) : undefined,
      });
    }
  }
  const ssi = s.ssi.filter((t) => t.reads.length);
  if (ssi.length) {
    items.push({ kind: "head", text: "SIRead predicate locks" });
    for (const t of ssi)
      items.push({
        kind: "line",
        text: `Session ${t.session}  ${t.reads.includes("*") ? "relation accounts" : `tuples ${t.reads.join(", ")}`}${t.committed ? " (committed)" : ""}`,
        color: SESSION_COLOR[t.session],
        title: glossaryTitle("SSI"),
      });
    const edges = s.ssi.flatMap((t) => t.out.map((k) => [t, s.ssi.find((o) => o.key === k)!] as const)).filter(([, o]) => o);
    for (const [r, wr] of edges) items.push({ kind: "line", text: `rw-conflict  ${r.session} → ${wr.session}${wr.doomed ? "  (doomed)" : ""}`, color: wr.doomed ? toneColor.err : toneColor.accent });
  }

  return (
    <NodeBox id={LOCKS_ID} x={x} y={y} w={w} h={h} surface="panel-2" rx={10} selected={selected} onSelect={onSelect}>
      <text x={x + 16} y={y + 26} className="fill-fg text-svg-title font-semibold">
        locks
      </text>
      <text x={x + w - 16} y={y + 26} textAnchor="end" className="fill-fg-muted font-mono text-svg-body">
        deadlock_timeout {s.settings.deadlockTimeoutMs / 1000}s{s.components.deadlock ? "" : " (off)"}
      </text>
      {items.length === 0 && (
        <text x={x + 16} y={y + 54} className="fill-fg-muted text-svg-body">
          No locks held.
        </text>
      )}
      {items.slice(0, 9).map((it, i) => {
        const ly = y + 52 + i * LINE;
        if (it.kind === "head")
          return (
            <text key={i} x={x + 16} y={ly} className="fill-fg-muted text-svg-body">
              {it.text === "SIRead predicate locks" && <title>{glossaryTitle("SSI")}</title>}
              {it.text}
            </text>
          );
        return (
          <g key={i}>
            <text x={x + 24} y={ly} className="font-mono text-svg-body" fill={it.color}>
              {it.text}
            </text>
            {it.bar !== undefined && <Bar x={x + 204} y={ly - 10} width={56} height={10} value={it.bar} color={toneColor.warn} markers={[{ at: 1, color: toneColor.err }]} />}
            {it.time && (
              <text x={x + w - 16} y={ly} textAnchor="end" className="fill-warn font-mono text-svg-body">
                {it.time}
              </text>
            )}
          </g>
        );
      })}
    </NodeBox>
  );
}
