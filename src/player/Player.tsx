"use client";

import { useMemo, useState } from "react";
import { FocusProvider } from "@/components/canvas";
import { Button } from "@/components/ui";
import type { AnySimDefinition } from "@/sims/types";
import { BlocksDrawer } from "./BlocksDrawer";
import { activeStep, FlowBar } from "./FlowBar";
import { LogFeed } from "./LogFeed";
import { ScenarioBar } from "./ScenarioBar";
import { Timeline } from "./Timeline";
import { momentUrl } from "./url";
import { useShortcuts } from "./useShortcuts";
import { useSimulation } from "./useSimulation";
import { ZoomPan } from "./ZoomPan";

/**
 * The shared shell around every simulation: scenario bar, a drawer with lego
 * toggles and settings, the zoomable animated canvas, the inspector (user
 * controls), narration, and the timeline. A simulation only supplies a
 * SimDefinition. It fills its parent's height.
 */
export function Player({ def }: { def: AnySimDefinition }) {
  const sim = useSimulation(def);
  const { scenario, runtime } = sim;
  const [selected, setSelected] = useState<string | null>(scenario.select ?? null);
  const [drawer, setDrawer] = useState(false);
  const [copied, setCopied] = useState(false);
  const [spotlight, setSpotlight] = useState(true);

  const [watch, setWatch] = useState(readWatchPref);
  const toggleWatch = () => {
    writeWatchPref(!watch);
    setWatch(!watch);
  };

  // The scenario's flow step at this moment; the canvas spotlights its nodes.
  const stepIndex = activeStep(scenario.flow, runtime.now);
  const step = scenario.flow[stepIndex];
  // Hiding the Watch strip also pauses the spotlight: dimming with no note would be unexplained.
  const focus = useMemo(() => (spotlight && watch && step ? new Set(step.nodes) : null), [spotlight, watch, step]);

  const loadScenario = (i: number) => {
    const sc = def.scenarios[i];
    if (!sc) return;
    sim.loadScenario(sc.id);
    setSelected(sc.select ?? null);
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(momentUrl(scenario.id, runtime.now)).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };

  useShortcuts({
    Space: sim.togglePlay,
    ".": sim.step,
    ArrowLeft: () => sim.seek(runtime.now - 1000),
    ArrowRight: () => sim.seek(runtime.now + 1000),
    "[": () => loadScenario(sim.scenarioIndex - 1),
    "]": () => loadScenario(sim.scenarioIndex + 1),
    f: () => setSpotlight((v) => !v),
    h: toggleWatch,
  });

  const view = { state: runtime.state, now: runtime.now, selected, select: setSelected, dispatch: sim.dispatch };
  const { Canvas, Inspector } = def;

  return (
    <div className="grid h-full min-h-[560px] grid-cols-[minmax(0,1fr)_360px] grid-rows-[minmax(0,1fr)] overflow-hidden">
      {/* Center: scenario bar, canvas, timeline */}
      <main className="flex min-h-0 min-w-0 flex-col bg-bg">
        <ScenarioBar
          def={def}
          current={sim.scenarioIndex}
          onPick={loadScenario}
          modified={sim.customized}
          actions={
            <>
              {!watch && (
                <Button onClick={toggleWatch} title="Show the Watch strip: where to look, step by step (H)">
                  <span className="whitespace-nowrap">Watch {stepIndex + 1}/{scenario.flow.length}</span>
                </Button>
              )}
              <Button tone={drawer ? "primary" : "default"} onClick={() => setDrawer((d) => !d)}>
                <span className="whitespace-nowrap">⚙ Blocks & settings</span>
              </Button>
              <Button tone="ghost" onClick={copyLink} title="Copy a link to this scenario at the current time">
                <span className="whitespace-nowrap">{copied ? "copied ✓" : "⧉ Link to moment"}</span>
              </Button>
            </>
          }
        />

        {step && watch && (
          <FlowBar
            flow={scenario.flow}
            current={stepIndex}
            spotlight={spotlight}
            onSpotlight={() => setSpotlight((v) => !v)}
            onJump={(s) => sim.seek(s.at)}
            onHide={toggleWatch}
          />
        )}

        <div className="relative min-h-0 flex-1">
          <ZoomPan>
            <FocusProvider nodes={focus}>
              <Canvas {...view} />
            </FocusProvider>
          </ZoomPan>
          {drawer && (
            <BlocksDrawer
              def={def}
              settings={sim.settings}
              components={sim.components}
              customized={sim.customized}
              onSetting={sim.overrideSetting}
              onComponent={sim.overrideComponent}
              onReset={sim.resetOverrides}
              onClose={() => setDrawer(false)}
            />
          )}
        </div>

        <Timeline
          now={runtime.now}
          horizon={runtime.horizon}
          duration={sim.duration}
          log={runtime.log}
          playing={sim.playing}
          speed={sim.speed}
          onPlay={sim.togglePlay}
          onStep={sim.step}
          onRestart={() => sim.seek(0)}
          onSeek={sim.seek}
          onSpeed={sim.setSpeed}
          note={def.timeNote}
          version={def.sources}
        />
      </main>

      {/* Right: inspector + narration */}
      <aside className="flex min-h-0 flex-col border-l border-line bg-panel">
        {/* The inspector takes its natural height; narration gets the rest but never less
            than 200px. Only if both can't fit does the inspector scroll. */}
        <div className="min-h-0 shrink overflow-y-auto border-b border-line scrollbar-thin">
          <Inspector {...view} />
        </div>
        <LogFeed
          log={runtime.log}
          version={runtime.log.length}
          now={runtime.now}
          onPick={(e) => {
            sim.setPlaying(false);
            sim.seek(e.t);
            if (e.node) setSelected(e.node);
          }}
        />
      </aside>
    </div>
  );
}

// Whether the Watch strip is shown: a per-viewer preference, so it may be unavailable.
const WATCH_KEY = "syswork:watch-strip";
function readWatchPref() {
  try {
    return localStorage.getItem(WATCH_KEY) !== "hidden";
  } catch {
    return true;
  }
}
function writeWatchPref(shown: boolean) {
  try {
    localStorage.setItem(WATCH_KEY, shown ? "shown" : "hidden");
  } catch {}
}
