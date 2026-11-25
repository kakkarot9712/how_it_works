import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getStep, paths, stepsOf } from "@/paths/catalog";
import { pathContent } from "@/paths/content";
import { PathNav, PathOutline, StepFooter, StepKindTag, StepTerms } from "@/components/path";
import { References, WriteupGrid } from "@/components/writeup";
import { Eyebrow, gloss, Heading, LinkButton } from "@/components/ui";

export function generateStaticParams() {
  return paths.flatMap((p) => stepsOf(p).map(({ step }) => ({ path: p.slug, step: step.slug })));
}

export async function generateMetadata({ params }: PageProps<"/learn/[path]/[step]">): Promise<Metadata> {
  const { path, step } = await params;
  const found = getStep(path, step);
  return found ? { title: `${found.step.title} · ${found.path.name} path`, description: found.step.summary } : {};
}

/** One step of a learning path. No site header: PathNav carries the breadcrumb and prev/next. */
export default function StepPage({ params }: PageProps<"/learn/[path]/[step]">) {
  return (
    <main>
      <Suspense fallback={<div className="h-12 border-b border-line bg-panel" />}>
        <StepContent params={params} />
      </Suspense>
    </main>
  );
}

async function StepContent({ params }: { params: PageProps<"/learn/[path]/[step]">["params"] }) {
  const { path: pathSlug, step: stepSlug } = await params;
  const found = getStep(pathSlug, stepSlug);
  const content = found && pathContent[pathSlug]?.steps[stepSlug];
  if (!found || !content) notFound();
  const { path, step, module, moduleIndex, n, total, prev, next } = found;
  const { Body, sources } = content;

  return (
    <>
      <PathNav path={path} step={step} n={n} total={total} prev={prev} next={next} />
      <header className="border-b border-line bg-panel/40">
        <WriteupGrid className="pb-10 pt-12">
          <Eyebrow tone="accent">
            Module {moduleIndex + 1} · {module.title} · step {n} of {total}
          </Eyebrow>
          <Heading level="display" as="h1" className="mt-3">
            {step.title}
          </Heading>
          <p className="mt-4 text-lg leading-relaxed text-fg-muted">{gloss(step.summary)}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3 text-note text-fg-muted">
            <StepKindTag kind={step.kind} />
            <span className="font-mono text-xs">~{step.minutes} min</span>
            <span>
              Written for <span className="font-mono text-fg">{sources.label}</span> ·{" "}
              <a href="#references" className="underline decoration-line underline-offset-2 hover:text-fg">
                sources
              </a>
            </span>
            {step.sim && (
              <LinkButton href={`/${step.sim}`} tone="default" className="ml-auto">
                ▶ Open the simulator
              </LinkButton>
            )}
          </div>
        </WriteupGrid>
      </header>
      <WriteupGrid className="py-12" rail={<PathOutline path={path} current={step.slug} />}>
        <StepTerms path={path.slug} step={step.slug} pool={pathContent[path.slug].pool} />
        <Body />
        <StepFooter path={path.slug} step={step.slug} prev={prev} next={next} />
        <References title="References" sources={sources} scope="page" />
      </WriteupGrid>
    </>
  );
}
