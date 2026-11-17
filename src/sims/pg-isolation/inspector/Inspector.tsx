"use client";

import { InspectorEmpty } from "@/components/inspector";
import type { ViewProps } from "@/sims/types";
import { HEAP, LOCKS, SESSIONS, XACT, type Action, type SessionId, type State } from "../model";
import { BackendPanel } from "./BackendPanel";
import { HeapPanel } from "./HeapPanel";
import { LocksPanel } from "./LocksPanel";
import { SessionPanel } from "./SessionPanel";
import { XactPanel } from "./XactPanel";

const isSession = (id: string | null): id is SessionId => id === "A" || id === "B";

/** Routes the selected node id to its panel. Ids: `A`, `B`, `be:A`, `be:B`, `heap`, `xact`, `locks`. */
export function Inspector({ state: s, selected, dispatch, select, now }: ViewProps<State, Action>) {
  if (isSession(selected)) return <SessionPanel s={s} id={selected} dispatch={dispatch} />;
  if (selected?.startsWith("be:") && isSession(selected.slice(3))) return <BackendPanel s={s} id={selected.slice(3) as SessionId} now={now} dispatch={dispatch} />;
  if (selected === HEAP) return <HeapPanel s={s} />;
  if (selected === XACT) return <XactPanel s={s} />;
  if (selected === LOCKS) return <LocksPanel s={s} now={now} dispatch={dispatch} />;
  return (
    <InspectorEmpty
      hint="Click any box to inspect it and take control: run a transaction in either session, type statements by hand, make an app hang, or cancel and terminate backends."
      nodes={[
        ...SESSIONS.map((id) => ({ id, label: s.sessions[id].label })),
        ...SESSIONS.map((id) => ({ id: `be:${id}`, label: `backend ${s.sessions[id].pid}` })),
        { id: HEAP, label: "table accounts" },
        { id: XACT, label: "pg_xact" },
        { id: LOCKS, label: "locks" },
      ]}
      onSelect={select}
    />
  );
}
