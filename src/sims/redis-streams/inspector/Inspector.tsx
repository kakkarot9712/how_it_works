"use client";

import { InspectorEmpty } from "@/components/inspector";
import type { ViewProps } from "@/sims/types";
import { STREAM, type Action, type State } from "../model";
import { ConsumerPanel } from "./ConsumerPanel";
import { GroupPanel } from "./GroupPanel";
import { ProducerPanel } from "./ProducerPanel";
import { StreamPanel } from "./StreamPanel";

/** Routes the selected node id to its panel. Ids: producer/consumer ids, `g:<group>`, and `stream`. */
export function Inspector({ state: s, selected, dispatch, select, now }: ViewProps<State, Action>) {
  if (selected && s.producers[selected]) return <ProducerPanel s={s} id={selected} dispatch={dispatch} />;
  if (selected && s.consumers[selected]) return <ConsumerPanel s={s} id={selected} dispatch={dispatch} />;
  if (selected?.startsWith("g:") && s.groups[selected.slice(2)])
    return <GroupPanel s={s} id={selected.slice(2)} now={now} select={select} />;
  if (selected === STREAM) return <StreamPanel s={s} dispatch={dispatch} />;

  return (
    <InspectorEmpty
      hint="Click any box in the diagram to inspect it and take control: kill or hang a consumer, run XAUTOCLAIM, send a poison entry, or crash Redis."
      nodes={[
        ...s.prodIds.map((id) => ({ id, label: s.producers[id].label })),
        { id: STREAM, label: "stream orders" },
        ...s.groupIds.map((id) => ({ id: `g:${id}`, label: `group ${id}` })),
        ...s.consIds.map((id) => ({ id, label: s.consumers[id].label })),
      ]}
      onSelect={select}
    />
  );
}
