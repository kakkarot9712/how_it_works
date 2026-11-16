import type { Scenario } from "@/sims/types";
import type { Action, Components, Settings } from "./model";

export const scenarios: Scenario<Action, Settings, Components>[] = [
  {
    id: "fan-out",
    title: "Fan-out: the happy path",
    summary:
      "Two services publish, three consume. Each PUBLISH is copied into every matching subscriber's output buffer and pushed down its TCP connection.",
    watchFor: [
      "The publisher gets back (integer) N, the number of receivers.",
      "analytics gets both channels; fraud-check gets payments through the pay* pattern.",
      "Each subscriber's socket buffer holds at most a few unread messages (the TCP window).",
    ],
    script: [],
    flow: [
      { at: 0, nodes: ["P1", "server", "buf:S1", "buf:S2", "S1", "S2"], note: "Follow orders: checkout-api → redis-server → each subscriber's output buffer → email-worker, analytics." },
      { at: 2500, nodes: ["P2", "server", "buf:S2", "buf:S3", "S2", "S3"], note: "Now payments: analytics gets it through the channel, fraud-check through the pay* pattern." },
    ],
  },
  {
    id: "void",
    title: "Publishing into the void",
    summary:
      "Pub/Sub keeps nothing. A message published to a channel with no subscribers is discarded on the spot.",
    watchFor: [
      "PUBLISH refunds returns (integer) 0.",
      "Nothing is stored. A subscriber joining later will never see it.",
    ],
    script: [
      { at: 0, action: { type: "set-auto", pub: "P1", on: false } },
      { at: 0, action: { type: "set-auto", pub: "P2", on: false } },
      { at: 600, action: { type: "publish", pub: "P1", channel: "orders" } },
      { at: 2400, action: { type: "publish", pub: "P2", channel: "refunds" } },
      { at: 4200, action: { type: "publish", pub: "P2", channel: "payments" } },
    ],
    select: "P2",
    flow: [
      { at: 0, nodes: ["P1", "server", "buf:S1", "buf:S2", "S1", "S2"], note: "Watch checkout-api's reply: (integer) 2, one per receiver." },
      { at: 2400, nodes: ["P2", "server"], note: "PUBLISH refunds: no subscriber matches, so Redis drops it and replies (integer) 0." },
      { at: 4200, nodes: ["P2", "server", "buf:S2", "buf:S3", "S2", "S3"], note: "PUBLISH payments: two receivers again, analytics by channel, fraud-check by pattern." },
    ],
  },
  {
    id: "offline",
    title: "A subscriber restarts and misses messages",
    summary:
      "analytics is redeployed. While it's gone, Redis doesn't hold anything for it. When it comes back it only sees new messages.",
    watchFor: [
      "The 'missed' counter on analytics grows while it is offline.",
      "On re-subscribe there is no way to fetch what was missed: no offsets, no history.",
    ],
    script: [
      { at: 3000, action: { type: "go-offline", sub: "S2" } },
      { at: 9000, action: { type: "go-online", sub: "S2" } },
    ],
    select: "S2",
    flow: [
      { at: 0, nodes: ["P1", "P2", "server", "buf:S2", "S2"], note: "Watch analytics: it gets orders and payments while it is subscribed." },
      { at: 3000, nodes: ["server", "buf:S2", "S2"], note: "analytics is offline. Redis dropped its subscriptions; its missed counter climbs." },
      { at: 9000, nodes: ["server", "buf:S2", "S2"], note: "analytics re-subscribes and only sees new messages. What it missed is gone." },
    ],
  },
  {
    id: "hard-limit",
    title: "Stuck consumer hits the hard limit",
    summary:
      "email-worker stops reading its socket. Its TCP window fills, then its output buffer grows inside Redis until it crosses the hard limit and Redis cuts it off.",
    watchFor: [
      "The output buffer bar climbs past the soft line to the hard line.",
      "On disconnect, every buffered message is dropped.",
      "It reconnects, is still stuck, and gets cut off again, in a loop.",
    ],
    settings: { hardKb: 12, softKb: 6, softSeconds: 30 },
    script: [
      { at: 0, action: { type: "set-interval", pub: "P1", ms: 550 } },
      { at: 2000, action: { type: "set-blocked", sub: "S1", on: true } },
      { at: 25000, action: { type: "set-blocked", sub: "S1", on: false } },
    ],
    select: "S1",
    flow: [
      { at: 0, nodes: ["P1", "server", "buf:S1", "S1"], note: "Follow orders into email-worker's output buffer." },
      { at: 2000, nodes: ["buf:S1", "S1"], note: "email-worker stops reading. Its TCP window fills, then its output buffer grows inside Redis." },
      { at: 7000, nodes: ["buf:S1"], note: "Past the soft line, which needs 30 s; the 12 KB hard line closes the client at once." },
      { at: 10500, nodes: ["buf:S1", "S1"], note: "Closed and its buffer dropped. It reconnects, still stuck, and the cycle repeats." },
      { at: 25000, nodes: ["server", "buf:S1", "S1"], note: "email-worker reads again and keeps up." },
    ],
  },
  {
    id: "soft-limit",
    title: "Slow consumer and the soft limit",
    summary:
      "fraud-check is slower than the payment rate. It never crosses the hard limit, but it stays above the soft limit for too long.",
    watchFor: [
      "The soft-limit timer under fraud-check's buffer counts up to the configured seconds.",
      "Then Redis closes it, even though it never reached the hard limit.",
    ],
    settings: { softKb: 4, hardKb: 64, softSeconds: 5 },
    components: { pattern: true },
    script: [
      { at: 0, action: { type: "set-interval", pub: "P2", ms: 380 } },
      { at: 0, action: { type: "set-process-ms", sub: "S3", ms: 950 } },
    ],
    select: "S3",
    flow: [
      { at: 0, nodes: ["P2", "server", "buf:S3", "S3"], note: "fraud-check handles each payment more slowly than billing-api publishes them." },
      { at: 4600, nodes: ["buf:S3"], note: "Above the 4 KB soft limit: watch the timer under the buffer count towards 5 s." },
      { at: 10300, nodes: ["buf:S3", "S3"], note: "Closed by the soft limit, far below the hard limit. It reconnects and falls behind again." },
    ],
  },
  {
    id: "partition",
    title: "Network partition: slow and gone look the same",
    summary:
      "The link to analytics is cut. Redis can't tell a broken network from a slow reader. analytics can't tell it has been dropped.",
    watchFor: [
      "The buffer grows exactly as if analytics were slow.",
      "After Redis closes it, analytics is half-open: it thinks it is still subscribed.",
      "It only finds out once the link is back and the FIN arrives.",
    ],
    script: [
      { at: 2500, action: { type: "set-link", sub: "S2", up: false } },
      { at: 15000, action: { type: "set-link", sub: "S2", up: true } },
    ],
    select: "S2",
    flow: [
      { at: 0, nodes: ["server", "buf:S2", "S2"], note: "Watch the link between analytics' output buffer and analytics." },
      { at: 2500, nodes: ["buf:S2", "S2"], note: "Link cut. To Redis this looks like a slow reader: the buffer grows." },
      { at: 9100, nodes: ["buf:S2", "S2"], note: "Redis closed the client, but the FIN can't cross: analytics still thinks it is subscribed." },
      { at: 15000, nodes: ["server", "buf:S2", "S2"], note: "Link back: the FIN arrives, and analytics reconnects and re-subscribes, having missed messages." },
    ],
  },
  {
    id: "oom",
    title: "No buffer limits: one consumer takes everyone down",
    summary:
      "The output buffer limit is removed (the lego block is pulled out). One stuck subscriber grows its buffer until the host runs out of memory.",
    watchFor: [
      "The memory gauge on redis-server fills up.",
      "The OOM killer stops Redis, and the healthy subscribers lose their connections too.",
      "After restart, nobody is subscribed until clients reconnect.",
    ],
    settings: { headroomKb: 40 },
    components: { limits: false },
    script: [
      { at: 0, action: { type: "set-interval", pub: "P1", ms: 300 } },
      { at: 1500, action: { type: "set-blocked", sub: "S1", on: true } },
    ],
    select: "server",
    flow: [
      { at: 0, nodes: ["P1", "server", "buf:S1", "S1"], note: "No output buffer limits in this run. Watch email-worker's buffer." },
      { at: 1500, nodes: ["server", "buf:S1"], note: "email-worker is stuck: its buffer and redis-server's memory gauge grow together." },
      { at: 13000, nodes: ["P1", "P2", "server", "S1", "S2", "S3"], note: "The OOM killer stops Redis: every client loses its connection, the healthy ones too." },
      { at: 16000, nodes: ["server", "buf:S1", "buf:S2", "buf:S3", "S1", "S2", "S3"], note: "Redis is back with zero subscriptions until the clients re-subscribe." },
    ],
  },
  {
    id: "restart",
    title: "Redis restarts: subscriptions vanish",
    summary:
      "Subscriptions exist only as state on live connections. A Redis restart wipes them and everything in flight.",
    watchFor: [
      "Publishers get connection errors while Redis is down. Those messages are simply lost.",
      "After restart, PUBLISH returns 0 until subscribers re-SUBSCRIBE.",
    ],
    script: [{ at: 4000, action: { type: "crash-server" } }],
    select: "server",
    flow: [
      { at: 0, nodes: ["P1", "P2", "server"], note: "Watch redis-server and the publishers' replies." },
      { at: 4000, nodes: ["P1", "P2", "server"], note: "Redis is down: PUBLISH fails with a connection error and those messages are lost." },
      { at: 7000, nodes: ["P1", "server", "S1", "S2", "S3"], note: "Back up with zero subscriptions: PUBLISH returns 0 until subscribers SUBSCRIBE again." },
    ],
  },
];
