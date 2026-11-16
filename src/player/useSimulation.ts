"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { Runtime } from "@/engine/runtime";
import type { AnySimDefinition } from "@/sims/types";
import { readSimUrl, writeScenarioUrl } from "./url";

const SEED = 42;

/**
 * Owns a sim's run: the current scenario, the user's block/setting overrides, the
 * Runtime built from them, and the play/pause/speed animation loop. Changing the
 * scenario or any override rebuilds the run from t=0 (or from `?t=` on first load).
 */
export function useSimulation(def: AnySimDefinition) {
  const [initial] = useState(() => readSimUrl(def.scenarios.map((s) => s.id)));
  const [scenarioId, setScenarioId] = useState(initial.scenarioId);
  const scenario = def.scenarios.find((s) => s.id === scenarioId) ?? def.scenarios[0];
  const [settingsOv, setSettingsOv] = useState<Record<string, number>>({});
  const [componentsOv, setComponentsOv] = useState<Record<string, boolean>>({});
  /** Where a freshly built run starts (only non-zero when opened from a link). */
  const [startAt, setStartAt] = useState(initial.t);
  const [playing, setPlaying] = useState(initial.t === 0);
  const [speed, setSpeed] = useState(1);
  const [, force] = useReducer((x: number) => x + 1, 0);

  const settings = { ...def.defaults.settings, ...scenario.settings, ...settingsOv };
  const components = { ...def.defaults.components, ...scenario.components, ...componentsOv };

  const runtime = useMemo(() => {
    const r = new Runtime(
      def.model,
      {
        settings: { ...def.defaults.settings, ...scenario.settings, ...settingsOv },
        components: { ...def.defaults.components, ...scenario.components, ...componentsOv },
      },
      { seed: SEED, script: scenario.script },
    );
    if (startAt > 0) r.advanceTo(startAt);
    return r;
  }, [def, scenario, settingsOv, componentsOv, startAt]);

  // Animation loop: advance simulated time by real elapsed time × speed.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(100, t - last);
      last = t;
      runtime.advanceTo(runtime.now + dt * speed);
      if (runtime.finished) setPlaying(false);
      force();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, runtime]);

  const resetOverrides = () => {
    setStartAt(0);
    setSettingsOv({});
    setComponentsOv({});
  };

  return {
    scenario,
    scenarioIndex: def.scenarios.indexOf(scenario),
    runtime,
    settings,
    components,
    customized: Object.keys(settingsOv).length > 0 || Object.keys(componentsOv).length > 0,
    playing,
    speed,
    setPlaying,
    setSpeed,
    overrideSetting: (key: string, v: number) => {
      setStartAt(0);
      setSettingsOv((o) => ({ ...o, [key]: v }));
    },
    overrideComponent: (key: string, v: boolean) => {
      setStartAt(0);
      setComponentsOv((o) => ({ ...o, [key]: v }));
    },
    resetOverrides,
    seek: (t: number) => {
      runtime.seek(t);
      force();
    },
    step: () => {
      setPlaying(false);
      runtime.step();
      force();
    },
    dispatch: (a: unknown) => {
      runtime.dispatch(a);
      force();
    },
    /** Switch scenario: clears overrides, updates the URL, and starts playing. */
    loadScenario: (id: string) => {
      setScenarioId(id);
      resetOverrides();
      writeScenarioUrl(id);
      setPlaying(true);
    },
  };
}

export type Simulation = ReturnType<typeof useSimulation>;
