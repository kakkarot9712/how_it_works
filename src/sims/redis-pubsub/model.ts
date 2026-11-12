import type { SimContext, SimModel } from "@/engine/types";

/**
 * Redis Pub/Sub, modelled closely on how redis-server actually behaves:
 *
 * - PUBLISH looks up channel and pattern subscribers, appends the message to
 *   each subscriber's *client output buffer*, and replies with the receiver
 *   count. Nothing is stored: no subscribers means the message is gone.
 * - The output buffer drains into the TCP connection. TCP flow control (the
 *   kernel socket buffers on both sides) is modelled as a small window of
 *   messages that can be "on the wire or unread" per subscriber.
 * - When a subscriber stops reading, the window fills, then the output buffer
 *   grows. `client-output-buffer-limit pubsub <hard> <soft> <seconds>` closes
 *   the client when it passes the hard limit, or stays above the soft limit
 *   for <seconds>. Everything in the buffer is dropped.
 * - With limits removed, buffers grow until the host runs out of memory and
 *   the OOM killer takes down redis-server, and with it every subscriber.
 *
 * Time runs in slow motion (network hops take hundreds of ms) so it can be watched.
 */

// ---------- data ----------

export interface Msg {
  id: number;
  channel: string;
  /** Set when delivered because of a PSUBSCRIBE pattern (RESP "pmessage"). */
  pattern?: string;
  payload: string;
  /** Approximate RESP-encoded size in bytes. */
  bytes: number;
  publisher: string;
  publishedAt: number;
}

export type PacketKind = "publish" | "reply" | "deliver" | "fin" | "subscribe";

export interface Packet {
  id: number;
  kind: PacketKind;
  from: string;
  to: string;
  sentAt: number;
  arriveAt: number;
  label: string;
  channel?: string;
  error?: boolean;
}

export interface Publisher {
  id: string;
  label: string;
  channel: string;
  auto: boolean;
  /** Bumped when auto-publishing is toggled so stale ticks are ignored. */
  autoGen: number;
  intervalMs: number;
  payloadBytes: number;
  seq: number;
  sent: number;
  lastReply: { text: string; at: number; error: boolean } | null;
  /** A failed publish during the current outage was already narrated. */
  failNoted: boolean;
}

export type ClientStatus = "connected" | "connecting" | "waiting" | "offline";

export interface Subscriber {
  id: string;
  label: string;
  channels: string[];
  patterns: string[];

  // --- server side ---
  /** Redis has this client registered (its subscriptions exist). */
  registered: boolean;
  /** Connection generation. Bumped on every close so stale events are ignored. */
  epoch: number;
  obuf: Msg[];
  obufBytes: number;
  peakBytes: number;
  /** When the buffer first went above the soft limit (null when below). */
  softSince: number | null;
  /** Connection epoch for which the soft-limit warning was already narrated. */
  softNotedEpoch: number;
  /** Messages sent into TCP but not yet read by the app (flow-control window usage). */
  inflight: number;

  // --- client side ---
  client: ClientStatus;
  /** User pulled the client offline: no auto-reconnect. */
  manualOffline: boolean;
  /** App stopped reading from the socket (stuck, GC pause, deadlock...). */
  blocked: boolean;
  processMs: number;
  linkUp: boolean;
  /** Server closed us while the link was down; the FIN has not reached us. */
  finPending: boolean;
  /** Arrived in the client's socket buffer, not yet read by the app. */
  rx: Msg[];
  processing: Msg | null;
  /** Time the current message finishes processing. */
  processingEnds: number;

  // --- stats ---
  received: number;
  /** Published to a matching channel while this client was not subscribed. */
  missed: number;
  missedThisGap: number;
  /** Dropped from the output buffer when the connection was closed. */
  lost: number;
  disconnects: number;
  recent: { label: string; channel: string; at: number }[];
}

export interface Settings {
  softKb: number;
  hardKb: number;
  softSeconds: number;
  latencyMs: number;
  window: number;
  headroomKb: number;
}

export interface Components {
  /** client-output-buffer-limit pubsub is configured. */
  limits: boolean;
  /** Client libraries reconnect and re-subscribe automatically. */
  reconnect: boolean;
  /** A third subscriber using PSUBSCRIBE pay*. */
  pattern: boolean;
}

export interface Params {
  settings: Settings;
  components: Components;
}

export interface State {
  settings: Settings;
  components: Components;
  server: { up: boolean; downSince: number | null; restartGen: number; peakMemBytes: number };
  publishers: Record<string, Publisher>;
  pubIds: string[];
  subscribers: Record<string, Subscriber>;
  subIds: string[];
  packets: Packet[];
  nextId: number;
  stats: { published: number; noReceivers: number; fanouts: number; lost: number };
  flags: { explainedFanout: boolean; explainedWindow: Record<string, boolean> };
}

// ---------- events & actions ----------

export type Event =
  | { type: "auto"; pub: string; gen: number }
  | { type: "publish-arrive"; msg: Msg; packet: number }
  | { type: "reply-arrive"; pub: string; packet: number; text: string; error: boolean }
  | { type: "deliver-arrive"; sub: string; msg: Msg; packet: number; epoch: number }
  | { type: "retransmit"; sub: string; msg: Msg; epoch: number }
  | { type: "process-done"; sub: string; epoch: number }
  | { type: "ack-arrive"; sub: string; epoch: number }
  | { type: "fin-arrive"; sub: string; packet: number; epoch: number }
  | { type: "reconnect"; sub: string }
  | { type: "subscribe-arrive"; sub: string; packet: number }
  | { type: "server-restart"; gen: number };

export type Action =
  | { type: "publish"; pub: string; channel?: string }
  | { type: "set-auto"; pub: string; on: boolean }
  | { type: "set-interval"; pub: string; ms: number }
  | { type: "set-payload"; pub: string; bytes: number }
  | { type: "set-blocked"; sub: string; on: boolean }
  | { type: "set-process-ms"; sub: string; ms: number }
  | { type: "set-link"; sub: string; up: boolean }
  | { type: "client-kill"; sub: string }
  | { type: "go-offline"; sub: string }
  | { type: "go-online"; sub: string }
  | { type: "crash-server" }
  | { type: "restart-server" };

type Ctx = SimContext<Event>;

// ---------- constants ----------

export const CHANNELS = ["orders", "payments", "refunds"] as const;
export const SERVER = "server";
export const bufNode = (sub: string) => `buf:${sub}`;

const RETRANSMIT_MS = 800;
const RECONNECT_MS = 1200;
export const RESTART_MS = 3000;
const RECENT = 4;

export const defaultSettings: Settings = {
  softKb: 8,
  hardKb: 16,
  softSeconds: 5,
  latencyMs: 450,
  window: 5,
  headroomKb: 48,
};

export const defaultComponents: Components = { limits: true, reconnect: true, pattern: true };

// ---------- helpers ----------

/** Redis glob matching, enough for the patterns used here (* and ?). */
export function globMatch(pattern: string, s: string): boolean {
  const re = new RegExp(
    "^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
  );
  return re.test(s);
}

function respSize(channel: string, payload: number, pattern?: string): number {
  // *3\r\n$7\r\nmessage\r\n$<n>\r\n<channel>\r\n$<n>\r\n<payload>\r\n (+ pattern for pmessage)
  return payload + channel.length + (pattern ? pattern.length + 10 : 0) + 32;
}

export const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

function sendPacket(
  s: State,
  ctx: Ctx,
  p: Omit<Packet, "id" | "sentAt" | "arriveAt">,
  latency = s.settings.latencyMs,
): Packet {
  const jitter = ctx.rng.range(0.9, 1.1);
  const packet: Packet = { ...p, id: s.nextId++, sentAt: ctx.now, arriveAt: ctx.now + latency * jitter };
  s.packets.push(packet);
  return packet;
}

function dropPacket(s: State, id: number) {
  const i = s.packets.findIndex((p) => p.id === id);
  if (i >= 0) s.packets.splice(i, 1);
}

function memUsed(s: State): number {
  return s.subIds.reduce((sum, id) => sum + s.subscribers[id].obufBytes, 0);
}

function subscribes(sub: Subscriber, channel: string): string[] {
  // A client subscribed to the channel AND a matching pattern gets it twice.
  const hits: string[] = [];
  if (sub.channels.includes(channel)) hits.push("");
  for (const p of sub.patterns) if (globMatch(p, channel)) hits.push(p);
  return hits;
}

// ---------- core behaviour ----------

function publish(s: State, ctx: Ctx, pubId: string, channel?: string) {
  const pub = s.publishers[pubId];
  const ch = channel ?? pub.channel;
  pub.seq++;
  pub.sent++;
  const payload = `${ch.replace(/s$/, "")}#${pub.seq}`;
  const msg: Msg = {
    id: s.nextId++,
    channel: ch,
    payload,
    bytes: respSize(ch, pub.payloadBytes),
    publisher: pubId,
    publishedAt: ctx.now,
  };
  const packet = sendPacket(s, ctx, { kind: "publish", from: pubId, to: SERVER, label: `PUBLISH ${ch}`, channel: ch });
  ctx.schedule(packet.arriveAt - ctx.now, { type: "publish-arrive", msg, packet: packet.id });
}

function onPublishArrive(s: State, ctx: Ctx, msg: Msg, packetId: number) {
  dropPacket(s, packetId);
  const pub = s.publishers[msg.publisher];
  if (!s.server.up) {
    const reply = sendPacket(s, ctx, { kind: "reply", from: SERVER, to: pub.id, label: "ECONNREFUSED", error: true });
    ctx.schedule(reply.arriveAt - ctx.now, {
      type: "reply-arrive",
      pub: pub.id,
      packet: reply.id,
      text: "Error: connect ECONNREFUSED",
      error: true,
    });
    if (pub.failNoted) return;
    pub.failNoted = true;
    ctx.log("error", `${pub.label}: PUBLISH ${msg.channel} failed, Redis is down`, {
      detail: "Nothing is queued anywhere. Unless the publisher retries, the message never existed. (Further failures during this outage are not listed.)",
      node: pub.id,
    });
    return;
  }

  s.stats.published++;
  let receivers = 0;
  for (const id of s.subIds) {
    const sub = s.subscribers[id];
    const hits = subscribes(sub, msg.channel);
    if (hits.length === 0) continue;
    if (!sub.registered) {
      sub.missed += hits.length;
      sub.missedThisGap += hits.length;
      continue;
    }
    for (const pattern of hits) {
      const copy: Msg = pattern
        ? { ...msg, pattern, bytes: respSize(msg.channel, msg.bytes, pattern) }
        : { ...msg };
      receivers++;
      enqueue(s, ctx, sub, copy);
    }
  }

  const reply = sendPacket(s, ctx, { kind: "reply", from: SERVER, to: pub.id, label: `(integer) ${receivers}` });
  ctx.schedule(reply.arriveAt - ctx.now, {
    type: "reply-arrive",
    pub: pub.id,
    packet: reply.id,
    text: `(integer) ${receivers}`,
    error: false,
  });

  if (receivers === 0) {
    s.stats.noReceivers++;
    ctx.log("warn", `PUBLISH ${msg.channel} "${msg.payload}" reached 0 subscribers and was discarded`, {
      detail:
        "Redis Pub/Sub keeps no copy of a message. If no client is subscribed at the moment PUBLISH runs, the message is gone. PUBLISH returns 0 so the publisher can tell.",
      node: SERVER,
    });
  } else {
    s.stats.fanouts++;
    if (!s.flags.explainedFanout) {
      s.flags.explainedFanout = true;
      ctx.log("info", `PUBLISH ${msg.channel} fanned out to ${receivers} subscriber(s)`, {
        detail:
          "Redis looks up the channel's subscriber list and every matching PSUBSCRIBE pattern, appends the message to each client's output buffer, and replies to the publisher with the number of receivers.",
        node: SERVER,
      });
    }
  }
  checkMemory(s, ctx);
}

function enqueue(s: State, ctx: Ctx, sub: Subscriber, msg: Msg) {
  sub.obuf.push(msg);
  sub.obufBytes += msg.bytes;
  sub.peakBytes = Math.max(sub.peakBytes, sub.obufBytes);
  drain(s, ctx, sub);
  if (sub.registered) checkLimits(s, ctx, sub);
}

/** Move messages from the output buffer onto the wire while the TCP window allows. */
function drain(s: State, ctx: Ctx, sub: Subscriber) {
  if (!s.server.up || !sub.registered || !sub.linkUp) return;
  while (sub.obuf.length > 0 && sub.inflight < s.settings.window) {
    const msg = sub.obuf.shift()!;
    sub.obufBytes -= msg.bytes;
    sub.inflight++;
    sendDeliver(s, ctx, sub, msg);
  }
  if (sub.obuf.length > 0 && !s.flags.explainedWindow[sub.id]) {
    s.flags.explainedWindow[sub.id] = true;
    ctx.log("info", `${sub.label} isn't reading fast enough: messages pile up in its output buffer`, {
      detail:
        "The kernel socket buffers (TCP window) are full, so write() would block. Redis never blocks its event loop: it keeps the remaining data in the client's output buffer in its own memory.",
      node: bufNode(sub.id),
    });
  }
}

function sendDeliver(s: State, ctx: Ctx, sub: Subscriber, msg: Msg) {
  const packet = sendPacket(s, ctx, {
    kind: "deliver",
    from: bufNode(sub.id),
    to: sub.id,
    label: msg.payload,
    channel: msg.channel,
  });
  ctx.schedule(packet.arriveAt - ctx.now, { type: "deliver-arrive", sub: sub.id, msg, packet: packet.id, epoch: sub.epoch });
}

function checkLimits(s: State, ctx: Ctx, sub: Subscriber) {
  if (!s.components.limits) return;
  const hard = s.settings.hardKb * 1024;
  const soft = s.settings.softKb * 1024;
  if (hard > 0 && sub.obufBytes > hard) {
    closeClient(s, ctx, sub, "hard");
    return;
  }
  if (soft > 0 && sub.obufBytes > soft) {
    if (sub.softSince === null) {
      sub.softSince = ctx.now;
      // Narrate once per connection so a buffer hovering at the line doesn't spam.
      if (sub.softNotedEpoch === sub.epoch) return;
      sub.softNotedEpoch = sub.epoch;
      ctx.log("warn", `${sub.label}'s output buffer passed the soft limit (${s.settings.softKb} KB)`, {
        detail: `If it stays above ${s.settings.softKb} KB for ${s.settings.softSeconds}s, Redis closes the connection. The clock resets if the buffer drops back under the soft limit.`,
        node: bufNode(sub.id),
      });
    } else if (ctx.now - sub.softSince >= s.settings.softSeconds * 1000) {
      closeClient(s, ctx, sub, "soft");
    }
  } else if (sub.softSince !== null) {
    const was = ctx.now - sub.softSince;
    sub.softSince = null;
    if (was > 1500) {
      ctx.log("ok", `${sub.label} drained below the soft limit after ${(was / 1000).toFixed(1)}s, timer reset`, {
        node: bufNode(sub.id),
      });
    }
  }
}

function checkMemory(s: State, ctx: Ctx) {
  const used = memUsed(s);
  s.server.peakMemBytes = Math.max(s.server.peakMemBytes, used);
  if (s.server.up && used > s.settings.headroomKb * 1024) {
    ctx.log("error", "Out of memory: Killed process 4242 (redis-server)", {
      detail:
        "With no client-output-buffer-limit, one stuck subscriber's buffer kept growing until the host ran out of RAM and the kernel OOM killer stopped Redis. Every client lost its connection, not just the slow one.",
      node: SERVER,
    });
    crash(s, ctx, "oom");
  }
}

type CloseReason = "hard" | "soft" | "kill" | "crash" | "oom";

function closeClient(s: State, ctx: Ctx, sub: Subscriber, reason: CloseReason) {
  const dropped = sub.obuf.length;
  const bytes = sub.obufBytes;
  sub.registered = false;
  sub.epoch++;
  sub.lost += dropped;
  s.stats.lost += dropped;
  sub.obuf = [];
  sub.obufBytes = 0;
  sub.softSince = null;
  sub.inflight = 0;
  sub.disconnects++;
  sub.missedThisGap = 0;

  if (reason === "hard" || reason === "soft") {
    ctx.log(
      "error",
      `Client ${sub.label} scheduled to be closed ASAP for overcoming of output buffer limits.`,
      {
        detail:
          reason === "hard"
            ? `The buffer reached ${kb(bytes)}, over the hard limit of ${s.settings.hardKb} KB, so Redis closed the connection immediately. ${dropped} buffered message(s) were dropped.`
            : `The buffer stayed above the soft limit (${s.settings.softKb} KB) for ${s.settings.softSeconds}s. ${dropped} buffered message(s) (${kb(bytes)}) were dropped.`,
        node: sub.id,
      },
    );
  } else if (reason === "kill") {
    ctx.log("warn", `CLIENT KILL: Redis closed ${sub.label}'s connection`, {
      detail: `${dropped} message(s) still in its output buffer were dropped.`,
      node: sub.id,
    });
  }

  if (sub.client === "connected") {
    if (sub.linkUp) {
      const fin = sendPacket(s, ctx, { kind: "fin", from: bufNode(sub.id), to: sub.id, label: "FIN", error: true });
      ctx.schedule(fin.arriveAt - ctx.now, { type: "fin-arrive", sub: sub.id, packet: fin.id, epoch: sub.epoch });
    } else {
      sub.finPending = true;
      ctx.log("warn", `${sub.label} doesn't know it was disconnected (half-open connection)`, {
        detail:
          "The FIN can't cross the broken link. A subscriber that only reads never notices until TCP keepalive or an application PING health check fails. Until then it sits on a dead connection, silently receiving nothing.",
        node: sub.id,
      });
    }
  }
}

function crash(s: State, ctx: Ctx, reason: "oom" | "crash") {
  s.server.up = false;
  s.server.downSince = ctx.now;
  for (const id of s.subIds) {
    const sub = s.subscribers[id];
    if (sub.registered) closeClient(s, ctx, sub, reason);
  }
  if (reason === "crash") {
    ctx.log("error", "redis-server crashed", {
      detail:
        "Subscriptions live only in memory, on each connection. When the process dies they are all gone, along with everything in the output buffers. Clients must reconnect and SUBSCRIBE again.",
      node: SERVER,
    });
  }
  const gen = ++s.server.restartGen;
  ctx.schedule(RESTART_MS, { type: "server-restart", gen });
}

function startProcessing(s: State, ctx: Ctx, sub: Subscriber) {
  if (sub.blocked || sub.processing || sub.rx.length === 0 || sub.client === "offline") return;
  sub.processing = sub.rx.shift()!;
  sub.processingEnds = ctx.now + sub.processMs;
  ctx.schedule(sub.processMs, { type: "process-done", sub: sub.id, epoch: sub.epoch });
}

function scheduleReconnect(s: State, ctx: Ctx, sub: Subscriber) {
  if (sub.manualOffline) {
    sub.client = "offline";
    return;
  }
  if (!s.components.reconnect) {
    sub.client = "offline";
    ctx.log("warn", `${sub.label} stays disconnected (auto-reconnect removed)`, {
      detail: "Without a reconnect loop in the client, the consumer is gone until someone restarts it.",
      node: sub.id,
    });
    return;
  }
  sub.client = "waiting";
  ctx.schedule(RECONNECT_MS, { type: "reconnect", sub: sub.id });
}

function freshSub(id: string, label: string, channels: string[], patterns: string[]): Subscriber {
  return {
    id,
    label,
    channels,
    patterns,
    registered: true,
    epoch: 0,
    obuf: [],
    obufBytes: 0,
    peakBytes: 0,
    softSince: null,
    softNotedEpoch: -1,
    inflight: 0,
    client: "connected",
    manualOffline: false,
    blocked: false,
    processMs: 250,
    linkUp: true,
    finPending: false,
    rx: [],
    processing: null,
    processingEnds: 0,
    received: 0,
    missed: 0,
    missedThisGap: 0,
    lost: 0,
    disconnects: 0,
    recent: [],
  };
}

// ---------- model ----------

export const model: SimModel<State, Event, Action, Params> = {
  init(params, ctx) {
    const pub = (id: string, label: string, channel: string, intervalMs: number): Publisher => ({
      id,
      label,
      channel,
      auto: true,
      autoGen: 0,
      intervalMs,
      payloadBytes: 1024,
      seq: 0,
      sent: 0,
      lastReply: null,
      failNoted: false,
    });
    const s: State = {
      settings: { ...params.settings },
      components: { ...params.components },
      server: { up: true, downSince: null, restartGen: 0, peakMemBytes: 0 },
      publishers: {
        P1: pub("P1", "checkout-api", "orders", 700),
        P2: pub("P2", "billing-api", "payments", 1100),
      },
      pubIds: ["P1", "P2"],
      subscribers: {
        S1: freshSub("S1", "email-worker", ["orders"], []),
        S2: freshSub("S2", "analytics", ["orders", "payments"], []),
      },
      subIds: ["S1", "S2"],
      packets: [],
      nextId: 1,
      stats: { published: 0, noReceivers: 0, fanouts: 0, lost: 0 },
      flags: { explainedFanout: false, explainedWindow: {} },
    };
    if (params.components.pattern) {
      s.subscribers.S3 = freshSub("S3", "fraud-check", [], ["pay*"]);
      s.subIds.push("S3");
    }
    ctx.schedule(300, { type: "auto", pub: "P1", gen: 0 });
    ctx.schedule(650, { type: "auto", pub: "P2", gen: 0 });
    ctx.log("info", "Subscribers are connected and subscribed", {
      detail: s.subIds
        .map((id) => {
          const sub = s.subscribers[id];
          return `${sub.label}: ${[
            ...(sub.channels.length ? [`SUBSCRIBE ${sub.channels.join(" ")}`] : []),
            ...(sub.patterns.length ? [`PSUBSCRIBE ${sub.patterns.join(" ")}`] : []),
          ].join(", ")}`;
        })
        .join(" · "),
    });
    return s;
  },

  handle(s, e, ctx) {
    switch (e.type) {
      case "auto": {
        const pub = s.publishers[e.pub];
        if (!pub.auto || e.gen !== pub.autoGen) return;
        publish(s, ctx, pub.id);
        ctx.schedule(pub.intervalMs * ctx.rng.range(0.85, 1.15), { type: "auto", pub: pub.id, gen: pub.autoGen });
        return;
      }
      case "publish-arrive":
        onPublishArrive(s, ctx, e.msg, e.packet);
        return;
      case "reply-arrive": {
        dropPacket(s, e.packet);
        s.publishers[e.pub].lastReply = { text: e.text, at: ctx.now, error: e.error };
        return;
      }
      case "deliver-arrive": {
        dropPacket(s, e.packet);
        const sub = s.subscribers[e.sub];
        if (!sub.linkUp) {
          // Lost on the broken link. TCP will retransmit after a timeout.
          ctx.schedule(RETRANSMIT_MS, { type: "retransmit", sub: sub.id, msg: e.msg, epoch: e.epoch });
          return;
        }
        if (sub.client === "offline") return;
        sub.rx.push(e.msg);
        startProcessing(s, ctx, sub);
        return;
      }
      case "retransmit": {
        const sub = s.subscribers[e.sub];
        if (e.epoch !== sub.epoch) {
          sub.lost++;
          s.stats.lost++;
          return;
        }
        if (!sub.linkUp) {
          ctx.schedule(RETRANSMIT_MS, e);
          return;
        }
        sendDeliver(s, ctx, sub, e.msg);
        return;
      }
      case "process-done": {
        const sub = s.subscribers[e.sub];
        const m = sub.processing;
        if (!m) return;
        sub.processing = null;
        sub.received++;
        sub.recent.unshift({ label: m.payload, channel: m.channel, at: ctx.now });
        sub.recent.length = Math.min(sub.recent.length, RECENT);
        // Reading data opens the TCP window again: tell the server (window update / ACK).
        if (sub.registered && e.epoch === sub.epoch) {
          ctx.schedule(s.settings.latencyMs, { type: "ack-arrive", sub: sub.id, epoch: sub.epoch });
        }
        startProcessing(s, ctx, sub);
        return;
      }
      case "ack-arrive": {
        const sub = s.subscribers[e.sub];
        if (e.epoch !== sub.epoch || !sub.registered) return;
        if (!sub.linkUp) {
          ctx.schedule(RETRANSMIT_MS, e);
          return;
        }
        sub.inflight = Math.max(0, sub.inflight - 1);
        drain(s, ctx, sub);
        checkLimits(s, ctx, sub);
        return;
      }
      case "fin-arrive": {
        dropPacket(s, e.packet);
        const sub = s.subscribers[e.sub];
        if (e.epoch !== sub.epoch || sub.client !== "connected" || sub.registered) return;
        ctx.log("info", `${sub.label} sees the connection closed`, {
          detail: s.components.reconnect && !sub.manualOffline
            ? `Its client library will reconnect and re-SUBSCRIBE in ${RECONNECT_MS / 1000}s. Anything published in the meantime is missed.`
            : undefined,
          node: sub.id,
        });
        scheduleReconnect(s, ctx, sub);
        return;
      }
      case "reconnect": {
        const sub = s.subscribers[e.sub];
        if (sub.client !== "waiting") return;
        if (!sub.linkUp) {
          ctx.log("warn", `${sub.label}: connect timed out, retrying`, { node: sub.id });
          ctx.schedule(RECONNECT_MS * 2, { type: "reconnect", sub: sub.id });
          return;
        }
        sub.client = "connecting";
        const cmd = [
          ...(sub.channels.length ? [`SUBSCRIBE ${sub.channels.join(" ")}`] : []),
          ...(sub.patterns.length ? [`PSUBSCRIBE ${sub.patterns.join(" ")}`] : []),
        ].join(" + ");
        const p = sendPacket(s, ctx, { kind: "subscribe", from: sub.id, to: SERVER, label: cmd });
        ctx.schedule(p.arriveAt - ctx.now, { type: "subscribe-arrive", sub: sub.id, packet: p.id });
        return;
      }
      case "subscribe-arrive": {
        dropPacket(s, e.packet);
        const sub = s.subscribers[e.sub];
        if (sub.client !== "connecting") return;
        if (!s.server.up || !sub.linkUp) {
          sub.client = "waiting";
          ctx.schedule(RECONNECT_MS, { type: "reconnect", sub: sub.id });
          return;
        }
        sub.registered = true;
        sub.client = "connected";
        const gap = sub.missedThisGap;
        sub.missedThisGap = 0;
        ctx.log(gap > 0 ? "warn" : "ok", `${sub.label} re-subscribed${gap > 0 ? `, but missed ${gap} message(s) while away` : ""}`, {
          detail:
            gap > 0
              ? "Pub/Sub has no history and no offsets, so there is no way to ask for what was missed. If you need that, use Redis Streams (XADD / XREADGROUP)."
              : undefined,
          node: sub.id,
        });
        return;
      }
      case "server-restart": {
        if (e.gen !== s.server.restartGen || s.server.up) return;
        s.server.up = true;
        s.server.downSince = null;
        for (const id of s.pubIds) s.publishers[id].failNoted = false;
        ctx.log("ok", "redis-server is back up, with zero subscriptions", {
          detail: "Subscriptions are not persisted to RDB or AOF. Only clients that reconnect and SUBSCRIBE again will receive messages.",
          node: SERVER,
        });
        return;
      }
    }
  },

  act(s, a, ctx) {
    switch (a.type) {
      case "publish":
        publish(s, ctx, a.pub, a.channel);
        return;
      case "set-auto": {
        const pub = s.publishers[a.pub];
        if (pub.auto === a.on) return;
        pub.auto = a.on;
        pub.autoGen++;
        if (a.on) ctx.schedule(0, { type: "auto", pub: pub.id, gen: pub.autoGen });
        return;
      }
      case "set-interval": {
        const pub = s.publishers[a.pub];
        pub.intervalMs = a.ms;
        if (pub.auto) {
          pub.autoGen++;
          ctx.schedule(a.ms, { type: "auto", pub: pub.id, gen: pub.autoGen });
        }
        return;
      }
      case "set-payload":
        s.publishers[a.pub].payloadBytes = a.bytes;
        return;
      case "set-blocked": {
        const sub = s.subscribers[a.sub];
        if (sub.blocked === a.on) return;
        sub.blocked = a.on;
        if (a.on) {
          ctx.log("warn", `${sub.label} stopped reading from its socket`, {
            detail:
              "e.g. a long GC pause, a deadlock, or a slow handler blocking the read loop. Redis can't tell; it only sees that the TCP window stopped opening.",
            node: sub.id,
          });
        } else {
          ctx.log("ok", `${sub.label} is reading again`, { node: sub.id });
          startProcessing(s, ctx, sub);
        }
        return;
      }
      case "set-process-ms":
        s.subscribers[a.sub].processMs = a.ms;
        return;
      case "set-link": {
        const sub = s.subscribers[a.sub];
        if (sub.linkUp === a.up) return;
        sub.linkUp = a.up;
        if (!a.up) {
          ctx.log("warn", `Network link to ${sub.label} cut`, {
            detail:
              "No FIN or RST is sent, so neither side knows. To Redis, a dead network looks exactly like a slow reader: the TCP window stops opening and the output buffer grows.",
            node: sub.id,
          });
        } else {
          ctx.log("ok", `Network link to ${sub.label} restored`, { node: sub.id });
          if (sub.finPending) {
            sub.finPending = false;
            const fin = sendPacket(s, ctx, { kind: "fin", from: bufNode(sub.id), to: sub.id, label: "FIN", error: true });
            ctx.schedule(fin.arriveAt - ctx.now, { type: "fin-arrive", sub: sub.id, packet: fin.id, epoch: sub.epoch });
          }
          drain(s, ctx, sub);
        }
        return;
      }
      case "client-kill": {
        const sub = s.subscribers[a.sub];
        if (sub.registered && s.server.up) closeClient(s, ctx, sub, "kill");
        return;
      }
      case "go-offline": {
        const sub = s.subscribers[a.sub];
        sub.manualOffline = true;
        if (sub.registered) {
          const dropped = sub.obuf.length;
          sub.registered = false;
          sub.epoch++;
          sub.lost += dropped;
          s.stats.lost += dropped;
          sub.obuf = [];
          sub.obufBytes = 0;
          sub.inflight = 0;
          sub.softSince = null;
          sub.disconnects++;
        }
        sub.missedThisGap = 0;
        sub.client = "offline";
        sub.rx = [];
        sub.processing = null;
        ctx.log("warn", `${sub.label} went offline (deploy, restart, crash…)`, {
          detail: "Redis removes its subscriptions as soon as the connection closes. Messages published from now on are not kept for it.",
          node: sub.id,
        });
        return;
      }
      case "go-online": {
        const sub = s.subscribers[a.sub];
        sub.manualOffline = false;
        if (sub.client === "offline") {
          sub.client = "waiting";
          ctx.schedule(0, { type: "reconnect", sub: sub.id });
        }
        return;
      }
      case "crash-server":
        if (s.server.up) crash(s, ctx, "crash");
        return;
      case "restart-server":
        if (!s.server.up) ctx.schedule(0, { type: "server-restart", gen: s.server.restartGen });
        return;
    }
  },
};

/** Live derived numbers for the UI. */
export function derived(s: State) {
  return { memBytes: memUsed(s) };
}
