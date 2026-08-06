import type { FloorplanDef } from './types';

/**
 * Signal Loss — Cold War telecommunications facility breached by an invasive
 * broadcast. Route: Foyer & Checkpoint → Server Corridors (sub-zero) →
 * Diagnostics Lab → Anechoic Chamber → Transmission Feed tunnel → Broadcast Core.
 */
const signalLoss: FloorplanDef = {
  viewBox: [0, 0, 920, 570],
  theme: {
    bg: '#070B0E',
    floor: '#0D161A',
    floorAlt: '#1F4750',
    wall: '#6FC7BF',
    label: '#E4F5F2',
    sub: '#6E9A96',
    route: '#4FD1C5',
    accent: '#2DD4BF',
    prop: '#58A79F',
  },
  rooms: [
    { zone: 'foyer-checkpoint', x: 90, y: 390, w: 220, h: 130, floor: 'tiles' },
    { zone: 'server-corridors', x: 90, y: 170, w: 200, h: 220, floor: 'grate' },
    { zone: 'diagnostics-lab', x: 290, y: 170, w: 220, h: 150, floor: 'tiles' },
    { zone: 'anechoic-chamber', x: 510, y: 170, w: 180, h: 150, floor: 'foam' },
    { zone: 'transmission-feed', x: 560, y: 320, w: 60, h: 110, floor: 'grate', noLabel: true },
    { zone: 'transmission-feed', x: 560, y: 390, w: 270, h: 40, floor: 'grate', labelDy: 42, labelDx: 40 },
    { zone: 'broadcast-core', x: 690, y: 170, w: 140, h: 220, floor: 'concrete' },
  ],
  doors: [
    { x: 150, y: 520 },                 // entrance
    { x: 150, y: 390 },                 // Z1 → Z2
    { x: 290, y: 240, vertical: true }, // Z2 → Z3
    { x: 510, y: 240, vertical: true }, // Z3 → Z4
    { x: 590, y: 320 },                 // Z4 → Z5 (tunnel shaft)
    { x: 760, y: 390 },                 // tunnel → Z6
    { x: 830, y: 280, vertical: true }, // exit
  ],
  props: [
    { kind: 'desk', x: 180, y: 435 }, { kind: 'cage', x: 265, y: 480, s: 0.8 },
    { kind: 'rack', x: 140, y: 225, r: 90 }, { kind: 'rack', x: 140, y: 300, r: 90 },
    { kind: 'rack', x: 240, y: 225, r: 90 }, { kind: 'rack', x: 240, y: 300, r: 90 },
    { kind: 'crt', x: 355, y: 215 }, { kind: 'crt', x: 440, y: 215 }, { kind: 'desk', x: 400, y: 280, r: 180, s: 0.9 },
    { kind: 'wedges', x: 565, y: 195 }, { kind: 'wedges', x: 640, y: 195 },
    { kind: 'wedges', x: 565, y: 297, r: 180 }, { kind: 'wedges', x: 640, y: 297, r: 180 },
    { kind: 'monitorwall', x: 680, y: 400 }, { kind: 'monitorwall', x: 770, y: 420 },
    { kind: 'monitorwall', x: 760, y: 210 }, { kind: 'booth', x: 765, y: 325 }, { kind: 'crt', x: 722, y: 352, s: 0.9 },
  ],
  markers: [
    { kind: 'estop', x: 110, y: 410 }, { kind: 'breakglass', x: 290, y: 410 }, { kind: 'ext', x: 112, y: 498, types: ['water'] },
    { kind: 'estop', x: 110, y: 190 }, { kind: 'breakglass', x: 268, y: 190 }, { kind: 'ext', x: 112, y: 368, types: ['co2'] },
    { kind: 'ext', x: 488, y: 192, types: ['co2'] },
    { kind: 'estop', x: 528, y: 193 }, { kind: 'breakglass', x: 672, y: 193 },
    { kind: 'estop', x: 580, y: 345 }, { kind: 'ext', x: 650, y: 410, types: ['co2'] },
    { kind: 'estop', x: 712, y: 190 }, { kind: 'breakglass', x: 808, y: 190 }, { kind: 'ext', x: 712, y: 368, types: ['water'] },
  ],
  route: [
    { x: 150, y: 545 }, { x: 150, y: 460 }, { x: 150, y: 240 }, { x: 290, y: 240 },
    { x: 510, y: 240 }, { x: 590, y: 260 }, { x: 590, y: 410 }, { x: 760, y: 410 },
    { x: 760, y: 340 }, { x: 760, y: 280 }, { x: 828, y: 280 },
  ],
  annotations: [
    { x: 190, y: 375, text: 'sub-zero', anchor: 'start' },
    { x: 600, y: 158, text: 'room deadens sound — count groups through' },
    { x: 690, y: 490, text: 'stacked-monitor tunnel — single file' },
    { x: 200, y: 508, text: 'hand-torches at every E-Stop', anchor: 'start' },
  ],
  entrance: { x: 150, y: 548 },
  exit: { x: 872, y: 280 },
};

export default signalLoss;
