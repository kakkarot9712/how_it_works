import type { SimContext, SimModel } from "@/engine/types";
import { murmur2 } from "@/lib/murmur2";

/**
 * Kafka 4.4 consumer groups. A producer writes keyed records to topic `orders` (3 partitions);
 * the producer's built-in partitioner picks the partition with murmur2(key) % 3, the same hash
 * as `BuiltInPartitioner.partitionForKey`. Up to four consumers in group `workers` pull
 * with long-polling Fetch requests, process records one at a time, and commit offsets to the
 * group coordinator (auto commit, commit after processing, or commit before processing).
 *
 * Rebalances follow either the consumer protocol (KIP-848, `group.protocol=consumer`): the
 * coordinator computes a sticky target assignment and moves partitions one heartbeat at a time,
 * revoke first, assign after; or the classic protocol with the default eager RangeAssignor:
 * every member revokes everything and rejoins (JoinGroup), and nobody consumes until the
 * assignment comes back. Liveness: heartbeats against the session timeout, and
 * max.poll.interval.ms against a poll loop that stops calling poll().
 *
 * Time runs in slow motion and the timeouts are scaled down (see index.ts timeNote).
 */

// ---------- ids ----------
export const PRODUCER = "producer";
export const COORD = "coordinator";
export const TOPIC = "orders";
export const GROUP = "workers";
export const DLQ_TOPIC = "orders.dlq";
export const PARTITIONS = [0, 1, 2] as const;
export const CONSUMERS = [1, 2, 3, 4] as const;
export const partId = (p: number) => `${TOPIC}-${p}`;
export const consId = (c: number) => `consumer-${c}`;
export function parsePart(id: string | null): number | null {
  const m = id?.match(/^orders-(\d)$/);
  return m ? Number(m[1]) : null;
}
export function parseCons(id: string | null): number | null {
  const m = id?.match(/^consumer-(\d)$/);
  return m ? Number(m[1]) : null;
}

/** Record keys. murmur2 % 3 → u2, u4: 0 · u1, u3: 1 · u5, u7: 2 (checked in model.test.ts). */
export const KEYS = ["u1", "u2", "u3", "u4", "u5", "u7"] as const;
export const HOT_KEY = "u1";
/** One key per partition, used to aim a poison record at a partition. */
export const KEY_FOR_PARTITION = ["u2", "u1", "u5"];
/** Keyless records stick to one partition for this many records (stands in for batch.size). */
export const STICKY_RECORDS = 4;
/** fetch.max.wait.ms (default 500): how long the broker holds an empty fetch. */
export const FETCH_WAIT_MS = 500;
const TICK_MS = 100;

// ---------- the partitioner: Kafka's murmur2 ----------
export { murmur2 };
/** BuiltInPartitioner.partitionForKey: toPositive(murmur2(key)) % numPartitions. */
export const partitionForKey = (key: string, n = PARTITIONS.length) => (murmur2(key) & 0x7fffffff) % n;

// ---------- data ----------
export type CommitMode = 0 | 1 | 2; // auto, after processing, before processing
export const COMMIT_MODES = ["auto commit", "after processing", "before processing"];

export interface Settings {
  consumers: number;
  commitMode: number;
  produceEveryMs: number;
  processMs: number;
  hotKeyPct: number;
  maxPollRecords: number;
  maxPollIntervalMs: number;
  sessionMs: number;
  heartbeatMs: number;
  autoCommitMs: number;
  latencyMs: number;
}
export interface Components {
  /** partitioner.ignore.keys=false: keyed records go to murmur2(key) % partitions. */
  keyPartitioning: boolean;
  /** group.protocol=consumer (KIP-848). Off: classic protocol, eager RangeAssignor. */
  incremental: boolean;
  /** The application catches a failing record and parks it in orders.dlq. Off: it retries forever. */
  deadLetter: boolean;
}
export interface Params {
  settings: Settings;
  components: Components;
}

export interface Rec {
  offset: number;
  key: string;
  /** Per-key sequence number, to check per-key order. */
  seq: number;
  poison: boolean;
  /** Times the application finished processing it (2+ = duplicate). */
  processed: number;
  /** Committed past without ever being processed. */
  lost: boolean;
  dlq: boolean;
}
export interface Partition {
  log: Rec[];
  /** Fetches held by the broker (long poll) until data arrives or fetch.max.wait.ms. */
  held: { fid: number; c: number; gen: number; offset: number }[];
}

export type PacketKind = "produce" | "fetch" | "fetch-resp" | "hb" | "hb-resp" | "commit" | "commit-resp";
export interface PacketData {
  c?: number;
  p?: number;
  gen?: number;
  fid?: number;
  offset?: number;
  offsets?: number[];
  key?: string;
  seq?: number;
  poison?: boolean;
  /** Heartbeat: partitions the member owns right now. */
  owned?: number[];
  join?: boolean;
  leave?: boolean;
  /** hb-resp */
  revoke?: number[];
  assign?: number[];
  assignOffsets?: number[];
  rebalance?: boolean;
  unknown?: boolean;
  epoch?: number;
  /** commit: [partition, offset] pairs; commit-resp: ok */
  commits?: [number, number][];
  ok?: boolean;
}
export interface Packet {
  id: number;
  kind: PacketKind;
  from: string;
  to: string;
  sentAt: number;
  arriveAt: number;
  label: string;
  data: PacketData;
}

export interface Processing {
  p: number;
  offset: number;
  startedAt: number;
  endsAt: number;
  attempts: number;
}
export interface Consumer {
  id: number;
  up: boolean;
  /** Down because it was killed (not shut down or never started). */
  crashed: boolean;
  /** Bumped on crash/restart: events and replies for an older incarnation are ignored. */
  gen: number;
  /** Member of the group as far as the client knows. */
  joined: boolean;
  /** Join sent, assignment not back yet. */
  joining: boolean;
  /** Left the group because poll() wasn't called within max.poll.interval.ms. */
  pollTimedOut: boolean;
  epoch: number;
  owned: number[];
  position: Record<number, number>;
  fetching: Record<number, number | null>;
  buffer: { p: number; offset: number }[];
  processing: Processing | null;
  slow: number;
  lastPollAt: number;
  nextHbAt: number;
  lastAutoCommitAt: number;
  committing: boolean;
  /** Something processed (or returned) since the last commit. */
  dirty: boolean;
  /** Partitions to give up at the next poll (consumer protocol). */
  pendingRevoke: number[];
  /** Classic: REBALANCE_IN_PROGRESS seen; revoke everything and rejoin at the next poll. */
  rejoinNeeded: boolean;
  processedCount: number;
  dupCount: number;
  dlqCount: number;
  dupNoted: boolean;
  poisonNoted: boolean;
}
export interface Member {
  /** The consumer incarnation that joined (replies carry it). */
  gen: number;
  lastHb: number;
  epoch: number;
  /** The coordinator's view of what the member owns. */
  owned: number[];
  target: number[];
  /** Classic: JoinGroup received in the current rebalance. */
  joinedRound: boolean;
}
export type GroupState = "Empty" | "Stable" | "Assigning" | "Reconciling" | "PreparingRebalance" | "CompletingRebalance";
export interface Coordinator {
  state: GroupState;
  groupEpoch: number;
  members: Record<number, Member>;
  committed: number[];
  /** Classic: when the PreparingRebalance phase gives up on members that haven't rejoined. */
  rebalanceDeadline: number | null;
  rebalances: number;
}
export interface ProducerState {
  keySeq: Record<string, number>;
  sent: number;
  recent: { key: string; p: number; poison: boolean }[];
  stickyPart: number;
  stickyLeft: number;
}

export interface State {
  settings: Settings;
  components: Components;
  packets: Packet[];
  nextId: number;
  producer: ProducerState;
  partitions: Partition[];
  consumers: Record<number, Consumer>;
  coord: Coordinator;
  /** Highest per-key sequence processed so far, to spot out-of-order processing. */
  maxSeqDone: Record<string, number>;
  outOfOrder: number;
  orderNoted: boolean;
  lost: number;
  duplicates: number;
}

// ---------- events & actions ----------
export type Event =
  | { type: "tick" }
  | { type: "produce" }
  | { type: "arrive"; packet: number }
  | { type: "process-done"; c: number; gen: number }
  | { type: "fetch-timeout"; p: number; fid: number };

export type Action =
  | { type: "start"; c: number }
  | { type: "crash"; c: number }
  | { type: "shutdown"; c: number }
  | { type: "slow"; c: number; factor: number }
  | { type: "poison"; p: number }
  | { type: "burst"; n: number };

type Ctx = SimContext<Event>;

export const defaultSettings: Settings = {
  consumers: 2,
  commitMode: 0,
  produceEveryMs: 400,
  processMs: 250,
  hotKeyPct: 0,
  maxPollRecords: 5,
  maxPollIntervalMs: 6000,
  sessionMs: 4500,
  heartbeatMs: 1000,
  autoCommitMs: 5000,
  latencyMs: 150,
};
export const defaultComponents: Components = { keyPartitioning: true, incremental: true, deadLetter: true };

// ---------- helpers ----------
const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
const list = (a: number[]) => (a.length ? sorted(a).map(partId).join(", ") : "nothing");
const short = (a: number[]) => sorted(a).map((p) => `p${p}`).join(",");

function send(s: State, ctx: Ctx, kind: PacketKind, from: string, to: string, label: string, data: PacketData): Packet {
  const packet: Packet = { id: s.nextId++, kind, from, to, sentAt: ctx.now, arriveAt: ctx.now + s.settings.latencyMs, label, data };
  s.packets.push(packet);
  ctx.schedule(s.settings.latencyMs, { type: "arrive", packet: packet.id });
  return packet;
}

export const leo = (s: State, p: number) => s.partitions[p].log.length;
/** CURRENT-OFFSET as kafka-consumer-groups.sh shows it: the committed offset (none yet = 0 here). */
export const committedOf = (s: State, p: number) => Math.max(0, s.coord.committed[p]);
export const lagOf = (s: State, p: number) => leo(s, p) - committedOf(s, p);
export function ownerOf(s: State, p: number): number | null {
  for (const c of CONSUMERS) {
    const k = s.consumers[c];
    if (k.up && !k.pollTimedOut && k.owned.includes(p)) return c;
  }
  return null;
}
const mode = (s: State) => s.settings.commitMode as CommitMode;
const classic = (s: State) => !s.components.incremental;

// ---------- assignors ----------
/** Classic RangeAssignor for one topic: members sorted, the first (P % M) get one extra. */
function rangeAssign(members: number[]): Record<number, number[]> {
  const ms = sorted(members);
  const out: Record<number, number[]> = {};
  const per = Math.floor(PARTITIONS.length / ms.length);
  const extra = PARTITIONS.length % ms.length;
  let next = 0;
  ms.forEach((m, i) => {
    const n = per + (i < extra ? 1 : 0);
    out[m] = PARTITIONS.slice(next, next + n);
    next += n;
  });
  return out;
}

/** Sticky, balanced (the spirit of the `uniform` assignor): keep what fits the quota, move the rest. */
function uniformAssign(members: number[], current: Record<number, number[]>): Record<number, number[]> {
  const ms = sorted(members);
  const base = Math.floor(PARTITIONS.length / ms.length);
  let extra = PARTITIONS.length % ms.length;
  // The +1 slots go to members already holding more than the base, so fewer partitions move.
  const quota: Record<number, number> = {};
  const byHeld = [...ms].sort((a, b) => (current[b]?.length ?? 0) - (current[a]?.length ?? 0) || a - b);
  for (const m of byHeld) {
    quota[m] = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
  }
  const out: Record<number, number[]> = {};
  const taken = new Set<number>();
  for (const m of ms) {
    out[m] = [];
    for (const p of sorted(current[m] ?? [])) {
      if (out[m].length < quota[m] && !taken.has(p)) {
        out[m].push(p);
        taken.add(p);
      }
    }
  }
  for (const p of PARTITIONS) {
    if (taken.has(p)) continue;
    const m = ms.find((x) => out[x].length < quota[x]);
    if (m === undefined) continue;
    out[m].push(p);
    taken.add(p);
  }
  return out;
}

// ---------- coordinator ----------
function memberIds(s: State) {
  return Object.keys(s.coord.members).map(Number);
}

function recomputeTarget(s: State) {
  const ids = memberIds(s);
  if (!ids.length) return;
  const cur: Record<number, number[]> = {};
  for (const id of ids) cur[id] = s.coord.members[id].owned;
  const target = uniformAssign(ids, cur);
  for (const id of ids) s.coord.members[id].target = target[id];
}

function groupChanged(s: State, ctx: Ctx, why: string, node: string) {
  const g = s.coord;
  g.groupEpoch++;
  g.rebalances++;
  if (classic(s)) {
    if (!memberIds(s).length) {
      g.state = "Empty";
      return;
    }
    if (g.state !== "PreparingRebalance") {
      const disruptive = g.state === "Stable" && memberIds(s).some((id) => g.members[id].owned.length > 0);
      g.state = "PreparingRebalance";
      g.rebalanceDeadline = ctx.now + s.settings.maxPollIntervalMs;
      for (const id of memberIds(s)) g.members[id].joinedRound = false;
      ctx.log(disruptive ? "warn" : "info", disruptive ? `Rebalance: ${why}. The whole group stops` : `Rebalance: ${why}`, {
        detail:
          "Classic protocol, eager assignor: every member is told REBALANCE_IN_PROGRESS in its next heartbeat, revokes all its partitions and sends JoinGroup. Nobody consumes until the new assignment comes back.",
        node: COORD,
      });
    }
    return;
  }
  if (!memberIds(s).length) {
    g.state = "Empty";
    return;
  }
  recomputeTarget(s);
  g.state = "Reconciling";
  const plan = memberIds(s)
    .map((id) => `${consId(id)}: ${list(g.members[id].target)}`)
    .join(" · ");
  ctx.log("info", `Group epoch ${g.groupEpoch}: ${why}. New target assignment`, {
    detail: `${plan}. Consumer protocol (KIP-848): only partitions that move are revoked from their owner first, then assigned to the new one; everyone else keeps consuming.`,
    node: COORD,
  });
  void node;
}

function removeMember(s: State, ctx: Ctx, c: number, why: string) {
  if (!s.coord.members[c]) return;
  delete s.coord.members[c];
  groupChanged(s, ctx, why, consId(c));
}

function completeClassicRebalance(s: State, ctx: Ctx) {
  const g = s.coord;
  const ids = memberIds(s);
  g.rebalanceDeadline = null;
  if (!ids.length) {
    g.state = "Empty";
    return;
  }
  const assign = rangeAssign(ids);
  g.state = "Stable";
  for (const id of ids) {
    const m = g.members[id];
    m.owned = assign[id];
    m.target = assign[id];
    m.epoch = g.groupEpoch;
    send(s, ctx, "hb-resp", COORD, consId(id), m.owned.length ? `+${short(m.owned)}` : "none", {
      c: id,
      gen: m.gen,
      assign: m.owned,
      assignOffsets: m.owned.map((p) => g.committed[p]),
      epoch: g.groupEpoch,
    });
  }
  ctx.log("info", `Generation ${g.groupEpoch}: everyone rejoined, RangeAssignor hands out partitions`, {
    detail: `${ids.map((id) => `${consId(id)}: ${list(assign[id])}`).join(" · ")}. JoinGroup then SyncGroup: the group leader computed this assignment and each member collects its share.`,
    node: COORD,
  });
}

function coordOnHeartbeat(s: State, ctx: Ctx, pk: Packet) {
  const d = pk.data;
  const c = d.c!;
  const g = s.coord;
  const reply = (label: string, data: PacketData) => send(s, ctx, "hb-resp", COORD, consId(c), label, { c, gen: d.gen, ...data });

  if (d.leave) {
    removeMember(s, ctx, c, `${consId(c)} left the group`);
    return;
  }
  if (classic(s)) {
    if (d.join) {
      const fresh = !g.members[c];
      if (fresh) g.members[c] = { gen: d.gen!, lastHb: ctx.now, epoch: 0, owned: [], target: [], joinedRound: false };
      const m = g.members[c];
      m.gen = d.gen!;
      m.lastHb = ctx.now;
      m.owned = [];
      if (fresh || g.state === "Stable" || g.state === "Empty") groupChanged(s, ctx, `${consId(c)} sent JoinGroup`, consId(c));
      m.joinedRound = true;
      if (memberIds(s).every((id) => g.members[id].joinedRound)) completeClassicRebalance(s, ctx);
      return;
    }
    const m = g.members[c];
    if (!m) return void reply("unknown", { unknown: true });
    m.lastHb = ctx.now;
    if (g.state === "PreparingRebalance" && !m.joinedRound) return void reply("rebal.", { rebalance: true });
    reply("ok", {});
    return;
  }

  // Consumer protocol: ConsumerGroupHeartbeat.
  if (d.join) {
    g.members[c] = { gen: d.gen!, lastHb: ctx.now, epoch: 0, owned: [], target: [], joinedRound: true };
    groupChanged(s, ctx, `${consId(c)} joined`, consId(c));
  }
  const m = g.members[c];
  if (!m) return void reply("fenced", { unknown: true });
  m.lastHb = ctx.now;
  // A revoked partition leaves the coordinator's view once the member reports it gone; an
  // assigned one stays even if this heartbeat was sent before the assignment arrived.
  const reported = d.owned ?? m.owned;
  m.owned = m.owned.filter((p) => reported.includes(p) || m.target.includes(p));
  const revoke = m.owned.filter((p) => !m.target.includes(p));
  if (revoke.length) return void reply(`−${short(revoke)}`, { revoke });
  const ownedByOthers = new Set(memberIds(s).filter((id) => id !== c).flatMap((id) => g.members[id].owned));
  const add = m.target.filter((p) => !m.owned.includes(p) && !ownedByOthers.has(p));
  if (add.length) {
    m.owned = sorted([...m.owned, ...add]);
    reply(`+${short(add)}`, { assign: add, assignOffsets: add.map((p) => g.committed[p]) });
  } else reply("ok", {});
  if (sorted(m.owned).join() === sorted(m.target).join()) m.epoch = g.groupEpoch;
  const settled = memberIds(s).every((id) => sorted(g.members[id].owned).join() === sorted(g.members[id].target).join());
  if (settled && g.state !== "Stable") {
    g.state = "Stable";
    ctx.log("ok", `Group is Stable at epoch ${g.groupEpoch}`, {
      detail: memberIds(s)
        .map((id) => `${consId(id)}: ${list(g.members[id].owned)}`)
        .join(" · "),
      node: COORD,
    });
  }
}

function coordOnCommit(s: State, ctx: Ctx, pk: Packet) {
  const d = pk.data;
  const ok = !!s.coord.members[d.c!];
  if (ok) for (const [p, off] of d.commits ?? []) s.coord.committed[p] = Math.max(s.coord.committed[p], off);
  send(s, ctx, "commit-resp", COORD, consId(d.c!), ok ? "ok" : "failed", { c: d.c, gen: d.gen, ok, commits: d.commits });
}

// ---------- partitions (broker side) ----------
function fetchReply(s: State, ctx: Ctx, p: number, h: { fid: number; c: number; gen: number; offset: number }) {
  const log = s.partitions[p].log;
  const end = Math.min(log.length, h.offset + s.settings.maxPollRecords);
  const offsets: number[] = [];
  for (let o = h.offset; o < end; o++) offsets.push(o);
  send(s, ctx, "fetch-resp", partId(p), consId(h.c), offsets.length ? `${offsets.length} rec` : "empty", { c: h.c, p, gen: h.gen, fid: h.fid, offsets });
}

function onFetch(s: State, ctx: Ctx, pk: Packet) {
  const d = pk.data;
  const p = d.p!;
  const h = { fid: d.fid!, c: d.c!, gen: d.gen!, offset: d.offset! };
  if (h.offset < leo(s, p)) return fetchReply(s, ctx, p, h);
  s.partitions[p].held.push(h);
  ctx.schedule(FETCH_WAIT_MS, { type: "fetch-timeout", p, fid: h.fid });
}

function append(s: State, ctx: Ctx, pk: Packet) {
  const d = pk.data;
  const part = s.partitions[d.p!];
  part.log.push({ offset: part.log.length, key: d.key!, seq: d.seq!, poison: !!d.poison, processed: 0, lost: false, dlq: false });
  const held = part.held.splice(0);
  for (const h of held) fetchReply(s, ctx, d.p!, h);
}

// ---------- producer ----------
function produce(s: State, ctx: Ctx, opts: { key?: string; poison?: boolean; p?: number } = {}) {
  const pr = s.producer;
  const key = opts.key ?? (s.settings.hotKeyPct > 0 && ctx.rng.next() * 100 < s.settings.hotKeyPct ? HOT_KEY : KEYS[ctx.rng.int(0, KEYS.length - 1)]);
  let p: number;
  if (opts.p !== undefined) p = opts.p;
  else if (s.components.keyPartitioning) p = partitionForKey(key);
  else {
    if (pr.stickyLeft <= 0) {
      const others = PARTITIONS.filter((x) => x !== pr.stickyPart);
      pr.stickyPart = others[ctx.rng.int(0, others.length - 1)];
      pr.stickyLeft = STICKY_RECORDS;
    }
    pr.stickyLeft--;
    p = pr.stickyPart;
  }
  const seq = (pr.keySeq[key] = (pr.keySeq[key] ?? 0) + 1);
  pr.sent++;
  pr.recent.unshift({ key, p, poison: !!opts.poison });
  pr.recent.length = Math.min(pr.recent.length, 6);
  send(s, ctx, "produce", PRODUCER, partId(p), opts.poison ? "poison" : key, { p, key, seq, poison: opts.poison });
}

// ---------- consumer (client side) ----------
function hb(s: State, ctx: Ctx, k: Consumer, extra: PacketData = {}) {
  const label = extra.join ? "Join" : extra.leave ? "Leave" : "HB";
  send(s, ctx, "hb", consId(k.id), COORD, label, { c: k.id, gen: k.gen, owned: [...k.owned], epoch: k.epoch, ...extra });
  k.nextHbAt = ctx.now + s.settings.heartbeatMs;
}

function join(s: State, ctx: Ctx, k: Consumer) {
  k.joined = true;
  k.joining = true;
  k.owned = [];
  k.position = {};
  k.fetching = {};
  k.pendingRevoke = [];
  k.rejoinNeeded = false;
  k.epoch = 0;
  hb(s, ctx, k, { join: true });
}

function commit(s: State, ctx: Ctx, k: Consumer, parts: number[], sync: boolean) {
  const commits: [number, number][] = parts.filter((p) => k.position[p] !== undefined).map((p) => [p, k.position[p]]);
  if (!commits.length) return false;
  send(s, ctx, "commit", consId(k.id), COORD, "commit", { c: k.id, gen: k.gen, commits });
  k.dirty = false;
  if (sync) k.committing = true;
  return true;
}

function dropPartitions(k: Consumer, parts: number[]) {
  k.owned = k.owned.filter((p) => !parts.includes(p));
  k.buffer = k.buffer.filter((b) => !parts.includes(b.p));
  for (const p of parts) {
    delete k.position[p];
    delete k.fetching[p];
  }
}

/** One call to poll(): rebalance callbacks, commits, then fetches. */
function poll(s: State, ctx: Ctx, k: Consumer) {
  k.lastPollAt = ctx.now;
  const m = mode(s);

  if (k.pollTimedOut) {
    k.pollTimedOut = false;
    ctx.log("info", `${consId(k.id)} calls poll() again and rejoins`, {
      detail: classic(s)
        ? "Its partitions were already given away; it starts over with JoinGroup."
        : "Time between subsequent calls to poll() was longer than the configured max.poll.interval.ms, exceeded approximately by … ms. Member … will rejoin the group now.",
      node: consId(k.id),
    });
    if (k.dirty && m !== 2) {
      send(s, ctx, "commit", consId(k.id), COORD, "commit", { c: k.id, gen: k.gen, commits: k.owned.filter((p) => k.position[p] !== undefined).map((p) => [p, k.position[p]]) });
      k.dirty = false;
    }
    join(s, ctx, k);
    return;
  }
  if (!k.joined) return;

  // Classic, eager: revoke everything (committing first) and send JoinGroup.
  if (k.rejoinNeeded) {
    if (k.owned.length && m !== 2) commit(s, ctx, k, k.owned, false);
    const had = k.owned;
    dropPartitions(k, k.owned);
    k.rejoinNeeded = false;
    k.joining = true;
    if (had.length)
      ctx.log("info", `${consId(k.id)} revokes ${list(had)} and rejoins`, {
        detail: "Eager rebalance: a member gives up all its partitions before JoinGroup, even the ones it will get back.",
        node: consId(k.id),
      });
    hb(s, ctx, k, { join: true });
    return;
  }

  // Consumer protocol: give up revoked partitions, commit them, ack in the next heartbeat.
  if (k.pendingRevoke.length) {
    const rv = k.pendingRevoke.filter((p) => k.owned.includes(p));
    k.pendingRevoke = [];
    if (rv.length) {
      if (m !== 2) commit(s, ctx, k, rv, false);
      dropPartitions(k, rv);
      ctx.log("info", `${consId(k.id)} revokes ${list(rv)} and keeps ${list(k.owned)}`, {
        detail: "It stops fetching the revoked partitions, commits their offsets, and acknowledges in its next heartbeat. Only then can the coordinator assign them to someone else.",
        node: consId(k.id),
      });
      hb(s, ctx, k);
    }
  }

  if (k.dirty && m === 1) {
    commit(s, ctx, k, k.owned, true);
    return; // commitSync: poll continues once the commit is answered
  }
  if (k.dirty && m === 0 && ctx.now - k.lastAutoCommitAt >= s.settings.autoCommitMs) {
    commit(s, ctx, k, k.owned, false);
    k.lastAutoCommitAt = ctx.now;
  }

  for (const p of k.owned) {
    if (k.fetching[p] != null || k.position[p] === undefined) continue;
    const pk = send(s, ctx, "fetch", consId(k.id), partId(p), `@${k.position[p]}`, { c: k.id, p, gen: k.gen, offset: k.position[p] });
    pk.data.fid = pk.id;
    k.fetching[p] = pk.id;
  }
}

function startProcessing(s: State, ctx: Ctx, k: Consumer, b: { p: number; offset: number }, attempts = 1) {
  const dur = s.settings.processMs * k.slow;
  k.processing = { p: b.p, offset: b.offset, startedAt: ctx.now, endsAt: ctx.now + dur, attempts };
  ctx.schedule(dur, { type: "process-done", c: k.id, gen: k.gen });
}

/** Drive the consumer's poll loop forward as far as it can go right now. */
function pump(s: State, ctx: Ctx, k: Consumer) {
  if (!k.up || k.processing || k.committing) return;
  const next = k.buffer.shift();
  if (next) return startProcessing(s, ctx, k, next);
  poll(s, ctx, k);
}

function onProcessed(s: State, ctx: Ctx, k: Consumer) {
  const pr = k.processing!;
  const rec = s.partitions[pr.p].log[pr.offset];
  if (rec.poison) {
    if (!s.components.deadLetter) {
      if (!k.poisonNoted) {
        k.poisonNoted = true;
        ctx.log("error", `${consId(k.id)} fails on ${partId(pr.p)}@${pr.offset} and retries it, again and again`, {
          detail: "The handler throws on this record. With no dead-letter handling the application retries the same record forever: it never returns to poll(), so nothing behind it on this partition moves.",
          node: consId(k.id),
        });
      }
      startProcessing(s, ctx, k, pr, pr.attempts + 1);
      return;
    }
    rec.dlq = true;
    k.dlqCount++;
    ctx.log("warn", `${consId(k.id)} parks ${partId(pr.p)}@${pr.offset} in ${DLQ_TOPIC} and moves on`, {
      detail: "The handler threw. The application catches it, writes the record to a dead-letter topic for later inspection, and carries on with the next offset.",
      node: consId(k.id),
    });
  } else {
    rec.processed++;
    k.processedCount++;
    if (rec.processed > 1) {
      k.dupCount++;
      s.duplicates++;
      if (!k.dupNoted) {
        k.dupNoted = true;
        ctx.log("warn", `${consId(k.id)} processes ${partId(pr.p)}@${pr.offset} a second time`, {
          detail: "It was processed before, but its offset was never committed. The new owner starts from the last committed offset, so everything after it is delivered again: at-least-once.",
          node: consId(k.id),
        });
      }
    } else {
      const max = s.maxSeqDone[rec.key] ?? 0;
      if (rec.seq < max) {
        s.outOfOrder++;
        if (!s.orderNoted) {
          s.orderNoted = true;
          ctx.log("warn", `Out of order: ${rec.key} #${rec.seq} processed after ${rec.key} #${max}`, {
            detail: "Records with the same key went to different partitions, and different consumers process those in parallel. Kafka orders records only within one partition.",
            node: consId(k.id),
          });
        }
      }
      s.maxSeqDone[rec.key] = Math.max(max, rec.seq);
    }
  }
  k.processing = null;
  if (mode(s) !== 2) k.dirty = true;
  pump(s, ctx, k);
}

function onAssigned(s: State, ctx: Ctx, k: Consumer, parts: number[], offsets: number[]) {
  const committedFor = new Map(parts.map((p, i) => [p, offsets[i] ?? -1]));
  parts = parts.filter((p) => !k.owned.includes(p));
  if (!parts.length) return;
  parts.forEach((p) => {
    k.owned.push(p);
    const committed = committedFor.get(p)!;
    const start = committed >= 0 ? committed : leo(s, p);
    k.position[p] = start;
    k.fetching[p] = null;
    // Anything below the committed offset that nobody processed is gone for this group.
    const missed = s.partitions[p].log.filter((r) => r.offset < start && r.processed === 0 && !r.lost && !r.dlq);
    if (missed.length) {
      for (const r of missed) r.lost = true;
      s.lost += missed.length;
      ctx.log("error", `${missed.length} records on ${partId(p)} were committed but never processed: lost`, {
        detail: `Offsets ${missed[0].offset}–${missed[missed.length - 1].offset}. The previous owner committed before processing them, then died. ${consId(k.id)} starts at the committed offset ${start}: at-most-once.`,
        node: partId(p),
      });
    }
  });
  k.owned = sorted(k.owned);
  k.dupNoted = false;
  ctx.log("info", `${consId(k.id)} is assigned ${list(parts)}`, {
    detail: parts.map((p) => `${partId(p)} from offset ${k.position[p]}`).join(", ") + " (the group's committed offset).",
    node: consId(k.id),
  });
}

function consumerOnHbResp(s: State, ctx: Ctx, k: Consumer, d: PacketData) {
  if (d.unknown) {
    if (!k.joined || k.joining) return;
    ctx.log("warn", `${consId(k.id)} is no longer a member: drops ${list(k.owned)} and rejoins`, {
      detail: classic(s) ? "UNKNOWN_MEMBER_ID: the coordinator removed it from the group." : "FENCED_MEMBER_EPOCH / UNKNOWN_MEMBER_ID: it must abandon all its partitions and rejoin with epoch 0.",
      node: consId(k.id),
    });
    dropPartitions(k, k.owned);
    join(s, ctx, k);
    return;
  }
  if (d.rebalance) {
    k.rejoinNeeded = true;
    return;
  }
  if (d.revoke) {
    for (const p of d.revoke) if (!k.pendingRevoke.includes(p)) k.pendingRevoke.push(p);
    return;
  }
  if (d.assign) {
    k.joining = false;
    if (d.epoch !== undefined) k.epoch = d.epoch;
    if (classic(s)) {
      dropPartitions(k, k.owned);
      k.owned = [];
    }
    if (d.assign.length) onAssigned(s, ctx, k, d.assign, d.assignOffsets ?? []);
    return;
  }
  k.joining = false;
}

function consumerOnArrive(s: State, ctx: Ctx, pk: Packet) {
  const d = pk.data;
  const k = s.consumers[d.c!];
  if (!k.up || d.gen !== k.gen) return;
  switch (pk.kind) {
    case "fetch-resp": {
      const p = d.p!;
      if (k.fetching[p] !== d.fid) return;
      k.fetching[p] = null;
      if (!k.owned.includes(p) || k.pollTimedOut) return;
      // poll() hands out at most max.poll.records in total; the rest is fetched again later.
      const room = Math.max(0, s.settings.maxPollRecords - k.buffer.length);
      const offs = (d.offsets ?? []).filter((o) => o >= k.position[p]).slice(0, room);
      for (const o of offs) k.buffer.push({ p, offset: o });
      if (offs.length) {
        k.position[p] = offs[offs.length - 1] + 1;
        if (mode(s) === 2) commit(s, ctx, k, [p], true);
        else if (mode(s) === 0) k.dirty = true;
      }
      break;
    }
    case "hb-resp":
      consumerOnHbResp(s, ctx, k, d);
      break;
    case "commit-resp":
      k.committing = false;
      if (!d.ok) {
        ctx.log("warn", `${consId(k.id)}'s offset commit is rejected: CommitFailedException`, {
          detail: "Only members of the group may commit. It was removed from the group, so its progress since the last commit is redone by whoever owns those partitions now.",
          node: consId(k.id),
        });
      }
      break;
  }
  pump(s, ctx, k);
}

function newConsumer(id: number): Consumer {
  return {
    id,
    up: false,
    crashed: false,
    gen: 0,
    joined: false,
    joining: false,
    pollTimedOut: false,
    epoch: 0,
    owned: [],
    position: {},
    fetching: {},
    buffer: [],
    processing: null,
    slow: 1,
    lastPollAt: 0,
    nextHbAt: 0,
    lastAutoCommitAt: 0,
    committing: false,
    dirty: false,
    pendingRevoke: [],
    rejoinNeeded: false,
    processedCount: 0,
    dupCount: 0,
    dlqCount: 0,
    dupNoted: false,
    poisonNoted: false,
  };
}

function startConsumer(s: State, ctx: Ctx, k: Consumer) {
  const keep = { processedCount: k.processedCount, dupCount: k.dupCount, dlqCount: k.dlqCount, slow: k.slow };
  Object.assign(k, newConsumer(k.id), keep, { up: true, gen: k.gen + 1, lastPollAt: ctx.now, lastAutoCommitAt: ctx.now });
  join(s, ctx, k);
}

// ---------- model ----------
export const model: SimModel<State, Event, Action, Params> = {
  init({ settings, components }, ctx) {
    const s: State = {
      settings: { ...settings },
      components: { ...components },
      packets: [],
      nextId: 1,
      producer: { keySeq: {}, sent: 0, recent: [], stickyPart: 0, stickyLeft: 0 },
      partitions: PARTITIONS.map(() => ({ log: [], held: [] })),
      consumers: Object.fromEntries(CONSUMERS.map((c) => [c, newConsumer(c)])),
      coord: { state: "Empty", groupEpoch: 0, members: {}, committed: PARTITIONS.map(() => 0), rebalanceDeadline: null, rebalances: 0 },
      maxSeqDone: {},
      outOfOrder: 0,
      orderNoted: false,
      lost: 0,
      duplicates: 0,
    };
    const n = Math.max(1, Math.min(4, settings.consumers));
    ctx.log("info", `Topic ${TOPIC} has 3 partitions; ${n} consumer${n > 1 ? "s" : ""} join group ${GROUP}`, {
      detail: components.incremental
        ? "group.protocol=consumer (KIP-848): the coordinator assigns partitions with the uniform assignor and moves them one heartbeat at a time."
        : "group.protocol=classic with the default RangeAssignor: eager rebalances, everyone stops and rejoins.",
      node: COORD,
    });
    ctx.log("info", components.keyPartitioning ? "The producer picks each partition from the record key: murmur2(key) % 3" : "partitioner.ignore.keys=true: the producer ignores keys and sticks to one partition per batch", {
      detail: components.keyPartitioning
        ? "u2, u4 → orders-0 · u1, u3 → orders-1 · u5, u7 → orders-2. Same key, same partition, so one key's records stay in order."
        : `Here a batch is ${STICKY_RECORDS} records; then it switches partition. A key's records end up in all three partitions.`,
      node: PRODUCER,
    });
    for (let c = 1; c <= n; c++) startConsumer(s, ctx, s.consumers[c]);
    ctx.schedule(0, { type: "tick" });
    ctx.schedule(300, { type: "produce" });
    return s;
  },

  handle(s, e, ctx) {
    switch (e.type) {
      case "produce": {
        produce(s, ctx);
        ctx.schedule(s.settings.produceEveryMs, { type: "produce" });
        return;
      }
      case "arrive": {
        const i = s.packets.findIndex((p) => p.id === e.packet);
        if (i < 0) return;
        const [pk] = s.packets.splice(i, 1);
        switch (pk.kind) {
          case "produce":
            return append(s, ctx, pk);
          case "fetch":
            return onFetch(s, ctx, pk);
          case "hb":
            return coordOnHeartbeat(s, ctx, pk);
          case "commit":
            return coordOnCommit(s, ctx, pk);
          default:
            return consumerOnArrive(s, ctx, pk);
        }
      }
      case "fetch-timeout": {
        const part = s.partitions[e.p];
        const i = part.held.findIndex((h) => h.fid === e.fid);
        if (i < 0) return;
        const [h] = part.held.splice(i, 1);
        fetchReply(s, ctx, e.p, h);
        return;
      }
      case "process-done": {
        const k = s.consumers[e.c];
        if (!k.up || k.gen !== e.gen || !k.processing) return;
        onProcessed(s, ctx, k);
        return;
      }
      case "tick": {
        ctx.schedule(TICK_MS, { type: "tick" });
        const st = s.settings;
        for (const c of CONSUMERS) {
          const k = s.consumers[c];
          if (!k.up) continue;
          const idle = !k.processing && !k.buffer.length && !k.committing;
          if (idle) {
            pump(s, ctx, k);
            k.lastPollAt = ctx.now;
          }
          if (k.joined && !k.pollTimedOut && ctx.now - k.lastPollAt > st.maxPollIntervalMs) {
            k.pollTimedOut = true;
            k.joined = false;
            k.fetching = {};
            ctx.log("warn", `${consId(k.id)}: poll timeout expired, it leaves the group`, {
              detail: `${classic(s) ? "consumer" : "Consumer"} poll timeout has expired. This means the time between subsequent calls to poll() was longer than the configured max.poll.interval.ms, which typically implies that the poll loop is spending too much time processing messages. You can address this either by increasing max.poll.interval.ms or by reducing the maximum size of batches returned in poll() with max.poll.records.`,
              node: consId(k.id),
            });
            hb(s, ctx, k, { leave: true });
            continue;
          }
          // A classic member doesn't heartbeat while its JoinGroup is pending.
          if (k.joined && !(classic(s) && k.joining) && ctx.now >= k.nextHbAt) hb(s, ctx, k);
        }
        // Coordinator: session expiry and the classic rebalance deadline.
        const g = s.coord;
        for (const id of memberIds(s)) {
          const waitingInJoin = g.state === "PreparingRebalance" && g.members[id].joinedRound;
          if (!waitingInJoin && ctx.now - g.members[id].lastHb > st.sessionMs) {
            ctx.log("error", `No heartbeat from ${consId(id)} for the session timeout: removed from the group`, {
              detail: `${classic(s) ? "session.timeout.ms" : "group.consumer.session.timeout.ms"} passed without a heartbeat. Its partitions will be reassigned, starting from the last committed offsets.`,
              node: COORD,
            });
            removeMember(s, ctx, id, `${consId(id)}'s session expired`);
          }
        }
        if (g.state === "PreparingRebalance" && g.rebalanceDeadline !== null && ctx.now >= g.rebalanceDeadline) {
          for (const id of memberIds(s)) if (!g.members[id].joinedRound) delete g.members[id];
          completeClassicRebalance(s, ctx);
        }
        return;
      }
    }
  },

  act(s, a, ctx) {
    switch (a.type) {
      case "start": {
        const k = s.consumers[a.c];
        if (k.up) return;
        ctx.log("info", `${consId(a.c)} starts and joins ${GROUP}`, { detail: classic(s) ? "It sends JoinGroup." : "It sends ConsumerGroupHeartbeat with member epoch 0.", node: consId(a.c) });
        startConsumer(s, ctx, k);
        return;
      }
      case "crash": {
        const k = s.consumers[a.c];
        if (!k.up) return;
        ctx.log("error", `${consId(a.c)} crashes (kill -9)`, {
          detail: `It held ${list(k.owned)}. No LeaveGroup, no final commit: the coordinator only notices when heartbeats stop for the session timeout.`,
          node: consId(a.c),
        });
        Object.assign(k, { ...newConsumer(k.id), crashed: true, gen: k.gen + 1, processedCount: k.processedCount, dupCount: k.dupCount, dlqCount: k.dlqCount, slow: k.slow });
        return;
      }
      case "shutdown": {
        const k = s.consumers[a.c];
        if (!k.up) return;
        if (k.joined && mode(s) !== 2 && k.owned.length) commit(s, ctx, k, k.owned, false);
        if (k.joined) hb(s, ctx, k, { leave: true });
        ctx.log("info", `${consId(a.c)} shuts down cleanly`, {
          detail: "close(): it commits its offsets (unless it already did, before processing) and leaves the group at once, so the rebalance starts without waiting for the session timeout.",
          node: consId(a.c),
        });
        Object.assign(k, { ...newConsumer(k.id), gen: k.gen + 1, processedCount: k.processedCount, dupCount: k.dupCount, dlqCount: k.dlqCount, slow: k.slow });
        return;
      }
      case "slow": {
        const k = s.consumers[a.c];
        k.slow = a.factor;
        ctx.log(a.factor > 1 ? "warn" : "info", a.factor > 1 ? `${consId(a.c)} slows down: ${a.factor}× longer per record` : `${consId(a.c)} is back to normal speed`, {
          detail: `A batch of max.poll.records=${s.settings.maxPollRecords} now takes about ${((s.settings.processMs * a.factor * s.settings.maxPollRecords) / 1000).toFixed(1)} s between polls (max.poll.interval.ms=${s.settings.maxPollIntervalMs}).`,
          node: consId(a.c),
        });
        return;
      }
      case "poison": {
        const key = KEY_FOR_PARTITION[a.p];
        ctx.log("warn", `The producer sends a record that the consumers can't process (key ${key})`, {
          detail: `It lands on ${partId(a.p)}. Kafka doesn't look inside records; the handler in the consumer application will throw on it.`,
          node: PRODUCER,
        });
        produce(s, ctx, { key, poison: true, p: s.components.keyPartitioning ? undefined : a.p });
        return;
      }
      case "burst": {
        for (let i = 0; i < a.n; i++) produce(s, ctx);
        ctx.log("info", `The producer sends a burst of ${a.n} records`, { detail: "Lag jumps, then drains as fast as the consumers process.", node: PRODUCER });
        return;
      }
    }
  },
};

/** Every node id the canvas draws. */
export function nodeIds(state: State): string[] {
  void state;
  return [PRODUCER, COORD, ...PARTITIONS.map(partId), ...CONSUMERS.map(consId)];
}
