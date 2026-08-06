import type { FloorplanDef } from './types';

/**
 * The Bunker — eight themed zones off a central hallway spine.
 * Route: Entrance Hall → Hallways → Dining Room → Nursery → Allotment →
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
    { zone: 'entrance-hall', x: 90, y: 390, w: 180, h: 120, floor: 'concrete' },
    { zone: 'hallways', x: 90, y: 340, w: 740, h: 50, floor: 'concrete', labelDx: 130, labelDy: 1 },
    { zone: 'dining-room', x: 90, y: 150, w: 220, h: 190, floor: 'tiles', labelDy: -60 },
    { zone: 'nursery', x: 310, y: 150, w: 180, h: 190, floor: 'boards', labelDy: -60 },
    { zone: 'allotment', x: 490, y: 150, w: 200, h: 190, floor: 'turf', labelDy: -60 },
    { zone: 'armoury', x: 690, y: 150, w: 140, h: 190, floor: 'grate', labelDy: -60 },
    { zone: 'outsiders', x: 290, y: 390, w: 250, h: 130, floor: 'stone' },
    { zone: 'hunting-ground', x: 540, y: 390, w: 290, h: 130, floor: 'turf' },
  ],
  doors: [
    { x: 130, y: 510 },                 // entrance
    { x: 150, y: 390 },                 // Z1 → hallways
    { x: 170, y: 340 },                 // hallways → dining
    { x: 392, y: 340 },                 // hallways → nursery
    { x: 572, y: 340 },                 // hallways → allotment
    { x: 742, y: 340 },                 // hallways → armoury
    { x: 352, y: 390 },                 // hallways → outsiders
    { x: 540, y: 455, vertical: true }, // outsiders → hunting ground
    { x: 830, y: 455, vertical: true }, // exit
  ],
  props: [
    { kind: 'bed', x: 120, y: 445, r: 90, s: 0.9 }, { kind: 'rack', x: 220, y: 480, s: 0.8 },
    { kind: 'longtable', x: 200, y: 245 }, { kind: 'desk', x: 130, y: 305, s: 0.8, r: 90 },
    { kind: 'crib', x: 360, y: 225 }, { kind: 'crib', x: 405, y: 265, r: 18 }, { kind: 'frame', x: 445, y: 195 },
    { kind: 'planter', x: 575, y: 218 }, { kind: 'planter', x: 575, y: 258 }, { kind: 'planter', x: 575, y: 298 },
    { kind: 'gunrack', x: 755, y: 218 }, { kind: 'gunrack', x: 755, y: 262 }, { kind: 'cage', x: 725, y: 308, s: 0.8 },
    { kind: 'tent', x: 350, y: 455 }, { kind: 'tent', x: 425, y: 478, s: 0.9 }, { kind: 'tree', x: 495, y: 435, s: 0.9 },
    { kind: 'tree', x: 600, y: 435 }, { kind: 'tree', x: 665, y: 478 }, { kind: 'tree', x: 725, y: 430 }, { kind: 'tree', x: 785, y: 480, s: 0.9 },
  ],
  markers: [
    { kind: 'estop', x: 110, y: 408 }, { kind: 'breakglass', x: 250, y: 408 }, { kind: 'ext', x: 112, y: 490, types: ['fire'] },
    { kind: 'estop', x: 110, y: 170 }, { kind: 'ext', x: 290, y: 170, types: ['fire'] },
    { kind: 'estop', x: 510, y: 170 }, { kind: 'breakglass', x: 670, y: 170 }, { kind: 'ext', x: 512, y: 318, types: ['fire'] },
    { kind: 'estop', x: 710, y: 170 },
    { kind: 'estop', x: 562, y: 410 }, { kind: 'breakglass', x: 810, y: 410 }, { kind: 'ext', x: 810, y: 498, types: ['fire'] },
  ],
  route: [
    { x: 130, y: 545 }, { x: 150, y: 460 }, { x: 150, y: 365 }, { x: 172, y: 345 },
    { x: 195, y: 255 }, { x: 240, y: 300 }, { x: 268, y: 365 }, { x: 392, y: 345 },
    { x: 392, y: 250 }, { x: 435, y: 300 }, { x: 462, y: 365 }, { x: 572, y: 345 },
    { x: 572, y: 235 }, { x: 615, y: 285 }, { x: 645, y: 365 }, { x: 742, y: 345 },
    { x: 742, y: 235 }, { x: 762, y: 300 }, { x: 770, y: 365 }, { x: 352, y: 365 },
    { x: 352, y: 392 }, { x: 405, y: 455 }, { x: 495, y: 460 }, { x: 542, y: 455 },
    { x: 645, y: 468 }, { x: 750, y: 445 }, { x: 825, y: 455 },
  ],
  annotations: [
    { x: 640, y: 545, text: 'assembly points: green room & area outside green room' },
  ],
  entrance: { x: 130, y: 548 },
  exit: { x: 868, y: 455 },
};

export default theBunker;
