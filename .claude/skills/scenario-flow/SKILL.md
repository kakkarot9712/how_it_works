---
name: scenario-flow
description: The "flow to watch" for each scenario - timed steps that spotlight the nodes, wires and messages a viewer should follow (the rest of the canvas dims) and a one-line note above the canvas. Use when adding or changing a scenario, retiming a script, adding a node type to a canvas, or when a user says it isn't obvious where to look in a scenario.
---

# Scenario flow: where to look, step by step

When a scenario loads, the viewer should never wonder where to look. Every scenario has a `flow`: steps in simulated time, each naming the nodes to follow and one short note. The player shows a **Watch** strip above the canvas (numbered steps, the current note, a **Spotlight** switch, key `F`, and ✕ to hide the strip, key `H`; hidden, a "Watch n/m" toolbar button brings it back and the spotlight pauses). The canvas haloes the step's nodes, highlights the wires and messages between them, and dims everything else. Steps say **where to look**; narration says **what happened**. The scenario's `summary` and `watchFor` are no longer on the page: they sit in the ⓘ popover next to the picker, so the Watch note is the one line of guidance a viewer reads while it plays.

`src/sims/flows.test.ts` enforces it for every sim. A scenario without a valid flow fails `pnpm test`.

## Where it lives

| What | Where |
| --- | --- |
| `FlowStep { at, nodes, note }`, `Scenario.flow` (required) | `src/sims/types.ts` |
| `SimDefinition.nodeIds(state)`: every node id the canvas draws | `src/sims/<sim>/model.ts` (exported `nodeIds`), wired in `index.ts` |
| Spotlight context: `FocusProvider`, `useFocus`, `UNFOCUSED_OPACITY` | `src/components/canvas/Focus.tsx` |
| `NodeBox id`, `Wire ends`, `Packet ends` read the spotlight | `src/components/canvas/` |
| The Watch strip, `activeStep()` | `src/player/FlowBar.tsx`, rendered by `Player.tsx` |

## Writing a flow

```ts
flow: [
  { at: 0,     nodes: ["g:mailers", "C1", "C2"], note: "mailer-1 takes 1.5 s per entry. Watch the mailers group." },
  { at: 4000,  nodes: ["P1", "stream", "g:mailers", "C1"], note: "A burst of 10: mailer-1 takes a batch of 4." },
  { at: 7000,  nodes: ["g:mailers", "C1"], note: "mailer-1 is gone. Its 4 entries stay in the PEL; watch their idle time grow." },
  { at: 12500, nodes: ["g:mailers", "C2"], note: "Idle passed min-idle-time: mailer-2's XAUTOCLAIM takes them…" },
],
```

Rules (the test checks the first five):

1. The first step is at `0`; steps are in strictly increasing time; every step starts at a time the run reaches.
2. `nodes` are canvas node ids, the same ids the inspector selects (`select`, `LogEntry.node`): e.g. `P1`, `server`, `buf:S1`, `stream`, `g:mailers`, `C1`. Each must be in `nodeIds(state)` at that moment. No repeats.
3. One note per step, at most 110 characters, a full sentence.
4. Spotlight the **smallest set that tells the story**. If a step lists every node, it isn't a spotlight. 2 to 4 nodes is typical; a whole path (sender → server → receiver) for "follow this message" steps.
5. The selected node always stays lit, so the user's own focus is never dimmed.
6. **Time each step to the script and narration.** Start a step at the scripted action (`script[].at`) or a little before the narrated moment it points at (the walkthrough's `t`), so the viewer is looking in the right place when it happens. After retiming a script, retime the flow.
7. **Notes are facts too.** They follow `source-facts` (no claim the sources don't back; real command and config names) and go through `gloss()` (new acronyms need a glossary entry). They must agree with the narration and the walkthrough.
8. Typically 2 to 5 steps: the setup, the trigger, the consequence, and the recovery if there is one.

## Making a canvas spotlight-aware (new sim or new node type)

- Every `NodeBox` gets `id={…}`: the node's id.
- Every `Wire` gets `ends={[a, b]}`: lit only when both ends are in the step.
- Every `Packet` gets `ends={[p.from, p.to]}`, so a model's packets need `from` and `to` node ids.
- Export `nodeIds(state)` from `model.ts` listing exactly the ids the canvas draws, and add `nodeIds` to the `SimDefinition` in `index.ts`.
- Don't draw your own dimming or halo. If something else needs it (a Boundary, a custom shape), add the prop to the kit component with `useFocus`, not to the sim.

## Verify

`pnpm test` (flows.test.ts), then screenshot a scenario at two or three step times (`?s=<id>&t=<step.at + a bit>`) with the `verify-simulation` skill. Check that the Watch note matches what's on screen, the lit nodes are the ones the note names, and dimmed parts remain readable as context.
