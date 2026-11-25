"use client";

import { useState, type KeyboardEvent } from "react";
import { Button, Eyebrow, gloss, Heading, IconButton, Surface } from "@/components/ui";
import { TraceDiagram } from "./TraceDiagram";
import { traceStateAt, type TraceSpec } from "./trace";

/**
 * The Trace step format: follow one request hop by hop. A sequence diagram on top
 * (click a row to jump) whose actor boxes show each actor's state, lighting up what the
 * hop changed; below it the hop's explanation and the changes in words. Sized to fit one
 * screen. ← / → step when the trace has focus.
 */
export function Trace({ spec, title }: { spec: TraceSpec; title?: string }) {
  const [at, setAt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const last = spec.hops.length - 1;
  const go = (i: number) => setAt(Math.max(0, Math.min(last, i)));
  const hop = spec.hops[at];
  // Concept terms are marked on their first use in each hop's title and body.
  const hopSeen = new Set<string>();
  const { state, changed } = traceStateAt(spec, at);
  const before = traceStateAt(spec, at - 1).state;
  // What this hop changed, in words: "broker-1 · High watermark (HW) 0 → 1".
  const changes = [...changed].map((key) => {
    const [actor, field] = key.split(".");
    return {
      key,
      actor: spec.actors.find((a) => a.id === actor)?.label ?? actor,
      field: spec.state?.fields.find((f) => f.id === field)?.label ?? field,
      from: before[actor]?.[field] ?? "–",
      to: state[actor][field],
    };
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") go(at + 1);
    else if (e.key === "ArrowLeft") go(at - 1);
    else return;
    e.preventDefault();
  };

  return (
    <div className="not-prose my-8 space-y-3" onKeyDown={onKey}>
      <Surface className="overflow-x-auto p-3">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          {title ? <Eyebrow>{title}</Eyebrow> : <span />}
          <Button tone="ghost" onClick={() => setExpanded((x) => !x)}>
            {expanded ? "Show fewer hops" : `Show all ${spec.hops.length} hops`}
          </Button>
        </div>
        <TraceDiagram
          actors={spec.actors}
          hops={spec.hops}
          at={at}
          onPick={go}
          expanded={expanded}
          fields={spec.state?.fields}
          state={state}
          changed={changed}
        />
      </Surface>

      <Surface className="px-5 py-4" as="section">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow tone="accent">
            Hop {at + 1} of {spec.hops.length}
          </Eyebrow>
          <div className="flex items-center gap-1">
            <IconButton label="Back to the first hop" onClick={() => go(0)} disabled={at === 0}>
              ⏮
            </IconButton>
            <IconButton label="Previous hop (←)" onClick={() => go(at - 1)} disabled={at === 0}>
              ‹
            </IconButton>
            <IconButton label="Next hop (→)" onClick={() => go(at + 1)} disabled={at === last}>
              ›
            </IconButton>
          </div>
        </div>
        <Heading level="card" as="h3" className="mt-2">
          {gloss(hop.title, { seen: hopSeen })}
        </Heading>
        <div aria-live="polite" className="mt-2 text-body leading-relaxed text-fg-muted [&_code]:rounded [&_code]:bg-panel-2 [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm [&_code]:text-fg [&_strong]:font-semibold [&_strong]:text-fg">
          {gloss(hop.body, { seen: hopSeen })}
        </div>
        {hop.simplified && gloss(hop.simplified, { seen: hopSeen })}

        {spec.state && (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-note text-fg-muted">
            <Eyebrow as="span" size="sm">
              Changed
            </Eyebrow>
            {changes.length === 0
              ? "nothing: watch the next hop"
              : changes.map((c) => (
                  <span key={c.key}>
                    {c.actor} · {gloss(c.field)}{" "}
                    <span className="font-mono">
                      {c.from} → <span className="font-semibold text-accent">{c.to}</span>
                    </span>
                  </span>
                ))}
          </p>
        )}
      </Surface>
    </div>
  );
}
