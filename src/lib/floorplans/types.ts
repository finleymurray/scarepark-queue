/**
 * Floorplan definitions for the Monitor app.
 *
 * Geometry lives here in code (it's art, not data); safety equipment facts
 * (e-stops, break glass, extinguishers) live in the maze_zones table and are
 * joined onto rooms by zone slug at render time. Marker *positions* are part
 * of the art and defined here.
 *
 * NOTE: room shapes are indicative until measured plans exist — the zone
 * sequence, connections and equipment locations are from each CoSWP.
 */

export type FloorTexture =
  | 'boards'    // timber floorboards
  | 'tiles'     // clinical tile grid
  | 'concrete'  // speckled concrete
  | 'grate'     // diagonal metal grate
  | 'turf'      // astroturf / planting
  | 'foam'      // soft / padded floor
  | 'stone'     // stone flags / brick
  | 'void';     // featureless (fog void)

export type PropKind =
  | 'bed' | 'desk' | 'crt' | 'rack' | 'wedges' | 'monitorwall'
  | 'workbench' | 'longtable' | 'crib' | 'planter' | 'gunrack'
  | 'tent' | 'tree' | 'grave' | 'cage' | 'vat' | 'gallows'
  | 'cauldron' | 'curtain' | 'strings' | 'blob' | 'frame'
  | 'stairs' | 'booth';

export interface FloorplanTheme {
  /** Canvas behind the building outline. */
  bg: string;
  /** Base floor fill inside rooms. */
  floor: string;
  /** Pattern stroke colour drawn over the floor. */
  floorAlt: string;
  /** Wall stroke. */
  wall: string;
  /** Room label text. */
  label: string;
  /** Secondary text (zone numbers, annotations). */
  sub: string;
  /** Guest route dash. */
  route: string;
  /** Theme accent — selection, entrance/exit badges. */
  accent: string;
  /** Prop glyph tint. */
  prop: string;
}

export interface Room {
  /** Matches maze_zones.slug. Corridor segments may repeat a slug. */
  zone: string;
  x: number; y: number; w: number; h: number;
  floor: FloorTexture;
  /** Suppress the label on secondary segments of a multi-rect zone. */
  noLabel?: boolean;
  labelDx?: number;
  labelDy?: number;
  level?: number;
}

export interface DoorGap {
  x: number; y: number;
  /** true = opening in a vertical wall (gap runs top-to-bottom). */
  vertical?: boolean;
  width?: number;
}

export interface PropInstance {
  kind: PropKind;
  x: number; y: number;
  /** Rotation in degrees. */
  r?: number;
  /** Uniform scale. */
  s?: number;
}

export interface MarkerInstance {
  kind: 'estop' | 'breakglass' | 'ext';
  x: number; y: number;
  /** Extinguisher types for 'ext' markers ('water' | 'co2' | 'foam' | 'fire'). */
  types?: string[];
}

export interface Annotation {
  x: number; y: number;
  text: string;
  anchor?: 'start' | 'middle' | 'end';
}

export interface LevelBand {
  x: number; y: number; w: number; h: number;
  label: string;
}

export interface FloorplanDef {
  viewBox: [number, number, number, number];
  theme: FloorplanTheme;
  rooms: Room[];
  doors: DoorGap[];
  props: PropInstance[];
  markers: MarkerInstance[];
  /** Guest route through the maze, drawn as a dashed path. */
  route: { x: number; y: number }[];
  /** Secondary route (e.g. accessible bypass), drawn dotted. */
  route2?: { x: number; y: number }[];
  annotations?: Annotation[];
  entrance: { x: number; y: number; label?: string };
  exit: { x: number; y: number; label?: string };
  /** Level slabs for multi-level mazes (drawn behind rooms with a label). */
  levels?: LevelBand[];
}
