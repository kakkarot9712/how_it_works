import type { Metadata } from "next";
import { paths } from "@/paths/catalog";
import { PathCard } from "@/components/site";
import { Container, Heading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Learning paths",
  description: "Guided tours of whole systems, one idea at a time: explorable widgets, request traces, and simulators to break.",
};

export default function LearnIndex() {
  return (
    <Container as="main" className="py-14">
      <Heading level="title" as="h1">
        Learning paths
      </Heading>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-fg-muted">
        A guided tour of one system, from the first idea to the failure modes. Each step uses the format that fits it: a widget to explore, a
        request to trace hop by hop, or a simulator to break after you predict what will happen.
      </p>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {paths.map((p) => (
          <PathCard key={p.slug} path={p} />
        ))}
      </div>
    </Container>
  );
}
