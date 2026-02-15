'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { getAttractionLogo } from '@/lib/logos';
import LightningBorder from '@/components/LightningBorder';
import ElectricHeader from '@/components/ElectricHeader';
import type { Attraction, ParkSetting } from '@/types/database';

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

/* ── Fear ratings — hardcoded 1-6 Scream Skull scale, mazes only ── */
const FEAR_RATINGS: Record<string, number> = {
  'drowned': 6,
  'the-bunker': 5,
  'night-terrors': 4,
  'westlake-witch-trials': 3,
  'strings-of-control': 2,
  'signal-loss': 1,
};

const MAX_SKULLS = 6;
const TV_SAFE_PADDING = '3.5%';

/* ── Inline SVG skull path ── */
const SKULL_PATH =
  'M12 2C7.03 2 3 5.58 3 10c0 2.07.86 3.95 2.25 5.33V18a1 1 0 0 0 1 1h1.5v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-2h1.5v2a1 1 0 0 0 1 1h1.5a1 1 0 0 0 1-1v-2h1.5a1 1 0 0 0 1-1v-2.67C20.14 13.95 21 12.07 21 10c0-4.42-4.03-8-9-8z';

function SkullIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{
        flexShrink: 0,
        width: '100%',
        height: '100%',
        opacity: filled ? 1 : 0.12,
        filter: filled
          ? 'drop-shadow(0 0 4px rgba(220,38,38,0.9)) drop-shadow(0 0 10px rgba(220,38,38,0.5))'
          : 'none',
      }}
    >
      <path d={SKULL_PATH} fill="#DC2626" />
      <circle cx="9" cy="10" r="2" fill="#0a0a0a" />
      <circle cx="15" cy="10" r="2" fill="#0a0a0a" />
      <path d="M12 13.5l-1 1.5h2l-1-1.5z" fill="#0a0a0a" />
      <line x1="8" y1="17" x2="16" y2="17" stroke="#0a0a0a" strokeWidth="0.5" />
      <line x1="10" y1="16" x2="10" y2="18" stroke="#0a0a0a" strokeWidth="0.4" />
      <line x1="12" y1="16" x2="12" y2="18" stroke="#0a0a0a" strokeWidth="0.4" />
      <line x1="14" y1="16" x2="14" y2="18" stroke="#0a0a0a" strokeWidth="0.4" />
    </svg>
  );
}

function SkullRow({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5vw' }}>
      {Array.from({ length: MAX_SKULLS }, (_, i) => (
        <div key={i} style={{ width: '2.8vw', height: '2.8vw' }}>
          <SkullIcon filled={i < count} />
        </div>
      ))}
    </div>
  );
}

/* ── Fear row — clean horizontal layout: rank | logo | skulls ── */
const FearRow = React.memo(function FearRow({
  attraction,
  rank,
  rowHeight,
}: {
  attraction: Attraction;
  rank: number;
  rowHeight: string;
}) {
  const rating = FEAR_RATINGS[attraction.slug] ?? 0;
  const logoSrc = getAttractionLogo(attraction.slug);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: rowHeight,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 5vw',
        overflow: 'hidden',
      }}
    >
      {/* Rank number */}
      <span
        style={{
          fontSize: '2.5vw',
          fontWeight: 900,
          color: 'rgba(255,255,255,0.15)',
          fontVariantNumeric: 'tabular-nums',
          width: '3.5vw',
          textAlign: 'center',
          flexShrink: 0,
          marginRight: '1.5vw',
        }}
      >
        {rank}
      </span>

      {/* Logo — constrained to row height, left-aligned */}
      <div
        style={{
          flex: '0 1 auto',
          display: 'flex',
          alignItems: 'center',
          height: '70%',
          minWidth: 0,
          marginRight: '2vw',
        }}
      >
        {logoSrc && (
          <img
            src={logoSrc}
            alt={attraction.name}
            style={{
              height: '100%',
              width: 'auto',
              maxWidth: '38vw',
              objectFit: 'contain',
              objectPosition: 'left center',
            }}
          />
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: '1 1 0', minWidth: 0 }} />

      {/* Skulls — pushed right */}
      <div style={{ flexShrink: 0 }}>
        <SkullRow count={rating} />
      </div>
    </div>
  );
});

/* ── Main page ── */

export default function TV35ScreamMeter() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [closingTime, setClosingTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    setIsEmbedded(window.self !== window.top);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [attractionsRes, closingRes] = await Promise.all([
        supabase
          .from('attractions')
          .select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at')
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
      .channel('tv35-attractions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attractions' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setAttractions((prev) =>
              prev.map((a) =>
                a.id === (payload.new as Attraction).id ? (payload.new as Attraction) : a,
              ),
            );
          } else if (payload.eventType === 'INSERT') {
            setAttractions((prev) =>
              [...prev, payload.new as Attraction].sort((a, b) => a.sort_order - b.sort_order),
            );
          } else if (payload.eventType === 'DELETE') {
            setAttractions((prev) =>
              prev.filter((a) => a.id !== (payload.old as Attraction).id),
            );
          }
        },
      )
      .subscribe();

    const settingsChannel = supabase
      .channel('tv35-settings')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'park_settings' },
        (payload) => {
          const setting = payload.new as ParkSetting;
          if (setting.key === 'closing_time') {
            setClosingTime(setting.value);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(attractionsChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, []);

  /* Filter to mazes that have fear ratings, sorted by rating descending */
  const ratedMazes = useMemo(() => {
    return attractions
      .filter((a) => a.attraction_type !== 'show' && FEAR_RATINGS[a.slug] !== undefined)
      .sort((a, b) => (FEAR_RATINGS[b.slug] ?? 0) - (FEAR_RATINGS[a.slug] ?? 0));
  }, [attractions]);

  /* Preload logo images */
  useEffect(() => {
    ratedMazes.forEach((a) => {
      const logo = getAttractionLogo(a.slug);
      if (logo) {
        const img = new Image();
        img.src = logo;
      }
    });
  }, [ratedMazes]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  /* Calculate row height based on available rows */
  const rowCount = ratedMazes.length || 1;

  return (
    <div
      className="h-screen bg-black flex flex-col overflow-hidden"
      style={{
        paddingLeft: isEmbedded ? 0 : TV_SAFE_PADDING,
        paddingRight: isEmbedded ? 0 : TV_SAFE_PADDING,
        paddingTop: isEmbedded ? 0 : '2%',
        paddingBottom: isEmbedded ? 0 : '2%',
      }}
    >
      {/* Header */}
      {!isEmbedded && (
        <div style={{ flexShrink: 0 }}>
          <ElectricHeader title="Fear Rating" fontSize="2.4vw" />
          <LightningBorder />
        </div>
      )}

      {/* Fear rows — clean list, no backgrounds */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {ratedMazes.map((attraction, idx) => (
          <FearRow
            key={attraction.id}
            attraction={attraction}
            rank={idx + 1}
            rowHeight={`${100 / rowCount}%`}
          />
        ))}
      </main>

      {/* Footer */}
      {!isEmbedded && (
        <div style={{ marginTop: '0.4vw', flexShrink: 0 }}>
          <LightningBorder />
          <div style={{ padding: '0.6vw 0', display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.8vw' }}>
            <span style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif", fontSize: '1.1vw', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.35)' }}>
              Park Closes
            </span>
            <span style={{ fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif", fontSize: '2.4vw', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.06em', color: '#fff' }}>
              {formatTime12h(closingTime)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
