import type { SimDefinition } from "@/sims/types";
import { Canvas } from "./canvas/Canvas";
import { Inspector } from "./inspector/Inspector";
import { defaultComponents, defaultSettings, LEVELS, model, nodeIds, type Action, type Components, type Event, type Settings, type State } from "./model";
import { scenarios } from "./scenarios";
import { sources } from "./sources";

export const pgIsolation: SimDefinition<State, Event, Action, Settings, Components> = {
  model,
  defaults: { settings: defaultSettings, components: defaultComponents },
  scenarios,
  Canvas,
  Inspector,
  sources,
  nodeIds,
  timeNote: "Slow motion: a network hop takes ~0.3s here and statements wait seconds apart. On a real server a statement like these takes well under a millisecond.",
  components: [
    {
      key: "retry",
      label: "Retry on 40001 and 40P01",
      help: "The app re-runs the whole transaction after a serialization failure or a deadlock. Remove it and the error reaches the user: that deposit or withdrawal never happens.",
    },
    {
      key: "writeCheck",
      label: "Repeatable Read write check",
      help: "At Repeatable Read, updating a row changed after your snapshot fails with 40001. Remove it and the model lets the UPDATE write on top, as Read Committed does: lost updates come back.",
    },
    {
      key: "ssi",
      label: "SSI (Serializable checks)",
      help: "SIRead locks and rw-conflict tracking. Remove them and SERIALIZABLE is exactly REPEATABLE READ: write skew commits.",
    },
    {
      key: "deadlock",
      label: "Deadlock detector",
      help: "After deadlock_timeout a waiting backend checks for a cycle and aborts itself. Remove it and a deadlock waits forever, holding its locks.",
    },
  ],
  settings: [
    {
      key: "isolation",
      label: "Isolation level",
      min: 0,
      max: 3,
      step: 1,
      choices: [...LEVELS],
      help: "Used by every BEGIN the scripted transactions send. READ UNCOMMITTED behaves like READ COMMITTED.",
    },
    { key: "deadlockTimeoutMs", label: "deadlock_timeout", min: 500, max: 5000, step: 250, unit: "ms", help: "How long a backend waits on a lock before checking for a deadlock (default 1s)." },
    { key: "latencyMs", label: "Network hop", min: 100, max: 1000, step: 50, unit: "ms", help: "One-way latency between app and server (slow motion)." },
  ],
};
