import { toneColor } from "@/components/ui";

const CELL = 34;

/** A topic is a set of partitions; each partition is its own append-only log with its own offsets, held by a broker. */
export function TopicDiagram() {
  const x0 = 200;
  const rows = [
    { name: "orders-0", broker: "broker-1", keys: ["u2", "u4", "u2", "u2", "u4", "u2", "u4"] },
    { name: "orders-1", broker: "broker-2", keys: ["u1", "u3", "u1", "u1"] },
    { name: "orders-2", broker: "broker-3", keys: ["u5", "u7", "u7", "u5", "u5"] },
  ];
  return (
    <svg viewBox="0 0 780 330" className="min-w-[720px]" role="img" aria-label="Topic orders made of three partitions, each an append-only log with its own offsets on a different broker">
      <rect x={10} y={10} width={760} height={290} rx={12} fill="none" className="stroke-line" strokeDasharray="5 4" />
      <text x={26} y={36} className="fill-fg text-svg-strong font-semibold">
        topic orders
      </text>
      <text x={26} y={56} className="fill-fg-muted text-svg-body">
        a name for a set of partitions
      </text>
      {rows.map((r, i) => {
        const y = 80 + i * 72;
        const end = x0 + r.keys.length * (CELL + 3);
        return (
          <g key={r.name}>
            <text x={26} y={y + 20} className="fill-fg font-mono text-svg-body">
              {r.name}
            </text>
            <text x={26} y={y + 40} className="fill-fg-muted text-svg-caption">
              on {r.broker}
            </text>
            {r.keys.map((k, o) => (
              <g key={o}>
                <rect x={x0 + o * (CELL + 3)} y={y + 4} width={CELL} height={30} rx={3} fill={toneColor.accent} fillOpacity={0.25} className="stroke-line" />
                <text x={x0 + o * (CELL + 3) + CELL / 2} y={y + 24} textAnchor="middle" className="fill-fg font-mono text-svg-caption">
                  {k}
                </text>
                <text x={x0 + o * (CELL + 3) + CELL / 2} y={y + 50} textAnchor="middle" className="fill-fg-muted font-mono text-svg-caption">
                  {o}
                </text>
              </g>
            ))}
            <rect x={end} y={y + 4} width={CELL} height={30} rx={3} fill="none" className="stroke-line" strokeDasharray="3 3" />
            <text x={end + CELL + 12} y={y + 24} className="fill-fg-muted text-svg-body">
              ← next append (offset {r.keys.length})
            </text>
          </g>
        );
      })}
      <text x={x0} y={320} className="fill-fg-muted text-svg-caption">
        offsets count up from 0 in each partition separately · oldest on the left, newest on the right
      </text>
    </svg>
  );
}
