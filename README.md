# syswork

See how systems actually work, then break them.

Animated, interactive simulations of system internals: message brokers, load balancers, replication, transactions. Each simulation runs curated scenarios, and you can take control at any time: stall a consumer, cut a network link, crash a node, or remove a building block (like Redis's output buffer limits) and watch what happens, step by step, with narration explaining why.

**Live:** Redis Pub/Sub. **Next:** Redis Streams, Kafka, load balancing, Raft, isolation levels. See [docs/roadmap.md](docs/roadmap.md).

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # engine + model tests
pnpm build
```

Deep link to a moment: `/redis/pub-sub?s=partition&t=13000`.

## How it works

Each simulation is a deterministic discrete-event model (seeded RNG, plain-data state). The runtime snapshots state so you can rewind, step and scrub, and the SVG canvas is drawn from state at the current simulated time. See [docs/architecture.md](docs/architecture.md).
