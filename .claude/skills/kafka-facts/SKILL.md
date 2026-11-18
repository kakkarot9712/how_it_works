---
name: kafka-facts
description: Verified, sourced facts about Apache Kafka 4.4 for syswork's Kafka modules - replication (leader/follower fetch, ISR, high watermark, acks, min.insync.replicas, unclean election, ELR, leader epochs), producer and broker config names and defaults, protocol fields, error codes and exact log lines, each with its official URL and a quote. Use before writing any Kafka claim (model narration, scenario, inspector text, write-up, glossary brief), when adding a Kafka sim (produce & replicate, consumer groups), and when a Kafka fact isn't in here yet (research it, then add it here).
---

# Kafka facts (4.4)

Every line here was read on the official page named next to it (`source-facts` skill rules). Use these as the module's `sources.ts` references and copy names verbatim. **If a fact you need is not here, research it on an official page, then add it here** with the URL and a short quote, so the next module doesn't redo the work. Anything marked *not verified* must not ship as a claim.

## Version

- Latest release: **4.4.0, released October 22, 2026**. Supported: 4.4.0, 4.3.2, 4.2.2. <https://kafka.apache.org/community/downloads/>
- Docs for a release live under `https://kafka.apache.org/44/…` (`44` = 4.4). The site is Hugo; `/44/documentation/` is a redirect stub. Useful pages:

| id (suggested) | Page | URL |
| --- | --- | --- |
| `design` | Design (persistence, producer, consumer, delivery semantics, **Replication**, unclean election, availability & durability) | `https://kafka.apache.org/44/design/design/` |
| `intro` | Introduction (topics, partitions, replication factor 3) | `https://kafka.apache.org/44/getting-started/introduction/` |
| `producer-configs` | Producer configs | `https://kafka.apache.org/44/configuration/producer-configs/` |
| `topic-configs` | Topic configs | `https://kafka.apache.org/44/configuration/topic-configs/` |
| `broker-configs` | Broker configs | `https://kafka.apache.org/44/configuration/broker-configs/` |
| `protocol` | Protocol (API schemas, error codes) | `https://kafka.apache.org/44/design/protocol/` |
| `elr` | Eligible Leader Replicas | `https://kafka.apache.org/44/operations/eligible-leader-replicas/` |
| `partition-scala` | `Partition.scala` at tag 4.4.0 | `https://github.com/apache/kafka/blob/4.4.0/core/src/main/scala/kafka/cluster/Partition.scala` |
| `kip-966` | KIP-966: Eligible Leader Replicas | `https://cwiki.apache.org/confluence/display/KAFKA/KIP-966%3A+Eligible+Leader+Replicas` |
| `kip-101` | KIP-101: leader epoch for truncation | `https://cwiki.apache.org/confluence/display/KAFKA/KIP-101+-+Alter+Replication+Protocol+to+use+Leader+Epoch+rather+than+High+Watermark+for+Truncation` |
| `kip-index` | Kafka Improvement Proposals (the KIP process: "proposing a major change to Kafka", vote by lazy majority, open ≥ 72 hours) | `https://cwiki.apache.org/confluence/display/KAFKA/Kafka+Improvement+Proposals` |
| `downloads` | Downloads (release dates) | `https://kafka.apache.org/community/downloads/` |
| `pcb-java` | `PartitionChangeBuilder.java` at tag 4.4.0 (leader election) | `https://github.com/apache/kafka/blob/4.4.0/metadata/src/main/java/org/apache/kafka/controller/PartitionChangeBuilder.java` |
| `rcm-java` | `ReplicationControlManager.java` at tag 4.4.0 (fencing, ISR/leader updates) | `https://github.com/apache/kafka/blob/4.4.0/metadata/src/main/java/org/apache/kafka/controller/ReplicationControlManager.java` |

`officialSources` for a Kafka module: `https://kafka.apache.org/`, `https://github.com/apache/kafka/`, `https://cwiki.apache.org/confluence/display/KAFKA/`.

Fetching tips: pages are big single-line HTML. `curl -sL <url>` then strip tags with Python and search the text; raw source at `https://raw.githubusercontent.com/apache/kafka/4.4.0/<path>`. The GitHub API search is unreliable from here; grep downloaded files instead.

## Replication (design)

- "Kafka replicates the log for each topic's partitions across a configurable number of servers (you can set this replication factor on a topic-by-topic basis)." "The unit of replication is the topic partition." [design]
- "each partition in Kafka has a single leader and zero or more followers. The total number of replicas including the leader constitute the replication factor. All writes go to the leader of the partition" [design]
- "Followers consume messages from the leader just as a normal Kafka consumer would and apply them to their own log. Having the followers pull from the leader has the nice property of allowing the follower to naturally batch together log entries" [design]
- Liveness: "a special node known as the 'controller' is responsible for managing the registration of brokers". Two conditions: an active session with the controller, and followers "must replicate the writes from the leader and not fall 'too far' behind". KRaft: "an active session is maintained by sending periodic heartbeats to the controller. If the controller fails to receive a heartbeat before the timeout configured by broker.session.timeout.ms expires, then the node is considered offline." [design]
- "The leader keeps track of the set of 'in sync' replicas, which is known as the ISR." A dead follower: "the controller will notice the failure through the loss of its session, and will remove the broker from the ISR". A lagging follower with an active session: "the leader can also remove it from the ISR". "Replicas that cannot catch up to the end of the log on the leader within the max time set by [replica.lag.time.max.ms] are removed from the ISR." [design]
- "Only committed messages are ever given out to the consumer." "A write to a Kafka partition is not considered committed until all in-sync replicas have received the write." "Only members of this set are eligible for election as leader." "This ISR set is persisted in the cluster metadata whenever it changes." [design]
- "With this ISR model and f+1 replicas, a Kafka topic can tolerate f failures without losing committed messages." Majority quorum vs ISR: "to survive one failure a majority quorum needs three replicas and one acknowledgement and the ISR approach requires two replicas and one acknowledgement". [design]
- "The guarantee that Kafka offers is that a committed message will not be lost, as long as there is at least one in sync replica alive, at all times." [design]
- Rejoining: "before rejoining, it must fully re-sync again even if it lost unflushed data in its crash." Kafka does not want "fsync on every write". [design]
- Visibility: "Regardless of the acks setting, the messages will not be visible to the consumers until all the following conditions are met: The messages are replicated to all the in-sync replicas. The number of the in-sync replicas is no less than the min.insync.replicas setting." [design]; same in the topic config for `min.insync.replicas`. [topic-configs]
- acks=all and a shrunken ISR: "when acks=all, acknowledgement happens as soon as all the current in-sync replicas have received the message. For example, if a topic is configured with only two replicas and one fails (i.e., only one in sync replica remains), then writes that specify acks=all will succeed. However, these writes could be lost if the remaining replica also fails." [design]
- Minimum ISR: "the partition will only accept writes if the size of the ISR is above a certain minimum … This setting only takes effect if the producer uses acks=all". Higher value: better consistency, but "the partition will be unavailable for writes if the number of in-sync replicas drops below the minimum threshold." [design]
- Unclean election: if all replicas die, either "Wait for a replica in the ISR to come back to life" or "Choose the first replica (not necessarily in the ISR) that comes back to life as the leader". "By default from version 0.11.0.0, Kafka chooses the first strategy". Non-ISR leader: "its log becomes the source of truth even though it is not guaranteed to have every committed message." [design]
- Leadership balance: "we try to balance leadership so that each node is the leader for a proportional share of its partitions." [design]
- Producer routing: "The producer sends data directly to the broker that is the leader for the partition without any intervening routing tier." Keys: "specify a key to partition by and using this to hash to a partition". Batching: accumulate "no more than a fixed number of messages and to wait no longer than some fixed latency bound (say 64kB or 10 ms)". [design]
- Consumers: "issuing 'fetch' requests to the brokers leading the partitions"; position "is just a single integer, the offset of the next message to consume." [design]
- Intro: "A common production setting is a replication factor of 3". [intro]

## High watermark and ISR (Partition.scala, 4.4.0)

- HW: "determined by the smallest log end offset among all replicas that are in sync; or are considered caught-up and are allowed to join the ISR." Uses the "maximal" ISR (KIP-497: pending additions count). (`maybeIncrementLeaderHW`)
- **"The HW can only advance if the ISR size is equal or large than the min ISR(min.insync.replicas)."** Code: `if (isUnderMinIsr) { … return false }`. Applies to acks=0/1 writes too (KIP-966: "It applies to the ack=0/1 message replication as well. Note that the leader still acknowledges the client requests when the ack=1 messages have persisted in the leader log.").
- Effective min ISR = `min(min.insync.replicas, replication factor)` (`effectiveMinIsr`).
- Produce with acks=-1 and ISR < min ISR: rejected **before** append: `NotEnoughReplicasException("The size of the current ISR : $inSyncSize is insufficient to satisfy the min.isr requirement of $minIsr for partition $topicPartition, live replica(s) broker.id are : …")`. (`appendRecordsToLeader`)
- acks=-1 completes when `leaderLog.highWatermark >= requiredOffset`; if by then ISR < min ISR the reply is `NOT_ENOUGH_REPLICAS_AFTER_APPEND` (`checkEnoughReplicasReachOffset`).
- The leader learns a follower's log end offset from its fetch: `updateFollowerFetchState(replica, followerFetchOffsetMetadata, …)`, then `maybeExpandIsr(replica)`, then maybe increments the HW.
- Out of sync: a follower is removed if it isn't caught up within `replica.lag.time.max.ms`, judged by `lastCaughtUpTimeMs` ("Stuck followers: If the leo of the replica hasn't been updated for maxLagMs ms … Slow followers: If the replica has not read up to the leo within the last maxLagMs ms"). A follower with the same LEO as the leader is never out of sync.
- Rejoin ISR: `followerEndOffset >= leaderLog.highWatermark && leaderEpochStartOffsetOpt.exists(followerEndOffset >= _)` (caught up to the HW and to the start of the current leader epoch), and not fenced.
- ISR changes go to the controller as an `AlterPartition` request (`submitAlterPartition`).
- Log lines (INFO, verbatim templates):
  - `Shrinking ISR from 1,2,3 to 1,2. Leader: (highWatermark: …, endOffset: …). Out of sync replicas: (brokerId: 3, endOffset: …, lastCaughtUpTimeMs: …).`
  - `ISR updated to 1,2 (under-min-isr) and version updated to …` (the `(under-min-isr)` suffix only when below min ISR)
  - `Log loaded for partition … with initial high watermark …`

## Eligible Leader Replicas (ELR), 4.0+ / default on new clusters from 4.1

- "Starting from Apache Kafka 4.0, Eligible Leader Replicas (KIP-966 Part 1) is available … (ELR is enabled by default on new clusters starting 4.1)." Strict min ISR: "the high watermark for the data partition can't advance if the size of the ISR is smaller than the min ISR". Election order: "If ISR is not empty, select one of them. If ELR is not empty, select one that is not fenced. Select the last known leader if it is unfenced." Toggle: `eligible.leader.replicas.version=1` / `0`. [elr]
- KIP-966: ELR = replicas "not in ISR but guarantee to have the data at least to High Watermark". "The ISR can be empty now." "If ELR is not empty, the ISR is under min ISR." "ELR + ISR size will not be dropped below the min ISR unless the controller discovers an ELR member has an unclean shutdown." Brokers don't see ELR; the controller keeps it. An unfenced ELR member with an empty ISR "will be elected as leader, added to ISR, and removed from ELR". [kip-966]
- Practical upshot for a sim: with `min.insync.replicas=1`, ELR only changes naming (the last ISR member is kept as eligible); the partition stays leaderless until that replica returns, unless unclean election is on. Model ISR-below-min elections carefully or avoid them.

## KRaft controller: fencing and elections (4.4.0 source)

- Session timeout: `log.info("Fencing broker {} at epoch {} because its session has timed out.", id, epoch)`, then `handleBrokerFenced`. [rcm-java]
- On fencing, `generateLeaderAndIsrUpdates` removes the broker from the ISR and leadership of each partition; **if `unclean.leader.election.enable` is true for the topic it uses `Election.UNCLEAN` right there** (so a statically enabled topic gets an unclean leader as soon as its last ISR leader is fenced). [rcm-java]
- Election (`electAnyLeader`): keep the current leader if valid; else the first valid replica in the target ISR; else (ELR enabled, ISR and ELR empty) the last known leader; else, for an unclean election, the first acceptable (unfenced) replica; else `NO_LEADER`. [pcb-java]
- Unclean result: "If the election was unclean, we have to forcibly set the ISR to just the new leader. This can result in data loss!"; leader recovery state set to `RECOVERING`. Log: `Setting new leader for topicId {}, partition {} to {} using an unclean election. Previous partition: {}, change record: {}` (INFO; clean elections log at TRACE). [pcb-java]

- Admin: `kafka-leader-election.sh --bootstrap-server … --election-type unclean --topic <t> --partition <p>`: "If unclean election is selected, the election is only performed if there are no leader for the topic partition." (`preferred` is the other type.) [`https://github.com/apache/kafka/blob/4.4.0/tools/src/main/java/org/apache/kafka/tools/LeaderElectionCommand.java`] Ops docs show `--election-type preferred --all-topic-partitions` with `auto.leader.rebalance.enable = true` as the default. [`https://kafka.apache.org/44/operations/basic-kafka-operations/`]

## Leader epochs and truncation

- KIP-101: every message set is stamped with the leader epoch; a replica becoming follower asks the leader for the end offset of its latest epoch and "truncates its local log to the leader's LastOffset", then "starts fetching from the leader". [kip-101] (Modern fetch requests carry `last_fetched_epoch` and `current_leader_epoch` [protocol]; describe truncation at the level of "truncates to where its log diverges from the new leader's", not the exact RPC.)
- `FENCED_LEADER_EPOCH` (74): "The leader epoch in the request is older than the epoch on the broker." [protocol]

## Protocol (Fetch / Produce) [protocol]

- Fetch request: `replica_id` "The broker ID of the follower, of -1 if this request is from a consumer."; `max_wait_ms` "The maximum time in milliseconds to wait for the response."; `min_bytes` "The minimum bytes to accumulate in the response."; per partition `fetch_offset` "The message offset.", `current_leader_epoch`, `last_fetched_epoch`.
- Fetch response per partition: `high_watermark` "The current high water mark.", `last_stable_offset`, `records`.
- Produce request: `acks` "Allowed values: 0 for no acknowledgments, 1 for only the leader and -1 for the full ISR." Response: `base_offset` "The base offset."
- Error codes (code, retriable, text): `NOT_LEADER_OR_FOLLOWER` 6 True "For requests intended only for the leader, this error indicates that the broker is not the current leader."; `REQUEST_TIMED_OUT` 7 True; `NOT_ENOUGH_REPLICAS` 19 True "Messages are rejected since there are fewer in-sync replicas than required."; `NOT_ENOUGH_REPLICAS_AFTER_APPEND` 20 True "Messages are written to the log, but to fewer in-sync replicas than required."; `OFFSET_OUT_OF_RANGE` 1 False.

## Config names and defaults (4.4)

Producer [producer-configs]:

| Name | Default | Notes (quoted/paraphrased from the page) |
| --- | --- | --- |
| `acks` | `all` | `0`: "will not wait for any acknowledgment … retries configuration will not take effect … The offset given back for each record will always be set to -1". `1`: leader writes locally and responds; "should the leader fail immediately after acknowledging the record but before the followers have replicated it then the record will be lost". `all` (= `-1`): "wait for the full set of in-sync replicas". Idempotence requires `all`. Valid: `[all, -1, 0, 1]`. |
| `enable.idempotence` | `true` | "exactly one copy of each message is written in the stream"; if false, "retries due to broker failures, etc., may write duplicates". Requires `max.in.flight.requests.per.connection` ≤ 5, `retries` > 0, `acks=all`. |
| `linger.ms` | `5` | "changed from 0 to 5 in Apache Kafka 4.0" |
| `batch.size` | `16384` | |
| `retries` | `2147483647` | |
| `delivery.timeout.ms` | `120000` (2 minutes) | |
| `request.timeout.ms` | `30000` | "should be larger than replica.lag.time.max.ms … to reduce the possibility of message duplication due to unnecessary producer retries" |
| `retry.backoff.ms` | `100` | exponential up to `retry.backoff.max.ms` (`1000`) |
| `max.in.flight.requests.per.connection` | `5` | idempotence requires ≤ 5 "because broker only retains at most 5 batches for each producer" |

Topic [topic-configs]:

| Name | Default | Notes |
| --- | --- | --- |
| `min.insync.replicas` | `1` | With acks=all and ISR below it, "the producer will raise an exception (either NotEnoughReplicas or NotEnoughReplicasAfterAppend)". "A typical scenario would be to create a topic with a replication factor of 3, set min.insync.replicas to 2, and produce with acks of 'all'." Semantics change with ELR. |
| `unclean.leader.election.enable` | `false` | "enable replicas not in the ISR set to be elected as leader as a last resort, even though doing so may result in data loss." KRaft: enabled dynamically, it waits for the periodic unclean election thread ("default is 5 minutes") unless `kafka-leader-election.sh` with the unclean option is run. |

Broker [broker-configs]:

| Name | Default | Notes |
| --- | --- | --- |
| `replica.lag.time.max.ms` | `30000` | "If a follower hasn't sent any fetch requests or hasn't consumed up to the leader's log end offset for at least this time, the leader will remove the follower from ISR" |
| `replica.fetch.wait.max.ms` | `500` | "maximum wait time for each fetcher request issued by follower replicas"; should be below `replica.lag.time.max.ms` |
| `replica.fetch.min.bytes` | `1` | "If not enough bytes, wait up to replica.fetch.wait.max.ms" |
| `replica.high.watermark.checkpoint.interval.ms` | `5000` | "The frequency with which the high watermark is saved out to disk" |
| `broker.heartbeat.interval.ms` | `2000` | |
| `broker.session.timeout.ms` | `9000` | "length of time … that a broker lease lasts if no heartbeats are made" |
| `default.replication.factor` | `1` | |

## Not verified (don't claim without reading a source first)

- Controller log lines other than the two quoted above (clean elections log at TRACE, so there is no INFO line to quote for them).
- Producer client log lines and exception texts beyond the error code table.
- Consumer group / rebalance facts (phase 4): not researched yet. Add them here when you do.
