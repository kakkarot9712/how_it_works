import { toneColor } from "@/components/ui";
import { glossaryTitle } from "@/lib/glossary";

const ROWS = [
  { name: "broker-1", role: "leader", leo: 7, note: "LEO 7" },
  { name: "broker-2", role: "follower, in ISR", leo: 7, note: "fetch_offset 7" },
  { name: "broker-3", role: "follower, in ISR", leo: 5, note: "fetch_offset 5: behind" },
];
const CELL = 34;
const X0 = 200;
const HW = 5;

/**
 * One partition, three replicas, logs aligned by offset. broker-3 is still in the ISR but has
 * only fetched up to offset 5, so the high watermark waits at 5: offsets 5 and 6 are on the
 * leader and broker-2 but not committed yet. Static figure for the write-up.
 */
export function ReplicationDiagram() {
  const hwX = X0 + HW * CELL - 2;
  return (
    <svg viewBox="0 0 780 300" className="h-auto w-full min-w-[720px]" role="img" aria-label="Three replicas of a partition aligned by offset, with the high watermark">
      {/* producer */}
      <rect x={8} y={36} width={120} height={56} rx={10} className="fill-panel-2 stroke-line" />
      <text x={20} y={60} className="fill-fg text-svg-body font-semibold">
        producer
      </text>
      <text x={20} y={80} className="fill-fg-muted font-mono text-svg-caption">
        acks=all
      </text>
      <line x1={128} y1={64} x2={X0 - 14} y2={64} stroke="var(--color-ch-1)" strokeWidth={1.6} markerEnd="url(#rd-arrow)" />
      <text x={136} y={56} className="font-mono text-svg-caption" fill="var(--color-ch-1)">
        Produce
      </text>

      <defs>
        <marker id="rd-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-fg-muted" />
        </marker>
      </defs>

      {ROWS.map((r, i) => {
        const y = 40 + i * 82;
        return (
          <g key={r.name}>
            <text x={X0} y={y - 6} className="fill-fg text-svg-body font-semibold">
              {r.name} <tspan className="fill-fg-muted font-normal">· {r.role}</tspan>
            </text>
            {Array.from({ length: 9 }, (_, o) => {
              const has = o < r.leo;
              const committed = o < HW;
              return (
                <g key={o}>
                  <rect
                    x={X0 + o * CELL}
                    y={y}
                    width={CELL - 4}
                    height={32}
                    rx={3}
                    className={has ? "fill-bg" : "fill-none stroke-line"}
                    stroke={has ? "var(--color-ch-1)" : undefined}
                    strokeDasharray={has && !committed ? "3 2" : !has ? "2 3" : undefined}
                    opacity={has ? 1 : 0.5}
                  />
                  {has && committed && <rect x={X0 + o * CELL} y={y} width={CELL - 4} height={32} rx={3} fill="var(--color-ch-1)" opacity={0.3} />}
                  {has && (
                    <text x={X0 + o * CELL + (CELL - 4) / 2} y={y + 21} textAnchor="middle" className="fill-fg font-mono text-svg-caption">
                      {o}
                    </text>
                  )}
                </g>
              );
            })}
            <text x={X0 + 9 * CELL + 12} y={y + 21} className="fill-fg-muted font-mono text-svg-caption">
              <title>{glossaryTitle("LEO")}</title>
              {r.note}
            </text>
          </g>
        );
      })}
      {/* each follower fetches from the leader */}
      {[1, 2].map((i) => {
        const fx = 700 + i * 30;
        return <line key={i} x1={fx} y1={40 + i * 82 + 16} x2={fx} y2={40 + 34} className="stroke-fg-muted" strokeWidth={1.4} markerEnd="url(#rd-arrow)" />;
      })}
      {[1, 2].map((i) => (
        <line key={`t${i}`} x1={690} y1={40 + i * 82 + 16} x2={700 + i * 30} y2={40 + i * 82 + 16} className="stroke-fg-muted" strokeWidth={1.4} />
      ))}
      <text x={745} y={24} textAnchor="middle" className="fill-fg-muted font-mono text-svg-caption">
        Fetch
      </text>

      {/* the high watermark */}
      <line x1={hwX} x2={hwX} y1={28} y2={250} stroke={toneColor.ok} strokeWidth={2} />
      <text x={hwX} y={270} textAnchor="middle" className="font-mono text-svg-caption" fill={toneColor.ok}>
        <title>{glossaryTitle("HW")}</title>
        HW 5
      </text>
      <text x={X0} y={292} className="fill-fg-muted text-svg-caption">
        solid: committed, readable by consumers
      </text>
      <text x={X0 + 260} y={292} className="fill-fg-muted text-svg-caption">
        dashed: on some replicas, not committed
      </text>
    </svg>
  );
}
