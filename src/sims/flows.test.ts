/**
 * Enforces the "flow to watch" (add-scenario skill): every scenario says which nodes to
 * follow, step by step, and the player spotlights them. A step must name nodes that are
 * on the canvas at that moment, start at a time the run reaches, and carry a short note.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Runtime } from "@/engine/runtime";
import type { SimModel } from "@/engine/types";
import { DEFAULT_DURATION_MS, type FlowStep } from "./types";

const SIMS = join(process.cwd(), "src/sims");
const dirs = readdirSync(SIMS).filter((d) => statSync(join(SIMS, d)).isDirectory() && statSync(join(SIMS, d, "model.ts"), { throwIfNoEntry: false }));

interface ModelModule {
  model: SimModel<object, unknown, unknown, { settings: object; components: object }>;
  defaultSettings: object;
  defaultComponents: object;
  nodeIds: (s: object) => string[];
}
interface ScenarioLike {
  id: string;
  settings?: object;
  components?: object;
  script: { at: number; action: unknown }[];
  flow: FlowStep[];
  duration?: number;
}

const MAX_NOTE = 110;

describe.each(dirs)("%s: scenario flows", (dir) => {
  it("every scenario has a well-formed flow whose nodes exist when the step starts", async () => {
    const m = (await import(`./${dir}/model.ts`)) as ModelModule;
    const { scenarios } = (await import(`./${dir}/scenarios.ts`)) as { scenarios: ScenarioLike[] };
    const { walkthroughs } = (await import(`./${dir}/walkthroughs.ts`)) as { walkthroughs: { id: string; moments: { t?: number }[] }[] };
    expect(typeof m.nodeIds, `${dir}/model.ts must export nodeIds(state)`).toBe("function");

    for (const sc of scenarios) {
      const where = `${dir} › ${sc.id}`;
      expect(sc.flow?.length, `${where}: needs a flow`).toBeGreaterThan(0);
      expect(sc.flow[0].at, `${where}: the first flow step starts at 0`).toBe(0);

      // Everything the scenario teaches must happen before playback stops.
      const duration = sc.duration ?? DEFAULT_DURATION_MS;
      for (const a of sc.script) expect(a.at, `${where}: script action at ${a.at} is past the ${duration} ms duration`).toBeLessThan(duration);
      for (const f of sc.flow) expect(f.at, `${where}: flow step at ${f.at} is past the ${duration} ms duration`).toBeLessThan(duration);
      for (const m of walkthroughs.find((w) => w.id === sc.id)?.moments ?? [])
        if (m.t !== undefined) expect(m.t, `${where}: walkthrough moment at ${m.t} is past the ${duration} ms duration`).toBeLessThanOrEqual(duration);

      const r = new Runtime(
        m.model,
        { settings: { ...m.defaultSettings, ...sc.settings }, components: { ...m.defaultComponents, ...sc.components } },
        { seed: 42, script: sc.script },
      );
      let prev = -1;
      for (const [i, step] of sc.flow.entries()) {
        const at = `${where} › step ${i + 1}`;
        expect(step.at, `${at}: steps must be in strictly increasing time order`).toBeGreaterThan(prev);
        prev = step.at;
        expect(step.nodes.length, `${at}: names no nodes`).toBeGreaterThan(0);
        expect(new Set(step.nodes).size, `${at}: repeats a node`).toBe(step.nodes.length);
        expect(step.note.trim().length, `${at}: needs a note`).toBeGreaterThan(0);
        expect(step.note.length, `${at}: note is over ${MAX_NOTE} characters: "${step.note}"`).toBeLessThanOrEqual(MAX_NOTE);

        r.advanceTo(step.at);
        expect(r.now, `${at}: starts after the run ends`).toBeGreaterThanOrEqual(step.at);
        const ids = new Set(m.nodeIds(r.state));
        for (const n of step.nodes) expect(ids.has(n), `${at}: "${n}" is not a node on the canvas (nodeIds)`).toBe(true);
      }
    }
  });
});
