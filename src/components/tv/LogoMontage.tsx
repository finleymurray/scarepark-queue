'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction } from '@/types/database';
import { resolveBg, resolveGlowRgb, resolveLogo, resolveLogoGlow } from '@/lib/logos';
import TvFooter from './TvFooter';

/**
 * LogoMontage — full-screen attraction logo slideshow, Pi 3/4 friendly.
 *
 * Architecture (the smoothness contract):
 * - Exactly TWO persistent slide layers that never unmount. We alternate
 *   which one is visible by toggling opacity with a CSS *transition*
 *   (not keyframes). The hidden layer's content is updated BEFORE it is
 *   made visible, so there is never a re-mount mid-fade.
 * - Slow Ken Burns: the visible layer's bg image transitions
 *   scale(1) → scale(1.06) over 12s (transform-only, GPU composited).
 *   The transform resets instantly when the layer is hidden.
 * - All images preloaded on mount; cycling starts after preload settles
 *   (with a timeout fallback so a stalled image can't block the show).
 * - Zero per-frame JS. No clip-path, no animated filters, no keyframes.
 *   `will-change: opacity` on the two layers only.
 */

const SLIDE_MS = 4500;
const FADE_MS = 700;
const KEN_BURNS_MS = 5400; // a touch longer than a slide so motion never freezes
const PRELOAD_TIMEOUT_MS = 5000;
const FALLBACK_GLOW = '200,200,210';

/* Per-slide Ken Burns moves so consecutive slides feel different. Scale stays
   >1 so the pan never reveals an edge. Transform-only → GPU-composited, Pi-safe. */
const KEN_BURNS: { from: string; to: string }[] = [
  { from: 'scale(1.02)', to: 'scale(1.14)' },                          // push in
  { from: 'scale(1.14)', to: 'scale(1.02)' },                          // pull out
  { from: 'scale(1.12) translate(-3%, 0)', to: 'scale(1.12) translate(3%, 0)' },  // pan right
  { from: 'scale(1.12) translate(0, -3%)', to: 'scale(1.12) translate(0, 3%)' },  // pan down
];

const MONTAGE_COLUMNS =
  'id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at,logo_url,bg_url,queue_bg_url,glow_rgb,text_color,text_rgb,tagline';

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

interface SlideContentProps {
  attraction: Attraction | null;
  /** Whether this layer is currently the visible one (drives Ken Burns). */
  active: boolean;
  /** Which Ken Burns move to use (varies per slide). */
  variant: number;
}

/** Static slide content — bg photo + scrim + glowing logo. */
function SlideContent({ attraction, active, variant }: SlideContentProps) {
  if (!attraction) return null;

  const bg = resolveBg(attraction);
  const logo = resolveLogo(attraction);
  const glowRgb = resolveGlowRgb(attraction) ?? FALLBACK_GLOW;
  const kb = KEN_BURNS[variant % KEN_BURNS.length];

  return (
    <>
      {/* Background photo with varied Ken Burns (transform-only) */}
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: active ? kb.to : kb.from,
            transition: active ? `transform ${KEN_BURNS_MS}ms linear` : 'none',
            willChange: 'transform',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, rgba(${glowRgb},0.14) 0%, #07080B 70%)`,
          }}
        />
      )}

      {/* Dark scrim so the logo reads over the photo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(5,6,9,0.72) 0%, rgba(5,6,9,0.55) 45%, rgba(5,6,9,0.82) 100%)',
        }}
      />

      {/* Centred logo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 6vw',
        }}
      >
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={attraction.id}
            src={logo}
            alt={attraction.name}
            style={{
              height: '48vh',
              maxWidth: '84vw',
              objectFit: 'contain',
              filter: resolveLogoGlow(attraction, 'strong'),
              animation: active ? 'lm-logo-in 700ms cubic-bezier(0.22,1,0.36,1) both' : undefined,
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
      </div>
    </>
  );
}

interface LogoMontageProps {
  /** Show the built-in "Immersive Core" wordmark while preloading.
   *  Pass false when a host (e.g. the blackout overlay) paints its own
   *  fallback underneath — the montage stays transparent until ready. */
  showPlaceholder?: boolean;
}

export default function LogoMontage({ showPlaceholder = true }: LogoMontageProps) {
  const [slides, setSlides] = useState<Attraction[]>([]);
  const [ready, setReady] = useState(false);

  /* Two persistent layers. layerA/layerB hold each layer's current slide;
     frontIsA says which layer is visible. */
  const [layerA, setLayerA] = useState<Attraction | null>(null);
  const [layerB, setLayerB] = useState<Attraction | null>(null);
  const [frontIsA, setFrontIsA] = useState(true);
  const indexRef = useRef(0);

  /* One-shot fetch — static slideshow, no realtime needed. */
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const { data, error } = await supabase
        .from('attractions')
        .select(MONTAGE_COLUMNS)
        .order('sort_order', { ascending: true });
      if (cancelled || error || !data) return;

      const usable = (data as Attraction[]).filter((a) => a.attraction_type !== 'show');
      if (usable.length === 0) return;

      /* Preload every bg + logo before cycling starts. */
      const srcs = new Set<string>();
      usable.forEach((a) => {
        const bg = resolveBg(a);
        const logo = resolveLogo(a);
        if (bg) srcs.add(bg);
        if (logo) srcs.add(logo);
      });
      await Promise.race([
        Promise.all([...srcs].map(preloadImage)),
        new Promise((resolve) => setTimeout(resolve, PRELOAD_TIMEOUT_MS)),
      ]);
      if (cancelled) return;

      setSlides(usable);
      setLayerA(usable[0]);
      setLayerB(usable.length > 1 ? usable[1] : usable[0]);
      indexRef.current = 0;
      setFrontIsA(true);
      setReady(true);
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Cycle: update the HIDDEN layer's content, then flip visibility.
     Single interval; cleared on unmount (e.g. blackout turning off). */
  useEffect(() => {
    if (!ready || slides.length < 2) return;

    const interval = setInterval(() => {
      indexRef.current = (indexRef.current + 1) % slides.length;
      const next = slides[indexRef.current];
      setFrontIsA((wasA) => {
        /* The currently hidden layer becomes the front — load it first. */
        if (wasA) setLayerB(next);
        else setLayerA(next);
        return !wasA;
      });
    }, SLIDE_MS);

    return () => clearInterval(interval);
  }, [ready, slides]);

  const layerStyle = (visible: boolean): React.CSSProperties => ({
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    opacity: visible ? 1 : 0,
    transition: `opacity ${FADE_MS}ms ease`,
    willChange: 'opacity',
  });

  // Ken Burns move varies by each slide's position in the list.
  const variantFor = (a: Attraction | null) => (a ? Math.max(0, slides.findIndex((s) => s.id === a.id)) : 0);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: ready || showPlaceholder ? '#07080B' : 'transparent',
        overflow: 'hidden',
      }}
    >
      {!ready && showPlaceholder && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '1.5vw',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
            }}
          >
            Immersive Core
          </span>
        </div>
      )}

      <style>{`@keyframes lm-logo-in{from{opacity:0;transform:translateY(2.5vh) scale(0.94)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>

      {/* Two persistent slide layers — never unmount, only opacity flips. */}
      <div style={layerStyle(ready && frontIsA)}>
        <SlideContent attraction={layerA} active={ready && frontIsA} variant={variantFor(layerA)} />
      </div>
      <div style={layerStyle(ready && !frontIsA)}>
        <SlideContent attraction={layerB} active={ready && !frontIsA} variant={variantFor(layerB)} />
      </div>

      {/* Subtle vignette for depth */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.45) 100%)' }} />

      {/* Bottom brand strip — editable via Admin → Screens */}
      <div
        style={{
          opacity: ready ? 1 : 0,
          transition: `opacity ${FADE_MS}ms ease`,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <TvFooter />
      </div>
    </div>
  );
}
