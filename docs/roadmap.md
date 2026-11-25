# Roadmap and decisions

## Owner decisions (2026-11-11)

- Separate project, hosted at `syswork.vikalpg.in` (not part of the portfolio repo).
- Audience: people who want to understand how systems work and the technicalities. It is also the owner's demo project.
- Curated scenarios first. A "lego blocks" sandbox follows: users remove specific parts of a system to see what they do. It is not a free-form build-anything editor.
- Users must always have direct control in every sim (block a client, kill a broker, and so on).
- Desktop is required now. Full mobile support is planned soon.

## Owner decisions (2026-11-17)

- Transactions are dropped from the plan. Isolation levels, MVCC and WAL behave differently in each database engine, so they aren't general knowledge in the way Redis Pub/Sub and Streams are. The PostgreSQL 18 isolation-levels sim that was already built (`src/sims/pg-isolation/`) stays in the repo but is unpublished: its topic has `hidden: true` in `src/catalog.ts`, so it isn't listed and its URLs return 404. Tests still cover it.

## Owner decisions (2026-11-18)

- Load balancing is hidden for now (`hidden: true` on its topic in `src/catalog.ts`): the built sim stays in the repo and in the tests, but isn't listed and its URLs return 404.
- Reusable knowledge goes into skills rather than being re-read from existing sims: code skeletons in `.claude/skills/add-simulation/templates.md`, sourced facts per technology (`.claude/skills/kafka-facts/`).

## Owner decisions (2026-11-24)

- The site is reorganised around **learning paths**: a guided tour of one whole system (Kubernetes, serverless functions, Kafka…), module by module, easy to hard. Simulators stay, as the "Lab" format inside paths and as standalone pages; cheaper formats fill the rest: Explore (one knob, instant result), Trace (one request hop by hop with a state table) and Lab (predict, then check at a deep-linked moment in a simulator).
- Kafka is the pilot path (`/learn/kafka`, 3 modules, 5 steps), because its two hardest steps were already built as sims. It builds the path framework; Kubernetes follows as the flagship path.

## Learning paths

| Path | Status | Modules and steps |
| --- | --- | --- |
| **Kafka** | live (pilot) | The log: keys → partitions → offsets (Explore, murmur2 widget), one record end to end (Trace). Replication: break it (Lab on produce & replicate). Consumers: poll, process, commit and a crash (Trace), break a group (Lab on consumer groups) |
| Kubernetes | planned (flagship) | System map; `kubectl apply` end to end (Trace); API server objects and watches, etcd and Raft (Lab), controllers and reconcile loops (Lab), scheduler (Explore + Lab), kubelet, CRI and eviction (Trace + Lab), Services and networking (Trace), failure and recovery (Lab) |
| Serverless functions | planned | Invocation lifecycle (Trace), isolation compared, cold starts (Lab), concurrency and scaling (Lab), async invocation and event sources (Lab). Needs an owner decision first on sources: much of the internals is documented only in papers and talks, not official docs |
| Redis | planned | Wrap the Pub/Sub and Streams sims with intro steps |

Possible next step formats: a Compare step (side by side on the same input) and a terminal replay (real-format CLI output, annotated).

## Phases

| # | Sim | Status | Key mechanics |
| --- | --- | --- | --- |
| 1 | Engine + player + **Redis Pub/Sub** | done | output buffers, soft/hard limits, TCP window, half-open, reconnect, OOM, restart. Write-up with a message-path diagram and tested step-by-step walkthroughs of all 8 scenarios; shared component kits, design system and acronym glossary |
| 2 | **Redis Streams** & consumer groups | done | XADD IDs, XREADGROUP `>` vs `0`, BLOCK, PEL + XACK, NOACK, XAUTOCLAIM, delivery count + dead-letter stream, MAXLEN trimming (lag nil), AOF restart. 8 scenarios with tested walkthroughs. Side-by-side comparison with Pub/Sub still to do |
| 3 | **Kafka produce & replicate** | done | One partition on three brokers + KRaft controller (`src/sims/kafka-replication/`, Kafka 4.4): follower Fetch (pull, long-poll), ISR shrink/expand (`replica.lag.time.max.ms`), high watermark (strict min ISR), acks=0/1/all, `min.insync.replicas`, fencing (`broker.session.timeout.ms`), elections from ISR → ELR → unclean, leader-epoch truncation, producer retries and idempotence. 7 scenarios with tested walkthroughs. The partitioner moved to phase 4 |
| 4 | **Kafka consumer groups** | done | Topic `orders` (3 partitions), coordinator, 4 consumers (`src/sims/kafka-consumer-groups/`, Kafka 4.4): murmur2 key partitioner (`partitioner.ignore.keys`), long-poll fetch, lag, auto commit / commit after / commit before processing (at-least vs at-most once), rebalances on the consumer protocol (KIP-848, incremental, `uniform`) vs classic eager `RangeAssignor`, session timeout vs `max.poll.interval.ms`, poison records and app-level dead-lettering, hot keys. 8 scenarios with tested walkthroughs |
| 5 | Load balancing | in progress, hidden | **Algorithms side by side** done (`src/sims/lb-algorithms/`): four nginx 1.30 upstream groups on identical requests: round robin (smooth weighted), `random`, `least_conn`, `random two`; weights, `max_fails`/`fail_timeout`, `proxy_next_upstream`, timeouts. 7 scenarios with tested walkthroughs. Consistent hashing ring and virtual nodes still planned |
| 6 | Raft (+ MongoDB replica set) | planned | terms, randomized timeouts, votes, log matching, commit index, partitions |

Cross-cutting, after phase 2: a comparison mode ("slow consumer" in Pub/Sub, Streams and Kafka side by side), concept pages (push vs pull, at-most/at-least-once), and the mobile layout.

## Deployment

Vercel project pointed at this repo, custom domain `syswork.vikalpg.in` (CNAME to Vercel). Not set up yet.
