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
    id: "happy",
    setup:
      "Defaults. checkout-api runs `XADD orders MAXLEN 40 * …` about every 900 ms. Group `mailers` has two consumers (300 ms per entry), group `analytics` has one (300 ms). Every consumer loops on `XREADGROUP … COUNT 4 BLOCK 5000 STREAMS orders >`.",
    moments: [
      {
        t: 0,
        log: "Stream and consumer groups created",
        text: "Both groups are created with `$`: they start after the stream's current last entry, so neither will see anything older.",
      },
      {
        t: 510,
        log: "mailer-1 is blocked in XREADGROUP",
        text: "The stream is empty, so each consumer's first `XREADGROUP` parks inside Redis. Consumers don't poll; they wait.",
      },
      {
        t: 810,
        log: "XADD orders * appended order 1 as 813-0",
        text: "The first `XADD` arrives. Redis gives it the ID `813-0` (milliseconds, then a sequence number) and replies with it.",
      },
      {
        t: 810,
        log: "mailers: XREADGROUP > gave order 1 to mailer-1",
        text: "The same `XADD` wakes the blocked clients. mailer-1 blocked first, so it gets order 1; mailer-2 stays blocked. analytics-1 also gets order 1, because its group has its own `last-delivered-id`.",
      },
      {
        t: 1880,
        log: "XACK orders mailers 813-0 removed order 1",
        text: "mailer-1 finishes and runs `XACK`. The entry leaves the mailers PEL; the bar under it on the tape turns from pending to acked.",
      },
      {
        text: "From here on mailer-1 and mailer-2 take turns, and every PEL holds only the one or two entries currently being processed.",
      },
    ],
    takeaway:
      "Within a group, consumers split the entries; across groups, each group gets all of them. An entry is pending from delivery until its XACK, and that list is what makes recovery possible.",
    tryNext: [
      "Select mailer-2 and press **Take offline**: mailer-1 does all the work and nothing is skipped.",
      "Lower **COUNT** to 1 in **Blocks & settings** and watch the analytics lag climb: one round trip per entry is too slow in slow motion.",
    ],
  },
  {
    id: "catch-up",
    setup: "analytics-1 goes offline at 3 s (think: a deploy) and comes back at 11 s.",
    moments: [
      {
        t: 3000,
        log: "analytics-1 went offline",
        text: "analytics-1's process stops. Nothing changes inside Redis: the group keeps its `last-delivered-id`, and new entries keep landing in the stream.",
      },
      {
        t: 10500,
        text: "The analytics group's **lag** is 10: ten entries added since its `last-delivered-id`. The mailers carry on as before.",
      },
      {
        t: 11000,
        log: "analytics-1 started",
        text: "analytics-1 starts again, reads its own pending entries (none), then `>` from where the group stopped.",
      },
      {
        t: 20500,
        text: "Reading 4 entries per round trip, it has worked the lag back down to 1. Every order it missed while down was processed.",
      },
    ],
    takeaway:
      "A stream is storage, so a consumer that goes away loses nothing: its group remembers where it was. Compare Pub/Sub, where the same restart is a permanent gap.",
    tryNext: ["Take analytics-1 offline for longer, past **MAXLEN** entries, and see the **MAXLEN trims entries a group never read** scenario happen by hand."],
  },
  {
    id: "dead-consumer",
    setup:
      "mailer-1 is slow (1500 ms per entry). A burst of 10 orders at 4 s gives it a full batch of 4. At 7 s its host disappears and it never comes back.",
    moments: [
      {
        t: 4000,
        log: "checkout-api sent a burst of 10 orders",
        text: "More entries arrive than the blocked consumers asked for, so the next reads return full batches. mailer-1 takes orders 10 to 13.",
      },
      {
        t: 7000,
        log: "mailer-1 went offline",
        text: "mailer-1 is gone with 4 entries pending. Redis doesn't notice anything about the entries: they stay in the PEL, owned by mailer-1, and their idle time grows.",
      },
      {
        t: 12500,
        text: "Their idle time passes `min-idle-time` (6 s). The rows turn red: they are now claimable.",
      },
      {
        t: 13390,
        log: "mailer-2 XAUTOCLAIMed orders 10, 11, 12, 13",
        text: "mailer-2's periodic `XAUTOCLAIM orders mailers mailer-2 6000 0-0 COUNT 10` takes all four. Their owner becomes mailer-2, idle resets, and the delivery count goes to 2.",
      },
    ],
    takeaway:
      "Redis never redelivers on its own. Pending entries of a dead consumer stay put until another consumer claims them, with XAUTOCLAIM or XPENDING + XCLAIM.",
    tryNext: [
      "Pull out the **XAUTOCLAIM loop** block: the four entries stay pending for good, until you **Bring online** mailer-1.",
      "Lower **min-idle-time** and see how much sooner they're rescued.",
    ],
  },
  {
    id: "hung",
    setup:
      "mailer-1 takes 1200 ms per entry. A burst at 3.5 s gives it a batch of 4. At 6.5 s it hangs (keeps its connection, processes nothing); at 18 s it recovers.",
    moments: [
      {
        t: 6500,
        log: "mailer-1 hung",
        text: "mailer-1 stops in the middle of order 10, with 11 to 13 waiting in its local batch. Its connection is fine, so Redis sees nothing unusual.",
      },
      {
        t: 13380,
        log: "mailer-2 XAUTOCLAIMed orders 10, 11, 12, 13",
        text: "After 6 s idle, mailer-2 claims all four, processes them and XACKs them. From Redis's point of view they're done.",
      },
      {
        t: 18000,
        log: "mailer-1 is running again",
        text: "mailer-1 wakes up. It has no idea anything happened and carries on with the batch it was holding.",
      },
      {
        t: 18630,
        log: "mailer-1 processed order 10 a second time",
        text: "Order 10 is processed twice (two emails). Its `XACK` returns `0`: there's nothing left to remove. Orders 11 to 13 follow.",
      },
    ],
    takeaway:
      "Claiming can't tell a dead consumer from a slow one. Consumer groups deliver at least once, so handlers must be idempotent (dedupe on the entry ID), and min-idle-time must be well above your slowest normal processing time.",
    tryNext: ["Raise **min-idle-time** above the hang (say 15 s): no claim, no duplicate, but a longer delay."],
  },
  {
    id: "poison",
    setup: "At 2.5 s checkout-api adds one malformed order. The mailers' email template throws on it; analytics only counts it. Max deliveries is 3.",
    moments: [
      {
        t: 2500,
        log: "checkout-api sent a malformed order",
        text: "Order 4 goes into the stream like any other entry.",
      },
      {
        t: 3590,
        log: "mailer-2 crashed processing order 4",
        text: "mailer-2 gets it and its process exits. Order 4 stays pending in the mailers PEL with delivery count 1. A supervisor restarts mailer-2.",
      },
      {
        t: 6920,
        log: "mailer-2 re-read its pending entries: order 4",
        text: "On start, mailer-2 reads its own history with `XREADGROUP … STREAMS orders 0`. That's how it recovers work it held, and here it hands back the poison entry, delivery count 2.",
      },
      {
        t: 7220,
        log: "mailer-2 crashed processing order 4",
        text: "Crash again. The same thing repeats at 10.8 s with delivery count 3.",
      },
      {
        t: 14450,
        log: "mailer-2 moved order 4 to orders:dead after 3 failed deliveries",
        text: "The fourth delivery is over the limit. Instead of processing it, mailer-2 runs `XADD orders:dead` with the entry and XACKs the original. The loop is broken.",
      },
    ],
    takeaway:
      "A crash-before-XACK keeps the entry pending, which is exactly right for transient failures and exactly wrong for a bad payload. The delivery count is the signal; dead-lettering is application code, not a Redis feature.",
    tryNext: [
      "Pull out the **Dead-letter stream** block: mailer-2 crash-loops for as long as you let it run.",
      "From checkout-api, **XADD a malformed order** while a mailer is down, and see which one it hits.",
    ],
  },
  {
    id: "trim",
    setup: "The stream is capped at `MAXLEN 10`. analytics-1 goes offline at 2 s and comes back at 18 s, while orders keep arriving.",
    moments: [
      {
        t: 2000,
        log: "analytics-1 went offline",
        text: "analytics-1 stops, holding order 2 (pending). The analytics group's position stays at order 2.",
      },
      {
        t: 10500,
        log: "MAXLEN trimmed order 2 while it was still pending",
        text: "The 11th entry pushes order 2 off the left edge. Its ID stays in the analytics PEL (the default `KEEPREF`), but the data is gone.",
      },
      {
        t: 11500,
        log: "MAXLEN trimmed entries the analytics group never read",
        text: "Order 3, never delivered to analytics, is trimmed. Lag turns to **nil**: Redis can no longer tell how many entries the group missed.",
      },
      {
        t: 18780,
        log: "analytics-1 re-read its pending entries: order 2",
        text: "Back online, analytics-1 reads its history and gets order 2's ID with nil fields. It acknowledges it without processing.",
      },
      {
        t: 21000,
        text: "Then `>` resumes at the oldest entry still in the stream, order 13. Orders 3 to 12 were trimmed unread: 10 entries the analytics group never saw, and no error anywhere.",
      },
    ],
    takeaway:
      "Trimming is about memory, not consumers. Size MAXLEN (or MINID) for the longest outage a group must survive, alert on lag, or, on Redis 8.2+, trim with `ACKED` so entries are kept until every group has acknowledged them.",
    tryNext: ["Pull out **MAXLEN trimming** and rerun: nothing is lost, and XLEN keeps growing instead."],
  },
  {
    id: "noack",
    setup:
      "The **XACK and the PEL** block is removed: consumers read with `XREADGROUP … NOACK`. mailer-1 is slow (1500 ms), a burst at 4 s gives it a batch, and at 7 s it is killed.",
    moments: [
      {
        text: "Both PELs stay empty the whole time. With NOACK, an entry counts as acknowledged the moment it's delivered.",
      },
      {
        t: 7000,
        log: "mailer-1 was killed",
        text: "mailer-1 dies holding orders 10, 11, 12 and 13. Redis has no record that they were in flight, so nothing can claim them: they are lost for the mailers group.",
      },
      {
        t: 9500,
        text: "mailer-1 restarts, finds nothing pending, and carries on with new entries. The four orders are never emailed. (analytics, a separate group, still processed them.)",
      },
    ],
    takeaway: "NOACK turns a consumer group into at-most-once delivery, meant for when occasional loss is acceptable: a crash silently drops whatever the consumer held.",
    tryNext: ["Put the block back and rerun: the same crash leaves four pending entries that mailer-1 re-reads on restart."],
  },
  {
    id: "restart",
    setup: "redis-server crashes at 5 s and a supervisor restarts it 3 s later. It runs with `appendonly yes`.",
    moments: [
      {
        t: 5000,
        log: "redis-server crashed",
        text: "Every connection drops. Consumers keep processing the entries they already hold, but their XACKs fail.",
      },
      {
        t: 5000,
        log: "checkout-api: XADD order 6 failed, Redis is down",
        text: "XADDs during the outage fail with `ECONNREFUSED`. Unless the producer retries, those orders never exist.",
      },
      {
        t: 8000,
        log: "redis-server is back: the stream and both groups were reloaded from the AOF",
        text: "Redis replays the AOF: the stream, each group's `last-delivered-id` and its PEL are back, including the entries whose XACK was lost.",
      },
      {
        t: 8740,
        log: "mailer-1 re-read its pending entries: order 5",
        text: "Consumers reconnect and read their own pending entries first. mailer-1 gets order 5 back, though it already processed it.",
      },
      {
        t: 9040,
        log: "mailer-1 processed order 5 a second time",
        text: "Order 5 is processed again; this XACK is the one that finally removes it. analytics-1 does the same with order 4.",
      },
    ],
    takeaway:
      "Unlike Pub/Sub subscriptions, a stream and its consumer groups are data, so they survive a restart. What doesn't survive is anything only on the wire: XADDs (producer must retry) and XACKs (so entries come back as duplicates).",
    tryNext: ["Select the stream and **Crash redis-server** yourself while a mailer holds a big batch (send a **Burst of 10** first)."],
  },
];
