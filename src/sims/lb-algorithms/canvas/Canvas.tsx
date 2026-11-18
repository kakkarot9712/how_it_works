"use client";

import { Packet, PACKET_LANE as L, Wire } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import type { ViewProps } from "@/sims/types";
import { CLIENTS, LANES, lbNode, SERVER_COUNT, srvNode, type Action, type Packet as PacketState, type State } from "../model";
import { p95Tones, reqColor } from "../theme";
import { BalancerNode } from "./BalancerNode";
import { ClientsNode } from "./ClientsNode";
import { CLI, H, LANE_Y, LB, SRV, SRV_DY, W } from "./layout";
import { ServerNode } from "./ServerNode";

/**
 * Four nginx upstream groups side by side: clients → nginx (one per balancing method) →
 * that group's own copy of api-1..3. Drawing order: wires, packets, then nodes, so
 * packets slide under the cards.
 */
export function Canvas({ state: s, now, selected, select }: ViewProps<State, Action>) {
  const laneY = Object.fromEntries(LANES.map((l, k) => [l, LANE_Y[k]]));
  const tones = p95Tones(s);

  const endpoints = (p: PacketState): [number, number, number, number] => {
    const y = laneY[p.lane];
    switch (p.kind) {
      case "req":
        return [CLI.x + CLI.w, y - L, LB.x, y - L];
      case "fwd":
        return [LB.x + LB.w, y + SRV_DY[p.server!] - L, SRV.x, y + SRV_DY[p.server!] - L];
      case "resp":
      case "rst":
        return [SRV.x, y + SRV_DY[p.server!] + L, LB.x + LB.w, y + SRV_DY[p.server!] + L];
    }
  };
  const packetColor = (p: PacketState) => (p.kind === "rst" ? toneColor.err : p.kind === "resp" ? toneColor.ok : reqColor(p.heavy));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onClick={() => select(null)}
      role="img"
      aria-label="nginx load balancing methods side by side"
    >
      {/* wires */}
      {LANES.map((lane) => (
        <g key={lane}>
          <Wire ends={[CLIENTS, lbNode(lane)]} x1={CLI.x + CLI.w} y1={laneY[lane]} x2={LB.x} y2={laneY[lane]} />
          {Array.from({ length: SERVER_COUNT }, (_, i) => (
            <Wire
              key={i}
              ends={[lbNode(lane), srvNode(lane, i)]}
              faded={s.servers[i].crashed}
              x1={LB.x + LB.w}
              y1={laneY[lane] + SRV_DY[i]}
              x2={SRV.x}
              y2={laneY[lane] + SRV_DY[i]}
            />
          ))}
        </g>
      ))}

      {/* packets in flight, under the cards */}
      {s.packets.map((p) => {
        const [x1, y1, x2, y2] = endpoints(p);
        return (
          <Packet
            key={p.id}
            ends={[p.from, p.to]}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            sentAt={p.sentAt}
            arriveAt={p.arriveAt}
            now={now}
            label={p.label}
            color={packetColor(p)}
          />
        );
      })}

      <ClientsNode state={s} now={now} selected={selected === CLIENTS} onSelect={() => select(CLIENTS)} />

      {LANES.map((lane) => (
        <g key={lane}>
          <BalancerNode
            state={s}
            lane={lane}
            y={laneY[lane]}
            p95Tone={tones[lane]}
            selected={selected === lbNode(lane)}
            onSelect={() => select(lbNode(lane))}
          />
          {Array.from({ length: SERVER_COUNT }, (_, i) => (
            <ServerNode
              key={i}
              state={s}
              lane={lane}
              i={i}
              y={laneY[lane] + SRV_DY[i]}
              now={now}
              selected={selected === srvNode(lane, i)}
              onSelect={() => select(srvNode(lane, i))}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
