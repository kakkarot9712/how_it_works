# Roadmap and decisions

## Owner decisions (2026-11-11)

- Separate project, hosted at `syswork.vikalpg.in` (not part of the portfolio repo).
- Audience: people who want to understand how systems work and the technicalities. It is also the owner's demo project.
- Curated scenarios first. A "lego blocks" sandbox follows: users remove specific parts of a system to see what they do. It is not a free-form build-anything editor.
- Users must always have direct control in every sim (block a client, kill a broker, and so on).
- Desktop is required now. Full mobile support is planned soon.

## Phases

| # | Sim | Status | Key mechanics |
| --- | --- | --- | --- |
| 1 | Engine + player + **Redis Pub/Sub** | done | output buffers, soft/hard limits, TCP window, half-open, reconnect, OOM, restart. Write-up with a message-path diagram and tested step-by-step walkthroughs of all 8 scenarios; shared component kits, design system and acronym glossary |
| 2 | **Redis Streams** & consumer groups | done | XADD IDs, XREADGROUP `>` vs `0`, BLOCK, PEL + XACK, NOACK, XAUTOCLAIM, delivery count + dead-letter stream, MAXLEN trimming (lag nil), AOF restart. 8 scenarios with tested walkthroughs. Side-by-side comparison with Pub/Sub still to do |
| 3 | Kafka produce & replicate | planned | partitioner, leader/follower fetch (pull), ISR, high watermark, acks, min.insync.replicas, unclean election |
| 4 | Kafka consumer groups | planned | pull + lag, offset commits, rebalances, at-least/at-most once, poison messages |
| 5 | Load balancing | planned | RR, weighted, least-conn, P2C, consistent hashing ring and virtual nodes |
| 6 | Raft (+ MongoDB replica set) | planned | terms, randomized timeouts, votes, log matching, commit index, partitions |
| 7 | Transactions | planned | isolation anomalies on parallel timelines, MVCC versions, WAL + crash recovery |

Cross-cutting, after phase 2: a comparison mode ("slow consumer" in Pub/Sub, Streams and Kafka side by side), concept pages (push vs pull, at-most/at-least-once), and the mobile layout.

## Deployment

Vercel project pointed at this repo, custom domain `syswork.vikalpg.in` (CNAME to Vercel). Not set up yet.
