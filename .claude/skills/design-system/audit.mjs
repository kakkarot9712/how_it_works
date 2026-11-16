#!/usr/bin/env node
// Flag UI code that steps outside the design system (tokens in src/app/globals.css).
//
//   node .claude/skills/design-system/audit.mjs     # list violations; exit 1 if any
//
// To allow a deliberate exception, put `design-ok: <reason>` in a comment on the same
// line or the line above. Keep exceptions rare and explained.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../../", import.meta.url).pathname;
const SRC = join(ROOT, "src");

/** SVG canvases and diagrams use the svg type scale; everything else uses the HTML scale. */
const isSvgFile = (f) => /\/canvas\//.test(f) || /Diagram\.tsx$/.test(f);

const HTML_SIZES = "2xs|xs|note|sm|body|base|lg|xl|2xl|3xl|4xl";
const RULES = [
  {
    id: "arbitrary-font-size",
    re: /\btext-\[\d[\d.]*px\]/g,
    why: "use the type scale: text-2xs/xs/note/sm/body/base/lg… (HTML) or text-svg-caption/body/strong/title/display (SVG)",
  },
  {
    id: "raw-colour",
    re: /#[0-9a-fA-F]{3,8}\b(?![\w-])|\brgba?\(|\bhsla?\(|\boklch\(/g,
    why: "colours come from theme tokens (bg, panel, line, fg, accent, ok/warn/err, ch-1..4) or the tone tables",
  },
  {
    id: "palette-colour",
    re: /\b(?:text|bg|border|fill|stroke|ring|outline|decoration|from|to|via|shadow|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?\b/g,
    why: "Tailwind's default palette isn't part of the design: use a theme token or tone",
  },
  {
    id: "arbitrary-colour",
    re: /\b(?:text|bg|border|fill|stroke)-\[(?:#|rgb|hsl|oklch)/g,
    why: "no one-off colours: add a token to globals.css if something is truly new",
  },
  {
    id: "shadow",
    re: /\bshadow-(?!popover\b|drawer\b|none\b)[a-z0-9[\]/.-]+/g,
    why: "only shadow-popover (menus, tooltips, floating toolbars) and shadow-drawer (slide-overs)",
  },
  {
    id: "z-index",
    re: /\bz-(?!(?:10|20|30|40|50)\b)(?:\[\d+\]|\d+)/g,
    why: "z layers: 10 sticky chrome · 20 drawers · 30 menu backdrop · 40 menus · 50 tooltips",
  },
  {
    id: "radius",
    re: /\brounded(?:-[trblse]{1,2})?-(?:\[[^\]]+\]|2xl|3xl|4xl|xs|none)\b/g,
    why: "radius roles: rounded (chips, code) · md (controls) · lg (panels, popovers) · xl (big cards) · full (pills, dots)",
  },
  {
    id: "arbitrary-leading",
    re: /\bleading-\[[^\]]+\]/g,
    why: "use leading-none/tight/snug/normal/relaxed, or leading-prose for long-form text",
  },
  {
    id: "focus-override",
    re: /\bfocus(?:-visible)?:outline(?:-none|-\d|-accent)?\b|\boutline-none\b/g,
    why: "one global :focus-visible ring; don't remove or restyle it (except a container that manages focus with aria-activedescendant)",
  },
  {
    id: "uppercase-label",
    re: /\buppercase\b/g,
    why: "uppercase labels are <Eyebrow> (md for block headings, sm for value labels)",
    skip: (f) => isSvgFile(f) || f.endsWith("ui/Eyebrow.tsx"),
  },
  {
    id: "svg-size-in-html",
    re: /\btext-svg-[a-z]+\b/g,
    why: "text-svg-* is for SVG <text> only",
    skip: (f) => isSvgFile(f),
  },
  {
    id: "html-size-in-svg",
    re: new RegExp(`\\btext-(?:${HTML_SIZES})\\b`, "g"),
    why: "SVG text uses text-svg-*; HTML sizes don't scale with the viewBox the same way",
    skip: (f) => !isSvgFile(f),
  },
  {
    id: "hand-built-surface",
    re: /className="[^"]*\brounded(?:-(?:md|lg|xl))?\b[^"]*\bborder-line\b[^"]*\bbg-panel(?:-2)?\b[^"]*"|className="[^"]*\bbg-panel(?:-2)?\b[^"]*\bborder-line\b[^"]*\brounded(?:-(?:md|lg|xl))?\b[^"]*"/g,
    why: "bordered boxes are <Surface> (or surfaceClass() on a Link): level, radius, elevated, interactive, tone",
    skip: (f) => f.includes("components/ui/"),
  },
  {
    id: "hand-built-heading",
    re: /className="[^"]*\btext-(?:lg|2xl|3xl|4xl)\b[^"]*\bfont-semibold\b[^"]*"|className="[^"]*\bfont-semibold\b[^"]*\btext-(?:lg|2xl|3xl|4xl)\b[^"]*"/g,
    why: "headings are <Heading level=display|title|section|card|panel|item>",
    skip: (f) => f.includes("components/ui/") || f.endsWith("writeup/Prose.tsx"),
  },
  {
    id: "hand-built-icon-button",
    re: /<button[^>]*className="[^"]*\bh-7 w-7\b/g,
    why: "glyph buttons are <IconButton label=…>",
    skip: (f) => f.includes("components/ui/"),
  },
  {
    id: "page-container",
    re: /\bmx-auto\b[^"]*\bmax-w-6xl\b|\bmax-w-6xl\b[^"]*\bmx-auto\b/g,
    why: "page width is <Container>",
    skip: (f) => f.includes("components/ui/"),
  },
  {
    id: "hand-rolled-scrollbar",
    re: /\[scrollbar-(?:width|color):/g,
    why: "use the scrollbar-thin utility",
  },
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

const out = [];
for (const file of files(SRC)) {
  const rel = relative(ROOT, file);
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (/design-ok:/.test(line) || /design-ok:/.test(lines[i - 1] ?? "")) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments
    for (const rule of RULES) {
      if (rule.skip?.(rel)) continue;
      for (const m of line.matchAll(rule.re)) out.push({ rel, line: i + 1, rule, hit: m[0] });
    }
  });
}

if (out.length === 0) {
  console.log("✓ No design-system violations.");
} else {
  const byRule = Map.groupBy ? Map.groupBy(out, (o) => o.rule.id) : out.reduce((m, o) => m.set(o.rule.id, [...(m.get(o.rule.id) ?? []), o]), new Map());
  for (const [id, hits] of byRule) {
    console.log(`\n${id}: ${hits[0].rule.why}`);
    for (const h of hits) console.log(`  ${h.rel}:${h.line}  ${h.hit}`);
  }
  console.log(`\n${out.length} violation(s). Fix them, or mark a deliberate exception with a "design-ok: <reason>" comment.`);
  process.exit(1);
}
