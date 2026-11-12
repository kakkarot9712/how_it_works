---
name: verify-simulation
description: Verify a change to syswork end to end - tests, typecheck, lint, production build, then headless-Chrome screenshots of scenarios at specific moments via deep links, inspected visually. Use before reporting any change to a simulation, the player, or page layout as done.
---

# Verify a simulation change

## 1. Static checks

```bash
pnpm test && pnpm typecheck && pnpm lint && pnpm build
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

```bash
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CH" --headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 \
  --virtual-time-budget=5000 --screenshot="$SCRATCH/<name>.png" \
  "http://localhost:3123/redis/pub-sub?s=hard-limit&t=9500"
```

Save screenshots to the session scratchpad, not the repo. Pick `t` at the moment the scenario's lesson is visible (e.g. just after a disconnect). Then open each PNG with the Read tool and check:

- [ ] Styled page (not raw HTML). If unstyled, see the stale-server note above.
- [ ] No overlapping text in the SVG (labels against status pills, long names, numbers).
- [ ] The lesson is visible: limit lines, counters, status pills and narration match what the scenario promises in `watchFor`.
- [ ] Narration isn't spamming the same line.
- [ ] Inspector shows the selected node's controls.
- [ ] Default (fit) zoom is legible at 1280×800 and 1440×900. Header buttons don't wrap.
- [ ] The `/how-it-works` page renders, and its scenario links open the right scenario.
- [ ] Also check `/` and the topic page if the catalog changed. Unknown paths return 404: `curl -s -o /dev/null -w "%{http_code}" localhost:3123/nope`.

## 4. Clean up

Stop the server (`pkill -f next-server`). Report what you checked and anything you couldn't verify, such as zoom/pan, drag or keyboard behavior, which screenshots don't cover.
