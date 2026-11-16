---
name: write-explainer
description: Write or improve a sim's "How it works" page (/<topic>/<sim>/how-it-works) - the Explainer sections, its diagram, key facts, comparison table, "See it happen" links, and the per-scenario walkthroughs with times checked against the model. Use when asked to write, extend, fix or restructure a write-up or explainer, or to document what a scenario does.
---

# Write a "How it works" page

The page is for engineers who want the real mechanism. Accuracy beats polish (AGENTS.md rule 2). Components are in `@/components/writeup` (see the `ui-components` skill). The reference is `src/sims/redis-pubsub/writeup/Explainer.tsx` and `src/sims/redis-pubsub/walkthroughs.ts`.

## Files

```
src/sims/<sim>/
  writeup/Explainer.tsx   exports `meta` (title, lede, facts, sections) and Explainer({ simHref })
  writeup/<Name>Diagram.tsx  static SVG figure(s), server components, theme tokens only
  walkthroughs.ts         one walkthrough per scenario, same order as scenarios.ts
  walkthroughs.test.ts    checks every timed moment against the model's narration
src/sims/explainers.tsx   writeups["<topic>/<sim>"] = { ...meta, Explainer, scenarios, walkthroughs }
```

The page shell (hero, contents rail, walkthrough cards) is shared. Don't edit `page.tsx` for one sim's content.

## 1. Research first

List every claim you'll make: config names and defaults, command and reply formats, log lines, error messages, protocol behaviour. Source each one under the **`source-facts`** skill: read the official page, add it to the sim's `sources.ts`, and put `{cite("id")}` after the sentence (`const cite = citer(sources)` at the top of the Explainer). Every section except "What this simulation simplifies" needs at least one citation. If you can't verify something, leave it out (or describe it as a model choice under simplifications), or ask the owner for a source. Say in your report what you checked.

## 2. meta

- **title**: "How <Tech> <Feature> actually works".
- **lede**: 1–2 sentences. The core mechanism and the one consequence that matters most.
- **facts**: 3–4 short values (delivery guarantee, storage, push/pull, the key safety limit). Values ≤ ~20 chars, so the strip doesn't wrap badly.
- **sections**: `{ id, title }[]` in page order. Each id matches a `<WriteupSection id>`. The titles drive the contents list, so keep them short.

## 3. Sections (in this order)

1. **The path of one <unit>**: what state exists and where, then a `Figure` with a diagram of one message/request through the system, with numbered steps in the caption.
2. **One section per lesson** the scenarios teach (guarantees, buffering, limits, failure modes). Each ends with `<TryIt simHref={simHref} items={see("<scenario-id>", …)} />`.
3. **When to use something else**: when this tool is right, then a `Compare` table against the alternatives (storage, delivery, guarantee, offline consumer, slow consumer), then bullets.
4. **What this simulation simplifies**: a `Callout`. Required: time scale, size scaling, protocol shortcuts.

Writing style:
- Lead with the mechanism, then the consequence. Short paragraphs.
- Real names in `<code>`: commands, config, log lines verbatim.
- Real config goes in an `AnnotatedConfig` with every argument labelled.
- The scariest consequence goes in a `Callout tone="warn"`.
- `see()` throws on an unknown scenario id, so a renamed scenario fails the build.
- Acronyms get hover definitions automatically. When you introduce one, run the `glossary` skill's audit (`node .claude/skills/glossary/audit.mjs`) and add any missing term with an accurate one-line brief.

## 4. Diagrams

Inline SVG in `writeup/` named `<Name>Diagram.tsx` (the design audit treats `*Diagram.tsx` as SVG). Use theme tokens only (`fill-panel-2`, `stroke-line`, `fill-fg-muted`, `var(--color-ch-1)`, toneColor) and the SVG type scale (`text-svg-caption` / `text-svg-body`); see the `design-system` skill. Use a viewBox of ~780 wide and set `min-w-[720px]` on the svg so the Figure scrolls sideways on phones instead of shrinking the text. Show a contrast (one healthy row, one slow, one not matched), not just the happy path. Put the explanation in the caption (real text), not in the SVG. SVG `<text>` that shows an acronym needs `<title>{glossaryTitle(term)}</title>` inside it (the glossary audit checks `*Diagram.tsx`).

## 5. Walkthroughs (one per scenario)

Don't write them from the scenario description. Run the scenario and read what the model actually narrates:

```bash
cat > src/sims/<sim>/zz-dump.test.ts <<'EOF'
import { it } from "vitest";
import { writeFileSync } from "node:fs";
import { Runtime } from "@/engine/runtime";
import { defaultComponents, defaultSettings, model, type Components, type Settings } from "./model";
import { scenarios } from "./scenarios";
it("dump", () => {
  let out = "";
  for (const sc of scenarios) {
    const r = new Runtime(model, { settings: { ...defaultSettings, ...sc.settings } as Settings, components: { ...defaultComponents, ...sc.components } as Components }, { seed: 42, script: sc.script });
    r.advanceTo(30000);
    out += `\n## ${sc.id}\n` + r.log.map((l) => `${(l.t / 1000).toFixed(1)}s [${l.level}] ${l.text}`).join("\n") + "\n";
  }
  writeFileSync(process.env.OUT!, out);
});
EOF
OUT="$SCRATCH/dump.txt" pnpm vitest run src/sims/<sim>/zz-dump.test.ts; rm src/sims/<sim>/zz-dump.test.ts
```

Then for each scenario write:
- **setup**: what differs from defaults (scaled limits, rates, removed blocks, what breaks when).
- **moments**: in time order. `t` is in simulated ms (a deep link), and `log` is a substring of the narration line it describes. The test fails if no matching line appears within 0.4s of `t`. Use a moment without `t` for ongoing behaviour; if it states a fact, add a specific assertion to `walkthroughs.test.ts`.
- **takeaway**: the lesson, 1–2 sentences.
- **tryNext**: 1–2 things to do in the simulator, naming the **exact** control labels (`Stop reading the socket`, `Hard limit`, block names). Grep the Inspector and `index.ts` for the labels.

Text supports `` `code` `` and `**bold**` (rendered by `Rich`).

If the run contradicts a scenario's `watchFor` or summary, the scenario is wrong. Fix the scenario's script (or its text) and say so. Don't paper over it in the walkthrough.

## 6. Verify

`pnpm test` (walkthroughs.test.ts), the glossary audit, then the `verify-simulation` skill. Screenshot `/how-it-works` full-page at 1440 and 390 wide (`shot.mjs --full`), and open a couple of moment links to check they land on the described moment.
