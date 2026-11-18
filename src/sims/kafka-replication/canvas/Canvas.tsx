"use client";

import { Packet, PACKET_LANE as L, Wire } from "@/components/canvas";
import type { ViewProps } from "@/sims/types";
import { BROKERS, brokerNode, CONTROLLER, PRODUCER, type Action, type BrokerId, type Packet as PacketState, type State } from "../model";
import { packetColor } from "../theme";
import { BrokerNode } from "./BrokerNode";
import { ControllerNode } from "./ControllerNode";
import { BRK, BRK_Y, H, laneX, PROD, TAPE_CELLS, W } from "./layout";
import { ProducerNode } from "./ProducerNode";

const yOf = (b: BrokerId) => BRK_Y[b - 1];

/**
 * Producer → leader on the left, the three replicas in the middle, and each follower's
 * fetch lane on the right. Drawing order: wires, packets, then nodes.
 */
export function Canvas({ state: s, now, selected, select }: ViewProps<State, Action>) {
  const right = BRK.x + BRK.w;
  const maxLeo = Math.max(...BROKERS.map((b) => s.brokers[b].log.length));
  const windowStart = Math.max(0, maxLeo - TAPE_CELLS + 2);

  const endpoints = (p: PacketState): [number, number, number, number] => {
    switch (p.kind) {
      case "produce":
        return [PROD.x + PROD.w, yOf(p.lane) - L, BRK.x, yOf(p.lane) - L];
      case "produce-resp":
        return [BRK.x, yOf(p.lane) + L, PROD.x + PROD.w, yOf(p.lane) + L];
      case "fetch":
        return [laneX(p.lane), yOf(p.lane), laneX(p.lane), yOf(p.leader)];
      case "fetch-resp":
        return [laneX(p.lane), yOf(p.leader), laneX(p.lane), yOf(p.lane)];
    }
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onClick={() => select(null)}
      role="img"
      aria-label="Kafka partition replication: producer, three brokers and the controller"
    >
      {/* producer ↔ each broker: lit for the one the producer's metadata names as leader */}
      {BROKERS.map((b) => (
        <Wire
          key={`p${b}`}
          ends={[PRODUCER, brokerNode(b)]}
          faded={s.producer.meta.leader !== b}
          broken={s.brokers[b].cut}
          x1={PROD.x + PROD.w}
          y1={yOf(b)}
          x2={BRK.x}
          y2={yOf(b)}
        />
      ))}

      {/* each follower's fetch lane: out to its lane, along to the leader's row, back in */}
      {BROKERS.map((f) => {
        const leader = s.brokers[f].fetchingFrom;
        if (leader === null || leader === f || s.ctl.leader === f || !s.brokers[f].up) return null;
        const broken = s.brokers[f].cut || s.brokers[leader].cut;
        const faded = !s.brokers[leader].up || s.brokers[f].stalled;
        const x = laneX(f);
        const ends: [string, string] = [brokerNode(f), brokerNode(leader)];
        return (
          <g key={`f${f}`}>
            <Wire ends={ends} faded={faded} x1={right} y1={yOf(f)} x2={x} y2={yOf(f)} />
            <Wire ends={ends} faded={faded} broken={broken} x1={x} y1={yOf(f)} x2={x} y2={yOf(leader)} />
            <Wire ends={ends} faded={faded} x1={x} y1={yOf(leader)} x2={right} y2={yOf(leader)} />
          </g>
        );
      })}

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
            color={packetColor(p.kind, p.error)}
          />
        );
      })}

      <ControllerNode state={s} now={now} selected={selected === CONTROLLER} onSelect={() => select(CONTROLLER)} />
      <ProducerNode state={s} selected={selected === PRODUCER} onSelect={() => select(PRODUCER)} />
      {BROKERS.map((b) => (
        <BrokerNode
          key={b}
          state={s}
          b={b}
          y={yOf(b)}
          now={now}
          windowStart={windowStart}
          selected={selected === brokerNode(b)}
          onSelect={() => select(brokerNode(b))}
        />
      ))}
    </svg>
  );
}
