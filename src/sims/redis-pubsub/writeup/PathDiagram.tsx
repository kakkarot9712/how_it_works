/**
 * Static diagram for the write-up: the path of one PUBLISH through Redis.
 * Server component, theme tokens only. Laid out in a 780×300 viewBox.
 */

const ROWS = [
  { id: "A", y: 85, sub: "A · SUBSCRIBE orders", buf: 0.18, sock: 1, state: "reading", tone: "ok" },
  { id: "B", y: 150, sub: "B · SUBSCRIBE orders", buf: 0.72, sock: 4, state: "slow reader", tone: "warn" },
  { id: "C", y: 215, sub: "C · PSUBSCRIBE pay*", buf: 0, sock: 0, state: "not matched", tone: "muted" },
] as const;

const BUF = { x: 322, w: 168, h: 50 };
const SOCK = { x: 528, w: 112, h: 50 };
const SUB = { x: 662, w: 116, h: 50 };

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

export function PathDiagram() {
  return (
    <svg
      viewBox="0 0 780 300"
      className="w-full min-w-[720px]"
      role="img"
      aria-label="PUBLISH orders: Redis looks up the channel, appends the message to subscriber A's and B's output buffers, and the kernel sends it when each socket has room. Subscriber C's pattern does not match."
    >
      <defs>
        <marker id="pd-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-fg-muted" />
        </marker>
      </defs>

      {/* publisher */}
      <rect x={1} y={110} width={118} height={80} rx={10} className="fill-panel-2 stroke-line" />
      <text x={13} y={132} className="fill-fg-muted text-svg-body">publisher</text>
      <text x={13} y={155} className="fill-fg font-mono text-svg-body">PUBLISH</text>
      <text x={13} y={174} className="font-mono text-svg-body" fill="var(--color-ch-1)">orders</text>

      {/* redis-server process boundary */}
      <rect x={145} y={8} width={360} height={284} rx={14} className="fill-none stroke-line" strokeDasharray="6 5" />
      <text x={158} y={30} className="fill-fg-muted text-svg-body">redis-server process memory · one thread</text>

      {/* lookup tables */}
      <rect x={160} y={52} width={140} height={196} rx={10} className="fill-panel-2 stroke-line" />
      <text x={172} y={76} className="fill-fg-muted font-mono text-svg-caption">pubsub_channels</text>
      <circle cx={177} cy={95} r={4.5} fill="var(--color-ch-1)" />
      <text x={187} y={100} className="fill-fg font-mono text-svg-body">orders → A, B</text>
      <text x={172} y={140} className="fill-fg-muted font-mono text-svg-caption">pubsub_patterns</text>
      <text x={172} y={164} className="fill-fg font-mono text-svg-body">pay* → C</text>
      <text x={172} y={186} className="fill-fg-muted text-svg-caption">pay* doesn&apos;t match</text>
      <text x={172} y={202} className="fill-fg-muted text-svg-caption">orders: C is skipped</text>

      {/* publisher → lookup, and the reply */}
      <line x1={119} y1={136} x2={158} y2={136} className="stroke-fg-muted" strokeWidth={1.4} markerEnd="url(#pd-arrow)" />
      <line x1={158} y1={168} x2={121} y2={168} className="stroke-fg-muted" strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#pd-arrow)" />
      <text x={60} y={214} textAnchor="middle" className="fill-ok font-mono text-svg-body">← :2</text>
      <text x={60} y={232} textAnchor="middle" className="fill-fg-muted text-svg-caption">receivers</text>

      {ROWS.map((r) => {
        const top = r.y - BUF.h / 2;
        const matched = r.tone !== "muted";
        const toneFill = r.tone === "warn" ? "var(--color-warn)" : "var(--color-ch-1)";
        return (
          <g key={r.id} opacity={matched ? 1 : 0.45}>
            {/* lookup → output buffer */}
            <path
              d={`M300 ${r.id === "C" ? 164 : 95} C 312 ${r.id === "C" ? 164 : 95}, 310 ${r.y}, ${BUF.x - 2} ${r.y}`}
              fill="none"
              className="stroke-fg-muted"
              strokeWidth={1.3}
              strokeDasharray={matched ? undefined : "3 4"}
              markerEnd={matched ? "url(#pd-arrow)" : undefined}
            />
            {/* output buffer (in Redis memory) */}
            <rect x={BUF.x} y={top} width={BUF.w} height={BUF.h} rx={8} className="fill-panel-2 stroke-line" />
            <text x={BUF.x + 10} y={top + 19} className="fill-fg-muted text-svg-caption">
              output buffer · {r.id}
            </text>
            <rect x={BUF.x + 10} y={top + 28} width={BUF.w - 20} height={10} rx={5} className="fill-bg" />
            {r.buf > 0 && <rect x={BUF.x + 10} y={top + 28} width={(BUF.w - 20) * r.buf} height={10} rx={5} fill={toneFill} />}

            {/* buffer → kernel */}
            <line x1={BUF.x + BUF.w} y1={r.y} x2={SOCK.x - 2} y2={r.y} className="stroke-fg-muted" strokeWidth={1.3} markerEnd={matched ? "url(#pd-arrow)" : undefined} />

            {/* kernel socket buffer */}
            <rect x={SOCK.x} y={top} width={SOCK.w} height={SOCK.h} rx={8} className="fill-panel-2 stroke-line" />
            <text x={SOCK.x + 10} y={top + 19} className="fill-fg-muted text-svg-caption">
              {r.sock === 4 ? "socket: full" : "socket buffer"}
            </text>
            {[0, 1, 2, 3].map((i) => (
              <rect
                key={i}
                x={SOCK.x + 10 + i * 23}
                y={top + 28}
                width={18}
                height={10}
                rx={2}
                className={i < r.sock ? undefined : "fill-bg"}
                fill={i < r.sock ? toneFill : undefined}
              />
            ))}

            {/* kernel → subscriber */}
            <line x1={SOCK.x + SOCK.w} y1={r.y} x2={SUB.x - 2} y2={r.y} className="stroke-fg-muted" strokeWidth={1.3} markerEnd={matched ? "url(#pd-arrow)" : undefined} />

            {/* subscriber */}
            <rect x={SUB.x} y={top} width={SUB.w} height={SUB.h} rx={8} className="fill-panel-2 stroke-line" />
            <text x={SUB.x + 10} y={top + 20} className="fill-fg text-svg-body font-semibold">
              subscriber {r.id}
            </text>
            <text
              x={SUB.x + 10}
              y={top + 38}
              className={r.tone === "warn" ? "fill-warn text-svg-caption" : r.tone === "ok" ? "fill-ok text-svg-caption" : "fill-fg-muted text-svg-caption"}
            >
              {r.state}
            </text>
          </g>
        );
      })}

      {/* column headings under the rows */}
      <text x={BUF.x + BUF.w / 2} y={270} textAnchor="middle" className="fill-fg-muted text-svg-caption">
        grows when the socket is full
      </text>
      <text x={SOCK.x + SOCK.w / 2} y={270} textAnchor="middle" className="fill-fg-muted text-svg-caption">
        kernel + TCP window
      </text>
      <text x={SUB.x + SUB.w / 2} y={270} textAnchor="middle" className="fill-fg-muted text-svg-caption">
        other hosts
      </text>

      <Step n={1} x={139} y={120} />
      <Step n={2} x={230} y={52} />
      <Step n={3} x={BUF.x + BUF.w / 2} y={52 + 4} />
      <Step n={4} x={SOCK.x + SOCK.w / 2} y={52 + 4} />
    </svg>
  );
}
