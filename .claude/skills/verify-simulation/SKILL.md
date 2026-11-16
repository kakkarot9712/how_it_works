---
name: verify-simulation
description: Verify a change to syswork end to end - tests, typecheck, lint, production build, then headless-Chrome screenshots of scenarios at specific moments via deep links, inspected visually. Use before reporting any change to a simulation, the player, or page layout as done.
---

# Verify a simulation change

## 1. Static checks

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build   # pnpm test includes sources.test.ts (source-facts), flows.test.ts (scenario-flow), lanes.test.ts (packet labels fit their gaps)
node .claude/skills/glossary/audit.mjs        # every acronym in user-facing text has a definition
node .claude/skills/design-system/audit.mjs   # no off-scale sizes, raw colours, stray shadows/z-index, focus overrides
```

If `typecheck` complains about `PageProps<"/[topic]">` types, run `pnpm next typegen` first. All four must pass. Report failures with their output; don't paper over them.

## 2. Run the production server

Kill any old server first, otherwise a stale process serves CSS hashes from the previous build and pages render unstyled:

```bash
pkill -f next-server; pnpm build && (pnpm start -p 3123 > "$SCRATCH/server.log" 2>&1 &)
for i in $(seq 1 15); do curl -s -o /dev/null http://localhost:3123/ && break; sleep 1; done
```

## 3. Screenshot key moments

Deep links open a scenario paused at a simulated time: `/<topic>/<sim>?s=<scenarioId>&t=<ms>`.

Use `shot.mjs` (next to this file). It drives headless Chrome over the DevTools protocol, so it can also open menus, press keys, capture full pages and emulate real phone widths. It finds Chrome itself (`$CHROME`, `google-chrome`, `chromium`, or macOS Chrome).

```bash
SHOT=.claude/skills/verify-simulation/shot.mjs
node $SHOT "http://localhost:3123/redis/pub-sub?s=hard-limit&t=9500" "$SCRATCH/hard-limit.png"                 # 1280x800
node $SHOT "http://localhost:3123/redis/pub-sub?s=hard-limit&t=9500" "$SCRATCH/hard-limit-1440.png" --size=1440x900
node $SHOT "http://localhost:3123/redis/pub-sub?s=oom&t=1000" "$SCRATCH/menu.png" --click='[aria-haspopup=listbox]' --keys=ArrowDown
node $SHOT "http://localhost:3123/redis/streams?s=dead-consumer&t=8000" "$SCRATCH/tooltip.png" --hover='main abbr'   # glossary tooltip (PEL in the Watch note)
node $SHOT "http://localhost:3123/redis/streams?s=happy&t=3500" "$SCRATCH/info.png" --click='[aria-label="About this scenario"]'   # ⓘ popover
node $SHOT "http://localhost:3123/redis/streams?s=happy&t=3000" "$SCRATCH/chip.png" --hover='span.rounded-full.cursor-help ~ span.rounded-full.cursor-help'   # hint-chip tooltip (version)
node $SHOT "http://localhost:3123/redis/pub-sub/how-it-works" "$SCRATCH/hiw.png" --full --scale=0.75
node $SHOT "http://localhost:3123/redis/pub-sub/how-it-works" "$SCRATCH/hiw-phone.png" --size=390x844 --full
```

If the owner's `pnpm dev` is already running on :3000, you can shoot against it instead of starting a production server, which avoids killing their process. Run the production build check from step 1 regardless. For a long full-page shot, crop it into pieces (e.g. with PIL) before reading, or the image is too small to inspect.

For a refactor that should change nothing visually, shoot the same deep links before and after and compare them.

Save screenshots to the session scratchpad, not the repo. Pick `t` at the moment the scenario's lesson is visible (e.g. just after a disconnect). Then open each PNG with the Read tool and check:

- [ ] Styled page (not raw HTML). If unstyled, see the stale-server note above.
- [ ] No overlapping text in the SVG (labels against status pills, long names, numbers).
- [ ] The lesson is visible: limit lines, counters, status pills and narration match what the scenario promises in `watchFor`.
- [ ] Narration isn't spamming the same line.
- [ ] Inspector shows the selected node's controls.
- [ ] Default (fit) zoom is legible at 1280×800 and 1440×900. Header buttons don't wrap.
- [ ] Consistent with the design system: type sizes match their role, no stray colour or shadow, and keyboard focus is visible (`--keys=Tab,Tab`).
- [ ] The `/how-it-works` page renders at 1440 and 390 wide, and its scenario and moment links open the right scenario at the right time.
- [ ] Also check `/` and the topic page if the catalog changed. Unknown paths return 404: `curl -s -o /dev/null -w "%{http_code}" localhost:3123/nope`.

## 4. Clean up

For a scenario change, also screenshot two or three of its flow steps (`t` just after each `flow[].at`): the Watch note must match what's on screen, and the lit nodes must be the ones the note is about (`scenario-flow` skill).

Stop the server (`pkill -f next-server`). Report what you checked and anything you couldn't verify, such as zoom/pan, drag or keyboard behavior, which screenshots don't cover.
