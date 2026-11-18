"use client";

import { InspectorEmpty } from "@/components/inspector";
import type { ViewProps } from "@/sims/types";
import { BROKERS, brokerLabel, brokerNode, CONTROLLER, parseBrokerNode, PRODUCER, type Action, type State } from "../model";
import { BrokerPanel } from "./BrokerPanel";
import { ControllerPanel } from "./ControllerPanel";
import { ProducerPanel } from "./ProducerPanel";

/** Routes the selected id to its panel: `producer`, `controller`, `broker-N`. */
export function Inspector({ state: s, selected, dispatch, select, now }: ViewProps<State, Action>) {
  if (selected === PRODUCER) return <ProducerPanel s={s} dispatch={dispatch} />;
  if (selected === CONTROLLER) return <ControllerPanel s={s} now={now} dispatch={dispatch} />;
  const b = parseBrokerNode(selected);
  if (b) return <BrokerPanel s={s} b={b} now={now} dispatch={dispatch} />;
  return (
    <InspectorEmpty
      hint="Click any box to inspect it and take control: crash a broker, cut its network, stall its replica fetcher, or change the producer's acks."
      nodes={[{ id: PRODUCER, label: "producer" }, ...BROKERS.map((x) => ({ id: brokerNode(x), label: brokerLabel(x) })), { id: CONTROLLER, label: "controller" }]}
      onSelect={select}
    />
  );
}
