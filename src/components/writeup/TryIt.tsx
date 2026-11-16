import Link from "next/link";
import { Eyebrow, Surface } from "@/components/ui";

/** Links from a paragraph into the simulator, opening the scenarios that show it. */
export function TryIt({ simHref, items }: { simHref: string; items: { id: string; n: number; title: string }[] }) {
  return (
    <Surface tone="accent" className="not-prose my-6 px-4 py-3">
      <Eyebrow tone="accent" className="mb-1.5">See it happen</Eyebrow>
      <ul className="space-y-1">
        {items.map((s) => (
          <li key={s.id}>
            <Link href={`${simHref}?s=${s.id}`} className="group flex items-baseline gap-2.5 text-body text-fg">
              <span className="font-mono text-xs text-fg-muted">{String(s.n).padStart(2, "0")}</span>
              <span className="underline decoration-line underline-offset-4 group-hover:decoration-accent">{s.title}</span>
              <span className="text-accent opacity-0 transition-opacity group-hover:opacity-100">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
}
