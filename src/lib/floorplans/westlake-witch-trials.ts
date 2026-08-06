import type { FloorplanDef } from './types';

/**
 * Westlake Witch Trials — televised, neon-drenched witch hunt across two
 * levels. Route: Holding Cages → Broadcast Courtroom → Dunking Stool & Gallows
 * → Synthetic Graveyard → (descent staircase) → Witches' Underground → Neon Coven.
 */
const westlakeWitchTrials: FloorplanDef = {
  viewBox: [0, 0, 920, 570],
  theme: {
    bg: '#0B0612',
    floor: '#150B20',
    floorAlt: '#3D2460',
    wall: '#B26CE8',
    label: '#F4E9FF',
    sub: '#8E6FB4',
    route: '#EC4899',
    accent: '#EC4899',
    prop: '#9D6FD0',
  },
  levels: [
    { x: 70, y: 60, w: 500, h: 470, label: 'Broadcast level' },
    { x: 590, y: 175, w: 280, h: 355, label: 'The Underground' },
  ],
  rooms: [
    { zone: 'holding-cages', x: 100, y: 380, w: 200, h: 130, floor: 'concrete', level: 0 },
    { zone: 'broadcast-courtroom', x: 100, y: 190, w: 200, h: 190, floor: 'boards', level: 0, labelDy: -30 },
    { zone: 'dunking-gallows', x: 300, y: 190, w: 240, h: 150, floor: 'stone', level: 0, labelDy: 48 },
    { zone: 'synthetic-graveyard', x: 300, y: 340, w: 240, h: 170, floor: 'turf', level: 0, labelDy: -56 },
    { zone: 'witches-underground', x: 620, y: 210, w: 210, h: 180, floor: 'stone', level: -1 },
    { zone: 'neon-coven', x: 620, y: 390, w: 210, h: 130, floor: 'void', level: -1, labelDy: -18 },
  ],
  doors: [
    { x: 140, y: 510 },                 // entrance
    { x: 150, y: 380 },                 // Z1 → Z2
    { x: 300, y: 260, vertical: true }, // Z2 → Z3
    { x: 390, y: 340 },                 // Z3 → Z4
    { x: 540, y: 415, vertical: true }, // Z4 → staircase (out of upper level)
    { x: 620, y: 300, vertical: true }, // staircase → Z5
    { x: 720, y: 390 },                 // Z5 → Z6
    { x: 830, y: 455, vertical: true }, // exit
  ],
  props: [
    { kind: 'cage', x: 150, y: 425 }, { kind: 'cage', x: 195, y: 468 }, { kind: 'cage', x: 255, y: 420, s: 0.85 },
    { kind: 'longtable', x: 200, y: 215 }, { kind: 'desk', x: 155, y: 305, s: 0.9 }, { kind: 'crt', x: 255, y: 335, s: 0.9 },
    { kind: 'gallows', x: 380, y: 250 }, { kind: 'vat', x: 470, y: 260, s: 1.4 },
    { kind: 'grave', x: 350, y: 420 }, { kind: 'grave', x: 400, y: 462, r: -8 }, { kind: 'grave', x: 448, y: 408, r: 6 },
    { kind: 'grave', x: 498, y: 462 }, { kind: 'grave', x: 358, y: 472, r: 10, s: 0.9 },
    { kind: 'stairs', x: 578, y: 415, r: 90, s: 0.9 },
    { kind: 'cauldron', x: 672, y: 342 }, { kind: 'cage', x: 782, y: 250 }, { kind: 'grave', x: 780, y: 330, s: 0.9 },
    { kind: 'cauldron', x: 720, y: 490, s: 1.1 }, { kind: 'frame', x: 665, y: 425 }, { kind: 'frame', x: 785, y: 425 },
  ],
  markers: [
    { kind: 'estop', x: 122, y: 400 }, { kind: 'breakglass', x: 278, y: 400 }, { kind: 'ext', x: 124, y: 490, types: ['fire'] },
    { kind: 'estop', x: 122, y: 210 }, { kind: 'breakglass', x: 278, y: 210 },
    { kind: 'estop', x: 322, y: 210 }, { kind: 'ext', x: 518, y: 212, types: ['fire'] },
    { kind: 'estop', x: 642, y: 230 }, { kind: 'breakglass', x: 808, y: 230 },
    { kind: 'estop', x: 642, y: 410 }, { kind: 'breakglass', x: 808, y: 500 }, { kind: 'ext', x: 644, y: 500, types: ['fire'] },
  ],
  route: [
    { x: 140, y: 545 }, { x: 150, y: 460 }, { x: 150, y: 385 }, { x: 155, y: 290 },
    { x: 240, y: 245 }, { x: 305, y: 260 }, { x: 390, y: 255 }, { x: 390, y: 345 },
    { x: 405, y: 425 }, { x: 470, y: 442 }, { x: 520, y: 418 }, { x: 578, y: 415 },
    { x: 605, y: 350 }, { x: 605, y: 300 }, { x: 625, y: 300 }, { x: 700, y: 295 },
    { x: 720, y: 345 }, { x: 720, y: 395 }, { x: 725, y: 460 }, { x: 790, y: 458 }, { x: 826, y: 455 },
  ],
  annotations: [
    { x: 470, y: 300, text: 'dunking stool' },
    { x: 500, y: 548, text: 'staircase — only route between levels' },
    { x: 725, y: 508, text: 'UV & neon finale' },
  ],
  entrance: { x: 140, y: 548 },
  exit: { x: 868, y: 455 },
};

export default westlakeWitchTrials;
