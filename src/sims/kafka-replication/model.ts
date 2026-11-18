import type { SimContext, SimModel } from "@/engine/types";

/**
 * One Kafka partition (`orders-0`, replication factor 3) on three brokers, a KRaft
 * controller and one producer, modelled on Kafka 4.4 (kafka-facts skill):
 *
 * - The producer sends each record to the partition leader in a Produce request with
 *   `acks` 0, 1 or all (-1). The leader appends it to its log. acks=1 is answered at once;
 *   acks=all waits in purgatory until the high watermark passes the record.
 * - Followers pull: each sends Fetch(fetch_offset = its log end offset). The leader answers
 *   with records after that offset and its high watermark, or parks the fetch for up to
 *   replica.fetch.wait.max.ms when it has nothing new. A follower's next fetch offset tells
 *   the leader how far it has got (Partition.updateFollowerFetchState).
 * - High watermark = smallest log end offset in the ISR, and it only moves while the ISR has
 *   at least min.insync.replicas members (Partition.maybeIncrementLeaderHW).
 * - A follower that hasn't caught up for replica.lag.time.max.ms is shrunk out of the ISR by
 *   the leader; it rejoins once its log end offset reaches the high watermark.
 * - Brokers heartbeat to the controller. A broker silent for broker.session.timeout.ms is
 *   fenced: removed from the ISR, and if it led, a new leader is elected from the ISR, then
 *   the ELR, then (only with unclean.leader.election.enable) any live replica.
 * - A returning replica truncates its log where it diverges from the new leader (leader epochs).
 *
 * Time runs in slow motion (a network hop takes a quarter of a second) and the timeouts are
 * scaled down to fit a 30-second run.
 */

// ---------- ids ----------

export type BrokerId = 1 | 2 | 3;
export const BROKERS: BrokerId[] = [1, 2, 3];
export const PRODUCER = "producer";
export const CONTROLLER = "controller";
export const brokerNode = (b: BrokerId) => `broker-${b}`;
export function parseBrokerNode(id: string | null): BrokerId | null {
  const m = id ? /^broker-([123])$/.exec(id) : null;
  return m ? (Number(m[1]) as BrokerId) : null;
}
export const TOPIC = "orders";
export const PARTITION = `${TOPIC}-0`;

// ---------- data ----------

/** One record in a replica's log. Its offset is its index. */
export interface Rec {
  /** Producer's record number (r1, r2…). */
  id: number;
  /** Leader epoch of the leader that appended it. */
  epoch: number;
}

/** What a leader knows about one follower (Replica state on the leader). */
export interface FollowerState {
  /** Log end offset, learned from the follower's last fetch offset. */
  leo: number;
  lastFetchAt: number;
  lastCaughtUpAt: number;
  /** Leader's log end offset at the follower's previous fetch. */
  prevLeaderLeo: number;
}

/** An acks=all write waiting for the high watermark (the leader's produce purgatory). */
export interface Waiting {
  req: number;
  rec: number;
  offset: number;
  at: number;
}

/** A follower's fetch the leader is holding until new data arrives or replica.fetch.wait.max.ms passes. */
export interface Parked {
  from: BrokerId;
  offset: number;
  fgen: number;
  pid: number;
}

export interface Broker {
  id: BrokerId;
  up: boolean;
  /** Network cut: isolated from producer, brokers and controller. */
  cut: boolean;
  /** Replica fetcher stopped (a stuck thread, a long pause); heartbeats continue. */
  stalled: boolean;
  log: Rec[];
  /** This replica's high watermark. */
  hw: number;
  /** Leadership as this broker last heard it from the controller. */
  view: { leader: BrokerId | null; epoch: number; isr: BrokerId[] };
  /** Bumped on crash/restart: events of an old process are ignored. */
  gen: number;
  // leader side
  followers: Partial<Record<BrokerId, FollowerState>>;
  waiting: Waiting[];
  parked: Parked[];
  /** Log end offset when this broker became leader in its current epoch. */
  epochStart: number;
  // follower side
  fetchGen: number;
  /** Id of the outstanding fetch, so a timeout only cancels the fetch it was set for. */
  fetchSeq: number;
  fetchOut: boolean;
  /** Where this follower last fetched from (for the canvas). */
  fetchingFrom: BrokerId | null;
}

export interface Controller {
  leader: BrokerId | null;
  epoch: number;
  isr: BrokerId[];
  /** Eligible Leader Replicas (KIP-966): out of the ISR, but known to hold data up to the high watermark. */
  elr: BrokerId[];
  fenced: Record<BrokerId, boolean>;
  lastHb: Record<BrokerId, number>;
  /** Registration epoch per broker, bumped when a broker registers again. */
  brokerEpoch: Record<BrokerId, number>;
  offlineSince: number | null;
}

export type RecStatus = "buffered" | "in flight" | "acked" | "sent" | "failed";

export interface ProducerRecord {
  id: number;
  status: RecStatus;
  /** Offset from the ack (acks=1/all). */
  offset: number | null;
  attempts: number;
  createdAt: number;
  /** Acked (or sent with acks=0) but missing from the leader's log after a failover. */
  lost: boolean;
  /** Last error code seen for it. */
  lastError: string | null;
}

export interface InFlight {
  req: number;
  rec: number;
  to: BrokerId;
  acks: Acks;
}

export type Acks = 0 | 1 | -1;

export interface Producer {
  on: boolean;
  gen: number;
  intervalMs: number;
  acks: Acks;
  /** The leader per the producer's metadata. */
  meta: { leader: BrokerId | null; epoch: number };
  /** Record ids waiting to be sent, oldest first. */
  buffer: number[];
  inflight: InFlight[];
  records: ProducerRecord[];
  nextRec: number;
  backoffUntil: number;
  retries: number;
}

export type PacketKind = "produce" | "produce-resp" | "fetch" | "fetch-resp";

export interface Packet {
  id: number;
  kind: PacketKind;
  from: string;
  to: string;
  /** Broker the packet's lane belongs to: the leader for produce traffic, the follower for fetch traffic. */
  lane: BrokerId;
  /** Leader end, for fetch traffic. */
  leader: BrokerId;
  sentAt: number;
  arriveAt: number;
  label: string;
  error: boolean;
}

export interface Settings {
  /** 0 = acks=0, 1 = acks=1, 2 = acks=all. */
  acks: number;
  minIsr: number;
  /** 0 = false, 1 = true. */
  unclean: number;
  intervalMs: number;
  latencyMs: number;
  lagMaxMs: number;
  sessionMs: number;
  fetchWaitMs: number;
  requestTimeoutMs: number;
}

export interface Components {
  /** The leader shrinks the ISR (replica.lag.time.max.ms). Off = it never drops a follower. */
  isrShrink: boolean;
  /** Producer retries (retries=2147483647). Off = retries=0: a failed send is an error for the app. */
  retries: boolean;
  /** enable.idempotence=true: a retried record is written once. */
  idempotence: boolean;
}

export interface Params {
  settings: Settings;
  components: Components;
}

export interface State {
  settings: Settings;
  components: Components;
  brokers: Record<BrokerId, Broker>;
  ctl: Controller;
  producer: Producer;
  packets: Packet[];
  nextId: number;
  /** Record ids written more than once to the current leader's log. */
  duplicates: number;
  notes: {
    firstCommit: boolean;
    ner: boolean;
    hwStuck: boolean;
    disconnect: boolean;
    timeout: boolean;
    notLeader: boolean;
    waitingSlow: boolean;
    failed: boolean;
  };
}

// ---------- events & actions ----------

export type Event =
  | { type: "new-record"; gen: number }
  | { type: "pump" }
  | { type: "produce-in"; packet: number; req: number; rec: number; to: BrokerId; acks: Acks }
  | { type: "produce-resp-in"; packet: number; req: number; offset: number | null; error: string | null }
  | { type: "produce-fail"; req: number; why: "disconnect" | "timeout" }
  | { type: "fetch-in"; packet: number; from: BrokerId; to: BrokerId; offset: number; fgen: number }
  | {
      type: "fetch-resp-in";
      packet: number;
      from: BrokerId;
      to: BrokerId;
      fgen: number;
      records: Rec[];
      hw: number;
      truncateTo: number | null;
      notLeader: boolean;
    }
  | { type: "fetch-wait"; leader: BrokerId; pid: number; gen: number }
  | { type: "fetch-timeout"; b: BrokerId; fgen: number; seq: number }
  | { type: "fetch-retry"; b: BrokerId; fgen: number }
  | { type: "isr-check"; b: BrokerId; gen: number; epoch: number }
  | { type: "heartbeat"; b: BrokerId; gen: number }
  | { type: "ctl-check" };

export type Action =
  | { type: "set-producing"; on: boolean }
  | { type: "set-interval"; ms: number }
  | { type: "set-acks"; acks: Acks }
  | { type: "burst"; n: number }
  | { type: "crash"; b: BrokerId }
  | { type: "restart"; b: BrokerId }
  | { type: "set-cut"; b: BrokerId; on: boolean }
  | { type: "set-stall"; b: BrokerId; on: boolean }
  | { type: "unclean-election" };

type Ctx = SimContext<Event>;

// ---------- constants ----------

/** Records a fetch response carries at most (stands in for replica.fetch.max.bytes). */
export const MAX_FETCH_RECORDS = 5;
/** max.in.flight.requests.per.connection default. */
export const MAX_IN_FLIGHT = 5;
/** retry.backoff.ms, scaled (real default 100 ms). */
const RETRY_BACKOFF_MS = 400;
/** delivery.timeout.ms, scaled (real default 120000). */
export const DELIVERY_TIMEOUT_MS = 20000;
/** Pause before a follower retries a fetch that failed (stands in for replica.fetch.backoff.ms). */
const FETCH_BACKOFF_MS = 500;
const CTL_CHECK_MS = 100;
/** Producer records kept for the canvas list. */
const KEEP_RECORDS = 400;

export const defaultSettings: Settings = {
  acks: 2,
  minIsr: 1,
  unclean: 0,
  intervalMs: 600,
  latencyMs: 250,
  lagMaxMs: 5000,
  sessionMs: 3000,
  fetchWaitMs: 500,
  requestTimeoutMs: 10000,
};

export const defaultComponents: Components = { isrShrink: true, retries: true, idempotence: true };

// ---------- helpers ----------

export const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
export const acksLabel = (a: Acks) => (a === -1 ? "all" : String(a));
export const acksFromSetting = (n: number): Acks => (n >= 2 ? -1 : n === 1 ? 1 : 0);
export const brokerLabel = (b: BrokerId) => `broker-${b}`;
export const list = (bs: BrokerId[]) => (bs.length ? [...bs].sort().join(",") : "none");

/** min(min.insync.replicas, replication factor) (Partition.effectiveMinIsr). */
export const effectiveMinIsr = (s: State) => Math.min(s.settings.minIsr, BROKERS.length);
export const heartbeatMs = (s: State) => Math.round((s.settings.sessionMs * 2) / 9);

/** Idempotence is only on with acks=all and retries (a conflicting config turns it off). */
export function idempotent(s: State, acks: Acks): boolean {
  return s.components.idempotence && s.components.retries && acks === -1;
}

export function isLeader(b: Broker): boolean {
  return b.up && b.view.leader === b.id;
}

function sameRec(a: Rec | undefined, b: Rec | undefined) {
  return !!a && !!b && a.id === b.id && a.epoch === b.epoch;
}

function commonPrefix(a: Rec[], b: Rec[]): number {
  let i = 0;
  while (i < a.length && i < b.length && sameRec(a[i], b[i])) i++;
  return i;
}

function send(s: State, ctx: Ctx, p: Omit<Packet, "id" | "sentAt" | "arriveAt">): Packet {
  const packet: Packet = { ...p, id: s.nextId++, sentAt: ctx.now, arriveAt: ctx.now + s.settings.latencyMs };
  s.packets.push(packet);
  return packet;
}

function drop(s: State, id: number) {
  const i = s.packets.findIndex((p) => p.id === id);
  if (i >= 0) s.packets.splice(i, 1);
}

function rec(s: State, id: number): ProducerRecord | undefined {
  return s.producer.records.find((r) => r.id === id);
}

/** Broker can talk to the network (process up and not cut off). */
const reachable = (b: Broker) => b.up && !b.cut;

// ---------- producer ----------

function refreshMetadata(s: State) {
  s.producer.meta = { leader: s.ctl.leader, epoch: s.ctl.epoch };
}

function pump(s: State, ctx: Ctx) {
  const p = s.producer;
  if (ctx.now < p.backoffUntil) return;
  while (p.buffer.length > 0 && p.inflight.length < MAX_IN_FLIGHT) {
    if (p.meta.leader === null) refreshMetadata(s);
    const leader = p.meta.leader;
    if (leader === null) {
      p.backoffUntil = ctx.now + RETRY_BACKOFF_MS;
      ctx.schedule(RETRY_BACKOFF_MS, { type: "pump" });
      return;
    }
    const id = p.buffer.shift()!;
    const r = rec(s, id)!;
    r.attempts++;
    const req = s.nextId++;
    const packet = send(s, ctx, { kind: "produce", from: PRODUCER, to: brokerNode(leader), lane: leader, leader, label: `r${id}`, error: false });
    ctx.schedule(packet.arriveAt - ctx.now, { type: "produce-in", packet: packet.id, req, rec: id, to: leader, acks: p.acks });
    if (p.acks === 0) {
      // "The record will be immediately added to the socket buffer and considered sent."
      r.status = "sent";
      continue;
    }
    r.status = "in flight";
    p.inflight.push({ req, rec: id, to: leader, acks: p.acks });
    ctx.schedule(s.settings.requestTimeoutMs, { type: "produce-fail", req, why: "timeout" });
  }
}

function newRecord(s: State, ctx: Ctx) {
  const p = s.producer;
  const id = p.nextRec++;
  p.records.push({ id, status: "buffered", offset: null, attempts: 0, createdAt: ctx.now, lost: false, lastError: null });
  if (p.records.length > KEEP_RECORDS) p.records.shift();
  p.buffer.push(id);
  pump(s, ctx);
}

/** A send failed: retry it (after retry.backoff.ms), or give up if retries are off or delivery.timeout.ms passed. */
function sendFailed(s: State, ctx: Ctx, f: InFlight, error: string, refresh: boolean) {
  const p = s.producer;
  p.inflight = p.inflight.filter((x) => x.req !== f.req);
  const r = rec(s, f.rec);
  if (!r || r.status === "acked") return;
  r.lastError = error;
  if (refresh) refreshMetadata(s);
  const expired = ctx.now - r.createdAt >= DELIVERY_TIMEOUT_MS;
  if (!s.components.retries || expired) {
    r.status = "failed";
    if (!s.notes.failed) {
      s.notes.failed = true;
      ctx.log("error", `r${r.id} failed: the application gets ${error}`, {
        detail: s.components.retries
          ? `delivery.timeout.ms (${secs(DELIVERY_TIMEOUT_MS)} here) ran out while retrying. The send callback gets the error; the record was never acknowledged. (Further failures are not listed.)`
          : "retries=0: the producer doesn't retry, so the first failed attempt goes straight to the send callback. (Further failures are not listed.)",
        node: PRODUCER,
      });
    }
    return;
  }
  p.retries++;
  r.status = "buffered";
  p.buffer.push(r.id);
  p.buffer.sort((a, b) => a - b);
  p.backoffUntil = Math.max(p.backoffUntil, ctx.now + RETRY_BACKOFF_MS);
  ctx.schedule(RETRY_BACKOFF_MS, { type: "pump" });
}

// ---------- leader side ----------

function respondProduce(s: State, ctx: Ctx, b: Broker, req: number, offset: number | null, error: string | null) {
  if (!reachable(b)) return;
  const packet = send(s, ctx, {
    kind: "produce-resp",
    from: brokerNode(b.id),
    to: PRODUCER,
    lane: b.id,
    leader: b.id,
    label: error ? `err ${error === "NOT_ENOUGH_REPLICAS" ? 19 : 6}` : `ack @${offset}`,
    error: !!error,
  });
  ctx.schedule(packet.arriveAt - ctx.now, { type: "produce-resp-in", packet: packet.id, req, offset, error });
}

function initFollowers(s: State, b: Broker, now: number) {
  b.followers = {};
  for (const f of BROKERS) if (f !== b.id) b.followers[f] = { leo: 0, lastFetchAt: now, lastCaughtUpAt: now, prevLeaderLeo: 0 };
}

/** The high watermark: smallest log end offset in the ISR, only while ISR >= min ISR. */
function maybeAdvanceHw(s: State, ctx: Ctx, L: Broker) {
  if (!isLeader(L)) return;
  const minIsr = effectiveMinIsr(s);
  if (L.view.isr.length < minIsr) {
    if (!s.notes.hwStuck && L.log.length > L.hw) {
      s.notes.hwStuck = true;
      ctx.log("warn", `High watermark stuck at ${L.hw}: ISR ${list(L.view.isr)} is below min.insync.replicas=${s.settings.minIsr}`, {
        detail:
          "The high watermark only advances while the ISR has at least min.insync.replicas members, whatever the acks setting. Records past it are in the leader's log but not committed: consumers can't read them yet.",
        node: brokerNode(L.id),
      });
    }
    return;
  }
  s.notes.hwStuck = false;
  let hw = L.log.length;
  for (const f of L.view.isr) if (f !== L.id) hw = Math.min(hw, L.followers[f]?.leo ?? 0);
  if (hw <= L.hw) return;
  L.hw = hw;
  if (!s.notes.firstCommit) {
    s.notes.firstCommit = true;
    ctx.log("ok", `Every in-sync replica has r${L.log[hw - 1].id}: the high watermark moves to ${hw}`, {
      detail:
        "The leader learns how far each follower has got from the offset in its next fetch. Records below the high watermark are committed: consumers can read them, and an acks=all producer gets its acknowledgement.",
      node: brokerNode(L.id),
    });
  }
  const done = L.waiting.filter((w) => w.offset < L.hw);
  L.waiting = L.waiting.filter((w) => w.offset >= L.hw);
  for (const w of done) respondProduce(s, ctx, L, w.req, w.offset, null);
}

function respondFetch(s: State, ctx: Ctx, L: Broker, f: BrokerId, fgen: number, offset: number, extra: { truncateTo?: number; notLeader?: boolean } = {}) {
  if (!reachable(L)) return;
  const records = extra.truncateTo !== undefined || extra.notLeader ? [] : L.log.slice(offset, offset + MAX_FETCH_RECORDS);
  const label = extra.notLeader ? "err 6" : extra.truncateTo !== undefined ? "truncate" : records.length ? `+${records.length} hw ${L.hw}` : `hw ${L.hw}`;
  const packet = send(s, ctx, { kind: "fetch-resp", from: brokerNode(L.id), to: brokerNode(f), lane: f, leader: L.id, label, error: !!extra.notLeader });
  ctx.schedule(packet.arriveAt - ctx.now, {
    type: "fetch-resp-in",
    packet: packet.id,
    from: L.id,
    to: f,
    fgen,
    records: records.map((r) => ({ ...r })),
    hw: L.hw,
    truncateTo: extra.truncateTo ?? null,
    notLeader: !!extra.notLeader,
  });
}

/** New data on the leader: answer the fetches it was holding. */
function wakeParked(s: State, ctx: Ctx, L: Broker) {
  const parked = L.parked;
  L.parked = [];
  for (const p of parked) respondFetch(s, ctx, L, p.from, p.fgen, p.offset);
}

function maybeExpandIsr(s: State, ctx: Ctx, L: Broker, f: BrokerId) {
  if (L.view.isr.includes(f) || s.ctl.fenced[f] || L.cut) return;
  const st = L.followers[f]!;
  if (st.leo < L.hw || st.leo < L.epochStart) return;
  setIsr(s, ctx, [...L.view.isr, f]);
  ctx.log("ok", `${brokerLabel(f)} caught up and rejoins the ISR: ISR updated to ${list(s.ctl.isr)}`, {
    detail: `Its log end offset (${st.leo}) reached the high watermark (${L.hw}). The leader sends an AlterPartition request and the controller commits the new ISR.`,
    node: brokerNode(f),
  });
  maybeAdvanceHw(s, ctx, L);
}

function isrCheck(s: State, ctx: Ctx, L: Broker) {
  if (!isLeader(L) || !s.components.isrShrink) return;
  const out = L.view.isr.filter((f) => f !== L.id && ctx.now - (L.followers[f]?.lastCaughtUpAt ?? ctx.now) > s.settings.lagMaxMs);
  if (out.length === 0) return;
  if (L.cut) return; // can't reach the controller: the AlterPartition never lands
  const before = list(L.view.isr);
  const next = L.view.isr.filter((x) => !out.includes(x));
  setIsr(s, ctx, next);
  ctx.log("warn", `Shrinking ISR from ${before} to ${list(next)}`, {
    detail: `${out.map(brokerLabel).join(" and ")} hasn't caught up to the leader's log end offset for replica.lag.time.max.ms (${secs(s.settings.lagMaxMs)} here), so the leader drops it from the ISR (AlterPartition to the controller). The high watermark no longer waits for it.${next.length < effectiveMinIsr(s) ? ` The ISR is now below min.insync.replicas=${s.settings.minIsr}.` : ""}`,
    node: brokerNode(L.id),
  });
  maybeAdvanceHw(s, ctx, L);
}

function scheduleIsrCheck(s: State, ctx: Ctx, L: Broker) {
  ctx.schedule(Math.max(250, s.settings.lagMaxMs / 2), { type: "isr-check", b: L.id, gen: L.gen, epoch: L.view.epoch });
}

/** Narrate (once per episode) acks=all writes that wait because a follower in the ISR isn't fetching. */
function noteSlowAcks(s: State, ctx: Ctx) {
  const leader = s.ctl.leader;
  const L = leader === null ? null : s.brokers[leader];
  if (!L || !isLeader(L) || L.waiting.length === 0) {
    s.notes.waitingSlow = false;
    return;
  }
  const oldest = L.waiting[0];
  if (s.notes.waitingSlow || ctx.now - oldest.at < 1500) return;
  const behind = L.view.isr.filter((f) => f !== L.id && (L.followers[f]?.leo ?? 0) <= oldest.offset);
  if (behind.length === 0) return;
  s.notes.waitingSlow = true;
  ctx.log("warn", `acks=all writes are waiting for ${behind.map(brokerLabel).join(" and ")}`, {
    detail: `${L.waiting.length} write${L.waiting.length === 1 ? "" : "s"} sit in the leader's purgatory. The high watermark can't pass r${oldest.rec} until every replica in the ISR (${list(L.view.isr)}) has it${s.components.isrShrink ? `, or until the leader drops the laggard from the ISR after replica.lag.time.max.ms (${secs(s.settings.lagMaxMs)} here)` : ", and with ISR shrinking removed the leader never drops it"}.`,
    node: brokerNode(L.id),
  });
}

// ---------- follower side ----------

function startFetch(s: State, ctx: Ctx, f: Broker) {
  const leader = f.view.leader;
  if (!reachable(f) || f.stalled || f.fetchOut || leader === null || leader === f.id) return;
  f.fetchOut = true;
  f.fetchSeq++;
  f.fetchingFrom = leader;
  const offset = f.log.length;
  const packet = send(s, ctx, { kind: "fetch", from: brokerNode(f.id), to: brokerNode(leader), lane: f.id, leader, label: `Fetch ${offset}`, error: false });
  ctx.schedule(packet.arriveAt - ctx.now, { type: "fetch-in", packet: packet.id, from: f.id, to: leader, offset, fgen: f.fetchGen });
  ctx.schedule(2 * s.settings.latencyMs + s.settings.fetchWaitMs + 600, { type: "fetch-timeout", b: f.id, fgen: f.fetchGen, seq: f.fetchSeq });
}

// ---------- controller ----------

/** Commit a new ISR, keeping the ELR (KIP-966) and every reachable broker's view in step. */
function setIsr(s: State, ctx: Ctx, next: BrokerId[]) {
  const c = s.ctl;
  const removed = c.isr.filter((b) => !next.includes(b));
  c.isr = [...new Set(next)].sort() as BrokerId[];
  if (c.isr.length >= effectiveMinIsr(s)) c.elr = [];
  else c.elr = [...new Set([...c.elr, ...removed])].filter((b) => !c.isr.includes(b)).sort() as BrokerId[];
  pushViews(s, ctx);
}

/** Every broker that can hear the controller learns the current leader, epoch and ISR. */
function pushViews(s: State, ctx: Ctx) {
  for (const b of BROKERS) {
    const br = s.brokers[b];
    if (reachable(br) && !s.ctl.fenced[b]) applyView(s, ctx, br);
  }
}

function applyView(s: State, ctx: Ctx, b: Broker) {
  const c = s.ctl;
  const wasLeader = isLeader(b);
  const sameTerm = b.view.leader === c.leader && b.view.epoch === c.epoch;
  b.view = { leader: c.leader, epoch: c.epoch, isr: [...c.isr] };
  if (sameTerm) {
    if (isLeader(b)) maybeAdvanceHw(s, ctx, b);
    return;
  }
  if (wasLeader && !isLeader(b)) {
    // No longer the leader: pending acks=all writes fail with NOT_LEADER_OR_FOLLOWER.
    for (const w of b.waiting) respondProduce(s, ctx, b, w.req, null, "NOT_LEADER_OR_FOLLOWER");
    b.waiting = [];
    b.parked = [];
  }
  if (isLeader(b)) {
    b.epochStart = b.log.length;
    initFollowers(s, b, ctx.now);
    b.fetchOut = false;
    b.fetchingFrom = null;
    scheduleIsrCheck(s, ctx, b);
    maybeAdvanceHw(s, ctx, b);
  } else {
    b.fetchGen++;
    b.fetchOut = false;
    startFetch(s, ctx, b);
  }
}

/** Pick a leader: ISR first, then unfenced ELR, then (unclean) any unfenced replica (PartitionChangeBuilder.electAnyLeader). */
function elect(s: State, ctx: Ctx, why: string, forceUnclean = false) {
  const c = s.ctl;
  const live = (b: BrokerId) => !c.fenced[b];
  const fromIsr = c.isr.find(live);
  const fromElr = c.elr.find(live);
  const uncleanOk = s.settings.unclean === 1 || forceUnclean;
  const fromAny = uncleanOk ? BROKERS.find(live) : undefined;
  const pick = fromIsr ?? fromElr ?? fromAny ?? null;
  if (pick === null) {
    if (c.leader !== null || c.offlineSince === null) {
      c.leader = null;
      c.offlineSince = ctx.now;
      ctx.log("error", `${PARTITION} is offline: no in-sync replica is alive`, {
        detail: `${why} ISR ${list(c.isr)}, ELR ${list(c.elr)}: none of them is unfenced, and unclean.leader.election.enable=false, so the controller waits for one to come back rather than pick a replica that may be missing committed records. Producers can't write until then.`,
        node: CONTROLLER,
      });
    }
    c.leader = null;
    pushViews(s, ctx);
    return;
  }
  const unclean = fromIsr === undefined && fromElr === undefined;
  c.epoch++;
  c.offlineSince = null;
  c.leader = pick;
  if (unclean || fromIsr === undefined) {
    c.isr = [pick];
    c.elr = c.elr.filter((b) => b !== pick);
  }
  const newLeader = s.brokers[pick];
  const lost = s.producer.records.filter((r) => (r.status === "acked" || r.status === "sent") && !r.lost && !newLeader.log.some((x) => x.id === r.id));
  if (unclean) {
    ctx.log("error", `Unclean election: ${brokerLabel(pick)} becomes leader (epoch ${c.epoch}) without being in sync`, {
      detail: `unclean.leader.election.enable=true lets the controller pick a replica outside the ISR as a last resort. Its log becomes the source of truth even though it may be missing committed records. Kafka logs "Setting new leader … using an unclean election" and forces the ISR to just the new leader.`,
      node: CONTROLLER,
    });
  } else {
    ctx.log("ok", `${brokerLabel(pick)} is the new leader of ${PARTITION} (epoch ${c.epoch})`, {
      detail: `${why} The controller picks ${fromIsr !== undefined ? "a replica from the ISR" : "an Eligible Leader Replica (out of the ISR, but known to hold everything up to the high watermark)"}, so no committed record is lost. Records the old leader appended past the high watermark may be.`,
      node: brokerNode(pick),
    });
  }
  if (lost.length > 0) {
    for (const r of lost) r.lost = true;
    const ids = lost.map((r) => `r${r.id}`);
    ctx.log("error", `${lost.length} acknowledged record${lost.length === 1 ? " is" : "s are"} not on ${brokerLabel(pick)}: lost`, {
      detail: `${ids.slice(0, 6).join(", ")}${ids.length > 6 ? "…" : ""}. The producer was told ${lost.length === 1 ? "it was" : "they were"} written${s.producer.acks === 0 || lost.some((r) => r.status === "sent") ? " (or, with acks=0, sent)" : ""}, but the new leader never got ${lost.length === 1 ? "it" : "them"}. ${unclean ? "That is the price of an unclean election." : "With acks=1 the leader answered before any follower had the record."}`,
      node: PRODUCER,
    });
  }
  pushViews(s, ctx);
}

function fence(s: State, ctx: Ctx, b: BrokerId) {
  const c = s.ctl;
  c.fenced[b] = true;
  ctx.log("error", `Controller fences ${brokerLabel(b)}: no heartbeat for ${secs(s.settings.sessionMs)}`, {
    detail: `Kafka logs "Fencing broker ${b} at epoch ${c.brokerEpoch[b]} because its session has timed out." (broker.session.timeout.ms, ${secs(s.settings.sessionMs)} here). It is removed from the ISR${c.leader === b ? " and loses leadership" : ""}.`,
    node: CONTROLLER,
  });
  const wasLeader = c.leader === b;
  setIsr(s, ctx, c.isr.filter((x) => x !== b));
  if (wasLeader) elect(s, ctx, `${brokerLabel(b)} led ${PARTITION}.`);
}

function unfence(s: State, ctx: Ctx, b: BrokerId) {
  const c = s.ctl;
  c.fenced[b] = false;
  c.brokerEpoch[b] += 1;
  ctx.log("ok", `${brokerLabel(b)} registers with the controller again`, {
    detail: "Its heartbeats are back, so the controller unfences it. It rejoins as a follower and must catch up before it can re-enter the ISR.",
    node: brokerNode(b),
  });
  if (c.leader === null) {
    if (c.isr.includes(b) || (c.isr.length === 0 && c.elr.includes(b))) {
      elect(s, ctx, `${brokerLabel(b)} was the last in-sync replica.`);
      return;
    }
    if (s.settings.unclean === 1) {
      elect(s, ctx, `${PARTITION} had no leader.`);
      return;
    }
  }
  applyView(s, ctx, s.brokers[b]);
}

// ---------- model ----------

function makeBroker(id: BrokerId): Broker {
  return {
    id,
    up: true,
    cut: false,
    stalled: false,
    log: [],
    hw: 0,
    view: { leader: null, epoch: 0, isr: [] },
    gen: 0,
    followers: {},
    waiting: [],
    parked: [],
    epochStart: 0,
    fetchGen: 0,
    fetchSeq: 0,
    fetchOut: false,
    fetchingFrom: null,
  };
}

export const model: SimModel<State, Event, Action, Params> = {
  init({ settings, components }, ctx) {
    const s: State = {
      settings: { ...settings },
      components: { ...components },
      brokers: { 1: makeBroker(1), 2: makeBroker(2), 3: makeBroker(3) },
      ctl: {
        leader: 1,
        epoch: 1,
        isr: [1, 2, 3],
        elr: [],
        fenced: { 1: false, 2: false, 3: false },
        lastHb: { 1: 0, 2: 0, 3: 0 },
        brokerEpoch: { 1: 10, 2: 11, 3: 12 },
        offlineSince: null,
      },
      producer: {
        on: true,
        gen: 0,
        intervalMs: settings.intervalMs,
        acks: acksFromSetting(settings.acks),
        meta: { leader: 1, epoch: 1 },
        buffer: [],
        inflight: [],
        records: [],
        nextRec: 1,
        backoffUntil: 0,
        retries: 0,
      },
      packets: [],
      nextId: 1,
      duplicates: 0,
      notes: { firstCommit: false, ner: false, hwStuck: false, disconnect: false, timeout: false, notLeader: false, waitingSlow: false, failed: false },
    };
    const acks = acksLabel(s.producer.acks);
    ctx.log("info", `Topic ${TOPIC}, partition 0: three replicas, broker-1 leads`, {
      detail: `Replication factor 3, min.insync.replicas=${s.settings.minIsr}. The producer writes only to the leader with acks=${acks}${idempotent(s, s.producer.acks) ? " and enable.idempotence=true" : ""}. broker-2 and broker-3 pull new records from it with Fetch requests.`,
      node: brokerNode(1),
    });
    pushViews(s, ctx);
    for (const b of BROKERS) ctx.schedule(heartbeatMs(s) * (0.3 + 0.2 * b), { type: "heartbeat", b, gen: 0 });
    ctx.schedule(CTL_CHECK_MS, { type: "ctl-check" });
    ctx.schedule(200, { type: "new-record", gen: 0 });
    return s;
  },

  handle(s, e, ctx) {
    switch (e.type) {
      case "new-record": {
        const p = s.producer;
        if (e.gen !== p.gen || !p.on) return;
        newRecord(s, ctx);
        ctx.schedule(p.intervalMs, { type: "new-record", gen: p.gen });
        return;
      }
      case "pump":
        pump(s, ctx);
        return;

      case "produce-in": {
        drop(s, e.packet);
        const b = s.brokers[e.to];
        if (b.cut) return; // never arrives: the producer finds out at request.timeout.ms
        if (!b.up) {
          // Nothing listens on the broker's port: the connection fails at once.
          if (e.acks !== 0) ctx.schedule(s.settings.latencyMs, { type: "produce-fail", req: e.req, why: "disconnect" });
          return;
        }
        if (!isLeader(b)) {
          if (e.acks !== 0) respondProduce(s, ctx, b, e.req, null, "NOT_LEADER_OR_FOLLOWER");
          return;
        }
        if (e.acks === -1 && b.view.isr.length < effectiveMinIsr(s)) {
          if (!s.notes.ner) {
            s.notes.ner = true;
            ctx.log("warn", `${brokerLabel(b.id)} rejects r${e.rec}: NOT_ENOUGH_REPLICAS`, {
              detail: `acks=all and the ISR (${list(b.view.isr)}) has fewer than min.insync.replicas=${s.settings.minIsr} members, so the leader refuses the write before appending it: "The size of the current ISR : ${b.view.isr.length} is insufficient to satisfy the min.isr requirement of ${effectiveMinIsr(s)}". The error is retriable; the producer keeps retrying. (Not listed again until the ISR recovers.)`,
              node: brokerNode(b.id),
            });
          }
          respondProduce(s, ctx, b, e.req, null, "NOT_ENOUGH_REPLICAS");
          return;
        }
        let offset = idempotent(s, e.acks) ? b.log.findIndex((r) => r.id === e.rec) : -1;
        if (offset < 0) {
          if (b.log.some((r) => r.id === e.rec)) s.duplicates++;
          b.log.push({ id: e.rec, epoch: b.view.epoch });
          offset = b.log.length - 1;
          wakeParked(s, ctx, b);
          maybeAdvanceHw(s, ctx, b);
        }
        if (e.acks === 1) respondProduce(s, ctx, b, e.req, offset, null);
        else if (e.acks === -1) {
          if (b.hw > offset) respondProduce(s, ctx, b, e.req, offset, null);
          else b.waiting.push({ req: e.req, rec: e.rec, offset, at: ctx.now });
        }
        return;
      }

      case "produce-resp-in": {
        drop(s, e.packet);
        const p = s.producer;
        const f = p.inflight.find((x) => x.req === e.req);
        if (!f) return;
        if (e.error) {
          if (e.error === "NOT_LEADER_OR_FOLLOWER" && !s.notes.notLeader) {
            s.notes.notLeader = true;
            ctx.log("info", `r${f.rec} hit NOT_LEADER_OR_FOLLOWER: the producer refreshes its metadata`, {
              detail: "The broker it wrote to is no longer the leader. The error is retriable: the producer looks up the new leader and sends the record again. (Not listed again.)",
              node: PRODUCER,
            });
          }
          sendFailed(s, ctx, f, e.error, e.error === "NOT_LEADER_OR_FOLLOWER");
          pump(s, ctx);
          return;
        }
        p.inflight = p.inflight.filter((x) => x.req !== e.req);
        const r = rec(s, f.rec);
        if (r && r.status !== "acked") {
          r.status = "acked";
          r.offset = e.offset;
          r.lastError = null;
        }
        if (s.notes.ner || s.notes.disconnect || s.notes.timeout) {
          if (s.notes.ner || s.notes.disconnect) {
            ctx.log("ok", `Writes succeed again: r${f.rec} acknowledged at offset ${e.offset}`, { node: PRODUCER });
          }
          s.notes.ner = false;
          s.notes.disconnect = false;
          s.notes.timeout = false;
        }
        pump(s, ctx);
        return;
      }

      case "produce-fail": {
        const p = s.producer;
        const f = p.inflight.find((x) => x.req === e.req);
        if (!f) return;
        if (e.why === "disconnect" && !s.notes.disconnect) {
          s.notes.disconnect = true;
          ctx.log("warn", `The producer can't reach ${brokerLabel(f.to)}: retrying`, {
            detail: `The connection to the leader failed. The producer refreshes its metadata and retries after retry.backoff.ms. Until the controller fences ${brokerLabel(f.to)} (broker.session.timeout.ms), the metadata still names it as the leader. (Not listed again until a write succeeds.)`,
            node: PRODUCER,
          });
        }
        if (e.why === "timeout" && !s.notes.timeout) {
          s.notes.timeout = true;
          ctx.log("warn", `r${f.rec} got no answer within request.timeout.ms: retrying`, {
            detail: `No response from ${brokerLabel(f.to)} in ${secs(s.settings.requestTimeoutMs)} (scaled). The producer resends${idempotent(s, f.acks) ? "; with enable.idempotence=true the broker recognises a resent record and writes it once" : "; without idempotence a resend can write the record twice"}. (Not listed again until a write succeeds.)`,
            node: PRODUCER,
          });
        }
        sendFailed(s, ctx, f, e.why === "timeout" ? "REQUEST_TIMED_OUT" : "a disconnection", true);
        pump(s, ctx);
        return;
      }

      case "fetch-in": {
        drop(s, e.packet);
        const L = s.brokers[e.to];
        if (!reachable(L)) return; // the follower's fetch times out
        if (!isLeader(L)) {
          respondFetch(s, ctx, L, e.from, e.fgen, e.offset, { notLeader: true });
          return;
        }
        const f = s.brokers[e.from];
        const common = commonPrefix(f.log, L.log);
        if (common < e.offset) {
          respondFetch(s, ctx, L, e.from, e.fgen, e.offset, { truncateTo: common });
          return;
        }
        const st = L.followers[e.from]!;
        const leo = L.log.length;
        if (e.offset >= leo) st.lastCaughtUpAt = ctx.now;
        else if (e.offset >= st.prevLeaderLeo) st.lastCaughtUpAt = Math.max(st.lastCaughtUpAt, st.lastFetchAt);
        st.leo = e.offset;
        st.lastFetchAt = ctx.now;
        st.prevLeaderLeo = leo;
        maybeExpandIsr(s, ctx, L, e.from);
        maybeAdvanceHw(s, ctx, L);
        if (leo > e.offset) {
          respondFetch(s, ctx, L, e.from, e.fgen, e.offset);
        } else {
          const pid = s.nextId++;
          L.parked.push({ from: e.from, offset: e.offset, fgen: e.fgen, pid });
          ctx.schedule(s.settings.fetchWaitMs, { type: "fetch-wait", leader: L.id, pid, gen: L.gen });
        }
        return;
      }

      case "fetch-wait": {
        const L = s.brokers[e.leader];
        if (e.gen !== L.gen) return;
        const k = L.parked.findIndex((p) => p.pid === e.pid);
        if (k < 0) return;
        const [p] = L.parked.splice(k, 1);
        respondFetch(s, ctx, L, p.from, p.fgen, p.offset);
        return;
      }

      case "fetch-resp-in": {
        drop(s, e.packet);
        const f = s.brokers[e.to];
        if (!reachable(f) || e.fgen !== f.fetchGen) return;
        f.fetchOut = false;
        if (e.notLeader) {
          if (!s.ctl.fenced[f.id]) applyView(s, ctx, f);
          ctx.schedule(FETCH_BACKOFF_MS, { type: "fetch-retry", b: f.id, fgen: f.fetchGen });
          return;
        }
        if (e.truncateTo !== null) {
          const n = f.log.length - e.truncateTo;
          const gone = f.log.slice(e.truncateTo).map((r) => `r${r.id}`);
          f.log = f.log.slice(0, e.truncateTo);
          f.hw = Math.min(f.hw, f.log.length);
          ctx.log("warn", `${brokerLabel(f.id)} truncates its log to offset ${e.truncateTo}: ${n} record${n === 1 ? "" : "s"} the leader doesn't have`, {
            detail: `${gone.slice(0, 6).join(", ")}${gone.length > 6 ? "…" : ""}. Each record carries the leader epoch it was written in; where the epochs stop matching, the follower's log diverges from ${brokerLabel(e.from)}'s and the rest is cut. Then it fetches the leader's records instead.`,
            node: brokerNode(f.id),
          });
          startFetch(s, ctx, f);
          return;
        }
        for (const r of e.records) f.log.push({ ...r });
        f.hw = Math.max(f.hw, Math.min(e.hw, f.log.length));
        startFetch(s, ctx, f);
        return;
      }

      case "fetch-timeout": {
        const f = s.brokers[e.b];
        if (e.fgen !== f.fetchGen || e.seq !== f.fetchSeq || !f.fetchOut) return;
        f.fetchGen++;
        f.fetchOut = false;
        ctx.schedule(FETCH_BACKOFF_MS, { type: "fetch-retry", b: f.id, fgen: f.fetchGen });
        return;
      }

      case "fetch-retry": {
        const f = s.brokers[e.b];
        if (e.fgen !== f.fetchGen) return;
        startFetch(s, ctx, f);
        return;
      }

      case "isr-check": {
        const L = s.brokers[e.b];
        if (e.gen !== L.gen || e.epoch !== L.view.epoch || !isLeader(L)) return;
        isrCheck(s, ctx, L);
        scheduleIsrCheck(s, ctx, L);
        return;
      }

      case "heartbeat": {
        const b = s.brokers[e.b];
        if (e.gen !== b.gen || !b.up) return;
        if (!b.cut) {
          s.ctl.lastHb[e.b] = ctx.now;
          if (s.ctl.fenced[e.b]) unfence(s, ctx, e.b);
          else if (b.view.leader !== s.ctl.leader || b.view.epoch !== s.ctl.epoch) applyView(s, ctx, b);
        }
        ctx.schedule(heartbeatMs(s), { type: "heartbeat", b: e.b, gen: b.gen });
        return;
      }

      case "ctl-check": {
        for (const b of BROKERS) if (!s.ctl.fenced[b] && ctx.now - s.ctl.lastHb[b] > s.settings.sessionMs) fence(s, ctx, b);
        noteSlowAcks(s, ctx);
        ctx.schedule(CTL_CHECK_MS, { type: "ctl-check" });
        return;
      }
    }
  },

  act(s, a, ctx) {
    switch (a.type) {
      case "set-producing": {
        const p = s.producer;
        if (p.on === a.on) return;
        p.on = a.on;
        p.gen++;
        if (a.on) ctx.schedule(0, { type: "new-record", gen: p.gen });
        ctx.log("info", a.on ? "The producer sends records again" : "The producer stops sending new records", { node: PRODUCER });
        return;
      }
      case "set-interval": {
        const p = s.producer;
        p.intervalMs = a.ms;
        if (p.on) {
          p.gen++;
          ctx.schedule(a.ms, { type: "new-record", gen: p.gen });
        }
        return;
      }
      case "set-acks": {
        if (s.producer.acks === a.acks) return;
        s.producer.acks = a.acks;
        ctx.log("info", `The producer now sends with acks=${acksLabel(a.acks)}`, {
          detail:
            a.acks === 0
              ? "It no longer waits for any answer: a record counts as sent once it's on the socket, and its offset is unknown (-1)."
              : a.acks === 1
                ? "The leader answers as soon as the record is in its own log, before any follower has it."
                : "The leader answers once every in-sync replica has the record (the high watermark passed it).",
          node: PRODUCER,
        });
        return;
      }
      case "burst": {
        for (let k = 0; k < a.n; k++) newRecord(s, ctx);
        ctx.log("info", `The producer sends ${a.n} records at once`, { node: PRODUCER });
        return;
      }
      case "crash": {
        const b = s.brokers[a.b];
        if (!b.up) return;
        const led = isLeader(b);
        b.up = false;
        b.gen++;
        b.fetchGen++;
        b.fetchOut = false;
        b.waiting = [];
        b.parked = [];
        // Requests in flight to it fail when the connection drops.
        for (const f of s.producer.inflight) if (f.to === a.b) ctx.schedule(s.settings.latencyMs, { type: "produce-fail", req: f.req, why: "disconnect" });
        ctx.log("error", `${brokerLabel(a.b)} crashed`, {
          detail: led
            ? `It was the leader. Nobody can write to ${PARTITION} until the controller notices (no heartbeat for broker.session.timeout.ms) and elects a new one. Its log stays on disk.`
            : "Its fetches stop and its heartbeats stop. The controller fences it after broker.session.timeout.ms and removes it from the ISR. Its log stays on disk.",
          node: brokerNode(a.b),
        });
        return;
      }
      case "restart": {
        const b = s.brokers[a.b];
        if (b.up) return;
        b.up = true;
        b.gen++;
        b.fetchGen++;
        b.view = { leader: null, epoch: 0, isr: [] };
        ctx.log("ok", `${brokerLabel(a.b)} starts again`, {
          detail: `It loads its log (log end offset ${b.log.length}) and starts heartbeating. Once the controller hears from it, it rejoins as a follower.`,
          node: brokerNode(a.b),
        });
        ctx.schedule(0, { type: "heartbeat", b: a.b, gen: b.gen });
        return;
      }
      case "set-cut": {
        const b = s.brokers[a.b];
        if (b.cut === a.on) return;
        b.cut = a.on;
        if (a.on) {
          b.fetchGen++;
          b.fetchOut = false;
          b.parked = [];
        }
        ctx.log(a.on ? "warn" : "ok", a.on ? `${brokerLabel(a.b)} is cut off the network` : `${brokerLabel(a.b)}'s network is back`, {
          detail: a.on
            ? "The process keeps running, but nothing reaches it and nothing it sends gets out: no Produce, no Fetch, no heartbeats to the controller."
            : "Its next heartbeat reaches the controller and it learns who leads now.",
          node: brokerNode(a.b),
        });
        if (!a.on && b.up && !s.ctl.fenced[a.b]) applyView(s, ctx, b);
        return;
      }
      case "set-stall": {
        const b = s.brokers[a.b];
        if (b.stalled === a.on) return;
        b.stalled = a.on;
        ctx.log(a.on ? "warn" : "ok", a.on ? `${brokerLabel(a.b)}'s replica fetcher stalls` : `${brokerLabel(a.b)}'s replica fetcher runs again`, {
          detail: a.on
            ? "It stops fetching from the leader (think a stuck fetcher thread or a long pause), but still heartbeats, so the controller keeps it registered. Only the leader can tell it has fallen behind."
            : "It fetches from where its log ends and catches up.",
          node: brokerNode(a.b),
        });
        if (!a.on) startFetch(s, ctx, b);
        return;
      }
      case "unclean-election": {
        if (s.ctl.leader !== null) return;
        ctx.log("info", "An operator runs kafka-leader-election.sh --election-type unclean", {
          detail: "An unclean election runs only when the partition has no leader. It picks any live replica, in or out of sync.",
          node: CONTROLLER,
        });
        elect(s, ctx, "An operator forced an unclean election.", true);
        return;
      }
    }
  },
};

/** Every node id the canvas draws. */
export function nodeIds(): string[] {
  return [PRODUCER, CONTROLLER, ...BROKERS.map(brokerNode)];
}
