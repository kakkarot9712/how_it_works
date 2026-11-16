import type { Scenario } from "@/sims/types";
import type { Action, Components, Settings } from "./model";

export const scenarios: Scenario<Action, Settings, Components>[] = [
  {
    id: "happy",
    title: "Consumer groups: the happy path",
    summary:
      "checkout-api appends orders to the stream. Two mailers share the work in one group; analytics reads every entry in its own group. Each entry is pending until its consumer XACKs it.",
    watchFor: [
      "XADD replies with the new entry's ID: <milliseconds>-<sequence>.",
      "mailer-1 and mailer-2 take turns; analytics-1 gets every order.",
      "Rows appear in each group's PEL on delivery and disappear on XACK.",
    ],
    script: [],
  },
  {
    id: "catch-up",
    title: "A consumer is down, then catches up",
    summary:
      "analytics-1 is redeployed. Unlike Pub/Sub, nothing is lost: the entries wait in the stream, and the group's last-delivered-id remembers where it stopped.",
    watchFor: [
      "The analytics group's lag climbs while analytics-1 is offline.",
      "On return it reads the backlog, COUNT entries at a time, until lag is back to 0.",
    ],
    script: [
      { at: 3000, action: { type: "stop-consumer", consumer: "C3" } },
      { at: 11000, action: { type: "start-consumer", consumer: "C3" } },
    ],
    select: "g:analytics",
  },
  {
    id: "dead-consumer",
    title: "A consumer dies: XAUTOCLAIM rescues its entries",
    summary:
      "mailer-1 is slow, so it holds a batch of entries. Then its host disappears. Its entries stay pending in the PEL, owned by a consumer that will never come back, until mailer-2 claims them.",
    watchFor: [
      "mailer-1's rows in the mailers PEL stop changing, and their idle time grows.",
      "Once idle passes min-idle-time, mailer-2's XAUTOCLAIM takes them over and the delivery count goes to 2.",
    ],
    script: [
      { at: 0, action: { type: "set-process-ms", consumer: "C1", ms: 1500 } },
      { at: 4000, action: { type: "burst", prod: "P1", n: 10 } },
      { at: 7000, action: { type: "stop-consumer", consumer: "C1" } },
    ],
    select: "g:mailers",
  },
  {
    id: "hung",
    title: "A hung consumer wakes up: duplicate processing",
    summary:
      "mailer-1 hangs while holding entries. They are claimed and processed by mailer-2. When mailer-1 recovers it finishes the same entries again. At-least-once means duplicates.",
    watchFor: [
      "mailer-2 XAUTOCLAIMs the hung consumer's entries after min-idle-time.",
      "When mailer-1 resumes, it processes them a second time and its XACK finds nothing to remove.",
    ],
    script: [
      { at: 0, action: { type: "set-process-ms", consumer: "C1", ms: 1200 } },
      { at: 3500, action: { type: "burst", prod: "P1", n: 10 } },
      { at: 6500, action: { type: "set-hung", consumer: "C1", on: true } },
      { at: 18000, action: { type: "set-hung", consumer: "C1", on: false } },
    ],
    select: "C1",
  },
  {
    id: "poison",
    title: "A poison entry and the dead-letter stream",
    summary:
      "One malformed order crashes whichever mailer processes it. The entry stays pending, so the restarted mailer gets it again and crashes again. The delivery count breaks the loop.",
    watchFor: [
      "The poison entry's delivery count rises with every crash.",
      "Past the limit, the mailer moves it to orders:dead and XACKs it instead of processing it.",
      "analytics-1 counts the same order without trouble.",
    ],
    script: [{ at: 2500, action: { type: "xadd", prod: "P1", poison: true } }],
    select: "g:mailers",
  },
  {
    id: "trim",
    title: "MAXLEN trims entries a group never read",
    summary:
      "The stream is capped at MAXLEN 10. analytics-1 is down for 16 seconds. Trimming doesn't wait for consumer groups, so the oldest unread entries are cut before analytics gets back.",
    watchFor: [
      "The analytics group's unread entries reach the left edge of the stream and are trimmed.",
      "Its lag shows nil: XINFO GROUPS can't compute it once unread entries were deleted.",
      "On return, analytics-1 resumes at the oldest entry still there. The gap is silent.",
    ],
    settings: { maxLen: 10 },
    script: [
      { at: 2000, action: { type: "stop-consumer", consumer: "C3" } },
      { at: 18000, action: { type: "start-consumer", consumer: "C3" } },
    ],
    select: "g:analytics",
  },
  {
    id: "noack",
    title: "Without XACK: NOACK and a crash",
    summary:
      "The acknowledgement block is removed: consumers read with NOACK. Nothing is ever pending, which is simpler and faster, until a consumer crashes while holding entries.",
    watchFor: [
      "The PEL stays empty the whole time.",
      "When mailer-1 is killed, the entries it held are lost for the mailers group. Nothing can claim them.",
    ],
    components: { ack: false },
    script: [
      { at: 0, action: { type: "set-process-ms", consumer: "C1", ms: 1500 } },
      { at: 4000, action: { type: "burst", prod: "P1", n: 10 } },
      { at: 7000, action: { type: "crash-consumer", consumer: "C1" } },
    ],
    select: "C1",
  },
  {
    id: "restart",
    title: "Redis restarts: the stream survives",
    summary:
      "redis-server crashes and comes back. Unlike Pub/Sub subscriptions, the stream and the consumer groups are data, reloaded from the AOF. XADDs and XACKs sent during the outage are lost.",
    watchFor: [
      "XADD fails with ECONNREFUSED while Redis is down: the producer must retry.",
      "Consumers finish the entries they hold, but the XACKs fail, so those entries are processed again after reconnecting.",
    ],
    script: [{ at: 5000, action: { type: "crash-server" } }],
    select: "stream",
  },
];
