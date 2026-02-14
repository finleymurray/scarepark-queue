'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Attraction, AttractionStatus, ParkSetting } from '@/types/database';

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

/* ── Ride Row Component ── */
function RideRow({ attraction, isLast }: { attraction: Attraction; isLast: boolean }) {
  const status = attraction.status as AttractionStatus;

  // Colour-coded status text
  const statusColour =
    status === 'CLOSED' ? '#ef4444' :
    status === 'DELAYED' ? '#f0ad4e' :
    status === 'AT CAPACITY' ? '#F59E0B' :
    '#22C55E';

  const statusLabel =
    status === 'CLOSED' ? 'Closed' :
    status === 'DELAYED' ? 'Delayed' :
    status === 'AT CAPACITY' ? 'At Capacity' :
    null;

  return (
    <div
      className="tv1-ride-row"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 1%',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.15)',
      }}
    >
      {/* Name — white text */}
      <span
        className="tv1-ride-name"
        style={{
          fontSize: '1.9vw',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: '#fff',
          minWidth: 0,
          maxWidth: '70%',
        }}
      >
        {attraction.name}
      </span>

      {/* Status / wait time — colour coded, right aligned */}
      {status === 'OPEN' ? (
        <div
          style={{
            flexShrink: 0,
            marginLeft: 'auto',
            paddingLeft: 16,
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
          }}
        >
          <span
            className="tv1-wait-time"
            style={{
              fontSize: '2.8vw',
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              color: statusColour,
            }}
          >
            {attraction.wait_time}
          </span>
          <span
            className="tv1-wait-label"
            style={{
              fontSize: '1vw',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            min
          </span>
        </div>
      ) : (
        <span
          className="tv1-status-pill"
          style={{
            color: statusColour,
            fontSize: '1.5vw',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
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

/* ── Show Card Component ── */
function ShowCard({ show }: { show: Attraction }) {
  const status = show.status as AttractionStatus;
  const nextShow = getNextShowTime(show.show_times);

  return (
    <div
      className="tv1-show-card"
      style={{
        background: 'linear-gradient(180deg, rgba(88, 28, 135, 0.5) 0%, rgba(50, 15, 90, 0.35) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.4)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.2vw 2%',
        textAlign: 'center',
      }}
    >
      {/* Show Name */}
      <div
        className="tv1-show-name"
        style={{
          fontSize: '1.3vw',
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '0.04em',
          marginBottom: '0.2vw',
          lineHeight: 1.1,
        }}
      >
        {show.name}
      </div>

      {/* Live Show badge */}
      <div
        className="tv1-show-badge"
        style={{
          fontSize: '0.55vw',
          fontWeight: 700,
          padding: '2px 10px',
          borderRadius: 20,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          background: 'rgba(168, 85, 247, 0.25)',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          color: 'rgba(200, 170, 255, 0.9)',
          marginBottom: '0.4vw',
        }}
      >
        Live Show
      </div>

      {/* Status / Next Show — time is the hero */}
      {status === 'CLOSED' ? (
        <span
          className="tv1-show-status"
          style={{
            color: '#ef4444',
            fontSize: '1.6vw',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}
        >
          Closed
        </span>
      ) : status === 'DELAYED' ? (
        <span
          className="tv1-show-status"
          style={{
            color: '#f0ad4e',
            fontSize: '1.6vw',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}
        >
          Delayed
        </span>
      ) : nextShow ? (
        <div
          className="tv1-show-time"
          style={{
            fontSize: '2.8vw',
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            color: '#fff',
          }}
        >
          {formatTime12h(nextShow)}
        </div>
      ) : (
        <div
          className="tv1-show-status"
          style={{
            fontSize: '1.2vw',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.25)',
            textTransform: 'uppercase',
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
        supabase.from('attractions').select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at').order('sort_order', { ascending: true }),
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
        return b.wait_time - a.wait_time;
      })
    : rides;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
        overflow: 'hidden',
      }}
    >
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
      {/* Portrait orientation overrides */}
      <style>{`
        @media (orientation: portrait) {
          .tv1-root .tv1-header-title {
            font-size: 4vw !important;
          }
          .tv1-root .tv1-ride-row {
            flex: 0 0 auto !important;
            min-height: 0 !important;
            padding-top: 2.5vw !important;
            padding-bottom: 2.5vw !important;
          }
          .tv1-root .tv1-ride-name {
            font-size: 2.8vw !important;
          }
          .tv1-root .tv1-wait-time {
            font-size: 4vw !important;
          }
          .tv1-root .tv1-wait-label {
            font-size: 1.6vw !important;
          }
          .tv1-root .tv1-status-pill {
            font-size: 2vw !important;
          }
          .tv1-root .tv1-section-label {
            font-size: 1.8vw !important;
          }
          .tv1-root .tv1-show-name {
            font-size: 2.2vw !important;
          }
          .tv1-root .tv1-show-time {
            font-size: 4.5vw !important;
          }
          .tv1-root .tv1-show-status {
            font-size: 2vw !important;
          }
          .tv1-root .tv1-footer-label {
            font-size: 2.5vw !important;
          }
          .tv1-root .tv1-footer-time {
            font-size: 3.5vw !important;
          }
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

      {/* ── Header ── full-width bar, no rounded container */}
      {!isEmbedded && (
        <header
          style={{
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            padding: '1.5vw 0',
            textAlign: 'center',
            marginBottom: '0.8vw',
            flexShrink: 0,
          }}
        >
          <h1
            className="tv1-header-title"
            style={{
              fontSize: '1.8vw',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.35em',
              color: '#fff',
              margin: 0,
            }}
          >
            Mazes & Shows
          </h1>
        </header>
      )}

      {/* ── Content ── */}
      <div className="tv1-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.6vw', overflow: 'hidden' }}>

        {/* Centred attractions table */}
        <div
          className="tv1-attractions-table"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            width: '60%',
            maxWidth: 900,
            margin: '0 auto',
          }}
        >
          {/* Section label — ATTRACTIONS */}
          <div
            style={{
              flexShrink: 0,
              padding: '0.3vw 0',
              textAlign: 'center',
            }}
          >
            <span
              className="tv1-section-label"
              style={{
                fontSize: '0.9vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.25em',
                color: 'rgba(255,255,255,0.3)',
              }}
            >
              Attractions
            </span>
          </div>

          {/* Rides list — clean table rows with thin separators */}
          <div className="tv1-rides-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {sortedRides.map((ride, i) => (
              <RideRow key={ride.id} attraction={ride} isLast={i === sortedRides.length - 1} />
            ))}
          </div>
        </div>

        {/* Section label — SHOWS */}
        <div
          style={{
            flexShrink: 0,
            padding: '0.3vw 0',
            marginTop: '0.4vw',
            textAlign: 'center',
          }}
        >
          <span
            className="tv1-section-label"
            style={{
              fontSize: '0.9vw',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              color: 'rgba(255,255,255,0.3)',
            }}
          >
            Shows
          </span>
        </div>

        {/* Show cards grid */}
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
      </div>

      {/* ── Footer ── full-width bar, no rounded container */}
      {!isEmbedded && (
        <footer
          style={{
            borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '1.2vw 0',
            marginTop: '0.8vw',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: '1vw',
          }}
        >
          <span
            className="tv1-footer-label"
            style={{
              fontSize: '1vw',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            Park Closes
          </span>
          <span
            className="tv1-footer-time"
            style={{
              fontSize: '2.2vw',
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              color: '#fff',
            }}
          >
            {formatTime12h(closingTime)}
          </span>
        </footer>
      )}
    </div>
    </div>
  );
}
