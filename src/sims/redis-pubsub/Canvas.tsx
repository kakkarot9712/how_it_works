"use client";

import type { ViewProps } from "@/sims/types";
import { cx } from "@/components/ui";
import { bufNode, CHANNELS, derived, kb, RESTART_MS, SERVER, type Action, type Packet, type State, type Subscriber } from "./model";

// Layout in SVG user units. Text sizes are chosen for the default (fit) zoom
// on a ~1100px wide canvas; users can zoom in further.
const W = 1160;
const H = 760;
const PUB = { x: 8, w: 220, h: 124 };
const PROC = { x: 300, y: 12, w: 560, h: H - 24 };
const CORE = { x: 318, w: 236, y: 140, h: 480 };
const BUF = { x: 584, w: 254, h: 112 };
const SUB = { x: 930, w: 226, h: 206 };

export const CHANNEL_COLOR: Record<string, string> = {
  orders: "var(--color-ch-1)",
  payments: "var(--color-ch-2)",
  refunds: "var(--color-ch-3)",
};

function rows(n: number, top: number, bottom: number): number[] {
  if (n === 1) return [(top + bottom) / 2];
  const gap = (bottom - top) / n;
  return Array.from({ length: n }, (_, i) => top + gap * (i + 0.5));
}

export function subStatus(sub: Subscriber): { text: string; tone: "ok" | "warn" | "err" } {
  if (sub.client === "offline") return { text: "offline", tone: "err" };
  if (sub.client === "waiting") return { text: "reconnecting…", tone: "warn" };
  if (sub.client === "connecting") return { text: "subscribing…", tone: "warn" };
  if (!sub.registered) return { text: "half-open", tone: "err" };
  if (sub.blocked) return { text: "not reading", tone: "warn" };
  return { text: "subscribed", tone: "ok" };
}

const toneFill = { ok: "var(--color-ok)", warn: "var(--color-warn)", err: "var(--color-err)" };

export function Canvas({ state: s, now, selected, select }: ViewProps<State, Action>) {
  const pubY = Object.fromEntries(rows(s.pubIds.length, 170, H - 170).map((y, i) => [s.pubIds[i], y]));
  const subY = Object.fromEntries(rows(s.subIds.length, 16, H - 16).map((y, i) => [s.subIds[i], y]));
  const mem = derived(s).memBytes;

  // Packet endpoints by kind.
  const endpoints = (p: Packet): [number, number, number, number] => {
    switch (p.kind) {
      case "publish":
        return [PUB.x + PUB.w, pubY[p.from] - 16, CORE.x, pubY[p.from] - 16];
      case "reply":
        return [CORE.x, pubY[p.to] + 18, PUB.x + PUB.w, pubY[p.to] + 18];
      case "deliver":
        return [BUF.x + BUF.w, subY[p.to] - 13, SUB.x, subY[p.to] - 13];
      case "fin":
        return [BUF.x + BUF.w, subY[p.to] + 14, SUB.x, subY[p.to] + 14];
      case "subscribe":
        return [SUB.x, subY[p.from] + 40, BUF.x + BUF.w, subY[p.from] + 40];
    }
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onClick={() => select(null)}
      role="img"
      aria-label="Redis Pub/Sub simulation"
    >
      {/* process boundary */}
      <rect
        x={PROC.x}
        y={PROC.y}
        width={PROC.w}
        height={PROC.h}
        rx={16}
        className={cx("fill-panel/40", s.server.up ? "stroke-line" : "stroke-err/60")}
        strokeDasharray="7 6"
      />
      <text x={PROC.x + 16} y={PROC.y + 28} className="fill-fg-muted text-[14px]">
        redis-server process · memory
      </text>

      {/* wires */}
      {s.pubIds.map((id) => (
        <line key={id} x1={PUB.x + PUB.w} y1={pubY[id]} x2={CORE.x} y2={pubY[id]} className="stroke-line" strokeWidth={1.6} />
      ))}
      {s.subIds.map((id) => {
        const sub = s.subscribers[id];
        const y = subY[id];
        const mid = (BUF.x + BUF.w + SUB.x) / 2;
        return (
          <g key={id}>
            <path
              d={`M${CORE.x + CORE.w} ${H / 2} C ${CORE.x + CORE.w + 16} ${H / 2}, ${BUF.x - 16} ${y}, ${BUF.x} ${y}`}
              fill="none"
              className={sub.registered ? "stroke-line" : "stroke-line/30"}
              strokeWidth={1.3}
            />
            <line
              x1={BUF.x + BUF.w}
              y1={y}
              x2={SUB.x}
              y2={y}
              strokeWidth={1.6}
              strokeDasharray={sub.linkUp ? undefined : "5 5"}
              className={sub.linkUp ? "stroke-line" : "stroke-err"}
            />
            {!sub.linkUp && (
              <g transform={`translate(${mid} ${y})`}>
                <circle r={13} className="fill-bg stroke-err" />
                <text textAnchor="middle" dy={5} className="fill-err text-[15px] font-bold">
                  ✕
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* publishers */}
      {s.pubIds.map((id) => {
        const p = s.publishers[id];
        const y = pubY[id] - PUB.h / 2;
        const r = p.lastReply;
        const fresh = r && now - r.at < 700;
        const rTone = !r ? "muted" : r.error ? "err" : r.text === "(integer) 0" ? "warn" : "ok";
        return (
          <g key={id} className="cursor-pointer" onClick={(e) => (e.stopPropagation(), select(id))}>
            <rect
              x={PUB.x}
              y={y}
              width={PUB.w}
              height={PUB.h}
              rx={12}
              className={cx("fill-panel", selected === id ? "stroke-accent" : "stroke-line")}
              strokeWidth={selected === id ? 2.5 : 1.2}
            />
            <text x={PUB.x + 14} y={y + 26} className="fill-fg-muted text-[13.5px]">
              publisher
            </text>
            <text x={PUB.x + 14} y={y + 52} className="fill-fg text-[19px] font-semibold">
              {p.label}
            </text>
            <circle cx={PUB.x + 20} cy={y + 74} r={5.5} fill={CHANNEL_COLOR[p.channel]} />
            <text x={PUB.x + 32} y={y + 79} className="fill-fg-muted font-mono text-[13.5px]">
              {p.auto ? `every ${p.intervalMs}ms` : "paused"} → {p.channel}
            </text>
            <text
              x={PUB.x + 14}
              y={y + 108}
              className={cx(
                "font-mono text-[14px]",
                rTone === "ok" && "fill-ok",
                rTone === "warn" && "fill-warn",
                rTone === "err" && "fill-err",
                rTone === "muted" && "fill-fg-muted",
              )}
              opacity={fresh ? 1 : 0.7}
            >
              {r ? `← ${r.text}` : "← (no reply yet)"}
            </text>
          </g>
        );
      })}

      {/* server core */}
      <g className="cursor-pointer" onClick={(e) => (e.stopPropagation(), select(SERVER))}>
        <rect
          x={CORE.x}
          y={CORE.y}
          width={CORE.w}
          height={CORE.h}
          rx={12}
          className={cx("fill-panel", selected === SERVER ? "stroke-accent" : s.server.up ? "stroke-line" : "stroke-err")}
          strokeWidth={selected === SERVER ? 2.5 : 1.2}
        />
        <text x={CORE.x + 16} y={CORE.y + 34} className="fill-fg text-[19px] font-semibold">
          redis-server
        </text>
        <text x={CORE.x + CORE.w - 16} y={CORE.y + 34} textAnchor="end" className={s.server.up ? "fill-ok text-[14px]" : "fill-err text-[14px]"}>
          {s.server.up ? "● up" : "● DOWN"}
        </text>
        <text x={CORE.x + 16} y={CORE.y + 70} className="fill-fg-muted text-[12.5px] uppercase tracking-wider">
          pubsub channels
        </text>
        {CHANNELS.map((ch, i) => {
          const subs = s.subIds.filter((id) => s.subscribers[id].registered && s.subscribers[id].channels.includes(ch));
          return (
            <g key={ch} transform={`translate(${CORE.x + 16} ${CORE.y + 98 + i * 48})`}>
              <circle cx={6} cy={-5} r={5.5} fill={CHANNEL_COLOR[ch]} />
              <text x={20} y={0} className="fill-fg font-mono text-[15.5px]">
                {ch}
              </text>
              <text x={20} y={20} className="fill-fg-muted text-[13.5px]">
                {subs.length ? `→ ${subs.map((id) => s.subscribers[id].label).join(", ")}` : "→ (nobody)"}
              </text>
            </g>
          );
        })}
        <text x={CORE.x + 16} y={CORE.y + 256} className="fill-fg-muted text-[12.5px] uppercase tracking-wider">
          pubsub patterns
        </text>
        {(() => {
          const pats = s.subIds.flatMap((id) => (s.subscribers[id].registered ? s.subscribers[id].patterns.map((p) => [p, id]) : []));
          return pats.length ? (
            pats.map(([p, id], i) => (
              <text key={p + id} x={CORE.x + 16} y={CORE.y + 282 + i * 22} className="fill-fg font-mono text-[15.5px]">
                {p} <tspan className="fill-fg-muted text-[13.5px]">→ {s.subscribers[id].label}</tspan>
              </text>
            ))
          ) : (
            <text x={CORE.x + 16} y={CORE.y + 282} className="fill-fg-muted text-[13.5px]">
              (none)
            </text>
          );
        })()}
        {/* memory gauge */}
        {(() => {
          const cap = s.settings.headroomKb * 1024;
          const f = Math.min(1, mem / cap);
          const tone = f > 0.85 ? "err" : f > 0.5 ? "warn" : "ok";
          return (
            <g transform={`translate(${CORE.x + 16} ${CORE.y + CORE.h - 80})`}>
              <text className="fill-fg-muted text-[12.5px] uppercase tracking-wider">client buffers in RAM</text>
              <rect y={12} width={CORE.w - 32} height={12} rx={6} className="fill-panel-2" />
              <rect y={12} width={(CORE.w - 32) * f} height={12} rx={6} fill={toneFill[tone]} />
              <text y={46} className="fill-fg-muted font-mono text-[13.5px]">
                {kb(mem)} / {s.settings.headroomKb} KB headroom
              </text>
            </g>
          );
        })()}
        {!s.server.up && (
          <g>
            <rect x={CORE.x} y={CORE.y} width={CORE.w} height={CORE.h} rx={12} className="fill-bg/95" />
            <text x={CORE.x + CORE.w / 2} y={CORE.y + CORE.h / 2 - 8} textAnchor="middle" className="fill-err text-[22px] font-bold">
              PROCESS DOWN
            </text>
            <text x={CORE.x + CORE.w / 2} y={CORE.y + CORE.h / 2 + 18} textAnchor="middle" className="fill-fg-muted text-[14.5px]">
              {s.server.downSince !== null
                ? `restarting in ${Math.max(0, (s.server.downSince + RESTART_MS - now) / 1000).toFixed(1)}s`
                : ""}
            </text>
          </g>
        )}
      </g>

      {/* output buffers */}
      {s.subIds.map((id) => (
        <OutputBuffer
          key={id}
          state={s}
          sub={s.subscribers[id]}
          y={subY[id]}
          now={now}
          selected={selected === bufNode(id)}
          onSelect={() => select(bufNode(id))}
        />
      ))}

      {/* subscribers */}
      {s.subIds.map((id) => (
        <SubscriberCard
          key={id}
          state={s}
          sub={s.subscribers[id]}
          y={subY[id]}
          now={now}
          selected={selected === id}
          onSelect={() => select(id)}
        />
      ))}

      {/* packets in flight */}
      {s.packets.map((p) => {
        const [x1, y1, x2, y2] = endpoints(p);
        const f = Math.min(1, Math.max(0, (now - p.sentAt) / (p.arriveAt - p.sentAt)));
        const x = x1 + (x2 - x1) * f;
        const y = y1 + (y2 - y1) * f;
        const color = p.error ? "var(--color-err)" : p.kind === "subscribe" ? "var(--color-ok)" : p.channel ? CHANNEL_COLOR[p.channel] : "var(--color-fg-muted)";
        const label = p.kind === "publish" ? (p.channel ?? p.label) : p.label;
        const w = Math.max(34, label.length * 7.9 + 18);
        return (
          <g key={p.id} transform={`translate(${x} ${y})`} pointerEvents="none">
            <rect x={-w / 2} y={-11} width={w} height={22} rx={11} className="fill-bg" stroke={color} strokeWidth={1.5} />
            <text textAnchor="middle" dy={4.5} className="font-mono text-[13px]" fill={color}>
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function OutputBuffer({
  state: s,
  sub,
  y,
  now,
  selected,
  onSelect,
}: {
  state: State;
  sub: Subscriber;
  y: number;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const top = y - BUF.h / 2;
  const limits = s.components.limits;
  const hard = s.settings.hardKb * 1024;
  const soft = s.settings.softKb * 1024;
  const scale = limits ? hard * 1.12 : s.settings.headroomKb * 1024;
  const barW = BUF.w - 28;
  const fx = (b: number) => Math.min(barW, (b / scale) * barW);
  const tone = limits ? (sub.obufBytes > hard * 0.8 ? "err" : sub.obufBytes > soft ? "warn" : "ok") : sub.obufBytes > scale * 0.6 ? "err" : "ok";
  const chips = sub.obuf.slice(0, 18);

  return (
    <g className="cursor-pointer" onClick={(e) => (e.stopPropagation(), onSelect())} opacity={sub.registered ? 1 : 0.45}>
      <rect
        x={BUF.x}
        y={top}
        width={BUF.w}
        height={BUF.h}
        rx={10}
        className={cx("fill-panel-2", selected ? "stroke-accent" : "stroke-line")}
        strokeWidth={selected ? 2.5 : 1.2}
      />
      <text x={BUF.x + 14} y={top + 25} className="fill-fg-muted text-[13.5px]">
        output buffer
      </text>
      <text x={BUF.x + BUF.w - 14} y={top + 25} textAnchor="end" className="fill-fg font-mono text-[14px]">
        {sub.registered ? `${kb(sub.obufBytes)} · ${sub.obuf.length} msg` : "closed"}
      </text>
      <g transform={`translate(${BUF.x + 14} ${top + 38})`}>
        <rect width={barW} height={14} rx={4} className="fill-bg" />
        <rect width={fx(sub.obufBytes)} height={14} rx={4} fill={toneFill[tone]} />
        {limits && (
          <>
            <line x1={fx(soft)} x2={fx(soft)} y1={-5} y2={19} stroke="var(--color-warn)" strokeWidth={2} />
            <line x1={fx(hard)} x2={fx(hard)} y1={-5} y2={19} stroke="var(--color-err)" strokeWidth={2} />
          </>
        )}
      </g>
      <g transform={`translate(${BUF.x + 14} ${top + 63})`}>
        {chips.map((m, i) => (
          <rect key={m.id} x={i * 10.5} y={0} width={8} height={13} rx={2} fill={CHANNEL_COLOR[m.channel]} opacity={0.85} />
        ))}
        {sub.obuf.length > chips.length && (
          <text x={chips.length * 10.5 + 4} y={12} className="fill-fg-muted font-mono text-[13px]">
            +{sub.obuf.length - chips.length}
          </text>
        )}
      </g>
      <text x={BUF.x + 14} y={top + BUF.h - 12} className="text-[13.5px]" fill={sub.softSince !== null ? "var(--color-warn)" : "var(--color-fg-muted)"}>
        {!limits
          ? "no limit configured"
          : sub.softSince !== null
            ? `over soft limit ${((now - sub.softSince) / 1000).toFixed(1)}s / ${s.settings.softSeconds}s`
            : `soft ${s.settings.softKb} KB · hard ${s.settings.hardKb} KB`}
      </text>
    </g>
  );
}

function SubscriberCard({
  state: s,
  sub,
  y,
  now,
  selected,
  onSelect,
}: {
  state: State;
  sub: Subscriber;
  y: number;
  now: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const top = y - SUB.h / 2;
  const x = SUB.x + 14;
  const col = SUB.x + 100;
  const st = subStatus(sub);
  const cmd = [...(sub.channels.length ? [`SUBSCRIBE ${sub.channels.join(" ")}`] : []), ...(sub.patterns.length ? [`PSUBSCRIBE ${sub.patterns.join(" ")}`] : [])].join(" ");
  const slots = s.settings.window;
  const step = Math.min(19, (SUB.w - 114) / slots);
  const procF = sub.processing ? Math.min(1, 1 - (sub.processingEnds - now) / sub.processMs) : 0;

  return (
    <g className="cursor-pointer" onClick={(e) => (e.stopPropagation(), onSelect())}>
      <rect
        x={SUB.x}
        y={top}
        width={SUB.w}
        height={SUB.h}
        rx={12}
        className={cx("fill-panel", selected ? "stroke-accent" : "stroke-line")}
        strokeWidth={selected ? 2.5 : 1.2}
      />
      <text x={x} y={top + 29} className="fill-fg text-[18px] font-semibold">
        {sub.label}
      </text>
      <text x={x} y={top + 51} className="text-[14px]" fill={toneFill[st.tone]}>
        ● {st.text}
      </text>
      <text x={x} y={top + 73} className="fill-fg-muted font-mono text-[13px]">
        {cmd}
      </text>

      {/* kernel socket buffer: unread data that already arrived */}
      <text x={x} y={top + 104} className="fill-fg-muted text-[13.5px]">
        socket buf
      </text>
      {Array.from({ length: slots }, (_, i) => {
        const m = sub.rx[i];
        return (
          <rect
            key={i}
            x={col + i * step}
            y={top + 91}
            width={step - 3}
            height={16}
            rx={3}
            className={m ? undefined : "fill-bg stroke-line"}
            fill={m ? CHANNEL_COLOR[m.channel] : undefined}
          />
        );
      })}

      {/* the app reading/processing one message */}
      <text x={x} y={top + 132} className="fill-fg-muted text-[13.5px]">
        app
      </text>
      <rect x={col} y={top + 118} width={SUB.w - 114} height={19} rx={4} className="fill-bg stroke-line" />
      {sub.processing && (
        <>
          <rect x={col} y={top + 118} width={(SUB.w - 114) * procF} height={19} rx={4} fill={CHANNEL_COLOR[sub.processing.channel]} opacity={0.5} />
          <text x={col + 6} y={top + 132} className="fill-fg font-mono text-[12.5px]">
            {sub.processing.payload}
          </text>
        </>
      )}
      {sub.blocked && (
        <text x={col + 6} y={top + 132} className="fill-warn font-mono text-[12.5px]">
          ⏸ not reading
        </text>
      )}

      <text x={x} y={top + 164} className="fill-fg-muted font-mono text-[13.5px]">
        recv <tspan className="fill-fg">{sub.received}</tspan> missed{" "}
        <tspan className={sub.missed ? "fill-warn" : "fill-fg"}>{sub.missed}</tspan> lost{" "}
        <tspan className={sub.lost ? "fill-err" : "fill-fg"}>{sub.lost}</tspan>
      </text>
      <text x={x} y={top + 189} className="fill-fg-muted font-mono text-[13px]">
        {sub.recent.length ? `last: ${sub.recent[0].label}` : "last: —"}
      </text>
    </g>
  );
}
