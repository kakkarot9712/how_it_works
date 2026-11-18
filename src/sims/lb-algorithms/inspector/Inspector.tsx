"use client";

import { InspectorEmpty } from "@/components/inspector";
import type { ViewProps } from "@/sims/types";
import { CLIENTS, LANE_INFO, LANES, lbNode, parseSrvNode, srvNode, type Action, type LaneId, type State } from "../model";
import { BalancerPanel } from "./BalancerPanel";
import { ClientsPanel } from "./ClientsPanel";
import { ServerPanel } from "./ServerPanel";

/** Routes the selected node id to its panel: `clients`, `lb:<method>`, `<method>:api-N`. */
export function Inspector({ state: s, selected, dispatch, select, now }: ViewProps<State, Action>) {
  if (selected === CLIENTS) return <ClientsPanel s={s} dispatch={dispatch} />;
  const lane = selected?.startsWith("lb:") ? (selected.slice(3) as LaneId) : null;
  if (lane && LANES.includes(lane)) return <BalancerPanel s={s} lane={lane} now={now} select={select} />;
  const srv = selected ? parseSrvNode(selected) : null;
  if (srv) return <ServerPanel s={s} lane={srv.lane} i={srv.i} now={now} dispatch={dispatch} />;

  return (
    <InspectorEmpty
      hint="Click any box to inspect it and take control: slow a server down, make it hang, crash it, or send a burst of heavy requests. Server actions hit that server in all four groups."
      nodes={[
        { id: CLIENTS, label: "clients" },
        ...LANES.map((l) => ({ id: lbNode(l), label: `nginx: ${LANE_INFO[l].title}` })),
        ...[0, 1, 2].map((i) => ({ id: srvNode("rr", i), label: `api-${i + 1}` })),
      ]}
      onSelect={select}
    />
  );
}
