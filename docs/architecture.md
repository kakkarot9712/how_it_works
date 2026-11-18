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
| `settings` | numeric knobs (slider defs, or a one-of-few `choices` list such as isolation levels). Changing one rebuilds the run |
| `components` | removable lego blocks (boolean). Toggling rebuilds the run |
| `scenarios` | curated runs: title, summary, `watchFor`, partial settings and components, `script` of timed actions, initial `select`, and `flow`: timed steps naming the nodes to follow, with a note each |
| `nodeIds` | every node id the canvas draws, so tests can check flow steps |
| `Canvas` | SVG diagram, receives `{ state, now, selected, select, dispatch }` |
| `Inspector` | per-node controls and stats, same props |
| `timeNote` | slow-motion disclosure under the canvas |

The **Player** (`src/player/`) is shared and fills its parent's height. `Player.tsx` composes `useSimulation` (scenario, overrides, Runtime, animation loop), `useShortcuts`, `ScenarioBar`/`ScenarioPicker`, `BlocksDrawer`, `LogFeed`, `Timeline` and `ZoomPan`; `url.ts` owns the deep-link format:

- header, one row: scenario picker (dropdown + prev/next), ⓘ popover with the summary and "what to look for" (`ScenarioInfo`), "Blocks & settings" drawer toggle, "Link to moment". Text stays off the page so the canvas gets the height
- Watch strip (`FlowBar`): the scenario's flow steps, the current note and the Spotlight switch. While it is on, `FocusProvider` gives the canvas kit the step's node ids: `NodeBox` (by `id`) haloes them, `Wire`/`Packet` (by `ends`) light the links and messages between them, and everything else dims. The selected node always stays lit. The strip can be hidden (✕ or `H`, remembered per browser); a "Watch n/m" toolbar button brings it back, and the spotlight pauses while it is hidden
- canvas wrapped in **ZoomPan** (`src/player/ZoomPan.tsx`): wheel/pinch zooms around the cursor (50–400%), drag pans, `+`/`-`/`0` keys, on-screen controls. It uses a CSS transform on a wrapper, so sims need no zoom code. A drag never triggers a node click.
- the drawer (over the canvas, left side) holds lego toggles and setting sliders
- timeline: play/pause/step/seek/speed, warn/error markers, slow-motion and version hint chips (keyboard: Space, `.`, ←/→; `F` spotlight, `H` Watch strip, `[`/`]` scenarios)
- right column: inspector (selected node's controls) and narration feed. Narration entries are clickable and jump to that moment.

**Run length:** every scenario has a fixed `duration` (default `DEFAULT_DURATION_MS`, 30 s), passed to the Runtime as `maxDuration`. Playback loops there: the last frame holds for 1.5 s, then the run restarts from 0 and keeps playing (paused at the end, Play becomes Replay), seeking and deep links clamp to it, and the timeline spans exactly that, with tick spacing chosen for 3 to 7 labels. `flows.test.ts` fails if a script action, flow step or walkthrough moment falls past it.

**Deep links:** `?s=<scenarioId>&t=<ms>` opens a scenario paused at `t`. The "link to this moment" button copies such a link. Links encode scenario and time only, not user actions or overrides. `useSimulation` reads them with `useSearchParams()` and follows changes while mounted, because `cacheComponents` keeps visited routes alive (a write-up "Run it" link back into an open simulator changes the query without remounting). The player's own scenario switch uses `history.replaceState`, which the same hook sees as no change.

## Routing and rendering

- Route groups: `(site)` (home, topic pages) renders `SiteHeader`; `(sim)` renders no site header, so the simulator can use the full viewport. Its pages start with `SimNav` (logo, breadcrumb, Simulator / How it works tabs).
- `/[topic]/[sim]` is the simulator only (`h-dvh`). `/[topic]/[sim]/how-it-works` is the server-rendered write-up: a header from `writeups[id]` (title, lede, key facts, link to the simulator), a sticky contents list built from `sections` (`Toc`, wide screens only), the sim's `Explainer`, then a step-by-step walkthrough of every scenario (`walkthroughs.ts`, rendered by `ScenarioWalkthrough`), where each moment links to `?s=<id>&t=<ms>`. `walkthroughs.test.ts` keeps their times and claims in sync with the model's narration. The page shell uses `WriteupHero`, `WriteupGrid` + `Toc` and `ScenarioWalkthroughs`; a sim's Explainer composes `Prose`, `WriteupSection`, `Figure`, `Callout`, `AnnotatedConfig`, `Compare` and `TryIt` (all from `src/components/writeup/`).
- `src/catalog.ts` lists topics and sims (`live` or `planned`). It drives `/`, `/[topic]` and `generateStaticParams`.
- A live sim must be registered in `src/sims/registry.tsx` (client, `next/dynamic` with `ssr: false`, one chunk per sim) and in `src/sims/explainers.tsx` (`writeups`).
- `cacheComponents` is on: the `dynamicParams` segment config is not allowed, and pages read `params` inside `<Suspense>` (instant-navigation rule). Because that streams a 200 before `notFound()` runs, `src/proxy.ts` checks the catalog first and returns a real 404 for unknown topic/sim paths. Update the proxy if you add new route shapes.

## Components

UI is built from shared kits in `src/components/` (details and conventions in the `ui-components` skill):

- `ui/`: primitives (Button, LinkButton, Toggle, Slider, Stat/StatGrid, Section, Pill, Tag, Eyebrow, Help), `Tooltip` (the one explanatory tooltip; `Term`, `Pill tip` and `Tag tip` use it) and the **tone** tables (`ok`/`warn`/`err`/`accent`/`muted` → text, badge, border, SVG fill, CSS colour). State colours always go through a tone.
- `canvas/`: SVG building blocks for sim diagrams: NodeBox, Packet, Bar, Boundary, Wire, `rows()`; the flow spotlight (`FocusProvider`, `useFocus`); packet lane sizes (`packetWidth`, `PACKET_LANE`, `LANE_MARGIN`). Each sim's `canvas/layout.ts` exports `LANE_GAP`, checked by `lanes.test.ts`.
- `inspector/`: InspectorHeader, InspectorEmpty, ConfigLine.
- `writeup/`: everything on `/how-it-works`, including `Cite`/`citer` and `References` (source-facts skill).
- `site/`: Logo, SiteHeader, SimNav, SimCard, SimGrid.

A sim keeps its own UI in `canvas/` (one file per node type), `inspector/` (one panel per node type) and `writeup/`, plus `theme.ts` for its traffic colours and status helpers.

## Visual language

Dark console theme, defined as design tokens in `src/app/globals.css` and documented in the `design-system` skill:

- **Colour roles:** surfaces `bg` → `panel` → `panel-2`, plus `line`, `fg`, `fg-muted`. `accent` means interactive or selected; `ok`/`warn`/`err` are state, always used through the tone tables; `ch-1..ch-4` are kinds of traffic.
- **Type:** two scales. HTML: `2xs` 11, `xs` 12, `note` 13, `sm` 14, `body` 15, `base` 16, then headings. SVG, in viewBox units: `svg-caption` 12.5, `svg-body` 13.5, `svg-strong` 15.5, `svg-title` 19, `svg-display` 22.
- **Everything else:** radius by role, two elevations (`shadow-popover`, `shadow-drawer`), five z-layers, one global `:focus-visible` ring, and the `scrollbar-thin` utility.

`.claude/skills/design-system/audit.mjs` flags anything off-scale. The canvas uses SVG user units (both Redis sims: 1160×760) and must be legible at fit on 1280×800. Keep UI overlays (zoom controls) in the canvas's top-left, which layouts should leave empty.

## Planned engine additions

- A shared network helper (latency, jitter, drop rate, partitions) once a second sim needs it. Don't build it speculatively.
- Side-by-side comparison mode: two runtimes, one shared clock, the same scenario intent (e.g. slow consumer in Redis Pub/Sub, Redis Streams and Kafka).
- Mobile layout: stacked panels with the inspector as a bottom sheet (ZoomPan already supports touch drag; add pinch via pointer events).
- Sandbox: more lego blocks per sim, plus add/remove node actions (add a broker, add a replica).
