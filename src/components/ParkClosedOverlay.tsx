'use client';

import { useParkClosed } from '@/hooks/useParkClosed';
import LogoMontage from '@/components/tv/LogoMontage';

/**
 * Blackout overlay — when park_settings.park_closed is true, every screen
 * that renders this overlay shows the full-screen logo montage (same as TV5).
 * The splash logo paints instantly underneath while the montage preloads.
 *
 * The montage only mounts while the blackout is active, so its fetch and
 * interval are cleaned up the moment blackout turns off. Screens that should
 * never black out (e.g. tv-ops) simply don't render this component.
 */
export default function ParkClosedOverlay() {
  const { parkClosed } = useParkClosed();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: '#000',
        opacity: parkClosed ? 1 : 0,
        pointerEvents: parkClosed ? 'auto' : 'none',
        transition: 'opacity 0.6s ease-in-out',
      }}
    >
      {parkClosed && (
        <>
          {/* Instant-paint fallback while montage images preload */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/splash.png"
              alt="Immersive Core"
              decoding="async"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </div>
          {/* Slideshow renders on top once ready (it has its own opaque bg) */}
          <LogoMontage />
        </>
      )}
    </div>
  );
}
