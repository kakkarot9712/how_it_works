"use client";

import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export { cx };

export function Button({
  children,
  onClick,
  tone = "default",
  disabled,
  title,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "primary" | "danger" | "ghost";
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        tone === "default" && "border-line bg-panel-2 text-fg hover:border-fg-muted",
        tone === "primary" && "border-accent/50 bg-accent/15 text-accent hover:bg-accent/25",
        tone === "danger" && "border-err/50 bg-err/10 text-err hover:bg-err/20",
        tone === "ghost" && "border-transparent text-fg-muted hover:text-fg",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  help,
  tone = "default",
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  help?: ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <span
        className={cx(
          "relative mt-0.5 inline-flex h-[18px] w-8 shrink-0 rounded-full border transition-colors",
          checked
            ? tone === "danger"
              ? "border-err/60 bg-err/40"
              : "border-accent/60 bg-accent/40"
            : "border-line bg-panel-2",
        )}
      >
        <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span
          className={cx(
            "absolute top-[1px] h-3.5 w-3.5 rounded-full bg-fg transition-all",
            checked ? "left-[15px]" : "left-[1px] opacity-60",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {help && <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">{help}</span>}
      </span>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  help,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  help?: ReactNode;
}) {
  return (
    <label className="block py-1.5">
      <span className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-fg">{label}</span>
        <span className="font-mono text-fg-muted">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--color-accent)]"
      />
      {help && <span className="block text-[13px] leading-snug text-fg-muted">{help}</span>}
    </label>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "ok" | "warn" | "err" }) {
  return (
    <div className="rounded-md border border-line bg-panel-2 px-2 py-1.5">
      <div className="text-[11px] uppercase tracking-wide text-fg-muted">{label}</div>
      <div
        className={cx(
          "font-mono text-base",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
          tone === "err" && "text-err",
          !tone && "text-fg",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "ok" | "warn" | "err" | "muted" | "accent" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone === "ok" && "border-ok/40 bg-ok/10 text-ok",
        tone === "warn" && "border-warn/40 bg-warn/10 text-warn",
        tone === "err" && "border-err/40 bg-err/10 text-err",
        tone === "accent" && "border-accent/40 bg-accent/10 text-accent",
        tone === "muted" && "border-line bg-panel-2 text-fg-muted",
      )}
    >
      {children}
    </span>
  );
}
