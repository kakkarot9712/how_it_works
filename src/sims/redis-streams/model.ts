import type { SimContext, SimModel } from "@/engine/types";

/**
 * Redis Streams with consumer groups, modelled on how redis-server behaves:
 *
 * - XADD appends an entry with an ID `<ms>-<seq>` to the stream key and replies
 *   with the ID. `MAXLEN` trims the oldest entries in the same command. Trimming
 *   ignores consumer groups (the default `KEEPREF`): an entry a group never read
 *   is simply gone, and a trimmed entry still in a PEL stays there as a dangling ID.
 * - Each consumer group has its own `last-delivered-id`. `XREADGROUP ... >` hands
 *   a consumer entries after it, advances it, and adds each entry to the group's
 *   PEL (owner, delivery time, delivery count). Two consumers in one group split
 *   the entries; two groups each get every entry.
 * - With nothing new, XREADGROUP BLOCK parks the client. The next XADD serves
 *   blocked clients in the order they blocked.
 * - `XACK` removes an ID from the PEL. Nothing else does: a consumer that dies
 *   leaves its entries pending forever, until it reads its own history with
 *   `XREADGROUP ... 0` after a restart, or another consumer takes them over with
 *   `XAUTOCLAIM` once they have been idle for min-idle-time.
 * - Reading history or claiming increments the delivery count. Consumers use it
 *   to move a poison entry to a dead-letter stream instead of crashing forever.
 * - The stream and groups are keys like any other: with AOF on they survive a restart.
 *
 * Time runs in slow motion (network hops take hundreds of ms) so it can be watched.
 */

// ---------- data ----------

export interface Entry {
  /** Logical position: the stream's entries-added counter when this entry was added. */
  n: number;
  id: string;
  /** Order number, shown on the tape. */
  order: number;
  /** Malformed payload that makes the mailers' handler crash. */
  poison: boolean;
  addedAt: number;
}

export interface Pending {
  n: number;
  id: string;
  order: number;
  owner: string;
  deliveredAt: number;
  deliveries: number;
}

/** An entry as a consumer holds it locally. `gone` = trimmed while pending: Redis returns nil fields. */
export interface Delivery {
  n: number;
  id: string;
  order: number;
  poison: boolean;
  gone: boolean;
  deliveries: number;
}

export interface Group {
  id: string;
  name: string;
  consumers: string[];
  /** Crashes on poison entries (the mailers render an email from the payload; analytics only counts). */
  crashOnPoison: boolean;
  lastN: number;
  lastId: string;
  /** False after unread entries were trimmed, until the group delivers the stream's last entry (XINFO GROUPS lag = nil). */
  lagValid: boolean;
  pel: Pending[];
  delivered: number;
  acked: number;
  claimed: number;
  /** Entries trimmed by MAXLEN before this group read them. */
  trimmedUnread: number;
  /** Entries lost in a consumer crash under NOACK. */
  lostNoAck: number;
  duplicates: number;
  deadLettered: number;
  /** order n → times processed, to spot duplicates. */
  processed: Record<number, number>;
  lossNoted: boolean;
}

export type ConsumerStatus = "running" | "crashed" | "offline" | "reconnecting";

export interface Consumer {
  id: string;
  label: string;
  group: string;
  status: ConsumerStatus;
  /** Process generation: bumped when the process dies. */
  life: number;
  /** Connection generation: bumped when the connection closes. */
  conn: number;
  /** Next read uses ID 0 (own pending entries) instead of `>`. */
  history: boolean;
  reading: boolean;
  blockedSince: number | null;
  blockGen: number;
  claiming: boolean;
  queue: Delivery[];
  processing: Delivery | null;
  procEnds: number;
  /** Remaining ms of the current entry while hung. */
  procLeft: number;
  procGen: number;
  hung: boolean;
  processMs: number;
  restartGen: number;
  /** Arrival time of the last command on this connection: commands arrive in order. */
  lastUp: number;
  done: number;
  dups: number;
  crashes: number;
  dupNotedAt: number;
  recent: number[];
}

export interface Producer {
  id: string;
  label: string;
  auto: boolean;
  autoGen: number;
  intervalMs: number;
  seq: number;
  sent: number;
  failed: number;
  lastReply: { text: string; at: number; error: boolean } | null;
  failNoted: boolean;
  /** Arrival time of the last XADD: commands on one connection arrive in order. */
  lastUp: number;
}

export type PacketKind = "xadd" | "reply" | "read" | "entries" | "ack" | "claim" | "claimed" | "dlq";

export interface Packet {
  id: number;
  kind: PacketKind;
  from: string;
  to: string;
  sentAt: number;
  arriveAt: number;
  label: string;
  error?: boolean;
  poison?: boolean;
}

export interface Settings {
  latencyMs: number;
  count: number;
  minIdleMs: number;
  maxLen: number;
  maxDeliveries: number;
}

export interface Components {
  /** Consumers XACK, so delivered entries are tracked in the PEL. Off: XREADGROUP ... NOACK. */
  ack: boolean;
  /** Each consumer runs XAUTOCLAIM every few seconds to take over stuck entries. */
  claim: boolean;
  /** Consumers move entries delivered too many times to orders:dead. */
  deadLetter: boolean;
  /** XADD ... MAXLEN caps the stream length. */
  maxlen: boolean;
}

export interface Params {
  settings: Settings;
  components: Components;
}

export interface State {
  settings: Settings;
  components: Components;
  server: { up: boolean; downSince: number | null; restartGen: number };
  stream: { entries: Entry[]; entriesAdded: number; lastMs: number; lastSeq: number; trimmed: number; danglingNoted: boolean };
  deadLetter: { id: string; order: number; deliveries: number }[];
  producers: Record<string, Producer>;
  prodIds: string[];
  groups: Record<string, Group>;
  groupIds: string[];
  consumers: Record<string, Consumer>;
  consIds: string[];
  /** Clients parked in XREADGROUP BLOCK, in the order they blocked. */
  blocked: { consumer: string; conn: number; gen: number }[];
  packets: Packet[];
  nextId: number;
  flags: { xadd: boolean; groups: Record<string, boolean>; ack: boolean; block: boolean };
}

// ---------- events & actions ----------

export type Event =
  | { type: "auto"; prod: string; gen: number }
  | { type: "xadd-arrive"; prod: string; order: number; poison: boolean; packet: number }
  | { type: "reply-arrive"; prod: string; packet: number; text: string; error: boolean }
  | { type: "read-arrive"; consumer: string; conn: number; history: boolean; packet: number }
  | { type: "block-timeout"; consumer: string; conn: number; gen: number }
  | { type: "entries-arrive"; consumer: string; conn: number; list: Delivery[]; history: boolean; packet: number }
  | { type: "process-done"; consumer: string; life: number; gen: number }
  /** `srv`: the server generation when sent. A command already on the wire still arrives if the consumer dies, but not across a Redis crash. */
  | { type: "ack-arrive"; consumer: string; srv: number; n: number; packet: number }
  | { type: "dlq-arrive"; consumer: string; srv: number; d: Delivery; packet: number }
  | { type: "claim-tick"; consumer: string }
  | { type: "claim-arrive"; consumer: string; life: number; packet: number; manual: boolean }
  | { type: "claimed-arrive"; consumer: string; life: number; list: Delivery[]; packet: number }
  | { type: "consumer-restart"; consumer: string; gen: number }
  | { type: "reconnect"; consumer: string }
  | { type: "server-restart"; gen: number };

export type Action =
  | { type: "xadd"; prod: string; poison?: boolean }
  | { type: "burst"; prod: string; n: number }
  | { type: "set-auto"; prod: string; on: boolean }
  | { type: "set-interval"; prod: string; ms: number }
  | { type: "set-hung"; consumer: string; on: boolean }
  | { type: "set-process-ms"; consumer: string; ms: number }
  | { type: "crash-consumer"; consumer: string }
  | { type: "stop-consumer"; consumer: string }
  | { type: "start-consumer"; consumer: string }
  | { type: "claim-now"; consumer: string }
  | { type: "crash-server" }
  | { type: "restart-server" };

type Ctx = SimContext<Event>;

// ---------- constants ----------

export const STREAM = "stream";
export const STREAM_KEY = "orders";
export const DEAD_KEY = "orders:dead";
export const groupNode = (g: string) => `g:${g}`;

export const BLOCK_MS = 5000;
export const CLAIM_EVERY_MS = 3000;
export const CLAIM_COUNT = 10;
export const CONSUMER_RESTART_MS = 2500;
export const RESTART_MS = 3000;
const RECONNECT_MS = 1000;
const RECENT = 4;

export const defaultSettings: Settings = {
  latencyMs: 400,
  count: 4,
  minIdleMs: 6000,
  maxLen: 40,
  maxDeliveries: 3,
};

export const defaultComponents: Components = { ack: true, claim: true, deadLetter: true, maxlen: true };

// ---------- helpers ----------

function sendPacket(s: State, ctx: Ctx, p: Omit<Packet, "id" | "sentAt" | "arriveAt">, notBefore = 0): Packet {
  const jitter = ctx.rng.range(0.9, 1.1);
  const arriveAt = Math.max(ctx.now + s.settings.latencyMs * jitter, notBefore);
  const packet: Packet = { ...p, id: s.nextId++, sentAt: ctx.now, arriveAt };
  s.packets.push(packet);
  return packet;
}

/** A command on the consumer's main connection. TCP keeps them in order. */
function sendUp(s: State, ctx: Ctx, c: Consumer, p: Omit<Packet, "id" | "sentAt" | "arriveAt" | "from" | "to">): Packet {
  const packet = sendPacket(s, ctx, { ...p, from: c.id, to: groupNode(c.group) }, c.lastUp + 1);
  c.lastUp = packet.arriveAt;
  return packet;
}

function dropPacket(s: State, id: number) {
  const i = s.packets.findIndex((p) => p.id === id);
  if (i >= 0) s.packets.splice(i, 1);
}

function entryByN(s: State, n: number): Entry | undefined {
  const es = s.stream.entries;
  if (es.length === 0 || n < es[0].n) return undefined;
  const e = es[n - es[0].n];
  return e?.n === n ? e : es.find((x) => x.n === n);
}

export function lag(s: State, g: Group): number | null {
  return g.lagValid ? s.stream.entriesAdded - g.lastN : null;
}

export function pendingOf(g: Group, consumer: string): number {
  return g.pel.filter((p) => p.owner === consumer).length;
}

export function lastId(s: State): string {
  return s.stream.entriesAdded ? `${s.stream.lastMs}-${s.stream.lastSeq}` : "0-0";
}

const orderList = (list: { order: number }[]) =>
  list.length === 0 ? "nothing" : list.length === 1 ? `order ${list[0].order}` : `orders ${list.map((d) => d.order).join(", ")}`;

/** Short packet label for a batch of entries. */
function batchLabel(list: Delivery[]): string {
  if (list.length === 0) return "(empty)";
  if (list.length === 1) return `#${list[0].order}`;
  return `#${list[0].order}…${list[list.length - 1].order}`;
}

// ---------- server side ----------

function onXadd(s: State, ctx: Ctx, prodId: string, order: number, poison: boolean) {
  const prod = s.producers[prodId];
  if (!s.server.up) {
    prod.failed++;
    const reply = sendPacket(s, ctx, { kind: "reply", from: STREAM, to: prodId, label: "RST", error: true });
    ctx.schedule(reply.arriveAt - ctx.now, { type: "reply-arrive", prod: prodId, packet: reply.id, text: "Error: connect ECONNREFUSED", error: true });
    if (!prod.failNoted) {
      prod.failNoted = true;
      ctx.log("error", `${prod.label}: XADD order ${order} failed, Redis is down`, {
        detail:
          "The entry never reached the stream. Only a producer that retries keeps it. (Further failures during this outage are not listed.)",
        node: prodId,
      });
    }
    return;
  }

  // ID: milliseconds time + sequence number within that millisecond, always increasing.
  const ms = Math.floor(ctx.now);
  const st = s.stream;
  if (ms > st.lastMs) {
    st.lastMs = ms;
    st.lastSeq = 0;
  } else st.lastSeq++;
  st.entriesAdded++;
  const e: Entry = { n: st.entriesAdded, id: `${st.lastMs}-${st.lastSeq}`, order, poison, addedAt: ctx.now };
  st.entries.push(e);

  const reply = sendPacket(s, ctx, { kind: "reply", from: STREAM, to: prodId, label: e.id });
  ctx.schedule(reply.arriveAt - ctx.now, { type: "reply-arrive", prod: prodId, packet: reply.id, text: `"${e.id}"`, error: false });

  if (!s.flags.xadd) {
    s.flags.xadd = true;
    ctx.log("info", `XADD ${STREAM_KEY} * appended order ${order} as ${e.id}`, {
      detail: `The ID is <milliseconds>-<sequence>, generated by Redis and always increasing. ${
        s.components.maxlen ? `MAXLEN ${s.settings.maxLen} keeps only the newest ${s.settings.maxLen} entries.` : "No MAXLEN: the stream keeps every entry."
      } Producers don't wait for consumers: the entry is stored whether or not anyone is reading.`,
      node: STREAM,
    });
  }

  if (s.components.maxlen) trim(s, ctx);
  serveBlocked(s, ctx);
}

/** XADD ... MAXLEN: drop the oldest entries. Consumer groups don't hold entries back (KEEPREF). */
function trim(s: State, ctx: Ctx) {
  const st = s.stream;
  while (st.entries.length > s.settings.maxLen) {
    const e = st.entries.shift()!;
    st.trimmed++;
    for (const gid of s.groupIds) {
      const g = s.groups[gid];
      if (e.n > g.lastN) {
        g.trimmedUnread++;
        g.lagValid = false;
        if (!g.lossNoted) {
          g.lossNoted = true;
          ctx.log("warn", `MAXLEN trimmed entries the ${g.name} group never read`, {
            detail: `Order ${e.order} (${e.id}) was cut from the stream before any ${g.name} consumer got it. Trimming ignores consumer groups, so a group that falls more than MAXLEN entries behind loses data, silently. XINFO GROUPS now reports its lag as nil.`,
            node: groupNode(g.id),
          });
        }
      } else if (g.pel.some((p) => p.n === e.n) && !st.danglingNoted) {
        st.danglingNoted = true;
        ctx.log("warn", `MAXLEN trimmed order ${e.order} while it was still pending in ${g.name}`, {
          detail:
            "The PEL keeps the ID (KEEPREF, the default), but the data is gone. Reading it returns the ID with nil fields, and XAUTOCLAIM drops such IDs from the PEL.",
          node: groupNode(g.id),
        });
      }
    }
  }
}

/** XADD wakes clients blocked on the key, in the order they blocked. */
function serveBlocked(s: State, ctx: Ctx) {
  const still: State["blocked"] = [];
  for (const b of s.blocked) {
    const c = s.consumers[b.consumer];
    const g = s.groups[c.group];
    if (b.conn !== c.conn || !hasNew(s, g)) {
      if (b.conn === c.conn) still.push(b);
      continue;
    }
    c.blockedSince = null;
    reply(s, ctx, c, deliverNew(s, ctx, c, g), false);
  }
  s.blocked = still;
}

function hasNew(s: State, g: Group) {
  const es = s.stream.entries;
  return es.length > 0 && es[es.length - 1].n > g.lastN;
}

/** XREADGROUP ... >: entries after last-delivered-id, up to COUNT; each goes into the PEL (unless NOACK). */
function deliverNew(s: State, ctx: Ctx, c: Consumer, g: Group): Delivery[] {
  const out: Delivery[] = [];
  for (const e of s.stream.entries) {
    if (out.length >= s.settings.count) break;
    if (e.n <= g.lastN) continue;
    g.lastN = e.n;
    g.lastId = e.id;
    g.delivered++;
    if (s.components.ack) g.pel.push({ n: e.n, id: e.id, order: e.order, owner: c.id, deliveredAt: ctx.now, deliveries: 1 });
    out.push({ n: e.n, id: e.id, order: e.order, poison: e.poison, gone: false, deliveries: 1 });
  }
  if (g.lastN === s.stream.entriesAdded) g.lagValid = true;

  if (out.length && !s.flags.groups[g.id]) {
    s.flags.groups[g.id] = true;
    const others = s.groupIds.filter((x) => x !== g.id).map((x) => s.groups[x].name);
    ctx.log("info", `${g.name}: XREADGROUP > gave ${orderList(out)} to ${c.label}`, {
      detail: `The group's last-delivered-id moved to ${g.lastId}. ${
        s.components.ack
          ? `Each entry is now in the ${g.name} PEL, owned by ${c.label}, until it is XACKed.`
          : "With NOACK the entries are not tracked: delivered counts as acknowledged."
      } ${g.consumers.length > 1 ? `Consumers in the same group split the entries between them. ` : ""}${
        others.length ? `The ${others.join(", ")} group has its own last-delivered-id and gets every entry too.` : ""
      }`,
      node: groupNode(g.id),
    });
  }
  return out;
}

/** XREADGROUP ... 0: this consumer's own pending entries. Each re-delivery bumps the count. */
function readHistory(s: State, ctx: Ctx, c: Consumer, g: Group): Delivery[] {
  const out: Delivery[] = [];
  for (const p of g.pel) {
    if (out.length >= s.settings.count) break;
    if (p.owner !== c.id) continue;
    p.deliveries++;
    p.deliveredAt = ctx.now;
    const e = entryByN(s, p.n);
    out.push({ n: p.n, id: p.id, order: p.order, poison: e?.poison ?? false, gone: !e, deliveries: p.deliveries });
  }
  return out;
}

function reply(s: State, ctx: Ctx, c: Consumer, list: Delivery[], history: boolean, label?: string) {
  const p = sendPacket(s, ctx, {
    kind: "entries",
    from: groupNode(c.group),
    to: c.id,
    label: label ?? batchLabel(list),
    poison: list.some((d) => d.poison && s.groups[c.group].crashOnPoison),
  });
  ctx.schedule(p.arriveAt - ctx.now, { type: "entries-arrive", consumer: c.id, conn: c.conn, list, history, packet: p.id });
}

function onRead(s: State, ctx: Ctx, c: Consumer, history: boolean) {
  const g = s.groups[c.group];
  if (history) {
    reply(s, ctx, c, readHistory(s, ctx, c, g), true);
    return;
  }
  const list = deliverNew(s, ctx, c, g);
  if (list.length) {
    reply(s, ctx, c, list, false);
    return;
  }
  // Nothing new: park the client until an XADD or the BLOCK timeout.
  c.blockGen++;
  c.blockedSince = ctx.now;
  s.blocked.push({ consumer: c.id, conn: c.conn, gen: c.blockGen });
  ctx.schedule(BLOCK_MS, { type: "block-timeout", consumer: c.id, conn: c.conn, gen: c.blockGen });
  if (!s.flags.block) {
    s.flags.block = true;
    ctx.log("info", `${c.label} is blocked in XREADGROUP, waiting for new entries`, {
      detail: `BLOCK ${BLOCK_MS} parks the connection inside Redis instead of polling. The next XADD to ${STREAM_KEY} wakes blocked clients in the order they blocked. Consumers pull: Redis never pushes more than a consumer asked for (COUNT ${s.settings.count}).`,
      node: c.id,
    });
  }
}

/** XAUTOCLAIM orders <group> <consumer> <min-idle-time> 0-0 COUNT 10 */
function onClaim(s: State, ctx: Ctx, c: Consumer, manual: boolean) {
  const g = s.groups[c.group];
  const claimed: Delivery[] = [];
  const from: Record<string, number> = {};
  const deleted: Pending[] = [];
  for (const p of [...g.pel]) {
    if (claimed.length + deleted.length >= CLAIM_COUNT) break;
    if (ctx.now - p.deliveredAt < s.settings.minIdleMs) continue;
    const e = entryByN(s, p.n);
    if (!e) {
      deleted.push(p);
      g.pel.splice(g.pel.indexOf(p), 1);
      continue;
    }
    from[p.owner] = (from[p.owner] ?? 0) + 1;
    p.owner = c.id;
    p.deliveredAt = ctx.now;
    p.deliveries++;
    claimed.push({ n: p.n, id: p.id, order: p.order, poison: e.poison, gone: false, deliveries: p.deliveries });
  }
  g.claimed += claimed.length;

  if (claimed.length) {
    const who = Object.entries(from)
      .map(([id, k]) => `${k} from ${id === c.id ? "itself" : s.consumers[id].label}`)
      .join(", ");
    ctx.log("warn", `${c.label} XAUTOCLAIMed ${orderList(claimed)} (${who})`, {
      detail: `They had been pending for more than min-idle-time (${s.settings.minIdleMs / 1000}s) without an XACK. Claiming makes ${c.label} the owner, resets the idle time and adds 1 to each delivery count. Redis can't tell a dead consumer from a slow one: it only sees time passing.`,
      node: groupNode(g.id),
    });
  } else if (manual) {
    ctx.log("info", `${c.label}: XAUTOCLAIM found nothing idle for ${s.settings.minIdleMs / 1000}s`, { node: groupNode(g.id) });
  }
  if (deleted.length) {
    ctx.log("info", `XAUTOCLAIM dropped ${orderList(deleted)} from the ${g.name} PEL: trimmed from the stream`, {
      detail: "Since Redis 7.0, XAUTOCLAIM deletes PEL entries whose data no longer exists and returns their IDs in the third element of its reply.",
      node: groupNode(g.id),
    });
  }
  const p = sendPacket(s, ctx, {
    kind: "claimed",
    from: groupNode(g.id),
    to: c.id,
    label: claimed.length ? `+${claimed.length} claimed` : "0-0 []",
    poison: claimed.some((d) => d.poison && g.crashOnPoison),
  });
  ctx.schedule(p.arriveAt - ctx.now, { type: "claimed-arrive", consumer: c.id, life: c.life, list: claimed, packet: p.id });
}

function onAck(s: State, ctx: Ctx, c: Consumer, n: number) {
  const g = s.groups[c.group];
  const i = g.pel.findIndex((p) => p.n === n);
  if (i < 0) return; // (integer) 0: already acknowledged (or claimed and acked by someone else)
  const p = g.pel[i];
  g.pel.splice(i, 1);
  g.acked++;
  if (!s.flags.ack) {
    s.flags.ack = true;
    ctx.log("info", `${c.label}: XACK ${STREAM_KEY} ${g.name} ${p.id} removed order ${p.order} from the PEL`, {
      detail: "XACK replies with how many IDs it removed. Until this point, Redis assumed the entry might not have been processed.",
      node: groupNode(g.id),
    });
  }
}

// ---------- consumer side ----------

function startRead(s: State, ctx: Ctx, c: Consumer) {
  if (c.status !== "running" || c.reading || c.hung || !s.server.up) return;
  c.reading = true;
  const p = sendUp(s, ctx, c, { kind: "read", label: "XREADGROUP" });
  ctx.schedule(p.arriveAt - ctx.now, { type: "read-arrive", consumer: c.id, conn: c.conn, history: c.history, packet: p.id });
}

function sendAck(s: State, ctx: Ctx, c: Consumer, d: Delivery) {
  // No connection (Redis down): the XACK fails and the entry stays pending.
  if (!s.components.ack || c.status !== "running") return;
  const p = sendUp(s, ctx, c, { kind: "ack", label: "XACK" });
  ctx.schedule(p.arriveAt - ctx.now, { type: "ack-arrive", consumer: c.id, srv: s.server.restartGen, n: d.n, packet: p.id });
}

/** Take the next local entry: skip nil ones, dead-letter over-delivered ones, else process it. Read more when empty. */
function pump(s: State, ctx: Ctx, c: Consumer) {
  if ((c.status !== "running" && c.status !== "reconnecting") || c.hung || c.processing) return;
  while (c.queue.length) {
    const d = c.queue.shift()!;
    if (d.gone) {
      // XREADGROUP returned the ID with nil fields: nothing to process, so acknowledge it.
      sendAck(s, ctx, c, d);
      continue;
    }
    if (s.components.ack && s.components.deadLetter && d.deliveries > s.settings.maxDeliveries) {
      if (c.status !== "running") continue;
      const p = sendPacket(s, ctx, { kind: "dlq", from: c.id, to: STREAM, label: "XADD dead", error: true }, c.lastUp + 1);
      c.lastUp = p.arriveAt;
      ctx.schedule(p.arriveAt - ctx.now, { type: "dlq-arrive", consumer: c.id, srv: s.server.restartGen, d, packet: p.id });
      sendAck(s, ctx, c, d);
      continue;
    }
    c.processing = d;
    c.procEnds = ctx.now + c.processMs;
    ctx.schedule(c.processMs, { type: "process-done", consumer: c.id, life: c.life, gen: c.procGen });
    return;
  }
  startRead(s, ctx, c);
}

function enqueue(c: Consumer, list: Delivery[]) {
  for (const d of list) {
    if (c.processing?.n === d.n) continue;
    const i = c.queue.findIndex((q) => q.n === d.n);
    if (i >= 0) c.queue[i] = d;
    else c.queue.push(d);
  }
  c.queue.sort((a, b) => a.n - b.n);
}

type Death = "poison" | "kill" | "stop";

function killConsumer(s: State, ctx: Ctx, c: Consumer, why: Death) {
  const g = s.groups[c.group];
  const held = [...(c.processing ? [c.processing] : []), ...c.queue];
  c.life++;
  c.conn++;
  c.queue = [];
  c.processing = null;
  c.reading = false;
  c.claiming = false;
  c.blockedSince = null;
  c.hung = false;
  c.history = true;
  s.blocked = s.blocked.filter((b) => b.consumer !== c.id);
  if (why !== "stop") c.crashes++;
  c.status = why === "stop" ? "offline" : "crashed";
  if (c.status === "crashed") {
    c.restartGen++;
    ctx.schedule(CONSUMER_RESTART_MS, { type: "consumer-restart", consumer: c.id, gen: c.restartGen });
  }

  const pending = pendingOf(g, c.id);
  let detail: string;
  if (!s.components.ack) {
    g.lostNoAck += held.length;
    detail = held.length
      ? `It held ${orderList(held)}. Under NOACK nothing was in the PEL, so Redis already counts them as done: they are gone for the ${g.name} group.`
      : "It held no entries, so nothing was lost this time.";
  } else {
    const it = pending === 1 ? "it" : "them";
    detail =
      pending === 0
        ? "It had nothing pending, so nothing is stuck."
        : `Its ${pending} pending entr${pending === 1 ? "y stays" : "ies stay"} in the ${g.name} PEL, owned by ${c.label}. Redis does not redeliver ${it} by itself: ${
            s.components.claim
              ? `another consumer's XAUTOCLAIM can take ${it} once idle for ${s.settings.minIdleMs / 1000}s`
              : `with no XAUTOCLAIM loop, only this consumer reading its own history (ID 0) will get ${it} back`
          }.`;
  }

  if (why === "poison") {
    const p = g.pel.find((x) => x.n === held[0]?.n);
    ctx.log("error", `${c.label} crashed processing order ${held[0]?.order} (malformed payload)`, {
      detail: `${p ? `Delivery count is now ${p.deliveries}. ` : ""}${detail} ${
        s.components.ack ? "On restart it reads its own pending entries first (XREADGROUP … 0), gets the same entry, and crashes again unless something breaks the loop." : ""
      }`,
      node: c.id,
    });
  } else if (why === "kill") {
    ctx.log("error", `${c.label} was killed`, { detail: `A supervisor restarts it in ${CONSUMER_RESTART_MS / 1000}s. ${detail}`, node: c.id });
  } else {
    ctx.log("warn", `${c.label} went offline (scaled down, host lost…)`, { detail, node: c.id });
  }
}

function freshConsumer(id: string, label: string, group: string, processMs: number): Consumer {
  return {
    id,
    label,
    group,
    status: "running",
    life: 0,
    conn: 0,
    history: false,
    reading: false,
    blockedSince: null,
    blockGen: 0,
    claiming: false,
    queue: [],
    processing: null,
    procEnds: 0,
    procLeft: 0,
    procGen: 0,
    hung: false,
    processMs,
    restartGen: 0,
    lastUp: 0,
    done: 0,
    dups: 0,
    crashes: 0,
    dupNotedAt: -Infinity,
    recent: [],
  };
}

function freshGroup(id: string, consumers: string[], crashOnPoison: boolean): Group {
  return {
    id,
    name: id,
    consumers,
    crashOnPoison,
    lastN: 0,
    lastId: "0-0",
    lagValid: true,
    pel: [],
    delivered: 0,
    acked: 0,
    claimed: 0,
    trimmedUnread: 0,
    lostNoAck: 0,
    duplicates: 0,
    deadLettered: 0,
    processed: {},
    lossNoted: false,
  };
}

function produce(s: State, ctx: Ctx, prodId: string, poison: boolean) {
  const prod = s.producers[prodId];
  prod.seq++;
  prod.sent++;
  const p = sendPacket(s, ctx, { kind: "xadd", from: prodId, to: STREAM, label: "XADD", poison }, prod.lastUp + 1);
  prod.lastUp = p.arriveAt;
  ctx.schedule(p.arriveAt - ctx.now, { type: "xadd-arrive", prod: prodId, order: prod.seq, poison, packet: p.id });
}

// ---------- model ----------

export const model: SimModel<State, Event, Action, Params> = {
  init(params, ctx) {
    const s: State = {
      settings: { ...params.settings },
      components: { ...params.components },
      server: { up: true, downSince: null, restartGen: 0 },
      stream: { entries: [], entriesAdded: 0, lastMs: 0, lastSeq: 0, trimmed: 0, danglingNoted: false },
      deadLetter: [],
      producers: {
        P1: {
          id: "P1",
          label: "checkout-api",
          auto: true,
          autoGen: 0,
          intervalMs: 900,
          seq: 0,
          sent: 0,
          failed: 0,
          lastReply: null,
          failNoted: false,
          lastUp: 0,
        },
      },
      prodIds: ["P1"],
      groups: {
        mailers: freshGroup("mailers", ["C1", "C2"], true),
        analytics: freshGroup("analytics", ["C3"], false),
      },
      groupIds: ["mailers", "analytics"],
      consumers: {
        C1: freshConsumer("C1", "mailer-1", "mailers", 300),
        C2: freshConsumer("C2", "mailer-2", "mailers", 300),
        C3: freshConsumer("C3", "analytics-1", "analytics", 300),
      },
      consIds: ["C1", "C2", "C3"],
      blocked: [],
      packets: [],
      nextId: 1,
      flags: { xadd: false, groups: {}, ack: false, block: false },
    };
    ctx.log("info", "Stream and consumer groups created", {
      detail: `XGROUP CREATE ${STREAM_KEY} mailers $ MKSTREAM · XGROUP CREATE ${STREAM_KEY} analytics $. "$" means each group starts after the current last entry. Consumers loop on XREADGROUP GROUP <group> <name> COUNT ${s.settings.count} BLOCK ${BLOCK_MS}${s.components.ack ? "" : " NOACK"} STREAMS ${STREAM_KEY} >.`,
      node: STREAM,
    });
    ctx.schedule(400, { type: "auto", prod: "P1", gen: 0 });
    s.consIds.forEach((id, i) => {
      ctx.schedule(100 + i * 60, { type: "reconnect", consumer: id });
      ctx.schedule(CLAIM_EVERY_MS + i * 1000, { type: "claim-tick", consumer: id });
    });
    for (const id of s.consIds) s.consumers[id].status = "reconnecting";
    return s;
  },

  handle(s, e, ctx) {
    switch (e.type) {
      case "auto": {
        const prod = s.producers[e.prod];
        if (!prod.auto || e.gen !== prod.autoGen) return;
        produce(s, ctx, prod.id, false);
        ctx.schedule(prod.intervalMs * ctx.rng.range(0.85, 1.15), { type: "auto", prod: prod.id, gen: prod.autoGen });
        return;
      }
      case "xadd-arrive":
        dropPacket(s, e.packet);
        onXadd(s, ctx, e.prod, e.order, e.poison);
        return;
      case "reply-arrive":
        dropPacket(s, e.packet);
        s.producers[e.prod].lastReply = { text: e.text, at: ctx.now, error: e.error };
        return;
      case "read-arrive": {
        dropPacket(s, e.packet);
        const c = s.consumers[e.consumer];
        if (!s.server.up || e.conn !== c.conn) return;
        onRead(s, ctx, c, e.history);
        return;
      }
      case "block-timeout": {
        const c = s.consumers[e.consumer];
        const i = s.blocked.findIndex((b) => b.consumer === c.id && b.gen === e.gen && b.conn === e.conn);
        if (i < 0) return;
        s.blocked.splice(i, 1);
        c.blockedSince = null;
        reply(s, ctx, c, [], false, "(nil)");
        return;
      }
      case "entries-arrive": {
        dropPacket(s, e.packet);
        const c = s.consumers[e.consumer];
        if (e.conn !== c.conn) return; // the connection died: entries stay pending in Redis
        c.reading = false;
        if (e.history && e.list.length === 0) c.history = false;
        if (e.history && e.list.length > 0) {
          ctx.log("info", `${c.label} re-read its pending entries: ${orderList(e.list)}`, {
            detail: `XREADGROUP … STREAMS ${STREAM_KEY} 0 returns this consumer's own PEL instead of new entries. Delivery count${e.list.length > 1 ? "s are" : " is"} now ${e.list.map((d) => d.deliveries).join(", ")}.${
              e.list.some((d) => d.gone) ? " Trimmed entries come back as the ID with nil fields." : ""
            }`,
            node: c.id,
          });
        }
        enqueue(c, e.list);
        pump(s, ctx, c);
        return;
      }
      case "process-done": {
        const c = s.consumers[e.consumer];
        if (e.life !== c.life || e.gen !== c.procGen || !c.processing) return;
        const d = c.processing;
        const g = s.groups[c.group];
        if (d.poison && g.crashOnPoison) {
          killConsumer(s, ctx, c, "poison");
          return;
        }
        c.processing = null;
        c.done++;
        c.recent.unshift(d.order);
        c.recent.length = Math.min(c.recent.length, RECENT);
        const times = (g.processed[d.order] ?? 0) + 1;
        g.processed[d.order] = times;
        if (times > 1) {
          c.dups++;
          g.duplicates++;
          if (ctx.now - c.dupNotedAt > 5000) {
            c.dupNotedAt = ctx.now;
            ctx.log("warn", `${c.label} processed order ${d.order} a second time`, {
              detail: `Consumer groups give at-least-once delivery: an entry that was processed but not acknowledged in time (a hung consumer, a lost XACK) is delivered again. ${
                g.pel.some((p) => p.n === d.n)
                  ? "The first XACK never arrived, so this one is the one that removes it from the PEL."
                  : "Someone else already acknowledged it, so this XACK returns 0."
              } Handlers must be idempotent, e.g. keyed on the entry ID.`,
              node: c.id,
            });
          }
        }
        sendAck(s, ctx, c, d);
        pump(s, ctx, c);
        return;
      }
      case "ack-arrive": {
        dropPacket(s, e.packet);
        const c = s.consumers[e.consumer];
        if (!s.server.up || e.srv !== s.server.restartGen) return; // lost in the crash: the entry stays pending
        onAck(s, ctx, c, e.n);
        return;
      }
      case "dlq-arrive": {
        dropPacket(s, e.packet);
        const c = s.consumers[e.consumer];
        if (!s.server.up || e.srv !== s.server.restartGen) return;
        const g = s.groups[c.group];
        s.deadLetter.push({ id: e.d.id, order: e.d.order, deliveries: e.d.deliveries });
        g.deadLettered++;
        ctx.log("warn", `${c.label} moved order ${e.d.order} to ${DEAD_KEY} after ${e.d.deliveries - 1} failed deliveries`, {
          detail: `Its delivery count (${e.d.deliveries}) is over the limit of ${s.settings.maxDeliveries}, so instead of processing it again the consumer runs XADD ${DEAD_KEY} and XACKs the original. Redis has no built-in dead-letter queue: this is application logic reading the count from XPENDING (or XREADGROUP CLAIM in Redis 8.4+).`,
          node: c.id,
        });
        return;
      }
      case "claim-tick": {
        const c = s.consumers[e.consumer];
        ctx.schedule(CLAIM_EVERY_MS, e);
        if (!s.components.claim || !s.components.ack || c.status !== "running" || c.hung || c.claiming || !s.server.up) return;
        c.claiming = true;
        const p = sendPacket(s, ctx, { kind: "claim", from: c.id, to: groupNode(c.group), label: "XAUTOCLAIM" });
        ctx.schedule(p.arriveAt - ctx.now, { type: "claim-arrive", consumer: c.id, life: c.life, packet: p.id, manual: false });
        return;
      }
      case "claim-arrive": {
        dropPacket(s, e.packet);
        const c = s.consumers[e.consumer];
        if (!s.server.up || e.life !== c.life) return;
        onClaim(s, ctx, c, e.manual);
        return;
      }
      case "claimed-arrive": {
        dropPacket(s, e.packet);
        const c = s.consumers[e.consumer];
        if (e.life !== c.life) return;
        c.claiming = false;
        enqueue(c, e.list);
        pump(s, ctx, c);
        return;
      }
      case "consumer-restart": {
        const c = s.consumers[e.consumer];
        if (e.gen !== c.restartGen || c.status !== "crashed") return;
        c.status = "reconnecting";
        ctx.schedule(0, { type: "reconnect", consumer: c.id });
        return;
      }
      case "reconnect": {
        const c = s.consumers[e.consumer];
        if (c.status !== "reconnecting") return;
        if (!s.server.up) {
          ctx.schedule(RECONNECT_MS, e);
          return;
        }
        c.status = "running";
        c.reading = false;
        startRead(s, ctx, c);
        pump(s, ctx, c);
        return;
      }
      case "server-restart": {
        if (e.gen !== s.server.restartGen || s.server.up) return;
        s.server.up = true;
        s.server.downSince = null;
        for (const id of s.prodIds) s.producers[id].failNoted = false;
        const pending = s.groupIds.reduce((n, id) => n + s.groups[id].pel.length, 0);
        ctx.log("ok", "redis-server is back: the stream and both groups were reloaded from the AOF", {
          detail: `${s.stream.entries.length} entries, each group's last-delivered-id and ${pending} pending entr${pending === 1 ? "y" : "ies"} survived, because they are part of the key, not of the connections. Consumers reconnect and read their own pending entries (ID 0) before new ones.`,
          node: STREAM,
        });
        return;
      }
    }
  },

  act(s, a, ctx) {
    switch (a.type) {
      case "xadd":
        produce(s, ctx, a.prod, !!a.poison);
        if (a.poison) {
          ctx.log("warn", `${s.producers[a.prod].label} sent a malformed order`, {
            detail: "The mailers' email template throws on it and the process exits. analytics only counts orders, so it handles it fine.",
            node: a.prod,
          });
        }
        return;
      case "burst": {
        for (let i = 0; i < a.n; i++) produce(s, ctx, a.prod, false);
        ctx.log("info", `${s.producers[a.prod].label} sent a burst of ${a.n} orders`, {
          detail: "More entries arrive than the blocked consumers asked for, so the next XREADGROUP calls return full batches of COUNT entries.",
          node: a.prod,
        });
        return;
      }
      case "set-auto": {
        const prod = s.producers[a.prod];
        if (prod.auto === a.on) return;
        prod.auto = a.on;
        prod.autoGen++;
        if (a.on) ctx.schedule(0, { type: "auto", prod: prod.id, gen: prod.autoGen });
        return;
      }
      case "set-interval": {
        const prod = s.producers[a.prod];
        prod.intervalMs = a.ms;
        if (prod.auto) {
          prod.autoGen++;
          ctx.schedule(a.ms, { type: "auto", prod: prod.id, gen: prod.autoGen });
        }
        return;
      }
      case "set-hung": {
        const c = s.consumers[a.consumer];
        if (c.hung === a.on || c.status === "offline" || c.status === "crashed") return;
        c.hung = a.on;
        if (a.on) {
          if (c.processing) {
            c.procLeft = Math.max(0, c.procEnds - ctx.now);
            c.procGen++;
          }
          ctx.log("warn", `${c.label} hung (stuck call, long GC pause, deadlock…)`, {
            detail: `Its connection stays open and it still owns its pending entries, but it neither processes nor acknowledges them. To Redis it looks exactly like a slow consumer.`,
            node: c.id,
          });
        } else {
          ctx.log("ok", `${c.label} is running again`, { node: c.id });
          if (c.processing) {
            c.procEnds = ctx.now + c.procLeft;
            ctx.schedule(c.procLeft, { type: "process-done", consumer: c.id, life: c.life, gen: c.procGen });
          }
          pump(s, ctx, c);
        }
        return;
      }
      case "set-process-ms":
        s.consumers[a.consumer].processMs = a.ms;
        return;
      case "crash-consumer": {
        const c = s.consumers[a.consumer];
        if (c.status === "running" || c.status === "reconnecting") killConsumer(s, ctx, c, "kill");
        return;
      }
      case "stop-consumer": {
        const c = s.consumers[a.consumer];
        if (c.status !== "offline") killConsumer(s, ctx, c, "stop");
        return;
      }
      case "start-consumer": {
        const c = s.consumers[a.consumer];
        if (c.status !== "offline") return;
        c.status = "reconnecting";
        ctx.log("ok", `${c.label} started`, {
          detail: s.components.ack
            ? "It reads its own pending entries first (ID 0), then new ones (>), from where its group left off."
            : "It reads new entries (>) from where its group left off.",
          node: c.id,
        });
        ctx.schedule(0, { type: "reconnect", consumer: c.id });
        return;
      }
      case "claim-now": {
        const c = s.consumers[a.consumer];
        if (c.status !== "running" || !s.server.up || !s.components.ack) return;
        const p = sendPacket(s, ctx, { kind: "claim", from: c.id, to: groupNode(c.group), label: "XAUTOCLAIM" });
        ctx.schedule(p.arriveAt - ctx.now, { type: "claim-arrive", consumer: c.id, life: c.life, packet: p.id, manual: true });
        return;
      }
      case "crash-server": {
        if (!s.server.up) return;
        s.server.up = false;
        s.server.downSince = ctx.now;
        s.blocked = [];
        for (const id of s.consIds) {
          const c = s.consumers[id];
          c.conn++;
          c.reading = false;
          c.claiming = false;
          c.blockedSince = null;
          if (c.status === "running") {
            c.status = "reconnecting";
            c.history = s.components.ack;
            ctx.schedule(RECONNECT_MS, { type: "reconnect", consumer: id });
          }
        }
        ctx.log("error", "redis-server crashed", {
          detail:
            "Every connection drops. Consumers keep working on the entries they already hold, but their XACKs have nowhere to go, so those entries stay pending. With appendonly yes the stream, the groups and their PELs are rebuilt from the AOF on restart.",
          node: STREAM,
        });
        const gen = ++s.server.restartGen;
        ctx.schedule(RESTART_MS, { type: "server-restart", gen });
        return;
      }
      case "restart-server":
        if (!s.server.up) ctx.schedule(0, { type: "server-restart", gen: s.server.restartGen });
        return;
    }
  },
};

/** Every node id the canvas draws (NodeBox `id`), for `SimDefinition.nodeIds` and flow tests. */
export function nodeIds(s: State): string[] {
  return [...s.prodIds, STREAM, ...s.groupIds.map(groupNode), ...s.consIds];
}
