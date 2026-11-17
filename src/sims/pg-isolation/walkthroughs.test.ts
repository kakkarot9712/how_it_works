import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import { committedValue, defaultComponents, defaultSettings, model, type Components, type Settings } from "./model";
import { RUN_MS, scenarios } from "./scenarios";
import { walkthroughs } from "./walkthroughs";

function runner(id: string) {
  const sc = scenarios.find((s) => s.id === id)!;
  return new Runtime(
    model,
    {
      settings: { ...defaultSettings, ...sc.settings } as Settings,
      components: { ...defaultComponents, ...sc.components } as Components,
    },
    { seed: 42, script: sc.script, maxDuration: RUN_MS },
  );
}

/** The write-up's scenario walkthroughs must describe what the model actually does, when it does it. */
describe("postgres isolation walkthroughs", () => {
  it("cover every scenario, in order", () => {
    expect(walkthroughs.map((w) => w.id)).toEqual(scenarios.map((s) => s.id));
  });

  for (const w of walkthroughs) {
    it(`${w.id}: every timed moment matches the narration`, () => {
      const r = runner(w.id);
      const last = Math.max(0, ...w.moments.map((m) => m.t ?? 0));
      r.advanceTo(last + 1000);
      let prev = -Infinity;
      for (const m of w.moments) {
        if (m.t === undefined) continue;
        expect(m.t, "moments are in time order").toBeGreaterThanOrEqual(prev);
        prev = m.t;
        if (!m.log) continue;
        const hit = r.log.some((l) => l.text.includes(m.log!) && Math.abs(l.t - m.t!) <= 400);
        expect(hit, `"${m.log}" near ${m.t}ms`).toBe(true);
      }
    });
  }

  it("snapshots: at 8.2s B's second sum is in flight or done, reading alice 70 and bob 130", () => {
    const r = runner("snapshots");
    r.advanceTo(8600);
    expect(r.state.sessions.B.lines.filter((l) => l.result === "sum = 200")).toHaveLength(2);
    expect(committedValue(r.state, "alice")).toBe(70);
  });

  it("lost-update: both sessions read 100 before either writes (A by 2.9s, B by 3.5s)", () => {
    const r = runner("lost-update");
    r.advanceTo(3600);
    expect(r.state.sessions.A.saved).toBe(100);
    expect(r.state.sessions.B.saved).toBe(100);
    expect(r.state.versions.filter((v) => v.row === "alice")).toHaveLength(1);
  });

  it("serializable: each sum leaves a relation-level SIRead lock", () => {
    const r = runner("serializable");
    r.advanceTo(3400);
    expect(r.state.ssi.map((t) => t.reads)).toEqual([["*"], ["*"]]);
  });

  it("deadlock: B locks bob by 3.4s", () => {
    const r = runner("deadlock");
    r.advanceTo(3400);
    expect(r.state.rowLocks.bob?.session).toBe("B");
    expect(r.state.rowLocks.alice?.session).toBe("A");
  });
});
