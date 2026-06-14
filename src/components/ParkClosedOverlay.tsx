'use client';

import { useParkClosed } from '@/hooks/useParkClosed';
import LogoMontage from '@/components/tv/LogoMontage';
import { resolveBg, resolveLogo, resolveLogoGlow, resolveGlowRgb } from '@/lib/logos';
import type { Attraction } from '@/types/database';

/**
 * Blackout overlay. When this screen should black out (global park_closed OR
 * this device's own screen.blackout — see useParkClosed):
 *  - A single-attraction screen (e.g. a queue display) shows just THAT
 *    attraction's logo (pass `attraction`).
 *  - Any other screen shows the full-park logo montage.
 * Screens that should never black out (e.g. tv-ops) don't render this.
 */
export default function ParkClosedOverlay({ attraction }: { attraction?: Attraction | null } = {}) {
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
          {/* Instant-paint fallback while images preload */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/splash.png" alt="Immersive Core" decoding="async" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
          {attraction ? <SingleLogoBlackout attraction={attraction} /> : <LogoMontage showFooter={false} />}
        </>
      )}
    </div>
  );
}

/** Static single-attraction blackout: its bg photo + glowing logo. */
function SingleLogoBlackout({ attraction }: { attraction: Attraction }) {
  const bg = resolveBg(attraction);
  const logo = resolveLogo(attraction);
  const glowRgb = resolveGlowRgb(attraction) ?? '200,200,210';

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#07080B', overflow: 'hidden' }}>
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.05)' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at center, rgba(${glowRgb},0.14) 0%, #07080B 70%)` }} />
      )}
      {/* Scrim */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,6,9,0.72) 0%, rgba(5,6,9,0.55) 45%, rgba(5,6,9,0.82) 100%)' }} />
      {/* Centred logo */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6vw' }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt={attraction.name} style={{ height: '52vh', maxWidth: '86vw', objectFit: 'contain', filter: resolveLogoGlow(attraction, 'strong') }} />
        ) : (
          <span style={{ fontSize: '6vw', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', color: `rgb(${glowRgb})`, textShadow: `0 0 30px rgba(${glowRgb},0.8), 0 0 70px rgba(${glowRgb},0.4)`, textAlign: 'center' }}>
            {attraction.name}
          </span>
        )}
      </div>
      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />
    </div>
  );
}
