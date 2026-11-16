"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { cx, Eyebrow, gloss, Kbd, PanelHeader, surfaceClass, Tag } from "@/components/ui";
import type { AnySimDefinition } from "@/sims/types";

function StepButton({
  children,
  disabled,
  onClick,
  label,
}: {
  children: string;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex w-8 shrink-0 items-center justify-center text-lg leading-none text-fg-muted transition-colors hover:bg-panel hover:text-fg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg-muted"
    >
      {children}
    </button>
  );
}

/** What a scenario changes about the system: lego blocks it adds or removes. */
function blockChanges(def: AnySimDefinition, sc: AnySimDefinition["scenarios"][number]) {
  return def.components.flatMap((c) => {
    const on = sc.components?.[c.key];
    if (on === undefined || on === def.defaults.components[c.key]) return [];
    return [{ key: c.key, label: c.label, on: Boolean(on) }];
  });
}

/**
 * Scenario switcher: ‹ / › steppers around a button that opens a keyboard-driven list
 * (↑↓, Enter, 1–9, Esc). Rows show each scenario's summary and the blocks it adds or removes.
 */
export function ScenarioPicker({
  def,
  current,
  onPick,
}: {
  def: AnySimDefinition;
  current: number;
  onPick: (i: number) => void;
}) {
  const { scenarios } = def;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(current);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const num = (i: number) => String(i + 1).padStart(2, "0");

  const show = () => {
    setActive(current);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  const pick = (i: number) => {
    close();
    if (i !== current) onPick(i);
  };

  // Focus the list on open; keep the highlighted row in view.
  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKey = (e: KeyboardEvent) => {
    // The menu owns the keyboard while open (Space must not toggle play).
    e.stopPropagation();
    const last = scenarios.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      close();
    } else if (/^[1-9]$/.test(e.key) && Number(e.key) <= scenarios.length) {
      pick(Number(e.key) - 1);
    }
  };

  return (
    <div className="relative min-w-0">
      <div
        className={cx(
          "flex min-w-0 items-stretch overflow-hidden rounded-lg border bg-panel-2 transition-colors",
          open ? "border-accent/60" : "border-line hover:border-fg-muted/60",
        )}
      >
        <StepButton disabled={current === 0} onClick={() => onPick(current - 1)} label="Previous scenario ( [ )">
          ‹
        </StepButton>
        <button
          ref={trigger}
          type="button"
          onClick={() => (open ? close(false) : show())}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              show();
            }
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={`${scenarios[current].title} · all scenarios`}
          className="relative flex min-w-0 items-center gap-2.5 border-x border-line px-3 py-1.5 text-left hover:bg-panel focus-visible:bg-panel"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Eyebrow as="span" size="sm" className="tabular-nums">
              Scenario <span className="text-accent">{current + 1}</span> of {scenarios.length}
            </Eyebrow>
            {/* Every title is stacked in one grid cell (only the current one visible), so the
                control is as wide as the longest title and the › arrow never moves. */}
            <span className="grid min-w-0">
              {scenarios.map((sc, i) => (
                <span
                  key={sc.id}
                  aria-hidden={i !== current}
                  className={cx(
                    "min-w-0 truncate text-body font-semibold leading-snug text-fg [grid-area:1/1]",
                    i !== current && "invisible",
                  )}
                >
                  {sc.title}
                </span>
              ))}
            </span>
          </span>
          <span
            aria-hidden
            className={cx("shrink-0 text-2xs text-fg-muted transition-transform", open && "rotate-180")}
          >
            ▼
          </span>
          {/* progress through the scenario list */}
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-line/60">
            <span
              className="block h-full bg-accent/70 transition-[width] duration-300"
              style={{ width: `${((current + 1) / scenarios.length) * 100}%` }}
            />
          </span>
        </button>
        <StepButton
          disabled={current === scenarios.length - 1}
          onClick={() => onPick(current + 1)}
          label="Next scenario ( ] )"
        >
          ›
        </StepButton>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => close(false)} />
          <div
            className={surfaceClass(
              { elevated: true },
              "absolute left-0 top-full z-40 mt-1.5 flex max-h-[min(60vh,520px)] w-[min(540px,calc(100vw-2rem))] flex-col overflow-hidden",
            )}
          >
            <PanelHeader
              compact
              actions={
                <span className="flex items-center gap-1 text-2xs text-fg-muted">
                  <Kbd>↑↓</Kbd> move <Kbd>↵</Kbd> load <Kbd>1–{Math.min(9, scenarios.length)}</Kbd> jump <Kbd>Esc</Kbd>
                </span>
              }
            >
              <Eyebrow as="span">{scenarios.length} scenarios</Eyebrow>
            </PanelHeader>
            <ul
              ref={list}
              role="listbox"
              tabIndex={-1}
              aria-label="Scenarios"
              aria-activedescendant={`scenario-opt-${active}`}
              onKeyDown={onKey}
              // design-ok: focus is shown by the highlighted row (aria-activedescendant), not a ring
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 outline-none scrollbar-thin"
            >
              {scenarios.map((s, i) => {
                const changes = blockChanges(def, s);
                const isCurrent = i === current;
                return (
                  <li
                    key={s.id}
                    id={`scenario-opt-${i}`}
                    data-idx={i}
                    role="option"
                    aria-selected={isCurrent}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(i)}
                    className={cx(
                      "relative cursor-pointer rounded-md border-l-2 py-2 pl-3 pr-3 transition-colors",
                      isCurrent ? "border-accent" : "border-transparent",
                      i === active ? "bg-panel-2" : isCurrent && "bg-accent/5",
                    )}
                  >
                    <div className="flex items-baseline gap-2.5">
                      <span
                        className={cx("w-5 shrink-0 font-mono text-xs", isCurrent ? "text-accent" : "text-fg-muted")}
                      >
                        {num(i)}
                      </span>
                      <span className={cx("min-w-0 flex-1 text-sm font-medium", isCurrent ? "text-accent" : "text-fg")}>
                        {s.title}
                      </span>
                      {isCurrent && (
                        <Eyebrow as="span" size="sm" tone="accent" className="shrink-0">
                          ▶ playing
                        </Eyebrow>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 pl-[30px] text-note leading-snug text-fg-muted">{gloss(s.summary, { focusable: false })}</p>
                    {changes.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 pl-[30px]">
                        {changes.map((c) => (
                          <Tag
                            key={c.key}
                            tone={c.on ? "ok" : "err"}
                            tip={c.on ? "This scenario adds this building block." : "This scenario removes this building block."}
                            tipFocusable={false}
                          >
                            {c.on ? "+" : "−"} {c.label}
                          </Tag>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
