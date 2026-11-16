import type { SimDefinition } from "@/sims/types";
import { Canvas } from "./canvas/Canvas";
import { Inspector } from "./inspector/Inspector";
import { defaultComponents, defaultSettings, model, nodeIds, type Action, type Components, type Event, type Settings, type State } from "./model";
import { scenarios } from "./scenarios";
import { sources } from "./sources";

export const redisStreams: SimDefinition<State, Event, Action, Settings, Components> = {
  model,
  defaults: { settings: defaultSettings, components: defaultComponents },
  scenarios,
  Canvas,
  Inspector,
  sources,
  nodeIds,
  timeNote: "Slow motion: a network hop takes ~0.4s here and streams are capped at tens of entries. On a real LAN a hop takes well under a millisecond.",
  components: [
    {
      key: "ack",
      label: "XACK and the PEL",
      help: "Consumers acknowledge each entry. Remove it and they read with NOACK: nothing is pending, and a crash loses what a consumer held.",
    },
    {
      key: "claim",
      label: "XAUTOCLAIM loop",
      help: "Every consumer periodically takes over entries idle longer than min-idle-time. Remove it and a dead consumer's entries stay stuck.",
    },
    {
      key: "deadLetter",
      label: "Dead-letter stream",
      help: "Entries delivered too many times go to orders:dead instead of being processed again. Remove it and a poison entry crashes consumers forever.",
    },
    {
      key: "maxlen",
      label: "MAXLEN trimming",
      help: "XADD … MAXLEN caps the stream. Remove it and the stream grows without limit; keep it and a lagging group can lose unread entries.",
    },
  ],
  settings: [
    { key: "count", label: "COUNT", min: 1, max: 8, step: 1, unit: " entries", help: "Most entries one XREADGROUP returns." },
    { key: "minIdleMs", label: "min-idle-time", min: 2000, max: 20000, step: 500, unit: "ms", help: "How long an entry must sit unacknowledged before XAUTOCLAIM takes it." },
    { key: "maxLen", label: "MAXLEN", min: 6, max: 100, step: 1, unit: " entries", help: "Stream length cap (scaled down from the usual thousands)." },
    { key: "maxDeliveries", label: "Max deliveries", min: 1, max: 6, step: 1, help: "Deliveries before a consumer dead-letters an entry." },
    { key: "latencyMs", label: "Network hop", min: 150, max: 1200, step: 50, unit: "ms", help: "One-way latency (slow motion)." },
  ],
};
