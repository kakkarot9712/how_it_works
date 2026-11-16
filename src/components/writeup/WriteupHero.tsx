import type { ReactNode } from "react";
import { Eyebrow, gloss, Heading } from "@/components/ui";
import { WriteupGrid } from "./WriteupLayout";

/** Header of a "How it works" page: eyebrow, title, lede, a strip of key facts, and calls to action. */
export function WriteupHero({
  eyebrow,
  title,
  lede,
  facts,
  modelledOn,
  actions,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  facts: { label: string; value: string }[];
  /** "Redis Open Source 8.10": the version the model follows, linked to the References section. */
  modelledOn?: string;
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
        {modelledOn && (
          <p className="mt-3 text-note text-fg-muted">
            Modelled on <span className="font-mono text-fg">{modelledOn}</span> ·{" "}
            <a href="#references" className="underline decoration-line underline-offset-2 hover:text-fg">
              sources
            </a>
          </p>
        )}
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
