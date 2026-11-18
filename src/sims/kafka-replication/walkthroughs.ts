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
      "Defaults: three replicas, `acks=all`, `min.insync.replicas=1`. The producer sends a record every 0.6 s; a network hop takes 0.25 s.",
    moments: [
      { t: 0, log: "three replicas, broker-1 leads", text: "broker-1 leads `orders-0`. broker-2 and broker-3 each send it a Fetch and wait for data." },
      {
        t: 950,
        log: "the high watermark moves to 1",
        text: "r1 reached the leader, went out to both followers in their fetch responses, and their next fetches (offset 1) told the leader they have it. The high watermark moves to 1 and the producer gets its ack.",
      },
      { text: "From then on every record follows the same path. On the tapes, a record turns solid once it is below that replica's HW; followers learn the HW from the leader's fetch responses, so theirs trails a little." },
    ],
    takeaway:
      "Replication is pull: the leader only knows a follower has a record when the follower asks for the next one. acks=all therefore costs about two round trips after the leader's append.",
    tryNext: [
      "Select the producer and switch **acks** to `acks=1`: acks come back about one round trip sooner, but the tape shows they are acked before they are committed.",
      "In Blocks & settings, raise **Network hop** and watch the dashed (uncommitted) tail of the leader's log grow.",
    ],
  },
  {
    id: "slow-follower",
    setup: "Defaults. broker-3's replica fetcher stalls from 4 s to 16 s. It keeps heartbeating, so the controller sees a healthy broker.",
    moments: [
      { t: 4000, log: "broker-3's replica fetcher stalls", text: "broker-3 stops fetching. It is still in the ISR." },
      {
        t: 5600,
        log: "acks=all writes are waiting for broker-3",
        text: "The high watermark can't pass what broker-3 has, so `acks=all` writes pile up in the leader's purgatory and the producer's in-flight count fills up.",
      },
      {
        t: 10000,
        log: "Shrinking ISR from 1,2,3 to 1,2",
        text: "broker-3 hasn't caught up for `replica.lag.time.max.ms` (5 s here). The leader drops it from the ISR; the high watermark jumps forward and the waiting writes are acknowledged together.",
      },
      { t: 16000, log: "broker-3's replica fetcher runs again", text: "broker-3 fetches from where its log ends, five records at a time." },
      { t: 18750, log: "broker-3 caught up and rejoins the ISR", text: "Its log end offset reaches the high watermark, so the leader adds it back to the ISR." },
    ],
    takeaway:
      "The ISR is what keeps one slow replica from stopping every write: the leader waits for it only for replica.lag.time.max.ms. The cost is a window where the data has one copy fewer.",
    tryNext: [
      "In Blocks & settings, remove **ISR shrinking** and replay: the writes wait until `request.timeout.ms` and the producer starts resending.",
      "Lower **replica.lag.time.max.ms** to 2000 ms and see the ISR shrink sooner.",
    ],
  },
  {
    id: "acks1-loss",
    setup:
      "`acks=1`. Both followers' fetchers stall from 5 s to 10.5 s, broker-1 (the leader) crashes at 8 s and restarts at 18 s.",
    moments: [
      { t: 5000, log: "broker-2's replica fetcher stalls", text: "New records now exist only on broker-1, and `acks=1` acknowledges each one anyway." },
      { t: 8000, log: "broker-1 crashed", text: "The leader dies, taking the newest records with it." },
      { t: 8500, log: "The producer can't reach broker-1", text: "The producer retries. Its metadata still names broker-1 until the controller acts." },
      {
        t: 10700,
        log: "broker-2 is the new leader",
        text: "No heartbeat for `broker.session.timeout.ms` (3 s here): the controller fences broker-1 and elects broker-2 from the ISR. A clean election.",
      },
      {
        t: 10700,
        log: "4 acknowledged records are not on broker-2: lost",
        text: "**4 records the producer was told are written are not on the new leader.** The producer's list marks them lost.",
      },
      {
        t: 18500,
        log: "broker-1 truncates its log to offset 9",
        text: "broker-1 returns as a follower. Its records from epoch 1 past offset 9 don't match broker-2's log, so it deletes them: the last copies are gone.",
      },
    ],
    takeaway: "With acks=1 an acknowledgement means one copy. A clean failover to a perfectly healthy in-sync replica still loses whatever only the old leader had.",
    tryNext: ["Select the producer and replay with **acks** at `acks=all`: that is the next scenario.", "Select broker-1 while it is down: its tape still holds the records the new leader lacks."],
  },
  {
    id: "acks-all",
    setup: "The same failures as the previous scenario, with `acks=all` (the default).",
    moments: [
      {
        t: 6800,
        log: "acks=all writes are waiting for broker-2 and broker-3",
        text: "The followers stopped fetching, so the high watermark stops and the leader holds back the acknowledgements.",
      },
      { t: 8000, log: "broker-1 crashed", text: "The leader dies. The writes it was holding fail at the producer as a disconnection and go back into its buffer." },
      { t: 10700, log: "broker-2 is the new leader", text: "broker-2 is elected from the ISR, as before." },
      {
        t: 11850,
        log: "Writes succeed again",
        text: "The producer resends its unacknowledged records to broker-2. One of them was already on broker-2; the idempotent producer doesn't write it twice.",
      },
      {
        t: 18500,
        log: "broker-1 truncates its log to offset 9",
        text: "broker-1 deletes 4 records again, but this time none of them was ever acknowledged. **lost stays at 0.**",
      },
    ],
    takeaway:
      "acks=all trades latency for a promise: an acknowledged record is on every in-sync replica. Records that weren't committed are retried, not lost.",
    tryNext: [
      "In Blocks & settings, remove **Idempotent producer** and watch for duplicates on the producer card.",
      "Remove **Producer retries**: the records the crash interrupted fail instead of being resent.",
    ],
  },
  {
    id: "min-isr",
    setup: "`min.insync.replicas=2`, `acks=all`. broker-3 crashes at 4 s, broker-2 at 11 s; broker-2 restarts at 19 s.",
    moments: [
      { t: 7000, log: "Controller fences broker-3", text: "broker-3 is out of the ISR: 1,2. Two replicas, enough for `min.insync.replicas=2`." },
      { t: 13500, log: "Controller fences broker-2", text: "Now the ISR is just broker-1." },
      {
        t: 13500,
        log: "High watermark stuck at 18",
        text: "The high watermark no longer moves: the writes broker-1 appended since broker-2 died stay uncommitted.",
      },
      {
        t: 13650,
        log: "broker-1 rejects r23: NOT_ENOUGH_REPLICAS",
        text: "New `acks=all` writes are refused before they are appended (error 19). The producer keeps retrying.",
      },
      { t: 19250, log: "broker-2 caught up and rejoins the ISR", text: "broker-2 is back, already had most of the log, and catches up at once." },
      { t: 20000, log: "Writes succeed again", text: "The waiting writes are committed and acknowledged, and new ones are accepted." },
    ],
    takeaway:
      "min.insync.replicas turns 'the ISR shrank to one broker' from a silent risk into a visible outage for writers. Nothing is acknowledged that only one broker has.",
    tryNext: [
      "Select the producer while writes are refused and switch **acks** to `acks=1`: the writes are acknowledged, but the leader's HW stays put, so consumers see nothing new.",
      "Replay with **min.insync.replicas** at 1 in Blocks & settings: writes never stop, and every record in that window has one copy.",
    ],
  },
  {
    id: "offline",
    setup: "Defaults (`min.insync.replicas=1`, `unclean.leader.election.enable=false`). Both followers stall from 3 s to 14 s; broker-1 crashes at 13 s and restarts at 21 s.",
    moments: [
      {
        t: 10000,
        log: "Shrinking ISR from 1,2,3 to 1",
        text: "The leader drops both followers. With `min.insync.replicas=1` the leader alone is enough, so `acks=all` writes keep being acknowledged with one copy.",
      },
      { t: 13000, log: "broker-1 crashed", text: "The only in-sync replica dies." },
      {
        t: 15400,
        log: "orders-0 is offline: no in-sync replica is alive",
        text: "The controller fences broker-1. Nobody in the ISR or ELR is alive and unclean election is off, so the partition has no leader. The producer can't write.",
      },
      {
        t: 21000,
        log: "broker-1 is the new leader of orders-0 (epoch 2)",
        text: "broker-1 registers again. It was kept as an Eligible Leader Replica, so it is elected with every acknowledged record.",
      },
      { t: 26750, log: "broker-3 caught up and rejoins the ISR", text: "The followers catch up and the ISR is whole again." },
    ],
    takeaway: "With unclean election off, Kafka waits for a replica that has every committed record. Nothing acknowledged is lost, at the cost of an outage.",
    tryNext: [
      "During the outage, select the controller and press **Force an unclean election**.",
      "Replay with **min.insync.replicas** at 2: writes stop at 10 s instead, before any of them has only one copy.",
    ],
  },
  {
    id: "unclean",
    setup: "The same as the previous scenario, with `unclean.leader.election.enable=true`.",
    moments: [
      { t: 10000, log: "Shrinking ISR from 1,2,3 to 1", text: "As before: the ISR is just broker-1, and it keeps acknowledging records only it has." },
      {
        t: 15400,
        log: "Unclean election: broker-2 becomes leader (epoch 2) without being in sync",
        text: "When broker-1 is fenced, the controller picks broker-2 although it stopped fetching at 3 s, and forces the ISR to just broker-2.",
      },
      { t: 15400, log: "16 acknowledged records are not on broker-2: lost", text: "**16 acknowledged records are gone from the partition's point of view.**" },
      { t: 17400, log: "Writes succeed again", text: "The partition is writable again two seconds after the crash; new records start at offset 5." },
      {
        t: 21500,
        log: "broker-1 truncates its log to offset 5",
        text: "broker-1 comes back as a follower and truncates its log to broker-2's, deleting the last copies of those 16 records.",
      },
    ],
    takeaway: "Unclean election buys availability with acknowledged data. Offsets after the divergence point now mean different records than they did before the crash.",
    tryNext: [
      "Compare the tapes after 21.5 s with the previous scenario: same offsets, different record numbers and epoch colours.",
      "Replay with **min.insync.replicas** at 2: writes stop at 10 s instead, and broker-2 is elected as an Eligible Leader Replica (a clean election), so nothing acknowledged is lost.",
    ],
  },
];
