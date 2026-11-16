"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { AnySimDefinition } from "@/sims/types";
import { BlocksDrawer } from "./BlocksDrawer";
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
    Space: () => sim.setPlaying((p) => !p),
    ".": sim.step,
    ArrowLeft: () => sim.seek(runtime.now - 1000),
    ArrowRight: () => sim.seek(runtime.now + 1000),
    "[": () => loadScenario(sim.scenarioIndex - 1),
    "]": () => loadScenario(sim.scenarioIndex + 1),
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
              <Button tone={drawer ? "primary" : "default"} onClick={() => setDrawer((d) => !d)}>
                <span className="whitespace-nowrap">⚙ Blocks & settings</span>
              </Button>
              <Button tone="ghost" onClick={copyLink} title="Copy a link to this scenario at the current time">
                <span className="whitespace-nowrap">{copied ? "copied ✓" : "⧉ Link to moment"}</span>
              </Button>
            </>
          }
        />

        <div className="relative min-h-0 flex-1">
          <ZoomPan>
            <Canvas {...view} />
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
          log={runtime.log}
          playing={sim.playing}
          speed={sim.speed}
          onPlay={() => sim.setPlaying((p) => !p)}
          onStep={sim.step}
          onRestart={() => sim.seek(0)}
          onSeek={sim.seek}
          onSpeed={sim.setSpeed}
          note={def.timeNote}
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
