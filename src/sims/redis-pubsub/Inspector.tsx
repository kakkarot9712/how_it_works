"use client";

import type { ReactNode } from "react";
import type { ViewProps } from "@/sims/types";
import { Button, Pill, Section, Slider, Stat, Toggle } from "@/components/ui";
import { subStatus, CHANNEL_COLOR } from "./Canvas";
import { CHANNELS, derived, kb, SERVER, type Action, type State } from "./model";

export function Inspector({ state: s, selected, dispatch, select, now }: ViewProps<State, Action>) {
  if (selected && s.publishers[selected]) return <PublisherPanel s={s} id={selected} dispatch={dispatch} />;
  if (selected && s.subscribers[selected]) return <SubscriberPanel s={s} id={selected} dispatch={dispatch} />;
  if (selected?.startsWith("buf:") && s.subscribers[selected.slice(4)])
    return <BufferPanel s={s} id={selected.slice(4)} now={now} select={select} />;
  if (selected === SERVER) return <ServerPanel s={s} dispatch={dispatch} />;

  return (
    <Section title="Inspector">
      <p className="text-sm leading-relaxed text-fg-muted">
        Click any box in the diagram to inspect it and take control: stall a subscriber, cut its network, kill its
        connection, crash Redis, or publish by hand.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {[...s.pubIds, SERVER, ...s.subIds].map((id) => (
          <Button key={id} onClick={() => select(id)}>
            {id === SERVER ? "redis-server" : (s.publishers[id]?.label ?? s.subscribers[id]?.label)}
          </Button>
        ))}
      </div>
    </Section>
  );
}

function Header({ kind, title, pill }: { kind: string; title: string; pill?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-4 py-3">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-fg-muted">{kind}</div>
        <div className="text-base font-semibold text-fg">{title}</div>
      </div>
      {pill}
    </div>
  );
}

function PublisherPanel({ s, id, dispatch }: { s: State; id: string; dispatch: (a: Action) => void }) {
  const p = s.publishers[id];
  return (
    <div>
      <Header kind="publisher" title={p.label} pill={<Pill tone={p.auto ? "ok" : "muted"}>{p.auto ? "publishing" : "paused"}</Pill>} />
      <Section title="Publish by hand">
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((ch) => (
            <Button key={ch} onClick={() => dispatch({ type: "publish", pub: id, channel: ch })}>
              <span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_COLOR[ch] }} />
              PUBLISH {ch}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-[13px] leading-snug text-fg-muted">
          Nobody subscribes to <code className="text-fg">refunds</code>. Try it and watch the reply.
        </p>
      </Section>
      <Section title="Traffic">
        <Toggle label={`Auto-publish to ${p.channel}`} checked={p.auto} onChange={(on) => dispatch({ type: "set-auto", pub: id, on })} />
        <Slider
          label="Interval"
          value={p.intervalMs}
          min={150}
          max={2000}
          step={50}
          unit="ms"
          onChange={(ms) => dispatch({ type: "set-interval", pub: id, ms })}
        />
        <Slider
          label="Payload size"
          value={p.payloadBytes}
          min={128}
          max={4096}
          step={128}
          unit=" B"
          help="Bigger messages fill output buffers faster."
          onChange={(bytes) => dispatch({ type: "set-payload", pub: id, bytes })}
        />
      </Section>
      <Section title="Stats">
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="sent" value={p.sent} />
          <Stat
            label="last reply"
            value={p.lastReply?.text ?? "—"}
            tone={p.lastReply?.error ? "err" : p.lastReply?.text === "(integer) 0" ? "warn" : undefined}
          />
        </div>
        <p className="mt-2 text-[13px] leading-snug text-fg-muted">
          PUBLISH replies with the number of clients that received the message. It is the only feedback a publisher
          gets. There is no acknowledgement from subscribers.
        </p>
      </Section>
    </div>
  );
}

function SubscriberPanel({ s, id, dispatch }: { s: State; id: string; dispatch: (a: Action) => void }) {
  const sub = s.subscribers[id];
  const st = subStatus(sub);
  return (
    <div>
      <Header kind="subscriber" title={sub.label} pill={<Pill tone={st.tone}>{st.text}</Pill>} />
      <Section title="Break it">
        <Toggle
          tone="danger"
          label="Stop reading the socket"
          help="The app is stuck: GC pause, deadlock, a slow handler."
          checked={sub.blocked}
          onChange={(on) => dispatch({ type: "set-blocked", sub: id, on })}
        />
        <Toggle
          tone="danger"
          label="Cut the network link"
          help="Packets vanish. Neither side is told."
          checked={!sub.linkUp}
          onChange={(v) => dispatch({ type: "set-link", sub: id, up: !v })}
        />
        <Slider
          label="Time to handle one message"
          value={sub.processMs}
          min={50}
          max={2000}
          step={50}
          unit="ms"
          help="Slower than the incoming rate means the backlog grows."
          onChange={(ms) => dispatch({ type: "set-process-ms", sub: id, ms })}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Button tone="danger" disabled={!sub.registered || !s.server.up} onClick={() => dispatch({ type: "client-kill", sub: id })}>
            CLIENT KILL
          </Button>
          {sub.client === "offline" ? (
            <Button tone="primary" onClick={() => dispatch({ type: "go-online", sub: id })}>
              Bring online
            </Button>
          ) : (
            <Button onClick={() => dispatch({ type: "go-offline", sub: id })}>Take offline</Button>
          )}
        </div>
      </Section>
      <Section title="Stats">
        <div className="grid grid-cols-3 gap-1.5">
          <Stat label="received" value={sub.received} />
          <Stat label="missed" value={sub.missed} tone={sub.missed ? "warn" : undefined} />
          <Stat label="lost" value={sub.lost} tone={sub.lost ? "err" : undefined} />
          <Stat label="disconnects" value={sub.disconnects} tone={sub.disconnects ? "warn" : undefined} />
          <Stat label="unread" value={sub.rx.length} />
          <Stat label="buffer" value={kb(sub.obufBytes)} />
        </div>
        <p className="mt-2 text-[13px] leading-snug text-fg-muted">
          <b className="text-fg">missed</b>: published while not subscribed. <b className="text-fg">lost</b>: sat in
          Redis&apos;s output buffer when the connection was closed. Neither can be recovered.
        </p>
      </Section>
    </div>
  );
}

function BufferPanel({ s, id, now, select }: { s: State; id: string; now: number; select: (id: string) => void }) {
  const sub = s.subscribers[id];
  const cfg = s.components.limits
    ? `client-output-buffer-limit pubsub ${s.settings.hardKb}kb ${s.settings.softKb}kb ${s.settings.softSeconds}`
    : "client-output-buffer-limit pubsub 0 0 0";
  return (
    <div>
      <Header kind="client output buffer" title={sub.label} />
      <Section title="What this is">
        <p className="text-sm leading-relaxed text-fg-muted">
          Memory inside Redis holding replies that could not be written to the socket yet. Redis never blocks on a slow
          client. It keeps the data here, so a slow reader costs Redis RAM.
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md bg-bg px-2 py-1.5 font-mono text-[13px] text-fg">{cfg}</pre>
        <p className="mt-1.5 text-[13px] leading-snug text-fg-muted">
          Default is <code>32mb 8mb 60</code>. The values here are scaled down to fit slow motion.
          {!s.components.limits && " 0 0 0 means no limit at all."}
        </p>
      </Section>
      <Section title="Live">
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="size" value={kb(sub.obufBytes)} />
          <Stat label="messages" value={sub.obuf.length} />
          <Stat label="peak" value={kb(sub.peakBytes)} />
          <Stat
            label="over soft for"
            value={sub.softSince !== null ? `${((now - sub.softSince) / 1000).toFixed(1)}s` : "—"}
            tone={sub.softSince !== null ? "warn" : undefined}
          />
          <Stat label="in TCP window" value={`${sub.inflight} / ${s.settings.window}`} />
          <Stat label="dropped so far" value={sub.lost} tone={sub.lost ? "err" : undefined} />
        </div>
        <Button className="mt-2" onClick={() => select(id)}>
          Control {sub.label} →
        </Button>
      </Section>
    </div>
  );
}

function ServerPanel({ s, dispatch }: { s: State; dispatch: (a: Action) => void }) {
  const mem = derived(s).memBytes;
  return (
    <div>
      <Header kind="server" title="redis-server" pill={<Pill tone={s.server.up ? "ok" : "err"}>{s.server.up ? "up" : "down"}</Pill>} />
      <Section title="Break it">
        <div className="flex flex-wrap gap-1.5">
          <Button tone="danger" disabled={!s.server.up} onClick={() => dispatch({ type: "crash-server" })}>
            Crash redis-server
          </Button>
          <Button disabled={s.server.up} onClick={() => dispatch({ type: "restart-server" })}>
            Restart now
          </Button>
        </div>
        <p className="mt-2 text-[13px] leading-snug text-fg-muted">
          A supervisor (systemd, Kubernetes) restarts it after a few seconds. Subscriptions are not persisted.
        </p>
      </Section>
      <Section title="Stats">
        <div className="grid grid-cols-2 gap-1.5">
          <Stat label="published" value={s.stats.published} />
          <Stat label="to 0 receivers" value={s.stats.noReceivers} tone={s.stats.noReceivers ? "warn" : undefined} />
          <Stat label="buffer memory" value={kb(mem)} />
          <Stat label="msgs dropped" value={s.stats.lost} tone={s.stats.lost ? "err" : undefined} />
        </div>
      </Section>
      <Section title="Under the hood">
        <ul className="list-disc space-y-1 pl-4 text-[13px] leading-snug text-fg-muted">
          <li>One thread runs the event loop. PUBLISH walks the channel&apos;s subscriber list, then every pattern.</li>
          <li>A subscribed connection (RESP2) may only send SUBSCRIBE, UNSUBSCRIBE, PSUBSCRIBE, PUNSUBSCRIBE, PING, RESET and QUIT.</li>
          <li>Delivery is at-most-once: no acks, no retries, no storage.</li>
        </ul>
      </Section>
    </div>
  );
}
