import type { ReactNode } from "react";
import { Eyebrow, gloss, Heading } from "@/components/ui";
import { WriteupGrid } from "./WriteupLayout";

/** Header of a "How it works" page: eyebrow, title, lede, a strip of key facts, and calls to action. */
export function WriteupHero({
  eyebrow,
  title,
  lede,
  facts,
  actions,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  facts: { label: string; value: string }[];
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-line bg-panel/40">
      <WriteupGrid className="pb-12 pt-14">
        <Eyebrow tone="accent">{eyebrow}</Eyebrow>
        <Heading level="display" className="mt-3">
          {title}
        </Heading>
        <p className="mt-4 text-lg leading-relaxed text-fg-muted">{gloss(lede)}</p>
        <FactStrip facts={facts} />
        {actions && <div className="mt-8 flex flex-wrap items-center gap-3">{actions}</div>}
      </WriteupGrid>
    </header>
  );
}

/** 3–4 key facts in a bordered strip (two columns on phones). */
export function FactStrip({ facts }: { facts: { label: string; value: string }[] }) {
  return (
    <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
      {facts.map((f) => (
        <div key={f.label} className="bg-panel px-4 py-3">
          <Eyebrow as="dt">{f.label}</Eyebrow>
          <dd className="mt-1 font-mono text-body text-fg">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}
