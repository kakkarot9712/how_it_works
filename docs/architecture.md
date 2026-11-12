# Architecture

Animation is a view of a simulation, not the other way round. Each sim is a deterministic state machine. The UI draws its state at the current simulated time.

```
Scenario (settings + components + scripted actions)
        │
        ▼
Runtime (src/engine/runtime.ts)
  clock · event heap · seeded RNG · timed actions · snapshots · narration log
        │  model.handle(state, event, ctx) / model.act(state, action, ctx)
        ▼
State (plain data)  ──►  Canvas (SVG, drawn every frame from state + now)
                    ──►  Inspector (controls → dispatch(action))
                    ──►  Narration feed (runtime.log)
                    ──►  Timeline (now, horizon, warn/error markers, seek)
```

## Engine (`src/engine`)

- **Discrete events.** Models schedule events with `ctx.schedule(delayMs, event)`. The runtime pops them in `(time, insertion)` order. Time is simulated milliseconds.
- **Actions** are inputs from the user or the scenario script, placed on the timeline. When an action and an event share an instant, the action runs first.
- **Determinism.** One seed (`SEED = 42` in the player) plus the action list fully decide the run. The RNG is mulberry32 with a single 32-bit state.
- **Snapshots.** Every `snapshotEvery` (250 ms) the runtime `structuredClone`s state, the event heap, RNG state, the action cursor and the log length. `seek(t)` backwards restores the latest snapshot at or before `t` and replays forward. Tests assert that a replay gives an identical state.
- **Branching.** `dispatch(action)` after a rewind drops the user's later actions (the old future) but keeps scripted ones, and resets `horizon`.
- **step()** processes exactly one event or action, for learning step by step.
- **maxDuration** (10 min) caps the clock.

## Model contract (`SimModel<S, E, A, P>`)

```ts
init(params, ctx): S                  // build state, schedule first events, narrate setup
handle(state, event, ctx): void       // mutate state in place, schedule follow-ups
act(state, action, ctx): void         // apply a user/scenario action
```

Rules: state is plain data; no wall-clock or global randomness; no references to UI. Mutate in place (the runtime clones for snapshots).

**Things that move** (packets, messages on the wire) live in state with `sentAt` and `arriveAt`. The Canvas interpolates their position from `now`, so playback speed, pause and scrubbing need no animation library.

**Stale events.** When a connection is closed and reopened, bump an `epoch` counter and carry it on events. Handlers ignore events from an old epoch. Use the same idea for toggles (`autoGen`, `restartGen`).

## Sim definition (`src/sims/types.ts`)

A sim exports a `SimDefinition`:

| Field | Purpose |
| --- | --- |
| `model` | the `SimModel` |
| `defaults` | `{ settings, components }` |
| `settings` | numeric knobs (slider defs). Changing one rebuilds the run |
| `components` | removable lego blocks (boolean). Toggling rebuilds the run |
| `scenarios` | curated runs: title, summary, `watchFor`, partial settings and components, `script` of timed actions, initial `select` |
| `Canvas` | SVG diagram, receives `{ state, now, selected, select, dispatch }` |
| `Inspector` | per-node controls and stats, same props |
| `timeNote` | slow-motion disclosure under the canvas |

The **Player** (`src/player/Player.tsx`) is shared and fills its parent's height:

- header: scenario picker (dropdown + prev/next), summary, "watch for" bullets, "Blocks & settings" drawer toggle, "Link to moment"
- canvas wrapped in **ZoomPan** (`src/player/ZoomPan.tsx`): wheel/pinch zooms around the cursor (50–400%), drag pans, `+`/`-`/`0` keys, on-screen controls. It uses a CSS transform on a wrapper, so sims need no zoom code. A drag never triggers a node click.
- the drawer (over the canvas, left side) holds lego toggles and setting sliders
- timeline: play/pause/step/seek/speed, warn/error markers, slow-motion badge (keyboard: Space, `.`, ←/→)
- right column: inspector (selected node's controls) and narration feed. Narration entries are clickable and jump to that moment.

**Deep links:** `?s=<scenarioId>&t=<ms>` opens a scenario paused at `t`. The "link to this moment" button copies such a link. Links encode scenario and time only, not user actions or overrides.

## Routing and rendering

- Route groups: `(site)` (home, topic pages) renders `SiteHeader`; `(sim)` renders no site header, so the simulator can use the full viewport. Its pages start with `SimNav` (logo, breadcrumb, Simulator / How it works tabs).
- `/[topic]/[sim]` is the simulator only (`h-dvh`). `/[topic]/[sim]/how-it-works` is the server-rendered write-up (`writeups[id].Explainer`) followed by links into each scenario (`?s=<id>`).
- `src/catalog.ts` lists topics and sims (`live` or `planned`). It drives `/`, `/[topic]` and `generateStaticParams`.
- A live sim must be registered in `src/sims/registry.tsx` (client, `next/dynamic` with `ssr: false`, one chunk per sim) and in `src/sims/explainers.tsx` (`writeups`).
- `cacheComponents` is on: the `dynamicParams` segment config is not allowed, and pages read `params` inside `<Suspense>` (instant-navigation rule). Because that streams a 200 before `notFound()` runs, `src/proxy.ts` checks the catalog first and returns a real 404 for unknown topic/sim paths. Update the proxy if you add new route shapes.

## Visual language

Dark console theme. Tokens are in `src/app/globals.css`: `bg`, `panel`, `panel-2`, `line`, `fg`, `fg-muted`, `accent`, `ok`, `warn`, `err`, `ch-1..ch-4` (kinds of traffic, e.g. one per channel or topic). The canvas uses SVG user units (Redis Pub/Sub: 1160×760). Keep body text ≥ 13 units and titles ~18–19 so the default fit is legible at 1280×800. Keep UI overlays (zoom controls) in the canvas's top-left, which layouts should leave empty.

## Planned engine additions

- A shared network helper (latency, jitter, drop rate, partitions) once a second sim needs it. Don't build it speculatively.
- Side-by-side comparison mode: two runtimes, one shared clock, the same scenario intent (e.g. slow consumer in Redis Pub/Sub, Redis Streams and Kafka).
- Mobile layout: stacked panels with the inspector as a bottom sheet (ZoomPan already supports touch drag; add pinch via pointer events).
- Sandbox: more lego blocks per sim, plus add/remove node actions (add a broker, add a replica).
