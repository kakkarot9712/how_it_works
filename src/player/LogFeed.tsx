"use client";

import { useEffect, useRef } from "react";
import type { LogEntry } from "@/engine/types";
import { cx, Eyebrow, gloss, PanelHeader, toneBorder, type Tone } from "@/components/ui";
import { secs } from "@/lib/format";

const LEVEL_TONE: Record<LogEntry["level"], Tone> = { error: "err", warn: "warn", ok: "ok", info: "accent" };

/** Narration: the model's log, newest at the bottom. Click an entry to jump there (and select its node). */
export function LogFeed({
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
    <div className="flex min-h-[200px] flex-1 flex-col">
      <PanelHeader divider={false} actions={<span className="text-xs text-fg-muted">click to jump there</span>}>
        <Eyebrow as="h3">What just happened</Eyebrow>
      </PanelHeader>
      <div ref={box} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3">
        {shown.length === 0 && <p className="px-1 text-sm text-fg-muted">Nothing yet.</p>}
        {shown.map((e, i) => (
          <button
            key={log.length - shown.length + i}
            type="button"
            onClick={() => onPick(e)}
            className={cx(
              "block w-full rounded-md border-l-2 bg-panel-2 px-3 py-2 text-left transition-opacity hover:bg-line/40",
              toneBorder[LEVEL_TONE[e.level]],
              e.t > now && "opacity-40",
            )}
          >
            <div className="flex gap-2.5 text-sm text-fg">
              <span className="shrink-0 font-mono text-xs leading-5 text-fg-muted">{secs(e.t)}</span>
              <span className="leading-5">{gloss(e.text, { focusable: false })}</span>
            </div>
            {e.detail && <p className="mt-1 pl-11 text-note leading-snug text-fg-muted">{gloss(e.detail, { focusable: false })}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
