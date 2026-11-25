/**
 * Finds the terms a page shows users that need a source (source-facts skill): commands,
 * options and codes in caps, and kebab-case config names in code spans. Used by the
 * sources tests for sims (src/sims/sources.test.ts) and paths (src/paths/paths.test.ts).
 * Node-only (reads files); never import it from app code.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { GLOSSARY } from "@/lib/glossary";

/** All-caps words that are plain UI or English, not product terms needing a source. Keep reasons short. */
export const NOT_TERMS = new Set([
  "DOWN", "PROCESS", // "PROCESS DOWN" overlay
  "SVG", "CSS", "URL", "HTML", "JSON", "API", "INPUT", "TEXTAREA", "SELECT", "STATS", // UI / code words
]);

export function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== "sources.ts" ? [p] : [];
  });
}

/** Text a user could read: string literals and JSX text, minus imports, comments and class lists (as the glossary audit). */
export function readableText(src: string): string {
  const out: string[] = [];
  const clean = src
    .replace(/^import .*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  for (const m of clean.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
    const s = (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, " ");
    if (/^[a-z0-9:\-[\]/_.% ]*$/.test(s) && !/\s[A-Z]/.test(s)) continue;
    out.push(s);
  }
  for (const m of clean.matchAll(/(?<![=-])>([^<>{}]+)</g)) if (!/[;=]|&&|\|\|/.test(m[1])) out.push(m[1]);
  return out.join("\n");
}

/** Code spans: <code>…</code>, `…` in strings, and <ConfigLine>…</ConfigLine>. Config names live here. */
export function codeSpans(src: string): string {
  const spans = [
    ...[...src.matchAll(/<code[^>]*>([\s\S]*?)<\/code>/g)].map((m) => m[1]),
    ...[...src.matchAll(/<ConfigLine>([\s\S]*?)<\/ConfigLine>/g)].map((m) => m[1]),
    ...[...src.matchAll(/(?<![\w$])`([^`\n$]+)`/g)].map((m) => m[1]),
  ];
  return spans.join("\n");
}

/** Terms shown to users that must be backed by a reference: commands/options/codes in caps, and kebab-case config names in code. */
export function termsIn(src: string): Set<string> {
  const terms = new Set<string>();
  for (const [t] of readableText(src).matchAll(/\b[A-Z][A-Z0-9]{2,}\b/g)) if (!NOT_TERMS.has(t) && !GLOSSARY[t] && !/^[A-Z]\d+$/.test(t)) terms.add(t); // skip SVG path commands (M300, L10)
  for (const [t] of codeSpans(src).matchAll(/\b[a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)+\b/g)) terms.add(t);
  return terms;
}

