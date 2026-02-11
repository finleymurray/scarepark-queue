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
