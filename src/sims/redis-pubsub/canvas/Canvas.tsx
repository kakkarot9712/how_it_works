"use client";

import { Boundary, Packet, rows, Wire } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import type { ViewProps } from "@/sims/types";
import { bufNode, SERVER, type Action, type Packet as PacketState, type State } from "../model";
import { CHANNEL_COLOR } from "../theme";
import { BUF, CORE, H, PROC, PUB, SUB, W } from "./layout";
import { OutputBufferNode } from "./OutputBufferNode";
import { PublisherNode } from "./PublisherNode";
import { ServerNode } from "./ServerNode";
import { SubscriberNode } from "./SubscriberNode";

/**
 * The Redis Pub/Sub diagram: publishers → redis-server (core + per-client output
 * buffers inside the process boundary) → subscribers. Drawing order matters:
 * boundary, wires, packets, then nodes, so packets slide under the cards.
 */
export function Canvas({ state: s, now, selected, select }: ViewProps<State, Action>) {
  const pubY = Object.fromEntries(rows(s.pubIds.length, 170, H - 170).map((y, i) => [s.pubIds[i], y]));
  const subY = Object.fromEntries(rows(s.subIds.length, 16, H - 16).map((y, i) => [s.subIds[i], y]));

  // Where each kind of packet travels from and to.
  const endpoints = (p: PacketState): [number, number, number, number] => {
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
  const packetColor = (p: PacketState) =>
    p.error ? toneColor.err : p.kind === "subscribe" ? toneColor.ok : p.channel ? CHANNEL_COLOR[p.channel] : toneColor.muted;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onClick={() => select(null)}
      role="img"
      aria-label="Redis Pub/Sub simulation"
    >
      <Boundary x={PROC.x} y={PROC.y} w={PROC.w} h={PROC.h} label="redis-server process · memory" alert={!s.server.up} />

      {/* wires */}
      {s.pubIds.map((id) => (
        <Wire key={id} x1={PUB.x + PUB.w} y1={pubY[id]} x2={CORE.x} y2={pubY[id]} />
      ))}
      {s.subIds.map((id) => {
        const sub = s.subscribers[id];
        return (
          <g key={id}>
            <Wire curve faded={!sub.registered} x1={CORE.x + CORE.w} y1={H / 2} x2={BUF.x} y2={subY[id]} />
            <Wire broken={!sub.linkUp} x1={BUF.x + BUF.w} y1={subY[id]} x2={SUB.x} y2={subY[id]} />
          </g>
        );
      })}

      {/* packets in flight: under the cards, so a pill slides out of one card and into the next */}
      {s.packets.map((p) => {
        const [x1, y1, x2, y2] = endpoints(p);
        return (
          <Packet
            key={p.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            sentAt={p.sentAt}
            arriveAt={p.arriveAt}
            now={now}
            label={p.kind === "publish" ? (p.channel ?? p.label) : p.label}
            color={packetColor(p)}
          />
        );
      })}

      {s.pubIds.map((id) => (
        <PublisherNode key={id} pub={s.publishers[id]} y={pubY[id]} now={now} selected={selected === id} onSelect={() => select(id)} />
      ))}

      <ServerNode state={s} now={now} selected={selected === SERVER} onSelect={() => select(SERVER)} />

      {s.subIds.map((id) => (
        <OutputBufferNode
          key={id}
          state={s}
          sub={s.subscribers[id]}
          y={subY[id]}
          now={now}
          selected={selected === bufNode(id)}
          onSelect={() => select(bufNode(id))}
        />
      ))}

      {s.subIds.map((id) => (
        <SubscriberNode
          key={id}
          state={s}
          sub={s.subscribers[id]}
          y={subY[id]}
          now={now}
          selected={selected === id}
          onSelect={() => select(id)}
        />
      ))}
    </svg>
  );
}
