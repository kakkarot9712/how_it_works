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

Rough target: one simulator per module, three to five cheaper steps around it. If a step needs a new sim, build the sim first (`add-simulation`).

## Files

```
src/paths/catalog.ts            metadata only (server-safe): paths, modules, steps (slug, title, summary, kind, minutes, sim)
src/paths/content.tsx           path slug → { pool, map, steps: { slug → step module } }
src/paths/<path>/sources.ts     `pool`: every reference the path may cite (official sources only)
src/paths/<path>/map.ts         SystemMapSpec: regions, nodes (each links to a step), wires (polylines)
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
const after = (<>…<Callout title="What this trace simplifies">…</Callout></>);

export function Body() {
  return <Prose>{intro}<Trace spec={trace} />{after}</Prose>;
}
```

- **Sections are JSX constants in reading order** (`intro`, the trace/predictions, `after`), so the file's citation order is the page's order. The test compares `sources` with the first use of each `cite()` in the file.
- `Body` wraps everything in `<Prose>` itself (gloss only walks element trees, not components). `Trace` and `Predict` gloss their own text.
- Every `WriteupSection` cites at least once. Simplifications go in a `Callout` titled "What this … simplifies", described as choices of the page, not as product behaviour.
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

Follow `source-facts`. The pool's references must be official (`officialSources`); each step cites only what it uses; every command/config name shown must be in some cited reference's `covers`. For Kafka, take quotes from the `kafka-facts` skill and add new ones there. The page's References section is rendered by the step page with `scope="page"`.

## System map

Nodes link to the step that explains them. Lay out so wires are straight or route through a gutter (`points` polyline; `labelBelow` for a gutter label). Wires must be true: draw a consumer's Fetch to the **leader**, not to the nearest box. Keep the top-left of each `regions` box clear for its label. The test checks every node's step exists.

## Progress

`useProgress(path)` (localStorage `syswork:path:<slug>`, live across components and tabs, empty on the server). The next-step card in `StepFooter` ("✓ Done · next ›") marks a step done and moves on; `PathStart`, `ModuleList`, `PathOutline` and the map read it.

## Verify

`verify-simulation` checks, plus: `/learn`, `/learn/<path>` and every step return 200 and unknown ones 404 (`src/proxy.ts`); screenshot the path home (`--full`), a trace after `--click='[aria-label="Next hop (→)"]'` with `--hover='[aria-live=polite]'`, a lab with `--click='[aria-label="Your prediction"] button:nth-child(2)'`, and the step at 390 wide.
