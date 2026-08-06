import type { FloorplanDef } from './types';

/**
 * Strings of Control — decaying marionette theatre & puppet workshop.
 * Route: Rotting Vestibule → Sawdust & Sizing Room → Articulation Ward →
 * Tangled Rigging → Varnish & Paint Vats → The Master's Stage.
 */
const stringsOfControl: FloorplanDef = {
  viewBox: [0, 0, 920, 570],
  theme: {
    bg: '#0C0906',
    floor: '#171008',
    floorAlt: '#4A3416',
    wall: '#C8A25A',
    label: '#F3E5C8',
    sub: '#97805A',
    route: '#E9B44C',
    accent: '#D97706',
    prop: '#A8834A',
  },
  rooms: [
    { zone: 'rotting-vestibule', x: 90, y: 390, w: 200, h: 130, floor: 'boards' },
    { zone: 'sawdust-sizing', x: 90, y: 150, w: 240, h: 240, floor: 'boards' },
    { zone: 'articulation-ward', x: 330, y: 150, w: 180, h: 130, floor: 'tiles' },
    { zone: 'tangled-rigging', x: 510, y: 150, w: 200, h: 200, floor: 'concrete', labelDy: -55 },
    { zone: 'varnish-vats', x: 330, y: 280, w: 180, h: 110, floor: 'concrete' },
    { zone: 'masters-stage', x: 510, y: 350, w: 320, h: 170, floor: 'boards' },
  ],
  doors: [
    { x: 130, y: 520 },                 // entrance
    { x: 150, y: 390 },                 // Z1 → Z2
    { x: 330, y: 215, vertical: true }, // Z2 → Z3
    { x: 510, y: 215, vertical: true }, // Z3 → Z4
    { x: 510, y: 318, vertical: true }, // Z4 → Z5
    { x: 510, y: 372, vertical: true }, // Z5 → Z6
    { x: 830, y: 440, vertical: true }, // exit
  ],
  props: [
    { kind: 'frame', x: 145, y: 425 }, { kind: 'frame', x: 250, y: 480 }, { kind: 'curtain', x: 190, y: 505, s: 0.8 },
    { kind: 'workbench', x: 180, y: 220 }, { kind: 'workbench', x: 275, y: 310, r: 90 },
    { kind: 'blob', x: 150, y: 330, s: 0.8 }, { kind: 'vat', x: 280, y: 190, s: 0.7 },
    { kind: 'rack', x: 420, y: 185 }, { kind: 'desk', x: 460, y: 245, s: 0.85 },
    { kind: 'strings', x: 610, y: 230 }, { kind: 'strings', x: 615, y: 290, r: 14 },
    { kind: 'vat', x: 380, y: 330 }, { kind: 'vat', x: 435, y: 355 }, { kind: 'vat', x: 470, y: 315, s: 0.85 },
    { kind: 'curtain', x: 690, y: 495 }, { kind: 'curtain', x: 690, y: 508, s: 0.9 },
    { kind: 'rack', x: 690, y: 405 }, { kind: 'gallows', x: 590, y: 450, s: 0.9 },
  ],
  markers: [
    { kind: 'estop', x: 110, y: 410 }, { kind: 'breakglass', x: 270, y: 410 }, { kind: 'ext', x: 116, y: 498, types: ['water', 'co2'] },
    { kind: 'estop', x: 110, y: 170 }, { kind: 'breakglass', x: 310, y: 170 }, { kind: 'ext', x: 112, y: 368, types: ['water'] },
    { kind: 'ext', x: 488, y: 172, types: ['co2'] },
    { kind: 'estop', x: 532, y: 172 }, { kind: 'breakglass', x: 688, y: 172 },
    { kind: 'estop', x: 352, y: 302 }, { kind: 'ext', x: 356, y: 368, types: ['foam', 'co2'] },
    { kind: 'estop', x: 545, y: 500 }, { kind: 'breakglass', x: 812, y: 372 }, { kind: 'ext', x: 620, y: 500, types: ['water', 'co2'] },
  ],
  route: [
    { x: 130, y: 545 }, { x: 150, y: 455 }, { x: 150, y: 300 }, { x: 210, y: 230 },
    { x: 335, y: 215 }, { x: 510, y: 215 }, { x: 610, y: 250 }, { x: 570, y: 318 },
    { x: 470, y: 330 }, { x: 455, y: 362 }, { x: 510, y: 372 }, { x: 600, y: 410 }, { x: 660, y: 440 }, { x: 825, y: 440 },
  ],
  annotations: [
    { x: 210, y: 138, text: 'dry timber & sawdust throughout' },
    { x: 610, y: 330, text: 'hanging-string maze — low visibility' },
    { x: 420, y: 405, text: 'flammable liquids' },
    { x: 690, y: 380, text: 'overhead rig & bungee drops' },
  ],
  entrance: { x: 130, y: 548 },
  exit: { x: 868, y: 440 },
};

export default stringsOfControl;
