import type { SimContext, SimModel } from "@/engine/types";

/**
 * Four nginx upstream groups side by side, each with its own copy of the same three
 * backends, fed the exact same requests at the exact same moments. Only the balancing
 * method differs:
 *
 *   rr      (default)     smooth weighted round robin      ngx_http_upstream_round_robin.c
 *   random  random;       weighted random pick             ngx_http_upstream_random_module.c
 *   lc      least_conn;   fewest active connections/weight ngx_http_upstream_least_conn_module.c
 *   p2c     random two;   two random picks, then least_conn ngx_http_upstream_random_module.c
 *
 * The peer selection, the per-peer counters (conns, fails, checked, accessed,
 * current_weight, effective_weight), max_fails / fail_timeout and proxy_next_upstream
 * follow the nginx 1.30.6 source. The backends are a generic app server: a fixed number
 * of workers and a FIFO queue. Server actions (slow down, hang, crash) hit the same
 * server in all four groups, so the comparison stays fair.
 *
 * Time runs in slow motion so requests can be watched.
 */

// ---------- data ----------

export type LaneId = "rr" | "random" | "lc" | "p2c";
export const LANES: LaneId[] = ["rr", "random", "lc", "p2c"];

export const LANE_INFO: Record<LaneId, { title: string; directive: string; short: string }> = {
  rr: { title: "round robin", directive: "(default)", short: "round robin" },
  random: { title: "random", directive: "random;", short: "random" },
  lc: { title: "least_conn", directive: "least_conn;", short: "least_conn" },
  p2c: { title: "random two", directive: "random two;", short: "random two" },
};

export const SERVER_COUNT = 3;
export const serverLabel = (i: number) => `api-${i + 1}`;
export const CLIENTS = "clients";
export const lbNode = (lane: LaneId) => `lb:${lane}`;
export const srvNode = (lane: LaneId, i: number) => `${lane}:${serverLabel(i)}`;

/** Parse a server node id (`rr:api-2`) into its lane and index. */
export function parseSrvNode(id: string): { lane: LaneId; i: number } | null {
  const m = /^(rr|random|lc|p2c):api-(\d)$/.exec(id);
  if (!m) return null;
  const i = Number(m[2]) - 1;
  return i >= 0 && i < SERVER_COUNT ? { lane: m[1] as LaneId, i } : null;
}

/** nginx's view of one server in a group (ngx_http_upstream_rr_peer_t). */
export interface Peer {
  weight: number;
  effectiveWeight: number;
  currentWeight: number;
  /** Active connections from this group. */
  conns: number;
  fails: number;
  /** Last failure (ms). */
  accessed: number;
  /** Start of the current fail_timeout window (ms). */
  checked: number;
}

/** A request being worked on (or waiting) inside one backend copy. */
export interface Job {
  req: number;
  att: number;
  heavy: boolean;
  /** Work in ms at speed ×1. */
  cost: number;
  startedAt: number | null;
  endsAt: number | null;
  /** Work left (ms at the server's speed) when the server hung mid-request. */
  remaining: number | null;
}

/** One copy of a backend server, inside one lane. */
export interface Backend {
  queue: Job[];
  working: Job[];
  done: number;
  /** Lane-local narration flags. */
  disabledNoted: boolean;
}

/** The real server's condition, shared by its four copies. */
export interface ServerSpec {
  label: string;
  /** 1 = normal; 0.25 = four times slower; 3 = three times faster. */
  speed: number;
  crashed: boolean;
  hung: boolean;
  /** Bumped on hang/unhang/crash so pending job-done events are ignored. */
  gen: number;
}

export interface LaneReq {
  id: number;
  heavy: boolean;
  cost: number;
  /** When nginx received it (ms). */
  arrivedAt: number;
  /** Server indexes already tried for this request (rrp->tried). */
  tried: number[];
  /** Attempts left (pc->tries): starts at the number of servers. */
  triesLeft: number;
  /** Current attempt id, or null when not waiting on a server. */
  att: number | null;
  server: number | null;
  /** Times this request was passed to the next server. */
  retries: number;
}

export interface Decision {
  req: number;
  server: number | null;
  why: string;
  at: number;
}

export interface Lane {
  id: LaneId;
  peers: Peer[];
  backends: Backend[];
  reqs: Record<number, LaneReq>;
  /** Private random stream for random / random two picks (mulberry32 state). */
  rng: number;
  last: Decision | null;
  stats: {
    ok: number;
    /** 502 / 504 sent to the client. */
    errors: number;
    retries: number;
    /** Response times (ms) of the last LATENCY_WINDOW successful normal (not heavy) requests, oldest first. */
    recent: number[];
    worst: number;
    /** Per server: requests nginx sent there (attempts, including retries). */
    sent: number[];
  };
  noLiveNoted: boolean;
  backlogNoted: boolean;
  behindHeavyNoted: boolean;
  refusedNoted: boolean;
  timeoutNoted: boolean;
  errorNoted: boolean;
}

export type PacketKind = "req" | "fwd" | "resp" | "rst";

export interface Packet {
  id: number;
  kind: PacketKind;
  lane: LaneId;
  /** Server index for fwd/resp/rst. */
  server: number | null;
  from: string;
  to: string;
  sentAt: number;
  arriveAt: number;
  label: string;
  heavy: boolean;
}

export interface Settings {
  intervalMs: number;
  heavyPct: number;
  heavyX: number;
  workers: number;
  latencyMs: number;
  maxFails: number;
  failTimeoutS: number;
  readTimeoutS: number;
  weight1: number;
  weight2: number;
  weight3: number;
}

export interface Components {
  /** max_fails / fail_timeout accounting (passive health checks). Off = max_fails=0. */
  healthChecks: boolean;
  /** proxy_next_upstream error timeout (the default). Off = proxy_next_upstream off. */
  nextUpstream: boolean;
  /** The weight= parameters. Off = every server weight 1. */
  weights: boolean;
}

export interface Params {
  settings: Settings;
  components: Components;
}

export interface State {
  settings: Settings;
  components: Components;
  traffic: { on: boolean; gen: number; intervalMs: number; sent: number; heavy: number; rng: number };
  /** Most recent requests first, for the clients card. */
  recentReqs: { id: number; heavy: boolean; at: number }[];
  servers: ServerSpec[];
  lanes: Record<LaneId, Lane>;
  packets: Packet[];
  nextId: number;
  nextReq: number;
  flags: { explainedHeavy: boolean };
}

// ---------- events & actions ----------

export type Event =
  | { type: "arrive"; gen: number }
  | { type: "lb-in"; lane: LaneId; req: number; heavy: boolean; cost: number; packet: number }
  | { type: "fwd-in"; lane: LaneId; req: number; att: number; server: number; packet: number }
  | { type: "job-done"; lane: LaneId; server: number; att: number; gen: number }
  | { type: "resp-in"; lane: LaneId; req: number; att: number; server: number; packet: number }
  | { type: "rst-in"; lane: LaneId; req: number; att: number; server: number; packet: number }
  | { type: "timeout"; lane: LaneId; req: number; att: number };

export type Action =
  | { type: "set-traffic"; on: boolean }
  | { type: "set-interval"; ms: number }
  | { type: "burst"; heavy: boolean; n: number }
  | { type: "set-speed"; server: number; speed: number }
  | { type: "set-hang"; server: number; on: boolean }
  | { type: "crash"; server: number }
  | { type: "restart"; server: number };

type Ctx = SimContext<Event>;

// ---------- constants ----------

/** Work for a light request at speed ×1 (ms, slow motion), ± LIGHT_JITTER. */
export const LIGHT_MS = 600;
const LIGHT_JITTER = 120;
const MIN_GAP_MS = 60;
export const LATENCY_WINDOW = 50;
const RECENT_REQS = 18;

export const defaultSettings: Settings = {
  intervalMs: 380,
  heavyPct: 0,
  heavyX: 8,
  workers: 2,
  latencyMs: 200,
  maxFails: 1,
  failTimeoutS: 5,
  readTimeoutS: 10,
  weight1: 1,
  weight2: 1,
  weight3: 1,
};

export const defaultComponents: Components = { healthChecks: true, nextUpstream: true, weights: true };

// ---------- helpers ----------

/** mulberry32 step on a state held in plain data (same generator as the engine's). */
function nextRandom(holder: { rng: number }): number {
  holder.rng = (holder.rng + 0x6d2b79f5) >>> 0;
  let t = holder.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export function maxFails(s: State): number {
  return s.components.healthChecks ? s.settings.maxFails : 0;
}

export function weightOf(s: State, i: number): number {
  if (!s.components.weights) return 1;
  return [s.settings.weight1, s.settings.weight2, s.settings.weight3][i];
}

/** Is this peer skipped because of max_fails / fail_timeout? (the check every balancer makes) */
export function peerDisabled(s: State, p: Peer, now: number): boolean {
  const mf = maxFails(s);
  return mf > 0 && p.fails >= mf && now - p.checked <= s.settings.failTimeoutS * 1000;
}

function sendPacket(s: State, ctx: Ctx, p: Omit<Packet, "id" | "sentAt" | "arriveAt">): Packet {
  const packet: Packet = { ...p, id: s.nextId++, sentAt: ctx.now, arriveAt: ctx.now + s.settings.latencyMs };
  s.packets.push(packet);
  return packet;
}

function dropPacket(s: State, id: number) {
  const i = s.packets.findIndex((p) => p.id === id);
  if (i >= 0) s.packets.splice(i, 1);
}

/** Percentile of the recent response times (ms), or null with no data. */
export function percentile(xs: number[], p: number): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

// ---------- balancers (nginx 1.30.6) ----------

type Pick = { i: number; why: string } | null;

/** ngx_http_upstream_get_peer: smooth weighted round robin over peers not tried, not down, not failed. */
function pickRoundRobin(s: State, lane: Lane, tried: number[], now: number): Pick {
  let best = -1;
  let total = 0;
  lane.peers.forEach((p, i) => {
    if (tried.includes(i) || peerDisabled(s, p, now)) return;
    p.currentWeight += p.effectiveWeight;
    total += p.effectiveWeight;
    if (p.effectiveWeight < p.weight) p.effectiveWeight++;
    if (best < 0 || p.currentWeight > lane.peers[best].currentWeight) best = i;
  });
  if (best < 0) return null;
  lane.peers[best].currentWeight -= total;
  return { i: best, why: s.components.weights && lane.peers.some((p) => p.weight !== 1) ? "next in weighted turn" : "next in turn" };
}

/** ngx_http_upstream_get_least_conn_peer: fewest conns/weight; ties go round robin among the tied. */
function pickLeastConn(s: State, lane: Lane, tried: number[], now: number): Pick {
  const ps = lane.peers;
  let best = -1;
  let many = false;
  ps.forEach((p, i) => {
    if (tried.includes(i) || peerDisabled(s, p, now)) return;
    if (best < 0 || p.conns * ps[best].weight < ps[best].conns * p.weight) {
      best = i;
      many = false;
    } else if (p.conns * ps[best].weight === ps[best].conns * p.weight) {
      many = true;
    }
  });
  if (best < 0) return null;
  const fewest = ps[best].conns;
  if (many) {
    let total = 0;
    const first = best;
    for (let i = first; i < ps.length; i++) {
      const p = ps[i];
      if (tried.includes(i)) continue;
      if (p.conns * ps[first].weight !== ps[first].conns * p.weight) continue;
      if (peerDisabled(s, p, now)) continue;
      p.currentWeight += p.effectiveWeight;
      total += p.effectiveWeight;
      if (p.effectiveWeight < p.weight) p.effectiveWeight++;
      if (p.currentWeight > ps[best].currentWeight) best = i;
    }
    ps[best].currentWeight -= total;
    return { i: best, why: `tie at ${fewest} active, in turn` };
  }
  return { i: best, why: `fewest active (${fewest})` };
}

/** ngx_http_upstream_peek_random_peer: a weighted random index. */
function peekRandom(lane: Lane): number {
  const total = lane.peers.reduce((a, p) => a + p.weight, 0);
  const x = Math.floor(nextRandom(lane) * total);
  let acc = 0;
  for (let i = 0; i < lane.peers.length; i++) {
    acc += lane.peers[i].weight;
    if (x < acc) return i;
  }
  return lane.peers.length - 1;
}

const RANDOM_TRIES = 20;

/** ngx_http_upstream_get_random_peer: weighted random; after 20 unusable picks, falls back to round robin. */
function pickRandom(s: State, lane: Lane, tried: number[], now: number): Pick {
  for (let n = 0; n <= RANDOM_TRIES; n++) {
    const i = peekRandom(lane);
    if (tried.includes(i) || peerDisabled(s, lane.peers[i], now)) continue;
    return { i, why: "random pick" };
  }
  return pickRoundRobin(s, lane, tried, now);
}

/** ngx_http_upstream_get_random2_peer: two distinct usable random picks, keep the one with fewer conns/weight (ties: the second). */
function pickRandomTwo(s: State, lane: Lane, tried: number[], now: number): Pick {
  const ps = lane.peers;
  let prev = -1;
  for (let n = 0; n <= RANDOM_TRIES; n++) {
    const i = peekRandom(lane);
    if (i === prev || tried.includes(i) || peerDisabled(s, ps[i], now)) continue;
    if (prev >= 0) {
      const a = ps[prev];
      const b = ps[i];
      const chosen = b.conns * a.weight > a.conns * b.weight ? prev : i;
      return { i: chosen, why: `${serverLabel(prev)} (${a.conns}) vs ${serverLabel(i)} (${b.conns})` };
    }
    prev = i;
  }
  return pickRoundRobin(s, lane, tried, now);
}

function pick(s: State, lane: Lane, tried: number[], now: number): Pick {
  switch (lane.id) {
    case "rr":
      return pickRoundRobin(s, lane, tried, now);
    case "random":
      return pickRandom(s, lane, tried, now);
    case "lc":
      return pickLeastConn(s, lane, tried, now);
    case "p2c":
      return pickRandomTwo(s, lane, tried, now);
  }
}

// ---------- nginx side ----------

/** Choose a server for the request (first try or a retry) and send it. */
function dispatch(s: State, ctx: Ctx, lane: Lane, r: LaneReq) {
  const now = ctx.now;
  const p = pick(s, lane, r.tried, now);
  if (!p) {
    lane.last = { req: r.id, server: null, why: "no live upstreams", at: now };
    if (!lane.noLiveNoted) {
      lane.noLiveNoted = true;
      ctx.log("error", `${LANE_INFO[lane.id].short}: no live upstreams, request #${r.id} gets 502`, {
        detail:
          "Every server this request could still try is marked unavailable (max_fails reached within fail_timeout) or was already tried. nginx answers 502 Bad Gateway. (Further 502s in this group are not listed.)",
        node: lbNode(lane.id),
      });
    }
    finish(s, lane, r, 502, now);
    return;
  }
  const peer = lane.peers[p.i];
  if (now - peer.checked > s.settings.failTimeoutS * 1000) peer.checked = now;
  peer.conns++;
  r.tried.push(p.i);
  r.triesLeft--;
  r.server = p.i;
  r.att = s.nextId++;
  lane.stats.sent[p.i]++;
  lane.last = { req: r.id, server: p.i, why: r.retries > 0 ? `retry: ${p.why}` : p.why, at: now };
  const packet = sendPacket(s, ctx, {
    kind: "fwd",
    lane: lane.id,
    server: p.i,
    from: lbNode(lane.id),
    to: srvNode(lane.id, p.i),
    label: `#${r.id}`,
    heavy: r.heavy,
  });
  ctx.schedule(packet.arriveAt - now, { type: "fwd-in", lane: lane.id, req: r.id, att: r.att, server: p.i, packet: packet.id });
  ctx.schedule(s.settings.readTimeoutS * 1000, { type: "timeout", lane: lane.id, req: r.id, att: r.att });
}

/** ngx_http_upstream_free_round_robin_peer. */
function freePeer(s: State, ctx: Ctx, lane: Lane, i: number, failed: boolean) {
  const p = lane.peers[i];
  const b = lane.backends[i];
  p.conns = Math.max(0, p.conns - 1);
  if (failed) {
    p.fails++;
    p.accessed = ctx.now;
    p.checked = ctx.now;
    const mf = maxFails(s);
    if (mf > 0) {
      p.effectiveWeight -= Math.floor(p.weight / mf);
      if (p.fails >= mf && !b.disabledNoted) {
        b.disabledNoted = true;
        ctx.log("warn", `${LANE_INFO[lane.id].short}: ${serverLabel(i)} temporarily disabled`, {
          detail: `nginx logs "upstream server temporarily disabled": ${p.fails} failed attempt(s) reached max_fails=${mf}. For fail_timeout=${s.settings.failTimeoutS}s no new request is sent there; after that, live requests probe it again.`,
          node: srvNode(lane.id, i),
        });
      }
    }
    if (p.effectiveWeight < 0) p.effectiveWeight = 0;
  } else if (p.accessed < p.checked) {
    if (p.fails > 0 && b.disabledNoted) {
      b.disabledNoted = false;
      ctx.log("ok", `${LANE_INFO[lane.id].short}: ${serverLabel(i)} answered a probe and is back in rotation`, {
        detail: "A successful response after the fail_timeout window resets the failure count.",
        node: srvNode(lane.id, i),
      });
    }
    p.fails = 0;
  }
}

function finish(s: State, lane: Lane, r: LaneReq, status: number, now: number) {
  delete lane.reqs[r.id];
  if (status === 200) {
    const t = now - r.arrivedAt;
    lane.stats.ok++;
    if (!r.heavy) {
      lane.stats.recent.push(t);
      if (lane.stats.recent.length > LATENCY_WINDOW) lane.stats.recent.shift();
    }
    lane.stats.worst = Math.max(lane.stats.worst, t);
  } else {
    lane.stats.errors++;
  }
}

/** The attempt failed (connection reset or timeout): pass to the next server, or answer with an error. */
function attemptFailed(s: State, ctx: Ctx, lane: Lane, r: LaneReq, kind: "error" | "timeout") {
  r.att = null;
  r.server = null;
  if (s.components.nextUpstream && r.triesLeft > 0) {
    r.retries++;
    lane.stats.retries++;
    dispatch(s, ctx, lane, r);
    return;
  }
  const status = kind === "timeout" ? 504 : 502;
  finish(s, lane, r, status, ctx.now);
  if (lane.errorNoted) return;
  lane.errorNoted = true;
  ctx.log("error", `${LANE_INFO[lane.id].short}: request #${r.id} gets ${status} ${kind === "timeout" ? "Gateway Timeout" : "Bad Gateway"}`, {
    detail: s.components.nextUpstream
      ? "Every server this request was allowed to try failed, so the client gets the error from the last one. (Further errors in this group are not listed.)"
      : "proxy_next_upstream is off, so nginx never passes a request to another server: the client gets the error. (Further errors in this group are not listed.)",
    node: lbNode(lane.id),
  });
}

// ---------- backend side ----------

function backendStart(s: State, ctx: Ctx, lane: Lane, i: number) {
  const srv = s.servers[i];
  const b = lane.backends[i];
  if (srv.crashed || srv.hung) return;
  while (b.working.length < s.settings.workers && b.queue.length > 0) {
    const job = b.queue.shift()!;
    const dur = job.cost / srv.speed;
    job.startedAt = ctx.now;
    job.endsAt = ctx.now + dur;
    b.working.push(job);
    ctx.schedule(dur, { type: "job-done", lane: lane.id, server: i, att: job.att, gen: srv.gen });
  }
}

/** Drop a request nginx gave up on (it closed the connection). */
function backendAbandon(lane: Lane, i: number, att: number) {
  const b = lane.backends[i];
  b.queue = b.queue.filter((j) => j.att !== att);
  b.working = b.working.filter((j) => j.att !== att);
}

function checkBacklog(s: State, ctx: Ctx, lane: Lane, i: number) {
  // Narrated once per group: the first time a queue builds up is the lesson; repeats are noise.
  const waiting = lane.backends[i].queue.length;
  if (lane.backlogNoted || waiting < s.settings.workers * 2) return;
  lane.backlogNoted = true;
  const why =
    lane.id === "rr"
      ? "Round robin gives every server its turn, however busy it is."
      : lane.id === "random"
        ? "A random pick ignores how busy a server is."
        : "Even counting active connections, the other servers were as busy or unavailable.";
  ctx.log("warn", `${LANE_INFO[lane.id].short}: ${waiting} requests wait in ${serverLabel(i)}'s queue`, {
    detail: `${why} Each request in the queue waits for the ones in front of it. (Further queues in this group are not listed.)`,
    node: srvNode(lane.id, i),
  });
}

// ---------- traffic ----------

function newRequest(s: State, ctx: Ctx, heavy: boolean) {
  const id = s.nextReq++;
  const cost = heavy ? LIGHT_MS * s.settings.heavyX : LIGHT_MS - LIGHT_JITTER + nextRandom(s.traffic) * 2 * LIGHT_JITTER;
  s.traffic.sent++;
  if (heavy) s.traffic.heavy++;
  s.recentReqs.unshift({ id, heavy, at: ctx.now });
  if (s.recentReqs.length > RECENT_REQS) s.recentReqs.pop();
  if (heavy && !s.flags.explainedHeavy) {
    s.flags.explainedHeavy = true;
    ctx.log("info", `Request #${id} is heavy: ${s.settings.heavyX}× the work of a normal one`, {
      detail: "Every group gets the same heavy request at the same moment. Watch which server each method gives it to, and what queues behind it.",
      node: CLIENTS,
    });
  }
  for (const lane of LANES) {
    const p = sendPacket(s, ctx, { kind: "req", lane, server: null, from: CLIENTS, to: lbNode(lane), label: `#${id}`, heavy });
    ctx.schedule(p.arriveAt - ctx.now, { type: "lb-in", lane, req: id, heavy, cost, packet: p.id });
  }
}

function scheduleArrival(s: State, ctx: Ctx) {
  const u = nextRandom(s.traffic);
  const gap = Math.max(MIN_GAP_MS, -Math.log(1 - u) * s.traffic.intervalMs);
  ctx.schedule(gap, { type: "arrive", gen: s.traffic.gen });
}

// ---------- model ----------

export const model: SimModel<State, Event, Action, Params> = {
  init({ settings, components }, ctx) {
    const s: State = {
      settings: { ...settings },
      components: { ...components },
      traffic: { on: true, gen: 0, intervalMs: settings.intervalMs, sent: 0, heavy: 0, rng: ctx.rng.int(1, 2 ** 31) },
      recentReqs: [],
      servers: Array.from({ length: SERVER_COUNT }, (_, i) => ({ label: serverLabel(i), speed: 1, crashed: false, hung: false, gen: 0 })),
      lanes: {} as Record<LaneId, Lane>,
      packets: [],
      nextId: 1,
      nextReq: 1,
      flags: { explainedHeavy: false },
    };
    for (const id of LANES) {
      s.lanes[id] = {
        id,
        peers: Array.from({ length: SERVER_COUNT }, (_, i) => {
          const w = weightOf(s, i);
          return { weight: w, effectiveWeight: w, currentWeight: 0, conns: 0, fails: 0, accessed: 0, checked: 0 };
        }),
        backends: Array.from({ length: SERVER_COUNT }, () => ({ queue: [], working: [], done: 0, disabledNoted: false })),
        reqs: {},
        rng: ctx.rng.int(1, 2 ** 31),
        last: null,
        stats: { ok: 0, errors: 0, retries: 0, recent: [], worst: 0, sent: Array(SERVER_COUNT).fill(0) },
        noLiveNoted: false,
        backlogNoted: false,
        behindHeavyNoted: false,
        refusedNoted: false,
        timeoutNoted: false,
        errorNoted: false,
      };
    }
    const weights = Array.from({ length: SERVER_COUNT }, (_, i) => weightOf(s, i));
    ctx.log("info", "Four nginx upstream groups get the same requests at the same moments", {
      detail: `Each group has its own copy of api-1, api-2 and api-3 (${s.settings.workers} workers each). Only the balancing method differs: round robin (the default), random, least_conn and random two.${weights.some((w) => w !== 1) ? ` Weights: ${weights.map((w, i) => `${serverLabel(i)} weight=${w}`).join(", ")}.` : ""}`,
      node: CLIENTS,
    });
    scheduleArrival(s, ctx);
    return s;
  },

  handle(s, e, ctx) {
    switch (e.type) {
      case "arrive": {
        if (e.gen !== s.traffic.gen || !s.traffic.on) return;
        const heavy = nextRandom(s.traffic) * 100 < s.settings.heavyPct;
        newRequest(s, ctx, heavy);
        scheduleArrival(s, ctx);
        return;
      }
      case "lb-in": {
        dropPacket(s, e.packet);
        const lane = s.lanes[e.lane];
        const r: LaneReq = { id: e.req, heavy: e.heavy, cost: e.cost, arrivedAt: ctx.now, tried: [], triesLeft: SERVER_COUNT, att: null, server: null, retries: 0 };
        lane.reqs[r.id] = r;
        dispatch(s, ctx, lane, r);
        return;
      }
      case "fwd-in": {
        dropPacket(s, e.packet);
        const lane = s.lanes[e.lane];
        const r = lane.reqs[e.req];
        if (!r || r.att !== e.att) return;
        const srv = s.servers[e.server];
        if (srv.crashed) {
          // Nothing listens on the port: the host answers the connection attempt with RST.
          const p = sendPacket(s, ctx, { kind: "rst", lane: lane.id, server: e.server, from: srvNode(lane.id, e.server), to: lbNode(lane.id), label: "RST", heavy: false });
          ctx.schedule(p.arriveAt - ctx.now, { type: "rst-in", lane: lane.id, req: r.id, att: e.att, server: e.server, packet: p.id });
          return;
        }
        const b = lane.backends[e.server];
        b.queue.push({ req: r.id, att: e.att, heavy: r.heavy, cost: r.cost, startedAt: null, endsAt: null, remaining: null });
        backendStart(s, ctx, lane, e.server);
        const heavyAhead = b.working.find((j) => j.heavy);
        if (!r.heavy && heavyAhead && b.queue.some((j) => j.att === e.att) && !lane.behindHeavyNoted) {
          lane.behindHeavyNoted = true;
          ctx.log("warn", `${LANE_INFO[lane.id].short}: #${r.id} waits behind heavy #${heavyAhead.req} on ${serverLabel(e.server)}`, {
            detail:
              lane.id === "rr" || lane.id === "random"
                ? `${lane.id === "rr" ? "Round robin" : "A random pick"} doesn't look at how busy a server is, so a quick request can land behind a slow one and wait for it. (Not listed again for this group.)`
                : lane.id === "lc"
                  ? "Every server was busy, so least_conn queued it on one with the fewest active connections. (Not listed again for this group.)"
                  : "Both servers random two compared were busy; it took the one with fewer active connections. (Not listed again for this group.)",
            node: srvNode(lane.id, e.server),
          });
        }
        checkBacklog(s, ctx, lane, e.server);
        return;
      }
      case "job-done": {
        const srv = s.servers[e.server];
        if (e.gen !== srv.gen) return;
        const lane = s.lanes[e.lane];
        const b = lane.backends[e.server];
        const k = b.working.findIndex((j) => j.att === e.att);
        if (k < 0) return;
        const [job] = b.working.splice(k, 1);
        b.done++;
        const p = sendPacket(s, ctx, { kind: "resp", lane: lane.id, server: e.server, from: srvNode(lane.id, e.server), to: lbNode(lane.id), label: "200", heavy: job.heavy });
        ctx.schedule(p.arriveAt - ctx.now, { type: "resp-in", lane: lane.id, req: job.req, att: job.att, server: e.server, packet: p.id });
        backendStart(s, ctx, lane, e.server);
        checkBacklog(s, ctx, lane, e.server);
        return;
      }
      case "resp-in": {
        dropPacket(s, e.packet);
        const lane = s.lanes[e.lane];
        const r = lane.reqs[e.req];
        if (!r || r.att !== e.att) return;
        freePeer(s, ctx, lane, e.server, false);
        finish(s, lane, r, 200, ctx.now);
        return;
      }
      case "rst-in": {
        dropPacket(s, e.packet);
        const lane = s.lanes[e.lane];
        const r = lane.reqs[e.req];
        if (!r || r.att !== e.att) return;
        freePeer(s, ctx, lane, e.server, true);
        if (maxFails(s) === 0 && !lane.refusedNoted) {
          lane.refusedNoted = true;
          ctx.log("warn", `${LANE_INFO[lane.id].short}: ${serverLabel(e.server)} refused #${r.id}, and stays in rotation`, {
            detail:
              "max_fails=0 turns off the accounting of failed attempts, so nginx never skips this server. Each request that picks it fails first and is then passed to the next server. (Not listed again for this group.)",
            node: srvNode(lane.id, e.server),
          });
        }
        attemptFailed(s, ctx, lane, r, "error");
        return;
      }
      case "timeout": {
        const lane = s.lanes[e.lane];
        const r = lane.reqs[e.req];
        if (!r || r.att !== e.att || r.server === null) return;
        const i = r.server;
        backendAbandon(lane, i, e.att);
        if (!lane.timeoutNoted) {
          lane.timeoutNoted = true;
          ctx.log("warn", `${LANE_INFO[lane.id].short}: upstream timed out on ${serverLabel(i)} (#${r.id})`, {
            detail: `No response within proxy_read_timeout (${s.settings.readTimeoutS}s here). A timeout counts as an unsuccessful attempt, and with proxy_next_upstream error timeout the request is passed to the next server. (Further timeouts in this group are not listed.)`,
            node: srvNode(lane.id, i),
          });
        }
        freePeer(s, ctx, lane, i, true);
        attemptFailed(s, ctx, lane, r, "timeout");
        backendStart(s, ctx, lane, i);
        return;
      }
    }
  },

  act(s, a, ctx) {
    switch (a.type) {
      case "set-traffic": {
        if (s.traffic.on === a.on) return;
        s.traffic.on = a.on;
        s.traffic.gen++;
        if (a.on) scheduleArrival(s, ctx);
        ctx.log("info", a.on ? "Clients send requests again" : "Clients stopped sending requests", { node: CLIENTS });
        return;
      }
      case "set-interval": {
        s.traffic.intervalMs = a.ms;
        if (s.traffic.on) {
          s.traffic.gen++;
          scheduleArrival(s, ctx);
        }
        return;
      }
      case "burst": {
        for (let k = 0; k < a.n; k++) newRequest(s, ctx, a.heavy);
        ctx.log("info", `Clients send ${a.n} ${a.heavy ? "heavy" : "light"} request(s) at once`, { node: CLIENTS });
        return;
      }
      case "set-speed": {
        const srv = s.servers[a.server];
        if (srv.speed === a.speed) return;
        const before = srv.speed;
        srv.speed = a.speed;
        const slower = a.speed < before;
        ctx.log(slower ? "warn" : "ok", `${srv.label} now runs at ×${a.speed} speed in every group`, {
          detail: slower
            ? "Think a noisy neighbour, a long GC pause or a cold cache. Requests that start from now on take longer. Watch which methods keep sending it work."
            : "Requests that start from now on take less time.",
          node: srvNode("rr", a.server),
        });
        return;
      }
      case "set-hang": {
        const srv = s.servers[a.server];
        if (srv.hung === a.on || srv.crashed) return;
        srv.hung = a.on;
        srv.gen++;
        for (const id of LANES) {
          const lane = s.lanes[id];
          const b = lane.backends[a.server];
          if (a.on) {
            for (const j of b.working) j.remaining = Math.max(0, (j.endsAt ?? ctx.now) - ctx.now);
          } else {
            for (const j of b.working) {
              const left = j.remaining ?? 0;
              j.endsAt = ctx.now + left;
              j.remaining = null;
              ctx.schedule(left, { type: "job-done", lane: id, server: a.server, att: j.att, gen: srv.gen });
            }
            backendStart(s, ctx, lane, a.server);
          }
        }
        ctx.log(a.on ? "warn" : "ok", a.on ? `${srv.label} stops responding (still accepting connections)` : `${srv.label} responds again`, {
          detail: a.on
            ? `Requests sent to it just wait. nginx only notices when proxy_read_timeout (${s.settings.readTimeoutS}s here) runs out. Meanwhile the open requests count as active connections.`
            : undefined,
          node: srvNode("rr", a.server),
        });
        return;
      }
      case "crash": {
        const srv = s.servers[a.server];
        if (srv.crashed) return;
        srv.crashed = true;
        srv.hung = false;
        srv.gen++;
        for (const id of LANES) {
          const lane = s.lanes[id];
          const b = lane.backends[a.server];
          // Open connections are reset: nginx sees an error for every request in flight there.
          for (const j of [...b.working, ...b.queue]) {
            const p = sendPacket(s, ctx, { kind: "rst", lane: id, server: a.server, from: srvNode(id, a.server), to: lbNode(id), label: "RST", heavy: false });
            ctx.schedule(p.arriveAt - ctx.now, { type: "rst-in", lane: id, req: j.req, att: j.att, server: a.server, packet: p.id });
          }
          b.working = [];
          b.queue = [];
        }
        ctx.log("error", `${srv.label} crashed in every group`, {
          detail: "Its process is gone but the host is up, so connection attempts are refused with RST. nginx treats that as an error: it counts a failed attempt and, with proxy_next_upstream error timeout (the default), passes the request to the next server.",
          node: srvNode("rr", a.server),
        });
        return;
      }
      case "restart": {
        const srv = s.servers[a.server];
        if (!srv.crashed) return;
        srv.crashed = false;
        srv.gen++;
        ctx.log("ok", `${srv.label} is running again`, {
          detail: "nginx doesn't know yet. A group that disabled it sends live requests to it again once fail_timeout has passed.",
          node: srvNode("rr", a.server),
        });
        return;
      }
    }
  },
};

/** Every node id the canvas draws (NodeBox `id`), for `SimDefinition.nodeIds` and flow tests. */
export function nodeIds(): string[] {
  return [CLIENTS, ...LANES.flatMap((l) => [lbNode(l), ...Array.from({ length: SERVER_COUNT }, (_, i) => srvNode(l, i))])];
}
