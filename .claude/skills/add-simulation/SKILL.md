---
name: add-simulation
description: Build a new interactive simulation (a new technology or concept, e.g. Kafka replication, Redis Streams, Raft, load balancing, isolation levels) end to end - model, scenarios, canvas, inspector controls, lego components, explainer, tests, registration. Use when asked to add or start a new sim or topic.
---

# Add a simulation

Read `docs/architecture.md` first. Use `src/sims/redis-pubsub/` as the reference implementation and mirror its file layout.

## 0. Research before code

A sim is only worth having if it's accurate. Before writing the model:

1. List the real mechanisms to show: components, messages, state, config names and defaults, failure behaviors, log lines and error messages.
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
  Canvas.tsx       "use client"; SVG diagram from state + now
  Inspector.tsx    "use client"; controls + stats for the selected node
  Explainer.tsx    server component, long-form text inside <Prose> (shown on /how-it-works)
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

- SVG viewBox about 1160×760. Body text ≥ 13 units, titles ~18–19. Leave the top-left corner empty (zoom controls sit there). Use theme tokens (`fill-fg`, `stroke-line`, `var(--color-ch-1)` …) only.
- Don't add zoom or pan code: the Player wraps every Canvas in ZoomPan.
- Every clickable node: `onClick={(e) => (e.stopPropagation(), select(id))}`, and a highlight stroke when selected.
- Show the state that carries the lesson (queue depth bars with limit markers, timers counting up, status pills).
- Inspector: a "Break it" section of controls, a "Stats" section, and a short "what this is" note. With nothing selected, show quick-select buttons.

## 4. Register

1. `src/catalog.ts`: add or flip the entry to `status: "live"` (the slug must match the route).
2. `src/sims/registry.tsx`: add `"<topic>/<slug>": dynamic(() => import("./<sim-id>").then(...), { ssr: false, loading })`.
3. `src/sims/explainers.tsx`: add `writeups["<topic>/<slug>"] = { Explainer, scenarios }`. This enables `/<topic>/<slug>/how-it-works`.
4. `src/proxy.ts` reads the catalog, so no change is needed unless you add a new route shape.
5. Mention the sim in `docs/roadmap.md`.

## 5. Tests (required)

In `model.test.ts`, run each scenario with `new Runtime(model, params, { seed: 42, script })` and assert its lesson actually happens (e.g. "client is closed by the hard limit", "PUBLISH returns 0"). Also:

- the happy path produces no warn or error logs,
- every scenario rewinds and replays to an identical state (copy the loop from `redis-pubsub/model.test.ts`).

## 6. Verify

Run the `verify-simulation` skill: tests, typecheck, lint, build, then screenshots of the scenarios at their key moments. Look at the screenshots and fix overlaps or unreadable text before reporting done.
