import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import { defaultComponents, defaultSettings, model, type Components, type Settings } from "./model";
import { scenarios } from "./scenarios";
import { walkthroughs } from "./walkthroughs";

/** The write-up's scenario walkthroughs must describe what the model actually does, when it does it. */
describe("Kafka replication walkthroughs", () => {
  it("cover every scenario, in order", () => {
    expect(walkthroughs.map((w) => w.id)).toEqual(scenarios.map((s) => s.id));
  });

  for (const w of walkthroughs) {
    it(`${w.id}: every timed moment matches the narration`, () => {
      const sc = scenarios.find((s) => s.id === w.id)!;
      const r = new Runtime(
        model,
        {
          settings: { ...defaultSettings, ...sc.settings } as Settings,
          components: { ...defaultComponents, ...sc.components } as Components,
        },
        { seed: 42, script: sc.script },
      );
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
});
