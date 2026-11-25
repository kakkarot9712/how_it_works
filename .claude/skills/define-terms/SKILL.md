---
name: define-terms
description: Make sure readers never meet an undefined word in syswork - the shared dictionary of concept terms (taint, partition, controller, leader…) in src/lib/concepts.ts, shown as first-use hover tooltips, a "New words in this step" box on each path step, and a Terms page per path (/learn/<path>/terms), with "Read more" links to the official references. Terms used by several systems are one shared entry so readers connect them. Use when writing or changing any path step, Lab, Trace or write-up text; when a reader says a word is unclear or undefined; when adding a learning path; and before reporting text changes as done.
---

# Define every term, once, where it is first used

Readers of syswork are engineers, but not necessarily users of the system a path teaches. A word like *taint*, *cordon*, *offset* or *watch* used without a definition loses them. The owner asked (2026-11-25) for this to be solved for every path, once: no step may use a concept word before it is defined.

## How it works

| Piece | Where | Role |
| --- | --- | --- |
| `CONCEPTS` | `src/lib/concepts.ts` | The concept terms: `brief`, optional `forms`, and `taught` rows (one per path that uses the term). |
| `GLOSSARY` | `src/lib/glossary.ts` | Acronyms (`ACRONYMS`) plus `CONCEPTS`: one dictionary for every tooltip. `conceptsTaught(path, step?)` lists a path's terms. |
| `gloss()` / `Term` | `src/components/ui/` | Hover tooltips. Concept terms are marked only in first-use mode (`seen`: `Prose`, `Trace` hops, `Predict` cards, `Compare` tables); text marked on every use (narration, inspector help, labels) gets acronyms only, so it doesn't fill with underlines. The tooltip shows the brief, then one line per path: what the term means there and the step that teaches it. |
| `StepTerms` | `src/components/path/` | "New words in this step": the terms whose `taught.step` is this step, at the top of the step page. |
| `TermList` | `src/components/path/` | The term list both the box and the Terms page use, with "Read more" links to `taught.ref` and `taught.more`. |
| Terms page | `app/(site)/learn/[path]/terms` | Every term of the path, grouped by the step that teaches it. A reference, not a required first stop. Linked from the path home and every box. |
| Test | `src/paths/paths.test.ts` ("every term is defined where it is first used") | Each concept term a step's reader sees must have a `taught` row for that path whose `step` is the step of first use; no stale rows; refs exist in the pool. |
| `candidates.mjs` | this folder | Lists words in path prose that may need an entry (CamelCase names, capitalized words mid-sentence, short bold phrases). Advisory. |

## The entry

```ts
"admission controller": {
  brief: "Code inside the API server that checks, and may change, a request before the object is stored. Not a controller in the control-loop sense.",
  forms: ["admission controllers"],            // only spellings beyond the key and a plural "s"
  taught: [{ path: "kubernetes", step: "kubectl-apply", ref: "admission", note: "…", more: ["controlling-access"] }],
},
```

- **Key.** Lowercase for ordinary words (`taint`, `consumer group`; also matched capitalized at a sentence start). Exact case for proper names (`Pod`, `ReplicaSet`, `Fetch`). A trailing "s" plural always matches; add other inflections in `forms` (`rebalancing`, `tainted`, `cordoned`). Hyphens are part of a word, so `node` never matches inside `node-1`.
- **brief.** 1–2 plain sentences, 20–220 characters (glossary test). Say what it *is* and the one thing people get wrong ("It allows the node; it doesn't send the Pod there"). No undefined jargon inside the brief. Check every word of it against the facts skill (`kafka-facts`, `kubernetes-facts`) or the official page; it is a claim like any other (`source-facts`).
- **taught.** One row per path that uses the term:
  - `step`: the first step of that path whose text uses it. The test tells you the right one.
  - `ref`: the pool reference that backs the brief. It becomes the "Read more" link, so pick the page with the full facts.
  - `more`: extra pool references for a term with depth (a reader who wants all the facts).
  - `note`: what the term means *in this system*, when the brief is generic. Required when several paths share the term.

## Shared terms: one idea, one entry

When an idea exists in several systems (leader, follower, replica, heartbeat, controller, consumer group, at-least-once, exponential back-off, desired state…), it gets **one** entry with a generic brief and a `taught` row per path, each with a `note`. Hovering it anywhere shows every system that uses it, which is how readers connect the paths. The box and the Terms page mark it "also in Kafka" (etc.).

- Before adding a term, search `concepts.ts` for the idea under another name. Add a `taught` row to the existing entry instead of a second entry.
- Same word, different meaning in two systems (Kafka's *controller* vs Kubernetes' *controller*): still one entry. The brief says the word is used for different things; each `note` says what it is there.
- A key that is also an everyday word (*watch*, *node*, *leader*) is underlined at its first use on every page. Reword plain-English uses ("Watch the box" → "Keep an eye on the box") so the first underline is the term.
- Same word, different meaning **inside one path** (Kafka "position" of a record vs a consumer's position): don't key the ambiguous word. Key the precise phrase (`consumer position`) and use that phrase where you mean it.

## Writing a step

1. Write the text. Name the concrete thing, not just its role (`add-path-step`).
2. Run `node .claude/skills/define-terms/candidates.mjs <path>` and read the list. For each word: add an entry, rephrase, or, if it is plain English or already explained, add it to `REVIEWED` in the script with a reason.
3. Run `pnpm test`. The term test names each word whose `taught.step` is wrong or missing, and each row no step uses any more.
4. Introduce new words in the text too, not only in the box: the first paragraph that needs a word says what it is, in plain words and with an everyday picture where the docs give one (thermostat, lock and key). The box is the safety net, not the explanation.
5. Words that only appear in `<code>` are literal names (config keys, commands, field names) and aren't matched. If the reader needs the idea behind a name, write the idea in prose and define that.

## Verify

`pnpm test`, the glossary audit, then screenshots: the step's box (`--hover='main dl'` on the step page), a tooltip on a shared term (`--hover='main abbr'`), and `/learn/<path>/terms` (`--full`).
