import type { ReactNode } from "react";
import { Eyebrow, Heading, PanelHeader } from "@/components/ui";

/** Top of an inspector panel: what kind of node, its name, and a status pill. */
export function InspectorHeader({ kind, title, status }: { kind: string; title: string; status?: ReactNode }) {
  return (
    <PanelHeader actions={status}>
      <Eyebrow as="div" size="sm">
        {kind}
      </Eyebrow>
      <Heading level="panel">{title}</Heading>
    </PanelHeader>
  );
}
