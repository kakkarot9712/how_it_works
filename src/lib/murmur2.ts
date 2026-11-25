/**
 * Kafka's key hash, shared by the consumer-groups sim and the Kafka path's partitioner
 * widget. Pure, no dependencies, safe on the client.
 */

/** Port of org.apache.kafka.common.utils.Utils.murmur2 (4.4.0). */
export function murmur2(key: string): number {
  const d = new TextEncoder().encode(key);
  const len = d.length;
  const m = 0x5bd1e995;
  let h = (0x9747b28c ^ len) | 0;
  const len4 = len >> 2;
  for (let i = 0; i < len4; i++) {
    const i4 = i << 2;
    let k = d[i4] | (d[i4 + 1] << 8) | (d[i4 + 2] << 16) | (d[i4 + 3] << 24);
    k = Math.imul(k, m);
    k ^= k >>> 24;
    k = Math.imul(k, m);
    h = Math.imul(h, m);
    h ^= k;
  }
  const idx = len4 << 2;
  const rest = len - idx;
  if (rest === 3) h ^= (d[idx + 2] & 0xff) << 16;
  if (rest >= 2) h ^= (d[idx + 1] & 0xff) << 8;
  if (rest >= 1) {
    h ^= d[idx] & 0xff;
    h = Math.imul(h, m);
  }
  h ^= h >>> 13;
  h = Math.imul(h, m);
  h ^= h >>> 15;
  return h | 0;
}

/** BuiltInPartitioner.partitionForKey (4.4.0): toPositive(murmur2(serializedKey)) % numPartitions. */
export const partitionForKey = (key: string, numPartitions: number) => (murmur2(key) & 0x7fffffff) % numPartitions;
