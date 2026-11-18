"use client";

import { InspectorHeader } from "@/components/inspector";
import { Button, Glossed, Help, Pill, Section, Stat, StatGrid, Toggle } from "@/components/ui";
import { BROKERS, brokerLabel, isLeader, list, secs, type Action, type BrokerId, type State } from "../model";
import { brokerCondition, brokerRole } from "../theme";

/** One broker: break it, and see its replica from the leader's or follower's side. */
export function BrokerPanel({ s, b, now, dispatch }: { s: State; b: BrokerId; now: number; dispatch: (a: Action) => void }) {
  const br = s.brokers[b];
  const cond = brokerCondition(s, b);
  const role = brokerRole(s, b);
  const leads = isLeader(br) && s.ctl.leader === b;
  return (
    <div>
      <InspectorHeader kind={`broker · ${role.text}`} title={brokerLabel(b)} status={<Pill tone={cond.tone}>{cond.text}</Pill>} />
      <Section title="Break it">
        <Toggle
          tone="danger"
          label="Stall replica fetcher"
          help="Stops fetching from the leader but keeps heartbeating. Only matters while this broker is a follower."
          checked={br.stalled}
          onChange={(on) => dispatch({ type: "set-stall", b, on })}
        />
        <Toggle
          tone="danger"
          label="Cut network"
          help="Isolates the broker: no Produce, no Fetch, no heartbeats. The process keeps running."
          checked={br.cut}
          onChange={(on) => dispatch({ type: "set-cut", b, on })}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {br.up ? (
            <Button tone="danger" onClick={() => dispatch({ type: "crash", b })}>
              Crash {brokerLabel(b)}
            </Button>
          ) : (
            <Button tone="primary" onClick={() => dispatch({ type: "restart", b })}>
              Restart {brokerLabel(b)}
            </Button>
          )}
        </div>
      </Section>
      <Section title="Replica">
        <StatGrid cols={3}>
          <Stat label="LEO" value={br.log.length} />
          <Stat label="HW" value={br.hw} />
          <Stat label="epoch" value={br.view.epoch} />
        </StatGrid>
      </Section>
      {leads ? (
        <Section title="As leader">
          <table className="mt-1 w-full font-mono text-note">
            <thead className="text-fg-muted">
              <tr>
                <th className="text-left font-normal">follower</th>
                <th className="text-right font-normal">fetch offset</th>
                <th className="text-right font-normal">caught up</th>
                <th className="text-right font-normal">ISR</th>
              </tr>
            </thead>
            <tbody>
              {BROKERS.filter((f) => f !== b).map((f) => {
                const st = br.followers[f];
                return (
                  <tr key={f} className="text-fg">
                    <td>{brokerLabel(f)}</td>
                    <td className="text-right">{st?.leo ?? "—"}</td>
                    <td className="text-right">{st ? `${secs(Math.max(0, now - st.lastCaughtUpAt))} ago` : "—"}</td>
                    <td className="text-right">{s.ctl.isr.includes(f) ? "yes" : "no"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Help>
            <Glossed>
              {`ISR ${list(s.ctl.isr)}. acks=all writes waiting: ${br.waiting.length}. A follower that hasn't caught up for replica.lag.time.max.ms (${secs(s.settings.lagMaxMs)} here) leaves the ISR.`}
            </Glossed>
          </Help>
        </Section>
      ) : (
        <Section title="As follower">
          <Help>
            <Glossed>
              {s.ctl.isr.includes(b)
                ? "In the ISR: the high watermark waits for this replica."
                : s.ctl.elr.includes(b)
                  ? "Out of the ISR but in the ELR: it holds every committed record, so the controller may still elect it."
                  : "Out of the ISR. It rejoins once its log end offset reaches the leader's high watermark."}
            </Glossed>
          </Help>
        </Section>
      )}
      <Section title="Reading the tape">
        <Help>
          <Glossed>
            A broker holds one replica of orders-0. The tape shows its log: one cell per offset, the record number inside, coloured by the leader epoch that wrote it, and solid below this replica&apos;s HW.
          </Glossed>
        </Help>
      </Section>
    </div>
  );
}
