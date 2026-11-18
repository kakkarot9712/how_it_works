"use client";

import { ConfigLine, InspectorHeader } from "@/components/inspector";
import { Glossed, Help, Section, Stat, StatGrid } from "@/components/ui";
import { LANE_INFO, maxFails, percentile, secs, SERVER_COUNT, serverLabel, srvNode, weightOf, type LaneId, type State } from "../model";
import { peerView } from "../theme";

const HOW: Record<LaneId, string[]> = {
  rr: [
    "The default method: weighted round robin. With equal weights, servers take strict turns.",
    "nginx's version is smooth: each pick adds every server's weight to its current_weight, takes the highest, then subtracts the total from the winner. With weight=3 on a and weight=1 on b and c, five picks go a, b, a, c, a rather than a, a, a, b, c.",
    "It never looks at how busy a server is.",
  ],
  random: [
    "random; picks a server at random, in proportion to its weight.",
    "Like round robin, it ignores how busy a server is. Over many requests the shares even out; over a few seconds they don't.",
  ],
  lc: [
    "least_conn; sends the request to the server with the fewest active connections, divided by weight.",
    "Ties are broken by weighted round robin among the tied servers.",
    "A connection is active from the moment nginx sends a request until the response (or failure) comes back. A slow or stuck server holds its connections, so it gets fewer new ones.",
  ],
  p2c: [
    "random two; picks two different servers at random (by weight), then sends the request to the one with fewer active connections. least_conn is the default method for the pair.",
    "It only compares two servers, so it can pick a busy one when both picks are busy.",
  ],
};

/** One nginx upstream group: its config in real syntax, nginx's per-server state, and its results. */
export function BalancerPanel({ s, lane, now, select }: { s: State; lane: LaneId; now: number; select: (id: string) => void }) {
  const L = s.lanes[lane];
  const info = LANE_INFO[lane];
  const mf = maxFails(s);
  const servers = Array.from({ length: SERVER_COUNT }, (_, i) => {
    const params = [weightOf(s, i) !== 1 ? `weight=${weightOf(s, i)}` : "", `max_fails=${mf}`, `fail_timeout=${s.settings.failTimeoutS}s`].filter(Boolean).join(" ");
    return `    server ${serverLabel(i)} ${params};`;
  });
  const config = [
    "upstream api {",
    ...(lane === "rr" ? [] : [`    ${info.directive}`]),
    ...servers,
    "}",
    `proxy_next_upstream ${s.components.nextUpstream ? "error timeout" : "off"};`,
    `proxy_read_timeout ${s.settings.readTimeoutS}s;`,
  ].join("\n");
  const p50 = percentile(L.stats.recent, 50);
  const p95 = percentile(L.stats.recent, 95);

  return (
    <div>
      <InspectorHeader kind="nginx upstream group" title={info.title} />
      <Section title="Config">
        <ConfigLine>{config}</ConfigLine>
        <Help>Timeouts are scaled to the slow-motion clock.</Help>
      </Section>
      <Section title="nginx's view of each server">
        <table className="mt-1 w-full font-mono text-note">
          <thead className="text-fg-muted">
            <tr>
              <th className="text-left font-normal">server</th>
              <th className="text-right font-normal">active</th>
              <th className="text-right font-normal">fails</th>
              <th className="text-right font-normal">sent</th>
              <th className="text-right font-normal">state</th>
            </tr>
          </thead>
          <tbody>
            {L.peers.map((p, i) => {
              const v = peerView(s, lane, i, now);
              return (
                <tr key={i} className="cursor-pointer text-fg hover:text-accent" onClick={() => select(srvNode(lane, i))}>
                  <td>{serverLabel(i)}</td>
                  <td className="text-right">{p.conns}</td>
                  <td className="text-right">{p.fails}</td>
                  <td className="text-right">{L.stats.sent[i]}</td>
                  <td className="text-right text-fg-muted">{v.tone === "muted" ? "available" : v.text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lane !== "random" && lane !== "p2c" && (
          <Help>
            current_weight: {L.peers.map((p) => p.currentWeight).join(" / ")} · effective_weight: {L.peers.map((p) => p.effectiveWeight).join(" / ")}
          </Help>
        )}
      </Section>
      <Section title="Stats">
        <StatGrid cols={3}>
          <Stat label="ok" value={L.stats.ok} />
          <Stat label="5xx to client" value={L.stats.errors} tone={L.stats.errors ? "err" : undefined} />
          <Stat label="retries" value={L.stats.retries} tone={L.stats.retries ? "warn" : undefined} />
          <Stat label="p50 · median" value={p50 === null ? "—" : secs(p50)} />
          <Stat label="p95 · tail" value={p95 === null ? "—" : secs(p95)} />
          <Stat label="worst" value={secs(L.stats.worst)} />
        </StatGrid>
        <Help>
          Response times of the last 50 normal (not heavy) requests, measured at nginx. p50: half of them were faster. p95: 95 in
          100 were at least this fast, so it shows the slowest 5%. Worst includes heavy requests.
        </Help>
      </Section>
      <Section title="How it picks">
        <Glossed>
          <ul className="list-disc space-y-1 pl-4 text-note leading-snug text-fg-muted">
            {HOW[lane].map((t) => (
              <li key={t}>{t}</li>
            ))}
            <li>Every method skips servers that reached max_fails within fail_timeout, and servers this request already tried.</li>
          </ul>
        </Glossed>
      </Section>
    </div>
  );
}
