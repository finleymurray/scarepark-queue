'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, ParkSetting } from '@/types/database';
import { resolveBg, resolveLogo, resolveLogoGlow, resolveGlowRgb } from '@/lib/logos';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenIdentity } from '@/hooks/useScreenIdentity';
import ParkClosedOverlay from '@/components/ParkClosedOverlay';
import { useTvAttractions } from './useTvAttractions';
import TvFooter from './TvFooter';

/**
 * SpotlightCarousel — single-page photo spotlight carousel for TV4 / TV4.5.
 *
 * One attractions fetch + one realtime channel. Cycles one full-bleed photo
 * slide per ride (~10s each) with a 600ms CSS opacity crossfade — two stacked
 * absolutely-positioned slide layers; the incoming layer runs a one-shot
 * fade-in keyframe. No perpetual animation anywhere: safe for Pi 3/4 kiosks.
 */

const SLIDE_DURATION = 10000;
const FADE_MS = 600;
const FALLBACK_GLOW = '251,191,36';

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

type Slide =
  | { kind: 'attraction'; attraction: Attraction }
  | { kind: 'shows'; shows: Attraction[] };

/* ── Glass chip ── */

function Chip({ glowRgb, label, children }: { glowRgb: string; label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: `1px solid rgba(${glowRgb},0.35)`,
        borderRadius: 14,
        padding: '2.5vh 3vw',
        textAlign: 'center',
        minWidth: '12vw',
      }}
    >
      <div
        style={{
          fontSize: '1.8vh',
          fontWeight: 700,
          letterSpacing: '0.35em',
          textIndent: '0.35em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.6)',
          marginBottom: '1vh',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function WaitChip({ attraction, glowRgb }: { attraction: Attraction; glowRgb: string }) {
  const glowColor = `rgb(${glowRgb})`;
  if (attraction.status === 'OPEN') {
    return (
      <Chip glowRgb={glowRgb} label="Wait">
        <span
          style={{
            fontSize: '9.5vh',
            fontWeight: 900,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: glowColor,
            textShadow: `0 0 35px rgba(${glowRgb},0.6)`,
          }}
        >
          {attraction.wait_time}
        </span>
        <span style={{ fontSize: '2.6vh', fontWeight: 700, color: `rgba(${glowRgb},0.8)`, marginLeft: '0.5vw' }}>
          MIN
        </span>
      </Chip>
    );
  }
  const statusText =
    attraction.status === 'DELAYED'
      ? 'TECHNICAL DELAY'
      : attraction.status === 'AT CAPACITY'
        ? 'AT CAPACITY'
        : 'CLOSED';
  const statusColor = attraction.status === 'CLOSED' ? '#f87171' : '#F59E0B';
  return (
    <Chip glowRgb={glowRgb} label="Wait">
      <span
        style={{
          fontSize: '3.6vh',
          fontWeight: 800,
          lineHeight: 1.2,
          letterSpacing: '0.08em',
          color: statusColor,
          whiteSpace: 'nowrap',
        }}
      >
        {statusText}
      </span>
    </Chip>
  );
}

function FearChip({ rating, glowRgb }: { rating: number; glowRgb: string }) {
  const stars = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <Chip glowRgb={glowRgb} label="Fear">
      <span style={{ fontSize: '3vh', lineHeight: 1.2, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
        <span style={{ color: '#E2E8F0' }}>{'★'.repeat(stars)}</span>
        <span style={{ color: 'rgba(255,255,255,0.22)' }}>{'☆'.repeat(5 - stars)}</span>
      </span>
    </Chip>
  );
}

/* ── Progress dots ── */

function ProgressDots({ count, active, glowRgb }: { count: number; active: number; glowRgb: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5vw' }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            height: '0.6vh',
            borderRadius: '0.3vh',
            width: i === active ? '3.5vh' : '1.4vh',
            background: i === active ? `rgb(${glowRgb})` : 'rgba(255,255,255,0.18)',
            boxShadow: i === active ? `0 0 10px rgba(${glowRgb},0.7)` : 'none',
          }}
        />
      ))}
    </div>
  );
}

/* ── Slide renderers ── */

function AttractionSlide({
  attraction,
  slideIndex,
  slideCount,
}: {
  attraction: Attraction;
  slideIndex: number;
  slideCount: number;
}) {
  const bg = resolveBg(attraction);
  const logo = resolveLogo(attraction);
  const glowRgb = resolveGlowRgb(attraction) ?? FALLBACK_GLOW;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#07080B', overflow: 'hidden' }}>
      {/* Full-bleed background photo */}
      {bg && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${bg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
      )}

      {/* Bottom scrim */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(0deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.15) 38%, transparent 60%)',
        }}
      />

      {/* Glowing logo art — top centre */}
      {logo && (
        <div style={{ position: 'absolute', top: '13vh', left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt={attraction.name}
            style={{
              height: '40vh',
              maxWidth: '78vw',
              objectFit: 'contain',
              filter: resolveLogoGlow(attraction, 'strong'),
            }}
          />
        </div>
      )}

      {/* Bottom-left: tagline + progress dots */}
      <div style={{ position: 'absolute', left: '4.5vw', bottom: '8vh', maxWidth: '40vw' }}>
        {attraction.tagline && (
          <p
            style={{
              margin: '0 0 2.5vh',
              fontSize: '2.6vh',
              fontWeight: 600,
              lineHeight: 1.3,
              color: 'rgba(255,255,255,0.92)',
              textShadow: '0 2px 20px rgba(0,0,0,0.8)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {attraction.tagline}
          </p>
        )}
        <ProgressDots count={slideCount} active={slideIndex} glowRgb={glowRgb} />
      </div>

      {/* Bottom-right: glass chips */}
      <div style={{ position: 'absolute', right: '4.5vw', bottom: '8vh', display: 'flex', gap: '1.2vw', alignItems: 'stretch' }}>
        <WaitChip attraction={attraction} glowRgb={glowRgb} />
        {attraction.fear_rating != null && <FearChip rating={attraction.fear_rating} glowRgb={glowRgb} />}
      </div>
    </div>
  );
}

function ShowsSlide({
  shows,
  slideIndex,
  slideCount,
}: {
  shows: Attraction[];
  slideIndex: number;
  slideCount: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, #14161D 0%, #07080B 75%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 6vw',
      }}
    >
      <h2
        style={{
          margin: '0 0 5vh',
          fontSize: '3.2vw',
          fontWeight: 800,
          letterSpacing: '0.35em',
          textIndent: '0.35em',
          textTransform: 'uppercase',
          color: '#fff',
          textShadow: '0 0 30px rgba(255,255,255,0.25)',
        }}
      >
        Tonight&apos;s Shows
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3vh', width: '100%', maxWidth: '60vw' }}>
        {shows.map((show) => (
          <div key={show.id} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '3vw' }}>
            <span style={{ fontSize: '2.4vw', fontWeight: 700, color: 'rgba(255,255,255,0.92)', whiteSpace: 'nowrap' }}>
              {show.name}
            </span>
            <span
              style={{
                fontSize: '1.8vw',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                color: 'rgba(255,255,255,0.55)',
                textAlign: 'right',
              }}
            >
              {show.show_times && show.show_times.length > 0
                ? show.show_times.map(formatTime12h).join('  ·  ')
                : '—'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', left: '4vw', bottom: '7vh' }}>
        <ProgressDots count={slideCount} active={slideIndex} glowRgb={FALLBACK_GLOW} />
      </div>
    </div>
  );
}

function SlideView({ slide, slideIndex, slideCount }: { slide: Slide; slideIndex: number; slideCount: number }) {
  if (slide.kind === 'shows') {
    return <ShowsSlide shows={slide.shows} slideIndex={slideIndex} slideCount={slideCount} />;
  }
  return <AttractionSlide attraction={slide.attraction} slideIndex={slideIndex} slideCount={slideCount} />;
}

/* ── Main carousel ── */

export default function SpotlightCarousel({
  identityPath,
  healthKey,
}: {
  identityPath: string;
  healthKey: string;
}) {
  useConnectionHealth(healthKey);
  useScreenIdentity(identityPath);

  const { attractions, loading } = useTvAttractions(`${healthKey}-attractions`);
  const [closingTime, setClosingTime] = useState('');
  const [index, setIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const preloadedRef = useRef<Set<string>>(new Set());

  /* park_settings: closing time fetch + realtime (as before) */
  useEffect(() => {
    async function fetchClosingTime() {
      const { data } = await supabase
        .from('park_settings')
        .select('key,value')
        .eq('key', 'closing_time')
        .single();
      if (data) setClosingTime(data.value);
    }
    fetchClosingTime();

    const channel = supabase
      .channel(`${healthKey}-settings`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'closing_time') setClosingTime(setting.value);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [healthKey]);

  /* Build slides: all rides by sort_order, then one shows slide if shows exist */
  const rides = attractions.filter((a) => a.attraction_type !== 'show');
  const shows = attractions.filter((a) => a.attraction_type === 'show');
  const slides: Slide[] = rides.map((attraction) => ({ kind: 'attraction' as const, attraction }));
  if (shows.length > 0) slides.push({ kind: 'shows', shows });

  /* Preload all background images once they're known */
  useEffect(() => {
    attractions.forEach((a) => {
      const bg = resolveBg(a);
      if (bg && !preloadedRef.current.has(bg)) {
        preloadedRef.current.add(bg);
        const img = new Image();
        img.src = bg;
      }
      const logo = resolveLogo(a);
      if (logo && !preloadedRef.current.has(logo)) {
        preloadedRef.current.add(logo);
        const img = new Image();
        img.src = logo;
      }
    });
  }, [attractions]);

  /* Slide timer */
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setTimeout(() => {
      setPrevIndex(index);
      setIndex((index + 1) % slides.length);
    }, SLIDE_DURATION);
    return () => clearTimeout(timer);
  }, [index, slides.length]);

  /* Drop the outgoing layer from the DOM once the crossfade is done */
  useEffect(() => {
    if (prevIndex === null) return;
    const timer = setTimeout(() => setPrevIndex(null), FADE_MS + 100);
    return () => clearTimeout(timer);
  }, [prevIndex, index]);

  const safeIndex = slides.length > 0 ? index % slides.length : 0;
  const safePrev = prevIndex !== null && slides.length > 0 ? prevIndex % slides.length : null;

  if (loading || slides.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#07080B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ParkClosedOverlay />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '1.5vw', letterSpacing: '0.3em', textTransform: 'uppercase' }}>
          Immersive Core
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#07080B',
        overflow: 'hidden',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#fff',
      }}
    >
      <style>{`@keyframes tvSlideFadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <ParkClosedOverlay />

      {/* Outgoing slide — stays fully visible underneath while the new one fades in */}
      {safePrev !== null && safePrev !== safeIndex && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <SlideView slide={slides[safePrev]} slideIndex={safePrev} slideCount={slides.length} />
        </div>
      )}

      {/* Incoming/current slide — one-shot 600ms opacity fade on slide change */}
      <div
        key={safeIndex}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          animation: safePrev !== null ? `tvSlideFadeIn ${FADE_MS}ms ease both` : 'none',
        }}
      >
        <SlideView slide={slides[safeIndex]} slideIndex={safeIndex} slideCount={slides.length} />
      </div>

      {/* Park brand strip — overlays the photo bottom edge */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 3,
          pointerEvents: 'none',
        }}
      >
        <TvFooter closeTime={closingTime ? formatTime12h(closingTime) : null} />
      </div>
    </div>
  );
}
