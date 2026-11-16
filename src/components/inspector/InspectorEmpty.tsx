"use client";

import type { ReactNode } from "react";
import { Button, gloss, Section } from "@/components/ui";

/** What the inspector shows with nothing selected: a hint and a quick-select button per node. */
export function InspectorEmpty({
  hint,
  nodes,
  onSelect,
}: {
  hint: ReactNode;
  nodes: { id: string; label: string }[];
  onSelect: (id: string) => void;
}) {
  return (
    <Section title="Inspector">
      <p className="text-sm leading-relaxed text-fg-muted">{gloss(hint)}</p>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {nodes.map((n) => (
          <Button key={n.id} onClick={() => onSelect(n.id)}>
            {n.label}
          </Button>
        ))}
      </div>
    </Section>
  );
}
