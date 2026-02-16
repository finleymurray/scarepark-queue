/** Known attraction slugs that have logos in /public/logos/ */
const LOGO_SLUGS = new Set([
  'westlake-witch-trials',
  'the-bunker',
  'drowned',
  'strings-of-control',
  'night-terrors',
  'signal-loss',
  'the-summoning',
  'nightmare-realm',
  'shadows-unleashed',
]);

/** Returns the logo path for an attraction slug, or null if no logo exists. */
export function getAttractionLogo(slug: string): string | null {
  if (LOGO_SLUGS.has(slug)) {
    return `/logos/${slug}.webp`;
  }
  return null;
}

/** Known attraction slugs that have background art in /public/logos/ */
const BG_SLUGS = new Set([
  'westlake-witch-trials',
  'the-bunker',
  'drowned',
  'strings-of-control',
  'night-terrors',
  'signal-loss',
  'the-summoning',
  'nightmare-realm',
  'shadows-unleashed',
]);

/** Returns the background art path for an attraction slug, or null if none exists. */
export function getAttractionBg(slug: string): string | null {
  if (BG_SLUGS.has(slug)) {
    return `/logos/${slug}-bg.webp`;
  }
  return null;
}

/** Queue-specific backgrounds (for entrance screens). Falls back to regular bg. */
const QUEUE_BG: Record<string, string> = {
  'the-bunker': '/logos/the-bunker-queue-bg.png',
  'westlake-witch-trials': '/logos/westlake-witch-trials-queue-bg.png',
  'drowned': '/logos/drowned-queue-bg.png',
  'night-terrors': '/logos/night-terrors-queue-bg.png',
  'signal-loss': '/logos/signal-loss-queue-bg.png',
  'strings-of-control': '/logos/strings-of-control-queue-bg.png',
};

/** Returns the queue display background for an attraction slug.
 *  Uses a dedicated queue bg if available, otherwise falls back to the regular bg. */
export function getQueueBg(slug: string): string | null {
  if (QUEUE_BG[slug]) return QUEUE_BG[slug];
  return getAttractionBg(slug);
}

/** Glow color per logo, matched to the dominant colour of the artwork. */
const LOGO_GLOW_COLORS: Record<string, string> = {
  'westlake-witch-trials': '220, 80, 20',     // orange-red
  'the-bunker': '180, 155, 100',               // sandy tan
  'drowned': '100, 170, 160',                  // teal
  'strings-of-control': '200, 160, 50',        // golden amber
  'night-terrors': '200, 200, 210',            // white
  'signal-loss': '200, 200, 210',              // white
  'the-summoning': '168, 85, 247',             // purple
  'nightmare-realm': '180, 180, 200',          // silver
  'shadows-unleashed': '168, 85, 247',         // purple
};

/** Returns the raw RGB string for a slug's glow color, or null. */
export function getGlowRgb(slug: string): string | null {
  return LOGO_GLOW_COLORS[slug] ?? null;
}

/** Queue display text theme — colour + glow matched to each attraction's vibe. */
const QUEUE_TEXT_THEME: Record<string, { color: string; rgb: string }> = {
  'the-bunker':             { color: '#FBBF24', rgb: '251,191,36' },    // warm amber
  'westlake-witch-trials':  { color: '#C084FC', rgb: '192,132,252' },    // deep purple
  'drowned':                { color: '#5EEAD4', rgb: '94,234,212' },    // teal
  'strings-of-control':     { color: '#DC2626', rgb: '220,38,38' },      // royal red
  'night-terrors':           { color: '#E2E8F0', rgb: '226,232,240' },   // icy white
  'signal-loss':            { color: '#A5F3FC', rgb: '165,243,252' },    // electric cyan
};

/** Returns the queue text theme { color, rgb } for an attraction, with fallback. */
export function getQueueTextTheme(slug: string): { color: string; rgb: string } {
  return QUEUE_TEXT_THEME[slug] ?? { color: '#FBBF24', rgb: '251,191,36' };
}

/** Returns a CSS filter drop-shadow string for the logo glow, or empty string.
 *  Use intensity 'strong' for TV2 banner overlays, 'normal' (default) elsewhere. */
export function getLogoGlow(slug: string, intensity: 'normal' | 'strong' = 'normal'): string {
  const rgb = LOGO_GLOW_COLORS[slug];
  if (!rgb) return '';
  if (intensity === 'strong') {
    return `drop-shadow(0 0 15px rgba(${rgb}, 1)) drop-shadow(0 0 35px rgba(${rgb}, 0.7)) drop-shadow(0 0 70px rgba(${rgb}, 0.4))`;
  }
  return `drop-shadow(0 0 8px rgba(${rgb}, 0.7)) drop-shadow(0 0 20px rgba(${rgb}, 0.4))`;
}
