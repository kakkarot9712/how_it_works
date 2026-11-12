"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Runtime } from "@/engine/runtime";
import type { LogEntry } from "@/engine/types";
import type { AnySimDefinition } from "@/sims/types";
import { Button, cx, Section, Slider, Toggle } from "@/components/ui";
import { fmt, Timeline } from "./Timeline";
import { ZoomPan } from "./ZoomPan";

const SEED = 42;

/**
 * The shared shell around every simulation: scenario picker, a drawer with
 * lego toggles and settings, the zoomable animated canvas, the inspector
 * (user controls), narration, and the timeline. A simulation only supplies a
 * SimDefinition. It fills its parent's height.
 */
/** `?s=<scenario>&t=<ms>` opens a scenario paused at a given moment. */
function readUrl(def: AnySimDefinition): { scenarioId: string; t: number } {
  const q = new URLSearchParams(window.location.search);
  const id = q.get("s");
  const t = Number(q.get("t"));
  return {
    scenarioId: def.scenarios.some((s) => s.id === id) ? id! : def.scenarios[0].id,
    t: Number.isFinite(t) && t > 0 ? t : 0,
  };
}

export function Player({ def }: { def: AnySimDefinition }) {
  const [initial] = useState(() => readUrl(def));
  const [scenarioId, setScenarioId] = useState<string>(initial.scenarioId);
  const scenario = def.scenarios.find((s) => s.id === scenarioId) ?? def.scenarios[0];
  const [settingsOv, setSettingsOv] = useState<Record<string, number>>({});
  const [componentsOv, setComponentsOv] = useState<Record<string, boolean>>({});
  /** Where a freshly built run starts (only non-zero when opened from a link). */
  const [startAt, setStartAt] = useState(initial.t);
  const [selected, setSelected] = useState<string | null>(scenario.select ?? null);
  const [playing, setPlaying] = useState(initial.t === 0);
  const [copied, setCopied] = useState(false);
  const [drawer, setDrawer] = useState(false);
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

  const overrideSettings = (key: string, v: number) => {
    setStartAt(0);
    setSettingsOv((o) => ({ ...o, [key]: v }));
  };
  const overrideComponent = (key: string, v: boolean) => {
    setStartAt(0);
    setComponentsOv((o) => ({ ...o, [key]: v }));
  };
  const resetOverrides = () => {
    setStartAt(0);
    setSettingsOv({});
    setComponentsOv({});
  };
  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?s=${scenario.id}&t=${Math.round(runtime.now)}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };

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

  const seek = (t: number) => {
    runtime.seek(t);
    force();
  };
  const step = () => {
    setPlaying(false);
    runtime.step();
    force();
  };
  const dispatch = (a: unknown) => {
    runtime.dispatch(a);
    force();
  };

  // Keyboard: space = play/pause, . = step, ←/→ = ∓1s
  const keys = useRef({ step, seek, runtime });
  useEffect(() => {
    keys.current = { step, seek, runtime };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = keys.current;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === ".") k.step();
      else if (e.key === "ArrowLeft") k.seek(k.runtime.now - 1000);
      else if (e.key === "ArrowRight") k.seek(k.runtime.now + 1000);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const loadScenario = (id: string) => {
    const sc = def.scenarios.find((s) => s.id === id)!;
    setScenarioId(id);
    resetOverrides();
    window.history.replaceState(null, "", `?s=${id}`);
    setSelected(sc.select ?? null);
    setPlaying(true);
  };

  const customized = Object.keys(settingsOv).length > 0 || Object.keys(componentsOv).length > 0;
  const view = { state: runtime.state, now: runtime.now, selected, select: setSelected, dispatch };
  const { Canvas, Inspector } = def;
  const idx = def.scenarios.findIndex((s) => s.id === scenario.id);

  return (
    <div className="grid h-full min-h-[560px] grid-cols-[minmax(0,1fr)_360px] grid-rows-[minmax(0,1fr)] overflow-hidden">
      {/* Center: scenario bar, canvas, timeline */}
      <main className="flex min-h-0 min-w-0 flex-col bg-bg">
        <div className="border-b border-line px-5 py-2.5">
          <div className="flex items-center gap-2">
            <ScenarioPicker
              scenarios={def.scenarios}
              current={idx}
              onPick={(i) => loadScenario(def.scenarios[i].id)}
            />
            {customized && <span className="text-xs text-warn">modified</span>}
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <Button tone={drawer ? "primary" : "default"} onClick={() => setDrawer((d) => !d)}>
                <span className="whitespace-nowrap">⚙ Blocks & settings</span>
              </Button>
              <Button tone="ghost" onClick={copyLink} title="Copy a link to this scenario at the current time">
                <span className="whitespace-nowrap">{copied ? "copied ✓" : "⧉ Link to moment"}</span>
              </Button>
            </div>
          </div>
          <p className="mt-1.5 max-w-5xl text-sm leading-relaxed text-fg-muted">{scenario.summary}</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5 text-[13px] text-fg-muted">
            {scenario.watchFor.map((w) => (
              <li key={w} className="before:mr-1.5 before:text-accent before:content-['▸']">
                {w}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative min-h-0 flex-1">
          <ZoomPan>
            <Canvas {...view} />
          </ZoomPan>

          {drawer && (
            <aside className="absolute inset-y-0 left-0 z-20 w-[320px] overflow-y-auto border-r border-line bg-panel shadow-2xl">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <h2 className="text-sm font-semibold text-fg">Building blocks & settings</h2>
                <div className="flex items-center gap-1">
                  {customized && (
                    <Button tone="ghost" onClick={resetOverrides}>
                      reset
                    </Button>
                  )}
                  <Button tone="ghost" onClick={() => setDrawer(false)} title="Close">
                    ✕
                  </Button>
                </div>
              </div>
              <Section title="Building blocks">
                <p className="mb-2 text-[13px] leading-snug text-fg-muted">
                  Pull a part out to see what it was doing. Changing anything here restarts the run.
                </p>
                {def.components.map((c) => (
                  <Toggle
                    key={c.key}
                    label={c.label}
                    help={c.help}
                    checked={Boolean(components[c.key])}
                    onChange={(v) => overrideComponent(c.key, v)}
                  />
                ))}
              </Section>
              <Section title="Settings">
                {def.settings.map((d) => (
                  <Slider
                    key={d.key}
                    label={d.label}
                    value={settings[d.key]}
                    min={d.min}
                    max={d.max}
                    step={d.step}
                    unit={d.unit}
                    help={d.help}
                    onChange={(v) => overrideSettings(d.key, v)}
                  />
                ))}
              </Section>
            </aside>
          )}
        </div>

        <Timeline
          now={runtime.now}
          horizon={runtime.horizon}
          log={runtime.log}
          playing={playing}
          speed={speed}
          onPlay={() => setPlaying((p) => !p)}
          onStep={step}
          onRestart={() => seek(0)}
          onSeek={seek}
          onSpeed={setSpeed}
          note={def.timeNote}
        />
      </main>

      {/* Right: inspector + narration */}
      <aside className="flex min-h-0 flex-col border-l border-line bg-panel">
        <div className="max-h-[55%] overflow-y-auto border-b border-line">
          <Inspector {...view} />
        </div>
        <LogFeed
          log={runtime.log}
          version={runtime.log.length}
          now={runtime.now}
          onPick={(e) => {
            setPlaying(false);
            seek(e.t);
            if (e.node) setSelected(e.node);
          }}
        />
      </aside>
    </div>
  );
}

function ScenarioPicker({
  scenarios,
  current,
  onPick,
}: {
  scenarios: AnySimDefinition["scenarios"];
  current: number;
  onPick: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const num = (i: number) => String(i + 1).padStart(2, "0");
  return (
    <div className="relative flex min-w-0 items-center gap-1">
      <Button tone="ghost" disabled={current === 0} onClick={() => onPick(current - 1)} title="Previous scenario">
        ‹
      </Button>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={scenarios[current].title}
        className="flex min-w-0 items-center gap-2 rounded-md border border-line bg-panel-2 px-3 py-1.5 text-left hover:border-fg-muted"
      >
        <span className="shrink-0 font-mono text-xs text-fg-muted">
          {num(current)}/{scenarios.length}
        </span>
        <span className="truncate text-base font-semibold text-fg">{scenarios[current].title}</span>
        <span className="text-xs text-fg-muted">▾</span>
      </button>
      <Button
        tone="ghost"
        disabled={current === scenarios.length - 1}
        onClick={() => onPick(current + 1)}
        title="Next scenario"
      >
        ›
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <ul className="absolute left-8 top-full z-40 mt-1 w-[440px] rounded-lg border border-line bg-panel p-1.5 shadow-2xl">
            {scenarios.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onPick(i);
                  }}
                  className={cx(
                    "w-full rounded-md px-3 py-2 text-left transition-colors",
                    i === current ? "bg-accent/10" : "hover:bg-panel-2",
                  )}
                >
                  <div className="flex gap-2 text-sm text-fg">
                    <span className="font-mono text-xs leading-5 text-fg-muted">{num(i)}</span>
                    <span className="font-medium">{s.title}</span>
                  </div>
                  <p className="mt-0.5 pl-7 text-[13px] leading-snug text-fg-muted">{s.summary}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function LogFeed({
  log,
  version,
  now,
  onPick,
}: {
  log: LogEntry[];
  version: number;
  now: number;
  onPick: (e: LogEntry) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [version]);
  const shown = log.slice(-150);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 pb-1.5 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">What just happened</h3>
        <span className="text-xs text-fg-muted">click to jump there</span>
      </div>
      <div ref={box} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {shown.length === 0 && <p className="px-1 text-sm text-fg-muted">Nothing yet.</p>}
        {shown.map((e, i) => (
          <button
            key={log.length - shown.length + i}
            type="button"
            onClick={() => onPick(e)}
            className={cx(
              "block w-full rounded-md border-l-2 bg-panel-2 px-3 py-2 text-left transition-opacity hover:bg-line/40",
              e.level === "error" && "border-err",
              e.level === "warn" && "border-warn",
              e.level === "ok" && "border-ok",
              e.level === "info" && "border-accent",
              e.t > now && "opacity-40",
            )}
          >
            <div className="flex gap-2.5 text-sm text-fg">
              <span className="shrink-0 font-mono text-xs leading-5 text-fg-muted">{fmt(e.t)}</span>
              <span className="leading-5">{e.text}</span>
            </div>
            {e.detail && <p className="mt-1 pl-11 text-[13px] leading-snug text-fg-muted">{e.detail}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
