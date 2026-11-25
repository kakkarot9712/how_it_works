---
name: add-path-step
description: Build or extend a learning path in syswork - a guided tour of one whole system (Kafka, Kubernetes, serverless…) split into modules and steps, each step in the format that fits it (Explore widget, Trace, Lab with predictions, backed by an existing simulator). Use when asked to add a path, a module, or a step; to turn existing sims into a path; or to change the path pages, system map, progress or step formats.
---

# Learning paths

A path is a tour of one system, easy to hard: `/learn/<path>` (home: system map + modules) and `/learn/<path>/<step>`. Steps are cheap formats around a few expensive simulators. Pick the format by the idea:

| Kind | Use it when | Built from | Cost |
| --- | --- | --- | --- |
| `explore` | One rule with one knob: type an input, see the result (key → partition, quota → throttling) | A small client widget in `src/paths/<path>/widgets/`, real algorithm ported (with test vectors) | Low |
| `trace` | A request crosses several components in order (produce → replicate → ack; `kubectl apply` → API server → etcd → scheduler → kubelet) | `Trace` + a `TraceSpec`: actors, hops, and state shown in each actor's box, lit when a hop changes it | Low |
| `lab` | Something changes over time or fails | `Predict` cards: a situation, 3 answers (one right), an explanation, a deep link `?s=<scenario>&t=<ms>` into a **live simulator** | Low once the sim exists; the sim itself is the `add-simulation` skill |

Rough target: one simulator per module, three to five cheaper steps around it. If a step needs a new sim, build the sim first (`add-simulation`). A full sim costs model + scenarios + flows + inspector + lego blocks + write-up + tests, so a path made only of sims would take a year; keep sims for what changes over time or fails.

## Planning a new path

Do this before writing any step file, and agree it with the owner:

1. **Facts skill first.** Each path's system has a `<system>-facts` skill (`kafka-facts`, `kubernetes-facts`): version, `officialSources`, a page index, verified quotes. Create or extend it as you research; steps take their quotes from it.
2. **Sources decide scope.** If the internals are documented only in papers or talks (e.g. serverless: Firecracker paper), stop and ask the owner how to source it (accept papers per module with an owner `approval`, or frame as "documented platform behaviour + open-source internals"). Never approve an exception yourself.
3. **System map → modules → steps.** Draw the map (boxes = components the path explains), group the boxes into 3 to 6 modules ordered easy to hard, then give each module one idea per step and pick its format with the table above. Name which sims exist, which are `planned` in `src/catalog.ts`, and which are new.
4. **Topic.** `LearningPath.topic` must be a topic in `src/catalog.ts` (add one, possibly with only `planned` sims). Labs need a `live` sim.
5. **Ship hidden.** Set `hidden: true` on the path in `src/paths/catalog.ts` while it is incomplete: it is left out of `paths` in production builds (not listed, URLs 404) but shown under `pnpm dev` for review, and the tests still run over `allPaths`, and map nodes may point at steps not written yet.
6. Glossary entries for every new acronym (`glossary` skill).

Current plan (see `plan.md` and `docs/roadmap.md`): Kafka live (pilot); Kubernetes next (flagship); serverless blocked on the sourcing decision; Redis path wraps the Pub/Sub and Streams sims.

## Files

```
src/paths/catalog.ts            metadata only (server-safe): paths, modules, steps (slug, title, summary, kind, minutes, sim)
src/paths/content.tsx           path slug → { pool, map, steps: { slug → step module } }
src/paths/<path>/sources.ts     `pool`: every reference the path may cite (official sources only)
src/paths/<path>/map.ts         SystemMapSpec: regions, nodes (each links to a step), wires (polylines), connections (who talks to whom)
src/paths/<path>/steps/<slug>.tsx   one file per step; the file name IS the step slug
src/paths/<path>/widgets/       Explore widgets ("use client")
src/paths/paths.test.ts         the enforcement
src/components/path/            kit: PathNav, PathOutline, ModuleList, PathStart, StepFooter, StepKindTag,
                                SystemMapDiagram, Trace (+ TraceDiagram), Predict, useProgress
app/(site)/learn/…              /learn, /learn/[path]
app/(path)/learn/[path]/[step]  step page (PathNav, header, outline rail, Body, StepFooter, References)
```

## A step file

```tsx
export const sources = pickSources(pool, ["design", "protocol"]); // its own refs, in first-citation order
const cite = citer(sources);

const intro = (<WriteupSection id="setup" title="…"><p>…{cite("design")}</p></WriteupSection>);
export const trace: TraceSpec = { … };          // trace steps
export const predictions: Prediction[] = [ … ]; // lab steps (+ export const simHref = "/<topic>/<sim>")
const simplified = simplifier(sources);  // "Simplified here" boxes, placed where the shortcut is
// in a hop: { label: "Produce(acks=-1)", simplified: simplified(["producer-configs"], <>One record. Real producers batch…</>), … }
// under a widget or paragraph: {simplified(["sched-plugins-src"], <>Only CPU and memory…</>)}

export function Body() {
  return <Prose>{intro}<Trace spec={trace} />{after}</Prose>;
}
```

- **Define every word before it is used** (`define-terms` skill): concept terms go in `src/lib/concepts.ts` with a `taught` row for the step that first uses them; the step page shows them in its "New words in this step" box. Run `node .claude/skills/define-terms/candidates.mjs <path>` after writing.
- **Name the actor, don't just say the role.** When a step relies on a concept ("a controller", "a watch"), define it in the intro in plain words with an everyday picture if the docs give one (the thermostat), then name the concrete instance the step uses ("the Deployment controller, inside kube-controller-manager, which scales ReplicaSets") and use that name in the actor label and hop titles. Flag look-alike names that mean something else (admission controllers vs controllers). The owner flagged a bare "controller" as unclear.
- **Sections are JSX constants in reading order** (`intro`, the trace/predictions, `after`), so the file's citation order is the page's order. The test compares `sources` with the first use of each `cite()` in the file.
- `Body` wraps everything in `<Prose>` itself (gloss only walks element trees, not components). `Trace` and `Predict` gloss their own text.
- Every `WriteupSection` cites at least once.
- **Simplifications go where they apply, never in an end-of-page list** (owner request 2026-11-25: readers lost track of which part each item was about). Use `simplified([refIds], <>…</>)` from `simplifier(sources)`: a warn-toned "Simplified here" box with links to the official pages that describe the real behaviour. In a trace, set it on the hop it affects (`simplified` field); under a widget, right after the widget; in a lab, between the intro and the prediction cards (shortened timeouts matter while predicting). Describe the shortcut as a choice of the page ("drawn as one hop", "the numbers are examples"), not as product behaviour. Its ids count as citations in first-use order.
- Register the step in `src/paths/catalog.ts` (metadata) and `src/paths/content.tsx` (`import * as …`).

## Trace rules

- Actors: 3 to 5, short labels (`broker-1`) and a role line (`leader`). Hop labels are real names, short: `Produce(acks=-1)`, `Fetch(offset=1)`, `OffsetCommit(9)`; `from === to` for a step inside one actor (`append @0`). `reply: true` draws dashed.
- 8 to 14 hops. Each has a one-sentence `title` and a 2–4 sentence `body` with citations. Put the lesson in the state: `set` only the cells that hop changes, so they light up in the actor boxes and in the "Changed" line. Each field has a full `label` and a `short` one (≤ 12 characters) that fits the box; keep to 3–4 fields per actor so the trace fits one screen (rows scroll in a ~6-hop window, "Show all hops" expands it).
- Include the counter-intuitive state (e.g. "LEO as the leader knows it" next to the real LEO).

## Lab rules

- 3 or 4 predictions per lab, each on an existing scenario. `t` is just after the moment that settles it: take it from the sim's `walkthroughs.ts` (`moments[].t`, + 200–400 ms). The test checks the scenario exists and `t` is inside its duration.
- Exactly one right option; wrong options are the plausible misconceptions. `setup` says what differs from defaults and any shortened timeout ("Here replica.lag.time.max.ms is 5 s").
- Map the sim folder in `scenariosOf()` in `paths.test.ts` when a lab uses a new sim.

## Sourcing (same rules as the sims)

Follow `source-facts`. The pool's references must be official (`officialSources`); each step cites only what it uses; every command/config name shown must be in some cited reference's `covers`. Take quotes from the path's facts skill (`kafka-facts`, `kubernetes-facts`) and add new ones there. The page's References section is rendered by the step page with `scope="page"`.

## System map

Nodes link to the step that explains them. Lay out so wires are straight or route through a gutter (`points` polyline; `labelBelow` for a gutter label). Wires must be true: draw a consumer's Fetch to the **leader**, not to the nearest box. Keep the top-left of each `regions` box clear for its label. The test checks every node's step exists.

## Who talks to whom (required, owner request 2026-11-25)

Every path's `map.ts` has `connections`, shown under the map on the path home as the "Who talks to whom" table (`ConnectionTable`). One row per link in the system:

- `from` is the side that **opens** the connection or sends the request, `to` the other side. Readers most often get this direction wrong (a Kafka leader never pushes to followers; nothing pushes a Pod to a kubelet), so write it from the opener even when the data flows the other way.
- `call`: the real request or stream names (`Fetch`, `watch Pods, PATCH status`).
- `pattern`: push, pull, long poll, watch, request/response.
- `control`: who decides what over this link, one sentence ("The scheduler decides the node by writing a Binding. It never contacts the node.").
- `step`: the step that explains **and cites** it. The home page has no references, so every row's claim must be cited on that step; if no step covers it yet, add it to one (a "What if…" answer is fine) before adding the row.
- Include the surprising reverse links too (kube-apiserver → kubelet for logs, attach, port-forward).

`paths.test.ts` fails a path with no connections, an empty field, or a row whose step doesn't exist (hidden paths may point at steps not written yet).

## What if… (ambiguous cases, required, owner request 2026-11-25)

When a reader could reasonably ask "and what happens if…?" about a step's mechanism, answer it on the page. The owner finds these cases are what make the mechanism clear. Examples: a partition is added to a topic that a group is reading (rebalance, the `auto.offset.reset=latest` discovery gap, keys that move); there are more consumers than partitions; the API server needs to reach a node; the scheduler finds no node.

- Put them in a `<WriteupSection id="what-if" title="What if…">` after "What to take away", one bold question per paragraph followed by the answer. A step with only one case can name it in the title ("What if a partition is added?").
- Make each answer concrete: say what goes wrong first, with a worked example that reuses the step's own names and numbers ("the last event it got was at 10596… ten minutes later its connection drops… `410 Gone`"), then what fixes it. A bare definition ("BOOKMARK events carry only a resourceVersion") is not an answer; the owner flagged that one as unclear.
- Each answer is cited like any other claim. The official docs often cover exactly these cases in a config's description or a "Note"; search there first. If the docs don't settle a case, leave it out and tell the owner, rather than guessing.
- When a case belongs to another step (the producer side of the same change), give a short pointer to that step instead of repeating it.
- If a case is common enough, add a row or a note to "Who talks to whom" as well.

## Progress

`useProgress(path)` (localStorage `syswork:path:<slug>`, live across components and tabs, empty on the server). The next-step card in `StepFooter` ("✓ Done · next ›") marks a step done and moves on; `PathStart`, `ModuleList`, `PathOutline` and the map read it.

## Design decisions (owner-reviewed; don't undo without asking)

- **Labs link out** to the full-viewport player instead of embedding it: the player owns global keys (Space, ←/→) and would fight page scrolling. Revisit only if a compact embedded player is built.
- **`/learn/...` namespace** keeps every simulator URL stable; static `learn` wins over `[topic]`.
- **One way forward** at the end of a step: the "✓ Done · next" card (marks progress and navigates; finishes the path on the last step) plus a "Previous" card. No duplicate "mark done" button (owner flagged it).
- **A trace fits one 1280×800 screen:** state lives in the actor boxes, not a table below (the owner had to scroll to reach it).
- Path home = hero + fact strip + system map (with a link to the path's Terms page) + "Who talks to whom" table + module list + Start/Continue. Each step opens with its "New words in this step" box.

## Known gaps

- The caps-term regex (`src/lib/source-terms.ts`, shared with the sims' test) skips underscore names like `NOT_ENOUGH_REPLICAS`: cover them in `covers` anyway, but the test won't catch a miss.
- Not verified yet: ←/→ keyboard stepping in a trace (the screenshot tool's key events don't reach the page) and progress sync across tabs. Check by hand in a browser when touching `Trace` or `useProgress`.
- Possible new formats, not built: Compare (side by side on the same input), terminal replay (real CLI output, annotated), a compact embedded player for labs. Adding a kind means `StepKind`/`STEP_KINDS` in the catalog, a kit component, and test rules in `paths.test.ts`.

## Verify

`verify-simulation` checks, plus: `/learn`, `/learn/<path>` and every step return 200 and unknown ones 404 (`src/proxy.ts`); screenshot the path home (`--full`), a trace after `--click='[aria-label="Next hop (→)"]'` with `--hover='[aria-live=polite]'`, a lab with `--click='[aria-label="Your prediction"] button:nth-child(2)'`, and the step at 390 wide.
