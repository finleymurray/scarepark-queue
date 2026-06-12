'use client';

import { useEffect, useRef, useState } from 'react';
import type { Attraction } from '@/types/database';
import { resolveGlowRgb, resolveLogo, resolveLogoGlow } from '@/lib/logos';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenIdentity } from '@/hooks/useScreenIdentity';
import ParkClosedOverlay from '@/components/ParkClosedOverlay';
import { useTvAttractions } from '@/components/tv/useTvAttractions';

/**
 * TV5 — Calm logo montage.
 *
 * Cycles one glowing attraction logo at a time (~6s) with a 600ms opacity
 * crossfade. The only flourish is a single 150ms CSS glitch keyframe that
 * runs ONCE per slide change — no canvas, no requestAnimationFrame, no
 * perpetual animation. Pi 3/4 safe.
 */

const SLIDE_DURATION = 6000;
const FADE_MS = 600;
const FALLBACK_GLOW = '200,200,210';

function LogoSlide({ attraction }: { attraction: Attraction }) {
  const logo = resolveLogo(attraction);
  const glowRgb = resolveGlowRgb(attraction) ?? FALLBACK_GLOW;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at center, rgba(${glowRgb},0.12) 0%, #07080B 70%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4vh',
      }}
    >
      {logo ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logo}
          alt={attraction.name}
          style={{
            height: '45vh',
            maxWidth: '75vw',
            objectFit: 'contain',
            filter: resolveLogoGlow(attraction, 'strong'),
          }}
        />
      ) : (
        <span
          style={{
            fontSize: '5vw',
            fontWeight: 900,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: `rgb(${glowRgb})`,
            textShadow: `0 0 30px rgba(${glowRgb},0.8), 0 0 70px rgba(${glowRgb},0.4)`,
            textAlign: 'center',
          }}
        >
          {attraction.name}
        </span>
      )}
      {attraction.tagline && (
        <p
          style={{
            margin: 0,
            maxWidth: '60vw',
            textAlign: 'center',
            fontSize: '1.6vw',
            fontWeight: 500,
            letterSpacing: '0.12em',
            lineHeight: 1.4,
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          {attraction.tagline}
        </p>
      )}
    </div>
  );
}

export default function TV5LogoMontage() {
  useConnectionHealth('tv5');
  useScreenIdentity('/tv5');

  const { attractions } = useTvAttractions('tv5-attractions');
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const preloadedRef = useRef<Set<string>>(new Set());

  const slides = attractions.filter((a) => a.attraction_type !== 'show');

  /* Preload logos once known */
  useEffect(() => {
    slides.forEach((a) => {
      const logo = resolveLogo(a);
      if (logo && !preloadedRef.current.has(logo)) {
        preloadedRef.current.add(logo);
        const img = new Image();
        img.src = logo;
      }
    });
  }, [slides]);

  /* Slide timer */
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setTimeout(() => {
      setPrevIndex(index);
      setIndex((index + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => clearTimeout(timer);
  }, [index, slides.length]);

  /* Remove outgoing layer after the crossfade completes */
  useEffect(() => {
    if (prevIndex === null) return;
    const timer = setTimeout(() => setPrevIndex(null), FADE_MS + 100);
    return () => clearTimeout(timer);
  }, [prevIndex, index]);

  const safeIndex = slides.length > 0 ? index % slides.length : 0;
  const safePrev = prevIndex !== null && slides.length > 0 ? prevIndex % slides.length : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#07080B', overflow: 'hidden' }}>
      <style>{`
        @keyframes tv5FadeIn { from { opacity: 0; } to { opacity: 1; } }
        /* One-shot 150ms glitch on slide change — two quick clip/translate steps, then settle */
        @keyframes tv5Glitch {
          0%   { clip-path: inset(0 0 0 0); transform: translate(0, 0); }
          25%  { clip-path: inset(12% 0 55% 0); transform: translate(-8px, 2px); }
          50%  { clip-path: inset(60% 0 8% 0); transform: translate(8px, -2px); }
          75%  { clip-path: inset(30% 0 30% 0); transform: translate(-4px, 0); }
          100% { clip-path: inset(0 0 0 0); transform: translate(0, 0); }
        }
      `}</style>
      <ParkClosedOverlay />

      {slides.length === 0 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.5vw', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
            Immersive Core
          </span>
        </div>
      ) : (
        <>
          {/* Outgoing slide — visible underneath during crossfade */}
          {safePrev !== null && safePrev !== safeIndex && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
              <LogoSlide attraction={slides[safePrev]} />
            </div>
          )}

          {/* Incoming slide — 600ms fade + single 150ms glitch flourish, both run once */}
          <div
            key={safeIndex}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              animation:
                safePrev !== null
                  ? `tv5FadeIn ${FADE_MS}ms ease both, tv5Glitch 150ms steps(4, end) 1`
                  : 'none',
            }}
          >
            <LogoSlide attraction={slides[safeIndex]} />
          </div>
        </>
      )}
    </div>
  );
}
