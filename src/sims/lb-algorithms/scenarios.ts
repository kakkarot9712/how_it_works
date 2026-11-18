import type { Scenario } from "@/sims/types";
import type { Action, Components, Settings } from "./model";

export const scenarios: Scenario<Action, Settings, Components>[] = [
  {
    id: "even",
    title: "Equal servers, equal requests",
    summary:
      "Three identical servers and requests that all take about the same time. Every method spreads the load well enough, and response times look the same in all four groups.",
    watchFor: [
      "Round robin sends api-1, api-2, api-3 in strict turn.",
      "random can put two requests in a row on the same server; with this little load, it barely matters.",
      "least_conn and random two show why they picked a server: the active connection counts.",
    ],
    script: [],
    select: "lb:rr",
    flow: [
      { at: 0, nodes: ["clients", "lb:rr", "lb:random", "lb:lc", "lb:p2c"], note: "Each request goes to all four nginx groups at the same moment. Only the balancing method differs." },
      { at: 3000, nodes: ["lb:rr", "rr:api-1", "rr:api-2", "rr:api-3"], note: "Round robin: api-1, api-2, api-3, api-1… in strict turn, whatever each server is doing." },
      { at: 8000, nodes: ["lb:lc", "lc:api-1", "lc:api-2", "lc:api-3", "lb:p2c"], note: "least_conn picks the server with the fewest active requests; random two compares two random servers." },
    ],
  },
  {
    id: "heavy",
    title: "Some requests are 8× heavier",
    summary:
      "About one request in seven is heavy: eight times the work. Methods that don't look at load keep queueing light requests behind heavy ones; methods that count active connections steer around them.",
    watchFor: [
      "In round robin and random, light requests wait in a queue behind a heavy one.",
      "least_conn and random two see the busy server's active count and send new requests elsewhere.",
      "Compare p95 on the four nginx cards: the time 95 in 100 normal requests beat. The slowest few are where the methods differ.",
    ],
    settings: { heavyPct: 15, intervalMs: 550, readTimeoutS: 20 },
    script: [],
    select: "lb:rr",
    flow: [
      { at: 0, nodes: ["clients", "lb:rr", "lb:random", "lb:lc", "lb:p2c"], note: "About one request in seven is heavy. Every group gets each heavy one at the same moment." },
      { at: 4000, nodes: ["lb:rr", "rr:api-1", "rr:api-2", "rr:api-3"], note: "Round robin keeps giving a busy server its turn: light requests queue behind the heavy one." },
      { at: 12000, nodes: ["lb:lc", "lc:api-1", "lc:api-2", "lc:api-3"], note: "least_conn sees the heavy request as an active connection and sends new ones elsewhere." },
      { at: 20000, nodes: ["lb:rr", "lb:random", "lb:lc", "lb:p2c"], note: "Compare p95 on the four nginx cards: same requests, very different tails." },
    ],
  },
  {
    id: "slow-server",
    title: "One server slows down",
    summary:
      "At 3 s api-2 drops to a quarter of its speed (think a noisy neighbour or a long GC pause). Round robin and random keep sending it a full share; the connection-counting methods shift traffic away.",
    watchFor: [
      "api-2's queue grows in the round robin and random groups.",
      "In least_conn and random two, api-2's active count stays high, so it gets fewer new requests.",
      "No method knows api-2 is slow; least_conn only sees requests that haven't finished.",
    ],
    settings: { readTimeoutS: 20 },
    script: [{ at: 3000, action: { type: "set-speed", server: 1, speed: 0.25 } }],
    select: "rr:api-2",
    flow: [
      { at: 0, nodes: ["rr:api-2", "random:api-2", "lc:api-2", "p2c:api-2"], note: "Watch api-2 in all four groups. It is about to get four times slower." },
      { at: 3000, nodes: ["lb:rr", "rr:api-2", "lb:random", "random:api-2"], note: "Round robin and random still give api-2 a full share: its queue grows." },
      { at: 10000, nodes: ["lb:lc", "lc:api-2", "lb:p2c", "p2c:api-2"], note: "least_conn and random two see api-2's open requests and send most new ones elsewhere." },
      { at: 20000, nodes: ["lb:rr", "lb:random", "lb:lc", "lb:p2c"], note: "Compare p95 on the nginx cards." },
    ],
  },
  {
    id: "weights",
    title: "Uneven servers: weights",
    summary:
      "api-3 is a bigger machine, three times faster than the others, and has weight=3. Weighted round robin sends it 3 of every 5 requests. Remove the Server weights block and round robin splits evenly again, overloading the small servers.",
    watchFor: [
      "Round robin's order with weights: api-3 gets three turns in five, spread out (smooth weighted round robin).",
      "least_conn compares active connections divided by weight.",
      "Then pull out the Server weights block and run it again.",
    ],
    settings: { weight3: 3, intervalMs: 200, workers: 1 },
    script: [{ at: 0, action: { type: "set-speed", server: 2, speed: 3 } }],
    select: "lb:rr",
    flow: [
      { at: 0, nodes: ["lb:rr", "rr:api-1", "rr:api-2", "rr:api-3"], note: "api-3 is three times faster and has weight=3. Count where round robin sends requests." },
      { at: 6000, nodes: ["lb:lc", "lc:api-1", "lc:api-2", "lc:api-3"], note: "least_conn divides active connections by weight, so api-3 may hold three times as many." },
      { at: 15000, nodes: ["lb:rr", "lb:random", "lb:lc", "lb:p2c"], note: "Now open Blocks & settings, remove Server weights, and compare round robin again." },
    ],
  },
  {
    id: "crash",
    title: "A server crashes: retries and max_fails",
    summary:
      "api-2 crashes at 5 s and comes back at 18 s. Connections to it are refused; nginx passes each failed request to the next server, marks api-2 unavailable for fail_timeout, then probes it with live requests.",
    watchFor: [
      "RST comes back from api-2; the same request goes on to another server (a retry).",
      "After max_fails=1 failure, api-2 shows 'disabled' with a countdown: no new requests go there.",
      "After api-2 restarts, the next probe succeeds and it's back in rotation. Clients never see an error.",
    ],
    script: [
      { at: 5000, action: { type: "crash", server: 1 } },
      { at: 18000, action: { type: "restart", server: 1 } },
    ],
    select: "rr:api-2",
    flow: [
      { at: 0, nodes: ["lb:rr", "rr:api-1", "rr:api-2", "rr:api-3"], note: "Watch api-2. It is about to crash." },
      { at: 5000, nodes: ["lb:rr", "rr:api-2", "lb:lc", "lc:api-2"], note: "api-2 refuses connections: RST. nginx retries the request on another server and disables api-2." },
      { at: 9000, nodes: ["rr:api-2", "random:api-2", "lc:api-2", "p2c:api-2"], note: "Every fail_timeout, a live request probes api-2. It fails again, so it stays disabled." },
      { at: 18000, nodes: ["rr:api-2", "random:api-2", "lc:api-2", "p2c:api-2"], note: "api-2 is back. The next probe succeeds and it rejoins the rotation." },
    ],
  },
  {
    id: "black-hole",
    title: "Without max_fails, least_conn loves a dead server",
    summary:
      "Health checks are removed (max_fails=0). api-2 crashes at 4 s. A dead server answers at once with RST, so it almost never has active connections, and least_conn keeps choosing it first. Every such request pays a failed attempt before its retry.",
    watchFor: [
      "The retry counter on the least_conn card climbs much faster than round robin's.",
      "api-2 is never disabled: nothing counts its failures.",
      "Put the Passive health checks block back and replay: one failure disables it.",
    ],
    components: { healthChecks: false },
    script: [{ at: 4000, action: { type: "crash", server: 1 } }],
    select: "lb:lc",
    flow: [
      { at: 0, nodes: ["lb:lc", "lc:api-1", "lc:api-2", "lc:api-3"], note: "Passive health checks are off in this run. Watch least_conn and api-2." },
      { at: 4000, nodes: ["lb:lc", "lc:api-2", "lb:rr", "rr:api-2"], note: "api-2 crashed. Its RSTs come back at once, so its active count stays near 0." },
      { at: 9000, nodes: ["lb:lc", "lc:api-2", "lb:p2c", "p2c:api-2"], note: "least_conn keeps picking the server with the fewest active first: compare the retries on each card." },
    ],
  },
  {
    id: "hang",
    title: "A server hangs: timeouts",
    summary:
      "At 4 s api-3 stops responding but keeps accepting connections. nginx only finds out when proxy_read_timeout runs out. Round robin and random keep handing it a share of the traffic until the first timeout; least_conn stops once api-3 has the most open requests.",
    watchFor: [
      "api-3's active count grows; in round robin and random every one of those requests is stuck.",
      "least_conn and random two stop sending there once its active count is the highest.",
      "At the timeout each stuck request is retried elsewhere, late. Compare worst response times.",
    ],
    settings: { readTimeoutS: 6 },
    script: [
      { at: 4000, action: { type: "set-hang", server: 2, on: true } },
      { at: 20000, action: { type: "set-hang", server: 2, on: false } },
    ],
    select: "rr:api-3",
    flow: [
      { at: 0, nodes: ["rr:api-3", "random:api-3", "lc:api-3", "p2c:api-3"], note: "Watch api-3 in all four groups. It is about to stop responding." },
      { at: 4000, nodes: ["lb:rr", "rr:api-3", "lb:lc", "lc:api-3"], note: "api-3 hangs. Round robin keeps sending it every third request; least_conn sees them pile up." },
      { at: 10000, nodes: ["lb:rr", "rr:api-3", "lb:random", "random:api-3"], note: "proxy_read_timeout runs out: stuck requests are retried elsewhere and api-3 is disabled." },
      { at: 20000, nodes: ["rr:api-3", "random:api-3", "lc:api-3", "p2c:api-3"], note: "api-3 responds again and is probed back into rotation." },
    ],
  },
];
