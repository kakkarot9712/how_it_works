"use client";

import { InspectorHeader } from "@/components/inspector";
import { Button, Help, Pill, Section, Slider, Stat, StatGrid, Toggle } from "@/components/ui";
import { LANE_INFO, LANES, serverLabel, type Action, type LaneId, type State } from "../model";
import { peerView, serverCondition } from "../theme";

/** A backend server: break it (in every group at once) and compare how each group treats it. */
export function ServerPanel({ s, lane, i, now, dispatch }: { s: State; lane: LaneId; i: number; now: number; dispatch: (a: Action) => void }) {
  const srv = s.servers[i];
  const cond = serverCondition(s, i);
  const b = s.lanes[lane].backends[i];
  return (
    <div>
      <InspectorHeader kind={`backend · ${LANE_INFO[lane].title} group`} title={serverLabel(i)} status={<Pill tone={cond.tone}>{cond.text}</Pill>} />
      <Section title="Break it (all four groups)">
        <Slider
          label="Speed"
          value={srv.speed}
          min={0.25}
          max={4}
          step={0.25}
          unit="×"
          help="Below 1 it is slower than its peers (a noisy neighbour, a GC pause). Applies to requests that start from now on."
          onChange={(speed) => dispatch({ type: "set-speed", server: i, speed })}
        />
        <Toggle
          tone="danger"
          label="Stop responding"
          help="Still accepts connections, never answers. nginx waits for proxy_read_timeout."
          checked={srv.hung}
          onChange={(on) => dispatch({ type: "set-hang", server: i, on })}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {srv.crashed ? (
            <Button tone="primary" onClick={() => dispatch({ type: "restart", server: i })}>
              Restart {serverLabel(i)}
            </Button>
          ) : (
            <Button tone="danger" onClick={() => dispatch({ type: "crash", server: i })}>
              Crash {serverLabel(i)}
            </Button>
          )}
        </div>
        <Help>Each group has its own copy of {serverLabel(i)}; these controls change all four copies, so the comparison stays fair.</Help>
      </Section>
      <Section title="This copy">
        <StatGrid cols={3}>
          <Stat label="working" value={`${b.working.length}/${s.settings.workers}`} />
          <Stat label="queued" value={b.queue.length} tone={b.queue.length >= s.settings.workers * 2 ? "warn" : undefined} />
          <Stat label="done" value={b.done} />
        </StatGrid>
      </Section>
      <Section title="In each group">
        <table className="mt-1 w-full font-mono text-note">
          <thead className="text-fg-muted">
            <tr>
              <th className="text-left font-normal">group</th>
              <th className="text-right font-normal">queued</th>
              <th className="text-right font-normal">sent</th>
              <th className="text-right font-normal">nginx sees</th>
            </tr>
          </thead>
          <tbody>
            {LANES.map((l) => {
              const v = peerView(s, l, i, now);
              return (
                <tr key={l} className={l === lane ? "text-accent" : "text-fg"}>
                  <td>{LANE_INFO[l].title}</td>
                  <td className="text-right">{s.lanes[l].backends[i].queue.length}</td>
                  <td className="text-right">{s.lanes[l].stats.sent[i]}</td>
                  <td className="text-right">{v.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Help>sent: attempts nginx made to this server, retries included.</Help>
      </Section>
    </div>
  );
}
