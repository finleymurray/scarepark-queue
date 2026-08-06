import type { FloorplanDef } from './types';

/**
 * Night Terrors — monochrome dreamscape / failed sleep laboratory.
 * Route: Sleep Lab → Looping Staircase → Quagmire → Shadow Gallery →
 * Fragmentation Zone → Erasure Void. Accessible bypass links Z1 → Z4.
 */
const nightTerrors: FloorplanDef = {
  viewBox: [0, 0, 920, 570],
  theme: {
    bg: '#0A0A0C',
    floor: '#141418',
    floorAlt: '#3E3E4A',
    wall: '#C9C9D4',
    label: '#ECECF2',
    sub: '#8A8A98',
    route: '#F4F4F8',
    accent: '#FFFFFF',
    prop: '#9C9CAC',
  },
  rooms: [
    { zone: 'sleep-lab', x: 90, y: 390, w: 230, h: 130, floor: 'tiles' },
    { zone: 'looping-staircase', x: 90, y: 220, w: 150, h: 170, floor: 'boards', labelDy: 52 },
    { zone: 'sluggish-quagmire', x: 90, y: 80, w: 250, h: 140, floor: 'foam' },
    { zone: 'shadow-gallery', x: 340, y: 80, w: 240, h: 140, floor: 'concrete' },
    { zone: 'fragmentation-zone', x: 580, y: 80, w: 250, h: 140, floor: 'grate' },
    { zone: 'erasure-void', x: 580, y: 220, w: 250, h: 250, floor: 'void' },
    { zone: 'accessible-bypass', x: 320, y: 420, w: 140, h: 44, floor: 'concrete', noLabel: true },
    { zone: 'accessible-bypass', x: 416, y: 220, w: 44, h: 244, floor: 'concrete', labelDx: 60, labelDy: 90 },
  ],
  doors: [
    { x: 130, y: 520 },              // entrance
    { x: 150, y: 390 },              // Z1 → Z2
    { x: 150, y: 220 },              // Z2 → Z3
    { x: 340, y: 150, vertical: true }, // Z3 → Z4
    { x: 580, y: 150, vertical: true }, // Z4 → Z5
    { x: 700, y: 220 },              // Z5 → Z6
    { x: 700, y: 470 },              // exit
    { x: 320, y: 442, vertical: true }, // Z1 → bypass
    { x: 438, y: 220 },              // bypass → Z4
  ],
  props: [
    { kind: 'bed', x: 150, y: 445 }, { kind: 'bed', x: 190, y: 445 }, { kind: 'bed', x: 230, y: 445 },
    { kind: 'desk', x: 285, y: 480, r: 90, s: 0.8 },
    { kind: 'stairs', x: 165, y: 300 },
    { kind: 'blob', x: 150, y: 155 }, { kind: 'blob', x: 225, y: 120, s: 0.8 }, { kind: 'blob', x: 290, y: 175, s: 0.9 },
    { kind: 'frame', x: 390, y: 108 }, { kind: 'frame', x: 435, y: 108 }, { kind: 'frame', x: 480, y: 108 }, { kind: 'frame', x: 525, y: 108 },
    { kind: 'frame', x: 420, y: 192 }, { kind: 'frame', x: 490, y: 192 },
    { kind: 'wedges', x: 660, y: 130 }, { kind: 'wedges', x: 750, y: 175, r: 25 },
    { kind: 'booth', x: 770, y: 260 },
  ],
  markers: [
    { kind: 'estop', x: 110, y: 410 }, { kind: 'breakglass', x: 300, y: 410 }, { kind: 'ext', x: 112, y: 498, types: ['co2'] },
    { kind: 'estop', x: 110, y: 100 }, { kind: 'breakglass', x: 320, y: 100 },
    { kind: 'ext', x: 560, y: 198, types: ['co2'] },
    { kind: 'estop', x: 600, y: 100 }, { kind: 'breakglass', x: 810, y: 100 }, { kind: 'ext', x: 808, y: 198, types: ['co2'] },
    { kind: 'estop', x: 600, y: 245 }, { kind: 'breakglass', x: 810, y: 448 }, { kind: 'ext', x: 622, y: 448, types: ['water', 'co2'] },
    { kind: 'estop', x: 438, y: 310 },
  ],
  route: [
    { x: 130, y: 545 }, { x: 150, y: 460 }, { x: 150, y: 300 }, { x: 150, y: 150 },
    { x: 340, y: 150 }, { x: 560, y: 150 }, { x: 700, y: 150 }, { x: 700, y: 300 }, { x: 700, y: 500 },
  ],
  route2: [
    { x: 300, y: 442 }, { x: 438, y: 442 }, { x: 438, y: 225 },
  ],
  annotations: [
    { x: 165, y: 245, text: 'sloped illusion floor' },
    { x: 215, y: 205, text: 'soft flooring — bypassed by accessible route' },
    { x: 705, y: 250, text: 'strobe' , anchor: 'start' },
    { x: 770, y: 292, text: 'control booth' },
    { x: 660, y: 400, text: 'white fog void finale', anchor: 'start' },
    { x: 390, y: 490, text: 'accessible bypass Z1 → Z4' },
  ],
  entrance: { x: 130, y: 548 },
  exit: { x: 700, y: 522 },
};

export default nightTerrors;
