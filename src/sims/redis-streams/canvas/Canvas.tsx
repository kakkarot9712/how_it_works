"use client";

import { Boundary, Packet, Wire } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import type { ViewProps } from "@/sims/types";
import { groupNode, STREAM as STREAM_ID, type Action, type Packet as PacketState, type State } from "../model";
import { GROUP_COLOR, PRODUCE_COLOR } from "../theme";
import { ConsumerNode } from "./ConsumerNode";
import { GroupNode } from "./GroupNode";
import { CONS, CONS_Y, GROUPS, H, PROC, PROD, STREAM, W } from "./layout";
import { ProducerNode } from "./ProducerNode";
import { StreamNode } from "./StreamNode";

/**
 * The Redis Streams diagram: producer → redis-server (the stream key and its
 * consumer groups, inside the process boundary) → consumers. Drawing order:
 * boundary, wires, packets, then nodes, so packets slide under the cards.
 */
export function Canvas({ state: s, now, selected, select }: ViewProps<State, Action>) {
  const prodY = PROD.y + PROD.h / 2;
  const right = STREAM.x + STREAM.w;

  // Where each kind of packet travels from and to.
  const endpoints = (p: PacketState): [number, number, number, number] => {
    switch (p.kind) {
      case "xadd":
        return [PROD.x + PROD.w, prodY - 14, STREAM.x, prodY - 14];
      case "reply":
        return [STREAM.x, prodY + 14, PROD.x + PROD.w, prodY + 14];
      case "read":
        return [CONS.x, CONS_Y[p.from] - 42, right, CONS_Y[p.from] - 42];
      case "entries":
        return [right, CONS_Y[p.to] - 15, CONS.x, CONS_Y[p.to] - 15];
      case "ack":
        return [CONS.x, CONS_Y[p.from] + 12, right, CONS_Y[p.from] + 12];
      case "claim":
        return [CONS.x, CONS_Y[p.from] + 40, right, CONS_Y[p.from] + 40];
      case "claimed":
        return [right, CONS_Y[p.to] + 40, CONS.x, CONS_Y[p.to] + 40];
      case "dlq":
        return [CONS.x, CONS_Y[p.from] - 30, right, STREAM.y + 160];
    }
  };
  const packetColor = (p: PacketState) => {
    if (p.error || p.poison) return toneColor.err;
    if (p.kind === "xadd") return PRODUCE_COLOR;
    if (p.kind === "reply") return toneColor.muted;
    const cid = p.kind === "entries" || p.kind === "claimed" ? p.to : p.from;
    return GROUP_COLOR[s.consumers[cid].group];
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onClick={() => select(null)}
      role="img"
      aria-label="Redis Streams consumer groups simulation"
    >
      <Boundary x={PROC.x} y={PROC.y} w={PROC.w} h={PROC.h} label="redis-server process · memory" alert={!s.server.up} />

      {/* wires */}
      <Wire x1={PROD.x + PROD.w} y1={prodY} x2={STREAM.x} y2={prodY} />
      {s.consIds.map((id) => {
        const c = s.consumers[id];
        return <Wire key={id} faded={c.status !== "running"} x1={right} y1={CONS_Y[id]} x2={CONS.x} y2={CONS_Y[id]} />;
      })}

      {/* packets in flight: under the cards */}
      {s.packets.map((p) => {
        const [x1, y1, x2, y2] = endpoints(p);
        return (
          <Packet key={p.id} x1={x1} y1={y1} x2={x2} y2={y2} sentAt={p.sentAt} arriveAt={p.arriveAt} now={now} label={p.label} color={packetColor(p)} />
        );
      })}

      {s.prodIds.map((id) => (
        <ProducerNode key={id} state={s} prod={s.producers[id]} now={now} selected={selected === id} onSelect={() => select(id)} />
      ))}

      <StreamNode state={s} now={now} selected={selected === STREAM_ID} onSelect={() => select(STREAM_ID)} />

      {s.groupIds.map((gid) =>
        GROUPS[gid] ? (
          <GroupNode
            key={gid}
            state={s}
            group={s.groups[gid]}
            now={now}
            selected={selected === groupNode(gid)}
            onSelect={() => select(groupNode(gid))}
          />
        ) : null,
      )}

      {s.consIds.map((id) => (
        <ConsumerNode key={id} state={s} c={s.consumers[id]} y={CONS_Y[id]} now={now} selected={selected === id} onSelect={() => select(id)} />
      ))}
    </svg>
  );
}
