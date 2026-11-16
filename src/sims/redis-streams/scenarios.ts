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
    flow: [
      { at: 0, nodes: ["g:mailers", "g:analytics", "C1", "C2", "C3"], note: "Each consumer's XREADGROUP blocks inside Redis, waiting for entries." },
      { at: 700, nodes: ["P1", "stream"], note: "XADD appends order 1; the reply is its ID, <milliseconds>-<sequence>." },
      { at: 810, nodes: ["stream", "g:mailers", "g:analytics", "C1", "C3"], note: "Each group gets order 1: mailer-1 for mailers, analytics-1 for analytics." },
      { at: 1800, nodes: ["g:mailers", "C1"], note: "mailer-1 XACKs: the entry leaves the mailers PEL." },
      { at: 3000, nodes: ["g:mailers", "C1", "C2"], note: "From here mailer-1 and mailer-2 take turns within the one group." },
    ],
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
    flow: [
      { at: 0, nodes: ["P1", "stream", "g:analytics", "C3"], note: "Follow the analytics group: analytics-1 reads every entry." },
      { at: 3000, nodes: ["stream", "g:analytics"], note: "analytics-1 is offline. Entries keep landing; the group's lag climbs." },
      { at: 11000, nodes: ["g:analytics", "C3"], note: "analytics-1 is back and reads the backlog, COUNT entries at a time, until lag is 0." },
    ],
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
    flow: [
      { at: 0, nodes: ["g:mailers", "C1", "C2"], note: "mailer-1 takes 1.5 s per entry. Watch the mailers group." },
      { at: 4000, nodes: ["P1", "stream", "g:mailers", "C1"], note: "A burst of 10: mailer-1 takes a batch of 4." },
      { at: 7000, nodes: ["g:mailers", "C1"], note: "mailer-1 is gone. Its 4 entries stay in the PEL; watch their idle time grow." },
      { at: 12500, nodes: ["g:mailers", "C2"], note: "Idle passed min-idle-time: mailer-2's XAUTOCLAIM takes them and the delivery count goes to 2." },
    ],
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
    flow: [
      { at: 0, nodes: ["g:mailers", "C1", "C2"], note: "mailer-1 takes 1.2 s per entry. Watch the mailers group." },
      { at: 3500, nodes: ["P1", "stream", "g:mailers", "C1"], note: "A burst of 10: mailer-1 takes a batch of 4." },
      { at: 6500, nodes: ["g:mailers", "C1"], note: "mailer-1 hangs mid-entry. Its connection is fine, so Redis sees nothing unusual." },
      { at: 12500, nodes: ["g:mailers", "C2"], note: "After min-idle-time, mailer-2 XAUTOCLAIMs the entries, processes and XACKs them." },
      { at: 18000, nodes: ["g:mailers", "C1"], note: "mailer-1 wakes and processes the same entries again; its XACK returns 0." },
    ],
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
    flow: [
      { at: 0, nodes: ["P1", "stream", "g:mailers", "C1", "C2"], note: "Follow the mailers group." },
      { at: 2500, nodes: ["P1", "stream"], note: "A malformed order goes into the stream like any other entry." },
      { at: 3500, nodes: ["g:mailers", "C2"], note: "mailer-2 crashes on it. It stays pending, and every restart re-reads it: delivery count +1." },
      { at: 14000, nodes: ["stream", "g:mailers", "C2"], note: "Over the limit: mailer-2 adds it to orders:dead and XACKs the original." },
    ],
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
    flow: [
      { at: 0, nodes: ["P1", "stream", "g:analytics", "C3"], note: "Watch XLEN against MAXLEN 10, and the analytics row under the tape." },
      { at: 2000, nodes: ["stream", "g:analytics"], note: "analytics-1 is down. New entries push the oldest off the left edge." },
      { at: 10500, nodes: ["stream", "g:analytics"], note: "Trimming doesn't wait for groups: unread entries are cut and lag turns nil." },
      { at: 18000, nodes: ["g:analytics", "C3"], note: "analytics-1 resumes at the oldest entry left. The trimmed ones are skipped silently." },
    ],
  },
  {
    id: "noack",
    title: "Without XACK: NOACK and a crash",
    summary:
      "The acknowledgement block is removed: consumers read with NOACK. Nothing is ever pending, which is fine until a consumer crashes while holding entries.",
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
    flow: [
      { at: 0, nodes: ["g:mailers", "C1", "C2"], note: "NOACK: watch the mailers PEL stay empty, even while consumers hold entries." },
      { at: 4000, nodes: ["P1", "stream", "g:mailers", "C1"], note: "A burst of 10: mailer-1 takes a batch of 4, and nothing is recorded as pending." },
      { at: 7000, nodes: ["g:mailers", "C1"], note: "mailer-1 is killed holding 4 entries. Nothing can claim them: they're lost for the mailers group." },
    ],
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
    flow: [
      { at: 0, nodes: ["P1", "stream"], note: "Watch redis-server and checkout-api's XADD replies." },
      { at: 5000, nodes: ["P1", "stream", "C1", "C2", "C3"], note: "Redis is down: XADD fails with ECONNREFUSED, and consumers' XACKs fail too." },
      { at: 8000, nodes: ["stream", "g:mailers", "g:analytics"], note: "Reloaded from the AOF: the stream, both groups and their PELs, including unacked entries." },
      { at: 8700, nodes: ["g:mailers", "C1"], note: "mailer-1 re-reads its pending entries and processes order 5 a second time." },
    ],
  },
];
