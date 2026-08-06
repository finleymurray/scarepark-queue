'use client';

import { useId } from 'react';
import type { FloorplanDef, FloorplanTheme, PropInstance, Room } from '@/lib/floorplans/types';
import type { MazeZone } from '@/types/database';

/*
 * Architectural-style SVG floorplan renderer.
 * Rooms are drawn as textured floor slabs with thick walls; door gaps are cut
 * over shared walls; set pieces are drawn as glyphs so each maze reads as a
 * real place rather than labelled boxes.
 */

interface FloorplanProps {
  def: FloorplanDef;
  zones: Record<string, MazeZone>;
  selected: string | null;
  onSelect: (zoneSlug: string | null) => void;
}

/* ── set-piece glyphs ── */

function Prop({ p, t }: { p: PropInstance; t: FloorplanTheme }) {
  const c = t.prop;
  const s = p.s ?? 1;
  const tf = `translate(${p.x} ${p.y}) rotate(${p.r ?? 0}) scale(${s})`;
  const stroke = { stroke: c, fill: 'none', strokeWidth: 1.4 };
  const fill = { fill: c, stroke: 'none' };

  switch (p.kind) {
    case 'bed':
      return (
        <g transform={tf} opacity={0.75}>
          <rect x={-10} y={-16} width={20} height={32} rx={2} {...stroke} />
          <rect x={-10} y={-16} width={20} height={9} rx={2} fill={c} opacity={0.35} stroke="none" />
        </g>
      );
    case 'desk':
      return (
        <g transform={tf} opacity={0.75}>
          <rect x={-16} y={-7} width={32} height={14} rx={2} {...stroke} />
          <circle cx={0} cy={13} r={4} {...stroke} />
        </g>
      );
    case 'crt':
      return (
        <g transform={tf} opacity={0.8}>
          <rect x={-14} y={-8} width={28} height={16} rx={2} {...stroke} />
          <rect x={-9} y={-4} width={8} height={8} {...fill} opacity={0.5} />
          <rect x={2} y={-4} width={8} height={8} {...fill} opacity={0.5} />
        </g>
      );
    case 'rack':
      return (
        <g transform={tf} opacity={0.8}>
          <rect x={-22} y={-6} width={44} height={12} {...stroke} />
          <line x1={-11} y1={-6} x2={-11} y2={6} {...stroke} />
          <line x1={0} y1={-6} x2={0} y2={6} {...stroke} />
          <line x1={11} y1={-6} x2={11} y2={6} {...stroke} />
        </g>
      );
    case 'wedges': {
      const tri = [];
      for (let i = 0; i < 4; i++) tri.push(<path key={i} d={`M${i * 12 - 24} 6 l6 -12 l6 12 z`} {...stroke} />);
      return <g transform={tf} opacity={0.6}>{tri}</g>;
    }
    case 'monitorwall': {
      const cells = [];
      for (let i = 0; i < 5; i++) cells.push(<rect key={i} x={i * 11 - 27} y={-5} width={9} height={10} {...stroke} />);
      return <g transform={tf} opacity={0.8}>{cells}</g>;
    }
    case 'workbench':
      return (
        <g transform={tf} opacity={0.75}>
          <rect x={-20} y={-8} width={40} height={16} rx={1} {...stroke} />
          <circle cx={-10} cy={0} r={2.5} {...fill} opacity={0.6} />
          <rect x={2} y={-4} width={12} height={8} {...fill} opacity={0.35} />
        </g>
      );
    case 'longtable':
      return (
        <g transform={tf} opacity={0.75}>
          <rect x={-30} y={-7} width={60} height={14} rx={2} {...stroke} />
          {[-22, -8, 6, 20].map((x) => <circle key={`a${x}`} cx={x} cy={-13} r={3.5} {...stroke} />)}
          {[-22, -8, 6, 20].map((x) => <circle key={`b${x}`} cx={x} cy={13} r={3.5} {...stroke} />)}
        </g>
      );
    case 'crib':
      return (
        <g transform={tf} opacity={0.8}>
          <rect x={-10} y={-13} width={20} height={26} rx={3} {...stroke} />
          {[-6, 0, 6].map((y) => <line key={y} x1={-10} y1={y} x2={10} y2={y} {...stroke} strokeWidth={0.8} />)}
        </g>
      );
    case 'planter':
      return (
        <g transform={tf} opacity={0.7}>
          <rect x={-24} y={-6} width={48} height={12} rx={2} {...stroke} />
          {[-16, -8, 0, 8, 16].map((x) => <circle key={x} cx={x} cy={0} r={2} {...fill} opacity={0.6} />)}
        </g>
      );
    case 'gunrack':
      return (
        <g transform={tf} opacity={0.8}>
          <rect x={-18} y={-5} width={36} height={10} {...stroke} />
          {[-12, -4, 4, 12].map((x) => <line key={x} x1={x} y1={-9} x2={x} y2={5} {...stroke} />)}
        </g>
      );
    case 'tent':
      return (
        <g transform={tf} opacity={0.75}>
          <path d="M-14 10 L0 -12 L14 10 Z" {...stroke} />
          <path d="M0 -12 L0 10" {...stroke} strokeWidth={0.9} />
        </g>
      );
    case 'tree':
      return (
        <g transform={tf} opacity={0.65}>
          <circle cx={0} cy={0} r={9} {...stroke} />
          <circle cx={0} cy={0} r={2} {...fill} />
        </g>
      );
    case 'grave':
      return (
        <g transform={tf} opacity={0.8}>
          <rect x={-6} y={-10} width={12} height={20} rx={2} {...stroke} />
          <path d="M0 -14 v-6 M-4 -17 h8" {...stroke} />
        </g>
      );
    case 'cage':
      return (
        <g transform={tf} opacity={0.85}>
          <rect x={-11} y={-11} width={22} height={22} {...stroke} />
          {[-6, 0, 6].map((x) => <line key={x} x1={x} y1={-11} x2={x} y2={11} {...stroke} strokeWidth={0.9} />)}
        </g>
      );
    case 'vat':
      return (
        <g transform={tf} opacity={0.85}>
          <circle cx={0} cy={0} r={11} {...stroke} />
          <circle cx={0} cy={0} r={6.5} {...stroke} strokeWidth={0.9} />
        </g>
      );
    case 'gallows':
      return (
        <g transform={tf} opacity={0.85}>
          <path d="M-8 12 V-12 H8 V-4" {...stroke} strokeWidth={2} />
          <circle cx={8} cy={0} r={3.5} {...stroke} />
        </g>
      );
    case 'cauldron':
      return (
        <g transform={tf} opacity={0.85}>
          <path d="M-10 -2 a10 10 0 1 0 20 0 z" {...stroke} />
          <line x1={-13} y1={-2} x2={13} y2={-2} {...stroke} />
        </g>
      );
    case 'curtain':
      return (
        <g transform={tf} opacity={0.7}>
          <path d="M-30 0 q7 8 15 0 q7 8 15 0 q7 8 15 0 q7 8 15 0" {...stroke} />
        </g>
      );
    case 'strings': {
      const lines = [];
      for (let i = 0; i < 9; i++) {
        const x = i * 9 - 36;
        lines.push(<line key={i} x1={x} y1={-14 + (i % 3) * 4} x2={x + 3} y2={14 - (i % 2) * 5} {...stroke} strokeWidth={0.9} />);
      }
      return <g transform={tf} opacity={0.6}>{lines}</g>;
    }
    case 'blob':
      return (
        <g transform={tf} opacity={0.5}>
          <ellipse cx={0} cy={0} rx={14} ry={9} {...stroke} />
          <ellipse cx={4} cy={2} rx={6} ry={4} {...stroke} strokeWidth={0.9} />
        </g>
      );
    case 'frame':
      return (
        <g transform={tf} opacity={0.8}>
          <rect x={-8} y={-6} width={16} height={12} {...stroke} />
          <rect x={-5} y={-3.5} width={10} height={7} {...stroke} strokeWidth={0.8} />
        </g>
      );
    case 'stairs': {
      const steps = [];
      for (let i = 0; i < 6; i++) steps.push(<line key={i} x1={-15} y1={i * 6 - 15} x2={15} y2={i * 6 - 15} {...stroke} />);
      return (
        <g transform={tf} opacity={0.9}>
          <rect x={-15} y={-18} width={30} height={36} {...stroke} />
          {steps}
          <path d="M0 -24 l-5 6 M0 -24 l5 6 M0 -24 V14" {...stroke} strokeWidth={0.9} />
        </g>
      );
    }
    case 'booth':
      return (
        <g transform={tf} opacity={0.85}>
          <rect x={-16} y={-10} width={32} height={20} rx={2} {...stroke} />
          <rect x={-12} y={-6} width={10} height={6} {...fill} opacity={0.5} />
          <rect x={2} y={-6} width={10} height={6} {...fill} opacity={0.5} />
        </g>
      );
  }
}

/* ── safety markers ── */

const EXT_BAND: Record<string, string> = {
  co2: '#0F0F10',   // UK CO₂ — black band
  foam: '#F5EBCB',  // foam — cream band
  water: '#D42B2B', // water — plain red
  fire: '#D42B2B',  // type unspecified in CoSWP
};

function Marker({ kind, x, y, types }: { kind: 'estop' | 'breakglass' | 'ext'; x: number; y: number; types?: string[] }) {
  if (kind === 'estop') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect x={-7} y={-7} width={14} height={14} rx={2} fill="#FACC15" stroke="#0A0B0E" strokeWidth={1} />
        <circle cx={0} cy={0} r={4.2} fill="#DC2626" stroke="#7F1D1D" strokeWidth={1} />
      </g>
    );
  }
  if (kind === 'breakglass') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect x={-6.5} y={-6.5} width={13} height={13} rx={2} fill="#DC2626" stroke="#0A0B0E" strokeWidth={1} />
        <path d="M-3 -3 L3 3 M1 -3.5 L-1 3.5" stroke="#FFF" strokeWidth={1.2} fill="none" />
      </g>
    );
  }
  // extinguisher(s) — small cylinders side by side, banded by type
  const list = types && types.length ? types : ['fire'];
  return (
    <g transform={`translate(${x} ${y})`}>
      {list.map((t, i) => {
        const dx = (i - (list.length - 1) / 2) * 11;
        return (
          <g key={`${t}${i}`} transform={`translate(${dx} 0)`}>
            <rect x={-3.5} y={-7} width={7} height={14} rx={2.5} fill="#D42B2B" stroke="#0A0B0E" strokeWidth={0.8} />
            <rect x={-3.5} y={-3} width={7} height={4} fill={EXT_BAND[t] ?? '#D42B2B'} stroke="none" />
            <line x1={0} y1={-7} x2={0} y2={-10} stroke="#0A0B0E" strokeWidth={1.4} />
          </g>
        );
      })}
    </g>
  );
}

/* ── floor texture pattern defs ── */

function TextureDefs({ id, t }: { id: string; t: FloorplanTheme }) {
  const c = t.floorAlt;
  return (
    <defs>
      <pattern id={`${id}-boards`} width={90} height={12} patternUnits="userSpaceOnUse">
        <rect width={90} height={12} fill={t.floor} />
        <line x1={0} y1={11.5} x2={90} y2={11.5} stroke={c} strokeWidth={0.7} opacity={0.55} />
        <line x1={30} y1={0} x2={30} y2={12} stroke={c} strokeWidth={0.7} opacity={0.35} />
        <line x1={75} y1={0} x2={75} y2={12} stroke={c} strokeWidth={0.7} opacity={0.25} />
      </pattern>
      <pattern id={`${id}-tiles`} width={16} height={16} patternUnits="userSpaceOnUse">
        <rect width={16} height={16} fill={t.floor} />
        <path d="M16 0 H0 V16" fill="none" stroke={c} strokeWidth={0.6} opacity={0.5} />
      </pattern>
      <pattern id={`${id}-concrete`} width={26} height={26} patternUnits="userSpaceOnUse">
        <rect width={26} height={26} fill={t.floor} />
        <circle cx={5} cy={7} r={0.9} fill={c} opacity={0.4} />
        <circle cx={17} cy={3} r={0.7} fill={c} opacity={0.3} />
        <circle cx={21} cy={16} r={1} fill={c} opacity={0.35} />
        <circle cx={9} cy={21} r={0.7} fill={c} opacity={0.3} />
      </pattern>
      <pattern id={`${id}-grate`} width={10} height={10} patternUnits="userSpaceOnUse">
        <rect width={10} height={10} fill={t.floor} />
        <line x1={0} y1={10} x2={10} y2={0} stroke={c} strokeWidth={0.6} opacity={0.45} />
      </pattern>
      <pattern id={`${id}-turf`} width={18} height={14} patternUnits="userSpaceOnUse">
        <rect width={18} height={14} fill={t.floor} />
        <path d="M3 10 l2 -4 l2 4 M11 6 l2 -4 l2 4" fill="none" stroke={c} strokeWidth={0.7} opacity={0.5} />
      </pattern>
      <pattern id={`${id}-foam`} width={26} height={20} patternUnits="userSpaceOnUse">
        <rect width={26} height={20} fill={t.floor} />
        <path d="M2 12 q5 -7 11 0 q5 -7 11 0" fill="none" stroke={c} strokeWidth={0.7} opacity={0.45} />
      </pattern>
      <pattern id={`${id}-stone`} width={34} height={22} patternUnits="userSpaceOnUse">
        <rect width={34} height={22} fill={t.floor} />
        <path d="M0 11 H34 M17 0 V11 M8 11 V22 M26 11 V22" fill="none" stroke={c} strokeWidth={0.6} opacity={0.5} />
      </pattern>
      <radialGradient id={`${id}-void`} cx="50%" cy="50%" r="75%">
        <stop offset="0%" stopColor={t.floorAlt} stopOpacity={0.28} />
        <stop offset="100%" stopColor={t.floor} stopOpacity={1} />
      </radialGradient>
    </defs>
  );
}

function floorFill(id: string, room: Room): string {
  return `url(#${id}-${room.floor})`;
}

/* ── main component ── */

const WALL = 6;

export default function Floorplan({ def, zones, selected, onSelect }: FloorplanProps) {
  const id = useId().replace(/[:]/g, '');
  const t = def.theme;
  const [vx, vy, vw, vh] = def.viewBox;

  const routePath = def.route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const route2Path = def.route2?.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');

  return (
    <svg
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      style={{ width: '100%', height: 'auto', display: 'block', background: t.bg, borderRadius: 12 }}
      role="img"
      aria-label="Maze floorplan"
      onClick={() => onSelect(null)}
    >
      <TextureDefs id={id} t={t} />

      {/* level slabs (multi-level mazes) */}
      {def.levels?.map((lv) => (
        <g key={lv.label}>
          <rect x={lv.x} y={lv.y} width={lv.w} height={lv.h} rx={10} fill={t.floor} opacity={0.25} />
          <text x={lv.x + 12} y={lv.y + 20} fill={t.sub} fontSize={10} fontWeight={700} letterSpacing={2} style={{ textTransform: 'uppercase' }}>
            {lv.label}
          </text>
        </g>
      ))}

      {/* room floors + walls */}
      {def.rooms.map((room, i) => {
        const zone = zones[room.zone];
        const isSel = selected === room.zone;
        return (
          <g
            key={`${room.zone}-${i}`}
            onClick={(e) => { e.stopPropagation(); onSelect(room.zone); }}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={room.x} y={room.y} width={room.w} height={room.h}
              fill={floorFill(id, room)}
              stroke={isSel ? t.accent : t.wall}
              strokeWidth={isSel ? WALL + 1 : WALL}
              strokeLinejoin="round"
              opacity={1}
            />
            {isSel && (
              <rect x={room.x} y={room.y} width={room.w} height={room.h} fill={t.accent} opacity={0.10} />
            )}
            {!room.noLabel && zone && (
              <g pointerEvents="none">
                {zone.zone_number != null && (
                  <text
                    x={room.x + room.w / 2 + (room.labelDx ?? 0)}
                    y={room.y + room.h / 2 - 8 + (room.labelDy ?? 0)}
                    fill={t.sub} fontSize={10} fontWeight={700} textAnchor="middle" letterSpacing={1.5}
                  >
                    ZONE {zone.zone_number}
                  </text>
                )}
                <text
                  x={room.x + room.w / 2 + (room.labelDx ?? 0)}
                  y={room.y + room.h / 2 + (zone.zone_number != null ? 7 : 3) + (room.labelDy ?? 0)}
                  fill={t.label} fontSize={12.5} fontWeight={600} textAnchor="middle"
                >
                  {zone.name}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* door gaps cut over walls */}
      {def.doors.map((d, i) => {
        const w = d.width ?? 26;
        return d.vertical ? (
          <rect key={i} x={d.x - WALL / 2 - 1} y={d.y - w / 2} width={WALL + 2} height={w} fill={t.floor} />
        ) : (
          <rect key={i} x={d.x - w / 2} y={d.y - WALL / 2 - 1} width={w} height={WALL + 2} fill={t.floor} />
        );
      })}

      {/* guest route */}
      <path d={routePath} fill="none" stroke={t.route} strokeWidth={2} strokeDasharray="7 6" strokeLinejoin="round" strokeLinecap="round" opacity={0.8} pointerEvents="none" />
      {route2Path && (
        <path d={route2Path} fill="none" stroke={t.route} strokeWidth={1.6} strokeDasharray="2 5" strokeLinejoin="round" strokeLinecap="round" opacity={0.65} pointerEvents="none" />
      )}

      {/* set pieces */}
      <g pointerEvents="none">
        {def.props.map((p, i) => <Prop key={i} p={p} t={t} />)}
      </g>

      {/* annotations */}
      {def.annotations?.map((a, i) => (
        <text key={i} x={a.x} y={a.y} fill={t.sub} fontSize={9.5} fontStyle="italic" textAnchor={a.anchor ?? 'middle'} pointerEvents="none">
          {a.text}
        </text>
      ))}

      {/* entrance / exit badges */}
      <g pointerEvents="none">
        <g transform={`translate(${def.entrance.x} ${def.entrance.y})`}>
          <rect x={-34} y={-10} width={68} height={20} rx={10} fill={t.accent} />
          <text x={0} y={4} fill={t.bg} fontSize={10.5} fontWeight={800} textAnchor="middle" letterSpacing={1}>
            {def.entrance.label ?? 'ENTRANCE'}
          </text>
        </g>
        <g transform={`translate(${def.exit.x} ${def.exit.y})`}>
          <rect x={-24} y={-10} width={48} height={20} rx={10} fill="none" stroke={t.accent} strokeWidth={1.5} />
          <text x={0} y={4} fill={t.accent} fontSize={10.5} fontWeight={800} textAnchor="middle" letterSpacing={1}>
            {def.exit.label ?? 'EXIT'}
          </text>
        </g>
      </g>

      {/* safety markers on top */}
      <g pointerEvents="none">
        {def.markers.map((m, i) => <Marker key={i} kind={m.kind} x={m.x} y={m.y} types={m.types} />)}
      </g>
    </svg>
  );
}

/** Shared legend rendered below the plan. */
export function FloorplanLegend({ theme }: { theme: FloorplanTheme }) {
  const item: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#94A3B8' };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: '10px 4px 0' }}>
      <span style={item}>
        <svg width={16} height={16} viewBox="-8 -8 16 16"><Marker kind="estop" x={0} y={0} /></svg>
        E-Stop
      </span>
      <span style={item}>
        <svg width={16} height={16} viewBox="-8 -8 16 16"><Marker kind="breakglass" x={0} y={0} /></svg>
        Break glass
      </span>
      <span style={item}>
        <svg width={16} height={20} viewBox="-8 -11 16 22"><Marker kind="ext" x={0} y={0} types={['fire']} /></svg>
        Extinguisher
      </span>
      <span style={item}>
        <svg width={26} height={10} viewBox="0 0 26 10"><line x1={1} y1={5} x2={25} y2={5} stroke={theme.route} strokeWidth={2} strokeDasharray="6 5" /></svg>
        Guest route
      </span>
      <span style={item}>
        <svg width={26} height={10} viewBox="0 0 26 10"><line x1={1} y1={5} x2={25} y2={5} stroke={theme.route} strokeWidth={1.6} strokeDasharray="2 4" /></svg>
        Bypass / secondary
      </span>
    </div>
  );
}
