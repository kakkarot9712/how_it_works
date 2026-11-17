import { toneColor } from "@/components/ui";
/**
 * Static diagram for the write-up: one row with two versions after an uncommitted UPDATE,
 * pg_xact, and three snapshots deciding which version they see. Server component, theme
 * tokens only. Laid out in a 780×300 viewBox.
 */

const A = "var(--color-ch-1)";
const B = "var(--color-ch-2)";

const VERSIONS = [
  { y: 56, balance: "100", xmin: "739", xminTone: "ok", xmax: "740", xmaxTone: "warn", note: "old version: still there" },
  { y: 150, balance: "70", xmin: "740", xminTone: "warn", xmax: "—", xmaxTone: "muted", note: "new version from A's UPDATE" },
] as const;

const SNAPS = [
  { y: 58, label: "B's statement, now", snap: "740:740:", color: B, to: 0, why: "xid 740 is not below xmax: invisible" },
  { y: 148, label: "A itself (xid 740)", snap: "own changes", color: A, to: 1, why: "a transaction sees its own writes" },
  { y: 238, label: "anyone, after A commits", snap: "741:741:", color: "var(--color-fg-muted)", to: 1, why: "740 committed and below xmax" },
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

export function VersionDiagram() {
  return (
    <svg
      viewBox="0 0 780 300"
      className="w-full min-w-[720px]"
      role="img"
      aria-label="Row alice has two versions: 100 written by xid 739 with xmax 740, and 70 written by the uncommitted xid 740. pg_xact says 739 committed and 740 in progress. B's snapshot sees 100, A sees its own 70, and after A commits every new snapshot sees 70."
    >
      {/* the heap */}
      <text x={20} y={30} className="fill-fg-muted text-svg-body">
        table accounts, row <tspan className="fill-fg font-mono">alice</tspan>
      </text>
      {VERSIONS.map((v, i) => (
        <g key={i}>
          <rect x={20} y={v.y} width={250} height={80} rx={10} className="fill-panel-2 stroke-line" />
          <text x={36} y={v.y + 26} className="fill-fg font-mono text-svg-strong">
            balance {v.balance}
          </text>
          <text x={36} y={v.y + 48} className="font-mono text-svg-body">
            <tspan className="fill-fg-muted">xmin </tspan>
            <tspan fill={toneColor[v.xminTone]}>{v.xmin}</tspan>
            <tspan className="fill-fg-muted">{"   xmax "}</tspan>
            <tspan fill={toneColor[v.xmaxTone]}>{v.xmax}</tspan>
          </text>
          <text x={36} y={v.y + 68} className="fill-fg-muted text-svg-body">
            {v.note}
          </text>
        </g>
      ))}
      <Step n={1} x={20} y={150} />

      {/* pg_xact */}
      <text x={20} y={262} className="fill-fg-muted text-svg-body">
        pg_xact:
      </text>
      <text x={84} y={262} className="font-mono text-svg-body">
        <tspan className="fill-fg">739 </tspan>
        <tspan fill={toneColor.ok}>committed</tspan>
        <tspan className="fill-fg">{"   740 "}</tspan>
        <tspan fill={toneColor.warn}>in progress</tspan>
      </text>
      <Step n={2} x={20} y={280} />

      {/* snapshots */}
      {SNAPS.map((s, i) => {
        const vy = VERSIONS[s.to].y + 40;
        return (
          <g key={i}>
            <path d={`M480 ${s.y + 14} C 400 ${s.y + 14}, 360 ${vy}, 276 ${vy}`} fill="none" stroke={s.color} strokeWidth={1.6} />
            <polygon points={`276,${vy} 286,${vy - 5} 286,${vy + 5}`} fill={s.color} />
            <rect x={480} y={s.y - 6} width={284} height={48} rx={10} className="fill-panel" stroke={s.color} strokeWidth={1.2} />
            <text x={494} y={s.y + 12} className="fill-fg text-svg-body">
              {s.label} · <tspan className="font-mono">{s.snap}</tspan>
            </text>
            <text x={494} y={s.y + 32} className="fill-fg-muted text-svg-body">
              {s.why}
            </text>
          </g>
        );
      })}
      <Step n={3} x={480} y={52} />
    </svg>
  );
}
