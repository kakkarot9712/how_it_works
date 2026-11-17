---
name: source-facts
description: Sourcing rules for every fact syswork shows - each module declares the product version it models and cites official documentation for every claim, Wikipedia style (inline [n] citations, a References list), enforced by src/sims/sources.test.ts. Use before adding or changing any claim anywhere (a new sim, scenario, narration line, inspector text, write-up section, config name, default value, log line, version note, glossary brief), when bumping the version a module models, when a fact is unclear or the docs don't settle it (ask the owner for a reliable source), and when the sources test fails.
---

# Source every fact

syswork teaches how real systems behave, so every claim must be checkable against the system's own documentation. The rules follow Wikipedia's [verifiability policy](https://en.wikipedia.org/wiki/Wikipedia:Verifiability), tightened:

| Wikipedia | syswork |
| --- | --- |
| Verifiability, not truth: a claim must be attributable to a reliable source. | Same. "I know this" is not a source. If you can't point to a page that says it, it doesn't ship. |
| [WP:BURDEN](https://en.wikipedia.org/wiki/Wikipedia:Verifiability#Responsibility_for_providing_citations): whoever adds or restores material provides the citation. | You, the agent adding the text, fetch and read the source before writing the sentence. |
| [Reliable sources](https://en.wikipedia.org/wiki/Wikipedia:Reliable_sources): published, with editorial oversight. | **Official only**: the project's own documentation, specification, reference config or source code (listed per module in `officialSources`). No blogs, Stack Overflow, tutorials, vendor marketing, AI answers or memory. |
| [Inline citations](https://en.wikipedia.org/wiki/Wikipedia:Inline_citation): numbered [n] after the claim, a References list at the end, numbered by first use. | Same, via `cite()` in the Explainer and the `References` section the page renders. |
| `{{citation needed}}` marks unsourced text until someone fixes it. | **Not allowed.** Unsourced text is removed, not tagged. There is no "fix it later". |

## The hard rules

1. **No source, no claim.** If the official docs (or the project's source code) don't clearly state it, remove it or rewrite it to say only what they do state. This includes "common knowledge", examples of real-world usage ("a common production incident"), performance claims ("sub-millisecond"), version numbers, defaults and log lines.
2. **Exact names only.** Commands, options, config directives, defaults, error codes and log lines are copied from the source verbatim. Never invent one, never "fix up" one from memory.
3. **Version-specific.** Each module models one version (`sources.version`). Features newer than what most deployments run are marked inline with their version ("XAUTOCLAIM (6.2+)", "ACKED (8.2+)"), and that version is itself sourced.
4. **The model is not a claim about reality.** Simplifications (time scale, sizes, fixed timeouts, shortened log lines) are allowed only if listed under "What this simulation simplifies". Describe them as model choices ("The model checks…"), never as Redis behaviour.
5. **When unsure, ask, don't guess.** If the docs are ambiguous, contradict each other, are silent, or you can't reach them, stop and ask the owner with `AskUserQuestion`: say what claim you need, what you checked, and what's unclear. Offer "drop the claim" as an option. The owner may point you to a source, or approve an exception (below). Never approve one yourself.

## Where things live

```
src/lib/sources.ts                 SourceSet / Reference / OwnerApproval types, refNumber()
src/sims/<sim>/sources.ts          the module's version + references (ordered by first citation)
src/sims/<sim>/index.ts            passes `sources` to the SimDefinition (version badge in the player)
src/sims/explainers.tsx            passes the same `sources` to the write-up
src/components/writeup/Cite.tsx    citer(sources) → cite("id", …) renders [n] links
src/components/writeup/References.tsx  the numbered list + "Modelled on …" at the end of /how-it-works (entry ids ref-<id>; the clicked one highlights via :target)
src/sims/sources.test.ts           the enforcement (runs in `pnpm test`)
```

A `Reference` is `{ id, title, publisher, url, accessed, covers }`. `covers` lists the commands, options, config names and codes **that page actually documents** (you read it). Don't pad it: a term goes in `covers` only for a source that documents it.

## What the test enforces (per module)

- `sources.ts` exists, declares `subject`, `version`, `label` and `checked`, and is registered in both `index.ts` and `writeups[]`.
- Every reference URL starts with one of the module's `officialSources`, unless it carries an owner `approval`.
- Every `cite("id")` resolves; every reference is cited at least once; references are numbered in order of first citation.
- Every write-up section except "What this simulation simplifies" has at least one citation.
- **Coverage:** every all-caps command/option/code (`XAUTOCLAIM`, `NOACK`, `ASAP`) in any user-facing string or JSX text in the module, and every kebab-case config name inside `<code>`, backticks or `<ConfigLine>` (`client-output-buffer-limit`, `min-idle-time`), is in some reference's `covers`. Acronyms with a glossary entry are covered by the glossary instead (its briefs need official sources too; see the `glossary` skill).

The test can't read meaning. It catches names without sources; it can't catch a wrong sentence. That part is on you and on review: every sentence must match its cited page.

## Workflow: adding or changing a claim

1. **List the claims** in the text you're about to write: each fact, name, default, version, log line, error, and behaviour.
2. **Find the official page.** Start at the module's doc root (table below). For a command, go to its reference page. For defaults, the shipped reference config (e.g. `redis.conf`). For log lines and exact behaviour the docs don't spell out, the project's source code.
3. **Read it.** `WebFetch` the page and ask for verbatim quotes; long pages need `offset`; for raw source files, `curl -s <raw url> | grep -n '<string>'` is the most reliable. Keep the quote in your notes: you'll say what you checked when you report.
4. **Write only what the quote supports.** Rephrase freely, but don't extend the claim.
5. **Record it** in `sources.ts`: reuse an existing reference if it's the same page, else add one (with `accessed` = today, and `covers`). Keep references in first-citation order (the test tells you the expected order).
6. **Cite it** in the Explainer: `{cite("id")}` right after the sentence (several ids: `cite("a", "b")`). Narration, inspector text, scenarios and walkthroughs don't carry inline markers, but every claim there must be backed by a reference that the Explainer cites; add a sentence + citation to the Explainer if nothing there covers it yet.
7. Run `pnpm test`. If the coverage check names a term, either add the source that documents it, or remove the term.

## Choosing and bumping the version

- Use the latest generally available release, from the project's own release notes (not RCs). Put the release notes page in your notes; cite it if the text mentions the version beyond the badge.
- `versionNote` says how version-specific behaviour is marked. Keep it factual.
- When bumping: re-read every reference against the new release, update `accessed`, `checked` and `version`, and re-run the scenario tests (behaviour may have changed).

## Official doc roots

| Subject | Official sources |
| --- | --- |
| Redis | `https://redis.io/docs/latest/` (commands: `/commands/<name>/`, concepts under `/develop/`, ops under `/operate/`), `redis.conf` and source in `github.com/redis/redis` (raw: `raw.githubusercontent.com/redis/redis/unstable/...`), release notes under `/operate/oss_and_stack/stack-with-enterprise/release-notes/redisce/` |
| Kafka | `https://kafka.apache.org/<version>/` (design, getting started, javadoc), KIPs on `cwiki.apache.org/confluence/display/KAFKA` |
| TCP and other protocols | the RFC on `https://www.rfc-editor.org/rfc/` |
| Linux | `https://man7.org/linux/man-pages/` (Linux man-pages project), kernel source in `github.com/torvalds/linux` |
| PostgreSQL | `https://www.postgresql.org/docs/<major>/` (concurrency control is chapter 13, SQL commands under `sql-*.html`, settings under `runtime-config-*.html`), release support at `/support/versioning/`, exact messages in the source at `github.com/postgres/postgres` (branch `REL_<major>_STABLE`) |

For a new subject (MongoDB, PostgreSQL, Raft…), use the project's own docs, the spec or the original paper, add the prefixes to that module's `officialSources`, and extend this table. If you can't tell whether a site is official, ask the owner.

## Owner exceptions (the only way to be soft)

The owner can relax the rules **for one module**, for example to accept an authoritative book, a paper mirror or a vendor's engineering blog where no official page exists. Record exactly what they approved, with the date and their reason, and nothing more:

```ts
// one source outside officialSources
{ id: "raft-thesis", …, approval: { approvedBy: "owner", date: "2026-11-20", reason: "Ongaro's thesis is the reference for Raft; no project docs exist." } }

// a whole rule relaxed for this module (rules: "official-domains" | "coverage" | "section-citations")
relaxed: [{ rule: "coverage", approvedBy: "owner", date: "2026-11-20", reason: "Owner: sketch module, terms will be sourced before launch." }]
```

Both show up on the module's References section, so readers see them too. Never add an approval or relaxation that the owner didn't explicitly give in this conversation; approval for one module never carries over to another.

## Report

When you finish, say what you checked: which pages, for which claims, and anything you removed because no source supported it.
