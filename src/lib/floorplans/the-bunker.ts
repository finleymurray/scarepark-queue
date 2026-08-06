import type { FloorplanDef } from './types';

/**
 * The Bunker — eight themed zones walked as a single linear route:
 * Entrance Hall → Hallways → Dining Room → Nursery → Allotment →
 * Armoury → Outsiders → Hunting Ground.
 */
const theBunker: FloorplanDef = {
  viewBox: [0, 0, 920, 570],
  theme: {
    bg: '#0A0C08',
    floor: '#12150E',
    floorAlt: '#3B4429',
    wall: '#9BA872',
    label: '#E8EDD8',
    sub: '#7F8A64',
    route: '#C9D8A0',
    accent: '#9BBF3B',
    prop: '#7E8B5E',
  },
  rooms: [
    { zone: 'entrance-hall', x: 90, y: 400, w: 200, h: 120, floor: 'concrete' },
    { zone: 'hallways', x: 90, y: 220, w: 70, h: 180, floor: 'concrete', noLabel: true },
    { zone: 'hallways', x: 90, y: 150, w: 250, h: 70, floor: 'concrete', labelDy: -10 },
    { zone: 'dining-room', x: 340, y: 150, w: 190, h: 150, floor: 'tiles', labelDy: -35 },
    { zone: 'nursery', x: 530, y: 150, w: 170, h: 150, floor: 'boards', labelDy: -35 },
    { zone: 'allotment', x: 700, y: 150, w: 160, h: 150, floor: 'turf', labelDy: -35 },
    { zone: 'armoury', x: 700, y: 300, w: 160, h: 110, floor: 'grate' },
    { zone: 'outsiders', x: 460, y: 300, w: 240, h: 110, floor: 'stone' },
    { zone: 'hunting-ground', x: 460, y: 410, w: 400, h: 110, floor: 'turf' },
  ],
  doors: [
    { x: 135, y: 520 },                 // entrance
    { x: 125, y: 400 },                 // Z1 → hallways
    { x: 125, y: 220 },                 // hallways: corridor turn
    { x: 340, y: 185, vertical: true }, // hallways → dining
    { x: 530, y: 215, vertical: true }, // dining → nursery
    { x: 700, y: 215, vertical: true }, // nursery → allotment
    { x: 775, y: 300 },                 // allotment → armoury
    { x: 700, y: 352, vertical: true }, // armoury → outsiders
    { x: 560, y: 410 },                 // outsiders → hunting ground
    { x: 860, y: 465, vertical: true }, // exit
  ],
  props: [
    { kind: 'bed', x: 120, y: 455, r: 90, s: 0.9 }, { kind: 'rack', x: 240, y: 488, s: 0.8 },
    { kind: 'longtable', x: 435, y: 248 }, { kind: 'desk', x: 362, y: 272, r: 90, s: 0.8 },
    { kind: 'crib', x: 580, y: 248 }, { kind: 'crib', x: 632, y: 262, r: 18 }, { kind: 'frame', x: 662, y: 278 },
    { kind: 'planter', x: 780, y: 215 }, { kind: 'planter', x: 780, y: 252 }, { kind: 'planter', x: 780, y: 288 },
    { kind: 'gunrack', x: 760, y: 335 }, { kind: 'gunrack', x: 760, y: 378 }, { kind: 'cage', x: 828, y: 385, s: 0.7 },
    { kind: 'tent', x: 520, y: 352 }, { kind: 'tent', x: 600, y: 378, s: 0.85 }, { kind: 'tree', x: 655, y: 332, s: 0.9 },
    { kind: 'tree', x: 520, y: 465 }, { kind: 'tree', x: 592, y: 492, s: 0.9 }, { kind: 'tree', x: 668, y: 438, s: 0.9 },
    { kind: 'tree', x: 742, y: 492 }, { kind: 'tree', x: 806, y: 445, s: 0.9 },
  ],
  markers: [
    { kind: 'estop', x: 110, y: 418 }, { kind: 'breakglass', x: 272, y: 418 }, { kind: 'ext', x: 112, y: 500, types: ['fire'] },
    { kind: 'estop', x: 360, y: 170 }, { kind: 'ext', x: 512, y: 170, types: ['fire'] },
    { kind: 'estop', x: 718, y: 170 }, { kind: 'breakglass', x: 842, y: 170 }, { kind: 'ext', x: 718, y: 282, types: ['fire'] },
    { kind: 'estop', x: 718, y: 318 },
    { kind: 'estop', x: 480, y: 428 }, { kind: 'breakglass', x: 842, y: 428 }, { kind: 'ext', x: 842, y: 500, types: ['fire'] },
  ],
  route: [
    { x: 135, y: 545 }, { x: 125, y: 455 }, { x: 125, y: 215 }, { x: 160, y: 185 },
    { x: 340, y: 185 }, { x: 420, y: 230 }, { x: 475, y: 260 }, { x: 535, y: 220 },
    { x: 600, y: 245 }, { x: 660, y: 255 }, { x: 705, y: 218 }, { x: 775, y: 245 },
    { x: 778, y: 305 }, { x: 775, y: 352 }, { x: 705, y: 355 }, { x: 600, y: 352 },
    { x: 562, y: 412 }, { x: 565, y: 470 }, { x: 680, y: 485 }, { x: 800, y: 470 }, { x: 856, y: 465 },
  ],
  annotations: [
    { x: 640, y: 545, text: 'assembly points: green room & area outside green room' },
  ],
  entrance: { x: 135, y: 548 },
  exit: { x: 893, y: 465, label: 'EXIT' },
};

export default theBunker;
