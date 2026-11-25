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
  /**
   * "Who talks to whom": every connection in the system, written from the side that opens it,
   * with who decides what. Shown as a table under the map. Each row links to the step that
   * explains and cites it, so the claim is sourced there.
   */
  connections?: Connection[];
}

/** One connection between components, from the side that opens it. */
export interface Connection {
  /** The component that opens the connection or sends the request: `consumer`, `kubelet`. */
  from: string;
  /** The component it talks to. */
  to: string;
  /** What goes over it, by real names: `Fetch`, `watch Pods, PATCH status`. */
  call: string;
  /** How data moves, in a word or two: push, pull, long poll, watch, request/response. */
  pattern: string;
  /** Who decides what over this link, one short sentence. The point most readers get wrong. */
  control: string;
  /** Slug of the step that explains and cites this connection. */
  step: string;
}
