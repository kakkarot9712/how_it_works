<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# syswork

Interactive, animated simulations of how systems work internally (Redis, Kafka, load balancers, consensus, transactions), to be hosted at `syswork.vikalpg.in`. Users watch a curated scenario, then take control: they stall a consumer, cut a link, crash a node, or pull a building block out entirely, and see what the system does and why.

Audience: engineers who want the real technical details, not a cartoon. It also serves as the owner's showcase project. Accuracy matters more than polish.

## Stack

Next.js 16.4 (App Router, Turbopack, `cacheComponents`), React 19.3, TypeScript, Tailwind CSS 4, Vitest. pnpm. No backend, no database. Deploy target is Vercel.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on :3000 |
| `pnpm test` | Vitest: engine and model behavior tests |
| `pnpm typecheck` | `tsc --noEmit` (run `pnpm next typegen` first if route types are missing) |
| `pnpm lint` | ESLint |
| `pnpm build` | Production build. Must pass before you say a change is done |

## Layout

```
src/
  engine/            deterministic discrete-event runtime (no React)
    types.ts         SimModel, SimContext, LogEntry
    runtime.ts       clock, event heap, seeded RNG, actions, snapshots, seek/rewind
  player/            shared UI shell every sim uses: Player (scenario picker, blocks/settings drawer,
                     inspector, narration), ZoomPan (zoom/pan for any canvas), Timeline
  components/        UI primitives (ui.tsx), Prose, SimCard, SiteHeader, SimNav
  lib/cx.ts          class-name helper, safe in server and client components
  sims/
    types.ts         SimDefinition contract between a sim and the player
    registry.tsx     client map "topic/sim" -> lazy-loaded <Player def=…/>
    explainers.tsx   server map "topic/sim" -> write-up (Explainer + scenario list)
    redis-pubsub/    model.ts, scenarios.ts, Canvas.tsx, Inspector.tsx, Explainer.tsx, index.ts, model.test.ts
  catalog.ts         topics and sims (live or planned): drives home, topic pages, metadata
  app/
    (site)/          site header: /, /[topic]
    (sim)/           no site header, compact SimNav bar:
                     /[topic]/[sim] (simulator, full viewport) and /[topic]/[sim]/how-it-works (write-up)
  proxy.ts           real 404 status for unknown topic/sim URLs (checks the static catalog)
docs/                architecture.md, roadmap.md
.claude/skills/      add-simulation, add-scenario, verify-simulation
```

Read [docs/architecture.md](docs/architecture.md) before touching the engine or adding a sim. [docs/roadmap.md](docs/roadmap.md) holds the plan and the owner's decisions.

## Rules

1. **Models are deterministic.** No `Math.random`, `Date`, `performance.now` or timers inside a model. Use `ctx.rng` and `ctx.now`. State must be plain data (structuredClone-able), because rewind depends on snapshots and replay.
2. **Technically accurate, or labelled.** Every claim in narration, inspector text and explainers must match real behavior: real config names, defaults, log lines, protocol details. Anything the model simplifies goes in the explainer's "What this simulation simplifies" section. Never invent a config option, metric or log line. If you're unsure, check the official docs or source and say what you checked.
3. **Every sim gives the user control.** Every important node gets direct actions in its Inspector (block, slow down, cut network, kill, crash, publish by hand…). Scenarios are a starting point, not a movie.
4. **Lego blocks.** Each sim declares removable `components` (e.g. output buffer limits, auto-reconnect, ISR). Removing one changes the model's behavior and rebuilds the run. Pick blocks whose removal teaches something.
5. **Slow motion is disclosed.** Sims run far slower than reality and scale sizes down (MB→KB). Say so via `timeNote` and in the explainer.
6. **Desktop first, mobile soon.** The player is a 2-column desktop grid today (canvas | inspector + narration), with settings in a drawer. Don't hard-code assumptions that block a stacked mobile layout later: keep panels as separate components, and keep the canvas responsive via its SVG viewBox.
7. **Narration is signal.** Log state changes and lessons, not every packet. Rate-limit repeated warnings (see `softNotedEpoch`, `failNoted` in the Redis model).
8. **Simulator and write-up are separate pages.** The simulator page holds only the interactive player. Long-form text goes in the sim's `Explainer` on `/how-it-works`. Keep in-player text to short, actionable lines (scenario summary, narration, inspector help).
9. **Readable at fit zoom.** SVG text in a canvas should be at least about 13 user units in a ~1160-unit-wide viewBox. Users can zoom (ZoomPan), but the default view must be legible at 1280×800.
10. **Visual language is shared.** Use the theme tokens in `src/app/globals.css` (`ok`, `warn`, `err`, `accent`, `ch-1..ch-4` for traffic kinds). Don't introduce one-off colors.

## Verifying a change

Use the `verify-simulation` skill. In short: `pnpm test && pnpm typecheck && pnpm lint && pnpm build`, then screenshot the affected scenarios with headless Chrome using deep links (`/redis/pub-sub?s=<scenario>&t=<ms>` opens a scenario paused at that moment) at 1280×800 and 1440×900, and look at them.
