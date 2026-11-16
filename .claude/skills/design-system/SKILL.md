---
name: design-system
description: The syswork design system - colour roles, tones, type scales (HTML and SVG), spacing, radius, elevation, z-layers, states, focus, motion, glyphs, copy style and layout widths - plus an audit script that flags UI code stepping outside it. Use whenever adding or changing anything visual in syswork (a page, the player, a canvas, an inspector, a write-up, a diagram), when something "looks off" or inconsistent, when adding a design token, and before reporting UI work as done.
---

# syswork design system

One dark, console-like visual language across the site, the player, every sim's canvas and every write-up. **Tokens** live in `src/app/globals.css`, and **components** that apply them live in `src/components/` (see the `ui-components` skill). This skill says which token to use when. The audit enforces it:

```bash
node .claude/skills/design-system/audit.mjs   # exit 1 + list on any violation
```

Prefer a component over raw classes. The design-system components in `@/components/ui` already apply the rules below:

| Need | Component (not raw classes) |
| --- | --- |
| A bordered box: card, panel, figure, table, callout, stat, popover, tooltip, toolbar, chip | `Surface` / `surfaceClass()` |
| A heading | `Heading level=…` |
| Page width | `Container` |
| The header row of a panel, drawer or menu | `PanelHeader` |
| An action / a link that looks like one / a glyph-only action | `Button` / `LinkButton` / `IconButton` |
| One-of-few choice / on-off / a number | `SegmentedControl` / `Toggle` / `Slider` |
| Status / label / uppercase label | `Pill` / `Tag` / `Eyebrow` |
| A labelled number / help line / key hint | `Stat` / `Help` / `Kbd` |
| An acronym | automatic via `gloss()` (see the `glossary` skill) |

When you do write classes (layout, padding, one-off structure), use only what's below. If you need something new, add a token here and in `globals.css`. Never add a one-off value.

## Colour

| Token | Role |
| --- | --- |
| `bg` | Page background, the canvas, insets (bar tracks, code blocks, packet pills) |
| `panel` | Panels, cards, primary canvas nodes |
| `panel-2` | Raised: controls, nested nodes, stats, popovers, tooltips |
| `line` | Borders, dividers, wires, empty tracks |
| `fg` | Primary text and values |
| `fg-muted` | Secondary text, labels, help |
| `accent` | Interactive, selected, current, brand. **Not** a state colour |
| `ok` / `warn` / `err` | State: healthy, degraded (watch it), broken or lost |
| `ch-1..ch-4` | Kinds of traffic (one per channel, topic or partition), mapped in each sim's `theme.ts` |

- State colours always go through a **Tone** (`ok | warn | err | accent | muted`) and the tables in `@/components/ui`: `toneText`, `toneFill` (SVG class), `toneColor` (CSS var for SVG attributes), `toneBadge` (pills/tags), `toneBorder` (left accents), `toneSurface` (tinted asides).
- Meaning is never colour alone: pair it with text ("● down", "half-open", "✕").
- Tints use the token's alpha: `/5` tinted surface, `/10–15` badge or button fill, `/30` tinted-surface border, `/50–60` emphasised border, `/40` toggle track. For a selected or hover border, use `accent/60`.
- No hex, `rgb()`, Tailwind palette colours (`red-500`) or arbitrary colours. The audit fails them.

## Type

**HTML scale** (sans unless noted):

| Class | Size | Use |
| --- | --- | --- |
| `text-2xs` | 11 | Value labels (`Eyebrow size="sm"`: stat names, node kinds), tags, kbd hints |
| `text-xs` | 12 | Block labels (`Eyebrow`), timestamps, meta |
| `text-note` | 13 | Help lines (`Help`), narration detail, secondary panel text, buttons |
| `text-sm` | 14 | Default UI text: panel body, list rows, narration headlines |
| `text-body` | 15 | Write-up secondary text: walkthrough body, TryIt, configs, fact values |
| `text-base` | 16 | Long-form prose (`Prose`, with `leading-prose`) |
| `text-lg` | 18 | Card titles, write-up h3, hero lede |
| `text-2xl` / `3xl` / `4xl` | 24/30/36 | Section titles / topic page title / page hero |

**SVG scale** (viewBox units, for a ~1160-wide canvas or a ~780-wide diagram):

| Class | Units | Use |
| --- | --- | --- |
| `text-svg-caption` | 12.5 | Uppercase section labels inside a node, footnotes |
| `text-svg-body` | 13.5 | Labels, values, status lines, packet pills (the default) |
| `text-svg-strong` | 15.5 | Key values that must read first (channel names), ✕ marks |
| `text-svg-title` | 19 | Node titles |
| `text-svg-display` | 22 | Full-node overlays ("PROCESS DOWN") |

Rules:
- HTML classes in HTML, `text-svg-*` in SVG only. The audit checks files under `canvas/` and `*Diagram.tsx` as SVG.
- **Mono** (`font-mono`) for machine text: commands, config, values with units, counters, timestamps, channel names, wire formats. **Sans** for prose and UI labels.
- Weights: `font-semibold` for titles and block labels, `font-medium` for control labels and list titles, normal otherwise.
- Uppercase only via `Eyebrow` (`tracking-wider`). Sentence case everywhere else, including buttons and headings.
- Line height: `leading-snug` for dense UI (help, rows), `leading-relaxed` for summaries, `leading-prose` (1.8) for long-form. The custom sizes inherit line height.
- `text-[0.88em]` (relative inline code in `Rich`) is the one allowed arbitrary size, marked `design-ok`.

## Space, radius, elevation, layers

- **Spacing** is Tailwind's 4px scale.
  - Panels: `px-4 py-3`. Cards: `px-5 py-4`.
  - Controls: `px-3 py-1.5` (`Button`); large calls to action `px-4 py-2` (`size="lg"`).
  - Gaps: `gap-1.5` inside a control group, `gap-3` between controls, `space-y-12` between write-up sections, `gap-12` between page columns.
- **Radius** by role:
  - `rounded`: chips, inline code, slots.
  - `rounded-md`: controls, stats, log rows.
  - `rounded-lg`: panels, popovers, figures, callouts.
  - `rounded-xl`: big cards (SimCard, walkthroughs).
  - `rounded-full`: pills, dots, toggles.
  - SVG: `rx` 12 for nodes, 10 for nested nodes, 2–4 for slots and bars, 11 for packet pills.
- **Elevation**: only things floating above the page get a shadow. `shadow-popover` for menus, tooltips and floating toolbars; `shadow-drawer` for slide-overs. Cards are flat (a border, no shadow).
- **Layers**: `z-10` sticky page chrome · `z-20` drawers over the canvas · `z-30` a menu's click-away backdrop · `z-40` menus and popovers · `z-50` tooltips (portalled). Nothing else.

## States and interaction

- **Hover:** a bordered card or control goes `border-line` → `hover:border-fg-muted` (controls) or `hover:border-accent/60` (navigable cards). Ghost items: `text-fg-muted` → `hover:text-fg`. A row inside a list or menu: `hover:bg-panel-2`.
- **Selected or current:** an accent border or left bar plus accent text (picker row, canvas node `stroke-accent` 2.5, TOC item). Not a fill colour alone.
- **Disabled:** `opacity-40` and `cursor-not-allowed` (built into `Button`).
- **Danger** ("break it" actions): `Button tone="danger"` or `Toggle tone="danger"`.
- **Focus:** one global `:focus-visible` ring (2px accent, 2px offset) in `globals.css`. Don't remove or restyle it. The only exception is a container that shows focus another way (a listbox with `aria-activedescendant`), marked `design-ok`.
- **Motion:** colour, opacity and transform transitions only (`transition-colors`, `transition-opacity`, `transition-transform`, default duration; `duration-300` for progress bars). No bouncing, no motion that carries meaning. The simulation's own animation is the only movement that matters.
- **Scrolling panels and menus:** the `scrollbar-thin` utility.
- **Glyphs** instead of an icon library: ▶ play/run, ❚❚ pause, ⏮ restart, ‹ › step, ▼ menu, ✕ close or cut, ⚙ settings, ⧉ copy link, ↓ → navigation, ● status dot, ▸ list bullet. Reuse these; don't add an icon set.

## Layout

- **Site pages:** `max-w-6xl mx-auto px-6`.
- **Write-up:** `WriteupGrid` (200px contents rail from `xl`, a text column capped at `max-w-3xl`).
- **Player:** canvas column + a 360px right column (inspector above narration, the narration never below 200px). The drawer is 320px. Header and footer bars are `border-line` separated.
- **Canvas:** viewBox ~1160×760, top-left kept clear for zoom controls. Legible at fit on 1280×800 (AGENTS.md rule 9).
- **Phones:** HTML must work at 390px with no horizontal page scroll. Wide content (SVG figures, tables) scrolls inside its own container (`Figure`, `Compare`). The player is desktop-first (rule 6), but don't hard-code anything that blocks a stacked layout.

## Copy style (UI text)

Short, concrete and active. Sentence case. Say what happens, not what the UI is ("Packets vanish. Neither side is told."). Real names in mono (`client-output-buffer-limit`, `PUBLISH`). Acronyms get glossary entries (`glossary` skill).

## Changing the system

1. **Need a value the scales don't have?** Check whether an existing step fits; usually one does. If it's truly new and will recur, add a token to `@theme` in `globals.css` with a comment saying its role, add it to the tables above, and add or relax the audit rule if needed.
2. **Changing a token's value** changes it everywhere. Screenshot the simulator, the menu, the write-up and the home page before and after.
3. **A deliberate one-off:** add a `design-ok: <reason>` comment on the line (or the line above). Keep these rare. Each one is a candidate for a token.
4. **A pattern repeated twice** (same classes for the same role) becomes a component in `src/components/ui/` that takes intent props (`level`, `tone`, `size`), plus a row in the table above and in `ui-components`. If it's a structural pattern (a bordered box, a heading), add an audit rule so hand-built copies get flagged.

## What the audit checks

- **Off-scale values:** off-scale font sizes, raw or default-palette colours, arbitrary colours, shadows other than popover/drawer, z-index outside 10–50, off-role radii, arbitrary line height.
- **Mixed scales:** HTML sizes in SVG files and `text-svg-*` outside them.
- **Overrides:** removed or restyled focus rings, and hand-rolled scrollbars.
- **Rebuilt components:** hand-written uppercase labels (use `Eyebrow`), bordered boxes (use `Surface`), headings (use `Heading`), `h-7 w-7` glyph buttons (use `IconButton`), and `mx-auto max-w-6xl` (use `Container`).

`components/ui/` itself is exempt from the "rebuilt components" rules: that's where the patterns live.

## Verify

1. `node .claude/skills/design-system/audit.mjs` passes.
2. `pnpm typecheck && pnpm lint && pnpm build`.
3. Screenshots with the `verify-simulation` skill's `shot.mjs`: the simulator (1280×800 and 1440×900), the open scenario menu (`--click`), a tooltip (`--hover`), the write-up (1440 and 390 wide, `--full`), the home page, and a keyboard focus state (`--keys=Tab,Tab`). Check type sizes match their role, nothing has a stray colour or shadow, and focus is visible.
