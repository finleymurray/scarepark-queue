'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { resolveLogo, resolveBg, resolveLogoGlow, resolveGlowRgb } from '@/lib/logos';
import type { Attraction, ParkSetting } from '@/types/database';
import { useConnectionHealth } from '@/hooks/useConnectionHealth';
import { useScreenIdentity } from '@/hooks/useScreenIdentity';
import ParkClosedOverlay from '@/components/ParkClosedOverlay';

const ATTRACTION_SELECT =
  'id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at,logo_url,bg_url,queue_bg_url,glow_rgb,text_color,text_rgb,fear_rating,tagline';

function formatTime12h(time: string): string {
  if (!time) return '--:--';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${hour12}:${m} ${ampm}`;
}

/* ── Fallback fear ratings for original attractions without a DB value ── */
const FEAR_RATINGS_FALLBACK: Record<string, number> = {
  'drowned': 5,
  'the-bunker': 5,
  'night-terrors': 4,
  'westlake-witch-trials': 3,
  'strings-of-control': 2,
  'signal-loss': 1,
};

const MAX_RATING = 5;
const TV_SAFE_PADDING = '3.5%';

function getFearRating(a: Attraction): number {
  const db = a.fear_rating;
  if (typeof db === 'number' && db > 0) return Math.min(db, MAX_RATING);
  return Math.min(FEAR_RATINGS_FALLBACK[a.slug] ?? 0, MAX_RATING);
}

/* ── Rating glyphs — ★ filled in glow colour, ☆ empty ── */
function RatingGlyphs({ count, glowRgb }: { count: number; glowRgb: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6vw' }}>
      {Array.from({ length: MAX_RATING }, (_, i) => (
        <span
          key={i}
          style={{
            fontSize: '3vw',
            lineHeight: 1,
            color: i < count ? `rgb(${glowRgb})` : '#334155',
          }}
        >
          {i < count ? '★' : '☆'}
        </span>
      ))}
    </div>
  );
}

/* ── Fear row — photo-washed row: logo left, rating glyphs right ── */
const FearRow = React.memo(function FearRow({
  attraction,
  rowHeight,
  isLast,
}: {
  attraction: Attraction;
  rowHeight: string;
  isLast: boolean;
}) {
  const rating = getFearRating(attraction);
  const logoSrc = resolveLogo(attraction);
  const bgSrc = resolveBg(attraction);
  const glowRgb = resolveGlowRgb(attraction) ?? '251,191,36';
  const logoGlow = resolveLogoGlow(attraction);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: rowHeight,
        borderBottom: isLast ? 'none' : '1px solid #15181E',
        padding: '0 3vw',
        overflow: 'hidden',
        background: '#0A0C10',
      }}
    >
      {/* Background photo wash */}
      {bgSrc && (
        <img
          src={bgSrc}
          alt=""
          decoding="async"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center center',
            opacity: 0.35,
          }}
        />
      )}
      {/* Scrim — keeps logo and glyphs readable over the photo */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.5) 65%, rgba(0,0,0,0.8) 100%)',
        }}
      />

      {/* Glowing logo — left */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          flex: '0 1 auto',
          display: 'flex',
          alignItems: 'center',
          height: '68%',
          minWidth: 0,
          marginRight: '2vw',
        }}
      >
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={attraction.name}
            decoding="async"
            style={{
              height: '100%',
              width: 'auto',
              maxWidth: '38vw',
              objectFit: 'contain',
              objectPosition: 'left center',
              filter: logoGlow || undefined,
            }}
          />
        ) : (
          <span
            style={{
              fontSize: '2.2vw',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#E2E8F0',
              whiteSpace: 'nowrap',
            }}
          >
            {attraction.name}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div style={{ flex: '1 1 0', minWidth: 0 }} />

      {/* Rating glyphs — right */}
      <div key={rating} className="tv-fade" style={{ position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <RatingGlyphs count={rating} glowRgb={glowRgb} />
      </div>
    </div>
  );
});

/* ── Main page ── */

export default function TV35ScreamMeter() {
  useConnectionHealth('tv3.5');
  useScreenIdentity('/tv3.5');
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

  /* Mazes with a fear rating (DB column preferred, hardcoded fallback), highest first */
  const ratedMazes = useMemo(() => {
    return attractions
      .filter((a) => a.attraction_type !== 'show' && getFearRating(a) > 0)
      .sort((a, b) => getFearRating(b) - getFearRating(a));
  }, [attractions]);

  /* Preload images */
  useEffect(() => {
    ratedMazes.forEach((a) => {
      const logo = resolveLogo(a);
      const bg = resolveBg(a);
      if (logo) { const img = new Image(); img.src = logo; }
      if (bg) { const img = new Image(); img.src = bg; }
    });
  }, [ratedMazes]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#07080B' }}>
        <h1 className="text-white/60 text-2xl font-semibold">Loading...</h1>
      </div>
    );
  }

  /* Calculate row height based on available rows */
  const rowCount = ratedMazes.length || 1;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background: '#07080B',
        paddingLeft: isEmbedded ? 0 : TV_SAFE_PADDING,
        paddingRight: isEmbedded ? 0 : TV_SAFE_PADDING,
        paddingTop: isEmbedded ? 0 : '2%',
        paddingBottom: isEmbedded ? 0 : '2%',
      }}
    >
      <ParkClosedOverlay />
      <style>{`
        .tv-fade {
          animation: tv35fade 400ms ease;
        }
        @keyframes tv35fade {
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
            Fear Rating
          </h1>
          <span
            style={{
              fontSize: '0.8vw',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: '#475569',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            Park Closes {formatTime12h(closingTime)}
          </span>
        </div>
      )}

      {/* Fear rows — photo-washed list */}
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
            rowHeight={`${100 / rowCount}%`}
            isLast={idx === ratedMazes.length - 1}
          />
        ))}
      </main>

      {/* Footer — park brand strip */}
      {!isEmbedded && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            borderTop: '1px solid #15181E',
            marginTop: '1vw',
            paddingTop: '0.7vw',
            fontSize: 10,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.3em',
          }}
        >
          <span style={{ color: '#475569' }}>Immersive Core · Fright Nights</span>
          <span style={{ color: '#334155' }}>@immersivecore</span>
        </div>
      )}
    </div>
  );
}
