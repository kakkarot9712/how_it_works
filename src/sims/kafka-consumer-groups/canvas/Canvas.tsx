"use client";

import { Packet, Wire } from "@/components/canvas";
import type { ViewProps } from "@/sims/types";
import { CONSUMERS, consId, COORD, parseCons, parsePart, partId, PARTITIONS, PRODUCER, type Action, type Packet as P, type State } from "../model";
import { packetColor } from "../theme";
import { ConsumerNode } from "./ConsumerNode";
import { CoordinatorNode } from "./CoordinatorNode";
import { CONS, consCoordY, consFetchY, COORD_BOX, coordPortY, H, LANE, PART, partMidY, PROD, prodPortY, W } from "./layout";
import { PartitionNode } from "./PartitionNode";
import { ProducerNode } from "./ProducerNode";

type Pt = { x: number; y: number };

/** Endpoints of a link between two nodes, as [from, to]. */
function linkEnds(from: string, to: string): [Pt, Pt] {
  const fp = parsePart(from) ?? parsePart(to);
  const fc = parseCons(from) ?? parseCons(to);
  let a: Pt;
  let b: Pt;
  if (from === PRODUCER || to === PRODUCER) {
    a = { x: PROD.x + PROD.w, y: prodPortY(fp!) };
    b = { x: PART.x, y: partMidY(fp!) };
  } else if (fp !== null) {
    a = { x: PART.x + PART.w, y: partMidY(fp) };
    b = { x: CONS.x, y: consFetchY(fc!) };
  } else {
    a = { x: COORD_BOX.x + COORD_BOX.w, y: coordPortY(fc!) };
    b = { x: CONS.x, y: consCoordY(fc!) };
  }
  // a is the producer / partition / coordinator end; flip if the packet goes the other way.
  return from === PRODUCER || to === consId(fc ?? 0) ? [a, b] : [b, a];
}

function laneOffset(p: P): number {
  switch (p.kind) {
    case "produce":
    case "fetch":
    case "hb":
      return LANE.request;
    case "commit":
      return LANE.commit;
    case "commit-resp":
      return LANE.commitResp;
    default:
      return LANE.response;
  }
}

export function Canvas({ state: s, now, selected, select }: ViewProps<State, Action>) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" onClick={() => select(null)} role="img" aria-label="Kafka consumer group: a producer, three partitions, a group coordinator and four consumers">
      {PARTITIONS.map((p) => {
        const [a, b] = linkEnds(PRODUCER, partId(p));
        return <Wire key={`w-prod-${p}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} ends={[PRODUCER, partId(p)]} />;
      })}
      {CONSUMERS.flatMap((c) => {
        const k = s.consumers[c];
        const wires = [];
        const [a, b] = linkEnds(COORD, consId(c));
        wires.push(<Wire key={`w-coord-${c}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} faded={!s.coord.members[c]} ends={[COORD, consId(c)]} />);
        if (k.up && !k.pollTimedOut)
          for (const p of k.owned) {
            const [pa, pb] = linkEnds(partId(p), consId(c));
            wires.push(<Wire key={`w-part-${c}-${p}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} ends={[partId(p), consId(c)]} />);
          }
        return wires;
      })}

      {s.packets.map((p) => {
        const [a, b] = linkEnds(p.from, p.to);
        const off = laneOffset(p);
        return (
          <Packet key={p.id} ends={[p.from, p.to]} x1={a.x} y1={a.y + off} x2={b.x} y2={b.y + off} sentAt={p.sentAt} arriveAt={p.arriveAt} now={now} label={p.label} color={packetColor(p)} />
        );
      })}

      <ProducerNode state={s} selected={selected === PRODUCER} onSelect={() => select(PRODUCER)} />
      {PARTITIONS.map((p) => (
        <PartitionNode key={p} state={s} p={p} selected={selected === partId(p)} onSelect={() => select(partId(p))} />
      ))}
      <CoordinatorNode state={s} now={now} selected={selected === COORD} onSelect={() => select(COORD)} />
      {CONSUMERS.map((c) => (
        <ConsumerNode key={c} state={s} c={c} now={now} selected={selected === consId(c)} onSelect={() => select(consId(c))} />
      ))}
    </svg>
  );
}
