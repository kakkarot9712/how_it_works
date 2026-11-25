import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { conceptsTaught } from "@/lib/glossary";
import { getPath, paths, stepsOf } from "@/paths/catalog";
import { StepKindTag, TermList } from "@/components/path";
import { pathContent } from "@/paths/content";
import { Container, Eyebrow, Heading, Help, Surface } from "@/components/ui";

export function generateStaticParams() {
  return paths.map((p) => ({ path: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[path]/terms">): Promise<Metadata> {
  const p = getPath((await params).path);
  return p ? { title: `Terms · ${p.name} path`, description: `Every term the ${p.name} path uses, where it is taught, and which other systems share it.` } : {};
}

/** A path's terms, grouped by the step that first uses each one. A reference, not a required first stop. */
export default function TermsPage({ params }: PageProps<"/learn/[path]/terms">) {
  return (
    <Container as="main" className="pb-24">
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <TermsContent params={params} />
      </Suspense>
    </Container>
  );
}

async function TermsContent({ params }: { params: PageProps<"/learn/[path]/terms">["params"] }) {
  const path = getPath((await params).path);
  if (!path) notFound();
  const all = conceptsTaught(path.slug);
  const shared = all.filter((t) => t.alsoIn.length > 0).length;

  return (
    <div className="max-w-4xl">
      <section className="py-14">
        <Link href={`/learn/${path.slug}`} className="text-xs text-fg-muted hover:text-fg">
          ← {path.name} path
        </Link>
        <Eyebrow tone="accent" className="mt-6">
          Learning path · {path.name}
        </Eyebrow>
        <Heading level="display" as="h1" className="mt-3">
          Terms
        </Heading>
        <p className="mt-4 text-lg leading-relaxed text-fg-muted">
          The {all.length} terms this path uses, in the step where each first appears. You don&apos;t need to read this first: every step lists its
          new words at the top, and any term in the text shows its meaning on hover.
          {shared > 0 && <> {shared} of them are shared with other paths, marked &ldquo;also in&rdquo;: the same idea in another system.</>}
        </p>
      </section>

      <ol className="space-y-8">
        {stepsOf(path).map(({ step, n }) => {
          const terms = all.filter((t) => t.taught.step === step.slug);
          if (!terms.length) return null;
          return (
            <li key={step.slug}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-accent">{n}</span>
                <Link href={`/learn/${path.slug}/${step.slug}`} className="hover:underline">
                  <Heading level="card" as="h2">
                    {step.title}
                  </Heading>
                </Link>
                <StepKindTag kind={step.kind} />
              </div>
              <Surface className="mt-3 px-5 py-4">
                <TermList terms={terms} pool={pathContent[path.slug].pool} />
              </Surface>
            </li>
          );
        })}
      </ol>
      <Help className="mt-10">Acronyms (TCP, ISR, CRI…) are explained on hover wherever they appear, and aren&apos;t listed here.</Help>
    </div>
  );
}
