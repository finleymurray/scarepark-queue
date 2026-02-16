'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getQueueBg, getQueueTextTheme } from '@/lib/logos';
import type { Attraction } from '@/types/database';

export default function QueueDisplayClient({ slug }: { slug: string }) {
  const [attraction, setAttraction] = useState<Attraction | null>(null);
  const [loading, setLoading] = useState(true);

  const bgSrc = getQueueBg(slug);
  const theme = getQueueTextTheme(slug);

  useEffect(() => {
    async function fetchAttraction() {
      const { data } = await supabase
        .from('attractions')
        .select('id,name,slug,status,wait_time,sort_order,attraction_type,show_times,updated_at')
        .eq('slug', slug)
        .single();

      if (data) setAttraction(data);
      setLoading(false);
    }

    fetchAttraction();

    const channel = supabase
      .channel(`queue-display-${slug}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'attractions' },
        (payload) => {
          const updated = payload.new as Attraction;
          if (updated.slug === slug) {
            setAttraction(updated);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

  if (loading) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '2vw' }}>Loading...</span>
      </div>
    );
  }

  if (!attraction) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#f87171', fontSize: '2vw' }}>Attraction not found</span>
      </div>
    );
  }

  const isOpen = attraction.status === 'OPEN';
  const isClosed = attraction.status === 'CLOSED';
  const isDelayed = attraction.status === 'DELAYED';
  const isAtCapacity = attraction.status === 'AT CAPACITY';

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Full-bleed background image */}
      {bgSrc && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${bgSrc})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            zIndex: 0,
          }}
        />
      )}

      {/* Subtle vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.4) 100%)',
          zIndex: 1,
        }}
      />

      {/* Content — dead centre */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        {isOpen && (
          <>
            <span
              style={{
                fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
                fontSize: '55vh',
                lineHeight: 0.82,
                fontVariantNumeric: 'tabular-nums',
                color: theme.color,
                textShadow: `0 0 50px rgba(${theme.rgb},0.7), 0 0 100px rgba(${theme.rgb},0.4), 0 0 150px rgba(${theme.rgb},0.2), 0 4px 30px rgba(0,0,0,0.8)`,
                letterSpacing: '-0.02em',
              }}
            >
              {attraction.wait_time}
            </span>
            <span
              style={{
                fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
                fontSize: '10vh',
                letterSpacing: '0.35em',
                color: theme.color,
                textShadow: `0 0 25px rgba(${theme.rgb},0.5), 0 2px 15px rgba(0,0,0,0.8)`,
                marginTop: '1vh',
              }}
            >
              Minutes
            </span>
          </>
        )}

        {isClosed && (
          <span
            style={{
              fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
              fontSize: '25vh',
              letterSpacing: '0.15em',
              color: '#f87171',
              textShadow: '0 0 50px rgba(248,113,113,0.6), 0 0 100px rgba(248,113,113,0.3), 0 4px 30px rgba(0,0,0,0.8)',
            }}
          >
            Closed
          </span>
        )}

        {isDelayed && (
          <span
            style={{
              fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
              fontSize: '20vh',
              letterSpacing: '0.1em',
              textAlign: 'center',
              lineHeight: 1.1,
              color: '#F59E0B',
              textShadow: '0 0 50px rgba(245,158,11,0.6), 0 0 100px rgba(245,158,11,0.3), 0 4px 30px rgba(0,0,0,0.8)',
            }}
          >
            Technical<br />Delay
          </span>
        )}

        {isAtCapacity && (
          <span
            style={{
              fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
              fontSize: '20vh',
              letterSpacing: '0.1em',
              textAlign: 'center',
              lineHeight: 1.1,
              color: '#F59E0B',
              textShadow: '0 0 50px rgba(245,158,11,0.6), 0 0 100px rgba(245,158,11,0.3), 0 4px 30px rgba(0,0,0,0.8)',
            }}
          >
            At Capacity
          </span>
        )}
      </div>
    </div>
  );
}
