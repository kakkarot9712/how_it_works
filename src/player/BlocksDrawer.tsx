"use client";

import { Button, Heading, IconButton, PanelHeader, Section, Slider, Toggle } from "@/components/ui";
import type { AnySimDefinition } from "@/sims/types";

/**
 * Slide-over panel with the sim's lego blocks (components) and numeric settings.
 * Any change rebuilds the run from t=0.
 */
export function BlocksDrawer({
  def,
  settings,
  components,
  customized,
  onSetting,
  onComponent,
  onReset,
  onClose,
}: {
  def: AnySimDefinition;
  settings: Record<string, number>;
  components: Record<string, boolean>;
  customized: boolean;
  onSetting: (key: string, v: number) => void;
  onComponent: (key: string, v: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <aside className="absolute inset-y-0 left-0 z-20 w-[320px] overflow-y-auto border-r border-line bg-panel shadow-drawer">
      <PanelHeader
        actions={
          <>
            {customized && (
              <Button tone="ghost" onClick={onReset}>
                Reset
              </Button>
            )}
            <IconButton label="Close" onClick={onClose}>
              ✕
            </IconButton>
          </>
        }
      >
        <Heading level="item">Building blocks & settings</Heading>
      </PanelHeader>
      <Section title="Building blocks">
        <p className="mb-2 text-note leading-snug text-fg-muted">
          Pull a part out to see what it was doing. Changing anything here restarts the run.
        </p>
        {def.components.map((c) => (
          <Toggle
            key={c.key}
            label={c.label}
            help={c.help}
            checked={Boolean(components[c.key])}
            onChange={(v) => onComponent(c.key, v)}
          />
        ))}
      </Section>
      <Section title="Settings">
        {def.settings.map((d) => (
          <Slider
            key={d.key}
            label={d.label}
            value={settings[d.key]}
            min={d.min}
            max={d.max}
            step={d.step}
            unit={d.unit}
            help={d.help}
            onChange={(v) => onSetting(d.key, v)}
          />
        ))}
      </Section>
    </aside>
  );
}
