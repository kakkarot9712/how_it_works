# Sim file templates

Skeletons for every file a sim needs, distilled from the existing sims so you don't have to read one end to end. Replace `<sim>`, `Thing`, `X` etc. Rules that the cross-sim tests enforce are called out as **Test:**. Shapes and props here match the kits as of 2026-11; if a kit's signature changed, the compiler tells you.

## model.ts

```ts
import type { SimContext, SimModel } from "@/engine/types";

/**
 * One paragraph: what is modelled, which version/source files it follows, and that time runs in slow motion.
 */

// ---------- data ----------
export const NODE_A = "a";                       // node ids: the same strings NodeBox `id`, flow `nodes`, LogEntry.node and select() use
export const nodeB = (i: number) => `b:${i}`;   // parametrised ids: give a parse helper too (parseBNode) for the Inspector router

export type PacketKind = "req" | "resp";       // one per lane in canvas/layout.ts LANE_GAP
export interface Packet { id: number; kind: PacketKind; from: string; to: string; sentAt: number; arriveAt: number; label: string }

export interface Settings { latencyMs: number /* numeric knobs only; one-of-few choices are numbers too */ }
export interface Components { someBlock: boolean /* lego blocks: removing one must change behaviour */ }
export interface Params { settings: Settings; components: Components }

export interface State {
  settings: Settings;          // copied from params at init
  components: Components;
  packets: Packet[];           // things in flight, drawn by the Canvas
  nextId: number;
  // per-node state, counters, "noted" flags for rate-limited narration (e.g. backlogNoted)
}

// ---------- events & actions ----------
export type Event =
  | { type: "tick"; gen: number }                         // carry gen/epoch on anything that can go stale
  | { type: "arrive"; packet: number };
export type Action = { type: "crash"; node: number } | { type: "restart"; node: number };   // inspector + script inputs
type Ctx = SimContext<Event>;

export const defaultSettings: Settings = { latencyMs: 300 };
export const defaultComponents: Components = { someBlock: true };

// ---------- helpers ----------
function send(s: State, ctx: Ctx, p: Omit<Packet, "id" | "sentAt" | "arriveAt">): Packet {
  const packet = { ...p, id: s.nextId++, sentAt: ctx.now, arriveAt: ctx.now + s.settings.latencyMs };
  s.packets.push(packet);
  ctx.schedule(packet.arriveAt - ctx.now, { type: "arrive", packet: packet.id });
  return packet;
}
function drop(s: State, id: number) { const i = s.packets.findIndex((p) => p.id === id); if (i >= 0) s.packets.splice(i, 1); }

// ---------- model ----------
export const model: SimModel<State, Event, Action, Params> = {
  init({ settings, components }, ctx) {
    const s: State = { settings: { ...settings }, components: { ...components }, packets: [], nextId: 1 };
    ctx.log("info", "Headline: what is set up", { detail: "Why, with real config names.", node: NODE_A });
    // schedule first events
    return s;
  },
  handle(s, e, ctx) {
    switch (e.type) {
      case "arrive": { drop(s, e.packet); /* … */ return; }
      case "tick": { /* if (e.gen !== s.gen) return; */ return; }
    }
  },
  act(s, a, ctx) {
    switch (a.type) {
      case "crash": { /* bump gen so pending events go stale; log("error", …) */ return; }
      case "restart": { return; }
    }
  },
};

/** Every node id the canvas draws. **Test:** flows.test.ts checks flow `nodes` against this at each step's time. */
export function nodeIds(s: State): string[] { return [NODE_A, /* … */]; }
```

Rules: `ctx.rng` / `ctx.now` only (a model needing its own random stream keeps a mulberry32 state number in State, see lb-algorithms `nextRandom`). Narration: `ctx.log(level, headline, { detail, node })`; headline = what happened, detail = why with real names; rate-limit repeats with `…Noted` flags. The happy-path scenario must log no `warn`/`error`.

## scenarios.ts

```ts
import type { Scenario } from "@/sims/types";
import type { Action, Components, Settings } from "./model";

export const scenarios: Scenario<Action, Settings, Components>[] = [
  {
    id: "happy",                    // kebab-case, used in ?s= links and see()
    title: "Short title",
    summary: "One or two sentences: what happens and the lesson.",   // shown in the ⓘ popover
    watchFor: ["Bullet: what to look at.", "…"],
    settings: { /* partial overrides */ },
    components: { /* partial overrides */ },
    script: [{ at: 5000, action: { type: "crash", node: 1 } }],     // **Test:** every `at` < duration
    select: "a",                    // node selected on load
    // duration: 30_000,            // default DEFAULT_DURATION_MS
    flow: [                          // **Test:** first at 0, strictly increasing, nodes exist then, no repeats, note ≤ 110 chars
      { at: 0, nodes: ["a", "b:1"], note: "Where to look first, as a full sentence." },
      { at: 5000, nodes: ["b:1"], note: "The trigger, timed to the script." },
    ],
  },
];
```

## index.ts

```ts
import type { SimDefinition } from "@/sims/types";
import { Canvas } from "./canvas/Canvas";
import { Inspector } from "./inspector/Inspector";
import { defaultComponents, defaultSettings, model, nodeIds, type Action, type Components, type Event, type Settings, type State } from "./model";
import { scenarios } from "./scenarios";
import { sources } from "./sources";

export const mySim: SimDefinition<State, Event, Action, Settings, Components> = {
  model, defaults: { settings: defaultSettings, components: defaultComponents }, scenarios, Canvas, Inspector, sources, nodeIds,
  timeNote: "Slow motion: … (what is scaled, by how much).",
  components: [{ key: "someBlock", label: "Block name", help: "What it does. Remove it and …" }],
  settings: [{ key: "latencyMs", label: "Network hop", min: 50, max: 800, step: 10, unit: "ms", help: "One-way latency (slow motion)." }],
  // one-of-few: { key: "acks", label: "acks", min: 0, max: 2, step: 1, choices: ["0", "1", "all"], help: "…" }
};
```

## theme.ts

```ts
import type { Tone } from "@/components/ui";
export const KIND_COLOR = { a: "var(--color-ch-1)", b: "var(--color-ch-2)" } as const;   // traffic kinds only: ch-1..ch-4
export function nodeStatus(s: State, i: number): { text: string; tone: Tone } { /* "up"/ok, "slow"/warn, "crashed"/err */ }
```

## canvas/layout.ts

```ts
export const W = 1160;
export const H = 760;
// One {x, y, w, h} per column/card. Keep the top-left empty: zoom controls plus a two-line hint sit there
// (about 0..170 wide, 0..120 tall in viewBox units at fit zoom on 1280×800).
export const A = { x: 8, y: 98, w: 160, h: H - 104 };
export const B = { x: 300, w: 560, h: 200 };
/** **Test:** lanes.test.ts: for each packet kind, packetWidth(widest label) + 2 × LANE_MARGIN (12) ≤ gap. packetWidth = max(34, chars × 8.2 + 18). */
export const LANE_GAP: Record<string, number> = { req: B.x - (A.x + A.w), resp: B.x - (A.x + A.w) };
```

Packets move along straight lines; plan cards so every lane is a straight, open gap. Two lanes beside a wire at `±PACKET_LANE` (18); a second lane on the same side at `±PACKET_LANE_2`.

## canvas/Canvas.tsx

```tsx
"use client";
import { Packet, PACKET_LANE as L, Wire } from "@/components/canvas";
import type { ViewProps } from "@/sims/types";
import { type Action, type State } from "../model";
import { H, W } from "./layout";

export function Canvas({ state: s, now, selected, select }: ViewProps<State, Action>) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" onClick={() => select(null)} role="img" aria-label="…">
      {/* 1. Boundary  2. Wires (ends={[a, b]}, broken / faded)  3. Packets (ends={[p.from, p.to]})  4. Nodes */}
      {s.packets.map((p) => <Packet key={p.id} ends={[p.from, p.to]} x1={0} y1={0} x2={0} y2={0} sentAt={p.sentAt} arriveAt={p.arriveAt} now={now} label={p.label} color="var(--color-ch-1)" />)}
      {/* <ThingNode state={s} now={now} selected={selected === "a"} onSelect={() => select("a")} /> */}
    </svg>
  );
}
```

## canvas/ThingNode.tsx (one per node type)

```tsx
import { NodeBox } from "@/components/canvas";
import { toneColor } from "@/components/ui";
import { glossaryTitle } from "@/lib/glossary";

export function ThingNode({ state: s, selected, onSelect }: { state: State; selected: boolean; onSelect: () => void }) {
  const { x, y, w, h } = A;
  return (
    <NodeBox id="a" x={x} y={y} w={w} h={h} selected={selected} alert={false /* crashed */} onSelect={onSelect}>
      <text x={x + 14} y={y + 26} className="fill-fg text-svg-title font-semibold">name</text>
      <text x={x + 14} y={y + 50} className="text-svg-body" fill={toneColor.ok}>● up</text>
      {/* acronyms in SVG text need a <title>: */}
      <text x={x + 14} y={y + 72} className="fill-fg-muted font-mono text-svg-body"><title>{glossaryTitle("ISR")}</title>ISR 1,2,3</text>
    </NodeBox>
  );
}
```

SVG type: `text-svg-caption` 12.5 (uppercase labels), `text-svg-body` 13.5 (default), `text-svg-strong` 15.5, `text-svg-title` 19, `text-svg-display` 22. Colours: `fill-fg`, `fill-fg-muted`, `fill-bg`, `fill-panel-2`, `stroke-line`, `toneColor[tone]`, `var(--color-ch-N)`. Nested cards: `surface="panel-2" rx={10}`. Slots/bars `rx` 2–4.

## inspector/Inspector.tsx and a panel

```tsx
"use client";
import { InspectorEmpty } from "@/components/inspector";
import type { ViewProps } from "@/sims/types";

export function Inspector({ state: s, selected, dispatch, select, now }: ViewProps<State, Action>) {
  if (selected === "a") return <ThingPanel s={s} dispatch={dispatch} />;
  return <InspectorEmpty hint="Click any box to inspect it and take control: …" nodes={[{ id: "a", label: "a" }]} onSelect={select} />;
}
```

```tsx
"use client";
import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Slider, Stat, StatGrid, Toggle } from "@/components/ui";

export function ThingPanel({ s, dispatch }: { s: State; dispatch: (a: Action) => void }) {
  return (
    <div>
      <InspectorHeader kind="broker" title="broker-1" status={<Pill tone="ok">up</Pill>} />
      <Section title="Break it">
        <Toggle tone="danger" label="Cut network" help="…" checked={false} onChange={(on) => dispatch(/* … */)} />
        <Slider label="Speed" value={1} min={0.25} max={4} step={0.25} unit="×" help="…" onChange={(v) => dispatch(/* … */)} />
        <div className="mt-2 flex flex-wrap gap-1.5"><Button tone="danger" onClick={() => dispatch(/* … */)}>Crash broker-1</Button></div>
      </Section>
      <Section title="Stats">
        <StatGrid cols={3}><Stat label="offset" value={12} /><Stat label="lag" value={3} tone="warn" /></StatGrid>
      </Section>
      <ConfigLine>min.insync.replicas=2</ConfigLine>
      <Help>What this node is, in a sentence or two.</Help>
    </div>
  );
}
```

Keep everything inside a `Section` (bare `Help`/`ConfigLine` after the last Section render flush against the panel edge). `ConfigLine` is a `pre` that scrolls sideways: pass several short lines joined with `"\n"` rather than one long one (~38 mono characters fit the 360px column).

Other primitives: `Button tone` default/primary/danger/ghost, `SegmentedControl`, `Choice`, `Glossed` (wrap custom markup so acronyms get tooltips), `Eyebrow` (only way to write uppercase).

## sources.ts

```ts
import type { SourceSet } from "@/lib/sources";
export const sources: SourceSet = {
  subject: "Apache Kafka", version: "4.4", label: "Kafka 4.4",
  versionNote: "Which behaviour is version-specific and how the text marks it.",
  checked: "YYYY-MM-DD",
  officialSources: ["https://kafka.apache.org/"],
  references: [   // **Test:** ordered by first cite() in the Explainer; every one cited; ids unique
    { id: "design", title: "…", publisher: "Apache Kafka documentation", url: "https://…", accessed: "YYYY-MM-DD", covers: ["acks", "min.insync.replicas"] },
  ],
};
```

**Test (sources.test.ts) coverage:** every ALL-CAPS token (3+ chars) in any user-visible string or JSX text in the sim folder (and the catalog summary) must be in some reference's `covers`, unless it has a glossary entry or is in `NOT_TERMS`. Every kebab-case word inside `<code>`, backticks or `<ConfigLine>` must be covered too. Dotted names (`min.insync.replicas`) aren't matched by the kebab rule, but list them in `covers` anyway. Underscore codes (`NOT_ENOUGH_REPLICAS`) aren't matched at all (`_` is a word character, so `\b` never splits them): the test won't catch them, so list them in `covers` yourself, on the page that documents them.

## writeup/Explainer.tsx

```tsx
import { AnnotatedConfig, Callout, citer, Compare, Figure, Prose, TryIt, WriteupSection } from "@/components/writeup";
import type { WriteupMeta } from "@/sims/explainers";
import { scenarios } from "../scenarios";
import { sources } from "../sources";

export const meta: WriteupMeta = {
  title: "How X actually works", lede: "1–2 sentences.",
  facts: [{ label: "Delivery", value: "≤ ~20 chars" }],
  sections: [{ id: "path", title: "The path of one record" }, /* … */ { id: "simplifies", title: "What this simulation simplifies" }],
};
function see(...ids: string[]) {
  return ids.map((id) => { const i = scenarios.findIndex((s) => s.id === id); if (i < 0) throw new Error(`unknown scenario "${id}"`); return { id, n: i + 1, title: scenarios[i].title }; });
}
const cite = citer(sources);

export function Explainer({ simHref }: { simHref: string }) {
  return (
    <Prose>
      <WriteupSection id="path" title="The path of one record">
        <p>Claim.{cite("design")}</p>        {/* **Test:** every section but "simplifies" has a cite() */}
        <Figure caption={<ol className="list-decimal space-y-1 pl-5"><li>…</li></ol>}><MyDiagram /></Figure>
        <TryIt simHref={simHref} items={see("happy")} />
      </WriteupSection>
      <WriteupSection id="simplifies" title="What this simulation simplifies">
        <Callout title="Model vs reality"><ul><li>Time scale, sizes, protocol shortcuts…</li></ul></Callout>
      </WriteupSection>
    </Prose>
  );
}
```

`AnnotatedConfig parts={[{ token, label, tone? }]}`, `Compare head={[…]} rows={[[…]]}`, `Callout tone="warn" title`. Diagrams: `writeup/<Name>Diagram.tsx`, viewBox ~780 wide, `className="min-w-[720px]"` on the svg, SVG type scale, explanation in the caption.

## walkthroughs.ts and walkthroughs.test.ts

```ts
import type { Walkthrough } from "@/sims/explainers";
export const walkthroughs: Walkthrough[] = [
  { id: "happy", setup: "What differs from defaults.", moments: [{ t: 0, log: "substring of a narration line", text: "What happens." }, { text: "Ongoing behaviour (no t)." }],
    takeaway: "The lesson.", tryNext: ["Name **exact control labels** from the Inspector / drawer."] },
];
```

**Test:** walkthroughs.test.ts (copy as is, rename the describe): ids match scenarios in order; every moment with `t` and `log` has a narration line containing `log` within 400 ms of `t`; moments in time order.

```ts
import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import { defaultComponents, defaultSettings, model, type Components, type Settings } from "./model";
import { scenarios } from "./scenarios";
import { walkthroughs } from "./walkthroughs";

describe("<sim> walkthroughs", () => {
  it("cover every scenario, in order", () => expect(walkthroughs.map((w) => w.id)).toEqual(scenarios.map((s) => s.id)));
  for (const w of walkthroughs) {
    it(`${w.id}: every timed moment matches the narration`, () => {
      const sc = scenarios.find((s) => s.id === w.id)!;
      const r = new Runtime(model, { settings: { ...defaultSettings, ...sc.settings } as Settings, components: { ...defaultComponents, ...sc.components } as Components }, { seed: 42, script: sc.script });
      r.advanceTo(Math.max(0, ...w.moments.map((m) => m.t ?? 0)) + 1000);
      let prev = -Infinity;
      for (const m of w.moments) {
        if (m.t === undefined) continue;
        expect(m.t).toBeGreaterThanOrEqual(prev); prev = m.t;
        if (m.log) expect(r.log.some((l) => l.text.includes(m.log!) && Math.abs(l.t - m.t!) <= 400), `"${m.log}" near ${m.t}ms`).toBe(true);
      }
    });
  }
});
```

Write walkthroughs from a narration dump, never from the scenario text: see the `write-explainer` skill's dump snippet.

## model.test.ts

```ts
function run(id: string, until = 30000, over: { settings?: Partial<Settings>; components?: Partial<Components> } = {}) {
  const sc = scenarios.find((s) => s.id === id)!;
  const r = new Runtime(model, { settings: { ...defaultSettings, ...sc.settings, ...over.settings } as Settings, components: { ...defaultComponents, ...sc.components, ...over.components } as Components }, { seed: 42, script: sc.script });
  r.advanceTo(until);
  return r;
}
it("happy path: no warnings", () => expect(run("happy").log.filter((l) => l.level === "warn" || l.level === "error")).toEqual([]));
it("every scenario survives rewind/replay deterministically", () => {
  for (const sc of scenarios) { const r = run(sc.id, 12000); const snap = structuredClone(r.state); r.seek(3333); r.seek(12000); expect(r.state, sc.id).toEqual(snap); }
});
// + one test per scenario asserting its lesson actually happens
```

## Registration (4 files)

- `src/catalog.ts`: sim entry `status: "live"`.
- `src/sims/registry.tsx`: `"<topic>/<slug>": dynamic(() => import("./<dir>").then((m) => { const Sim = () => <Player def={m.mySim} />; return Sim; }), { ssr: false, loading })`.
- `src/sims/explainers.tsx`: import `Explainer, meta`, `scenarios`, `walkthroughs`, `sources`; add `"<topic>/<slug>": { ...meta, Explainer, scenarios, walkthroughs, sources }`.
- `docs/roadmap.md`: status row.
