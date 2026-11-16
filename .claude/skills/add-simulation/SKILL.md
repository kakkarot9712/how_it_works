---
name: add-simulation
description: Build a new interactive simulation (a new technology or concept, e.g. Kafka replication, Redis Streams, Raft, load balancing, isolation levels) end to end - model, scenarios, canvas, inspector controls, lego components, explainer, tests, registration. Use when asked to add or start a new sim or topic.
---

# Add a simulation

Read `docs/architecture.md` first. Use `src/sims/redis-pubsub/` as the reference implementation and mirror its file layout. Build all UI from the shared kits: read the `ui-components` skill before writing the canvas or inspector, and the `write-explainer` skill before writing the write-up.

## 0. Research before code

A sim is only worth having if it's accurate. Before writing the model:

1. List the real mechanisms to show: components, messages, state, config names and defaults, failure behaviors, log lines and error messages. Note every acronym you'll show (ISR, HW, LSN…): each needs a glossary entry (`glossary` skill).
2. Check each one against official docs or source (use WebSearch/WebFetch if available). Note what you checked.
3. Decide what to simplify (time scale, units, protocol detail). These go in the explainer's "What this simulation simplifies" section.
4. Choose:
   - **Controls** per node (what the user can break or drive). Every node a user would want to poke needs at least one action.
   - **Lego components**: 2 to 4 removable parts whose absence teaches something (e.g. ISR, acks, auto-reconnect, buffer limits).
   - **Settings**: numeric knobs worth exploring (latency, rates, limits, window sizes).
   - **Scenarios**: 5 to 8 curated runs, one lesson each, starting with the happy path.

If anything here is a product decision (scope, which mechanisms to include), ask the owner before building.

## 1. Files

```
src/sims/<sim-id>/
  model.ts         State, Event, Action, Settings, Components, defaults, model (SimModel)
  scenarios.ts     Scenario<Action, Settings, Components>[]
  theme.ts         traffic-kind colours (ch-1..4) and status → Tone helpers shared by canvas and inspector
  canvas/
    layout.ts      viewBox size + one box per column
    Canvas.tsx     "use client"; composes nodes, wires and packets from @/components/canvas
    <Kind>Node.tsx one per node type, built on NodeBox (+ Bar, etc.)
  inspector/
    Inspector.tsx  "use client"; routes the selected id to a panel, InspectorEmpty otherwise
    <Kind>Panel.tsx one per node type: InspectorHeader + Sections (Break it, Stats) from @/components/ui
  writeup/
    Explainer.tsx  server; `meta` + Explainer({ simHref }) from @/components/writeup (see write-explainer)
    <Name>Diagram.tsx static SVG figure(s) for the write-up
  walkthroughs.ts  per-scenario walkthroughs for /how-it-works, checked by walkthroughs.test.ts
  index.ts         SimDefinition export (components/settings defs, timeNote)
  model.test.ts    behavior tests per scenario + rewind determinism
```

## 2. Model rules

- Deterministic: `ctx.rng` and `ctx.now` only. State is plain data.
- Moving things (packets, requests, log entries in flight) are state objects with `sentAt` and `arriveAt`. Remove them when their arrival event fires.
- Guard against stale events with epoch or generation counters (see `epoch`, `autoGen`, `restartGen`).
- Narrate with `ctx.log(level, text, { detail, node })`. The headline says what happened; `detail` says why, with real config names. Use real log lines verbatim when the system has them. Rate-limit repeats.
- Settings and components arrive in `params` and are copied into state at `init`.

## 3. Canvas and Inspector

- SVG viewBox about 1160×760. Text uses the SVG type scale only (`text-svg-body` by default, `text-svg-title` for node titles; see the `design-system` skill). Leave the top-left corner empty (zoom controls sit there). Colours come from theme tokens, the tone tables and the sim's `theme.ts` channel map.
- Don't add zoom or pan code: the Player wraps every Canvas in ZoomPan.
- Every clickable node is a `NodeBox` with `selected` and `onSelect` (it handles the highlight and stops the click from deselecting). Messages in flight are `Packet`s drawn before the nodes; links are `Wire`s (`broken` when cut); processes/hosts are `Boundary`s.
- Show the state that carries the lesson: `Bar`s with limit markers, timers counting up, status text in tone colours.
- Inspector: one panel per node type: `InspectorHeader`, a "Break it" `Section` of controls, a "Stats" `Section` (`StatGrid`), and a short `Help` note. With nothing selected, `InspectorEmpty`.
- If you need something the kits don't have and a second sim would want it too, add it to the kit (see `ui-components`), not to the sim.

## 4. Register

1. `src/catalog.ts`: add or flip the entry to `status: "live"` (the slug must match the route).
2. `src/sims/registry.tsx`: add `"<topic>/<slug>": dynamic(() => import("./<sim-id>").then(...), { ssr: false, loading })`.
3. `src/sims/explainers.tsx`: add `writeups["<topic>/<slug>"] = { ...meta, Explainer, scenarios, walkthroughs }`. This enables `/<topic>/<slug>/how-it-works`.
4. `src/proxy.ts` reads the catalog, so no change is needed unless you add a new route shape.
5. Mention the sim in `docs/roadmap.md`.

## 5. Tests (required)

In `model.test.ts`, run each scenario with `new Runtime(model, params, { seed: 42, script })` and assert its lesson actually happens (e.g. "client is closed by the hard limit", "PUBLISH returns 0"). Also:

- the happy path produces no warn or error logs,
- every scenario rewinds and replays to an identical state (copy the loop from `redis-pubsub/model.test.ts`).

Also `walkthroughs.test.ts` (copy from redis-pubsub): every scenario has a walkthrough and every timed moment matches the narration.

## 6. Verify

Run the `verify-simulation` skill: tests, typecheck, lint, build, the design and glossary audits, then screenshots of the scenarios at their key moments. Look at the screenshots and fix overlaps or unreadable text before reporting done.
