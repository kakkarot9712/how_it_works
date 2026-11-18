import { glossaryTitle } from "@/lib/glossary";
import { toneColor } from "@/components/ui";

/**
 * Static diagram for the write-up: one request through an nginx upstream group using
 * least_conn. Server component, theme tokens only. Laid out in a 780×300 viewBox.
 */

const ROWS = [
  { name: "api-1", y: 70, conns: 2, fails: 0, state: "available", tone: "muted", note: "2 active" },
  { name: "api-2", y: 150, conns: 0, fails: 1, state: "disabled", tone: "err", note: "refused: RST" },
  { name: "api-3", y: 230, conns: 1, fails: 0, state: "available", tone: "ok", note: "1 active ← chosen" },
] as const;

const NGX = { x: 150, y: 20, w: 330, h: 260 };
const SRV = { x: 600, w: 178, h: 56 };

function Step({ n, x, y }: { n: number; x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={11} className="fill-bg stroke-accent" strokeWidth={1.5} />
      <text textAnchor="middle" dy={4.5} className="fill-accent text-svg-caption font-semibold">
        {n}
      </text>
    </g>
  );
}

export function UpstreamDiagram() {
  return (
    <svg
      viewBox="0 0 780 300"
      className="w-full min-w-[720px]"
      role="img"
      aria-label="A request reaches nginx. With least_conn, nginx skips api-2, which is disabled after a refused connection, compares active connections on api-1 (2) and api-3 (1), and sends the request to api-3."
    >
      <defs>
        <marker id="ud-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-fg-muted" />
        </marker>
      </defs>

      {/* client request */}
      <rect x={1} y={115} width={112} height={70} rx={10} className="fill-panel-2 stroke-line" />
      <text x={13} y={139} className="fill-fg-muted text-svg-body">client</text>
      <text x={13} y={164} className="font-mono text-svg-body" fill="var(--color-ch-1)">request #12</text>
      <line x1={115} y1={150} x2={NGX.x - 4} y2={150} className="stroke-fg-muted" strokeWidth={1.4} markerEnd="url(#ud-arrow)" />
      <Step n={1} x={132} y={132} />

      {/* nginx and its view of the group */}
      <rect x={NGX.x} y={NGX.y} width={NGX.w} height={NGX.h} rx={14} className="fill-none stroke-line" strokeDasharray="6 5" />
      <text x={NGX.x + 14} y={NGX.y + 24} className="fill-fg-muted text-svg-body">nginx worker · upstream api</text>
      <text x={NGX.x + 14} y={NGX.y + 46} className="fill-fg font-mono text-svg-body">least_conn;</text>
      <text x={NGX.x + 14} y={NGX.y + 78} className="fill-fg-muted font-mono text-svg-caption">server   conns  fails  state</text>
      {ROWS.map((r, k) => (
        <text key={r.name} x={NGX.x + 14} y={NGX.y + 102 + k * 24} className={r.tone === "muted" ? "fill-fg font-mono text-svg-body" : "font-mono text-svg-body"} fill={r.tone === "muted" ? undefined : toneColor[r.tone]}>
          {`${r.name.padEnd(9)}${String(r.conns).padEnd(7)}${String(r.fails).padEnd(7)}${r.state}`}
        </text>
      ))}
      <Step n={2} x={NGX.x + NGX.w - 20} y={NGX.y + 108} />
      <text x={NGX.x + 14} y={NGX.y + 196} className="fill-fg-muted text-svg-caption">skip api-2: max_fails reached within fail_timeout</text>
      <text x={NGX.x + 14} y={NGX.y + 216} className="fill-fg-muted text-svg-caption">fewest conns ÷ weight among the rest: api-3</text>
      <text x={NGX.x + 14} y={NGX.y + 236} className="fill-fg-muted text-svg-caption">api-3 conns 1 → 2 until its response comes back</text>

      {/* servers */}
      {ROWS.map((r) => (
        <g key={r.name}>
          <line
            x1={NGX.x + NGX.w + 4}
            y1={r.y}
            x2={SRV.x - 4}
            y2={r.y}
            className={r.name === "api-3" ? "stroke-accent" : "stroke-line"}
            strokeWidth={r.name === "api-3" ? 2 : 1.2}
            strokeDasharray={r.name === "api-2" ? "5 5" : undefined}
            markerEnd={r.name === "api-3" ? "url(#ud-arrow)" : undefined}
          />
          <rect x={SRV.x} y={r.y - SRV.h / 2} width={SRV.w} height={SRV.h} rx={10} className={r.name === "api-2" ? "fill-panel-2 stroke-err" : "fill-panel-2 stroke-line"} />
          <text x={SRV.x + 12} y={r.y - 4} className="fill-fg text-svg-body font-semibold">
            {r.name}
          </text>
          <text x={SRV.x + 12} y={r.y + 16} className={r.tone === "muted" ? "fill-fg-muted text-svg-caption" : "text-svg-caption"} fill={r.tone === "muted" ? undefined : toneColor[r.tone]}>
            {r.name === "api-2" && <title>{glossaryTitle("RST")}</title>}
            {r.note}
          </text>
        </g>
      ))}
      <Step n={3} x={(NGX.x + NGX.w + SRV.x) / 2} y={248} />
    </svg>
  );
}
