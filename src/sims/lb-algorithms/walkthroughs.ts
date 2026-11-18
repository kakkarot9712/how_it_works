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
    id: "even",
    setup:
      "Defaults. A request arrives about every 0.38 s (random gaps), each about 0.6 s of work. Three equal servers with 2 workers each, all `weight=1`.",
    moments: [
      {
        t: 0,
        log: "Four nginx upstream groups get the same requests at the same moments",
        text: "Each request is copied to four nginx groups at the same instant. Each group has its own api-1, api-2 and api-3; only the balancing method differs.",
      },
      {
        text: "Round robin goes api-1, api-2, api-3 in strict order. `least_conn` and `random two` show the active counts they compared; with this little load they are usually all 0 or 1.",
      },
    ],
    takeaway:
      "When requests are uniform and servers are equal, every method does about as well. The methods only differ once requests or servers stop being alike.",
    tryNext: [
      "Select clients and press **Send 3 heavy requests**, then watch where each group puts them.",
      "In Blocks & settings, drag **Average gap between requests** down to load the servers harder.",
    ],
  },
  {
    id: "heavy",
    setup:
      "15% of requests are heavy (8× the work, 4.8 s). A request arrives about every 0.55 s. `proxy_read_timeout` is 20 s so no heavy request times out.",
    moments: [
      {
        t: 900,
        log: "Request #2 is heavy",
        text: "The first heavy request reaches all four groups. Each puts it on one server, where it occupies a worker for 4.8 s.",
      },
      {
        t: 6000,
        log: "random: #10 waits behind heavy #2 on api-1",
        text: "`random` sends a normal request to a server whose workers are busy, one with a heavy request. It waits in the queue.",
      },
      {
        t: 7000,
        log: "round robin: #12 waits behind heavy #3 on api-3",
        text: "Round robin does the same: it was api-3's turn.",
      },
      {
        t: 22200,
        log: "least_conn: #47 waits behind heavy #36 on api-3",
        text: "`least_conn` holds out much longer. It only queues a request behind a heavy one when every server is busy.",
      },
      {
        text: "By the end, p95 of normal requests (the time 95 in 100 of them beat) is about 1.1 s in the `least_conn` group, 1.5 s for `random two`, 2.0 s for round robin and 3.6 s for `random`. The medians are all about 1.0 s.",
      },
    ],
    takeaway:
      "Counting active connections keeps quick requests away from servers stuck on slow ones. The median hides it; the tail shows it.",
    tryNext: [
      "Raise **Heavy request work** to 15× in Blocks & settings and compare p95 again.",
      "Set **Workers per server** to 1: one heavy request then blocks a whole server.",
    ],
  },
  {
    id: "slow-server",
    setup: "At 3 s api-2 drops to ×0.25 speed in every group: a normal request now takes 2.4 s there. `proxy_read_timeout` is 20 s.",
    moments: [
      {
        t: 3000,
        log: "api-2 now runs at ×0.25 speed in every group",
        text: "api-2 slows down. Nothing tells nginx; each group only sees what its own counters show.",
      },
      {
        t: 7100,
        log: "random: 4 requests wait in api-2's queue",
        text: "`random` keeps sending api-2 about a third of the requests, more than it can handle. Its queue grows.",
      },
      {
        t: 9500,
        log: "round robin: 4 requests wait in api-2's queue",
        text: "Round robin too: api-2 gets every third request, however long its queue.",
      },
      {
        text: "In the `least_conn` and `random two` groups api-2's open requests keep its count high, so it gets far fewer new requests (19 and 20 by the end, against 30 and 29) and its queue stays short. p95 ends near 3 s there, against 9 to 12 s for round robin and `random`.",
      },
    ],
    takeaway:
      "No method measures speed, but a slow server holds its connections longer, and the connection-counting methods react to that.",
    tryNext: [
      "Select api-2 and drag **Speed** back to 1×: watch the queues drain.",
      "Set api-2's **Speed** to 0.5× instead and see how much smaller the gap between methods gets.",
    ],
  },
  {
    id: "weights",
    setup:
      "api-3 runs at ×3 speed and has `weight=3`; api-1 and api-2 have `weight=1`. Each server has 1 worker. A request arrives about every 0.2 s.",
    moments: [
      {
        t: 0,
        log: "api-3 now runs at ×3 speed in every group",
        text: "api-3 is the big machine. Round robin's weighted turns go api-3, api-1, api-3, api-2, api-3: three in five to api-3.",
      },
      {
        t: 1800,
        log: "random: 2 requests wait in api-1's queue",
        text: "`random` follows the weights only on average; a short run of picks can queue on a small server.",
      },
      {
        text: "By the end round robin, `least_conn` and `random two` have sent api-3 about three times as many requests as each small server, and their p95 is about 1.3 to 1.5 s. `random`'s p95 is about 2.9 s.",
      },
    ],
    takeaway:
      "Weights tell nginx about capacity it can't see. With them, round robin does as well as `least_conn` here, because the servers never change.",
    tryNext: [
      "Remove the **Server weights** block: round robin splits evenly, the small servers queue, and its p95 rises to about 3.7 s while `least_conn` stays under 2 s.",
    ],
  },
  {
    id: "crash",
    setup: "Defaults with `max_fails=1` and `fail_timeout=5s` (scaled). api-2 crashes at 5 s and restarts at 18 s.",
    moments: [
      {
        t: 5000,
        log: "api-2 crashed in every group",
        text: "api-2's process is gone. Requests already there are reset, and new connection attempts get RST.",
      },
      {
        t: 5200,
        log: "round robin: api-2 temporarily disabled",
        text: "One failed attempt reaches `max_fails=1`. nginx passes the request to the next server and stops picking api-2 for `fail_timeout`. The other groups do the same within a fraction of a second.",
      },
      {
        text: "Every 5 s each group sends one live request to api-2 as a probe. While it is down the probe fails, is retried elsewhere, and api-2 stays disabled.",
      },
      {
        t: 18000,
        log: "api-2 is running again",
        text: "api-2 is back, but nginx doesn't know until its next probe.",
      },
      {
        t: 22600,
        log: "round robin: api-2 answered a probe and is back in rotation",
        text: "The probe succeeds, the failure count resets, and api-2 rejoins the rotation. The other groups follow by 24.8 s.",
      },
    ],
    takeaway:
      "With retries and passive health checks, a crashed server costs a few retried requests per group and no client errors.",
    tryNext: [
      "Remove the **Retry on the next server** block and replay: each failed attempt now reaches the client as a 502.",
      "Remove **Passive health checks** instead, then see the next scenario.",
    ],
  },
  {
    id: "black-hole",
    setup: "The **Passive health checks** block is removed (`max_fails=0`). api-2 crashes at 4 s and stays down.",
    moments: [
      {
        t: 4000,
        log: "api-2 crashed in every group",
        text: "api-2 refuses every connection from now on. Without failure accounting, no group ever skips it.",
      },
      {
        t: 4600,
        log: "least_conn: api-2 refused #12, and stays in rotation",
        text: "Each refusal comes back within one round trip and ends that connection, so api-2's active count stays near 0.",
      },
      {
        text: "To `least_conn` the dead server looks like the idlest one: by 30 s it has sent api-2 51 attempts and retried 46 times, against 26 retries for round robin, which only sends it every third request. `random two` is in between with 36.",
      },
    ],
    takeaway:
      "A server that fails fast looks idle to a method that counts connections. Failure accounting (`max_fails`) is what stops it.",
    tryNext: ["Put the **Passive health checks** block back and replay: one refusal disables api-2 in every group."],
  },
  {
    id: "hang",
    setup: "`proxy_read_timeout` is 6 s (scaled from the 60s default). At 4 s api-3 stops responding but keeps accepting connections; at 20 s it recovers.",
    moments: [
      {
        t: 4000,
        log: "api-3 stops responding",
        text: "Requests sent to api-3 just wait. Each one stays an active connection.",
      },
      {
        t: 6500,
        log: "round robin: 4 requests wait in api-3's queue",
        text: "Round robin keeps giving api-3 its turn: its queue grows.",
      },
      {
        text: "`least_conn` and `random two` see api-3's count climb and send their new requests elsewhere.",
      },
      {
        t: 9800,
        log: "least_conn: upstream timed out on api-3",
        text: "The first stuck request reaches `proxy_read_timeout`. It counts as a failed attempt, api-3 is disabled, and the request is passed to the next server. The other groups follow within 0.4 s.",
      },
      {
        t: 20000,
        log: "api-3 responds again",
        text: "api-3 recovers and is probed back into rotation, first by `random two` and `least_conn`.",
      },
      {
        text: "Round robin retried 9 requests and `random` 6, against 3 each for `least_conn` and `random two`; p95 ends near 7 s for the first two and 3 to 4.7 s for the others.",
      },
    ],
    takeaway:
      "A hung server is caught by the timeout, which is slow. Counting connections limits the damage before the timeout fires.",
    tryNext: ["Lower **proxy_read_timeout** in Blocks & settings and replay: the hung server is found sooner, at the risk of timing out slow but healthy requests."],
  },
];
