"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Glossed, Help, Section, Stat, StatGrid } from "@/components/ui";
import { status, TABLE, type State } from "../model";

/** The table: every row version with its xmin/xmax, as SELECT xmin, xmax, * would show the visible ones. */
export function HeapPanel({ s }: { s: State }) {
  const dead = s.versions.filter((v) => status(s, v.xmin) === "aborted" || (v.xmax !== null && status(s, v.xmax) === "committed")).length;
  return (
    <div>
      <InspectorHeader kind="table · heap" title={TABLE} />
      <Section title="Row versions">
        <ConfigLine>{`SELECT xmin, xmax, * FROM ${TABLE};`}</ConfigLine>
        <table className="mt-2 w-full font-mono text-note">
          <thead className="text-fg-muted">
            <tr>
              <th className="text-left font-normal">id</th>
              <th className="text-right font-normal">balance</th>
              <th className="text-right font-normal">xmin</th>
              <th className="text-right font-normal">xmax</th>
              <th className="text-right font-normal">xmin is</th>
            </tr>
          </thead>
          <tbody>
            {s.versions.map((v) => (
              <tr key={v.n} className={status(s, v.xmin) === "aborted" ? "text-fg-muted line-through" : "text-fg"}>
                <td>{v.row}</td>
                <td className="text-right">{v.balance}</td>
                <td className="text-right">{v.xmin}</td>
                <td className="text-right">{v.xmax ?? 0}</td>
                <td className="text-right text-fg-muted">{status(s, v.xmin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="Stats">
        <StatGrid>
          <Stat label="row versions" value={s.versions.length} />
          <Stat label="dead versions" value={dead} />
          <Stat label="lost updates" value={s.lostUpdates} tone={s.lostUpdates ? "err" : undefined} />
          <Stat label="rule broken" value={s.ruleBroken ? "yes" : "no"} tone={s.ruleBroken ? "err" : undefined} />
        </StatGrid>
      </Section>
      <Section title="Under the hood">
        <Glossed>
          <ul className="list-disc space-y-1 pl-4 text-note leading-snug text-fg-muted">
            <li>xmin is the transaction that created a row version; xmax the one that deleted or replaced it (0 if none).</li>
            <li>An UPDATE writes a new version and sets xmax on the old one. Readers pick the version their snapshot allows, so reading never blocks writing.</li>
            <li>A row version whose xmin aborted, or whose xmax committed, is dead. VACUUM removes dead versions later; this simulation keeps them.</li>
          </ul>
        </Glossed>
        <Help>The canvas shows each row&apos;s newest three versions and, on the right, which session&apos;s snapshot would see each one.</Help>
      </Section>
    </div>
  );
}
