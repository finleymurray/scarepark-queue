import type React from 'react';

/**
 * CoreLink design tokens — single source of truth for the redesign.
 *
 * Surface system (4 elevation steps, dark-first):
 *   page → card → control → accent
 * Status is shown as a coloured left rail on cards (see statusRail).
 * All timers/counts should use FONT_NUM for stable tabular digits.
 */

export const surface = {
  page: '#0A0B0E',      // app background
  card: '#101318',      // primary cards / panels
  control: '#13161C',   // buttons, inputs, nested surfaces
  raised: '#181D24',    // hover / active nested surfaces
} as const;

export const border = {
  default: '#23262E',
  strong: '#2E3543',
  divider: '#181B21',
} as const;

export const text = {
  primary: '#F8FAFC',
  secondary: '#94A3B8',
  muted: '#64748B',
  faint: '#475569',
} as const;

/** Per-app accent identities (unchanged from the original brand). */
export const accents = {
  control: { base: '#3B82F6', strong: '#1D4ED8', soft: 'rgba(59,130,246,0.12)', text: '#93C5FD' },
  signoff: { base: '#F59E0B', strong: '#D97706', soft: 'rgba(245,158,11,0.12)', text: '#FCD34D' },
  admin:   { base: '#EF4444', strong: '#B91C1C', soft: 'rgba(239,68,68,0.12)', text: '#FCA5A5' },
} as const;

export type AppKey = keyof typeof accents;

/** Status colours — rails, pills and text. */
export const status = {
  OPEN:          { rail: '#22C55E', text: '#4ADE80', soft: 'rgba(34,197,94,0.12)' },
  CLOSED:        { rail: '#EF4444', text: '#F87171', soft: 'rgba(239,68,68,0.12)' },
  DELAYED:       { rail: '#F59E0B', text: '#FBBF24', soft: 'rgba(245,158,11,0.12)' },
  'AT CAPACITY': { rail: '#F59E0B', text: '#FBBF24', soft: 'rgba(245,158,11,0.12)' },
} as const;

export function statusColors(s: string) {
  return status[s as keyof typeof status] ?? { rail: '#64748B', text: '#94A3B8', soft: 'rgba(100,116,139,0.12)' };
}

export const radius = { sm: 8, md: 10, lg: 12, xl: 14, pill: 999 } as const;

/** Tabular numerals for anything that ticks (timers, counters). */
export const FONT_NUM: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };

/** 10px uppercase micro-label used above stats. */
export const microLabel: React.CSSProperties = {
  color: text.muted,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

/** Standard card style; pass a status to get the coloured left rail. */
export function card(railStatus?: string): React.CSSProperties {
  const base: React.CSSProperties = {
    background: surface.card,
    border: `1px solid ${border.default}`,
    borderRadius: radius.xl,
  };
  if (railStatus) {
    base.borderLeft = `3px solid ${statusColors(railStatus).rail}`;
    base.borderTopLeftRadius = 0;
    base.borderBottomLeftRadius = 0;
  }
  return base;
}

/** Control-surface button (secondary). */
export const controlButton: React.CSSProperties = {
  background: surface.control,
  border: `1px solid ${border.strong}`,
  borderRadius: radius.md,
  color: text.secondary,
  cursor: 'pointer',
};

/** Filled accent button (primary) for a given app. */
export function primaryButton(app: AppKey): React.CSSProperties {
  return {
    background: accents[app].strong,
    border: 'none',
    borderRadius: radius.lg,
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  };
}
