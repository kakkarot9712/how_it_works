/**
 * Moving labels must never overlap the cards they travel between. For every sim, run
 * every scenario, collect the label of every packet in flight, and check the widest one
 * on each lane fits that lane's gap (`LANE_GAP` in canvas/layout.ts) with LANE_MARGIN on
 * both sides. Fix a failure by widening the gap (narrower cards) or shortening the label.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LANE_MARGIN, packetWidth } from "@/components/canvas/layout";
import { Runtime } from "@/engine/runtime";
import type { SimModel } from "@/engine/types";
import { DEFAULT_DURATION_MS } from "./types";

const SIMS = join(process.cwd(), "src/sims");
const dirs = readdirSync(SIMS).filter((d) => statSync(join(SIMS, d, "canvas", "layout.ts"), { throwIfNoEntry: false }));

const SAMPLE_MS = 50;

describe.each(dirs)("%s: packet lanes", (dir) => {
  it("every packet label fits the gap it crosses", async () => {
    const { LANE_GAP } = (await import(`./${dir}/canvas/layout.ts`)) as { LANE_GAP?: Record<string, number> };
    expect(LANE_GAP, `${dir}/canvas/layout.ts must export LANE_GAP`).toBeDefined();
    const m = (await import(`./${dir}/model.ts`)) as {
      model: SimModel<{ packets: { kind: string; label: string }[] }, unknown, unknown, { settings: object; components: object }>;
      defaultSettings: object;
      defaultComponents: object;
    };
    const { scenarios } = (await import(`./${dir}/scenarios.ts`)) as {
      scenarios: { id: string; settings?: object; components?: object; script: { at: number; action: unknown }[]; duration?: number }[];
    };

    const widest: Record<string, { label: string; scenario: string }> = {};
    for (const sc of scenarios) {
      const r = new Runtime(
        m.model,
        { settings: { ...m.defaultSettings, ...sc.settings }, components: { ...m.defaultComponents, ...sc.components } },
        { seed: 42, script: sc.script },
      );
      const end = sc.duration ?? DEFAULT_DURATION_MS;
      for (let t = 0; t <= end && !r.finished; t += SAMPLE_MS) {
        r.advanceTo(t);
        for (const p of r.state.packets) {
          const w = widest[p.kind];
          if (!w || packetWidth(p.label) > packetWidth(w.label)) widest[p.kind] = { label: p.label, scenario: sc.id };
        }
      }
    }

    for (const [kind, { label, scenario }] of Object.entries(widest)) {
      const gap = LANE_GAP![kind];
      expect(gap, `${dir}: packet kind "${kind}" has no LANE_GAP entry`).toBeDefined();
      const need = packetWidth(label) + 2 * LANE_MARGIN;
      expect(need, `${dir}: "${label}" (${kind}, scenario ${scenario}) needs ${need.toFixed(0)} units but its gap is ${gap}`).toBeLessThanOrEqual(gap);
    }
  });
});
