import { NodeBox } from "@/components/canvas";
import { toneColor, toneFill } from "@/components/ui";
import { glossaryTitles } from "@/lib/glossary";
import { PROGRAMS, snapText, type Line, type Session } from "../model";
import { RUN_MS } from "../scenarios";
import { SESSION_COLOR, sessionStatus } from "../theme";
import { SESS, SESS_TOP } from "./layout";

const ROW_H = 17;
const MAX_ROWS = 10;
/** ~0.61em per mono character at svg-body. */
const CHAR_W = 8.2;
const WRAP = 52;

interface Row {
  glyph: string;
  glyphCls: string;
  text: string;
  cls: string;
  result?: string;
  resultCls?: string;
}

const GLYPH: Record<Line["mark"], [string, string]> = {
  current: ["▸", "fill-accent"],
  done: ["✓", "fill-fg-muted"],
  error: ["✕", "fill-err"],
  pending: ["·", "fill-fg-muted"],
  skipped: ["–", "fill-fg-muted"],
  app: ["", "fill-fg-muted"],
};

function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if (cur && (cur + " " + word).length > width) {
      out.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) out.push(cur);
  return out;
}

/** Statement lines as card rows: long statements break before WHERE, results go right-aligned or below. */
function rowsOf(lines: Line[], avail: number): Row[] {
  const rows: Row[] = [];
  for (const l of lines) {
    const [glyph, glyphCls] = GLYPH[l.mark];
    const cls = l.mark === "app" ? (l.tone ? toneFill[l.tone] : "fill-fg-muted") : l.mark === "pending" || l.mark === "skipped" ? "fill-fg-muted" : "fill-fg";
    const at = l.sql.indexOf(" WHERE ");
    const parts = at > 0 ? [l.sql.slice(0, at), `  ${l.sql.slice(at + 1)}`] : [l.sql];
    parts.forEach((text, i) => rows.push({ glyph: i === 0 ? glyph : "", glyphCls, text, cls }));
    if (!l.result) continue;
    const resultCls = l.tone ? toneFill[l.tone] : "fill-fg-muted";
    const last = rows[rows.length - 1];
    if ((last.text.length + l.result.length + 3) * CHAR_W <= avail) {
      last.result = l.result;
      last.resultCls = resultCls;
    } else for (const w of wrap(l.result, WRAP)) rows.push({ glyph: "", glyphCls, text: `  ${w}`, cls: resultCls });
  }
  return rows;
}

/**
 * A client session: what it's doing, its transaction (level, xid, snapshot), the program's
 * statements with their results, and a timeline lane (same time scale in both cards).
 */
export function SessionNode({ s, now, selected, onSelect }: { s: Session; now: number; selected: boolean; onSelect: () => void }) {
  const { x, w, h } = SESS;
  const top = SESS_TOP[s.id];
  const st = sessionStatus(s);
  const tx = s.tx;
  const prog = s.program ? PROGRAMS[s.program] : null;
  const textX = x + 34;
  const avail = x + w - 14 - textX;
  const rows = rowsOf(s.lines, avail).slice(-MAX_ROWS);
  const color = SESSION_COLOR[s.id];

  const laneY = top + h - 44;
  const lx0 = x + 16;
  const lx1 = x + w - 16;
  const tx2x = (t: number) => lx0 + (Math.min(t, RUN_MS) / RUN_MS) * (lx1 - lx0);
  const xidText = tx ? `xid ${tx.xid ?? "— (none yet)"} · snapshot ${snapText(tx.snapshot)}` : s.connected ? `pid ${s.pid} · no open transaction` : "connection closed";

  return (
    <NodeBox id={s.id} x={x} y={top} w={w} h={h} selected={selected} alert={!!s.tx?.aborted || !s.connected} onSelect={onSelect}>
      <circle cx={x + 22} cy={top + 21} r={6} fill={color} />
      <text x={x + 36} y={top + 27} className="fill-fg text-svg-title font-semibold">
        {s.label}
      </text>
      <text x={x + w - 16} y={top + 27} textAnchor="end" className="fill-fg-muted text-svg-body">
        {prog ? `${prog.short}${s.attempt > 1 ? ` · attempt ${s.attempt}` : ""}` : s.lines.length ? "typed by hand" : ""}
      </text>
      <text x={x + 16} y={top + 52} className="text-svg-body" fill={toneColor[st.tone]}>
        <title>{glossaryTitles(st.text)}</title>● {st.text}
      </text>
      <text x={x + 16} y={top + 74} className="fill-fg-muted font-mono text-svg-body">
        {xidText}
      </text>

      {rows.map((r, i) => {
        const y = top + 100 + i * ROW_H;
        return (
          <g key={i}>
            {r.glyph && (
              <text x={x + 18} y={y} className={`${r.glyphCls} text-svg-body`}>
                {r.glyph}
              </text>
            )}
            <text x={textX} y={y} className={`${r.cls} font-mono text-svg-body`}>
              <title>{glossaryTitles(r.text)}</title>
              {r.text}
            </text>
            {r.result && (
              <text x={x + w - 14} y={y} textAnchor="end" className={`${r.resultCls} font-mono text-svg-body`}>
                {r.result}
              </text>
            )}
          </g>
        );
      })}
      {s.lines.length === 0 && (
        <text x={textX} y={top + 100} className="fill-fg-muted text-svg-body">
          Waiting to start a transaction.
        </text>
      )}

      {/* timeline lane: transaction spans above, statements and lock waits below */}
      <rect x={lx0} y={laneY} width={lx1 - lx0} height={22} rx={3} className="fill-bg" />
      {s.spans.map((sp, i) => {
        const x1 = tx2x(sp.start);
        const x2 = tx2x(sp.end ?? now);
        const c = sp.outcome === "commit" ? toneColor.ok : sp.outcome === "abort" ? toneColor.err : color;
        return <rect key={`sp${i}`} x={x1} y={laneY + 2} width={Math.max(2, x2 - x1)} height={5} rx={2} fill={c} opacity={0.8} />;
      })}
      {s.segs.map((sg, i) => {
        const x1 = tx2x(sg.start);
        const x2 = tx2x(sg.end ?? now);
        const c = sg.kind === "wait" ? toneColor.warn : sg.error ? toneColor.err : color;
        return <rect key={`sg${i}`} x={x1} y={laneY + 10} width={Math.max(2, x2 - x1)} height={9} rx={2} fill={c} />;
      })}
      <line x1={tx2x(now)} x2={tx2x(now)} y1={laneY - 3} y2={laneY + 25} className="stroke-fg" strokeWidth={1.2} />
      {[0, 5, 10, 15, 20].map((sec) => (
        <text key={sec} x={tx2x(sec * 1000)} y={laneY + 38} textAnchor={sec === 0 ? "start" : sec === 20 ? "end" : "middle"} className="fill-fg-muted font-mono text-svg-body">
          {sec}s
        </text>
      ))}
    </NodeBox>
  );
}
