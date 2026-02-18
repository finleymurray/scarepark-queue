'use client';

import type { Attraction, AttractionStatus } from '@/types/database';
import type { TV4ContentProps } from './types';

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

/* ── Ride Row Component ── */
function RideRow({ attraction, isLast }: { attraction: Attraction; isLast: boolean }) {
  const status = attraction.status as AttractionStatus;

  const statusColour =
    status === 'CLOSED' ? '#ef4444' :
    status === 'DELAYED' ? '#f0ad4e' :
    status === 'AT CAPACITY' ? '#F59E0B' :
    '#22C55E';

  const statusLabel =
    status === 'CLOSED' ? 'Closed' :
    status === 'DELAYED' ? 'Technical Delay' :
    status === 'AT CAPACITY' ? 'At Capacity' :
    null;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        padding: '0 1%',
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.15)',
      }}
    >
      {/* Name */}
      <span
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

      {/* Status / wait time */}
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
      style={{
        background: 'linear-gradient(180deg, rgba(88, 28, 135, 0.5) 0%, rgba(50, 15, 90, 0.35) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.4)',
        borderRadius: 6,
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

      {/* Status / Next Show */}
      {status === 'CLOSED' ? (
        <span
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
          style={{
            color: '#f0ad4e',
            fontSize: '1.6vw',
            fontWeight: 800,
            textTransform: 'uppercase',
          }}
        >
          Technical Delay
        </span>
      ) : nextShow ? (
        <div
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

export default function TV1Content({ rides, shows }: TV4ContentProps) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0.6vw', overflow: 'hidden', paddingLeft: '1%', paddingRight: '1%', paddingTop: '0.5%', paddingBottom: '0.5%' }}>
      {/* Centred attractions table */}
      <div
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
        <div style={{ flexShrink: 0, padding: '0.3vw 0', textAlign: 'center' }}>
          <span
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

        {/* Rides list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {rides.map((ride, i) => (
            <RideRow key={ride.id} attraction={ride} isLast={i === rides.length - 1} />
          ))}
        </div>
      </div>

      {/* Section label — SHOWS */}
      <div style={{ flexShrink: 0, padding: '0.3vw 0', marginTop: '0.4vw', textAlign: 'center' }}>
        <span
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
  );
}
