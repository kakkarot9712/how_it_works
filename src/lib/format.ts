/** Simulated milliseconds as seconds with one decimal ("12.6s"), as shown on the timeline, log and canvases. */
export const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
