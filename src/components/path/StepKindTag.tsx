import { STEP_KINDS, type StepKind } from "@/paths/catalog";
import { Tag } from "@/components/ui";

/** The format of a path step (Explore, Trace, Lab), with what it means in a tooltip. */
export function StepKindTag({ kind, focusable = true }: { kind: StepKind; focusable?: boolean }) {
  const k = STEP_KINDS[kind];
  return (
    <Tag tone={kind === "lab" ? "accent" : "muted"} tip={k.tip} tipFocusable={focusable}>
      {k.label}
    </Tag>
  );
}
