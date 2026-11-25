"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Which steps of a learning path this browser has finished. Stored in localStorage
 * (no accounts, no backend), shared live between every component on the page and
 * across tabs. Renders as "nothing done" on the server and on the first client pass,
 * so hydration never mismatches.
 */
const key = (path: string) => `syswork:path:${path}`;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(path: string): string {
  try {
    return localStorage.getItem(key(path)) ?? "[]";
  } catch {
    return "[]";
  }
}

export function useProgress(path: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(path),
    () => "[]",
  );
  const done = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set<string>();
    }
  }, [raw]);

  const setDone = useCallback(
    (step: string, on = true) => {
      const next = new Set<string>(JSON.parse(read(path)));
      if (on) next.add(step);
      else next.delete(step);
      try {
        localStorage.setItem(key(path), JSON.stringify([...next]));
      } catch {}
      listeners.forEach((l) => l());
    },
    [path],
  );

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(key(path));
    } catch {}
    listeners.forEach((l) => l());
  }, [path]);

  return { done, setDone, reset };
}
