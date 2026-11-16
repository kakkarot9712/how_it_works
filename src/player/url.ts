/**
 * Deep links into the simulator: `?s=<scenario>&t=<ms>` opens a scenario paused at a moment.
 * The write-up, "Link to moment" and verify-simulation screenshots all rely on this format.
 */

/** Parse `?s=` and `?t=`. Unknown scenarios fall back to the first; bad times to 0. */
export function parseSimQuery(scenarioIds: string[], s: string | null, t: string | null): { scenarioId: string; t: number } {
  const ms = Number(t);
  return {
    scenarioId: s && scenarioIds.includes(s) ? s : scenarioIds[0],
    t: Number.isFinite(ms) && ms > 0 ? ms : 0,
  };
}

/** Replace the current URL with `?s=<id>` (no history entry). */
export function writeScenarioUrl(id: string) {
  window.history.replaceState(null, "", `?s=${id}`);
}

/** Absolute link to this page's simulator at a scenario and moment. */
export function momentUrl(scenarioId: string, t: number) {
  return `${window.location.origin}${window.location.pathname}?s=${scenarioId}&t=${Math.round(t)}`;
}
