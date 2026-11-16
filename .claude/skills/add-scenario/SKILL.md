---
name: add-scenario
description: Add or change a curated scenario in an existing simulation (a scripted situation like "subscriber goes offline at 3s" or "broker crashes during a write"), including its test. Use when asked for a new case, situation, failure mode or "what happens if…" in a sim that already exists.
---

# Add a scenario

Scenarios live in `src/sims/<sim-id>/scenarios.ts`. A scenario teaches one lesson.

## Steps

1. **Check the model can express it.** Read `model.ts` `Action` and `act()`. If the situation needs a new control (a new failure mode, say), add the Action first. Also expose it in the node's panel in `inspector/` so users can trigger it themselves; scenarios should only use actions users have too.
2. **Write the scenario object:**
   ```ts
   {
     id: "kebab-id",                 // used in deep links ?s=<id>; don't rename casually
     title: "Short, specific title",
     summary: "1–2 sentences: setup and what goes wrong.",
     watchFor: ["Concrete thing to look at", "…"],   // 2–3 bullets
     settings: { /* partial overrides */ },
     components: { /* lego blocks on/off */ },
     script: [{ at: 2000, action: { type: "…", … } }],  // simulated ms
     select: "nodeId",               // inspector focus on load
   }
   ```
   Order matters: the list reads as a course, from the happy path to the more advanced failures.
3. **Tune the timing.** The lesson should appear within roughly 5 to 15 s of simulated time at 1×. Use `?s=<id>&t=<ms>` to check key moments.
4. **Test it** in `model.test.ts`: assert the lesson's observable outcome (a counter, a status, a log line), not incidental details. The rewind-determinism loop already covers new scenarios.
5. **Write its walkthrough** in `walkthroughs.ts` (same order as `scenarios.ts`): setup, the key moments with their simulated time and the narration line each one matches (`log`), a takeaway, and "try next" ideas that name real controls. `walkthroughs.test.ts` fails if a scenario has no walkthrough or a moment's `log` isn't narrated within 0.4 s of its `t`, so re-run it after any timing change. It renders on `/how-it-works`, with each time linking to `?s=<id>&t=<ms>`.
6. **Verify** with the `verify-simulation` skill and screenshot the scenario at its key moment.

## Writing guidance

- Narration text in the model carries the explanation. If the scenario reveals a mechanism that isn't narrated yet, add a `ctx.log` with a real-world `detail`.
- Use real names for config, commands and log lines. Scaled values (KB instead of MB) are fine, but the explainer must mention them.
- A new acronym in narration, summary or watch-for (SYN, ISR, LSN…) needs a glossary entry so readers can hover it. Run `node .claude/skills/glossary/audit.mjs` (see the `glossary` skill).
