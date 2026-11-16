---
name: glossary
description: Explain acronyms and codes to readers with hover tooltips (TCP, FIN, RST, OOM, ECONNREFUSED, ISR…) - add or fix glossary entries in src/lib/glossary.ts, make new text show tooltips via gloss()/Glossed, and audit the site for acronyms that have no definition. Use when adding a sim, scenario, write-up, narration or inspector text that introduces an acronym, when a user asks what an abbreviation means or wants terms explained, or before reporting text changes as done.
---

# Glossary: acronyms explained on hover

Every acronym a reader sees has a hover, focus or tap tooltip with what it stands for and one line on what it means *here*. AGENTS.md rule 12. The pieces:

| Piece | Where | Role |
| --- | --- | --- |
| `GLOSSARY` | `src/lib/glossary.ts` | The definitions: `{ expansion?, brief }` per term. |
| `GLOSSARY_RE`, `glossaryTitle()` | same file | Whole-word matcher (longest first); a one-line form for SVG `<title>`. |
| `Term` | `src/components/ui/Term.tsx` | Dotted-underline `<abbr>` on the shared `Tooltip` (portalled, so scroll panels don't clip it; same look as hint chips). |
| `gloss(node, { seen, focusable })`, `<Glossed>` | `src/components/ui/gloss.tsx` | Finds terms in text or element trees and wraps them in `Term`. |
| `glossary.test.ts` | `src/lib/` | Matching rules, first-use behaviour, brief length. |
| `audit.mjs` | this folder | Finds all-caps tokens in user-facing text with no entry. |

## 1. Add or fix a term

1. **Is it a glossary term?** Yes for acronyms, initialisms and OS/protocol codes a working engineer might not know: TCP, FIN, RST, OOM, RESP, ECONNREFUSED, ISR, PEL. No for commands and config names, which are shown as code (`PUBLISH`, `XACK`, `BLOCK`), units (KB), and plain words in caps. Those go in `NOT_ACRONYMS` in `audit.mjs`, with a comment saying why.
2. **Check the facts** against official docs or source, as for any claim on the site (AGENTS.md rule 2, `source-facts` skill). Say in your report what you checked.
3. **Write the entry:**
   - `expansion`: what the letters stand for ("TCP finish flag", "Out Of Memory"). For an error code, name what it is ("Connection refused (OS error code)").
   - `brief`: 1–2 plain sentences, under ~200 characters (the test enforces 20–220). Say what it means *as it shows up on this site*. For example, RST: "Aborts a connection at once. A host also replies with RST to a connection attempt on a port nobody is listening on." Not a textbook definition, no jargon that itself needs a tooltip, no marketing.
   - Versions or variants that appear as their own token (RESP2 vs RESP) get their own entries. The matcher prefers the longer one.
4. Keep `GLOSSARY` grouped roughly by topic (transport, Redis, OS, databases). There's no need to sort it.

## 2. Make new text show tooltips

Plurals match too ("PELs" gets the PEL tooltip). Most text already goes through `gloss()`, including `Toggle` and `Slider` labels (so lego-block names in the drawer): `Prose` (first use per page), `Rich` and walkthrough cards (first use per card), `Help`, `Toggle`/`Slider` help, `Stat` values, `InspectorEmpty`, narration (`LogFeed`), scenario summary and watch-for (ⓘ popover), Watch-strip notes, the scenario menu, `Compare` cells, the write-up lede, and `SimCard`.

For text rendered any other way:

- **Free-form markup** (a `<ul>` in an inspector, a custom panel): wrap it in `<Glossed>…</Glossed>`. Use `<Glossed once>` for long prose.
- **A string you render yourself:** `{gloss(text)}`.
- **Inside a clickable element** (`<button>`, `<Link>`, a listbox option): use `gloss(text, { focusable: false })`. A focusable element can't nest inside another; the tooltip still works on hover.
- **SVG `<text>`** can't contain HTML: put `<title>{glossaryTitle("PEL")}</title>` (or `glossaryTitles(text)` for a label with several terms) inside it for a native tooltip. The audit fails any `<text>` in a `canvas/` file or `*Diagram.tsx` that shows a term without one.
- `gloss` leaves `code`, `pre`, links and buttons alone, so a term in `<code>` isn't marked. That's intended: code is literal.
- In long text, mark only first uses: pass one shared `seen` set (`Prose` and `ScenarioWalkthrough` already do).

## 3. Audit

```bash
node .claude/skills/glossary/audit.mjs        # exit 1 and a list if any acronym lacks an entry
node .claude/skills/glossary/audit.mjs --all  # also: each glossed term, where it's used, unused entries
```

It scans string literals and JSX text in `src/` (not tests or comments). For each token it reports: add it to `GLOSSARY` (step 1), or, if it's a command, unit or code word, add it to `NOT_ACRONYMS` with a reason. A token that's really code leaking into the scan (an identifier inside JSX) means the scanner needs tightening, not a new entry. Unused entries are fine for planned sims in `catalog.ts`. Delete them only if nothing on the site will use them.

Run the audit whenever you add a sim, scenario, narration line, inspector text or write-up section, and before reporting text changes as done.

## 4. Verify

1. `pnpm test` (`glossary.test.ts`) and the audit pass.
2. Screenshot a tooltip with the verify-simulation script:
   ```bash
   node .claude/skills/verify-simulation/shot.mjs "http://localhost:3000/redis/streams?s=dead-consumer&t=8000" "$SCRATCH/tip.png" --hover='main abbr'
   node .claude/skills/verify-simulation/shot.mjs "http://localhost:3000/redis/pub-sub/how-it-works" "$SCRATCH/tip2.png" --size=1440x900 --hover='#half-open abbr'
   ```
   Check that the tooltip shows the term, expansion and brief, isn't clipped by a panel, and opens downwards near the top of the screen.
3. Read the new brief in place. Does it make sense to someone who just saw the term in that sentence?
