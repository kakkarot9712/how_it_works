import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPath, pathMinutes, paths, stepsOf } from "@/paths/catalog";
import { pathContent } from "@/paths/content";
import { ConnectionTable, ModuleList, PathStart, SystemMapDiagram } from "@/components/path";
import { FactStrip } from "@/components/writeup";
import { Container, Eyebrow, gloss, Heading, Help, Surface } from "@/components/ui";

export function generateStaticParams() {
  return paths.map((p) => ({ path: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[path]">): Promise<Metadata> {
  const p = getPath((await params).path);
  return p ? { title: `${p.name} learning path`, description: p.tagline } : {};
}

/** A path's home: what it covers, the system map, and the modules. Params are read inside <Suspense>. */
export default function PathPage({ params }: PageProps<"/learn/[path]">) {
  return (
    <Container as="main" className="pb-24">
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <PathContent params={params} />
      </Suspense>
    </Container>
  );
}

async function PathContent({ params }: { params: PageProps<"/learn/[path]">["params"] }) {
  const path = getPath((await params).path);
  const content = path && pathContent[path.slug];
  if (!path || !content) notFound();
  const steps = stepsOf(path);

  return (
    <>
      <section className="py-14">
        <Link href="/learn" className="text-xs text-fg-muted hover:text-fg">
          ← all paths
        </Link>
        <Eyebrow tone="accent" className="mt-6">
          Learning path · {path.name}
        </Eyebrow>
        <Heading level="display" as="h1" className="mt-3 max-w-3xl">
          {path.title}
        </Heading>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-fg-muted">{gloss(path.lede)}</p>
        <div className="max-w-3xl">
          <FactStrip
            facts={[
              { label: "Modules", value: String(path.modules.length) },
              { label: "Steps", value: String(steps.length) },
              { label: "Time", value: `~${pathMinutes(path)} min` },
              { label: "Written for", value: content.pool.label },
            ]}
          />
        </div>
        <div className="mt-8">
          <PathStart path={path} />
        </div>
      </section>

      <section aria-labelledby="map" className="space-y-3">
        <Heading level="section" id="map">
          The system
        </Heading>
        <Help>
          Every box is a part of {path.name} that the path explains. Click one to open its step; finished ones get a ✓. New to the words?{" "}
          <Link href={`/learn/${path.slug}/terms`} className="text-accent hover:underline">
            See all terms
          </Link>
          .
        </Help>
        <Surface className="overflow-x-auto p-4">
          <SystemMapDiagram path={path.slug} map={content.map} />
        </Surface>
      </section>

      {content.map.connections && (
        <section aria-labelledby="connections" className="mt-14 space-y-3">
          <Heading level="section" id="connections">
            Who talks to whom
          </Heading>
          <Help>
            Each row starts at the side that opens the connection, so the arrow is the direction of the request, not always of the data. The last
            column says which side is in control: the part most often assumed wrong.
          </Help>
          <ConnectionTable path={path} connections={content.map.connections} />
        </section>
      )}

      <section aria-labelledby="steps" className="mt-14 max-w-4xl">
        <Heading level="section" id="steps" className="mb-6">
          The path
        </Heading>
        <ModuleList path={path} />
      </section>
    </>
  );
}
