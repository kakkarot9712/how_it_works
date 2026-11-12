import { describe, expect, it } from "vitest";
import { Runtime } from "./runtime";
import type { SimModel } from "./types";

// A counter that ticks at random intervals, so determinism depends on the RNG snapshot.
type S = { ticks: number; values: number[] };
type E = { type: "tick" };
type A = { type: "bump"; by: number };
const model: SimModel<S, E, A, null> = {
  init(_p, ctx) {
    ctx.schedule(10, { type: "tick" });
    return { ticks: 0, values: [] };
  },
  handle(s, _e, ctx) {
    s.ticks++;
    s.values.push(Math.round(ctx.rng.next() * 1000));
    ctx.schedule(ctx.rng.range(5, 50), { type: "tick" });
  },
  act(s, a, ctx) {
    s.ticks += a.by;
    ctx.log("info", `bump ${a.by}`);
  },
};

describe("Runtime", () => {
  it("is deterministic for a seed", () => {
    const a = new Runtime(model, null, { seed: 7 });
    const b = new Runtime(model, null, { seed: 7 });
    a.advanceTo(5000);
    b.advanceTo(2000);
    b.advanceTo(5000);
    expect(a.state).toEqual(b.state);
  });

  it("rewinds and replays to the identical state", () => {
    const r = new Runtime(model, null, { seed: 3, script: [{ at: 1200, action: { type: "bump", by: 100 } }] });
    r.advanceTo(4000);
    const at4000 = structuredClone(r.state);
    const logLen = r.log.length;
    r.seek(1000);
    expect(r.state.ticks).toBeLessThan(100);
    expect(r.log.length).toBe(0);
    r.seek(4000);
    expect(r.state).toEqual(at4000);
    expect(r.log.length).toBe(logLen);
  });

  it("branches on a user action after rewind, keeping scripted actions", () => {
    const r = new Runtime(model, null, { seed: 3, script: [{ at: 3000, action: { type: "bump", by: 1000 } }] });
    r.advanceTo(1000);
    r.dispatch({ type: "bump", by: 5 });
    r.advanceTo(2000);
    r.seek(500);
    r.dispatch({ type: "bump", by: 1 });
    r.advanceTo(4000);
    expect(r.log.map((l) => l.text)).toEqual(["bump 1", "bump 1000"]);
    expect(r.horizon).toBe(4000);
  });

  it("step processes one item", () => {
    const r = new Runtime(model, null, { seed: 1 });
    r.step();
    expect(r.now).toBe(10);
    expect(r.state.ticks).toBe(1);
  });
});
