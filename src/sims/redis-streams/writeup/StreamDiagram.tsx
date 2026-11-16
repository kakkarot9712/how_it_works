import { glossaryTitle } from "@/lib/glossary";
/**
 * Static diagram for the write-up: one stream, two consumer groups at different
 * positions, their PELs, and the consumers. Server component, theme tokens only.
 * Laid out in a 780×320 viewBox.
 */

const CELL = { x: 168, y: 46, w: 38, step: 42 };
const ORDERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MAILERS = "var(--color-ch-1)";
const ANALYTICS = "var(--color-ch-2)";

/** Per order: "acked" | "pending" | "new" (not yet delivered to this group). */
const GROUPS = [
  {
    name: "mailers",
    color: MAILERS,
    y: 106,
    last: 9,
    pending: [8, 9],
    pel: ["#8 → mailer-2 · idle 0.3s · 1", "#9 → mailer-1 · idle 0.1s · 1"],
    note: "lag 1",
  },
  {
    name: "analytics",
    color: ANALYTICS,
    y: 210,
    last: 6,
    pending: [6],
    pel: ["#6 → analytics-1 · idle 0.2s · 1"],
    note: "lag 4",
  },
] as const;

const CONSUMERS = [
  { label: "mailer-1", y: 116, color: MAILERS, state: "processing #9" },
  { label: "mailer-2", y: 164, color: MAILERS, state: "processing #8" },
  { label: "analytics-1", y: 236, color: ANALYTICS, state: "processing #6" },
] as const;

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

const cellX = (order: number) => CELL.x + (order - 1) * CELL.step;

export function StreamDiagram() {
  return (
    <svg
      viewBox="0 0 780 320"
      className="w-full min-w-[720px]"
      role="img"
      aria-label="XADD appends order 10 to the stream. The mailers group has delivered up to order 9 and has 8 and 9 pending; the analytics group has delivered up to order 6 with 6 pending. Consumers XACK entries to remove them from their group's PEL."
    >
      <defs>
        <marker id="sd-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-fg-muted" />
        </marker>
      </defs>

      {/* producer */}
      <rect x={1} y={40} width={126} height={64} rx={10} className="fill-panel-2 stroke-line" />
      <text x={13} y={62} className="fill-fg-muted text-svg-body">checkout-api</text>
      <text x={13} y={84} className="fill-fg font-mono text-svg-body">XADD orders *</text>
      <line x1={127} y1={66} x2={CELL.x - 4} y2={66} className="stroke-fg-muted" strokeWidth={1.4} markerEnd="url(#sd-arrow)" />
      <text x={60} y={126} textAnchor="middle" className="fill-ok font-mono text-svg-body">← &quot;10-0&quot;</text>

      {/* redis-server boundary */}
      <rect x={140} y={8} width={480} height={304} rx={14} className="fill-none stroke-line" strokeDasharray="6 5" />
      <text x={154} y={30} className="fill-fg-muted text-svg-body">redis-server · the key orders (a stream)</text>

      {/* the stream tape */}
      {ORDERS.map((o) => (
        <g key={o}>
          <rect x={cellX(o)} y={CELL.y} width={CELL.w} height={40} rx={4} className="fill-bg" stroke={o === 10 ? "var(--color-ch-3)" : "var(--color-line)"} strokeWidth={o === 10 ? 1.8 : 1} />
          <text x={cellX(o) + CELL.w / 2} y={CELL.y + 25} textAnchor="middle" className="fill-fg font-mono text-svg-body">
            {o}
          </text>
        </g>
      ))}

      {GROUPS.map((g) => (
        <g key={g.name}>
          <rect x={154} y={g.y} width={452} height={g.pel.length > 1 ? 92 : 74} rx={8} className="fill-panel-2 stroke-line" />
          <circle cx={168} cy={g.y + 17} r={4.5} fill={g.color} />
          <text x={178} y={g.y + 22} className="fill-fg text-svg-body font-semibold">
            group {g.name}
          </text>
          <text x={594} y={g.y + 22} textAnchor="end" className="fill-fg-muted font-mono text-svg-caption">
            last-delivered-id {g.last}-0 · {g.note}
          </text>
          {ORDERS.map((o) => {
            const pending = (g.pending as readonly number[]).includes(o);
            const delivered = o <= g.last;
            return (
              <rect
                key={o}
                x={cellX(o)}
                y={g.y + 30}
                width={CELL.w}
                height={9}
                rx={2}
                fill={pending ? "var(--color-warn)" : delivered ? g.color : undefined}
                opacity={pending || !delivered ? 1 : 0.55}
                className={delivered ? undefined : "fill-bg stroke-line"}
              />
            );
          })}
          {/* last-delivered-id pointer */}
          <path d={`M${cellX(g.last) + CELL.w} ${g.y + 28} l0 13`} stroke={g.color} strokeWidth={2.5} />
          {g.pel.map((line, i) => (
            <text key={line} x={168} y={g.y + 60 + i * 18} className="fill-fg-muted font-mono text-svg-caption">
              <title>{glossaryTitle("PEL")}</title>
              {i === 0 ? "PEL " : "    "}
              <tspan className="fill-fg">{line}</tspan>
            </text>
          ))}
        </g>
      ))}

      {/* consumers */}
      {CONSUMERS.map((c) => (
        <g key={c.label}>
          <line x1={606} y1={c.y + 2} x2={644} y2={c.y + 2} className="stroke-fg-muted" strokeWidth={1.3} markerEnd="url(#sd-arrow)" />
          <rect x={646} y={c.y - 18} width={132} height={40} rx={8} className="fill-panel-2 stroke-line" />
          <circle cx={658} cy={c.y - 3} r={4} fill={c.color} />
          <text x={668} y={c.y + 1} className="fill-fg text-svg-body font-semibold">
            {c.label}
          </text>
          <text x={658} y={c.y + 16} className="fill-ok text-svg-caption">
            {c.state}
          </text>
        </g>
      ))}
      <text x={712} y={298} textAnchor="middle" className="fill-fg-muted text-svg-caption">
        XACK removes the
      </text>
      <text x={712} y={313} textAnchor="middle" className="fill-fg-muted text-svg-caption">
        <title>{glossaryTitle("PEL")}</title>
        entry from the PEL
      </text>

      <Step n={1} x={147} y={66} />
      <Step n={2} x={154} y={GROUPS[0].y + 34} />
      <Step n={3} x={626} y={98} />
      <Step n={4} x={712} y={274} />
    </svg>
  );
}
