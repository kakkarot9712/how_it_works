"use client";

import { InspectorEmpty } from "@/components/inspector";
import type { ViewProps } from "@/sims/types";
import { CONSUMERS, consId, COORD, parseCons, parsePart, partId, PARTITIONS, PRODUCER, type Action, type State } from "../model";
import { ConsumerPanel } from "./ConsumerPanel";
import { CoordinatorPanel } from "./CoordinatorPanel";
import { PartitionPanel } from "./PartitionPanel";
import { ProducerPanel } from "./ProducerPanel";

/** Routes the selected id to its panel: `producer`, `orders-N`, `coordinator`, `consumer-N`. */
export function Inspector({ state: s, selected, dispatch, select, now }: ViewProps<State, Action>) {
  if (selected === PRODUCER) return <ProducerPanel s={s} dispatch={dispatch} />;
  if (selected === COORD) return <CoordinatorPanel s={s} now={now} />;
  const p = parsePart(selected);
  if (p !== null) return <PartitionPanel s={s} p={p} dispatch={dispatch} />;
  const c = parseCons(selected);
  if (c !== null) return <ConsumerPanel s={s} c={c} now={now} dispatch={dispatch} />;
  return (
    <InspectorEmpty
      hint="Click any box to inspect it and take control: start, crash or slow down a consumer, send a burst or a poison record, and watch lag, commits and rebalances."
      nodes={[
        { id: PRODUCER, label: "producer" },
        ...PARTITIONS.map((x) => ({ id: partId(x), label: partId(x) })),
        { id: COORD, label: "coordinator" },
        ...CONSUMERS.map((x) => ({ id: consId(x), label: consId(x) })),
      ]}
      onSelect={select}
    />
  );
}
