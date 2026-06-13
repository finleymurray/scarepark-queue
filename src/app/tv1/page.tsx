'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveGlowRgb, resolveQueueTextTheme } from '@/lib/logos';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';
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

/** Given sorted show_times ["18:00","19:30","21:00"], return the next one after now */
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

/* ── Ride Row ── */
function RideRow({ attraction, isLast }: { attraction: Attraction; isLast: boolean }) {
  const status = attraction.status as AttractionStatus;
  const glowRgb = resolveGlowRgb(attraction) ?? '251,191,36';
  const theme = resolveQueueTextTheme(attraction);

  const statusLabel =
    status === 'CLOSED' ? 'Closed' :
    status === 'DELAYED' ? 'Technical Delay' :
    status === 'AT CAPACITY' ? 'At Capacity' :
    null;

  const statusColour =
    status === 'CLOSED' ? '#F87171' : '#FBBF24';

  return (
    <div
      className="tv1-ride-row"
      style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        padding: '0 2.5%',
        borderBottom: isLast ? 'none' : '1px solid #15181E',
        background: `linear-gradient(90deg, rgba(${glowRgb}, 0.10) 0%, transparent 55%)`,
      }}
    >
      {/* Left glow rail */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: '12%',
          bottom: '12%',
          width: 3,
          background: `rgb(${glowRgb})`,
        }}
      />

      {/* Name */}
      <span
        className="tv1-ride-name"
        style={{
          fontSize: '1.9vw',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: '#E2E8F0',
          minWidth: 0,
          maxWidth: '70%',
        }}
      >
        {attraction.name}
      </span>

      {/* Status / wait time — right aligned */}
      {status === 'OPEN' ? (
        <div
          style={{
            flexShrink: 0,
            marginLeft: 'auto',
            paddingLeft: 16,
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <span
            key={attraction.wait_time}
            className="tv1-wait-time tv-fade"
            style={{
              fontSize: '3.2vw',
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              color: theme.color,
            }}
          >
            {attraction.wait_time}
          </span>
          <span
            className="tv1-wait-label"
            style={{
              fontSize: '0.9vw',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: '#475569',
            }}
          >
            min
          </span>
        </div>
      ) : (
        <span
          key={status}
          className="tv1-status-pill tv-fade"
          style={{
            color: statusColour,
            fontSize: '1.4vw',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            flexShrink: 0,
            marginLeft: 'auto',
            paddingLeft: 16,
          }}
        >
          {statusLabel}
        </span>
      )}
    </div>
  );
}

/* ── Show Card ── */
function ShowCard({ show }: { show: Attraction }) {
  const status = show.status as AttractionStatus;
  const nextShow = getNextShowTime(show.show_times);
  const glowRgb = resolveGlowRgb(show) ?? '168,85,247';
  const theme = resolveQueueTextTheme(show);

  return (
    <div
      className="tv1-show-card"
      style={{
        position: 'relative',
        background: `linear-gradient(160deg, rgba(${glowRgb}, 0.12) 0%, rgba(0,0,0,0.4) 100%)`,
        border: '1px solid #15181E',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.2vw 2%',
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Show Name */}
      <div
        className="tv1-show-name"
        style={{
          fontSize: '1.2vw',
          fontWeight: 600,
          color: '#E2E8F0',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: '0.3vw',
          lineHeight: 1.1,
        }}
      >
        {show.name}
      </div>

      {/* Live Show micro-label */}
      <div
        className="tv1-show-badge"
        style={{
          fontSize: '0.55vw',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.25em',
          color: '#475569',
          marginBottom: '0.5vw',
        }}
      >
        Live Show
      </div>

      {/* Status / Next Show — time is the hero */}
      {status === 'CLOSED' ? (
        <span
          className="tv1-show-status tv-fade"
          style={{
            color: '#F87171',
            fontSize: '1.5vw',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          Closed
        </span>
      ) : status === 'DELAYED' ? (
        <span
          className="tv1-show-status tv-fade"
          style={{
            color: '#FBBF24',
            fontSize: '1.5vw',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          Technical Delay
        </span>
      ) : nextShow ? (
        <div
          key={nextShow}
          className="tv1-show-time tv-fade"
          style={{
            fontSize: '2.6vw',
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            color: theme.color,
          }}
        >
          {formatTime12h(nextShow)}
        </div>
      ) : (
        <div
          className="tv1-show-status"
          style={{
            fontSize: '1.1vw',
            fontWeight: 500,
            color: '#334155',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          No More Shows
        </div>
      )}
    </div>
  );
}

const TV_SAFE_PADDING = '3.5%';

export default function TVDisplay() {
  useConnectionHealth('tv1');
  useScreenIdentity('/tv1');
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [autoSort, setAutoSort] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  // isEmbedded = inside any iframe (TV4 carousel, etc.) — hides header/footer
  const [isEmbedded, setIsEmbedded] = useState(false);
  // isExternalEmbed = ?embed=true in URL — shows header/footer, scales to fit
  const [isExternalEmbed, setIsExternalEmbed] = useState(false);
  const [containerScale, setContainerScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inIframe = window.self !== window.top;
    const urlParams = new URLSearchParams(window.location.search);
    const externalEmbed = urlParams.get('embed') === 'true';

    if (externalEmbed) {
      setIsExternalEmbed(true);
      setIsEmbedded(false);
    } else if (inIframe) {
      setIsEmbedded(true);
      setIsExternalEmbed(false);
    }
  }, []);

  // Scale content to fit iframe when externally embedded
  useEffect(() => {
    if (!isExternalEmbed) { setContainerScale(1); return; }

    const calculate = () => {
      const scaleX = window.innerWidth / 1920;
      const scaleY = window.innerHeight / 1080;
      setContainerScale(Math.min(scaleX, scaleY));
    };

    calculate();
    window.addEventListener('resize', calculate);
    return () => window.removeEventListener('resize', calculate);
  }, [isExternalEmbed]);

  // Tick every 30s so show times auto-advance
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, closingRes, autoSortRes] = await Promise.all([
        supabase.from('attractions').select(ATTRACTION_SELECT).order('sort_order', { ascending: true }),
        supabase.from('park_settings').select('key,value').eq('key', 'closing_time').single(),
        supabase.from('park_settings').select('key,value').eq('key', 'auto_sort_by_wait').single(),
      ]);

      if (!attractionsRes.error) {
        setAttractions(attractionsRes.data || []);
      }
      if (closingRes.data) {
        setClosingTime(closingRes.data.value);
      }
      if (autoSortRes.data) {
        setAutoSort(autoSortRes.data.value === 'true');
      }
      setLoading(false);
    }

    fetchData();

    const attractionsChannel = supabase
      .channel('tv1-attractions')
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
      .channel('tv1-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'closing_time') {
            setClosingTime(setting.value);
          } else if (setting.key === 'auto_sort_by_wait') {
            setAutoSort(setting.value === 'true');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attractionsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  // Split into rides and shows
  const rides = attractions.filter((a) => a.attraction_type !== 'show');
  const shows = attractions.filter((a) => a.attraction_type === 'show');

  // Auto-sort only applies to rides
  const sortedRides = autoSort
    ? [...rides].sort((a, b) => {
        const aOpen = a.status === 'OPEN' ? 1 : 0;
        const bOpen = b.status === 'OPEN' ? 1 : 0;
        if (aOpen !== bOpen) return bOpen - aOpen;
        return a.wait_time - b.wait_time;
      })
    : rides;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#07080B' }}>
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#07080B',
        overflow: 'hidden',
      }}
    >
    <ParkClosedOverlay />
    <div
      ref={containerRef}
      className="tv1-root"
      style={{
        width: isExternalEmbed ? 1920 : '100%',
        height: isExternalEmbed ? 1080 : '100%',
        transform: isExternalEmbed ? `scale(${containerScale})` : 'none',
        transformOrigin: 'top left',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingLeft: isEmbedded ? '1%' : TV_SAFE_PADDING,
        paddingRight: isEmbedded ? '1%' : TV_SAFE_PADDING,
        paddingTop: isEmbedded ? '0.5%' : '2%',
        paddingBottom: isEmbedded ? '0.5%' : '2%',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: '#fff',
      }}
    >
      <style>{`
        .tv-fade {
          animation: tv1fade 400ms ease;
        }
        @keyframes tv1fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (orientation: portrait) {
          .tv1-root .tv1-header-title { font-size: 3.4vw !important; }
          .tv1-root .tv1-ride-row {
            flex: 0 0 auto !important;
            min-height: 0 !important;
            padding-top: 2.5vw !important;
            padding-bottom: 2.5vw !important;
          }
          .tv1-root .tv1-ride-name { font-size: 2.8vw !important; }
          .tv1-root .tv1-wait-time { font-size: 4.4vw !important; }
          .tv1-root .tv1-wait-label { font-size: 1.4vw !important; }
          .tv1-root .tv1-status-pill { font-size: 2vw !important; }
          .tv1-root .tv1-section-label { font-size: 1.8vw !important; }
          .tv1-root .tv1-show-name { font-size: 2.2vw !important; }
          .tv1-root .tv1-show-time { font-size: 4.2vw !important; }
          .tv1-root .tv1-show-status { font-size: 2vw !important; }
          .tv1-root .tv1-footer-strip { font-size: 1.6vw !important; }
          .tv1-root .tv1-rides-list {
            flex: 0 1 auto !important;
            overflow: visible !important;
          }
          .tv1-root .tv1-content {
            flex: 1 1 auto !important;
            overflow: auto !important;
          }
        }
      `}</style>

      {/* ── Header ── */}
      {!isEmbedded && (
        <header
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            paddingBottom: '0.8vw',
            borderBottom: '1px solid #15181E',
            marginBottom: '0.8vw',
          }}
        >
          <h1
            className="tv1-header-title"
            style={{
              fontSize: '1.6vw',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: '#E2E8F0',
              margin: 0,
            }}
          >
            Wait Times
          </h1>
        </header>
      )}

      {/* ── Content ── */}
      <div className="tv1-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6vw', overflow: 'hidden' }}>

        {/* Attractions list — full width rows */}
        <div
          className="tv1-attractions-table"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Section label — ATTRACTIONS */}
          <div style={{ flexShrink: 0, padding: '0.3vw 0' }}>
            <span
              className="tv1-section-label"
              style={{
                fontSize: '0.8vw',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.3em',
                color: '#334155',
              }}
            >
              Attractions
            </span>
          </div>

          {/* Rides list — rows sized to fill viewport height */}
          <div className="tv1-rides-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {sortedRides.map((ride, i) => (
              <RideRow key={ride.id} attraction={ride} isLast={i === sortedRides.length - 1} />
            ))}
          </div>
        </div>

        {/* Shows section */}
        {shows.length > 0 && (
          <>
            <div style={{ flexShrink: 0, padding: '0.3vw 0', marginTop: '0.4vw' }}>
              <span
                className="tv1-section-label"
                style={{
                  fontSize: '0.8vw',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.3em',
                  color: '#334155',
                }}
              >
                Shows
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${shows.length || 3}, 1fr)`,
                gap: '0.6vw',
                flex: '0 0 auto',
                minHeight: 0,
              }}
            >
              {shows.map((show) => (
                <ShowCard key={show.id} show={show} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Footer ── park brand strip */}
      {!isEmbedded && (
        <footer style={{ flexShrink: 0, marginTop: '0.8vw' }}>
          <TvFooter closeTime={closingTime ? formatTime12h(closingTime) : null} />
        </footer>
      )}
    </div>
    </div>
  );
}
