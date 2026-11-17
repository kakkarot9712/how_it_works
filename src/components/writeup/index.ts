/**
 * The "How it works" write-up kit. Import from "@/components/writeup".
 * Page shell: WriteupHero, WriteupGrid (+ Toc in the rail), ScenarioWalkthroughs.
 * Inside a sim's Explainer: Prose wrapping WriteupSection blocks, with Figure, Callout,
 * AnnotatedConfig, ServerOutput, Compare, TryIt and `citer(sources)` for inline citations. References closes the page. Anything inside `.not-prose` keeps its own styles.
 */
export { AnnotatedConfig } from "./AnnotatedConfig";
export { Callout } from "./Callout";
export { Cite, citer } from "./Cite";
export { Compare } from "./Compare";
export { Figure } from "./Figure";
export { Prose } from "./Prose";
export { References } from "./References";
export { Rich } from "./Rich";
export { ScenarioWalkthrough } from "./ScenarioWalkthrough";
export { ScenarioWalkthroughs } from "./ScenarioWalkthroughs";
export { ServerOutput } from "./ServerOutput";
export { Toc } from "./Toc";
export { TryIt } from "./TryIt";
export { FactStrip, WriteupHero } from "./WriteupHero";
export { WriteupGrid } from "./WriteupLayout";
export { WriteupSection } from "./WriteupSection";
