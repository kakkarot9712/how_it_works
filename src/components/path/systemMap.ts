/** A clickable architecture map of a whole system, the home of a learning path. Units are SVG viewBox units. */
export interface SystemMapSpec {
  width: number;
  height: number;
  /** Dashed regions (a cluster, a group), drawn under the nodes. */
  regions: { label: string; x: number; y: number; w: number; h: number }[];
  /** Components. Each links to the step that explains it. */
  nodes: {
    id: string;
    label: string;
    /** One or two short lines under the label. */
    lines?: string[];
    x: number;
    y: number;
    w: number;
    h: number;
    /** Slug of the step that explains this component. */
    step: string;
  }[];
  /**
   * Connections: a polyline of horizontal and vertical segments, arrow at the last point.
   * The label (a request name) sits on the longest horizontal segment, above it unless `labelBelow`.
   */
  wires: { points: [number, number][]; label?: string; labelBelow?: boolean; dashed?: boolean }[];
}
