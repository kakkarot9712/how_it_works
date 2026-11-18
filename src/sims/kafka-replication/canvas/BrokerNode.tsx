import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { glossaryTitle, glossaryTitles } from "@/lib/glossary";
import { brokerLabel, brokerNode, isLeader, list, secs, type BrokerId, type State } from "../model";
import { brokerCondition, brokerRole, epochColor } from "../theme";
import { BRK, TAPE_CELLS } from "./layout";

const PAD = 16;
const CELL_GAP = 2.5;

/**
 * One broker and its replica of orders-0: role, log end offset and high watermark, the log
 * itself as a tape (aligned by offset with the other brokers; colour = leader epoch, solid =
 * below this replica's high watermark), and the replication state that matters for its role.
 */
export function BrokerNode({
  state: s,
  b,
  y,
  now,
  windowStart,
  selected,
  onSelect,
}: {
  state: State;
  b: BrokerId;
  y: number;
  now: number;
  windowStart: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const br = s.brokers[b];
  const top = y - BRK.h / 2;
  const x = BRK.x + PAD;
  const right = BRK.x + BRK.w - PAD;
  const cond = brokerCondition(s, b);
  const role = brokerRole(s, b);
  const step = (BRK.w - 2 * PAD) / TAPE_CELLS;
  const cw = step - CELL_GAP;
  const tapeY = top + 74;
  const leads = isLeader(br) && s.ctl.leader === b;
  const cellX = (o: number) => x + (o - windowStart) * step;
  const hwX = br.hw >= windowStart && br.hw <= windowStart + TAPE_CELLS ? cellX(br.hw) - CELL_GAP / 2 : null;

  const followerLine = () => {
    if (!br.up) return { text: `log on disk: ${br.log.length} records`, tone: "muted" as const };
    if (br.cut) return { text: "can't reach the leader or the controller", tone: "err" as const };
    if (s.ctl.fenced[b]) return { text: "waiting to register with the controller", tone: "warn" as const };
    if (br.stalled) return { text: "replica fetcher stalled: not fetching", tone: "warn" as const };
    const from = br.fetchingFrom;
    if (from === null || s.ctl.leader === null) return { text: "no leader to fetch from", tone: "err" as const };
    return { text: `fetching from ${brokerLabel(from)}`, tone: "muted" as const };
  };

  return (
    <NodeBox id={brokerNode(b)} x={BRK.x} y={top} w={BRK.w} h={BRK.h} selected={selected} alert={!br.up || br.cut} onSelect={onSelect}>
      <text x={x} y={top + 28} className="fill-fg text-svg-title font-semibold">
        {brokerLabel(b)}
      </text>
      <text x={x + 98} y={top + 28} className="text-svg-body" fill={toneColor[cond.tone]}>
        ● {cond.text}
      </text>
      <text x={right} y={top + 28} textAnchor="end" className="text-svg-body font-semibold" fill={toneColor[role.tone]}>
        {role.text}
      </text>

      <text x={x} y={top + 52} className="fill-fg-muted font-mono text-svg-body">
        <title>{glossaryTitles("LEO HW")}</title>
        LEO <tspan className="fill-fg">{br.log.length}</tspan> · HW <tspan className="fill-fg">{br.hw}</tspan>
      </text>
      {!leads && (
        <text x={right} y={top + 52} textAnchor="end" className="text-svg-body" fill={toneColor[followerLine().tone]}>
          {followerLine().text}
        </text>
      )}
      {leads && (
        <text x={right} y={top + 52} textAnchor="end" className="fill-fg-muted font-mono text-svg-body">
          acks=all waiting{" "}
          <tspan fill={br.waiting.length >= 3 ? toneColor.warn : undefined} className={br.waiting.length >= 3 ? undefined : "fill-fg"}>
            {br.waiting.length}
          </tspan>
        </text>
      )}

      {/* offset ruler, every 5th offset */}
      {Array.from({ length: TAPE_CELLS }, (_, k) => windowStart + k)
        .filter((o) => o % 5 === 0)
        .map((o) => (
          <text key={o} x={cellX(o) + cw / 2} y={tapeY - 6} textAnchor="middle" className="fill-fg-muted font-mono text-svg-caption">
            {o}
          </text>
        ))}

      {/* the log: one cell per offset, record number inside */}
      {Array.from({ length: TAPE_CELLS }, (_, k) => {
        const o = windowStart + k;
        const r = br.log[o];
        const cx = cellX(o);
        if (!r) return <rect key={o} x={cx} y={tapeY} width={cw} height={28} rx={3} className="fill-none stroke-line" strokeDasharray="2 3" opacity={0.5} />;
        const committed = o < br.hw;
        const color = epochColor(r.epoch);
        return (
          <g key={o}>
            <rect
              x={cx}
              y={tapeY}
              width={cw}
              height={28}
              rx={3}
              className="fill-bg"
              stroke={color}
              strokeWidth={1.3}
              strokeDasharray={committed ? undefined : "3 2"}
            />
            {committed && <rect x={cx} y={tapeY} width={cw} height={28} rx={3} fill={color} opacity={0.3} />}
            <text x={cx + cw / 2} y={tapeY + 18.5} textAnchor="middle" className="fill-fg font-mono text-svg-caption">
              {r.id}
            </text>
          </g>
        );
      })}
      {hwX !== null && (
        <g>
          <line x1={hwX} x2={hwX} y1={tapeY - 4} y2={tapeY + 34} className="stroke-fg" strokeWidth={2} />
          <text x={hwX} y={tapeY + 48} textAnchor="middle" className="fill-fg font-mono text-svg-caption">
            <title>{glossaryTitle("HW")}</title>
            HW
          </text>
        </g>
      )}

      {leads ? <LeaderLines s={s} b={b} x={x} top={top} now={now} /> : <FollowerLines s={s} b={b} x={x} top={top} now={now} />}
    </NodeBox>
  );
}

function LeaderLines({ s, b, x, top, now }: { s: State; b: BrokerId; x: number; top: number; now: number }) {
  const br = s.brokers[b];
  const below = br.view.isr.length < Math.min(s.settings.minIsr, 3);
  const followers = ([1, 2, 3] as BrokerId[]).filter((f) => f !== b);
  return (
    <g>
      <text x={x} y={top + 146} className="fill-fg-muted font-mono text-svg-body">
        <title>{glossaryTitles("ISR ELR")}</title>
        ISR <tspan fill={below ? toneColor.err : toneColor.ok}>{list(s.ctl.isr)}</tspan> · ELR <tspan className="fill-fg">{list(s.ctl.elr)}</tspan> · min.insync.replicas=
        {s.settings.minIsr}
      </text>
      <text x={x} y={top + 168} className="fill-fg-muted font-mono text-svg-body">
        fetch offsets
        {followers.map((f, k) => {
          const st = br.followers[f];
          if (!st) return null;
          const behind = now - st.lastCaughtUpAt;
          return (
            <tspan key={f}>
              {k === 0 ? " " : " · "}
              {brokerLabel(f)} @
              <tspan fill={behind > 1500 ? toneColor.warn : undefined} className={behind > 1500 ? undefined : "fill-fg"}>
                {st.leo}
              </tspan>
            </tspan>
          );
        })}
      </text>
    </g>
  );
}

function FollowerLines({ s, b, x, top, now }: { s: State; b: BrokerId; x: number; top: number; now: number }) {
  const br = s.brokers[b];
  const inIsr = s.ctl.isr.includes(b);
  const inElr = s.ctl.elr.includes(b);
  const leader = s.ctl.leader === null ? null : s.brokers[s.ctl.leader];
  const lag = leader ? Math.max(0, leader.log.length - br.log.length) : null;
  const caught = leader?.followers[b];
  return (
    <g>
      <text x={x} y={top + 146} className="text-svg-body" fill={inIsr ? toneColor.ok : inElr ? toneColor.warn : toneColor.err}>
        <title>{glossaryTitles("ISR ELR")}</title>
        {inIsr ? "● in the ISR" : inElr ? "● out of the ISR, in the ELR" : "● out of the ISR"}
        {lag !== null && <tspan className="fill-fg-muted font-mono"> · {lag} behind the leader</tspan>}
      </text>
      <text x={x} y={top + 168} className="fill-fg-muted font-mono text-svg-body">
        {caught && br.up && !br.cut ? `last caught up ${secs(Math.max(0, now - caught.lastCaughtUpAt))} ago` : ""}
      </text>
    </g>
  );
}
