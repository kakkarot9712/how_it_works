// Lists words in learning-path prose that may need a definition: CamelCase names (ReplicaSet),
// bold phrases (often a concept being introduced), and capitalized words mid-sentence (Pod,
// Service). Anything already in the dictionary (src/lib/glossary.ts + src/lib/concepts.ts) is
// skipped. Advisory: it prints candidates for a human to judge and always exits 0. Usage:
//   node .claude/skills/define-terms/candidates.mjs            all paths
//   node .claude/skills/define-terms/candidates.mjs kubernetes one path
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../../", import.meta.url).pathname;
const PATHS = join(ROOT, "src/paths");

// Dictionary keys and forms, read from source (plain node can't import the .ts module graph).
const known = new Set();
for (const f of ["src/lib/glossary.ts", "src/lib/concepts.ts"]) {
  const src = readFileSync(join(ROOT, f), "utf8");
  for (const m of src.matchAll(/^\s{2}"?([A-Za-z0-9][A-Za-z0-9 .-]*)"?: \{/gm)) known.add(m[1].toLowerCase());
  for (const m of src.matchAll(/forms: \[([^\]]*)\]/g)) for (const x of m[1].matchAll(/"([^"]+)"/g)) known.add(x[1].toLowerCase());
}
const isKnown = (w) => {
  const l = w.toLowerCase();
  return known.has(l) || known.has(l.replace(/s$/, "")) || [...known].some((k) => k.includes(" ") && l.includes(k));
};

// Plain words and product names that need no definition here. Keep short; add with care.
const IGNORE = new Set(
  "Kafka Kubernetes Redis PostgreSQL Java Go JSON YAML HTTP Linux Raft The A An In On If It Its This That These Those Then When What Why How Each Every One Two Three Here Now Only So But And Or Not No Yes Say Ask Tick Raise Cordon Send Click Step Watch See Try After Before While With Without Once Both Either Without".split(" "),
);

function prose(src) {
  const clean = src
    .replace(/^import .*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/<code[^>]*>[\s\S]*?<\/code>/g, " ")
    .replace(/&(?:apos|quot|ldquo|rdquo|lsquo|rsquo|amp|hellip|mdash|ndash|nbsp|lt|gt);/g, "'")
    .replace(/\{\s*"([^"{}]*)"\s*\}/g, "$1")
    .replace(/\{cite\([^)]*\)\}/g, " ");
  const out = [];
  for (const m of clean.matchAll(/(?<![=-])>([^<>{}]+)</g)) if (!/=|&&|\|\|/.test(m[1])) out.push(m[1]);
  for (const m of clean.matchAll(/(?:title|body|setup|question|explain|text|summary): "((?:[^"\\]|\\.)*)"/g)) out.push(m[1]);
  return { text: out.join("\n"), strong: [...clean.matchAll(/<strong>([^<{]+)<\/strong>/g)].map((m) => m[1].trim()) };
}

// Candidates already reviewed and judged not to need an entry, with the reason. Add here instead of re-reviewing.
const REVIEWED = new Set([
  "Container", "Runtime", "Interface", // "Container Runtime Interface": the expansion of CRI, which is glossed
  "“position”", // bold label of the consumer position, which has an entry ("consumer position")
  "Filter", "Score", "“filters”", "“scores”", // named and explained under "extension point" and in the step's own text
  "“Deployment controller”", // Deployment + controller, both entries
  "“+ Add a partition”", // a widget button label
]);

const only = process.argv[2];
for (const path of readdirSync(PATHS).filter((d) => existsSync(join(PATHS, d, "steps")) && (!only || d === only))) {
  const found = new Map(); // word -> Set<step>
  const add = (w, step) => (found.get(w) ?? found.set(w, new Set()).get(w)).add(step);
  for (const file of readdirSync(join(PATHS, path, "steps"))) {
    const step = file.replace(/\.tsx$/, "");
    const { text, strong } = prose(readFileSync(join(PATHS, path, "steps", file), "utf8"));
    for (const [w] of text.matchAll(/\b[A-Z][a-z]+(?:[A-Z][a-z0-9]+)+\b/g)) if (!isKnown(w) && !REVIEWED.has(w)) add(w, step); // CamelCase
    for (const m of text.matchAll(/[a-z,] ([A-Z][a-z]{2,})\b/g)) if (!IGNORE.has(m[1]) && !REVIEWED.has(m[1]) && !isKnown(m[1])) add(m[1], step); // Capitalized mid-sentence
    for (const s of strong) if (s.split(" ").length <= 4 && !/[.?:!]$/.test(s) && !isKnown(s) && !REVIEWED.has(`“${s}”`)) add(`“${s}”`, step); // short bold phrases
  }
  console.log(`\n${path}: ${found.size} candidate${found.size === 1 ? "" : "s"} (define in src/lib/concepts.ts, or leave if plain English)`);
  for (const [w, steps] of [...found].sort()) console.log(`  ${w.padEnd(32)} ${[...steps].join(", ")}`);
}
