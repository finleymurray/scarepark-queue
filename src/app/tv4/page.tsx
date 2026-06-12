'use client';

import SpotlightCarousel from '@/components/tv/SpotlightCarousel';

/**
 * TV4 — Photo spotlight carousel.
 *
 * Single page, no iframes: one attractions fetch, one realtime channel,
 * CSS opacity crossfades only. Pi 3/4 safe.
 */
export default function TV4Page() {
  return <SpotlightCarousel identityPath="/tv4" healthKey="tv4" />;
}
