import { toneColor } from "@/components/ui";

const CELL = 30;

/** One record's path: key → partition, the partition tape with the committed offset and the consumer's position, and the lag between them. */
export function ConsumerPathDiagram() {
  const tapeX = 250;
  const rows = [
    { name: "orders-0", y: 40, keys: "u2, u4", n: 9, committed: 6, position: 8, owner: "consumer-1" },
    { name: "orders-1", y: 130, keys: "u1, u3", n: 10, committed: 5, position: 9, owner: "consumer-1" },
    { name: "orders-2", y: 220, keys: "u5, u7", n: 7, committed: 7, position: 7, owner: "consumer-2" },
  ];
  return (
    <svg viewBox="0 0 780 300" className="min-w-[720px]" role="img" aria-label="Keyed records hashed to three partitions, each read by one consumer, with committed offsets and lag">
      <rect x={10} y={100} width={150} height={90} rx={12} className="fill-panel stroke-line" />
      <text x={24} y={128} className="fill-fg text-svg-strong font-semibold">
        producer
      </text>
      <text x={24} y={152} className="fill-fg-muted font-mono text-svg-body">
        murmur2(key)
      </text>
      <text x={24} y={172} className="fill-fg-muted font-mono text-svg-body">
        % 3
      </text>
      {rows.map((r) => (
        <g key={r.name}>
          <line x1={160} y1={145} x2={tapeX - 10} y2={r.y + 25} className="stroke-line" strokeWidth={1.5} />
          <text x={tapeX} y={r.y} className="fill-fg font-mono text-svg-body">
            {r.name} <tspan className="fill-fg-muted">keys {r.keys}</tspan>
          </text>
          {Array.from({ length: r.n }, (_, o) => (
            <rect
              key={o}
              x={tapeX + o * (CELL + 2)}
              y={r.y + 10}
              width={CELL}
              height={30}
              rx={3}
              className={o < r.position ? undefined : "fill-panel-2 stroke-line"}
              fill={o < r.committed ? toneColor.ok : o < r.position ? toneColor.accent : undefined}
              fillOpacity={o < r.position ? 0.4 : undefined}
            />
          ))}
          <line x1={tapeX + r.committed * (CELL + 2) - 1} x2={tapeX + r.committed * (CELL + 2) - 1} y1={r.y + 4} y2={r.y + 46} stroke={toneColor.accent} strokeWidth={2.5} />
          <text x={tapeX + r.n * (CELL + 2) + 14} y={r.y + 30} className="fill-fg-muted text-svg-body">
            lag <tspan className="fill-fg font-mono">{r.n - r.committed}</tspan>
            <tspan dx={12}>→ {r.owner}</tspan>
          </text>
        </g>
      ))}
      <text x={20} y={290} className="fill-fg-muted text-svg-caption">
        green: processed and committed · teal: fetched, not committed yet · grey: not fetched · bar: committed offset
      </text>
    </svg>
  );
}
