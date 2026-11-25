"use client";

import { useState } from "react";
import { Compare } from "@/components/writeup";
import { Help, Pill, Slider, Surface, Toggle } from "@/components/ui";
import { schedule, type SchedNode } from "./schedule";

const NODES: SchedNode[] = [
  { name: "node-1", cpu: 4000, mem: 8192, usedCpu: 3500, usedMem: 2048 },
  { name: "node-2", cpu: 4000, mem: 8192, usedCpu: 1000, usedMem: 6144 },
  { name: "node-3", cpu: 2000, mem: 4096, usedCpu: 500, usedMem: 1024 },
  { name: "node-4", cpu: 8000, mem: 16384, usedCpu: 0, usedMem: 0, taint: "gpu=true:NoSchedule" },
];

const free = (n: SchedNode) => `${n.cpu - n.usedCpu}m, ${n.mem - n.usedMem}Mi`;

/**
 * Explore step widget: set a Pod's requests and toleration, cordon a node, and watch a port of
 * kube-scheduler's default filters and resource scores (schedule.ts, checked against v1.37.2)
 * pick a node, or fail with the scheduler's own "0/N nodes are available" message.
 */
export function NodePicker() {
  const [cpu, setCpu] = useState(500);
  const [mem, setMem] = useState(1024);
  const [tolerates, setTolerates] = useState(false);
  const [cordon, setCordon] = useState(false);

  const nodes = NODES.map((n) => (n.name === "node-3" ? { ...n, unschedulable: cordon } : n));
  const r = schedule(nodes, { cpu, mem, tolerates });
  const feasible = r.nodes.filter((x) => x.filter.plugin === null).length;

  return (
    <Surface className="not-prose my-8 overflow-hidden">
      <div className="grid gap-4 border-b border-line px-4 py-4 sm:grid-cols-2">
        <Slider label="Pod CPU request" value={cpu} min={100} max={4000} step={100} unit="m" onChange={setCpu} />
        <Slider label="Pod memory request" value={mem} min={128} max={8192} step={128} unit="Mi" onChange={setMem} />
        <Toggle label="Pod tolerates gpu=true:NoSchedule" checked={tolerates} onChange={setTolerates} help="node-4 carries this taint." />
        <Toggle label="Cordon node-3" checked={cordon} onChange={setCordon} help="Sets spec.unschedulable, as kubectl cordon does." />
      </div>

      <div className="px-4">
        <Compare
          head={["Node", "Free", "Filters", "LeastAllocated", "Balanced", "Total"]}
          rows={r.nodes.map((x) => [
            <span key="n" className="block">
              <span className="flex items-center gap-2">
              {x.node.name}
              {r.tied.includes(x.node.name) ? (
                <Pill size="sm" tone="warn">
                  tied
                </Pill>
              ) : (
                r.chosen === x.node.name && (
                  <Pill size="sm" tone="ok">
                    chosen
                  </Pill>
                )
              )}
              </span>
              {x.node.taint && <span className="block font-mono text-2xs font-normal text-warn">{x.node.taint}</span>}
            </span>,
            <span key="f" className="font-mono">
              {free(x.node)}
            </span>,
            x.filter.plugin ? (
              <span key="x" className="text-err">
                {x.filter.plugin}: {x.filter.reasons.join(", ")}
              </span>
            ) : (
              <span key="x" className="text-ok">
                passes
              </span>
            ),
            x.scores ? <span key="l" className="font-mono">{x.scores.least}</span> : "—",
            x.scores ? <span key="b" className="font-mono">{x.scores.balanced}</span> : "—",
            x.scores ? (
              <span key="t" className="font-mono text-fg">
                {x.scores.total}
              </span>
            ) : (
              "—"
            ),
          ])}
        />
      </div>

      <div className="space-y-2 border-t border-line px-4 py-3">
        {r.chosen === null ? (
          <p className="font-mono text-note text-err">Pending · {r.message}</p>
        ) : (
          <p className="font-mono text-note text-fg">
            {r.tied.length > 0 ? (
              <>
                Binding → one of <span className="text-accent">{r.tied.join(", ")}</span>
                <span className="text-fg-muted"> (tied on the top score: the scheduler picks among them at random)</span>
              </>
            ) : (
              <>
                Binding → <span className="text-accent">{r.chosen}</span>
                {feasible === 1 && <span className="text-fg-muted"> (the only feasible node, so scoring is skipped)</span>}
              </>
            )}
          </p>
        )}
        <Help>
          Scores are 0 to 100 per plugin, multiplied by the plugin&apos;s weight (1 for both here) and summed. A node rejected by any filter is
          never scored.
        </Help>
      </div>
    </Surface>
  );
}
