'use client';

import { useEffect, useState } from 'react';
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

  // All shows have passed — return null (no more shows today)
  return null;
}

/* ── Styles matching approved concept ── */

const headerStyle: React.CSSProperties = {
  background:
    'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%), linear-gradient(180deg, rgba(30,30,30,0.95) 0%, rgba(15,15,15,0.95) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '18px 40px',
  textAlign: 'center' as const,
  marginBottom: 12,
  flexShrink: 0,
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02), 0 0 15px rgba(255,255,255,0.03), 0 0 30px rgba(255,255,255,0.015), 0 4px 12px rgba(0,0,0,0.4)',
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: '2.2vw',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
  background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.15))',
  margin: 0,
};

const rideRowStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.14) 0%, rgba(34, 197, 94, 0.09) 100%)',
  border: '1px solid rgba(34, 197, 94, 0.35)',
  boxShadow:
    'inset 0 1px 0 rgba(34, 197, 94, 0.2), inset 0 -1px 0 rgba(34, 197, 94, 0.05), 0 0 12px rgba(34, 197, 94, 0.15), 0 0 25px rgba(34, 197, 94, 0.08)',
};

const showCardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(88, 28, 135, 0.4) 0%, rgba(88, 28, 135, 0.22) 100%)',
  border: '1px solid rgba(168, 85, 247, 0.4)',
  boxShadow:
    'inset 0 1px 0 rgba(168, 85, 247, 0.25), inset 0 -1px 0 rgba(168, 85, 247, 0.05), 0 0 15px rgba(168, 85, 247, 0.2), 0 0 30px rgba(168, 85, 247, 0.1), 0 0 60px rgba(168, 85, 247, 0.05)',
};

const footerStyle: React.CSSProperties = {
  background:
    'radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%), linear-gradient(180deg, rgba(30,30,30,0.95) 0%, rgba(15,15,15,0.95) 100%)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: '14px 40px',
  marginTop: 12,
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  boxShadow:
    'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(255,255,255,0.02), 0 0 15px rgba(255,255,255,0.03), 0 0 30px rgba(255,255,255,0.015), 0 4px 12px rgba(0,0,0,0.4)',
};

/* ── Ride Row Component ── */
function RideRow({ attraction }: { attraction: Attraction }) {
  const status = attraction.status as AttractionStatus;

  return (
    <div
      className="tv1-ride-row"
      style={{
        ...rideRowStyle,
        flex: 1,
        minHeight: 0,
        borderRadius: 14,
        paddingLeft: '4%',
        paddingRight: '4%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Name */}
      <span
        className="tv1-ride-name"
        style={{
          fontSize: '1.6vw',
          fontWeight: 800,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: '#fff',
          textShadow: '0 0 10px rgba(34, 197, 94, 0.3), 0 0 25px rgba(34, 197, 94, 0.1)',
        }}
      >
        {attraction.name}
      </span>

      {/* Status */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        {status === 'CLOSED' && (
          <span
            className="tv1-status-pill"
            style={{
              background: 'rgba(220, 53, 69, 0.15)',
              border: '1px solid rgba(220, 53, 69, 0.3)',
              color: '#f87171',
              fontSize: '1.1vw',
              fontWeight: 700,
              padding: '4px 16px',
              borderRadius: 8,
              textShadow: '0 0 8px rgba(220, 53, 69, 0.5)',
              boxShadow: '0 0 8px rgba(220, 53, 69, 0.1), 0 0 20px rgba(220, 53, 69, 0.05)',
            }}
          >
            Closed
          </span>
        )}
        {status === 'DELAYED' && (
          <span
            className="tv1-status-pill"
            style={{
              background: 'rgba(240, 173, 78, 0.15)',
              border: '1px solid rgba(240, 173, 78, 0.3)',
              color: '#f0ad4e',
              fontSize: '1.1vw',
              fontWeight: 700,
              padding: '4px 16px',
              borderRadius: 8,
              textShadow: '0 0 8px rgba(240, 173, 78, 0.5)',
              boxShadow: '0 0 8px rgba(240, 173, 78, 0.1), 0 0 20px rgba(240, 173, 78, 0.05)',
            }}
          >
            Technical Delay
          </span>
        )}
        {status === 'AT CAPACITY' && (
          <span
            className="tv1-status-pill"
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#F59E0B',
              fontSize: '1.1vw',
              fontWeight: 700,
              padding: '4px 16px',
              borderRadius: 8,
              textShadow: '0 0 8px rgba(245, 158, 11, 0.5)',
              boxShadow: '0 0 8px rgba(245, 158, 11, 0.1), 0 0 20px rgba(245, 158, 11, 0.05)',
            }}
          >
            At Capacity
          </span>
        )}
        {status === 'OPEN' && (
          <>
            <span
              className="tv1-wait-time"
              style={{
                fontSize: '2.2vw',
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                color: '#fff',
                textShadow: '0 0 12px rgba(255,255,255,0.2), 0 0 30px rgba(255,255,255,0.08)',
              }}
            >
              {attraction.wait_time}
            </span>
            <span
              className="tv1-wait-label"
              style={{
                fontSize: '0.9vw',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.45)',
              }}
            >
              Mins
            </span>
          </>
        )}
      </div>
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
        ...showCardStyle,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        padding: '0.6vw 2%',
        textAlign: 'center',
      }}
    >
      {/* Show Name */}
      <div
        className="tv1-show-name"
        style={{
          fontSize: '1.6vw',
          fontWeight: 900,
          marginBottom: '0.15vw',
          color: '#fff',
          textShadow: '0 0 12px rgba(168, 85, 247, 0.5), 0 0 30px rgba(168, 85, 247, 0.2)',
          lineHeight: 1.1,
        }}
      >
        {show.name}
      </div>

      {/* Badge */}
      <div
        className="tv1-show-badge"
        style={{
          fontSize: '0.55vw',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 20,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          background: 'rgba(168, 85, 247, 0.3)',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          color: 'rgba(200, 170, 255, 0.9)',
          textShadow: '0 0 6px rgba(168, 85, 247, 0.5)',
          marginBottom: '0.3vw',
        }}
      >
        Live Show
      </div>

      {/* Status / Next Show */}
      {status === 'CLOSED' ? (
        <span
          className="tv1-show-status"
          style={{
            background: 'rgba(220, 53, 69, 0.15)',
            border: '1px solid rgba(220, 53, 69, 0.3)',
            color: '#f87171',
            fontSize: '1.1vw',
            fontWeight: 700,
            padding: '4px 16px',
            borderRadius: 8,
            textShadow: '0 0 8px rgba(220, 53, 69, 0.5)',
          }}
        >
          Closed
        </span>
      ) : status === 'DELAYED' ? (
        <span
          className="tv1-show-status"
          style={{
            color: '#f0ad4e',
            fontSize: '1.4vw',
            fontWeight: 700,
            textShadow: '0 0 8px rgba(240, 173, 78, 0.5)',
          }}
        >
          Delayed
        </span>
      ) : nextShow ? (
        <>
          <div
            className="tv1-show-next-label"
            style={{
              fontSize: '0.8vw',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.45)',
              marginBottom: '0.1vw',
            }}
          >
            Next Show
          </div>
          <div
            className="tv1-show-time"
            style={{
              fontSize: '2.4vw',
              fontWeight: 900,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              color: '#fff',
              textShadow: '0 0 15px rgba(168, 85, 247, 0.5), 0 0 35px rgba(168, 85, 247, 0.2)',
            }}
          >
            {formatTime12h(nextShow)}
          </div>
        </>
      ) : (
        <div
          className="tv1-show-status"
          style={{
            fontSize: '1.1vw',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.3)',
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
      className="tv1-root"
      style={{
        height: '100vh',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        paddingLeft: TV_SAFE_PADDING,
        paddingRight: TV_SAFE_PADDING,
        paddingTop: '2%',
        paddingBottom: '2%',
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
          .tv1-root .tv1-divider-label {
            font-size: 1.6vw !important;
          }
          .tv1-root .tv1-show-name {
            font-size: 2.8vw !important;
          }
          .tv1-root .tv1-show-badge {
            font-size: 1vw !important;
          }
          .tv1-root .tv1-show-next-label {
            font-size: 1.4vw !important;
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
      {/* Header */}
      <header style={headerStyle}>
        <h1 className="tv1-header-title" style={headerTitleStyle}>Queue Times</h1>
      </header>

      {/* Content */}
      <div className="tv1-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
        {/* Attractions divider */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '4px 8px',
            marginTop: 2,
            marginBottom: 2,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.4))',
            }}
          />
          <span
            className="tv1-divider-label"
            style={{
              fontSize: '0.85vw',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              flexShrink: 0,
              color: 'rgba(34, 197, 94, 0.5)',
            }}
          >
            Attractions
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.4), rgba(34, 197, 94, 0.05))',
            }}
          />
        </div>

        {/* Rides list */}
        <div className="tv1-rides-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
          {sortedRides.map((ride) => (
            <RideRow key={ride.id} attraction={ride} />
          ))}
        </div>

        {/* Live Shows divider */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '4px 8px',
            marginTop: 6,
            marginBottom: 2,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.05), rgba(168, 85, 247, 0.5))',
            }}
          />
          <span
            className="tv1-divider-label"
            style={{
              fontSize: '0.85vw',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              flexShrink: 0,
              color: 'rgba(168, 85, 247, 0.6)',
            }}
          >
            Live Shows
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.5), rgba(168, 85, 247, 0.05))',
            }}
          />
        </div>

        {/* Show cards grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${shows.length || 3}, 1fr)`,
            gap: 10,
            flex: '0 0 auto',
            minHeight: 0,
          }}
        >
          {shows.map((show) => (
            <ShowCard key={show.id} show={show} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer style={footerStyle}>
        <span
          className="tv1-footer-label"
          style={{
            fontSize: '1.4vw',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          Park Closes
        </span>
        <span
          className="tv1-footer-time"
          style={{
            fontSize: '1.8vw',
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: '#fff',
            textShadow: '0 0 10px rgba(255,255,255,0.2), 0 0 25px rgba(255,255,255,0.08)',
          }}
        >
          {formatTime12h(closingTime)}
        </span>
      </footer>
    </div>
  );
}
