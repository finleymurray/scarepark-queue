'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, ParkSetting } from '@/types/database';
import { resolveBg, resolveLogo, resolveLogoGlow, resolveGlowRgb } from '@/lib/logos';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenIdentity } from '@/hooks/useScreenIdentity';
import ParkClosedOverlay from '@/components/ParkClosedOverlay';
import ShowsBoard from './ShowsBoard';
import { useTvAttractions } from './useTvAttractions';

/**
 * SpotlightCarousel — single-page photo spotlight carousel for TV4 / TV4.5.
 *
 * One attractions fetch + one realtime channel. Cycles one full-bleed photo
 * slide per ride (~10s each) with a 600ms CSS opacity crossfade — two stacked
 * absolutely-positioned slide layers; the incoming layer runs a one-shot
 * fade-in keyframe. No perpetual animation anywhere: safe for Pi 3/4 kiosks.
 *
 * Layout: "lower third" broadcast bar — logo floats large above, a fixed
 * gradient bar along the bottom carries name / wait / dots / closes pill.
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
            width: i === active ? '3vh' : '1.4vh',
            background: i === active ? `rgb(${glowRgb})` : '#2A3038',
            boxShadow: i === active ? `0 0 10px rgba(${glowRgb},0.7)` : 'none',
          }}
        />
      ))}
    </div>
  );
}

/* ── Lower-third bar pieces ── */

function ClosesPill({ closingTime }: { closingTime: string }) {
  if (!closingTime) return null;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.7vh 1.4vw',
        borderRadius: 999,
        background: 'rgba(245,158,11,0.10)',
        border: '1px solid rgba(245,158,11,0.3)',
        color: '#FCD34D',
        fontSize: '1.7vh',
        fontWeight: 600,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      Closes {formatTime12h(closingTime)}
    </span>
  );
}

/** Centre wait block inside the lower-third bar. */
function BarWait({ attraction, glowRgb }: { attraction: Attraction; glowRgb: string }) {
  const glowColor = `rgb(${glowRgb})`;
  return (
    <div style={{ textAlign: 'center', flexShrink: 0 }}>
      <div
        style={{
          fontSize: '1.5vh',
          fontWeight: 700,
          letterSpacing: '0.25em',
          textIndent: '0.25em',
          textTransform: 'uppercase',
          color: '#475569',
          marginBottom: '0.8vh',
        }}
      >
        Wait
      </div>
      {attraction.status === 'OPEN' ? (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.8vw' }}>
          <span
            style={{
              fontSize: '9vh',
              fontWeight: 500,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              color: glowColor,
              textShadow: `0 0 35px rgba(${glowRgb},0.55), 0 0 90px rgba(${glowRgb},0.25)`,
            }}
          >
            {attraction.wait_time}
          </span>
          <span
            style={{
              fontSize: '2.2vh',
              fontWeight: 700,
              letterSpacing: '0.2em',
              color: `rgba(${glowRgb},0.7)`,
            }}
          >
            MIN
          </span>
        </div>
      ) : (
        <span
          style={{
            fontSize: '3.6vh',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '0.12em',
            whiteSpace: 'nowrap',
            color: attraction.status === 'CLOSED' ? '#F87171' : '#FBBF24',
          }}
        >
          {attraction.status === 'DELAYED'
            ? 'TECHNICAL DELAY'
            : attraction.status === 'AT CAPACITY'
              ? 'AT CAPACITY'
              : 'CLOSED'}
        </span>
      )}
    </div>
  );
}

function BarDivider() {
  return <div style={{ width: 1, height: '55%', background: '#1A1E26', flexShrink: 0 }} />;
}

/** Broadcast lower-third bar: name / wait / dots + closes pill. */
function LowerThirdBar({
  attraction,
  glowRgb,
  slideIndex,
  slideCount,
  closingTime,
}: {
  attraction: Attraction;
  glowRgb: string;
  slideIndex: number;
  slideCount: number;
  closingTime: string;
}) {

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '26vh',
        background:
          'linear-gradient(0deg, rgba(5,6,9,0.96) 60%, rgba(5,6,9,0.75) 85%, transparent 100%)',
        borderTop: `1px solid rgba(${glowRgb},0.25)`,
        display: 'flex',
        alignItems: 'center',
        gap: '3vw',
        padding: '0 4vw',
      }}
    >
      {/* Left: now haunting + name + tagline */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '1.6vh',
            fontWeight: 700,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: `rgb(${glowRgb})`,
            marginBottom: '1vh',
          }}
        >
          Now Haunting
        </div>
        <div
          style={{
            fontSize: '3vh',
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {attraction.name}
        </div>
        {attraction.tagline && (
          <div
            style={{
              marginTop: '0.8vh',
              fontSize: '2vh',
              fontWeight: 500,
              color: '#64748B',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {attraction.tagline}
          </div>
        )}
      </div>

      <BarDivider />

      {/* Centre: wait */}
      <BarWait attraction={attraction} glowRgb={glowRgb} />

      <BarDivider />

      {/* Right: dots + closes pill (no branding on TV4 by design) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '1.4vh',
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        <ProgressDots count={slideCount} active={slideIndex} glowRgb={glowRgb} />
        <ClosesPill closingTime={closingTime} />
      </div>
    </div>
  );
}

/* ── Slide renderers ── */

function AttractionSlide({
  attraction,
  slideIndex,
  slideCount,
  closingTime,
}: {
  attraction: Attraction;
  slideIndex: number;
  slideCount: number;
  closingTime: string;
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

      {/* Glowing logo art — centred in the area above the lower-third bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: '28%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={attraction.name}
            style={{
              height: '42vh',
              maxWidth: '80vw',
              objectFit: 'contain',
              filter: resolveLogoGlow(attraction, 'strong'),
            }}
          />
        )}
      </div>

      {/* Lower-third broadcast bar */}
      <LowerThirdBar
        attraction={attraction}
        glowRgb={glowRgb}
        slideIndex={slideIndex}
        slideCount={slideCount}
        closingTime={closingTime}
      />
    </div>
  );
}

/* ── Shows slide — thin wrapper around the shared ShowsBoard ── */

function ShowsSlide({
  shows,
  slideIndex,
  slideCount,
  closingTime,
}: {
  shows: Attraction[];
  slideIndex: number;
  slideCount: number;
  closingTime: string;
}) {
  return (
    <ShowsBoard
      shows={shows}
      closingTime={closingTime}
      showDots
      slideIndex={slideIndex}
      slideCount={slideCount}
    />
  );
}

function SlideView({
  slide,
  slideIndex,
  slideCount,
  closingTime,
}: {
  slide: Slide;
  slideIndex: number;
  slideCount: number;
  closingTime: string;
}) {
  if (slide.kind === 'shows') {
    return <ShowsSlide shows={slide.shows} slideIndex={slideIndex} slideCount={slideCount} closingTime={closingTime} />;
  }
  return (
    <AttractionSlide
      attraction={slide.attraction}
      slideIndex={slideIndex}
      slideCount={slideCount}
      closingTime={closingTime}
    />
  );
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
          <SlideView slide={slides[safePrev]} slideIndex={safePrev} slideCount={slides.length} closingTime={closingTime} />
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
        <SlideView slide={slides[safeIndex]} slideIndex={safeIndex} slideCount={slides.length} closingTime={closingTime} />
      </div>
    </div>
  );
}
