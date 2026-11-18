---
name: add-simulation
description: Build a new interactive simulation (a new technology or concept, e.g. Kafka replication, Redis Streams, Raft, load balancing, isolation levels) end to end - model, scenarios, canvas, inspector controls, lego components, explainer, tests, registration. Use when asked to add or start a new sim or topic.
---

# Add a simulation

Read `docs/architecture.md` first. Start every file from **[templates.md](templates.md)** (skeletons of each file with the props the kits take and the rules the cross-sim tests enforce). You shouldn't need to read another sim end to end; if you find yourself doing that to learn a pattern, add the pattern to templates.md instead. Build all UI from the shared kits: read the `ui-components` skill before writing the canvas or inspector, and the `write-explainer` skill before writing the write-up.

Per-technology facts live in fact skills (`kafka-facts`, …): sourced quotes, config defaults, error codes and log lines. Use them for research, and add what you learn to them (or create `<tech>-facts` for a new technology), so the next sim on that technology starts from verified facts.

## 0. Research before code

A sim is only worth having if it's accurate. Before writing the model:

1. List the real mechanisms to show: components, messages, state, config names and defaults, failure behaviors, log lines and error messages. Note every acronym you'll show (ISR, HW, LSN…): each needs a glossary entry (`glossary` skill).
2. Check each one against official docs or source, following the **`source-facts`** skill (mandatory). Look in the technology's `<tech>-facts` skill first; record anything new there too: pick the version to model, read each official page, and record it in `sources.ts`. Anything the docs don't clearly support is cut, not kept for later. If unsure, ask the owner. Note what you checked.
3. Decide what to simplify (time scale, units, protocol detail). These go in the explainer's "What this simulation simplifies" section.
4. Choose:
   - **Controls** per node (what the user can break or drive). Every node a user would want to poke needs at least one action.
   - **Lego components**: 2 to 4 removable parts whose absence teaches something (e.g. ISR, acks, auto-reconnect, buffer limits).
   - **Settings**: numeric knobs worth exploring (latency, rates, limits, window sizes).
   - **Scenarios**: 5 to 8 curated runs, one lesson each, starting with the happy path, each with a `flow` of where to look (`scenario-flow` skill).

If anything here is a product decision (scope, which mechanisms to include), ask the owner before building.

## 1. Files

```
src/sims/<sim-id>/
  model.ts         State, Event, Action, Settings, Components, defaults, model (SimModel), nodeIds(state)
  scenarios.ts     Scenario<Action, Settings, Components>[], each with a flow (scenario-flow) and optional duration (default 30 s)
  theme.ts         traffic-kind colours (ch-1..4) and status → Tone helpers shared by canvas and inspector
  canvas/
    layout.ts      viewBox size + one box per column + LANE_GAP (packet lanes, checked by lanes.test.ts)
    Canvas.tsx     "use client"; composes nodes, wires and packets from @/components/canvas
    <Kind>Node.tsx one per node type, built on NodeBox (+ Bar, etc.)
  inspector/
    Inspector.tsx  "use client"; routes the selected id to a panel, InspectorEmpty otherwise
    <Kind>Panel.tsx one per node type: InspectorHeader + Sections (Break it, Stats) from @/components/ui
  writeup/
    Explainer.tsx  server; `meta` + Explainer({ simHref }) from @/components/writeup (see write-explainer)
    <Name>Diagram.tsx static SVG figure(s) for the write-up
  walkthroughs.ts  per-scenario walkthroughs for /how-it-works, checked by walkthroughs.test.ts
  sources.ts       version modelled + official references, in first-citation order (source-facts skill)
  index.ts         SimDefinition export (components/settings defs, timeNote, sources)
  model.test.ts    behavior tests per scenario + rewind determinism
```

## 2. Model rules

- Deterministic: `ctx.rng` and `ctx.now` only. State is plain data.
- Moving things (packets, requests, log entries in flight) are state objects with `sentAt` and `arriveAt`. Remove them when their arrival event fires.
- Guard against stale events with epoch or generation counters (see `epoch`, `autoGen`, `restartGen`).
- Narrate with `ctx.log(level, text, { detail, node })`. The headline says what happened; `detail` says why, with real config names. Use real log lines verbatim when the system has them. Rate-limit repeats.
- Settings and components arrive in `params` and are copied into state at `init`.

## 3. Canvas and Inspector

- SVG viewBox about 1160×760. Text uses the SVG type scale only (`text-svg-body` by default, `text-svg-title` for node titles; see the `design-system` skill). Leave the top-left corner empty (zoom controls sit there). Leave packet lanes wide enough for their labels and export `LANE_GAP` from `canvas/layout.ts` (see `ui-components`, Lanes); `lanes.test.ts` enforces it. SVG `<text>` showing an acronym (PEL, AOF, TCP…) needs `<title>{glossaryTitle("PEL")}</title>` inside it; the glossary audit enforces this. Colours come from theme tokens, the tone tables and the sim's `theme.ts` channel map.
- Don't add zoom or pan code: the Player wraps every Canvas in ZoomPan.
- Every clickable node is a `NodeBox` with `id`, `selected` and `onSelect` (it handles the highlight and stops the click from deselecting). Wires and packets take `ends={[a, b]}` node ids, and `model.ts` exports `nodeIds(state)`, so the scenario flow spotlight works (`scenario-flow` skill). Messages in flight are `Packet`s drawn before the nodes; links are `Wire`s (`broken` when cut); processes/hosts are `Boundary`s.
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

The cross-sim tests pick a new sim up automatically from its folder: `sources.test.ts` (source-facts), `flows.test.ts` (each scenario's flow names real nodes and everything fits its duration) and `lanes.test.ts` (packet labels fit their gaps). They need `sources.ts`, an exported `nodeIds` in `model.ts`, `walkthroughs.ts`, and `LANE_GAP` in `canvas/layout.ts`.

## 6. Verify

Run the `verify-simulation` skill: tests, typecheck, lint, build, the design and glossary audits, then screenshots of the scenarios at their key moments. Look at the screenshots and fix overlaps or unreadable text before reporting done.
