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
  const showVignette = slug !== 'the-bunker';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#000',
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

      {/* Very slight vignette — skip for bunker */}
      {showVignette && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.35) 100%)',
            zIndex: 1,
          }}
        />
      )}

      {/* Content — full-width overlay, text-align center for horizontal, translateY for vertical */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
            zIndex: 2,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              display: 'block',
              fontFamily: "var(--font-teko), 'Teko', Impact, sans-serif",
              fontSize: 'min(55vh, 45vw)',
              fontWeight: 900,
              lineHeight: 0.85,
              color: theme.color,
              textShadow: `0 0 50px rgba(${theme.rgb},0.7), 0 0 100px rgba(${theme.rgb},0.4), 0 0 150px rgba(${theme.rgb},0.2), 0 4px 30px rgba(0,0,0,0.8)`,
            }}
          >
            {attraction.wait_time}
          </span>
          <span
            style={{
              display: 'block',
              fontFamily: "var(--font-teko), 'Teko', Impact, sans-serif",
              fontSize: 'min(10vh, 8vw)',
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: '0.35em',
              textIndent: '0.35em',
              textTransform: 'uppercase',
              color: theme.color,
              textShadow: `0 0 25px rgba(${theme.rgb},0.5), 0 2px 15px rgba(0,0,0,0.8)`,
              marginTop: '1vh',
            }}
          >
            Minutes
          </span>
        </div>
      )}

      {isClosed && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
            zIndex: 2,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
              fontSize: 'min(25vh, 20vw)',
              lineHeight: 1,
              letterSpacing: '0.15em',
              color: '#f87171',
              textShadow: '0 0 50px rgba(248,113,113,0.6), 0 0 100px rgba(248,113,113,0.3), 0 4px 30px rgba(0,0,0,0.8)',
            }}
          >
            Closed
          </span>
        </div>
      )}

      {isDelayed && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
            zIndex: 2,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
              fontSize: 'min(20vh, 16vw)',
              letterSpacing: '0.1em',
              lineHeight: 1.1,
              color: '#F59E0B',
              textShadow: '0 0 50px rgba(245,158,11,0.6), 0 0 100px rgba(245,158,11,0.3), 0 4px 30px rgba(0,0,0,0.8)',
            }}
          >
            Technical<br />Delay
          </span>
        </div>
      )}

      {isAtCapacity && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
            zIndex: 2,
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-bebas-neue), 'Bebas Neue', Impact, sans-serif",
              fontSize: 'min(20vh, 16vw)',
              letterSpacing: '0.1em',
              lineHeight: 1.1,
              color: '#F59E0B',
              textShadow: '0 0 50px rgba(245,158,11,0.6), 0 0 100px rgba(245,158,11,0.3), 0 4px 30px rgba(0,0,0,0.8)',
            }}
          >
            At Capacity
          </span>
        </div>
      )}
    </div>
  );
}
