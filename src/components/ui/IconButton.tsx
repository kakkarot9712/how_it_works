import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * A square button showing a glyph (✕, −, +, ⏮). `label` is required: it's the tooltip and the
 * accessible name, since the glyph alone says nothing to a screen reader.
 */
export function IconButton({
  label,
  onClick,
  disabled,
  size = "md",
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  /** sm 28px (toolbars) · md 32px (panel headers, control rows). */
  size?: "sm" | "md";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-md leading-none text-fg-muted transition-colors hover:bg-panel-2 hover:text-fg",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent",
        size === "sm" ? "h-7 w-7 text-base" : "h-8 w-8 text-sm",
      )}
    >
      {children}
    </button>
  );
}
