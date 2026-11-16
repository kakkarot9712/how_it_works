import type { Walkthrough } from "@/sims/explainers";

/**
 * What happens in each scenario, moment by moment, for the "How it works" page.
 * Times are simulated (slow-motion) seconds, as shown on the simulator's timeline.
 * Every moment with a `log` is checked by walkthroughs.test.ts: the model must
 * narrate a line containing that text within 0.4s of `t`. Keep them in sync.
 * Text supports `code` and **bold**.
 */
export const walkthroughs: Walkthrough[] = [
  {
    id: "fan-out",
    setup:
      "Defaults. checkout-api publishes to `orders` about every 700 ms, billing-api to `payments` about every 1100 ms. email-worker runs `SUBSCRIBE orders`, analytics `SUBSCRIBE orders payments`, fraud-check `PSUBSCRIBE pay*`. Each subscriber handles a message in 250 ms.",
    moments: [
      {
        t: 0,
        log: "Subscribers are connected and subscribed",
        text: "All three connections are in subscribed state. Redis now maps `orders` → email-worker, analytics and `payments` → analytics, and holds the pattern `pay*` → fraud-check.",
      },
      {
        t: 800,
        log: "PUBLISH orders fanned out to 2 subscriber(s)",
        text: "The first `PUBLISH orders` arrives. Redis appends it to email-worker's and analytics' output buffers and replies `(integer) 2` to checkout-api.",
      },
      {
        text: "Each `PUBLISH payments` goes to analytics through the channel and to fraud-check through the pattern, as a `pmessage` that carries the pattern too.",
      },
    ],
    takeaway:
      "Every match is a separate copy in a separate output buffer. Every subscriber reads faster than messages arrive, so the buffers drain straight away and the run stays free of warnings.",
    tryNext: [
      "Select email-worker and switch on **Stop reading the socket**: its output buffer starts to grow.",
      "Pull out the **Pattern subscriber** block: fraud-check is gone and `PUBLISH payments` returns `(integer) 1`.",
    ],
  },
  {
    id: "void",
    setup: "Auto-publishing is off. The publishers send three messages by hand.",
    moments: [
      {
        t: 1100,
        log: "PUBLISH orders fanned out to 2 subscriber(s)",
        text: "checkout-api publishes to `orders`: two receivers, `(integer) 2`.",
      },
      {
        t: 2800,
        log: 'PUBLISH refunds "refund#1" reached 0 subscribers and was discarded',
        text: "billing-api publishes to `refunds`. Nobody subscribes to it, so Redis drops the message on the spot and replies `(integer) 0`.",
      },
      {
        t: 4650,
        text: "billing-api publishes to `payments`. analytics gets it through the channel and fraud-check through `pay*`: `(integer) 2`.",
      },
    ],
    takeaway:
      "Nothing is stored, not even briefly. The `0` in the reply is the publisher's only clue that nobody heard it.",
    tryNext: ["From billing-api's inspector, **Publish by hand** to `refunds` again, or to `orders`."],
  },
  {
    id: "offline",
    setup: "analytics goes offline at 3 s (think: a deploy) and comes back at 9 s.",
    moments: [
      {
        t: 3000,
        log: "analytics went offline",
        text: "analytics' connection closes. Redis removes its subscriptions immediately: nothing is kept for it from this point on.",
      },
      {
        text: "`orders` now reaches only email-worker, and `payments` only fraud-check. analytics' **missed** counter climbs with every message it should have got.",
      },
      {
        t: 9500,
        log: "analytics re-subscribed, but missed 15 message(s) while away",
        text: "analytics reconnects and runs `SUBSCRIBE` again. It missed 15 messages and has no way to ask for them: there is no offset to resume from.",
      },
    ],
    takeaway:
      "A Pub/Sub subscriber only receives what is published while it is connected and subscribed. A restart, however short, is a gap in its data.",
    tryNext: ["Use **Take offline** on email-worker or fraud-check, and **Bring online** whenever you like."],
  },
  {
    id: "hard-limit",
    setup:
      "Limits are scaled down: hard 12 KB, soft 6 KB for 30 s. checkout-api publishes every 550 ms. email-worker stops reading at 2 s and only reads again at 25 s.",
    moments: [
      {
        t: 2000,
        log: "email-worker stopped reading from its socket",
        text: "email-worker's read loop is stuck (a GC pause, a deadlock, a slow handler). Redis can't see that. It only sees the TCP window stop opening.",
      },
      {
        t: 4400,
        log: "email-worker isn't reading fast enough",
        text: "The socket buffers are full. New `orders` messages now wait in email-worker's output buffer, in Redis's memory.",
      },
      {
        t: 7000,
        log: "email-worker's output buffer passed the soft limit (6 KB)",
        text: "The buffer passes the soft limit. That limit needs 30 s above the line, so it won't be what closes this client.",
      },
      {
        t: 10500,
        log: "Client email-worker scheduled to be closed ASAP for overcoming of output buffer limits.",
        text: "The buffer crosses the 12 KB hard limit. Redis closes the client at once. Everything still in the buffer is dropped and counted as **lost**.",
      },
      {
        t: 12600,
        log: "email-worker re-subscribed, but missed 4 message(s) while away",
        text: "Its client library reconnects and re-subscribes. It missed 4 messages while away, and it still isn't reading, so the buffer starts filling again.",
      },
      {
        t: 21900,
        log: "Client email-worker scheduled to be closed ASAP for overcoming of output buffer limits.",
        text: "Cut off a second time. It reconnects at 24 s, and at 25 s it finally reads again and catches up.",
      },
    ],
    takeaway:
      "The hard limit protects Redis's memory by throwing the slow client's data away. Reconnecting doesn't fix a stuck consumer: it just restarts the cycle of fill, cut off, lose the buffer.",
    tryNext: [
      "Raise the **Hard limit** in Blocks & settings: the client holds on longer and Redis holds more memory for it.",
      "Pull out **Client auto-reconnect**: after the first cut-off, email-worker stays gone.",
    ],
  },
  {
    id: "soft-limit",
    setup:
      "Limits: soft 4 KB for 5 s, hard 64 KB. billing-api publishes every 380 ms, but fraud-check needs 950 ms per message.",
    moments: [
      {
        t: 2700,
        log: "fraud-check isn't reading fast enough",
        text: "fraud-check falls behind. Its socket fills and the backlog moves into its output buffer.",
      },
      {
        t: 4600,
        log: "fraud-check's output buffer passed the soft limit (4 KB)",
        text: "The buffer passes 4 KB and the soft-limit timer starts. The buffer never gets anywhere near the 64 KB hard limit.",
      },
      {
        t: 10300,
        log: "Client fraud-check scheduled to be closed ASAP for overcoming of output buffer limits.",
        text: "It has stayed above the soft limit for the whole 5 s. Redis closes it, with the same log line as for the hard limit.",
      },
      {
        t: 12500,
        log: "fraud-check re-subscribed, but missed 6 message(s) while away",
        text: "fraud-check reconnects, having missed 6 messages. It's no faster than before.",
      },
      {
        t: 23500,
        log: "Client fraud-check scheduled to be closed ASAP for overcoming of output buffer limits.",
        text: "The same again: over the soft limit at 17.8 s, closed at 23.5 s. It will keep cycling for as long as it is slower than the publisher.",
      },
    ],
    takeaway:
      "The soft limit catches consumers that are steadily too slow, not just stuck. analytics receives the same payments but handles each in 250 ms, so it backs up briefly and then keeps pace.",
    tryNext: [
      "Lower fraud-check's **Time to handle one message** below 380 ms: the buffer drains and the timer resets.",
      "Raise **Soft duration** in Blocks & settings to tolerate a longer burst.",
    ],
  },
  {
    id: "partition",
    setup: "The network link to analytics is cut at 2.5 s and restored at 15 s.",
    moments: [
      {
        t: 2500,
        log: "Network link to analytics cut",
        text: "The link to analytics is cut. No FIN or RST is sent, so neither side knows.",
      },
      {
        t: 5700,
        log: "analytics's output buffer passed the soft limit (8 KB)",
        text: "To Redis this is a slow reader: the TCP window stops opening and the output buffer grows.",
      },
      {
        t: 9100,
        log: "analytics doesn't know it was disconnected (half-open connection)",
        text: "Redis closes the client for exceeding its buffer limit. The FIN can't cross the broken link, so analytics still believes it is subscribed: the connection is half-open.",
      },
      {
        t: 15000,
        log: "Network link to analytics restored",
        text: "The link comes back.",
      },
      {
        t: 15400,
        log: "analytics sees the connection closed",
        text: "The FIN finally arrives. Only now does analytics learn it was dropped, 6 seconds after the fact.",
      },
      {
        t: 17100,
        log: "analytics re-subscribed, but missed 18 message(s) while away",
        text: "It re-subscribes, having missed 18 messages published while it sat on a dead connection.",
      },
    ],
    takeaway:
      "Both sides are wrong for a while. Redis buffers for a peer that's gone, and the subscriber waits on a connection that's dead. TCP keepalive or an application-level `PING` shortens that window.",
    tryNext: [
      "Do the same to email-worker with **Stop reading the socket** instead: from Redis's side it looks identical.",
      "Lower the **Hard limit** and Redis gives up on the dead peer sooner.",
    ],
  },
  {
    id: "oom",
    setup:
      "The **Output buffer limits** block is pulled out, and the host has 40 KB of headroom for client buffers. checkout-api publishes every 300 ms. email-worker stops reading at 1.5 s and never recovers.",
    moments: [
      {
        t: 1500,
        log: "email-worker stopped reading from its socket",
        text: "email-worker gets stuck.",
      },
      {
        t: 2800,
        log: "email-worker isn't reading fast enough",
        text: "Its backlog moves into its output buffer. With no limit configured, nothing will ever close it.",
      },
      {
        t: 13000,
        log: "Out of memory: Killed process 4242 (redis-server)",
        text: "The buffer has used up the host's memory. The kernel's OOM killer stops Redis.",
      },
      {
        t: 13400,
        log: "fraud-check sees the connection closed",
        text: "Every subscriber loses its connection, including the two healthy ones. The publishers get connection errors, and those messages are gone too.",
      },
      {
        t: 16000,
        log: "redis-server is back up, with zero subscriptions",
        text: "Redis restarts with zero subscriptions. Until the clients re-subscribe, `PUBLISH` reaches nobody and returns `0`.",
      },
      {
        t: 16700,
        log: "email-worker re-subscribed, but missed 3 message(s) while away",
        text: "Everyone re-subscribes, including email-worker, which is still stuck.",
      },
      {
        t: 29100,
        log: "Out of memory: Killed process 4242 (redis-server)",
        text: "Its buffer grows again, and Redis is killed a second time.",
      },
    ],
    takeaway:
      "The output buffer limit exists to protect everyone else. Without it, one stuck consumer turns into a full outage, and it repeats as soon as that consumer reconnects.",
    tryNext: [
      "Put the **Output buffer limits** block back: email-worker gets cut off instead, and nobody else notices.",
      "Raise **Host memory headroom** in Blocks & settings: the crash comes later, but it still comes.",
    ],
  },
  {
    id: "restart",
    setup: "Redis crashes at 4 s. A supervisor restarts it 3 s later.",
    moments: [
      {
        t: 4000,
        log: "redis-server crashed",
        text: "Redis crashes. Every connection, every subscription and every output buffer disappears with the process.",
      },
      {
        t: 4300,
        log: "PUBLISH orders failed, Redis is down",
        text: "Both publishers get connection errors. Nothing queues those messages anywhere.",
      },
      {
        t: 4500,
        log: "email-worker sees the connection closed",
        text: "The subscribers see their connections close and start reconnecting.",
      },
      {
        t: 7000,
        log: "redis-server is back up, with zero subscriptions",
        text: "Redis is back, with no subscriptions at all: they were never written to RDB or AOF.",
      },
      {
        t: 7700,
        log: 'PUBLISH orders "order#11" reached 0 subscribers and was discarded',
        text: "The first `PUBLISH orders` after the restart beats the subscribers back and reaches nobody.",
      },
      {
        t: 7700,
        log: "email-worker re-subscribed, but missed 1 message(s) while away",
        text: "The subscribers run `SUBSCRIBE` again, and delivery resumes.",
      },
    ],
    takeaway:
      "Subscriptions are connection state. Recovery depends entirely on each client reconnecting and re-running `SUBSCRIBE`.",
    tryNext: [
      "Pull out **Client auto-reconnect**: after the restart nobody comes back, and every `PUBLISH` returns `0`.",
      "Select redis-server and press **Crash redis-server**, then **Restart now**, at any moment you like.",
    ],
  },
];
