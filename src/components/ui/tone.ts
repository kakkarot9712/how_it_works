/**
 * The shared status palette. Every component that colours something by state
 * (pills, stats, SVG fills, log entries) maps a Tone through these tables, so
 * "warn" means the same yellow everywhere. Classes are literal for Tailwind.
 */
export type Tone = "ok" | "warn" | "err" | "accent" | "muted";

/** Text colour. */
export const toneText: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-warn",
  err: "text-err",
  accent: "text-accent",
  muted: "text-fg-muted",
};

/** Bordered, tinted badge (Pill, Tag). */
export const toneBadge: Record<Tone, string> = {
  ok: "border-ok/40 bg-ok/10 text-ok",
  warn: "border-warn/40 bg-warn/10 text-warn",
  err: "border-err/40 bg-err/10 text-err",
  accent: "border-accent/40 bg-accent/10 text-accent",
  muted: "border-line bg-panel-2 text-fg-muted",
};

/** Left-border accent (log entries, call-outs). */
export const toneBorder: Record<Tone, string> = {
  ok: "border-ok",
  warn: "border-warn",
  err: "border-err",
  accent: "border-accent",
  muted: "border-line",
};

/** CSS colour value, for SVG `fill`/`stroke` attributes and inline styles. */
export const toneColor: Record<Tone, string> = {
  ok: "var(--color-ok)",
  warn: "var(--color-warn)",
  err: "var(--color-err)",
  accent: "var(--color-accent)",
  muted: "var(--color-fg-muted)",
};

/** SVG text/shape fill class. */
export const toneFill: Record<Tone, string> = {
  ok: "fill-ok",
  warn: "fill-warn",
  err: "fill-err",
  accent: "fill-accent",
  muted: "fill-fg-muted",
};

/** Tinted container for an aside that carries a tone (TryIt = accent, warning Callout = warn). */
export const toneSurface: Record<Tone, string> = {
  ok: "border-ok/30 bg-ok/5",
  warn: "border-warn/30 bg-warn/5",
  err: "border-err/30 bg-err/5",
  accent: "border-accent/30 bg-accent/5",
  muted: "border-line bg-panel",
};
