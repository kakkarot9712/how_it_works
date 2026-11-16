/**
 * A horizontal fill bar (buffer size, memory use) with optional limit markers,
 * e.g. soft and hard limits. `value` and marker positions are fractions 0..1 of the bar.
 */
export function Bar({
  x,
  y,
  width,
  height = 14,
  rx = 4,
  track = "bg",
  value,
  color,
  markers = [],
}: {
  x: number;
  y: number;
  width: number;
  height?: number;
  rx?: number;
  /** Empty-track colour: `bg` on panel-2 surfaces, `panel-2` on panel surfaces. */
  track?: "bg" | "panel-2";
  value: number;
  color: string;
  markers?: { at: number; color: string }[];
}) {
  const clamp = (f: number) => Math.min(1, Math.max(0, f)) * width;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height={height} rx={rx} className={track === "bg" ? "fill-bg" : "fill-panel-2"} />
      {value > 0 && <rect width={clamp(value)} height={height} rx={rx} fill={color} />}
      {markers.map((m, i) => (
        <line key={i} x1={clamp(m.at)} x2={clamp(m.at)} y1={-5} y2={height + 5} stroke={m.color} strokeWidth={2} />
      ))}
    </g>
  );
}
