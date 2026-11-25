import type { SystemMapSpec } from "@/components/path";

/**
 * The Kafka path's system map: one topic partition replicated on three brokers, a
 * producer, the controller, and a consumer group. Each box opens the step that explains it.
 * Consumers fetch from the leader (broker-1); the commit goes to the group coordinator (broker-3 here).
 */
export const map: SystemMapSpec = {
  width: 1100,
  height: 372,
  regions: [
    { label: "Kafka cluster", x: 220, y: 16, w: 632, h: 340 },
    { label: "Consumer group", x: 900, y: 96, w: 184, h: 260 },
  ],
  nodes: [
    { id: "producer", label: "Producer", lines: ["key → partition"], x: 16, y: 168, w: 156, h: 76, step: "topics-and-partitions" },
    { id: "controller", label: "Controller", lines: ["fences brokers, elects leaders from the ISR"], x: 244, y: 58, w: 584, h: 62, step: "replication-lab" },
    { id: "broker-1", label: "broker-1", lines: ["orders-0 leader", "appends, moves HW"], x: 244, y: 140, w: 160, h: 140, step: "one-record" },
    { id: "broker-2", label: "broker-2", lines: ["orders-0 follower", "pulls the leader"], x: 456, y: 140, w: 160, h: 140, step: "replication-lab" },
    { id: "broker-3", label: "broker-3", lines: ["orders-0 follower", "group coordinator"], x: 668, y: 140, w: 160, h: 140, step: "consume-and-commit" },
    { id: "consumer-1", label: "consumer-1", lines: ["position, commits"], x: 920, y: 136, w: 148, h: 70, step: "consume-and-commit" },
    { id: "consumer-2", label: "consumer-2", lines: ["one owner each"], x: 920, y: 222, w: 148, h: 70, step: "groups-lab" },
  ],
  wires: [
    { points: [[172, 206], [244, 206]], label: "Produce" },
    { points: [[456, 250], [404, 250]], label: "Fetch" },
    { points: [[668, 250], [616, 250]], label: "Fetch" },
    { points: [[920, 171], [828, 171]], label: "commit", dashed: true },
    { points: [[994, 292], [994, 318], [324, 318], [324, 280]], label: "Fetch, from the leader", labelBelow: true },
  ],
};
