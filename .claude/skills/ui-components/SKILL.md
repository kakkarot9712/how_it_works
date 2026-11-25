---
name: ui-components
description: The syswork component library - which shared component to use for buttons, pills, stats, inspector panels, SVG canvas nodes, packets, bars, write-up blocks and site chrome, where new components go, and the conventions they follow (tones, server vs client, SVG sizes). Use whenever building or changing UI in syswork - a page, the player, or a sim's canvas, inspector or write-up - and before writing any new component.
---

# syswork UI components

All UI is built from five kits plus the player. Which token, size, radius, shadow or state to use is decided by the **`design-system`** skill. This skill says which *component* to use. **Reach for an existing component before writing markup.** If you find yourself copying a class string from another file, that's a missing component: add it to the right kit instead.

```
src/components/
  ui/          primitives            import from "@/components/ui"
  canvas/      SVG building blocks   import from "@/components/canvas"
  inspector/   inspector panels      import from "@/components/inspector"
  writeup/     "How it works" pages  import from "@/components/writeup"
  site/        chrome + catalog      import from "@/components/site"
src/player/    the shared simulator shell (Player and its parts)
src/lib/       cx (class names), format (secs)
```

Each kit has one component per file and an `index.ts` barrel. Import from the barrel, never from a file inside a kit.

## Tones: one palette for state

`Tone = "ok" | "warn" | "err" | "accent" | "muted"`, in `ui/tone.ts`. Every component that colours by state takes a `tone`. When you need the raw value, map through the shared tables. Never hand-write `text-warn` / `var(--color-err)` chains.

| Table | Gives | Use for |
| --- | --- | --- |
| `toneText` | `text-ok`… | HTML text |
| `toneBadge` | border + tint + text | pills, tags |
| `toneBorder` | `border-ok`… | left-border accents (log entries) |
| `toneFill` | `fill-ok`… | SVG text and shapes (class) |
| `toneColor` | `var(--color-ok)`… | SVG `fill`/`stroke` attributes, inline styles |
| `toneSurface` | tinted border + background | asides carrying a tone (TryIt, a warning Callout) |

Traffic kinds (channels, topics, partitions) use `var(--color-ch-1..4)` via a per-sim map in its `theme.ts` (see `redis-pubsub/theme.ts` `CHANNEL_COLOR`). Never add a one-off colour: extend `globals.css` tokens if something is truly new.

Tailwind only generates classes it finds written out in full in the source. Never build a class at runtime (`"fill-" + tone`, `.replace("text-", "fill-")`). Add a lookup table instead.

## ui/: primitives

| Component | Use |
| --- | --- |
| `Button` (`tone`: default, primary, danger, ghost) | Actions. `danger` for "break it" actions (CLIENT KILL, crash). |
| `LinkButton` (`size`: md, lg) | A Next link that looks like a button (calls to action, "▶ Run it"). Server-safe. |
| `buttonClass(tone, className, size)` | Button styling for anything else that must look like one. |
| `Toggle` (`tone="danger"`) | On/off controls with a help line. Label and help are glossed. Client. |
| `Slider` | Numeric knob with value + unit. Label and help are glossed. Client. |
| `Stat`, `StatGrid` (`cols` 2 or 3) | Labelled numbers. Give a `tone` only when the value is a problem or good news. |
| `Section` | Titled block inside a side panel (inspector, drawer). |
| `Pill` (`size` sm/md, `tip`, `tipHeading`) | Status badge: "subscribed", "down", "live". With `tip` it is a hint chip ("slow motion ⓘ") that opens the shared `Tooltip`. |
| `Tag` (`tone`, `mono`, `tip`, `tipFocusable`) | Square label: block changes ("− Output buffer limits"), concept tags. `tip` explains it in the shared `Tooltip` (`tipFocusable={false}` inside a clickable row). |
| `Eyebrow` (`tone`, `size`, `as`) | The only way to write an uppercase label. `md` heads a block ("STATS", "SEE IT HAPPEN"); `sm` labels a value (stat names, node kinds). |
| `Help` | The 13px muted explanation line under controls/stats. |
| `Surface` / `surfaceClass()` (`level` panel/raised, `radius` sm/md/lg/xl, `elevated`, `interactive`, `tone`) | **Every bordered box**: cards, panels, figures, tables, callouts, stats, popovers, tooltips, toolbars, chips. Use `surfaceClass()` on elements Surface can't render (a Next `<Link>`, a positioned popover). Padding and layout stay in `className`. |
| `Heading` (`level` display/title/section/card/panel/item, `as`) | **Every heading.** `level` sets the look, `as` sets the outline (one `h1` per page). |
| `Container` | Page width: `max-w-6xl`, centred, 24px gutter. |
| `PanelHeader` (`actions`, `compact`, `divider`) | The header row of a panel, drawer or menu: content left, actions right. |
| `IconButton` (`label`, `size` sm/md) | A glyph button (✕ − + ⏮). `label` is the tooltip and the accessible name. |
| `SegmentedControl` (`options`, `value`, `onChange`, `format`, `label`, `columns`) | One-of-few choice shown side by side (playback speed), or as a 2-column grid for long labels. A radio group; ←/→ when focused. |
| `Choice` | A labelled one-of-few setting (label, choices, help). The drawer uses it for a `SettingDef` with `choices` (isolation level). |
| `Kbd` | A key in a hint: `<Kbd>↵</Kbd> load`. |
| `Tooltip` (`tip`, `heading`, `as`, `focusable`) | The one explanatory tooltip: hover, focus, tap; portalled. `Term`, `Pill tip` and `Tag tip` are built on it. Use it directly only for a custom trigger. |
| `Term` | An acronym with a hover/focus/tap tooltip from the glossary. Rarely used directly; see below. |
| `gloss(node, opts)`, `Glossed` | Wrap glossary acronyms found in text or an element tree with `Term`s. |

## Acronyms: the glossary

Acronyms get hover tooltips from `src/lib/glossary.ts`. Most text components already run their text through `gloss()`. For custom markup, wrap it in `<Glossed>`; inside a button or link, use `{ focusable: false }`; in SVG `<text>` (canvas nodes, `*Diagram.tsx`), put `<title>{glossaryTitle(term)}</title>` (or `glossaryTitles(text)`) inside it, since SVG can't hold `Term`; the glossary audit fails SVG text that shows a term without one. Plurals ("PELs") match automatically. Adding terms, writing definitions and auditing are covered by the **`glossary`** skill.

## canvas/: SVG building blocks for a sim's diagram

Sizes assume a ~1160-unit-wide viewBox. SVG text uses only the `text-svg-*` scale (caption 12.5, body 13.5, strong 15.5, title 19, display 22); see `design-system`.

| Component | Use |
| --- | --- |
| `NodeBox` | Any clickable node: box + selected highlight + click-to-select (stops propagation so the canvas doesn't deselect). Always pass `id` (the node id `select` uses) so the scenario flow spotlight can halo or dim it. `surface="panel-2"` for nodes nested in a `Boundary`; `alert` for a red outline (crashed); `dim` for closed/inactive. Draw the node's contents as children. |
| `Packet` | A message in flight between two points over `sentAt..arriveAt`. Pass `ends={[p.from, p.to]}` for the spotlight. Its width is `packetWidth(label)`; every pill must fit the gap it crosses with `LANE_MARGIN` each side (see Lanes below). Labels ≤ ~10 chars (gaps between cards are < 100 units; use wire forms like `:2`, `RST`). |
| `Bar` | Fill bar with limit `markers` (soft/hard lines). `value` and markers are 0..1. `track="panel-2"` on `panel` surfaces. |
| `Boundary` | Dashed region (a process, a host, a rack) with a label. `alert` when that process is down. |
| `Wire` | Connection. Prefer straight horizontal wires: size and place cards so both ends share a y (e.g. a tall server card spanning every row it feeds). `curve` (S-curve) only when the ends can't line up and the gap is wide enough (≳ 80 units) for the curve to read as one, `broken` for a cut link (dashed red + ✕), `faded` for inactive. `ends={[a, b]}`: lit when both nodes are in the flow step. |
| `FocusProvider`, `useFocus(ids)`, `UNFOCUSED_OPACITY` | The scenario-flow spotlight (`scenario-flow` skill). The Player provides it; kit components read it. A sim never dims or haloes by hand. |
| `rows(n, top, bottom)` | Evenly spaced row centres for N nodes. |

**Lanes:** the open gap between two cards that packets cross must be at least `packetWidth(widest label) + 2 × LANE_MARGIN` (~130 units for 10-character labels like `XREADGROUP`). Each sim exports `LANE_GAP: Record<packet kind, gap>` from `canvas/layout.ts`, computed from its boxes; `src/sims/lanes.test.ts` runs every scenario and fails if any real label is too wide for its lane. Widen a gap by narrowing cards (reflow their text), not by widening the viewBox (that shrinks all text). Keep pill labels to the command or ID; full commands belong on the card.

**Lane offsets:** a packet never rides on its wire. Put its lane at `±PACKET_LANE` from the wire (half a pill + a highlighted wire's half-width + clear space), and a second lane on the same side at `±PACKET_LANE_2`. Don't hard-code offsets like `- 13`.

**Drawing order:** boundary, then wires, then **packets**, then nodes. Packets go under the cards so a pill slides out of one card and into the next, never covering text.

**A sim canvas is split per node type** (see `src/sims/redis-pubsub/canvas/`):

```
canvas/
  layout.ts            viewBox size + one {x, y, w, h} box per column (W, H, PUB, CORE…)
  Canvas.tsx           "use client": computes row positions and packet endpoints, composes nodes
  <Kind>Node.tsx       one per node type: takes the data it draws, y, now, selected, onSelect
```

## inspector/: building blocks for a sim's Inspector

| Component | Use |
| --- | --- |
| `InspectorHeader` | Node kind, name, and a `status` (usually a `Pill`). |
| `InspectorEmpty` | Nothing selected: a hint and a quick-select button per node. |
| `ConfigLine` | The live config the node runs with, in real syntax (`client-output-buffer-limit pubsub 16kb 8kb 5`). |

A panel is `InspectorHeader`, then `Section`s: **Break it** (Toggle/Slider/Button), **Stats** (`StatGrid` of `Stat`), then a short `Help` saying what the node is. One file per panel, plus an `Inspector.tsx` that routes the selected id to a panel (see `redis-pubsub/inspector/`).

## writeup/: the "How it works" page

The page shell (`app/(sim)/[topic]/[sim]/how-it-works/page.tsx`) uses `WriteupHero`, `WriteupGrid` with `Toc` in its rail, the sim's `Explainer`, and `ScenarioWalkthroughs`. You normally only touch a sim's `Explainer`, which composes:

| Component | Use |
| --- | --- |
| `Prose` | Typography wrapper for the whole Explainer. Its styles skip anything inside `.not-prose`. |
| `WriteupSection` | A top-level section (`id` must match the sim's `meta.sections`). |
| `Figure` | A diagram (inline SVG) with a caption; scrolls sideways on phones. |
| `Callout` (`tone` info/warn) | A key takeaway, a caveat, "What this simulation simplifies". |
| `AnnotatedConfig` | A real config line with each argument labelled. |
| `ServerOutput` | Verbatim output from the system (an error with its DETAIL and HINT, a log line) in a boxed monospace block. |
| `Compare` | Comparison table (this vs alternatives). |
| `TryIt` | "See it happen" links from a paragraph into the scenarios that show it. |
| `Rich` | Renders `` `code` `` and `**bold**` in short data strings (walkthroughs). |
| `citer(sources)` → `cite("id", …)`, `Cite` | Inline Wikipedia-style `[n]` citation after a sentence, linking to the References list. Ids must exist in the sim's `sources.ts` (see `source-facts`). |
| `References` | End-of-page numbered source list plus "Modelled on <version>". Rendered by the page shell, not by a sim. Each entry is `id="ref-<id>"` and highlights via `:target` when a `[n]` is clicked or a `#ref-…` link is opened. |

Writing the content: see the `write-explainer` skill.

## site/: chrome and catalog

`Logo`, `SiteHeader` (site pages), `SimNav` (simulator + write-up pages), `SimCard`, `SimGrid` (a topic's sims as cards), `PathCard` (a learning path as a card).

## path/: learning paths

Import from `@/components/path`. How to write a path or step: the `add-path-step` skill.

| Component | Use |
| --- | --- |
| `PathNav` | Top bar of a step page: logo, path / step breadcrumb, `n/N` with ‹ › links. |
| `PathOutline` | The path's modules and steps as a rail beside a step; current step marked, finished ones ✓. Client. |
| `ModuleList` | A path's modules with numbered step cards (kind, minutes, done). The path home's list. Client. |
| `PathStart` | Start / continue / review button, steps-done count, reset. Client. |
| `StepFooter` | Previous card and one "✓ Done · next" card that marks progress and moves on (finishes the path on the last step). Client. |
| `StepKindTag` | Explore / Trace / Lab tag with its meaning in a tooltip. |
| `SystemMapDiagram` | Clickable SVG map of the whole system from a `SystemMapSpec` (uses `Boundary`); ✓ on finished steps. Client. |
| `Trace` (`TraceSpec`) | Trace step format: sequence diagram (`TraceDiagram`), state in the actor boxes (changed values lit), hop rows in a ~6-hop scrolling window, current hop's explanation and a "Changed" line. Fits one screen. ← → when focused. Client. |
| `Predict` (`Prediction`) | Lab card: question, options (one right), explanation after answering, deep link into the simulator. Client. |
| `useProgress(path)` | Finished steps in localStorage, live across components and tabs. |

## player/: the simulator shell

Shared by every sim. You rarely change it, and a sim never forks it.

| File | Role |
| --- | --- |
| `Player.tsx` | Composes everything below; owns selection, drawer and copy-link state. |
| `useSimulation.ts` | Scenario, overrides, Runtime, play/pause/speed loop, seek/step/dispatch. Reads `?s=`/`?t=` via `useSearchParams()` and follows changes while mounted: `cacheComponents` keeps visited routes alive, so `useState` initializers alone would ignore a new query. |
| `useShortcuts.ts` | Global keys (Space, `.`, ←/→, `[`/`]`). Ignores typing in fields. |
| `url.ts` | Deep links `?s=<scenario>&t=<ms>`: `parseSimQuery` (pure), `writeScenarioUrl`, `momentUrl`. Never read `window.location` for the query. |
| `ScenarioBar.tsx`, `ScenarioPicker.tsx`, `ScenarioInfo.tsx` | One header row: scenario switcher, ⓘ popover with the summary and watch-for list, toolbar. Don't add text rows above the canvas: it needs the height. |
| `FlowBar.tsx` | The Watch strip: the scenario's flow steps (click to jump), the current note, the Spotlight switch (key `F`), ✕ to hide (key `H`, remembered in localStorage; hiding pauses the spotlight). |
| `BlocksDrawer.tsx` | Lego blocks + settings. |
| `LogFeed.tsx` | Narration ("What just happened"). |
| `Timeline.tsx`, `ZoomPan.tsx` | Scrubber/speed, spanning exactly the scenario's `duration` (never grows; playback loops back to 0 at the end after a short hold); zoom and pan for any canvas. |

A key a menu or input handles itself must `e.stopPropagation()`, or the player's global shortcuts fire too (Space would toggle play).

## Adding or changing a component

1. **Decide the kit.** Used by one sim only → the sim's own folder (`src/sims/<sim>/canvas|inspector|writeup`). Generic, or soon needed by a second sim → the matching `src/components/<kit>/`. Page-level layout shared by pages → `site/` or `writeup/`.
2. **One component per file**, named after it, with a one-line `/** doc */` saying what it is and when to use it. Export it from the kit's `index.ts`.
3. **Server by default.** Add `"use client"` only for hooks, browser APIs, or event handlers defined inside the component. Server pages may import client components; not the other way round with server-only code.
4. **Props over classes.** Expose intent (`tone`, `size`, `selected`, `alert`) rather than a `className` escape hatch, so styling stays consistent. Don't pass two conflicting Tailwind classes and hope (there's no tailwind-merge): add an option.
5. **Design tokens only**: colours, type scale, radius roles, `shadow-popover`/`shadow-drawer`, z-layers and `scrollbar-thin`, as the `design-system` skill describes. Run its audit (`node .claude/skills/design-system/audit.mjs`).
6. **Responsive:** HTML components work at phone width. Wide content (SVG figures, tables) goes in a horizontally scrolling container (`Figure`, `Compare` already do).
7. When you add a component, add a row to this skill's tables.
8. **Verify** with the `verify-simulation` skill (it runs the design and glossary audits too). For a refactor, compare screenshots of the same deep links before and after.
