import Link from "next/link";
import type { LearningPath, PathStep } from "@/paths/catalog";
import { Logo } from "@/components/site";
import { Heading } from "@/components/ui";

/** Top bar of a path step: logo, breadcrumb (path / step), step counter and prev/next links. */
export function PathNav({ path, step, n, total, prev, next }: { path: LearningPath; step: PathStep; n: number; total: number; prev?: PathStep; next?: PathStep }) {
  const base = `/learn/${path.slug}`;
  const nav = (s: PathStep | undefined, label: string, glyph: string) =>
    s ? (
      <Link href={`${base}/${s.slug}`} title={`${label}: ${s.title}`} aria-label={`${label}: ${s.title}`} className="px-1.5 py-1 text-fg-muted transition-colors hover:text-fg">
        {glyph}
      </Link>
    ) : (
      <span aria-hidden className="px-1.5 py-1 text-fg-muted opacity-40">
        {glyph}
      </span>
    );
  return (
    <div className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-4 border-b border-line bg-panel px-4 sm:gap-6 sm:px-5">
      <Logo />
      <span className="hidden h-5 w-px bg-line sm:block" />
      <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        <Link href={base} className="hidden whitespace-nowrap text-fg-muted hover:text-fg sm:inline">
          {path.name} path
        </Link>
        <span className="hidden text-fg-muted sm:inline">/</span>
        <Heading level="item" as="p" className="truncate">
          {step.title}
        </Heading>
      </div>
      <nav aria-label="Steps" className="flex shrink-0 items-center gap-1 text-sm">
        {nav(prev, "Previous step", "‹")}
        <span className="font-mono text-xs text-fg-muted">
          {n}/{total}
        </span>
        {nav(next, "Next step", "›")}
      </nav>
    </div>
  );
}
