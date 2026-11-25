# Plan: learning paths

Working notes for the site's move from "a grid of simulators" to **learning paths**. Read this first when picking the work up again. The durable decisions also live in `docs/roadmap.md` (owner decisions) and `docs/architecture.md` (how it is built); the recipe for adding steps is the `add-path-step` skill.

## Why (owner's direction, 2026-11-23)

The site used to pick one corner of a technology (Redis → Pub/Sub, Streams) and simulate it. The owner wants direction: **explore a whole technology or concept step by step**, e.g. Kubernetes as a whole first, then its components (etcd, kubelet, scheduler…), or "how serverless functions work under the hood", from easy concepts to hard. Simulators stay where they are the right tool, but other formats are used where they fit better.

Key constraint that shaped the design: a full simulator is expensive (model, scenarios, flows, inspector, lego blocks, write-up, tests). A path made only of simulators would take a year per system. So a path is **mostly cheap step formats around a few simulators**: rough target one simulator per module, three to five cheaper steps around it.

## Concepts

```
Path      Kafka, from one record to a consumer group         /learn/kafka
 └ Module The log · Replication and durability · Consumers
    └ Step one idea, one format, 5–15 min                     /learn/kafka/<step>
```

- **Path home** = hero + fact strip + **system map** (clickable architecture diagram; each box opens the step that explains it, ✓ when done) + module list + Start/Continue.
- **Step formats** (`StepKind` in `src/paths/catalog.ts`):
  - `explore`: one knob, instant result (a small client widget running the real algorithm).
  - `trace`: one request hop by hop. Sequence diagram; each actor's state is shown in its header box and lights up when a hop changes it; a short scrolling rows window keeps the current hop centred so the whole trace fits one 1280×800 screen; "Show all hops" expands; a "Changed" line says the change in words.
  - `lab`: "predict, then run". Cards with a situation, three answers (one right), an explanation shown after answering, and a deep link that opens a live simulator at the moment that settles it (`?s=<scenario>&t=<ms>`).
- **Progress**: per browser, localStorage (`syswork:path:<slug>`), no backend. Shared live across components and tabs.
- **Sourcing**: same rules as the sims (`source-facts` skill). Each path has a reference pool; each step picks only the references it cites with `pickSources(pool, ids)`, so its [n] numbering starts at 1 and follows first use.

## What is built (Kafka pilot)

Kafka was chosen as the pilot because its two hardest steps already existed as simulators (produce & replicate, consumer groups), so the pilot only needed the cheap formats and the path shell.

| Module | Step | Kind | Notes |
| --- | --- | --- | --- |
| The log | Keys, partitions and offsets (`topics-and-partitions`) | explore | `KeyPartitioner` widget runs Kafka's murmur2 (port in `src/lib/murmur2.ts`, test vectors in the consumer-groups model tests). "+ Add a partition" lists every key that moved (`orders-1 → orders-0`, how many old records stayed behind, "history split" once new records land), a "4 partitions →" marker shows where new records start in each log, and clicking a key lights its records everywhere |
| The log | Follow one record (`one-record`) | trace | 13 hops: Produce(acks=-1) → leader append → followers' parked fetches answered → follower appends → Fetch(offset=1) tells the leader → HW moves → ack (base_offset) → followers learn HW → consumer fetch. State: LEO, "leader sees", HW, consumer position |
| Replication | Break replication (`replication-lab`) | lab | 4 predictions on `/kafka/produce-and-replicate`: slow follower (ISR shrink), acks=1 loss, acks=all no loss, min.insync.replicas=2 refuses writes |
| Consumers | Poll, process, commit (`consume-and-commit`) | trace | 14 hops on the consumer protocol: fetch, position moves, process, OffsetCommit → `__consumer_offsets`, crash mid-batch, session timeout, reassignment in heartbeat response, OffsetFetch → committed=9, reprocessing (at-least-once) |
| Consumers | Break a consumer group (`groups-lab`) | lab | 4 predictions on `/kafka/consumer-groups`: 4th consumer idle, crash → duplicates, commit-before → loss, hot key |

Site changes: home leads with "Learning paths" (CTA "Start the Kafka path"), simulators listed below; header nav "Paths · Simulators"; `/kafka` topic page shows the path card; `/learn` lists paths.

## Where things are

```
src/paths/catalog.ts              paths → modules → steps (metadata, server-safe; proxy and pages use it)
src/paths/content.tsx             path → { pool, map, steps: slug → step module }
src/paths/kafka/sources.ts        reference pool (official Kafka docs, 4.4.0 source, KIPs)
src/paths/kafka/map.ts            SystemMapSpec (regions, nodes → steps, polyline wires)
src/paths/kafka/steps/<slug>.tsx  Body + sources (+ trace | predictions, simHref)
src/paths/kafka/widgets/          KeyPartitioner
src/paths/paths.test.ts           enforcement (below)
src/components/path/              PathNav, PathOutline, ModuleList, PathStart, StepFooter, StepKindTag,
                                  SystemMapDiagram, Trace + TraceDiagram + trace.ts, Predict, useProgress
src/app/(site)/learn/             /learn, /learn/[path]
src/app/(path)/learn/[path]/[step]/  step page (PathNav, header, outline rail, Body, StepFooter, References scope="page")
src/proxy.ts                      real 404s for unknown /learn URLs
src/lib/sources.ts                pickSources(); src/lib/source-terms.ts (term finder shared by both sources tests)
.claude/skills/add-path-step/     how to add a path/module/step
```

Small shared changes: `Heading` accepts `as="span"`; `References` has `scope="page"`; murmur2 moved to `src/lib/murmur2.ts` (the consumer-groups model re-exports it); `shot.mjs` accepts several clicks (`--click='a;;b;;c'`).

## Enforcement (`src/paths/paths.test.ts`)

- Catalog and content agree; labs point at live sims; every map node opens a real step.
- Pool references are official; each step cites ≥ 1 source, its references equal its first-use citation order, every `WriteupSection` cites, every command/config name shown is covered.
- Traces: hop actors exist, `set` only touches known actors/fields, short field labels ≤ 12 chars.
- Labs: every prediction's scenario exists, `t` is inside its run, exactly one right answer. (Map new sim folders in `scenariosOf()`.)

Known limitation (pre-existing, also in the sims' test): the caps-term regex skips underscore names like `NOT_ENOUGH_REPLICAS`; they are covered anyway but not checked.

## Sources checked for the path (2026-11-24)

Facts beyond the existing `kafka-facts` skill were read on the official pages and added there: adding partitions moves keys and Kafka does not redistribute data (ops "Modifying topics"); offsets are increasing integers unique to a partition (implementation/log); topics are partitioned into buckets on brokers (intro); OffsetCommit fields, OffsetFetch, NOT_COORDINATOR (protocol); coordinator state per `__consumer_offsets` partition (KIP-848); `max.poll.records`, `fetch.max.wait.ms`, `enable.auto.commit`, `auto.commit.interval.ms` (consumer configs). No official sentence says "no order across partitions", so the text only says the guarantee is per partition.

## Design decisions and why

- **Labs link out instead of embedding the player.** The player is full-viewport and owns global keys (Space, ←/→); inline it would fight page scrolling. Revisit if a compact embedded player is built.
- **`/learn/...` namespace.** Keeps every existing simulator URL; static `learn` wins over `[topic]`.
- **Step content is a server component per file, sections as JSX constants in reading order**, so file citation order = page order (what the test checks) and `gloss()` can walk the element tree.
- **One way forward at the end of a step:** a "✓ Done · next" card that marks progress and navigates (finishes the path on the last step), plus a "Previous" card. (Earlier version had a duplicate button + card; owner flagged it.)
- **Trace fits one screen:** state lives in actor boxes rather than a separate table below (owner had to scroll to reach the table).

## Verification done

`pnpm test` (244 tests incl. 28 path tests), `pnpm typecheck`, `pnpm lint`, `pnpm build`, design-system and glossary audits all pass. Screenshots checked: home, path home (full page), each step type at 1280×800 / 1440×900, an answered prediction, the widget after send → add partition → send, both traces mid-way with the whole trace on screen, step footer on desktop and 390 wide, status codes (200 for real `/learn` URLs, 404 for unknown). Not verified: ←/→ keyboard stepping in a trace (the screenshot tool's key events didn't reach the page; buttons and row clicks work), progress sync across tabs.

## Next

1. **Owner review of the Kafka pilot** in the browser (feel of the formats, copy, pacing).
2. **Kubernetes path (flagship).** System map; `kubectl apply` end to end (Trace); API server objects and watches (Trace/Explore); etcd and Raft (Lab, reuses the planned Raft sim); controllers and reconcile loops (Lab); scheduler filter/score (Explore + Lab); kubelet, CRI, eviction (Trace + Lab); Services and networking (Trace); failure and recovery (Lab). Needs: a Kubernetes reference pool (kubernetes.io docs, source), new sims, glossary entries.
3. **Serverless path.** Blocked on an owner decision about sources: much of the internals is documented only in papers and talks (e.g. the Firecracker paper), not official docs. Options: accept peer-reviewed papers per module, or frame as "documented behaviour of the platform + internals of open-source Firecracker/Knative".
4. **Redis path** wrapping the Pub/Sub and Streams sims with intro steps.
5. Possible new formats: Compare (side by side on the same input), terminal replay (real CLI output, annotated); maybe a compact embedded player for labs.
6. Remaining roadmap items unchanged: Raft sim, consistent hashing, mobile player layout, deployment to Vercel.
