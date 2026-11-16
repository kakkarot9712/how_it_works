"use client";

import { useRef } from "react";
import type { LogEntry } from "@/engine/types";
import { Button, cx, IconButton, Pill, SegmentedControl } from "@/components/ui";
import { secs } from "@/lib/format";


const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

export function Timeline({
  now,
  horizon,
  log,
  playing,
  speed,
  onPlay,
  onStep,
  onRestart,
  onSeek,
  onSpeed,
  note,
}: {
  now: number;
  horizon: number;
  log: LogEntry[];
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onStep: () => void;
  onRestart: () => void;
  onSeek: (t: number) => void;
  onSpeed: (s: number) => void;
  /** Slow-motion disclosure, shown as a hoverable badge. */
  note?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const range = Math.max(30_000, Math.ceil((Math.max(horizon, now) + 5_000) / 10_000) * 10_000);
  const pct = (t: number) => `${Math.min(100, (t / range) * 100)}%`;

  const seekFromPointer = (clientX: number) => {
    const el = track.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onSeek(f * range);
  };

  const markers = log.filter((l) => l.level === "error" || l.level === "warn");
  const ticks = Array.from({ length: range / 10_000 + 1 }, (_, i) => i * 10_000);

  return (
    <div className="flex items-center gap-3 border-t border-line bg-panel px-4 py-2.5">
      <div className="flex items-center gap-1">
        <IconButton label="Restart from 0s" onClick={onRestart}>
          ⏮
        </IconButton>
        <Button tone="primary" onClick={onPlay} title="Play / pause (Space)" className="w-24 whitespace-nowrap">
          {playing ? "❚❚ Pause" : "▶ Play"}
        </Button>
        <Button tone="ghost" onClick={onStep} title="Process the next single event (.)">
          Step ›
        </Button>
      </div>

      <div className="w-16 text-right font-mono text-sm text-fg">{secs(now)}</div>

      <div
        ref={track}
        className="relative h-8 flex-1 cursor-pointer select-none"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && seekFromPointer(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
      >
        <div className="absolute inset-x-0 top-3.5 h-1 rounded bg-panel-2" />
        <div className="absolute left-0 top-3.5 h-1 rounded bg-fg-muted/30" style={{ width: pct(horizon) }} />
        <div className="absolute left-0 top-3.5 h-1 rounded bg-accent" style={{ width: pct(now) }} />
        {ticks.map((t) => (
          <div key={t} className="absolute top-6 -translate-x-1/2 font-mono text-2xs text-fg-muted" style={{ left: pct(t) }}>
            {t / 1000}s
          </div>
        ))}
        {markers.map((m, i) => (
          <div
            key={i}
            title={`${secs(m.t)} ${m.text}`}
            className={cx("absolute top-1 h-2 w-0.5 -translate-x-1/2 rounded", m.level === "error" ? "bg-err" : "bg-warn")}
            style={{ left: pct(m.t) }}
          />
        ))}
        <div
          className="absolute top-2 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-accent bg-bg"
          style={{ left: pct(now) }}
        />
      </div>

      <SegmentedControl label="Playback speed" options={SPEEDS} value={speed} onChange={onSpeed} format={(s) => `${s}×`} />
      {note && <Pill title={note}>slow motion ⓘ</Pill>}
    </div>
  );
}
