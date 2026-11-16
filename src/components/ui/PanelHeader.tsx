import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * The header row of a panel, drawer or menu: content on the left, actions on the right,
 * with a divider below. `compact` for menus; `divider={false}` when a list follows directly.
 */
export function PanelHeader({
  children,
  actions,
  compact,
  divider = true,
}: {
  children: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
  divider?: boolean;
}) {
  return (
    <div className={cx("flex items-center justify-between gap-3 px-4", compact ? "py-2" : "py-3", divider && "border-b border-line")}>
      <div className="min-w-0">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
