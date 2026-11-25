import Link from "next/link";
import { getStep, type LearningPath } from "@/paths/catalog";
import { Compare } from "@/components/writeup";
import type { Connection } from "./systemMap";

/**
 * "Who talks to whom" under a path's system map: each connection from the side that opens it,
 * its pattern, and who decides what. Rows link to the step that explains and cites them;
 * a step not written yet (hidden paths only) shows as plain text.
 */
export function ConnectionTable({ path, connections }: { path: LearningPath; connections: Connection[] }) {
  return (
    <Compare
      head={["Who opens it → to", "What goes over it", "Pattern", "Who decides what", "Explained in"]}
      rows={connections.map((c) => {
        const s = getStep(path.slug, c.step);
        return [
          `${c.from} → ${c.to}`,
          c.call,
          c.pattern,
          c.control,
          s ? (
            <Link key={c.step} href={`/learn/${path.slug}/${c.step}`} className="text-accent hover:underline">
              {s.step.title}
            </Link>
          ) : (
            "a later step"
          ),
        ];
      })}
    />
  );
}
