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

/** Returns a CSS filter drop-shadow string for the logo glow, or empty string. */
export function getLogoGlow(slug: string): string {
  const rgb = LOGO_GLOW_COLORS[slug];
  if (!rgb) return '';
  return `drop-shadow(0 0 8px rgba(${rgb}, 0.7)) drop-shadow(0 0 20px rgba(${rgb}, 0.4))`;
}
