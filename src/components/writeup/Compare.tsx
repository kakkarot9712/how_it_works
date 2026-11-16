import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { gloss, Surface } from "@/components/ui";

/** A comparison table. The first column is the row label. */
export function Compare({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <Surface className="not-prose my-6 overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm leading-relaxed">
        <thead className="bg-panel-2">
          <tr>
            {head.map((h, i) => (
              <th key={i} className={cx("border-b border-line px-4 py-2.5 font-semibold", i === 0 ? "text-fg-muted" : "text-fg")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-b-0">
              {r.map((c, j) => (
                <td key={j} className={cx("px-4 py-2.5 align-top", j === 0 ? "whitespace-nowrap font-medium text-fg" : "text-fg-muted")}>
                  {gloss(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}
