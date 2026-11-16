import type { Walkthrough } from "@/sims/explainers";
import { ScenarioWalkthrough } from "./ScenarioWalkthrough";
import { Heading } from "@/components/ui";

/** The "Every scenario, step by step" section: one ScenarioWalkthrough per scenario, in picker order. */
export function ScenarioWalkthroughs({
  id = "scenarios",
  title,
  simHref,
  scenarios,
  walkthroughs,
}: {
  id?: string;
  title: string;
  simHref: string;
  scenarios: { id: string; title: string; summary: string }[];
  walkthroughs: Walkthrough[];
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-20 border-t border-line pt-10">
      <Heading level="section">{title}</Heading>
      <p className="mb-8 mt-3 text-base leading-prose text-fg-muted">
        What happens in each scenario and when. Times are simulated seconds, as on the simulator&apos;s timeline. Click a
        time to open the simulator paused at that moment, then take control.
      </p>
      <div className="space-y-6">
        {walkthroughs.map((w) => {
          const i = scenarios.findIndex((s) => s.id === w.id);
          const sc = scenarios[i];
          return (
            <ScenarioWalkthrough
              key={w.id}
              n={i + 1}
              title={sc.title}
              summary={sc.summary}
              href={`${simHref}?s=${w.id}`}
              walkthrough={w}
            />
          );
        })}
      </div>
    </section>
  );
}
