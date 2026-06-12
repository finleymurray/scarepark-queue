'use client';

import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenIdentity } from '@/hooks/useScreenIdentity';
import ParkClosedOverlay from '@/components/ParkClosedOverlay';
import LogoMontage from '@/components/tv/LogoMontage';

/**
 * TV5 — full-screen logo montage. All slideshow logic lives in the shared
 * <LogoMontage/> component (also used by the park-closed blackout overlay).
 */
export default function TV5Page() {
  useConnectionHealth('tv5');
  useScreenIdentity('/tv5');

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#07080B', overflow: 'hidden' }}>
      <ParkClosedOverlay />
      <LogoMontage />
    </div>
  );
}
