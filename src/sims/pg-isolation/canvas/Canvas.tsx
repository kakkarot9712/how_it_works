"use client";

import { Boundary, Packet, PACKET_LANE as L, Wire } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import type { ViewProps } from "@/sims/types";
import { backendNode, HEAP as HEAP_ID, LOCKS as LOCKS_ID, SESSIONS, XACT as XACT_ID, type Action, type Packet as PacketState, type SessionId, type State } from "../model";
import { SESSION_COLOR } from "../theme";
import { BackendNode } from "./BackendNode";
import { HeapNode } from "./HeapNode";
import { BE, SERVER, SESS, W, WIRE_Y, H } from "./layout";
import { LocksNode } from "./LocksNode";
import { SessionNode } from "./SessionNode";
import { XactNode } from "./XactNode";

/**
 * Two client sessions → the postgres server: one backend process per session, and the
 * shared state they all work on (the table's row versions, pg_xact, the lock table).
 * Drawing order: boundary, wires, packets, then nodes, so packets slide under the cards.
 */
export function Canvas({ state: s, now, selected, select }: ViewProps<State, Action>) {
  const right = SESS.x + SESS.w;
  const sessOf = (p: PacketState): SessionId => (p.kind === "stmt" ? p.from : p.to) as SessionId;
  const endpoints = (p: PacketState): [number, number, number, number] => {
    const y = WIRE_Y[sessOf(p)];
    return p.kind === "stmt" ? [right, y - L, BE.x, y - L] : [BE.x, y + L, right, y + L];
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onClick={() => select(null)}
      role="img"
      aria-label="PostgreSQL transaction isolation simulation"
    >
      <Boundary x={SERVER.x} y={SERVER.y} w={SERVER.w} h={SERVER.h} label="postgres server" />

      {SESSIONS.map((id) => (
        <Wire key={id} ends={[id, backendNode(id)]} broken={!s.sessions[id].connected} x1={right} y1={WIRE_Y[id]} x2={BE.x} y2={WIRE_Y[id]} />
      ))}

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
            color={p.error ? toneColor.err : SESSION_COLOR[sessOf(p)]}
          />
        );
      })}

      {SESSIONS.map((id) => (
        <SessionNode key={id} s={s.sessions[id]} now={now} selected={selected === id} onSelect={() => select(id)} />
      ))}
      {SESSIONS.map((id) => (
        <BackendNode
          key={id}
          s={s.sessions[id]}
          now={now}
          deadlockMs={s.settings.deadlockTimeoutMs}
          selected={selected === backendNode(id)}
          onSelect={() => select(backendNode(id))}
        />
      ))}
      <HeapNode state={s} selected={selected === HEAP_ID} onSelect={() => select(HEAP_ID)} />
      <XactNode state={s} selected={selected === XACT_ID} onSelect={() => select(XACT_ID)} />
      <LocksNode state={s} now={now} selected={selected === LOCKS_ID} onSelect={() => select(LOCKS_ID)} />
    </svg>
  );
}
