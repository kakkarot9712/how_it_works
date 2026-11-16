import type { ReactNode } from "react";
import { Eyebrow } from "./Eyebrow";

/** A titled block inside a side panel (inspector, settings drawer). Stacks with dividers. */
export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between">
        <Eyebrow as="h3">{title}</Eyebrow>
        {right}
      </div>
      {children}
    </section>
  );
}
