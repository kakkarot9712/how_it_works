"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The scenario's "flow to watch": the node ids in the current flow step (see
 * `Scenario.flow`). The Player provides it around the Canvas; NodeBox (`id`), Wire
 * and Packet (`ends`) read it to spotlight the flow and dim everything else.
 * `null` means no spotlight: everything is drawn normally.
 */
const FocusContext = createContext<ReadonlySet<string> | null>(null);

export function FocusProvider({ nodes, children }: { nodes: ReadonlySet<string> | null; children: ReactNode }) {
  return <FocusContext.Provider value={nodes}>{children}</FocusContext.Provider>;
}

/**
 * `"on"` when every id is in the current flow step, `"off"` when a spotlight is active
 * and any id is outside it, `null` when there is no spotlight or no ids were given.
 */
export function useFocus(ids: readonly (string | undefined)[] | undefined): "on" | "off" | null {
  const nodes = useContext(FocusContext);
  if (!nodes || !ids?.length || ids.some((i) => i === undefined)) return null;
  return ids.every((i) => nodes.has(i as string)) ? "on" : "off";
}

/** Opacity for an element outside the spotlight. */
export const UNFOCUSED_OPACITY = 0.3;
