'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveLogo, resolveBg, resolveLogoGlow, resolveGlowRgb, resolveQueueTextTheme } from '@/lib/logos';
import type { Attraction, ParkSetting } from '@/types/database';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenIdentity } from '@/hooks/useScreenIdentity';
import ParkClosedOverlay from '@/components/ParkClosedOverlay';
import TvFooter from '@/components/tv/TvFooter';

const ATTRACTION_SELECT =
  'id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at,logo_url,bg_url,queue_bg_url,glow_rgb,text_color,text_rgb,tagline';

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
    if (timeMinutes > nowMinutes) {
      return time;
    }
  }

  return null;
}

const TV_SAFE_PADDING = '3.5%';

/* ── Hero card — the next show, attraction-tinted gradient over its photo ── */
function HeroShowCard({ show }: { show: Attraction }) {
  const nextShow = getNextShowTime(show.show_times);
  const logo = resolveLogo(show);
  const bg = resolveBg(show);
  const glowRgb = resolveGlowRgb(show) ?? '168,85,247';
  const theme = resolveQueueTextTheme(show);

  return (
    <div
      key={`${show.id}-${nextShow ?? 'none'}-${show.status}`}
      className="tv-fade"
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
      {/* Background photo */}
      {bg && (
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
      {/* Left-to-right cinematic scrim + attraction-tinted wash so text always reads */}
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
          background: `linear-gradient(160deg, rgba(${glowRgb}, 0.18) 0%, transparent 55%)`,
        }}
      />

      {/* Content — vertically centred stack on the left */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '4vh 4.5vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          maxWidth: '62%',
        }}
      >
        {/* Micro-label */}
        <div
          style={{
            fontSize: '2vh',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.35em',
            color: theme.color,
            textShadow: `0 0 18px rgba(${glowRgb}, 0.6)`,
            marginBottom: '2.5vh',
          }}
        >
          {show.status === 'DELAYED'
            ? 'Technical Delay'
            : show.status === 'CLOSED'
            ? 'Closed'
            : nextShow
            ? 'Up Next'
            : 'No More Shows Tonight'}
        </div>

        {/* Logo or name, large */}
        {logo ? (
          <img
            src={logo}
            alt={show.name}
            decoding="async"
            style={{
              height: '28vh',
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              objectPosition: 'left center',
              filter: resolveLogoGlow(show, 'strong') || undefined,
              marginBottom: '3vh',
            }}
          />
        ) : (
          <h2
            style={{
              fontSize: '7vh',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#fff',
              margin: 0,
              marginBottom: '3vh',
              lineHeight: 1.05,
            }}
          >
            {show.name}
          </h2>
        )}

        {/* Time — huge */}
        {nextShow && show.status !== 'CLOSED' && (
          <div
            style={{
              fontSize: '10vh',
              fontWeight: 800,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              color: theme.color,
              textShadow: `0 0 35px rgba(${glowRgb}, 0.55)`,
              marginBottom: '2vh',
            }}
          >
            {formatTime12h(nextShow)}
          </div>
        )}

        {/* Tagline / venue line */}
        {show.tagline && (
          <div
            style={{
              fontSize: '2.2vh',
              fontWeight: 500,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#CBD5E1',
            }}
          >
            {show.tagline}
          </div>
        )}

        {/* Status text in amber/red when not running normally */}
        {show.status === 'DELAYED' && (
          <div
            style={{
              marginTop: '1.5vh',
              fontSize: '3.2vh',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: '#FBBF24',
            }}
          >
            Technical Delay
          </div>
        )}
        {show.status === 'CLOSED' && (
          <div
            style={{
              marginTop: '1.5vh',
              fontSize: '3.2vh',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: '#F87171',
            }}
          >
            Closed
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Upcoming show card — small: time + name ── */
function UpcomingShowCard({ show, time }: { show: Attraction; time: string }) {
  const glowRgb = resolveGlowRgb(show) ?? '168,85,247';
  const theme = resolveQueueTextTheme(show);

  return (
    <div
      key={`${show.id}-${time}`}
      className="tv-fade"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '1.4vh',
        padding: '0 1.6vw',
        borderRadius: 4,
        border: '1px solid #15181E',
        borderLeft: `4px solid rgba(${glowRgb}, 0.65)`,
        background: `linear-gradient(160deg, rgba(${glowRgb}, 0.08) 0%, rgba(0,0,0,0.3) 100%)`,
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize: '4.5vh',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
          color: theme.color,
        }}
      >
        {formatTime12h(time)}
      </span>
      <span
        style={{
          fontSize: '2.4vh',
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

export default function TV3ShowTimes() {
  useConnectionHealth('tv3');
  useScreenIdentity('/tv3');
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    setIsEmbedded(window.self !== window.top);
  }, []);

  // Tick every 30s so show times auto-advance
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, closingRes] = await Promise.all([
        supabase
          .from('attractions')
          .select(ATTRACTION_SELECT)
          .order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('key,value').eq('key', 'closing_time').single(),
      ]);

      if (!attractionsRes.error) {
        setAttractions(attractionsRes.data || []);
      }
      if (closingRes.data) {
        setClosingTime(closingRes.data.value);
      }
      setLoading(false);
    }

    fetchData();

    const attractionsChannel = supabase
      .channel('tv3-attractions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attractions' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setAttractions((prev) =>
              prev.map((a) =>
                a.id === (payload.new as Attraction).id ? (payload.new as Attraction) : a
              )
            );
          } else if (payload.eventType === 'INSERT') {
            setAttractions((prev) =>
              [...prev, payload.new as Attraction].sort((a, b) => a.sort_order - b.sort_order)
            );
          } else if (payload.eventType === 'DELETE') {
            setAttractions((prev) =>
              prev.filter((a) => a.id !== (payload.old as Attraction).id)
            );
          }
        }
      )
      .subscribe();

    const settingsChannel = supabase
      .channel('tv3-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'closing_time') {
            setClosingTime(setting.value);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attractionsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  // Filter to shows only
  const shows = attractions.filter((a) => a.attraction_type === 'show');

  // Flatten all upcoming (show, time) pairs, chronological
  const nowDate = new Date(now);
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const upcoming = shows
    .flatMap((show) =>
      (show.show_times ?? []).map((time) => {
        const [h, m] = time.split(':');
        return { show, time, minutes: parseInt(h, 10) * 60 + parseInt(m, 10) };
      })
    )
    .filter((e) => e.minutes > nowMinutes)
    .sort((a, b) => a.minutes - b.minutes);

  // Hero = the show with the soonest upcoming time (fallback to first show)
  const heroShow = upcoming[0]?.show ?? shows[0] ?? null;
  // Upcoming cards = subsequent entries (skip the hero's next slot)
  const upcomingCards = upcoming.slice(1, 6);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#07080B' }}>
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: '#07080B',
        paddingLeft: isEmbedded ? 0 : TV_SAFE_PADDING,
        paddingRight: isEmbedded ? 0 : TV_SAFE_PADDING,
        paddingTop: isEmbedded ? 0 : '2%',
        paddingBottom: isEmbedded ? 0 : '2%',
        gap: 0,
      }}
    >
      <ParkClosedOverlay />
      <style>{`
        .tv-fade {
          animation: tv3fade 400ms ease;
        }
        @keyframes tv3fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      {!isEmbedded && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            paddingBottom: '0.8vw',
            borderBottom: '1px solid #15181E',
            marginBottom: '1vw',
          }}
        >
          <h1
            style={{
              fontSize: '1.6vw',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: '#E2E8F0',
              margin: 0,
            }}
          >
            Tonight&apos;s Shows
          </h1>
        </div>
      )}

      {/* Show rail */}
      <main
        className="flex-1"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1vw',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {shows.length === 0 || !heroShow ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#334155', fontSize: '1.5vw', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
              No shows configured
            </p>
          </div>
        ) : (
          <>
            {/* Hero — next show */}
            <HeroShowCard show={heroShow} />

            {/* Upcoming show cards */}
            {upcomingCards.length > 0 && (
              <div style={{ flexShrink: 0, display: 'flex', gap: '1vw', height: '17vh' }}>
                {upcomingCards.map(({ show, time }) => (
                  <UpcomingShowCard key={`${show.id}-${time}`} show={show} time={time} />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer — park brand strip */}
      {!isEmbedded && (
        <footer style={{ flexShrink: 0, marginTop: '1vw' }}>
          <TvFooter closeTime={closingTime ? formatTime12h(closingTime) : null} />
        </footer>
      )}
    </div>
  );
}
