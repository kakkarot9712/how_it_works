"use client";

import { InspectorEmpty } from "@/components/inspector";
import type { ViewProps } from "@/sims/types";
import { SERVER, type Action, type State } from "../model";
import { BufferPanel } from "./BufferPanel";
import { PublisherPanel } from "./PublisherPanel";
import { ServerPanel } from "./ServerPanel";
import { SubscriberPanel } from "./SubscriberPanel";

/** Routes the selected node id to its panel. Ids: publisher/subscriber ids, `buf:<sub>`, and `server`. */
export function Inspector({ state: s, selected, dispatch, select, now }: ViewProps<State, Action>) {
  if (selected && s.publishers[selected]) return <PublisherPanel s={s} id={selected} dispatch={dispatch} />;
  if (selected && s.subscribers[selected]) return <SubscriberPanel s={s} id={selected} dispatch={dispatch} />;
  if (selected?.startsWith("buf:") && s.subscribers[selected.slice(4)])
    return <BufferPanel s={s} id={selected.slice(4)} now={now} select={select} />;
  if (selected === SERVER) return <ServerPanel s={s} dispatch={dispatch} />;

  return (
    <InspectorEmpty
      hint="Click any box in the diagram to inspect it and take control: stall a subscriber, cut its network, kill its connection, crash Redis, or publish by hand."
      nodes={[...s.pubIds, SERVER, ...s.subIds].map((id) => ({
        id,
        label: id === SERVER ? "redis-server" : (s.publishers[id]?.label ?? s.subscribers[id]?.label),
      }))}
      onSelect={select}
    />
  );
}
