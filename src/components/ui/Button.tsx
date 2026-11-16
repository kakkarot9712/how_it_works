import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type ButtonTone = "default" | "primary" | "danger" | "ghost";

/** Class list for anything that should look like a button (Button, LinkButton). */
export function buttonClass(tone: ButtonTone = "default", className?: string, size: "md" | "lg" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors",
    size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-note",
    "disabled:cursor-not-allowed disabled:opacity-40",
    tone === "default" && "border-line bg-panel-2 text-fg hover:border-fg-muted",
    tone === "primary" && "border-accent/50 bg-accent/15 text-accent hover:bg-accent/25",
    tone === "danger" && "border-err/50 bg-err/10 text-err hover:bg-err/20",
    tone === "ghost" && "border-transparent text-fg-muted hover:text-fg",
    className,
  );
}

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
  tone?: ButtonTone;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button type="button" title={title} disabled={disabled} onClick={onClick} className={buttonClass(tone, className)}>
      {children}
    </button>
  );
}
