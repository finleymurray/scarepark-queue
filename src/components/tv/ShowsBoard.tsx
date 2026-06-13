'use client';

import type { Attraction } from '@/types/database';
import { resolveBg, resolveLogo, resolveLogoGlow, resolveGlowRgb } from '@/lib/logos';

/**
 * ShowsBoard — shared "Tonight's Shows" board used by TV3 (full-screen,
 * standalone) and TV4's SpotlightCarousel shows slide.
 *
 * Purely presentational: header with ClosesPill, photo hero with scrim +
 * logo + next-show time + tagline, upcoming show cards row, and optional
 * carousel progress dots. No data fetching, no perpetual animation.
 */

const FALLBACK_GLOW = '251,191,36';

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

function getNextShowTime(showTimes: string[] | null): string | null {
  if (!showTimes || showTimes.length === 0) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const sorted = [...showTimes].sort();
  for (const time of sorted) {
    const [h, m] = time.split(':');
    const timeMinutes = parseInt(h, 10) * 60 + parseInt(m, 10);
    if (timeMinutes > nowMinutes) return time;
  }
  return null;
}

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

function ShowsHero({ show, nextTime }: { show: Attraction; nextTime: string | null }) {
  const bg = resolveBg(show);
  const logo = resolveLogo(show);
  const glowRgb = resolveGlowRgb(show) ?? FALLBACK_GLOW;

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        borderRadius: 6,
        overflow: 'hidden',
        background: '#0A0C10',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {bg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg}
          alt=""
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
          }}
        />
      )}
      {/* Left-to-right cinematic scrim + glow-tinted wash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to right, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.72) 32%, rgba(0,0,0,0.3) 62%, rgba(0,0,0,0.05) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(160deg, rgba(${glowRgb},0.18) 0%, transparent 55%)`,
        }}
      />

      {/* Content — left stack */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '3vh 3.5vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          maxWidth: '62%',
        }}
      >
        <div
          style={{
            fontSize: '1.8vh',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.35em',
            color: `rgb(${glowRgb})`,
            textShadow: `0 0 18px rgba(${glowRgb},0.6)`,
            marginBottom: '2vh',
          }}
        >
          {show.status === 'DELAYED'
            ? 'Technical Delay'
            : show.status === 'CLOSED'
              ? 'Closed'
              : nextTime
                ? 'Up Next'
                : 'No More Shows Tonight'}
        </div>

        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={show.name}
            decoding="async"
            style={{
              height: '22vh',
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              objectPosition: 'left center',
              filter: resolveLogoGlow(show, 'strong') || undefined,
              marginBottom: '2.5vh',
            }}
          />
        ) : (
          <h2
            style={{
              fontSize: '6vh',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#fff',
              margin: '0 0 2.5vh',
              lineHeight: 1.05,
            }}
          >
            {show.name}
          </h2>
        )}

        {nextTime && show.status !== 'CLOSED' && (
          <div
            style={{
              fontSize: '8vh',
              fontWeight: 800,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              color: `rgb(${glowRgb})`,
              textShadow: `0 0 35px rgba(${glowRgb},0.55)`,
            }}
          >
            {formatTime12h(nextTime)}
          </div>
        )}

        {/* Tagline / venue line */}
        {show.tagline && (
          <div
            style={{
              marginTop: nextTime && show.status !== 'CLOSED' ? '2vh' : 0,
              fontSize: '2.2vh',
              fontWeight: 500,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {show.tagline}
          </div>
        )}
      </div>
    </div>
  );
}

function UpcomingShowCard({ show, time }: { show: Attraction; time: string }) {
  const glowRgb = resolveGlowRgb(show) ?? FALLBACK_GLOW;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '1.2vh',
        padding: '0 1.6vw',
        borderRadius: 4,
        border: '1px solid #15181E',
        borderLeft: `4px solid rgba(${glowRgb},0.65)`,
        background: `linear-gradient(160deg, rgba(${glowRgb},0.08) 0%, rgba(0,0,0,0.3) 100%)`,
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize: '3.5vh',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          color: `rgb(${glowRgb})`,
        }}
      >
        {formatTime12h(time)}
      </span>
      <span
        style={{
          fontSize: '2vh',
          fontWeight: 600,
          lineHeight: 1.2,
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          color: '#94A3B8',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {show.name}
      </span>
    </div>
  );
}

export default function ShowsBoard({
  shows,
  closingTime,
  showDots = false,
  slideIndex = 0,
  slideCount = 0,
}: {
  shows: Attraction[];
  closingTime: string;
  showDots?: boolean;
  slideIndex?: number;
  slideCount?: number;
}) {
  // Flatten all upcoming (show, time) pairs, chronological.
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const upcoming = shows
    .flatMap((show) =>
      (show.show_times ?? []).map((time) => {
        const [h, m] = time.split(':');
        return { show, time, minutes: parseInt(h, 10) * 60 + parseInt(m, 10) };
      }),
    )
    .filter((e) => e.minutes > nowMinutes)
    .sort((a, b) => a.minutes - b.minutes);

  const heroShow = upcoming[0]?.show ?? shows[0] ?? null;
  const upcomingCards = upcoming.slice(1, 6);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse at center, #14161D 0%, #07080B 75%)',
        display: 'flex',
        flexDirection: 'column',
        padding: '4vh 4vw',
        gap: '2vh',
        color: '#fff',
      }}
    >
      {/* Header */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          paddingBottom: '1.5vh',
          borderBottom: '1px solid #15181E',
        }}
      >
        <h1
          style={{
            fontSize: '2.6vh',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: '#E2E8F0',
            margin: 0,
          }}
        >
          Tonight&apos;s Shows
        </h1>
        <ClosesPill closingTime={closingTime} />
      </div>

      {!heroShow ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: '#334155', fontSize: '2.4vh', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
            No shows configured
          </p>
        </div>
      ) : (
        <>
          {/* Hero — next show */}
          <ShowsHero show={heroShow} nextTime={getNextShowTime(heroShow.show_times)} />

          {/* Upcoming show cards */}
          {upcomingCards.length > 0 && (
            <div style={{ flexShrink: 0, display: 'flex', gap: '1vw', height: '15vh' }}>
              {upcomingCards.map(({ show, time }) => (
                <UpcomingShowCard key={`${show.id}-${time}`} show={show} time={time} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Progress dots (carousel only) */}
      {showDots && (
        <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
          <ProgressDots count={slideCount} active={slideIndex} glowRgb={FALLBACK_GLOW} />
        </div>
      )}
    </div>
  );
}
