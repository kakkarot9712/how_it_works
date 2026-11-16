"use client";

import { useEffect, useRef } from "react";

/**
 * Global keyboard shortcuts while the player is open. Ignored while typing in a field.
 * Pass the latest handlers every render; the listener is attached once.
 */
export function useShortcuts(keys: Record<string, () => void>) {
  const ref = useRef(keys);
  useEffect(() => {
    ref.current = keys;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const name = e.code === "Space" ? "Space" : e.key;
      const fn = ref.current[name];
      if (!fn) return;
      if (name === "Space") e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
