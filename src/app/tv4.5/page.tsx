'use client';

import SpotlightCarousel from '@/components/tv/SpotlightCarousel';

/**
 * TV4.5 — identical photo spotlight carousel to TV4 (the new TV4 is
 * already Pi-lite), kept as a separate route so screens assigned to
 * /tv4.5 keep their identity binding.
 */
export default function TV45Page() {
  return <SpotlightCarousel identityPath="/tv4.5" healthKey="tv4.5" />;
}
