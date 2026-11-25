#!/usr/bin/env node
// Find all-caps tokens in user-facing text that have no glossary entry.
//
//   node .claude/skills/glossary/audit.mjs            # report; exit 1 if anything is missing
//   node .claude/skills/glossary/audit.mjs --all      # also list every glossed term and where it's used
//
// Scans string literals and JSX text in src/ (not tests). Tokens that are commands,
// units or other non-acronyms go in NOT_ACRONYMS below, with a reason, instead of the glossary.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../../", import.meta.url).pathname;
const SRC = join(ROOT, "src");

/** All-caps words that are not acronyms readers need explained. Keep reasons short. */
const NOT_ACRONYMS = new Set([
  // kafka-consumer-groups.sh --describe column headers (tool output, shown verbatim)
  "TOPIC", "PARTITION", "PARTITIONS", "CURRENT", "OFFSET", "LOG", "END", "LAG", "CONSUMER",
  // Redis commands (shown in code style; documented by Redis itself)
  "PUBLISH", "SUBSCRIBE", "PSUBSCRIBE", "UNSUBSCRIBE", "PUNSUBSCRIBE", "SSUBSCRIBE", "SPUBLISH", "SUNSUBSCRIBE",
  "PING", "RESET", "QUIT", "CLIENT", "KILL", "HELLO", "XADD", "XREAD", "XREADGROUP", "XACK", "XCLAIM",
  "BLOCK", // XREAD/XREADGROUP option
  // Redis Streams commands, subcommands and options
  "XAUTOCLAIM", "XPENDING", "XGROUP", "XINFO", "XLEN", "XTRIM", "XDEL", "XRANGE", "XACKDEL", "XDELEX", "XNACK",
  "CREATE", "GROUP", "GROUPS", "STREAMS", "COUNT", "NOACK", "CLAIM", "MKSTREAM", "MAXLEN", "MINID", "JUSTID",
  "KEEPREF", "DELREF", "ACKED", "BUSYGROUP", "ENTRIESREAD", "LIMIT", "MAXCOUNT", "MAXSIZE", "NOMKSTREAM", "SETID",
  "FAQ", // plain English in a page title ("Redis FAQ")
  // SQL keywords and PostgreSQL message severities (shown in code style; documented by PostgreSQL itself)
  "BEGIN", "COMMIT", "ROLLBACK", "TRANSACTION", "WORK", "ISOLATION", "LEVEL", "READ", "COMMITTED", "UNCOMMITTED", "REPEATABLE",
  "SERIALIZABLE", "ONLY", "DEFERRABLE", "UPDATE", "INSERT", "INTO", "VALUES", "DEFAULT", "DELETE", "MERGE", "FROM", "WHERE",
  "SET", "FOR", "NO", "KEY", "SHARE", "LOCK", "TABLE", "FETCH", "COPY", "VACUUM", "ERROR", "FATAL", "WARNING", "HINT", "DETAIL",
  // The Kafka wiki's space key in cwiki.apache.org/confluence/display/KAFKA/ URLs (sources.ts)
  "KAFKA",
  // HTTP request methods (shown in code style; documented by nginx's proxy_next_upstream)
  "POST", "PATCH",
  // Units and plain words in caps
  "KB", "MB", "GB", "ASAP", "DOWN", "PROCESS", "OK", "ID",
  // UI / code words that end up in strings (class names, keys, element names)
  "INPUT", "TEXTAREA", "SELECT", "SVG", "CSS", "URL", "UI", "STATS", "HTML", "JSON", "API",
]);

process.removeAllListeners("warning"); // Node notes it is parsing a .ts file as ESM; harmless here
const { GLOSSARY } = await import(join(SRC, "lib/glossary.ts")).catch(async () => {
  // Plain node can't import .ts: read the keys straight from the source.
  const text = readFileSync(join(SRC, "lib/glossary.ts"), "utf8");
  const body = text.slice(text.indexOf("GLOSSARY"), text.indexOf("};", text.indexOf("GLOSSARY")));
  return { GLOSSARY: Object.fromEntries([...body.matchAll(/^\s{2}([A-Z][A-Z0-9]+):/gm)].map((m) => [m[1], true])) };
});

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !p.endsWith("lib/glossary.ts")) yield p;
  }
}

/** Text a user could read: string literals and JSX text, minus imports and class lists. */
function readableText(src) {
  const out = [];
  const noImports = src
    .replace(/^import .*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "") // block and JSX comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
  for (const m of noImports.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
    const s = (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, " "); // drop ${code} in templates
    if (/^[a-z0-9:\-[\]/_.% ]*$/.test(s) && !/\s[A-Z]/.test(s)) continue; // class lists, keys, paths
    out.push(s);
  }
  // JSX text: between a tag's ">" (not an arrow "=>") and the next "<".
  // Skip fragments that look like code (generics like useState<View>(FIT); …).
  for (const m of noImports.matchAll(/(?<![=-])>([^<>{}]+)</g)) if (!/[;=]|&&|\|\|/.test(m[1])) out.push(m[1]);
  return out.join("\n");
}

const missing = new Map(); // token -> Set<file>
const used = new Map();
for (const file of files(SRC)) {
  const text = readableText(readFileSync(file, "utf8"));
  for (const [tok] of text.matchAll(/\b[A-Z][A-Z0-9]{1,}\b/g)) {
    const rel = relative(ROOT, file);
    if (GLOSSARY[tok]) (used.get(tok) ?? used.set(tok, new Set()).get(tok)).add(rel);
    else if (!NOT_ACRONYMS.has(tok) && !/^[A-Z]\d+$/.test(tok)) (missing.get(tok) ?? missing.set(tok, new Set()).get(tok)).add(rel);
  }
}

// SVG text can't hold <Term> tooltips. Every <text> in a canvas or diagram that shows a glossary
// term must carry a native tooltip: <title>{glossaryTitles(…)}</title> (or glossaryTitle).
const termRe = new RegExp(`\\b(${Object.keys(GLOSSARY).sort((a, b) => b.length - a.length).join("|")})(?=s?\\b)`);
const svgMissing = [];
for (const file of files(SRC)) {
  if (!/\/canvas\/|Diagram\.tsx$/.test(file)) continue;
  const src = readFileSync(file, "utf8").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  for (const m of src.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)) {
    const t = m[1].match(termRe);
    if (t && !m[1].includes("<title>")) {
      const line = src.slice(0, m.index).split("\n").length;
      svgMissing.push(`  ${t[1].padEnd(14)} ${relative(ROOT, file)}:${line}`);
    }
  }
}

if (process.argv.includes("--all")) {
  console.log("Glossed terms in use:");
  for (const [t, f] of [...used].sort()) console.log(`  ${t.padEnd(14)} ${[...f].join(", ")}`);
  const unused = Object.keys(GLOSSARY).filter((t) => !used.has(t));
  if (unused.length) console.log(`Glossary entries not used in src/ yet: ${unused.join(", ")}`);
  console.log();
}

if (svgMissing.length) {
  console.log("SVG text showing a glossary term without a tooltip (add <title>{glossaryTitles(text)}</title> inside the <text>):");
  for (const l of svgMissing) console.log(l);
  process.exitCode = 1;
}
if (missing.size === 0) {
  console.log("✓ Every all-caps token in user-facing text is glossed or listed as not an acronym.");
} else {
  console.log("Not in the glossary (add to src/lib/glossary.ts, or to NOT_ACRONYMS in this script with a reason):");
  for (const [t, f] of [...missing].sort()) console.log(`  ${t.padEnd(14)} ${[...f].join(", ")}`);
  process.exit(1);
}
